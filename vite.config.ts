import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY, THEMES } from "./src/lib/theme.ts";

/**
 * Substitutes the theme storage keys into the pre-paint script in index.html.
 *
 * That script has to run before React mounts, so it cannot import from
 * src/lib/theme.ts. Injecting the values here keeps that module the only place
 * the keys are written down, instead of a hand-synced second copy that can
 * drift and flash the wrong theme.
 */
function themeKeys(): Plugin {
  // Every value is stringified and every marker stands unquoted in the script,
  // so a key holding a quote or a backslash cannot break out of its literal. A
  // parse error there would kill the whole pre-paint block, its own try/catch
  // included, and flash the wrong theme on every load with nothing reported.
  const substitutions: Record<string, string> = {
    __THEMES__: JSON.stringify(THEMES),
    __THEME_STORAGE_KEY__: JSON.stringify(THEME_STORAGE_KEY),
    __LEGACY_THEME_STORAGE_KEY__: JSON.stringify(LEGACY_THEME_STORAGE_KEY),
  };

  return {
    name: "loglog:theme-keys",
    transformIndexHtml: {
      // Ahead of Vite's own %VAR% substitution, so neither can see the other's
      // markers.
      order: "pre",
      handler(html) {
        return Object.entries(substitutions).reduce((current, [marker, value]) => {
          if (!current.includes(marker)) {
            throw new Error(
              `index.html no longer contains ${marker}. The pre-paint theme script must keep it, or the theme resolves from the wrong key and flashes on load.`,
            );
          }
          // A function, so that a `$&` or `$'` sequence inside a key is
          // inserted rather than expanded as a replacement pattern.
          return current.replaceAll(marker, () => value);
        }, html);
      },
    },
  };
}

/** Every file emitted under `dir`, `exclude` aside, as absolute paths. */
async function emittedFiles(dir: string, exclude: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (current: string): Promise<void> => {
    const entries = await readdir(current, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (full !== exclude) {
          files.push(full);
        }
      }),
    );
  };
  await walk(dir);

  // Sorted, so neither the fingerprint nor the pre-cache list follows the
  // order the walk happened to finish in.
  files.sort();
  return files;
}

/**
 * sha256 over `files`, path and bytes both - a rename with identical contents
 * is still a different site.
 */
async function fingerprint(files: readonly string[], dir: string): Promise<string> {
  const contents = await Promise.all(files.map((file) => readFile(file)));

  const hash = createHash("sha256");
  for (const [index, file] of files.entries()) {
    hash.update(path.relative(dir, file));
    hash.update(contents[index]);
  }
  return hash.digest("hex").slice(0, 12);
}

const FONT_FILE = /\.(?:woff2?|ttf|otf|eot)$/i;

/**
 * Root-relative URLs for the emitted files under `assets/` that the service
 * worker should pre-cache on install.
 *
 * Faces are left out. @fontsource emits one file per script - Latin,
 * Latin-ext, Cyrillic, Cyrillic-ext, Vietnamese, Hebrew - and a given reader
 * renders one or two of the eight we ship, so pre-caching the set spends
 * ~150 kB of a fresh download on every deploy on glyphs that will never be
 * drawn. They are also the one asset class that degrades gracefully: a face
 * missing offline falls through to the stack behind it, where a missing chunk
 * is a blank screen. The worker's fetch handler still caches whichever subset
 * the page actually loads, so the second offline visit has it.
 */
function assetUrls(files: readonly string[], dir: string): string[] {
  return (
    files
      .map((file) => path.relative(dir, file).split(path.sep))
      .filter(
        (segments) => segments[0] === "assets" && !FONT_FILE.test(segments[segments.length - 1]),
      )
      // Encoded exactly as Vite encodes it, because the only thing that
      // matters here is that the key the worker caches under is the URL the
      // page requests, character for character: anything else and
      // caches.match misses and the asset is simply unavailable on the first
      // offline load after a deploy, silently.
      //
      // Vite keeps the source basename for many imported assets and writes
      // their URLs through encodeURIPath, which is encodeURI over the path.
      // encodeURIComponent is the stricter escape and so the wrong one - it
      // also escapes "@", ",", ";", ":", "=", "+", "$" and "&", none of which
      // sanitizeFileName strips, so "logo@2x-hash.png" would be pre-cached as
      // "logo%402x-hash.png" and requested as itself. A "#" or "?" in a
      // filename is broken either way, in the bundler's output as much as
      // here, and matching it is still the right answer.
      .map((segments) => encodeURI(`/${segments.join("/")}`))
  );
}

