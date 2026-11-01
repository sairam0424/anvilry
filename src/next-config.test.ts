import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { API_CATALOG_PATH } from "./lib/api-catalog";
import { developerGuideSource } from "./lib/developer-states-support";
import { PAGE_TWINS } from "./lib/page-twins";

/**
 * Static half of Markdown content negotiation (https://acceptmarkdown.com): the pages that have a
 * Markdown twin say they vary with Accept, advertise the twin for crawlers that never send
 * Accept, and /index.md is the twin of "/". The dynamic half lives in src/proxy.ts.
 */

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };
type Redirect = { source: string; destination: string; permanent?: boolean };
const headers = async (): Promise<Rule[]> => (await nextConfig.headers?.()) ?? [];
const rewrites = async () => {
  const r = await nextConfig.rewrites?.();
  return Array.isArray(r) ? r : (r?.afterFiles ?? []);
};

const redirects = async (): Promise<Redirect[]> => (await nextConfig.redirects?.()) ?? [];

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

  it("points the homepage at the RFC 9727 API catalog, at the path the catalog route serves", async () => {
    // next.config.ts imports nothing from src/, so it spells the path out; this ties it to the constant.
    const home = headersFor(await headers(), "/");
    const links = home.filter((h) => h.key === "Link");
    expect(links).toHaveLength(1);
    expect(links[0].value).toContain(`<${API_CATALOG_PATH}>; rel="api-catalog"`);
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

describe("next.config — Markdown twins of pages", () => {
  const pageRewrite = async () => {
    const rule = (await rewrites()).find((r: { destination: string }) => r.destination === "/api/md/pages/:page");
    expect(rule, "no rewrite to /api/md/pages/:page").toBeDefined();
    return rule as { source: string; destination: string };
  };

  it("rewrites /<page>.md to the page route for exactly the pages in PAGE_TWINS", async () => {
    const { source } = await pageRewrite();
    const names = /\(([^)]*)\)/.exec(source)?.[1].split("|") ?? [];
    expect([...names].sort()).toEqual([...PAGE_TWINS].sort());
  });

  it("matches /<page>.md for every listed page, and nothing else", async () => {
    // The source is `/:page(a|b|c).md`: the named group is a regular expression, the rest literal.
    // (The group syntax and the literal `.md` after it were also checked against Next's own
    // path-to-regexp while writing this: /about.md matches with page=about, /resume.md does not.)
    const { source } = await pageRewrite();
    const group = /^\/:page\(([^)]*)\)\.md$/.exec(source)?.[1];
    expect(group, source).toBeDefined();
    const matcher = new RegExp(`^/(${group})\\.md$`);
    for (const page of PAGE_TWINS) expect(matcher.exec(`/${page}.md`)?.[1], page).toBe(page);
    for (const path of ["/resume.md", "/search.md", "/stats.md", "/nope.md", "/about.md.md", "/x/about.md", "/about", "/index.md"]) {
      expect(matcher.test(path), path).toBe(false);
    }
  });

  it("keeps the other .md rewrites and does not let the page rule shadow them", async () => {
    const list = await rewrites();
    expect(list).toContainEqual({ source: "/index.md", destination: "/api/md/home" });
    expect(list).toContainEqual({ source: "/work/:slug.md", destination: "/api/md/work/:slug" });
  });

  it.each(PAGE_TWINS)("marks /%s as varying with Accept and links its twin, in one Link value", async (page) => {
    const rules = headersFor(await headers(), `/${page}`);
    expect(rules).toContainEqual({ key: "Vary", value: "Accept" });
    const links = rules.filter((h) => h.key === "Link");
    expect(links, "exactly one Link header value, so nothing is overwritten").toHaveLength(1);
    expect(links[0].value).toBe(`</${page}.md>; rel="alternate"; type="text/markdown"`);
  });

  it("says nothing about Markdown on the pages that stay HTML-only", async () => {
    for (const page of ["resume", "search", "stats"]) {
      const keys = headersFor(await headers(), `/${page}`).map((h) => h.key);
      expect(keys, page).not.toContain("Link");
      expect(keys, page).not.toContain("Vary");
    }
  });
});

/** First path segments of the real app tree: pages, route handlers and metadata routes. */
function appRoots(): Set<string> {
  const root = join(process.cwd(), "src", "app");
  return new Set(
    readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !/^[(_[]/.test(entry.name))
      .map((entry) => entry.name),
  );
}

describe("next.config — predictable developer URLs", () => {
  const expected: [string, string][] = [
    ["/docs", "/developers"],
    ["/docs/api", "/developers"],
    ["/api-docs", "/developers"],
    ["/api-reference", "/developers"],
    ["/developer", "/developers"],
    ["/sdk", "/developers#sdk"],
    ["/cli", "/developers#cli"],
    ["/mcp-server", "/mcp"],
  ];

  it("redirects each to the page that covers it, permanently (308)", async () => {
    const list = await redirects();
    for (const [source, destination] of expected) {
      expect(list, source).toContainEqual({ source, destination, permanent: true });
    }
    expect(list).toHaveLength(expected.length);
  });

  it("never shadows a real route or a static file and never touches /api/*", async () => {
    const roots = appRoots();
    const statics = new Set(readdirSync(join(process.cwd(), "public")));
    for (const { source } of await redirects()) {
      const first = source.split("/")[1];
      expect(roots.has(first), `${source} would hide the real /${first} route`).toBe(false);
      expect(statics.has(first), `${source} would hide public/${first}`).toBe(false);
      expect(source === "/api" || source.startsWith("/api/"), source).toBe(false);
    }
  });

  it("points only at pages that exist and at anchors the developer guide really has", async () => {
    const roots = appRoots();
    const guide = developerGuideSource();
    for (const { destination } of await redirects()) {
      const [path, fragment] = destination.split("#");
      expect(roots.has(path.slice(1)), destination).toBe(true);
      if (fragment) expect(guide, `#${fragment}`).toContain(`id="${fragment}"`);
    }
  });
});
