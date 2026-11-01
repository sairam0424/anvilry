import { negotiate, PRODUCES } from "@/lib/accept-negotiation";
import { PAGE_TWINS } from "@/lib/page-twins";
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
    for (const path of ["/resume", "/api/resume.json", "/projects/kelvran.md", "/sitemap.xml"]) {
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
    const res = await proxy(mdReq("/resume", "text/markdown;q=0, application/json"));
    expect(res.headers.get(PASS_THROUGH_HEADER)).toBe("1");
  });

  it("keeps the admin gate first, even for a client that asks for Markdown", async () => {
    const denied = await proxy(mdReq("/admin/telemetry", "text/markdown"));
    expect(denied.status).toBe(401);
  });
});

describe("proxy — Markdown twins of pages", () => {
  it.each(PAGE_TWINS)("serves the /%s twin to a client that asks for Markdown", async (page) => {
    const res = await proxy(mdReq(`/${page}`, "text/markdown"));
    expect(rewrittenTo(res)).toBe(`/api/md/pages/${page}`);
  });

  it("also serves it when Markdown is preferred over HTML, and for a trailing slash", async () => {
    expect(rewrittenTo(await proxy(mdReq("/privacy", "text/markdown, text/html;q=0.8")))).toBe("/api/md/pages/privacy");
    expect(rewrittenTo(await proxy(mdReq("/privacy/", "text/markdown")))).toBe("/api/md/pages/privacy");
  });

  it("serves the HTML page, saying the URL varies with Accept, when the client prefers HTML", async () => {
    const res = await proxy(mdReq("/developers", "text/html, text/markdown;q=0.1"));
    expect(res.headers.get(PASS_THROUGH_HEADER)).toBe("1");
    expect(res.headers.get(REWRITE_HEADER)).toBeNull();
    expect(res.headers.get("vary")).toBe("Accept");
  });

  it("answers 406 when a page with a twin is asked for something neither form satisfies", async () => {
    const res = await proxy(mdReq("/about", "text/markdown;q=0, application/json"));
    expect(res.status).toBe(406);
    expect(res.headers.get("vary")).toBe("Accept");
  });

  it("keeps the pages without a twin on HTML, with no Vary added", async () => {
    for (const path of ["/resume", "/search", "/stats"]) {
      const res = await proxy(mdReq(path, "text/markdown"));
      expect(res.headers.get(PASS_THROUGH_HEADER), path).toBe("1");
      expect(res.headers.get(REWRITE_HEADER), path).toBeNull();
      expect(res.headers.get("vary"), path).toBeNull();
    }
  });

  it("leaves an explicit /<page>.md URL to the next.config rewrite", async () => {
    for (const page of PAGE_TWINS) {
      const res = await proxy(mdReq(`/${page}.md`, "text/markdown"));
      expect(res.headers.get(PASS_THROUGH_HEADER), page).toBe("1");
      expect(res.headers.get(REWRITE_HEADER), page).toBeNull();
    }
  });

  it("still answers a path under a page name with the Markdown 404", async () => {
    const res = await proxy(mdReq("/about/team", "text/markdown"));
    expect(rewrittenTo(res)).toBe("/api/md/not-found?p=%2Fabout%2Fteam");
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

describe("proxy — public API is read-only except MCP", () => {
  const send = (path: string, method: string) =>
    proxy(
      new NextRequest(`https://anvilry.vercel.app${path}`, {
        method,
        headers: { "x-vercel-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}` },
      }),
    );

  it("answers a write to a read-only public path with the shared JSON 405 and an Allow header", async () => {
    for (const path of ["/llms.txt", "/api/v1/projects", "/openapi.json", "/api/resume.json"]) {
      const res = await send(path, "POST");
      expect(res.status, path).toBe(405);
      expect(res.headers.get("Allow"), path).toBe("GET, HEAD, OPTIONS");
      expect(await res.json(), path).toMatchObject({ code: "method_not_allowed", status: 405 });
    }
  });

  it("lets POST through to the MCP endpoint", async () => {
    const res = await send("/api/mcp/mcp", "POST");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("proxy — OPTIONS on read-only public paths", () => {
  const options = (path: string) =>
    proxy(
      new NextRequest(`https://anvilry.vercel.app${path}`, {
        method: "OPTIONS",
        headers: { "x-vercel-forwarded-for": "192.0.2.50" },
      }),
    );

  it("answers 204 with the Allow list its own 405 advertises, instead of Next's bare 405", async () => {
    for (const path of ["/llms.txt", "/api/resume.json", "/api/v1/profile", "/openapi.json", "/about.md"]) {
      const res = await options(path);
      expect(res.status, path).toBe(204);
      expect(res.headers.get("Allow"), path).toBe("GET, HEAD, OPTIONS");
      expect(res.headers.get("API-Version"), path).toBe("1");
      expect(res.headers.get("x-middleware-next"), path).toBeNull();
    }
  });

  it("leaves the MCP endpoint's own OPTIONS handling alone", async () => {
    const res = await options("/api/mcp/mcp");
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("proxy — the batch endpoint is the one public POST besides MCP", () => {
  const BATCH = "/api/v1/batch";
  let nextIp = 0;
  const send = (path: string, method: string, headers: Record<string, string> = {}, ip = `198.18.0.${++nextIp}`) =>
    proxy(
      new NextRequest(`https://anvilry.vercel.app${path}`, {
        method,
        headers: { "x-vercel-forwarded-for": ip, ...headers },
      }),
    );

  it("lets a POST through to the route, stamped with the version and the budget", async () => {
    const res = await send(BATCH, "POST");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("API-Version")).toBe("1");
    expect(res.headers.get("RateLimit-Remaining")).toBe("299");
  });

  it("counts a batch as one request against the budget", async () => {
    const ip = "198.18.1.1";
    await send(BATCH, "POST", {}, ip);
    const second = await send(BATCH, "POST", {}, ip);
    expect(second.headers.get("RateLimit-Remaining")).toBe("298");
  });

  it("answers GET, HEAD, PUT, PATCH and DELETE with the shared JSON 405 that advertises POST", async () => {
    for (const method of ["GET", "HEAD", "PUT", "PATCH", "DELETE"]) {
      const res = await send(BATCH, method);
      expect(res.status, method).toBe(405);
      expect(res.headers.get("Allow"), method).toBe("POST, OPTIONS");
      if (method !== "HEAD") {
        const body = await res.json();
        expect(body, method).toMatchObject({ code: "method_not_allowed", status: 405 });
        expect(body.hint, method).toContain("POST, OPTIONS");
      }
    }
  });

  it("answers a preflight with 204 and the Allow list of the batch endpoint, without spending budget", async () => {
    const ip = "198.18.2.2";
    const preflight = await send(BATCH, "OPTIONS", {}, ip);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Allow")).toBe("POST, OPTIONS");
    expect(preflight.headers.get("API-Version")).toBe("1");
    expect(preflight.headers.get("x-middleware-next")).toBeNull();
    const after = await send(BATCH, "POST", {}, ip);
    expect(after.headers.get("RateLimit-Remaining")).toBe("299");
  });

  it("still rejects another API-Version on a POST with the JSON 400", async () => {
    const res = await send(BATCH, "POST", { "API-Version": "2" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_request" });
  });

  it("answers 429 to a POST once the budget is spent", async () => {
    const ip = "198.18.3.3";
    for (let i = 0; i < 300; i++) await send(BATCH, "POST", {}, ip);
    const res = await send(BATCH, "POST", {}, ip);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^[1-9]\d*$/);
  });

  it("treats a trailing slash like the batch path itself", async () => {
    expect((await send(`${BATCH}/`, "POST")).status).toBe(200);
    expect((await send(`${BATCH}/`, "GET")).headers.get("Allow")).toBe("POST, OPTIONS");
  });

  it("changes nothing for the other read-only paths, the MCP endpoint included", async () => {
    for (const path of ["/api/v1/projects", `${BATCH}/extra`, "/api/resume.json", "/llms.txt"]) {
      const post = await send(path, "POST");
      expect(post.status, path).toBe(405);
      expect(post.headers.get("Allow"), path).toBe("GET, HEAD, OPTIONS");
      expect((await send(path, "OPTIONS")).headers.get("Allow"), path).toBe("GET, HEAD, OPTIONS");
      expect((await send(path, "GET")).headers.get("x-middleware-next"), path).toBe("1");
    }
    expect((await send("/api/mcp/mcp", "POST")).headers.get("x-middleware-next")).toBe("1");
    expect((await send("/api/mcp/mcp", "OPTIONS")).headers.get("x-middleware-next")).toBe("1");
  });
});

