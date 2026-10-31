import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  BYPASS_HEADER,
  CHECKS,
  PAID_OR_PRIVILEGED_PATHS,
  assertBypassTargetAllowed,
  discoverProjectPath,
  normalizeDeploymentUrl,
  runSmoke,
  waitUntilReachable,
} from "../../scripts/post-deploy-smoke.mjs";

/**
 * The post-deploy smoke is a Vercel Deployment Check: Vercel builds a production deployment,
 * holds it, and assigns the production domain only after the "Post-deploy smoke" commit status
 * is green. A wrong smoke therefore either lets a broken build go live or holds a good one, so
 * the script's own behaviour is pinned here against a fake site, never the network.
 *
 * Chained into `pnpm build` (vitest run).
 */

const BASE = "https://anvilry-abc123-sairams-projects-d50d7437.vercel.app";

type Reply = {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
};

const HTML = { "content-type": "text/html; charset=utf-8" };
const SECURITY_HEADERS = {
  ...HTML,
  "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

/** A healthy deployment: every path a check asks for answers the way the real app does. */
function healthySite(
  overrides: Record<string, Reply> = {},
): Record<string, Reply> {
  const projects = Array.from(
    { length: 6 },
    (_, i) => `<a href="/projects/project-${i}">p${i}</a>`,
  ).join("");
  const page = (extra = "") => ({
    status: 200,
    headers: HTML,
    body: `<html><h1>Sairam Ugge</h1>${extra}</html>`,
  });
  return {
    "/": {
      status: 200,
      headers: SECURITY_HEADERS,
      body: "<html><title>Sairam Ugge — Engineer</title><h1>Sairam Ugge</h1></html>",
    },
    "/projects": page(projects),
    "/projects/project-0": page("<h1>Project 0</h1>"),
    "/projects/project-0.md": {
      status: 200,
      headers: { "content-type": "text/markdown; charset=utf-8" },
      body: "# Project 0",
    },
    "/work": page(),
    "/about": page(),
    "/decisions": page(),
    "/resume": page(),
    "/mcp": page(),
    "/developers": page(),
    "/contact": page('<a href="mailto:a@b.c">mail</a>'),
    "/privacy": page(),
    "/search": page(),
    "/openapi.json": {
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        openapi: "3.1.0",
        paths: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`/p${i}`, {}])),
      }),
    },
    "md:/": {
      status: 200,
      headers: { "content-type": "text/markdown; charset=utf-8", vary: "Accept" },
      body: "# Sairam Ugge\n\n> Engineer",
    },
    "/api/no-such-route": {
      status: 404,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "not_found" }),
    },
    "/pagefind/pagefind.js": {
      status: 200,
      headers: { "content-type": "text/javascript" },
      body: "export {}",
    },
    "/llms.txt": {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: "# Sairam Ugge\n- project",
    },
    "/sitemap.xml": {
      status: 200,
      headers: { "content-type": "application/xml" },
      body: '<?xml version="1.0"?><urlset></urlset>',
    },
    "/robots.txt": {
      status: 200,
      headers: { "content-type": "text/plain" },
      body: "User-agent: *\nSitemap: https://x/sitemap.xml",
    },
    "/api/resume.json": {
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projects: Array.from({ length: 6 }, (_, i) => ({
          slug: `project-${i}`,
        })),
      }),
    },
    "/api/cron/health-check": {
      status: 401,
      headers: { "content-type": "text/plain" },
      body: "Unauthorized",
    },
    "/admin/telemetry": {
      status: 401,
      headers: { "www-authenticate": 'Basic realm="x"' },
      body: "",
    },
    ...overrides,
  };
}

/** A fake fetch over a path -> reply table; records every call so tests can inspect it. */
function fakeFetch(site: Record<string, Reply>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn(
    async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, init });
      const path = new URL(url).pathname;
      // A request that asks for Markdown can be answered differently from the same path asked for */*.
      const accept = new Headers(init.headers).get("accept") ?? "";
      const reply = (accept.includes("text/markdown") ? site[`md:${path}`] : undefined) ?? site[path] ?? {
        status: 404,
        headers: HTML,
        body: "not found",
      };
      return new Response(reply.body ?? "", {
        status: reply.status ?? 200,
        headers: reply.headers,
      });
    },
  );
  return { impl: impl as unknown as typeof fetch, calls };
}

