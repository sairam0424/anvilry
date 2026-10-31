import { describe, expect, it } from "vitest";
import { GET } from "./route";

/**
 * The Markdown 404 handler is reached by a proxy rewrite. Depending on the runtime it sees either the
 * original URL (the path the visitor asked for) or the rewritten one carrying `?p=`, so it must
 * report the right path in both cases.
 */

describe("GET /api/md/not-found", () => {
  it("names the originally requested path when the runtime keeps the original URL", async () => {
    const res = GET(new Request("https://anvilry.vercel.app/__ora-404-probe-q3k4rxel"));
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("`/__ora-404-probe-q3k4rxel`");
  });

  it("names the path from `p` when the runtime exposes the rewritten URL", async () => {
    const res = GET(new Request("https://anvilry.vercel.app/api/md/not-found?p=%2Fsome%2Fmissing-page"));
    expect(await res.text()).toContain("`/some/missing-page`");
  });

  it("does not report its own path when it is called directly without `p`", async () => {
    const res = GET(new Request("https://anvilry.vercel.app/api/md/not-found"));
    const body = await res.text();
    expect(body).toContain("`/`");
    expect(body).not.toContain("/api/md/not-found");
  });

  it("stays a Markdown 404 that links to llms.txt", async () => {
    const res = GET(new Request("https://anvilry.vercel.app/x"));
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(await res.text()).toContain("https://anvilry.vercel.app/llms.txt");
  });
});
