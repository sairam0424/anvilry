import { describe, expect, it } from "vitest";
import { parseCommandLine } from "../../cli/lib/args.mjs";
import { UsageError } from "../../cli/lib/errors.mjs";
import { planInvocation } from "../../cli/lib/plan.mjs";
import { expandPath } from "../../cli/lib/request.mjs";
import {
  assertSlug,
  parseBaseUrl,
  parseTimeout,
  resolveBaseUrl,
} from "../../cli/lib/validate.mjs";

const NO_ENV = {};
const BASE = "https://anvilry.vercel.app";

function planFor(
  argv: string[],
  env: Record<string, string | undefined> = NO_ENV,
) {
  const plan = planInvocation(argv, env);
  if (plan.action !== "request")
    throw new Error(`expected a request plan, got ${plan.action}`);
  return plan;
}

describe("parseCommandLine", () => {
  it("separates the command, its arguments and the flags in any order", () => {
    const parsed = parseCommandLine([
      "--raw",
      "work",
      "pensieve",
      "--timeout=500",
    ]);
    expect(parsed.commandName).toBe("work");
    expect(parsed.args).toEqual(["pensieve"]);
    expect(parsed.flags).toEqual({ raw: true, timeout: "500" });
  });

  it("keeps a query that starts with a dash when it follows --", () => {
    const parsed = parseCommandLine(["search", "--", "-kafka"]);
    expect(parsed.args).toEqual(["-kafka"]);
  });

  it("rejects an unknown flag as a usage error", () => {
    expect(() => parseCommandLine(["status", "--verbose"])).toThrow(UsageError);
  });

  it("rejects a string flag that has no value", () => {
    expect(() => parseCommandLine(["status", "--timeout"])).toThrow(UsageError);
  });

  it("reports a bad flag on one line, without the advice Node appends", () => {
    try {
      parseCommandLine(["search", "-kafka"]);
      expect.unreachable("a dash-prefixed positional is an unknown option");
    } catch (error) {
      expect(error).toBeInstanceOf(UsageError);
      expect((error as Error).message).not.toContain("\n");
    }
  });

  it("returns an immutable result", () => {
    const parsed = parseCommandLine(["work", "a"]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.args)).toBe(true);
    expect(Object.isFrozen(parsed.flags)).toBe(true);
  });
});

describe("expandPath", () => {
  it("drops a variable that has no value and keeps one that has", () => {
    expect(expandPath("/api/v1/work{/slug}", {})).toBe("/api/v1/work");
    expect(expandPath("/api/v1/work{/slug}", { slug: "pensieve" })).toBe(
      "/api/v1/work/pensieve",
    );
    expect(expandPath("/api/v1/search{?q}", { q: "kafka" })).toBe(
      "/api/v1/search?q=kafka",
    );
    expect(expandPath("/api/v1/decisions{?tag}", {})).toBe("/api/v1/decisions");
  });

  it("percent-encodes a value so it cannot add a segment or a parameter", () => {
    expect(expandPath("/api/v1/search{?q}", { q: "a b&c=d/é#x?y" })).toBe(
      "/api/v1/search?q=a%20b%26c%3Dd%2F%C3%A9%23x%3Fy",
    );
  });
});

describe("parseBaseUrl", () => {
  it("accepts http and https origins and removes the trailing slash", () => {
    expect(parseBaseUrl("https://anvilry.vercel.app/", "--base-url")).toBe(
      BASE,
    );
    expect(parseBaseUrl("http://127.0.0.1:3000", "--base-url")).toBe(
      "http://127.0.0.1:3000",
    );
    expect(parseBaseUrl("https://example.com/prefix//", "--base-url")).toBe(
      "https://example.com/prefix",
    );
  });

  it("accepts an IPv6 address, with or without a port", () => {
    expect(parseBaseUrl("http://[::1]:3000", "--base-url")).toBe(
      "http://[::1]:3000",
    );
    expect(parseBaseUrl("http://[::1]/", "--base-url")).toBe("http://[::1]");
    expect(parseBaseUrl("https://[2001:db8::1]:8443/api", "--base-url")).toBe(
      "https://[2001:db8::1]:8443/api",
    );
  });

  it.each([
    ["not a url", "is not a valid URL"],
    ["", "is not a valid URL"],
    ["ftp://example.com", "must be an http or https URL"],
    ["file:///etc/passwd", "must be an http or https URL"],
    ["javascript:alert(1)", "must be an http or https URL"],
    ["https://user:pass@example.com", "user name or password"],
    ["https://example.com?x=1", "query string or a fragment"],
    ["https://example.com/#frag", "query string or a fragment"],
    // A lone "?" or "#" parses to an empty query or fragment, yet it would swallow the API path.
    ["https://x/?", "query string or a fragment"],
    ["https://x/#", "query string or a fragment"],
    ["https://x/p?", "query string or a fragment"],
    ["https://x/p#", "query string or a fragment"],
    ["https://x?", "query string or a fragment"],
    ["https://x#", "query string or a fragment"],
    ["https://x/?#", "query string or a fragment"],
    ["https://x/p?a=1#b", "query string or a fragment"],
    ["https://u@x", "user name or password"],
    [":@x", "is not a valid URL"],
    ["https://:p@x", "user name or password"],
    ["http://[::1", "is not a valid URL"],
    ["http://[::1]:3000/?", "query string or a fragment"],
  ])("refuses %j", (raw, message) => {
    expect(() => parseBaseUrl(raw, "--base-url")).toThrow(message);
  });

  it("never repeats the rejected value, which could hold a password", () => {
    try {
      parseBaseUrl("https://user:hunter2@example.com", "--base-url");
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("hunter2");
    }
  });
});

