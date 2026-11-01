import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, vi } from "vitest";
import {
  portfolioResponder,
  startMockApi,
  type MockApi,
  type Responder,
} from "./mock-api";
import { CLI_ROOT, killStrayChildren } from "./run-cli";

/**
 * Timeout of a test (and of its hooks) that starts node processes. A start takes about 0.3 s on a
 * quiet machine and the Vercel build runs the whole suite in parallel, so this is far above any
 * honest run; it only bounds a hang.
 */
export const PROCESS_TEST_TIMEOUT_MS = 60_000;

/**
 * The --timeout the CLI is given when a test needs it to give up. The deadline starts when the
 * CLI begins its request, so this leaves seconds for a loaded machine to load fetch and connect,
 * and the tests assert on what the CLI printed and returned, never on how long it took.
 */
export const CLI_DEADLINE_MS = 4_000;

/**
 * Shared setup for the tests that run the real binary against a mock API. Call it once at the top
 * of a test file: it raises the test and hook timeouts and registers the hook that closes every
 * mock server, removes every scratch directory the test created and fails the test if a CLI
 * process is still running after it.
 */
export function setupProcessHarness() {
  vi.setConfig({
    testTimeout: PROCESS_TEST_TIMEOUT_MS,
    hookTimeout: PROCESS_TEST_TIMEOUT_MS,
  });

  const servers: MockApi[] = [];
  const directories: string[] = [];

  afterEach(async () => {
    const strays = killStrayChildren();
    await Promise.all(servers.splice(0).map((api) => api.close()));
    await Promise.all(
      directories
        .splice(0)
        .map((dir) => rm(dir, { recursive: true, force: true })),
    );
    expect(strays, "CLI processes still running after the test").toBe(0);
  });

  return {
    /** Starts a mock API (the portfolio-like responder unless one is given). */
    async mockApi(respond: Responder = portfolioResponder()): Promise<MockApi> {
      const api = await startMockApi(respond);
      servers.push(api);
      return api;
    },

    /** Stops a mock API now, so its port is left with nothing listening. */
    async stopNow(api: MockApi): Promise<void> {
      servers.splice(servers.indexOf(api), 1);
      await api.close();
    },

    async scratchDir(): Promise<string> {
      const dir = await mkdtemp(join(tmpdir(), "anvilry-cli-test-"));
      directories.push(dir);
      return dir;
    },
  };
}

/** The version in cli/package.json, which the binary must report and put in its User-Agent. */
export async function cliVersion(): Promise<string> {
  const manifest = JSON.parse(
    await readFile(join(CLI_ROOT, "package.json"), "utf8"),
  ) as { version: string };
  return manifest.version;
}
