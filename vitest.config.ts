import { defineConfig } from "vitest/config";

/**
 * Vitest config. resolve.tsconfigPaths (native in Vite 6+) resolves the `@/*` alias
 * and the relative `.velite` import the content layer uses, so tests import the REAL
 * shipping modules (not re-implementations). `vitest run` is chained into the build
 * script so a failing coverage/behavior assertion fails the deploy, not just local runs.
 *
 * Two projects:
 *  - "node"     — the default, fast environment for pure logic (content coverage,
 *                 command registry, history/completion/theme helpers). Excludes the
 *                 DOM suites so jsdom globals never leak into pure tests.
 *  - "dom"      — happy-dom environment for the scroll hooks, which need a real
 *                 ResizeObserver / scroll geometry / element refs. Matches *.dom.test.tsx.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // Force NODE_ENV=test for the test run. Vitest only defaults NODE_ENV to "test"
    // when it's UNSET — but the build chain runs inside `pnpm build`, and on Vercel the
    // build shell sets NODE_ENV=production. That makes React load its PRODUCTION bundle,
    // which strips `act` (a dev/test-only API) → @testing-library/react's renderHook
    // crashes with "React.act is not a function" and every DOM test fails the deploy.
    // Setting it here is deterministic regardless of the calling shell, and scoped to
    // the Vitest worker only — the separate `next build` process still runs in production.
    env: { NODE_ENV: "test" },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
          exclude: ["**/*.dom.test.{ts,tsx}", "**/node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["src/**/*.dom.test.{ts,tsx}", "tests/**/*.dom.test.{ts,tsx}"],
        },
      },
    ],
  },
});