describe("resolveBaseUrl", () => {
  it("prefers the flag over the environment over the default", () => {
    const env = { ANVILRY_BASE_URL: "http://env.example" };
    expect(resolveBaseUrl("http://flag.example", env, BASE)).toBe(
      "http://flag.example",
    );
    expect(resolveBaseUrl(undefined, env, BASE)).toBe("http://env.example");
    expect(resolveBaseUrl(undefined, {}, BASE)).toBe(BASE);
  });

  it("treats an empty variable as unset and names a bad variable in the error", () => {
    expect(resolveBaseUrl(undefined, { ANVILRY_BASE_URL: "" }, BASE)).toBe(
      BASE,
    );
    expect(() =>
      resolveBaseUrl(undefined, { ANVILRY_BASE_URL: "ftp://x" }, BASE),
    ).toThrow("ANVILRY_BASE_URL");
  });
});

describe("assertSlug", () => {
  it.each([
    "trelix",
    "feature-flags-at-scale-devto",
    "a_b-C9",
    "a".repeat(120),
  ])("accepts %s", (slug) => {
    expect(assertSlug(slug)).toBe(slug);
  });

  it.each([
    "",
    "a".repeat(121),
    "../etc/passwd",
    "a/b",
    "a b",
    "a?x=1",
    "%2e%2e",
    "café",
    "a\nb",
    "..",
  ])("rejects %j", (slug) => {
    expect(() => assertSlug(slug)).toThrow(UsageError);
  });
});

describe("parseTimeout", () => {
  it("defaults when absent and accepts whole milliseconds up to ten minutes", () => {
    expect(parseTimeout(undefined, 15_000)).toBe(15_000);
    expect(parseTimeout("1", 15_000)).toBe(1);
    expect(parseTimeout("600000", 15_000)).toBe(600_000);
  });

  it.each(["0", "-5", "1.5", "abc", "", "600001", "1e3", " 5"])(
    "rejects %j",
    (raw) => {
      expect(() => parseTimeout(raw, 15_000)).toThrow(UsageError);
    },
  );
});

