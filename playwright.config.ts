import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Server management.
  //
  // Previously this was deliberately absent ("run `pnpm dev` first"), which respected the
  // /dev-local workflow but had a real failure mode: if a STALE server already held :3000 (or a
  // new one failed to bind with EADDRINUSE), Playwright silently tested whatever was listening —
  // an older build. That produced 5 "failures" twice during a release audit and read exactly like
  // an app regression. Nothing surfaced the cause.
  //
  // `reuseExistingServer: !process.env.CI` keeps the existing local workflow intact (an already-
  // running `pnpm dev` / `pnpm start` is reused, nothing is duplicated), while guaranteeing that a
  // server IS up and answering before any test runs. In CI it always starts a fresh one, so the
  // suite is self-contained and needs no manual setup step.
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
