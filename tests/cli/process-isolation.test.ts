import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, MAX_TIMEOUT_MS } from "../../cli/lib/constants.mjs";
import {
  bytesResponder,
  holdingResponder,
  type MockApi,
} from "./support/mock-api";
import {
  CLI_DEADLINE_MS,
  PROCESS_TEST_TIMEOUT_MS,
  cliVersion,
  setupProcessHarness,
} from "./support/process-harness";
import { runCli } from "./support/run-cli";

/**
 * The real binary against a mock API: no answer (slow, stalled, nothing listening), the commands
 * that must make no request at all, and proof that it writes no file and reads no other variable.
 */

const { mockApi, scratchDir, stopNow } = setupProcessHarness();

describe("no answer", () => {
  // The server holds the response until the test lets it go, and the test lets it go only after
  // the CLI has exited. So "the CLI did not wait for the server" is proved by the order of events
  // (the CLI left while the server was still holding), not by how long anything took.
  it(
    "exits 3 by its own deadline when the server never answers",
    async () => {
      const hold = holdingResponder();
      const api = await mockApi(hold.respond);
      const result = await runCli([
        "status",
        "--timeout",
        String(CLI_DEADLINE_MS),
        "--base-url",
        api.baseUrl,
      ]);
      expect(hold.isReleased()).toBe(false);
      hold.release();
      expect(result.code).toBe(3);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe(
        `anvilry: The request to ${api.baseUrl}/api/v1 timed out after ${CLI_DEADLINE_MS} ms.\n`,
      );
    },
    PROCESS_TEST_TIMEOUT_MS,
  );

  it(
    "exits 3 by its own deadline when the server sends the headers and stalls on the body",
    async () => {
      const hold = holdingResponder('{"partial":');
      const api = await mockApi(hold.respond);
      const result = await runCli([
        "status",
        "--timeout",
        String(CLI_DEADLINE_MS),
        "--base-url",
        api.baseUrl,
      ]);
      expect(hold.isReleased()).toBe(false);
      hold.release();
      expect(result.code).toBe(3);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`timed out after ${CLI_DEADLINE_MS} ms`);
    },
    PROCESS_TEST_TIMEOUT_MS,
  );

  it("exits 3 when nothing is listening", async () => {
    const api = await mockApi();
    const deadUrl = api.baseUrl;
    await stopNow(api);
    const result = await runCli(["status", "--base-url", deadUrl]);
    expect(result.code).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      `Could not get an answer from ${deadUrl}/api/v1`,
    );
    expect(result.stderr).toContain("ECONNREFUSED");
  });
});

describe("the process ends by itself", () => {
  // The CLI gets the longest deadline it accepts (ten minutes). If it left that timer running after
  // it had finished, the process would stay alive until the deadline, and the child watchdog in
  // runCli would fail the test with "did not exit". Nothing here measures how long anything took:
  // an honest run exits at once, and a leaked timer never exits within the test.
  const LONGEST_DEADLINE = String(MAX_TIMEOUT_MS);

  it("after a successful answer", async () => {
    const api = await mockApi();
    const result = await runCli([
      "status",
      "--timeout",
      LONGEST_DEADLINE,
      "--base-url",
      api.baseUrl,
    ]);
    expect(result.code).toBe(0);
  });

  it("after an API error", async () => {
    const api = await mockApi();
    const result = await runCli([
      "projects",
      "nope",
      "--timeout",
      LONGEST_DEADLINE,
      "--base-url",
      api.baseUrl,
    ]);
    expect(result.code).toBe(2);
  });

  it("after a refused connection", async () => {
    const api = await mockApi();
    const deadUrl = api.baseUrl;
    await stopNow(api);
    const result = await runCli([
      "status",
      "--timeout",
      LONGEST_DEADLINE,
      "--base-url",
      deadUrl,
    ]);
    expect(result.code).toBe(3);
  });

  it("after refusing a body that is too large", async () => {
    const api = await mockApi(bytesResponder(Buffer.alloc(MAX_BODY_BYTES + 1)));
    const result = await runCli([
      "profile",
      "--timeout",
      LONGEST_DEADLINE,
      "--base-url",
      api.baseUrl,
    ]);
    expect(result.code).toBe(2);
  });
});

describe("commands that must not touch the network", () => {
  const pointedAtMock = (api: MockApi) => ({
    env: { ANVILRY_BASE_URL: api.baseUrl },
  });

  it("prints help and version without a request", async () => {
    const api = await mockApi();
    const [help, flagHelp, version, versionCommand] = await Promise.all(
      [["help"], ["--help"], ["--version"], ["version"]].map((argv) =>
        runCli(argv, pointedAtMock(api)),
      ),
    );
    expect(help.code).toBe(0);
    expect(help.stdout).toContain("Usage: anvilry <command>");
    expect(flagHelp.stdout).toBe(help.stdout);
    expect(version.stdout).toBe(`${await cliVersion()}\n`);
    expect(version.code).toBe(0);
    expect(versionCommand.stdout).toBe(version.stdout);
    expect(api.received()).toHaveLength(0);
  });

  it("fails usage errors with exit 1 and usage text, without a request", async () => {
    const api = await mockApi();
    const cases: string[][] = [
      [],
      ["frobnicate"],
      ["work", "../etc/passwd"],
      ["work", "a", "b"],
      ["search"],
      ["status", "--timeout", "never"],
      ["status", "--unknown"],
      ["decisions", "--tag"],
    ];
    const results = await Promise.all(
      cases.map((argv) => runCli(argv, pointedAtMock(api))),
    );
    results.forEach((result, index) => {
      expect(result.code, cases[index].join(" ")).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(
        "Usage: anvilry <command> [arguments] [flags]",
      );
    });
    expect(api.received()).toHaveLength(0);
  });

  it("rejects a slug that would climb out of the API path, before any request", async () => {
    const api = await mockApi();
    const slugs = [
      "..",
      "../profile",
      "a/b",
      "%2e%2e",
      "a?b=c",
      "a".repeat(121),
    ];
    const results = await Promise.all(
      slugs.map((slug) =>
        runCli(["projects", slug, "--base-url", api.baseUrl]),
      ),
    );
    results.forEach((result, index) => {
      expect(result.code, slugs[index]).toBe(1);
    });
    expect(api.received()).toHaveLength(0);
  });
});

describe("side effects", () => {
  it("writes no file, in the working directory or the home directory", async () => {
    const api = await mockApi();
    const cwd = await scratchDir();
    const home = await scratchDir();
    const argvs = [
      ["profile"],
      ["projects", "nope"],
      ["help"],
      ["batch", "/api/v1/profile"],
    ];
    await Promise.all(
      argvs.map((argv) =>
        runCli([...argv, "--base-url", api.baseUrl], {
          cwd,
          env: {
            HOME: home,
            XDG_CONFIG_HOME: home,
            XDG_CACHE_HOME: home,
            TMPDIR: home,
          },
        }),
      ),
    );
    expect(await readdir(cwd)).toEqual([]);
    expect(await readdir(home)).toEqual([]);
  });

  it("ignores every environment variable except ANVILRY_BASE_URL", async () => {
    const api = await mockApi();
    const result = await runCli(["status"], {
      env: {
        ANVILRY_BASE_URL: api.baseUrl,
        PROBE_VARIABLE: "probe-value-must-not-be-sent",
        HTTP_PROXY: "http://127.0.0.1:1",
      },
    });
    expect(result.code).toBe(0);
    const [request] = api.received();
    expect(JSON.stringify(request.headers)).not.toContain(
      "probe-value-must-not-be-sent",
    );
  });
});
