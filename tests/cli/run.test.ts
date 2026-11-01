import { describe, expect, it } from "vitest";
import { json, runInProcess } from "./support/in-process";

/**
 * The CLI run in-process with a scripted fetch: what it sends and what it prints on success.
 * Errors are in run-errors.test.ts, batch and network failures in run-batch-and-network.test.ts,
 * and process.test.ts runs the real binary against a mock HTTP server.
 */

describe("commands that make no request", () => {
  it("prints the help text on stdout for help, --help and a trailing --help", async () => {
    for (const argv of [["help"], ["--help"], ["work", "--help"]]) {
      const result = await runInProcess(argv);
      expect(result.code).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain(
        "Usage: anvilry <command> [arguments] [flags]",
      );
      expect(result.stdout).toContain("anvilry decisions [--tag <tag>]");
      expect(result.stdout).toContain("--base-url <url>");
      expect(result.stdout).toContain("Exit codes:");
      expect(result.calls).toHaveLength(0);
    }
  });

  it("prints only the version for version and --version", async () => {
    for (const argv of [["version"], ["--version"]]) {
      const result = await runInProcess(argv);
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
      expect(result.stderr).toBe("");
      expect(result.calls).toHaveLength(0);
    }
  });

  it("exits 1 with the usage text on stderr, nothing on stdout and no request", async () => {
    const result = await runInProcess(["work", "../etc/passwd"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("anvilry: A slug is 1 to 120");
    expect(result.stderr).toContain(
      "Usage: anvilry <command> [arguments] [flags]",
    );
    expect(result.stderr).toContain("anvilry batch <path> [<path>...]");
    expect(result.calls).toHaveLength(0);
  });

  it("exits 1 for no command at all", async () => {
    const result = await runInProcess([]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Missing command");
    expect(result.calls).toHaveLength(0);
  });
});

describe("what is sent", () => {
  it("makes exactly one request with the version, user agent and a deadline", async () => {
    const result = await runInProcess(["projects", "trelix"]);
    expect(result.calls).toHaveLength(1);
    const [{ url, init }] = result.calls;
    expect(url).toBe("https://anvilry.vercel.app/api/v1/projects/trelix");
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({
      "API-Version": "1",
      Accept: "application/json",
      "User-Agent": expect.stringMatching(/^anvilry-cli\/\d+\.\d+\.\d+/),
    });
    expect(init.body).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("encodes a query so it cannot change the path or add parameters", async () => {
    const result = await runInProcess(["search", "a b&q=2/../é"]);
    expect(result.calls[0].url).toBe(
      "https://anvilry.vercel.app/api/v1/search?q=a%20b%26q%3D2%2F..%2F%C3%A9",
    );
  });

  it("posts a batch once, with the JSON body and content type", async () => {
    const result = await runInProcess(
      ["batch", "/api/v1/profile", "/api/v1/work"],
      () => json({ responses: [] }),
    );
    expect(result.calls).toHaveLength(1);
    const [{ url, init }] = result.calls;
    expect(url).toBe("https://anvilry.vercel.app/api/v1/batch");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({
      requests: [
        { id: "1", method: "GET", path: "/api/v1/profile" },
        { id: "2", method: "GET", path: "/api/v1/work" },
      ],
    });
  });

  it("takes the base URL from ANVILRY_BASE_URL, and --base-url wins", async () => {
    const env = { ANVILRY_BASE_URL: "http://env.example:8080" };
    expect((await runInProcess(["status"], undefined, env)).calls[0].url).toBe(
      "http://env.example:8080/api/v1",
    );
    const flagged = await runInProcess(
      ["status", "--base-url", "http://flag.example"],
      undefined,
      env,
    );
    expect(flagged.calls[0].url).toBe("http://flag.example/api/v1");
  });
});

describe("a successful answer", () => {
  it("pretty-prints JSON on stdout and leaves stderr empty", async () => {
    const result = await runInProcess(["profile"], () =>
      json({ name: "Sairam Ugge", skills: ["Go"] }),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(
      '{\n  "name": "Sairam Ugge",\n  "skills": [\n    "Go"\n  ]\n}\n',
    );
    expect(result.stderr).toBe("");
  });

  it("prints the body exactly as received with --raw", async () => {
    const body = '{"b":1,   "a":[1,2]}';
    const result = await runInProcess(
      ["profile", "--raw"],
      () => new Response(body, { status: 200 }),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toBe(body);
  });

  it("with --raw also prints a body that is not JSON, and exits 0", async () => {
    const result = await runInProcess(
      ["openapi", "--raw"],
      () => new Response("# not json\n"),
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("# not json\n");
  });

  it("prints the API-Version and RateLimit headers to stderr only with --headers", async () => {
    const headers = {
      "API-Version": "1",
      "RateLimit-Policy": '"default";q=300;w=60',
      RateLimit: '"default";r=299;t=60',
      "RateLimit-Limit": "300",
      "RateLimit-Remaining": "299",
      "RateLimit-Reset": "60",
      "X-Unrelated": "ignore me",
    };
    const quiet = await runInProcess(["status"], () => json({ ok: 1 }, 200, headers));
    expect(quiet.stderr).toBe("");

    const loud = await runInProcess(["status", "--headers"], () =>
      json({ ok: 1 }, 200, headers),
    );
    expect(loud.code).toBe(0);
    expect(loud.stdout).toBe('{\n  "ok": 1\n}\n');
    expect(loud.stderr).toBe(
      [
        "api-version: 1",
        'ratelimit-policy: "default";q=300;w=60',
        'ratelimit: "default";r=299;t=60',
        "ratelimit-limit: 300",
        "ratelimit-remaining: 299",
        "ratelimit-reset: 60",
        "",
      ].join("\n"),
    );
  });

  it("omits header lines the server did not send", async () => {
    const result = await runInProcess(["status", "--headers"], () =>
      json({}, 200, { "API-Version": "1" }),
    );
    expect(result.stderr).toBe("api-version: 1\n");
  });
});