const noSleep = async () => {};

describe("runSmoke against a healthy deployment", () => {
  it("passes every check and reports ok", async () => {
    const { impl } = fakeFetch(healthySite());
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.results).toHaveLength(CHECKS.length);
    expect(CHECKS).toHaveLength(26);
  });

  it("sends the bypass header on every request when a secret is given, and only to the deployment origin", async () => {
    const { impl, calls } = fakeFetch(healthySite());
    await runSmoke(BASE, {
      fetchImpl: impl,
      sleep: noSleep,
      bypassSecret: "s3cret",
    });
    expect(calls.length).toBeGreaterThan(10);
    for (const c of calls) {
      expect(new URL(c.url).origin, c.url).toBe(BASE);
      expect(
        (c.init.headers as Record<string, string>)[BYPASS_HEADER],
        c.url,
      ).toBe("s3cret");
    }
  });

  it("sends no bypass header when no secret is given", async () => {
    const { impl, calls } = fakeFetch(healthySite());
    await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    for (const c of calls)
      expect(
        (c.init.headers as Record<string, string>)[BYPASS_HEADER],
      ).toBeUndefined();
  });

  it("never follows a redirect, so the bypass header cannot be replayed to another origin", async () => {
    const { impl, calls } = fakeFetch(healthySite());
    await runSmoke(BASE, {
      fetchImpl: impl,
      sleep: noSleep,
      bypassSecret: "s3cret",
    });
    for (const c of calls) expect(c.init.redirect, c.url).toBe("manual");
  });

  it("never requests a paid or privileged endpoint", async () => {
    const { impl, calls } = fakeFetch(healthySite());
    await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    const requested = calls.map((c) => new URL(c.url).pathname);
    for (const forbidden of PAID_OR_PRIVILEGED_PATHS) {
      expect(
        requested.some((p) => p === forbidden || p.startsWith(forbidden + "/")),
        forbidden,
      ).toBe(false);
    }
    // The only /api/cron request is the unauthenticated fail-closed probe, which must expect 401.
    const cron = CHECKS.filter((c) => c.path.startsWith("/api/cron"));
    expect(cron.map((c) => c.expectStatus)).toEqual([401]);
  });
});

