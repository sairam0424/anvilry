import { describe, expect, it } from "vitest";
import { errorBody, sendJson } from "./support/mock-api";
import { cliVersion, setupProcessHarness } from "./support/process-harness";
import { runCli } from "./support/run-cli";

/**
 * Runs the real binary (node cli/bin/anvilry.mjs) as a child process against a mock API on an
 * ephemeral 127.0.0.1 port. Nothing here reaches the real network: every URL is the mock's.
 * Failures, offline commands and side effects are in process-isolation.test.ts.
 */

const { mockApi } = setupProcessHarness();

describe("a successful command", () => {
  it("prints pretty JSON, exits 0 and makes one correctly headed request", async () => {
    const api = await mockApi();
    const result = await runCli([
      "projects",
      "trelix",
      "--base-url",
      api.baseUrl,
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      slug: "trelix",
      name: "trelix",
    });
    expect(result.stdout).toBe(
      '{\n  "slug": "trelix",\n  "name": "trelix"\n}\n',
    );

    const [request, ...rest] = api.received();
    expect(rest).toHaveLength(0);
    expect(request.method).toBe("GET");
    expect(request.url).toBe("/api/v1/projects/trelix");
    expect(request.headers["api-version"]).toBe("1");
    expect(request.headers["user-agent"]).toBe(
      `anvilry-cli/${await cliVersion()}`,
    );
    expect(request.headers.accept).toBe("application/json");
    expect(request.headers.authorization).toBeUndefined();
    expect(request.headers.cookie).toBeUndefined();
    expect(request.body).toBe("");
  });

  it("lists a collection when no slug is given", async () => {
    const api = await mockApi();
    const result = await runCli(["projects", "--base-url", api.baseUrl]);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).count).toBe(2);
    expect(api.received().map((request) => request.url)).toEqual([
      "/api/v1/projects",
    ]);
  });

  it("percent-encodes a search query so the server reads it back unchanged", async () => {
    const api = await mockApi();
    const query = "a b&c=d/é#x";
    const result = await runCli(["search", query, "--base-url", api.baseUrl]);
    expect(result.code).toBe(0);
    expect(api.received().map((request) => request.url)).toEqual([
      "/api/v1/search?q=a%20b%26c%3Dd%2F%C3%A9%23x",
    ]);
    expect(JSON.parse(result.stdout)).toEqual({ query });
  });

  it("sends the decisions tag as a query parameter", async () => {
    const api = await mockApi();
    await runCli(["decisions", "--tag", "mcp", "--base-url", api.baseUrl]);
    expect(api.received().map((request) => request.url)).toEqual([
      "/api/v1/decisions?tag=mcp",
    ]);
  });

  it("requests the paths of status, openapi, resume, stats and profile", async () => {
    const api = await mockApi();
    const commands = ["status", "openapi", "resume", "stats", "profile"];
    await Promise.all(
      commands.map((command) => runCli([command, "--base-url", api.baseUrl])),
    );
    expect(
      api
        .received()
        .map((request) => request.url)
        .sort(),
    ).toEqual(
      [
        "/api/v1",
        "/openapi.json",
        "/api/v1/resume",
        "/api/v1/github/stats",
        "/api/v1/profile",
      ].sort(),
    );
  });

  it("prints the body unchanged with --raw", async () => {
    const api = await mockApi((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end('{"b":1,   "a":[1]}');
    });
    const result = await runCli([
      "profile",
      "--raw",
      "--base-url",
      api.baseUrl,
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe('{"b":1,   "a":[1]}');
  });

  it("prints the version and rate-limit headers to stderr with --headers", async () => {
    const api = await mockApi();
    const result = await runCli([
      "status",
      "--headers",
      "--base-url",
      api.baseUrl,
    ]);
    expect(result.code).toBe(0);
    expect(result.stderr).toContain("api-version: 1\n");
    expect(result.stderr).toContain('ratelimit-policy: "default";q=300;w=60\n');
    expect(result.stderr).toContain("ratelimit-remaining: 299\n");
    expect(result.stdout.startsWith("{")).toBe(true);
  });
});

describe("the base URL", () => {
  it("is read from ANVILRY_BASE_URL", async () => {
    const api = await mockApi();
    const result = await runCli(["status"], {
      env: { ANVILRY_BASE_URL: api.baseUrl },
    });
    expect(result.code).toBe(0);
    expect(api.received()).toHaveLength(1);
  });

  it("is overridden by --base-url, and the other server sees nothing", async () => {
    const fromEnv = await mockApi();
    const fromFlag = await mockApi();
    const result = await runCli(["status", "--base-url", fromFlag.baseUrl], {
      env: { ANVILRY_BASE_URL: fromEnv.baseUrl },
    });
    expect(result.code).toBe(0);
    expect(fromFlag.received()).toHaveLength(1);
    expect(fromEnv.received()).toHaveLength(0);
  });

  it.each([
    "ftp://127.0.0.1",
    "file:///etc/hosts",
    "not a url",
    "http://someone:hidden@127.0.0.1",
    "http://127.0.0.1:9/?",
    "http://127.0.0.1:9/#",
    "http://127.0.0.1:9/prefix?",
    "http://[::1]:9/?",
  ])("refuses %j with exit 1 before any request", async (baseUrl) => {
    const api = await mockApi();
    const result = await runCli(["status", "--base-url", baseUrl], {
      env: { ANVILRY_BASE_URL: api.baseUrl },
    });
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Usage: anvilry");
    expect(result.stderr).not.toContain("hidden");
    expect(api.received()).toHaveLength(0);
  });
});

