import { negotiate, PRODUCES } from "@/lib/accept-negotiation";
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

/** Contract for the /admin/* Basic-auth gate in the Next 16 proxy. */

const ADMIN_SECRET = "good";
const PASS_THROUGH_HEADER = "x-middleware-next";

function makeReq(authorization?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authorization) headers["Authorization"] = authorization;
  return new NextRequest("http://localhost/admin/telemetry", { headers });
}

function basic(secret: string): string {
  return "Basic " + Buffer.from(`admin:${secret}`).toString("base64");
}

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
});

describe("proxy — /admin/* gate", () => {
  it("denies with 401 and a challenge when ADMIN_PASSWORD is unset", async () => {
    const res = await proxy(makeReq(basic(ADMIN_SECRET)));
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Basic");
  });

  it("denies a request with no Authorization header", async () => {
    process.env.ADMIN_PASSWORD = ADMIN_SECRET;
    expect((await proxy(makeReq())).status).toBe(401);
  });

  it("denies a wrong credential, including a same-length one", async () => {
    process.env.ADMIN_PASSWORD = ADMIN_SECRET;
    expect((await proxy(makeReq(basic("bad")))).status).toBe(401);
    expect((await proxy(makeReq(basic("goof")))).status).toBe(401);
  });

  it("denies malformed base64", async () => {
    process.env.ADMIN_PASSWORD = ADMIN_SECRET;
    expect((await proxy(makeReq("Basic !!!"))).status).toBe(401);
  });

  it("lets correct credentials through in both credential forms", async () => {
    process.env.ADMIN_PASSWORD = ADMIN_SECRET;
    const full = await proxy(makeReq(basic(ADMIN_SECRET)));
    expect(full.headers.get(PASS_THROUGH_HEADER)).toBe("1");
    const bare = "Basic " + Buffer.from(ADMIN_SECRET).toString("base64");
    expect((await proxy(makeReq(bare))).headers.get(PASS_THROUGH_HEADER)).toBe(
      "1",
    );
  });
});

/**
 * Contract for Markdown content negotiation in the same proxy (acceptmarkdown.com). The matcher
 * only wakes the proxy for requests that mention text/markdown, so browsers never pay for it;
 * inside, the full Accept rules decide between the Markdown twin and the HTML page.
 */

const REWRITE_HEADER = "x-middleware-rewrite";

function mdReq(path: string, accept: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, { headers: { accept } });
}

function rewrittenTo(res: Response): string | null {
  const header = res.headers.get(REWRITE_HEADER);
  return header ? new URL(header).pathname + new URL(header).search : null;
}

describe("proxy — Markdown negotiation", () => {
  it("serves the homepage twin to a client that asks for Markdown", async () => {
    const res = await proxy(mdReq("/", "text/markdown"));
    expect(rewrittenTo(res)).toBe("/api/md/home");
  });

  it("serves a content twin for an existing content URL", async () => {
    const res = await proxy(mdReq("/projects/kelvran", "text/markdown, text/html;q=0.8"));
    expect(rewrittenTo(res)).toBe("/api/md/projects/kelvran");
  });

  it("answers a path that does not exist through the Markdown 404 handler, passing the path along", async () => {
    const res = await proxy(mdReq("/__ora-404-probe-q3k4rxel", "text/markdown"));
    expect(rewrittenTo(res)).toBe("/api/md/not-found?p=%2F__ora-404-probe-q3k4rxel");
  });

  it("leaves an HTML-only page, an API route and an explicit .md URL alone", async () => {
    for (const path of ["/about", "/api/resume.json", "/projects/kelvran.md", "/sitemap.xml"]) {
      const res = await proxy(mdReq(path, "text/markdown"));
      expect(res.headers.get(PASS_THROUGH_HEADER), path).toBe("1");
      expect(res.headers.get(REWRITE_HEADER), path).toBeNull();
    }
  });

  it("serves HTML, with Vary: Accept, when the client prefers HTML", async () => {
    const res = await proxy(mdReq("/", "text/html, text/markdown;q=0.1"));
    expect(res.headers.get(PASS_THROUGH_HEADER)).toBe("1");
    expect(res.headers.get(REWRITE_HEADER)).toBeNull();
    expect(res.headers.get("vary")).toBe("Accept");
  });

  it("serves HTML when the client explicitly excludes Markdown, even for a missing path", async () => {
    const res = await proxy(mdReq("/nope", "text/markdown;q=0, text/html"));
    expect(res.headers.get(PASS_THROUGH_HEADER)).toBe("1");
  });

  it("returns 406 when nothing we can produce is acceptable for a negotiated page", async () => {
    const res = await proxy(mdReq("/", "text/markdown;q=0, application/json"));
    expect(res.status).toBe(406);
    expect(res.headers.get("vary")).toBe("Accept");
    expect(await res.text()).toContain("text/markdown");
  });

  it("does not 406 a page that is not negotiated", async () => {
    const res = await proxy(mdReq("/about", "text/markdown;q=0, application/json"));
    expect(res.headers.get(PASS_THROUGH_HEADER)).toBe("1");
  });

  it("keeps the admin gate first, even for a client that asks for Markdown", async () => {
    const denied = await proxy(mdReq("/admin/telemetry", "text/markdown"));
    expect(denied.status).toBe(401);
  });
});

