import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY, THEMES } from "./src/lib/theme";

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

/**
 * sha256 over every file emitted under `dir`, `exclude` aside, path and bytes
 * both - a rename with identical contents is still a different site.
 */
async function hashOutput(dir: string, exclude: string): Promise<string> {
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

  // Sorted, so the fingerprint does not follow the order the walk happened to
  // finish in.
  files.sort();
  const contents = await Promise.all(files.map((file) => readFile(file)));

  const hash = createHash("sha256");
  for (const [index, file] of files.entries()) {
    hash.update(path.relative(dir, file));
    hash.update(contents[index]);
  }
  return hash.digest("hex").slice(0, 12);
}

/**
 * Stamps a fingerprint of the emitted site into public/sw.js.
 *
 * public/ is copied verbatim, so the service worker cannot hash itself; see
 * the comment on CACHE_VERSION there for what a constant cache name costs.
 */
function serviceWorkerVersion(): Plugin {
  const MARKER = "__CACHE_VERSION__";
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
      if (!source.includes(MARKER)) {
        throw new Error(
          `${file} no longer contains ${MARKER}. Without it the service worker cache name never changes, so stale asset caches are never pruned.`,
        );
      }
      // The emitted files themselves, not the bundle's key names. Chunk names
      // are content-hashed, but index.html and everything copied out of
      // public/ keep a fixed name - and those are what the install handler
      // caches. Off names alone, a deploy that touches only them leaves this
      // file byte-identical, so the browser sees no new worker to install and
      // the previous cache is never pruned.
      const version = await hashOutput(outDir, file);
      await writeFile(file, source.replaceAll(MARKER, version));
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