describe("errors from the API", () => {
  it("prints code, message and hint for a 404 and exits 2", async () => {
    const api = await mockApi();
    const result = await runCli([
      "projects",
      "nope",
      "--base-url",
      api.baseUrl,
    ]);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "anvilry: not_found (HTTP 404): No item exists at this path.\nhint: Valid slugs: trelix, tombstone.\n",
    );
    expect(api.received()).toHaveLength(1);
  });

  it("prints Retry-After and the rate-limit fields for a 429 and exits 2", async () => {
    const api = await mockApi((_request, response) => {
      sendJson(
        response,
        429,
        errorBody(
          429,
          "rate_limited",
          "Too many requests.",
          "Wait, then retry.",
        ),
        {
          "Retry-After": "17",
          RateLimit: '"default";r=0;t=17',
          "RateLimit-Remaining": "0",
        },
      );
    });
    const result = await runCli(["profile", "--base-url", api.baseUrl]);
    expect(result.code).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Retry after 17 seconds.");
    expect(result.stderr).toContain("retry-after: 17\n");
    expect(result.stderr).toContain('ratelimit: "default";r=0;t=17\n');
    expect(result.stderr).toContain("ratelimit-remaining: 0\n");
    expect(api.received()).toHaveLength(1);
  });

  it("exits 2 for a 200 that is HTML, and --raw prints it with exit 0", async () => {
    const api = await mockApi((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end("<html>captive portal</html>");
    });
    const failed = await runCli(["profile", "--base-url", api.baseUrl]);
    expect(failed.code).toBe(2);
    expect(failed.stdout).toBe("");
    expect(failed.stderr).toContain("bad_response (HTTP 200)");
    expect(failed.stderr).toContain("text/html");

    const raw = await runCli(["profile", "--raw", "--base-url", api.baseUrl]);
    expect(raw.code).toBe(0);
    expect(raw.stdout).toBe("<html>captive portal</html>");
  });

  it("exits 2 for a non-JSON 500", async () => {
    const api = await mockApi((_request, response) => {
      response.writeHead(500, { "Content-Type": "text/plain" });
      response.end("Internal Server Error");
    });
    const result = await runCli(["profile", "--base-url", api.baseUrl]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("http_error (HTTP 500)");
  });
});

describe("batch", () => {
  it("sends one POST with a JSON body and prints the responses", async () => {
    const api = await mockApi();
    const result = await runCli([
      "batch",
      "/api/v1/projects/trelix",
      "/api/v1/profile",
      "--base-url",
      api.baseUrl,
    ]);
    expect(result.code).toBe(0);

    const [request, ...rest] = api.received();
    expect(rest).toHaveLength(0);
    expect(request.method).toBe("POST");
    expect(request.url).toBe("/api/v1/batch");
    expect(request.headers["content-type"]).toBe("application/json");
    expect(request.headers["api-version"]).toBe("1");
    expect(JSON.parse(request.body)).toEqual({
      requests: [
        { id: "1", method: "GET", path: "/api/v1/projects/trelix" },
        { id: "2", method: "GET", path: "/api/v1/profile" },
      ],
    });

    const { responses } = JSON.parse(result.stdout) as {
      responses: { id: string; status: number }[];
    };
    expect(responses.map(({ id, status }) => [id, status])).toEqual([
      ["1", 200],
      ["2", 200],
    ]);
  });

  it("prints every response and exits 2 when one operation failed", async () => {
    const api = await mockApi();
    const result = await runCli([
      "batch",
      "/api/v1/projects/trelix",
      "/api/v1/projects/nope",
      "--base-url",
      api.baseUrl,
    ]);
    expect(result.code).toBe(2);
    const { responses } = JSON.parse(result.stdout) as {
      responses: { status: number }[];
    };
    expect(responses.map((entry) => entry.status)).toEqual([200, 404]);
    expect(result.stderr).toContain("1 of 2 batch operations failed");
    expect(api.received()).toHaveLength(1);
  });

  it("refuses more than 25 paths without sending anything", async () => {
    const api = await mockApi();
    const paths = Array.from(
      { length: 26 },
      (_, index) => `/api/v1/projects/p${index}`,
    );
    const result = await runCli(["batch", ...paths, "--base-url", api.baseUrl]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("at most 25");
    expect(api.received()).toHaveLength(0);
  });
});
