import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { HTML_ONLY_PAGES, classifyPath } from "./markdown-routing";

/**
 * When a client asks for Markdown, src/proxy.ts decides per path: serve the Markdown twin, leave
 * the request alone, or answer with a Markdown 404. The dangerous mistake is the third one for a
 * path that exists, so a filesystem test compares this classification with the real app tree.
 */

describe("classifyPath", () => {
  it("serves the homepage twin for /", () => {
    expect(classifyPath("/")).toEqual({ action: "rewrite", destination: "/api/md/home" });
  });

  it.each(["projects", "work", "articles", "notes"])("serves the %s twin for /<kind>/<slug>", (kind) => {
    expect(classifyPath(`/${kind}/some-slug_1`)).toEqual({
      action: "rewrite",
      destination: `/api/md/${kind}/some-slug_1`,
    });
  });

  it("ignores a trailing slash", () => {
    expect(classifyPath("/projects/kelvran/")).toEqual({ action: "rewrite", destination: "/api/md/projects/kelvran" });
  });

  it("leaves the index and static pages to HTML", () => {
    for (const path of ["/projects", "/work", "/about", "/resume", "/mcp", "/decisions"]) {
      expect(classifyPath(path), path).toEqual({ action: "pass" });
    }
  });

  it("leaves system paths, assets and explicit .md or file URLs alone", () => {
    for (const path of [
      "/api/resume.json",
      "/api/anything/at/all",
      "/_next/static/chunks/a.js",
      "/_vercel/insights/script.js",
      "/.well-known/vercel/flags",
      "/favicon.ico",
      "/robots.txt",
      "/sitemap.xml",
      "/llms.txt",
      "/projects/kelvran.md",
      "/opengraph-image",
      "/projects/kelvran/opengraph-image",
      "/admin/telemetry",
    ]) {
      expect(classifyPath(path), path).toEqual({ action: "pass" });
    }
  });

  it("answers anything else with a Markdown 404", () => {
    for (const path of ["/__ora-404-probe-q3k4rxel", "/nope", "/projects/a/b", "/Projects/x", "/projects/%2e%2e", "/about/team"]) {
      expect(classifyPath(path), path).toEqual({ action: "not-found" });
    }
  });
});

/** URL path of an App Router file, or null when the file does not define a public URL. */
function urlFor(relativeDir: string, file: string): string | null {
  const isPage = /^page\.tsx?$/.test(file);
  const isRoute = /^route\.tsx?$/.test(file);
  const isMetadataImage = /^(opengraph|twitter)-image\.tsx?$/.test(file);
  if (!isPage && !isRoute && !isMetadataImage) return null;
  const segments = relativeDir
    .split(sep)
    .filter((s) => s !== "" && !(s.startsWith("(") && s.endsWith(")")))
    .map((s) => s.replace(/^\[\.\.\.(\w+)\]$/, "x/y").replace(/^\[(\w+)\]$/, "some-slug").replace(/\[(\w+)\]/g, "some-slug"));
  if (isMetadataImage) segments.push(file.replace(/\.tsx?$/, ""));
  return `/${segments.join("/")}`;
}

function appUrls(): string[] {
  const root = join(process.cwd(), "src", "app");
  const entries = readdirSync(root, { recursive: true, withFileTypes: true });
  const urls = new Set<string>();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const dir = entry.parentPath.slice(root.length + 1);
    const url = urlFor(dir, entry.name);
    if (url) urls.add(url);
  }
  return [...urls].sort();
}

describe("classifyPath against the real app tree", () => {
  const urls = appUrls();

  it("finds the app routes it is meant to classify", () => {
    expect(urls.length).toBeGreaterThan(20);
    expect(urls).toContain("/");
    expect(urls).toContain("/projects/some-slug");
  });

  it("never classifies a real route as not found", () => {
    const wrong = urls.filter((url) => classifyPath(url).action === "not-found");
    expect(wrong, `real routes that a Markdown client would get a 404 for: ${wrong.join(", ")}`).toEqual([]);
  });

  it("lists as HTML-only exactly the extension-less pages that are not content twins", () => {
    const pages = urls.filter(
      (u) => classifyPath(u).action === "pass" && !u.startsWith("/api/") && !u.startsWith("/admin") && !/\.[a-z0-9]+$/i.test(u) && !/(opengraph|twitter)-image$/.test(u) && !u.startsWith("/.well-known"),
    );
    expect(pages.sort()).toEqual([...HTML_ONLY_PAGES].sort());
  });
});