describe("runSmoke against a broken deployment", () => {
  it("fails and names the check when a page returns 500", async () => {
    const { impl } = fakeFetch(
      healthySite({ "/about": { status: 500, headers: HTML, body: "boom" } }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.id)).toContain("about");
    expect(result.failures.find((f) => f.id === "about")?.message).toMatch(
      /500/,
    );
  });

  it("fails when the content security policy is missing or only report-only", async () => {
    const { impl } = fakeFetch(
      healthySite({
        "/": {
          status: 200,
          headers: {
            ...HTML,
            "content-security-policy-report-only": "default-src 'self'",
          },
          body: "<h1>Sairam Ugge</h1>",
        },
      }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.failures.map((f) => f.id)).toContain("security-headers");
  });

  it.each([
    ["the CSP has no frame-ancestors directive", { "content-security-policy": "default-src 'self'" }],
    ["X-Frame-Options is not DENY", { "x-frame-options": "SAMEORIGIN" }],
    ["X-Content-Type-Options is not nosniff", { "x-content-type-options": "" }],
    ["there is no Referrer-Policy", { "referrer-policy": "" }],
  ])("fails the security-headers check when %s", async (_label, change) => {
    const { impl } = fakeFetch(
      healthySite({ "/": { status: 200, headers: { ...SECURITY_HEADERS, ...change }, body: "<h1>Sairam Ugge</h1>" } }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.failures.map((f) => f.id)).toContain("security-headers");
  });

  it("fails when an auth-gated route answers 200 instead of 401", async () => {
    const { impl } = fakeFetch(
      healthySite({
        "/admin/telemetry": { status: 200, headers: HTML, body: "dashboard" },
      }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.failures.map((f) => f.id)).toContain("admin-gated");
  });

  it("fails when the cron route is not fail-closed", async () => {
    const { impl } = fakeFetch(
      healthySite({
        "/api/cron/health-check": { status: 200, headers: HTML, body: "ran" },
      }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.failures.map((f) => f.id)).toContain("cron-fail-closed");
  });

  it("fails when the résumé JSON has no projects", async () => {
    const { impl } = fakeFetch(
      healthySite({
        "/api/resume.json": {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ projects: [] }),
        },
      }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.failures.map((f) => f.id)).toContain("resume-json");
  });

  it("fails when the Pagefind index was not built", async () => {
    const { impl } = fakeFetch(
      healthySite({
        "/pagefind/pagefind.js": { status: 404, headers: HTML, body: "" },
      }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.failures.map((f) => f.id)).toContain("pagefind");
  });

  it("fails when a Markdown request to the homepage still gets HTML", async () => {
    const { impl } = fakeFetch(
      healthySite({ "md:/": { status: 200, headers: HTML, body: "<html><h1>Sairam Ugge</h1></html>" } }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.failures.map((f) => f.id)).toContain("home-markdown");
  });

  it("fails when the Markdown homepage forgets Vary: Accept", async () => {
    const { impl } = fakeFetch(
      healthySite({
        "md:/": { status: 200, headers: { "content-type": "text/markdown" }, body: "# Sairam Ugge" },
      }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.failures.map((f) => f.id)).toContain("home-markdown");
  });

  it("fails when the OpenAPI document is missing or too thin", async () => {
    const { impl } = fakeFetch(
      healthySite({
        "/openapi.json": {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ openapi: "3.1.0", paths: { "/a": {} } }),
        },
      }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.failures.map((f) => f.id)).toContain("openapi-json");
  });

  it("fails when an unknown API path answers HTML instead of a JSON 404", async () => {
    const { impl } = fakeFetch(
      healthySite({ "/api/no-such-route": { status: 404, headers: HTML, body: "<h1>404</h1>" } }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.failures.map((f) => f.id)).toContain("api-json-404");
  });

  it("fails when an unknown project does not 404", async () => {
    const site = healthySite();
    const { impl } = fakeFetch(site);
    const wrapped = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        if (path.startsWith("/projects/") && path.includes("does-not-exist")) {
          return new Response("<h1>Sairam Ugge</h1>", {
            status: 200,
            headers: HTML,
          });
        }
        return impl(input, init);
      },
    ) as unknown as typeof fetch;
    const result = await runSmoke(BASE, { fetchImpl: wrapped, sleep: noSleep });
    expect(result.failures.map((f) => f.id)).toContain("project-missing-404");
  });

  it("explains a Vercel Authentication wall instead of just reporting a 401", async () => {
    const walled: Record<string, Reply> = {};
    for (const path of Object.keys(healthySite()))
      walled[path] = {
        status: 401,
        headers: HTML,
        body: "Authentication Required",
      };
    const { impl } = fakeFetch(walled);
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(result.hint).toMatch(/VERCEL_AUTOMATION_BYPASS_SECRET/);
  });

  it("explains the real Vercel Authentication wall, a 302 to vercel.com/sso-api", async () => {
    const walled: Record<string, Reply> = {};
    for (const path of Object.keys(healthySite())) {
      walled[path] = { status: 302, headers: { location: "https://vercel.com/sso-api?url=https%3A%2F%2Fanvilry-abc.vercel.app%2F&nonce=x" }, body: "" };
    }
    const { impl } = fakeFetch(walled);
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(result.hint).toMatch(/VERCEL_AUTOMATION_BYPASS_SECRET/);
  });

  it("does not blame the auth wall for an ordinary redirect or a plain failure", async () => {
    const { impl } = fakeFetch(healthySite({ "/about": { status: 500, headers: HTML, body: "boom" } }));
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(result.hint).toBeUndefined();
  });

  it("fails when no project link can be discovered, rather than skipping the detail checks", async () => {
    const { impl } = fakeFetch(
      healthySite({
        "/projects": {
          status: 200,
          headers: HTML,
          body: "<h1>Sairam Ugge</h1>",
        },
      }),
    );
    const result = await runSmoke(BASE, { fetchImpl: impl, sleep: noSleep });
    expect(result.ok).toBe(false);
    expect(result.failures.map((f) => f.id)).toContain("projects-index");
  });
});

describe("waitUntilReachable", () => {
  it("retries a not-yet-ready deployment and succeeds once it answers", async () => {
    let n = 0;
    const impl = vi.fn(async () =>
      ++n < 3
        ? new Response("", { status: 502 })
        : new Response("ok", { status: 200 }),
    ) as unknown as typeof fetch;
    const ok = await waitUntilReachable(BASE, {
      fetchImpl: impl,
      sleep: noSleep,
      deadlineMs: 60_000,
      now: () => 0,
    });
    expect(ok).toBe(true);
    expect(impl).toHaveBeenCalledTimes(3);
  });

  it("gives up at the deadline instead of waiting forever", async () => {
    let clock = 0;
    const impl = vi.fn(
      async () => new Response("", { status: 502 }),
    ) as unknown as typeof fetch;
    const ok = await waitUntilReachable(BASE, {
      fetchImpl: impl,
      sleep: async (ms: number) => {
        clock += ms;
      },
      deadlineMs: 20_000,
      now: () => clock,
    });
    expect(ok).toBe(false);
  });
});

describe("normalizeDeploymentUrl", () => {
  it("adds https to a bare host and drops a trailing slash", () => {
    expect(normalizeDeploymentUrl("anvilry-abc.vercel.app/")).toBe(
      "https://anvilry-abc.vercel.app",
    );
    expect(normalizeDeploymentUrl("https://anvilry-abc.vercel.app")).toBe(
      "https://anvilry-abc.vercel.app",
    );
  });

  it("rejects an empty or non-http value", () => {
    expect(() => normalizeDeploymentUrl("")).toThrow();
    expect(() => normalizeDeploymentUrl("ftp://x.vercel.app")).toThrow();
  });
});

describe("assertBypassTargetAllowed", () => {
  it("allows a vercel.app host", () => {
    expect(() =>
      assertBypassTargetAllowed("https://anvilry-abc.vercel.app", "s3cret"),
    ).not.toThrow();
  });

  it("refuses to send the secret to any other host", () => {
    expect(() =>
      assertBypassTargetAllowed("https://evil.example.com", "s3cret"),
    ).toThrow(/vercel\.app/);
    expect(() =>
      assertBypassTargetAllowed("https://vercel.app.evil.com", "s3cret"),
    ).toThrow();
  });

  it("does not care about the host when there is no secret", () => {
    expect(() =>
      assertBypassTargetAllowed("https://anvilry.example.com", undefined),
    ).not.toThrow();
  });
});

describe("discoverProjectPath", () => {
  it("returns the first project detail link", () => {
    expect(
      discoverProjectPath(
        '<a href="/projects/zeta">z</a><a href="/projects/alpha">a</a>',
      ),
    ).toBe("/projects/zeta");
  });

  it("ignores the index link and markdown links", () => {
    expect(
      discoverProjectPath(
        '<a href="/projects">all</a><a href="/projects/x.md">md</a><a href="/projects/real">r</a>',
      ),
    ).toBe("/projects/real");
  });

  it("returns null when there is none", () => {
    expect(discoverProjectPath("<p>nothing</p>")).toBeNull();
  });
});

describe("command line entry", () => {
  const scriptsDir = fileURLToPath(new URL("../../scripts", import.meta.url));
  const scratch = mkdtempSync(path.join(tmpdir(), "smoke-link-"));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  // The entry guard compares real paths. A raw argv[1] comparison would make the script do nothing at all, and
  // exit 0, when started behind a symlink, which the gate would read as a passing smoke.
  it.each([
    ["its real path", () => path.join(scriptsDir, "post-deploy-smoke.mjs")],
    [
      "a symlinked path",
      () => {
        symlinkSync(scriptsDir, path.join(scratch, "scripts"));
        return path.join(scratch, "scripts", "post-deploy-smoke.mjs");
      },
    ],
  ])("runs, and reports a usage error instead of passing, when started by %s", (_label, scriptPath) => {
    const result = spawnSync(process.execPath, [scriptPath()], {
      env: { PATH: process.env.PATH ?? "", NODE_ENV: "test" },
      encoding: "utf8",
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/usage/i);
  });
});
