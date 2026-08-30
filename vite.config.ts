import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
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
  const substitutions: Record<string, string> = {
    __THEMES__: JSON.stringify(THEMES),
    __THEME_STORAGE_KEY__: THEME_STORAGE_KEY,
    __LEGACY_THEME_STORAGE_KEY__: LEGACY_THEME_STORAGE_KEY,
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
          return current.replaceAll(marker, value);
        }, html);
      },
    },
  };
}

/**
 * Stamps a fingerprint of the emitted bundle into public/sw.js.
 *
 * public/ is copied verbatim, so the service worker cannot hash itself; see
 * the comment on CACHE_VERSION there for what a constant cache name costs.
 */
function serviceWorkerVersion(): Plugin {
  const MARKER = "__CACHE_VERSION__";
  let outDir = "dist";
  let version = "dev";

  return {
    name: "loglog:sw-version",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      // Asset filenames are content-hashed, so this changes when, and only
      // when, something the service worker would cache changes.
      version = createHash("sha256")
        .update(Object.keys(bundle).sort().join("\n"))
        .digest("hex")
        .slice(0, 12);
    },
    async closeBundle() {
      const file = path.join(outDir, "sw.js");
      const source = await readFile(file, "utf8");
      if (!source.includes(MARKER)) {
        throw new Error(
          `${file} no longer contains ${MARKER}. Without it the service worker cache name never changes, so stale asset caches are never pruned.`,
        );
      }
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
