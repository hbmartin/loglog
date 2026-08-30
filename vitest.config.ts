import { defineConfig } from "vitest/config";

export default defineConfig({
  // Same native `paths` resolution as vite.config.ts, so "@/..." imports work
  // in tests without a plugin.
  resolve: { tsconfigPaths: true },
  test: {
    // Node by default: the pure modules under src/lib must not need a DOM, and
    // running them without one keeps that honest. Component tests opt in with
    // a `@vitest-environment jsdom` docblock.
    environment: "node",
    // .tsx too - the components are where the branching render logic lives,
    // and an include that cannot reach them makes them untestable by
    // construction.
    include: ["src/**/*.test.{ts,tsx}"],
    // Repairs the localStorage that Node >= 24 shadows out of the jsdom
    // environment; see the file for why. It no-ops under the node
    // environment, so the pure-module tests stay DOM-free.
    setupFiles: ["./src/test-setup.ts"],
  },
});
