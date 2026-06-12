import { defineConfig } from "vitest/config";

/**
 * Vitest config. resolve.tsconfigPaths (native in Vite 6+) resolves the `@/*` alias
 * and the relative `.velite` import the content layer uses, so tests import the REAL
 * shipping modules (not re-implementations). `vitest run` is chained into the build
 * script so a failing coverage assertion fails the deploy, not just local runs.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  },
});