describe("planInvocation: what is requested", () => {
  it("builds the request URL for each command from the base URL", () => {
    const urlOf = (argv: string[]) => planFor(argv).request.url;
    expect(urlOf(["status"])).toBe(`${BASE}/api/v1`);
    expect(urlOf(["profile"])).toBe(`${BASE}/api/v1/profile`);
    expect(urlOf(["work"])).toBe(`${BASE}/api/v1/work`);
    expect(urlOf(["work", "pensieve"])).toBe(`${BASE}/api/v1/work/pensieve`);
    expect(urlOf(["projects", "trelix"])).toBe(
      `${BASE}/api/v1/projects/trelix`,
    );
    expect(urlOf(["articles"])).toBe(`${BASE}/api/v1/articles`);
    expect(urlOf(["notes", "how-dns-works"])).toBe(
      `${BASE}/api/v1/notes/how-dns-works`,
    );
    expect(urlOf(["decisions"])).toBe(`${BASE}/api/v1/decisions`);
    expect(urlOf(["decisions", "--tag", "mcp"])).toBe(
      `${BASE}/api/v1/decisions?tag=mcp`,
    );
    expect(urlOf(["search", "multi agent"])).toBe(
      `${BASE}/api/v1/search?q=multi%20agent`,
    );
    expect(urlOf(["resume"])).toBe(`${BASE}/api/v1/resume`);
    expect(urlOf(["stats"])).toBe(`${BASE}/api/v1/github/stats`);
    expect(urlOf(["openapi"])).toBe(`${BASE}/openapi.json`);
  });

  it("uses the base URL from the flag, then the environment, with a path prefix kept", () => {
    const env = { ANVILRY_BASE_URL: "http://env.example/prefix/" };
    expect(planFor(["status"], env).request.url).toBe(
      "http://env.example/prefix/api/v1",
    );
    expect(
      planFor(["status", "--base-url", "http://flag.example"], env).request.url,
    ).toBe("http://flag.example/api/v1");
  });

  it("sends API-Version, a versioned User-Agent and Accept on every request", () => {
    const { request } = planFor(["profile"]);
    expect(request.method).toBe("GET");
    expect(request.body).toBeUndefined();
    expect(request.headers["API-Version"]).toBe("1");
    expect(request.headers["User-Agent"]).toMatch(
      /^anvilry-cli\/\d+\.\d+\.\d+/,
    );
    expect(request.headers.Accept).toBe("application/json");
  });

  it("turns the batch paths into one POST body with numbered GET operations", () => {
    const { request } = planFor([
      "batch",
      "/api/v1/projects/trelix",
      "/api/v1/work",
    ]);
    expect(request.method).toBe("POST");
    expect(request.url).toBe(`${BASE}/api/v1/batch`);
    expect(request.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(request.body ?? "")).toEqual({
      requests: [
        { id: "1", method: "GET", path: "/api/v1/projects/trelix" },
        { id: "2", method: "GET", path: "/api/v1/work" },
      ],
    });
  });

  it("carries the timeout, --raw and --headers into the plan", () => {
    const plan = planFor(["status", "--timeout", "250", "--raw", "--headers"]);
    expect(plan.timeoutMs).toBe(250);
    expect(plan.raw).toBe(true);
    expect(plan.showHeaders).toBe(true);
    expect(planFor(["status"])).toMatchObject({
      timeoutMs: 15_000,
      raw: false,
      showHeaders: false,
    });
  });
});

describe("planInvocation: local commands", () => {
  it("answers help and version without planning a request, from a command or a flag", () => {
    expect(planInvocation(["help"], NO_ENV)).toEqual({ action: "help" });
    expect(planInvocation(["version"], NO_ENV)).toEqual({ action: "version" });
    expect(planInvocation(["--help"], NO_ENV)).toEqual({ action: "help" });
    expect(planInvocation(["--version"], NO_ENV)).toEqual({
      action: "version",
    });
    expect(planInvocation(["work", "--help"], NO_ENV)).toEqual({
      action: "help",
    });
  });

  it("lets --help win even over an invalid argument or base URL", () => {
    expect(
      planInvocation(
        ["work", "../x", "--base-url", "ftp://x", "--help"],
        NO_ENV,
      ),
    ).toEqual({
      action: "help",
    });
  });
});

describe("planInvocation: usage errors raised before any request", () => {
  it.each([
    [[], "Missing command"],
    [["frobnicate"], 'Unknown command "frobnicate"'],
    [["work", "a", "b"], "takes one argument"],
    [["work", "../etc"], "A slug is"],
    [["projects", "a b"], "A slug is"],
    [["profile", "extra"], "takes no arguments"],
    [["help", "work"], "takes no arguments"],
    [["version", "x"], "takes no arguments"],
    [["decisions", "mcp"], "takes no arguments"],
    [["search"], "needs an argument"],
    [["search", "two", "words"], "takes one argument"],
    [["batch"], "needs an argument"],
    [["batch", "api/v1/work"], "start with a slash"],
    [["work", "--tag", "x"], "--tag is only valid with the decisions command"],
    [["status", "--base-url", "ftp://example.com"], "http or https"],
    [
      ["status", "--base-url", "https://u:p@example.com"],
      "user name or password",
    ],
    [["status", "--timeout", "abc"], "--timeout"],
    [["status", "--no-such-flag"], "Unknown option"],
  ] as [string[], string][])("%j fails with %j", (argv, message) => {
    expect(() => planInvocation(argv, NO_ENV)).toThrow(UsageError);
    expect(() => planInvocation(argv, NO_ENV)).toThrow(message);
  });

  it("refuses more batch paths than the API accepts", () => {
    const paths = Array.from(
      { length: 26 },
      (_, index) => `/api/v1/projects/p${index}`,
    );
    expect(() => planInvocation(["batch", ...paths], NO_ENV)).toThrow(
      "at most 25",
    );
    const allowed = paths.slice(0, 25);
    expect(planFor(["batch", ...allowed]).request.body).toBeDefined();
  });

  it("names ANVILRY_BASE_URL when that variable is the bad one", () => {
    expect(() =>
      planInvocation(["status"], { ANVILRY_BASE_URL: "javascript:1" }),
    ).toThrow("ANVILRY_BASE_URL");
  });
});
