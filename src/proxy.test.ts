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
