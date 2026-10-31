import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

/**
 * Static half of Markdown content negotiation (https://acceptmarkdown.com): the pages that have a
 * Markdown twin say they vary with Accept, advertise the twin for crawlers that never send
 * Accept, and /index.md is the twin of "/". The dynamic half lives in src/proxy.ts.
 */

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };
const headers = async (): Promise<Rule[]> => (await nextConfig.headers?.()) ?? [];
const rewrites = async () => {
  const r = await nextConfig.rewrites?.();
  return Array.isArray(r) ? r : (r?.afterFiles ?? []);
};

function headersFor(rules: Rule[], source: string): Header[] {
  return rules.filter((rule) => rule.source === source).flatMap((rule) => rule.headers);
}

describe("next.config — Markdown negotiation headers", () => {
  it("marks the homepage as varying with Accept and links its Markdown twin", async () => {
    const home = headersFor(await headers(), "/");
    expect(home).toContainEqual({ key: "Vary", value: "Accept" });
    const link = home.find((h) => h.key === "Link")?.value ?? "";
    expect(link).toContain('</index.md>; rel="alternate"; type="text/markdown"');
  });

  it("also points the homepage at the API description and developer guide (RFC 8631)", async () => {
    const home = headersFor(await headers(), "/");
    const links = home.filter((h) => h.key === "Link");
    expect(links, "exactly one Link header value, so nothing is overwritten").toHaveLength(1);
    expect(links[0].value).toContain('</openapi.json>; rel="service-desc"; type="application/json"');
    expect(links[0].value).toContain('</developers>; rel="service-doc"; type="text/html"');
  });

  it.each(["projects", "work", "articles", "notes"])("does the same for /%s/<slug>", async (kind) => {
    const rules = await headers();
    const rule = rules.find((r) => r.source.startsWith(`/${kind}/:slug(`));
    expect(rule, `no negotiation headers for /${kind}/<slug>`).toBeDefined();
    expect(rule?.headers).toContainEqual({ key: "Vary", value: "Accept" });
    expect(rule?.headers).toContainEqual({
      key: "Link",
      value: `</${kind}/:slug.md>; rel="alternate"; type="text/markdown"`,
    });
  });

  it("does not match an explicit .md URL, which would advertise itself as its own alternate", async () => {
    const rules = await headers();
    const rule = rules.find((r) => r.source.startsWith("/projects/:slug("));
    const pattern = /\(([^)]*)\)/.exec(rule?.source ?? "")?.[1] ?? "";
    const slug = new RegExp(`^${pattern}$`);
    expect(slug.test("kelvran")).toBe(true);
    expect(slug.test("cost-guard-mcp")).toBe(true);
    expect(slug.test("kelvran.md")).toBe(false);
  });

  it("keeps the security headers on every path", async () => {
    const all = headersFor(await headers(), "/:path*");
    expect(all.map((h) => h.key)).toContain("Content-Security-Policy");
    expect(all.map((h) => h.key)).toContain("X-Content-Type-Options");
  });
});

describe("next.config — Markdown rewrites", () => {
  it("serves /index.md from the homepage twin", async () => {
    expect(await rewrites()).toContainEqual({ source: "/index.md", destination: "/api/md/home" });
  });

  it("keeps the .md URLs of the four content kinds", async () => {
    const list = await rewrites();
    for (const kind of ["work", "projects", "articles", "notes"]) {
      expect(list).toContainEqual({ source: `/${kind}/:slug.md`, destination: `/api/md/${kind}/:slug` });
    }
  });
});