/**
 * Stamps a fingerprint of the emitted site, and the list of emitted assets,
 * into public/sw.js.
 *
 * public/ is copied verbatim, so the service worker can neither hash itself
 * nor see what the bundler emitted alongside it; see the comments on
 * CACHE_VERSION and BUILD_ASSETS there for what each is load-bearing for.
 */
function serviceWorkerVersion(): Plugin {
  // One entry per marker, holding both what replaces it and what breaks if
  // the worker no longer carries it. A presence guard and a substitution map
  // kept side by side drift: a marker added to only one either fails the
  // build for no reason or, worse, passes the guard and is written into
  // dist/sw.js verbatim.
  const MARKERS: Record<
    string,
    {
      consequence: string;
      value: (files: readonly string[], dir: string) => string | Promise<string>;
    }
  > = {
    __CACHE_VERSION__: {
      consequence:
        "Without it the service worker cache name never changes, so stale asset caches are never pruned.",
      value: (files, dir) => fingerprint(files, dir),
    },
    __BUILD_ASSETS__: {
      consequence:
        "Without it the worker pre-caches nothing, and the first offline load after a deploy has a shell with no code behind it.",
      value: (files, dir) => JSON.stringify(assetUrls(files, dir)),
    },
    // The list above is named once, inside the branch this guard selects, so
    // that the substitution writes it into dist/sw.js once. Guarding the
    // worker on a `typeof` of the list marker instead named it twice and
    // stamped every URL twice, into a file _headers marks no-cache; the
    // once-only check below is what now catches that.
    __BUILD_STAMPED__: {
      consequence:
        "Without it the worker takes its unstamped branch and pre-caches no assets at all, whatever __BUILD_ASSETS__ holds.",
      value: () => "true",
    },
  };
  let outDir = "dist";

  return {
    name: "loglog:sw-version",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const file = path.join(outDir, "sw.js");
      const source = await readFile(file, "utf8");
      // Exactly once, not merely present. Every marker is replaced everywhere
      // it appears, comments included, so a doc comment that names the marker
      // it documents writes the whole value into the file a second time - a
      // file _headers marks no-cache, and so one the browser downloads in full
      // on every load. Presence alone was satisfied by that second mention,
      // which is how the asset list came to be stamped twice.
      for (const [marker, { consequence }] of Object.entries(MARKERS)) {
        const mentions = source.split(marker).length - 1;
        if (mentions === 0) {
          throw new Error(`${file} no longer contains ${marker}. ${consequence}`);
        }
        if (mentions > 1) {
          throw new Error(
            `${file} names ${marker} ${mentions} times and every mention is substituted. Name it once, in the line that reads it.`,
          );
        }
      }

      // The emitted files themselves, not the bundle's key names. Chunk names
      // are content-hashed, but index.html and everything copied out of
      // public/ keep a fixed name - and those are what the install handler
      // caches. Off names alone, a deploy that touches only them leaves this
      // file byte-identical, so the browser sees no new worker to install and
      // the previous cache is never pruned.
      const files = await emittedFiles(outDir, file);
      const entries = Object.entries(MARKERS);
      const values = await Promise.all(entries.map(([, { value }]) => value(files, outDir)));

      const stamped = entries.reduce(
        // A function, for the same reason the theme plugin above uses one: a
        // `$` sequence in a value must be inserted, not expanded.
        (current, [marker], index) => current.replaceAll(marker, () => values[index]),
        source,
      );
      await writeFile(file, stamped);
    },
  };
}

export default defineConfig({
  server: { port: 3000, host: "::" },
  // Vite 8 resolves tsconfig `paths` itself; the vite-tsconfig-paths plugin
  // this replaces was the last thing pulling in a TypeScript 5 peer.
  resolve: { tsconfigPaths: true },
  build: {
    // Stated explicitly rather than left to the bundler's moving default,
    // because tsconfig.json's `lib` has to match it: anything newer than these
    // browsers typechecks clean and then throws on a device we claim to
    // support. Safari 16.0 is the binding constraint - it rules out the ES2023
    // array methods, which nothing here polyfills.
    target: ["chrome107", "edge107", "firefox104", "safari16"],
  },
  plugins: [
    tailwindcss(),
    themeKeys(),
    serviceWorkerVersion(),
    // Must come before the React plugin.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    viteReact(),
  ],
});