describe("proxy — matcher", () => {
  const entries = config.matcher;
  const conditional = entries.find(
    (entry): entry is { source: string; has: { type: string; key: string; value: string }[] } =>
      typeof entry === "object",
  );

  it("still gates /admin/*", () => {
    expect(entries).toContain("/admin/:path*");
  });

  it("wakes the proxy only for requests whose Accept header mentions text/markdown", () => {
    expect(conditional?.source).toBe("/:path*");
    const rule = conditional?.has[0];
    expect(rule?.type).toBe("header");
    expect(rule?.key.toLowerCase()).toBe("accept");
    const re = new RegExp(`^${rule?.value}$`);
    expect(re.test("text/markdown")).toBe(true);
    expect(re.test("text/html, Text/Markdown;q=0.1")).toBe(true);
    expect(re.test("text/html,application/xhtml+xml,*/*;q=0.8")).toBe(false);
    expect(re.test("*/*")).toBe(false);
  });

  it("matches media types in any letter case, as negotiate() does (RFC 9110: type names are case-insensitive)", () => {
    const re = new RegExp(`^${conditional?.has[0].value}$`);
    for (const accept of ["TEXT/MARKDOWN", "text/MARKDOWN", "TEXT/markdown", "Text/Markdown;q=0.9"]) {
      expect(re.test(accept), accept).toBe(true);
      expect(negotiate(accept, PRODUCES), accept).toBe("text/markdown");
    }
    // Same quality, HTML listed first: the page wins, but the proxy must still have been woken.
    expect(re.test("text/html, TeXt/mArKdOwN")).toBe(true);
  });
});

describe("proxy — public API contract", () => {
  let nextIp = 0;
  const freshIp = () => `203.0.113.${++nextIp}`;
  const call = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
    proxy(
      new NextRequest(`https://anvilry.vercel.app${path}`, {
        method: init.method ?? "GET",
        headers: { "x-vercel-forwarded-for": freshIp(), ...init.headers },
      }),
    );

  it("stamps the version and the rate-limit fields on a public API response", async () => {
    const res = await call("/api/v1/projects");
    expect(res.headers.get("x-middleware-next")).toBe("1"); // still passes through to the route
    expect(res.headers.get("API-Version")).toBe("1");
    expect(res.headers.get("RateLimit-Policy")).toBe('"default";q=300;w=60');
    expect(res.headers.get("RateLimit")).toMatch(/^"default";r=299;t=\d+$/);
    expect(res.headers.get("RateLimit-Limit")).toBe("300");
    expect(res.headers.get("RateLimit-Remaining")).toBe("299");
    expect(res.headers.get("RateLimit-Reset")).toMatch(/^\d+$/);
    expect(res.headers.get("Retry-After")).toBeNull();
  });

  it("does the same for the discovery files, the twins and the MCP endpoint", async () => {
    for (const path of ["/llms.txt", "/openapi.json", "/about.md", "/projects/trelix.md", "/api/mcp/mcp", "/api/resume.json"]) {
      const res = await call(path);
      expect(res.headers.get("API-Version"), path).toBe("1");
      expect(res.headers.get("RateLimit-Remaining"), path).toBe("299");
    }
  });

  it("counts down per client and keeps clients apart", async () => {
    const ip = freshIp();
    const headers = { "x-vercel-forwarded-for": ip };
    const first = await call("/api/v1/work", { headers });
    const second = await call("/api/v1/work", { headers });
    expect(first.headers.get("RateLimit-Remaining")).toBe("299");
    expect(second.headers.get("RateLimit-Remaining")).toBe("298");
    expect((await call("/api/v1/work")).headers.get("RateLimit-Remaining")).toBe("299");
  });

  it("answers 429 with the shared error body and Retry-After once the budget is spent", async () => {
    const headers = { "x-vercel-forwarded-for": freshIp() };
    for (let i = 0; i < 300; i++) await call("/api/v1/profile", { headers });
    const res = await call("/api/v1/profile", { headers });
    expect(res.status).toBe(429);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Retry-After")).toMatch(/^[1-9]\d*$/);
    expect(res.headers.get("RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("API-Version")).toBe("1");
    expect(await res.json()).toMatchObject({ code: "rate_limited", status: 429 });
  });

  it("accepts the current API-Version and rejects any other with a JSON 400", async () => {
    expect((await call("/api/v1/projects", { headers: { "API-Version": "1" } })).status).toBe(200);
    const bad = await call("/api/v1/projects", { headers: { "API-Version": "2" } });
    expect(bad.status).toBe(400);
    expect(bad.headers.get("API-Version")).toBe("1");
    const body = await bad.json();
    expect(body).toMatchObject({ code: "invalid_request", status: 400 });
    expect(body.hint).toContain("The only version is 1");
  });

  it("does not echo an oversized version value back in full", async () => {
    const res = await call("/api/v1/projects", { headers: { "API-Version": "x".repeat(500) } });
    expect(JSON.stringify(await res.json()).length).toBeLessThan(600);
  });

  it("does not spend a client's budget on a preflight", async () => {
    const headers = { "x-vercel-forwarded-for": freshIp() };
    await call("/api/v1/projects", { method: "OPTIONS", headers });
    const res = await call("/api/v1/projects", { headers });
    expect(res.headers.get("RateLimit-Remaining")).toBe("299");
  });

  it("leaves routes outside the public API alone", async () => {
    for (const path of ["/api/chat", "/api/tts", "/api/cron/eval", "/about"]) {
      const res = await call(path);
      expect(res.headers.get("API-Version"), path).toBeNull();
      expect(res.headers.get("RateLimit"), path).toBeNull();
    }
  });
});
