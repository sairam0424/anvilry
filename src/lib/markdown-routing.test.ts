import { readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { HTML_ONLY_PAGES, classifyPath } from "./markdown-routing";
import { PAGE_TWINS } from "./page-twins";

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

  it.each(PAGE_TWINS)("serves the page twin for /%s", (page) => {
    expect(classifyPath(`/${page}`)).toEqual({ action: "rewrite", destination: `/api/md/pages/${page}` });
    expect(classifyPath(`/${page}/`)).toEqual({ action: "rewrite", destination: `/api/md/pages/${page}` });
  });

  it("leaves the pages that have no Markdown twin to HTML", () => {
    for (const path of ["/resume", "/search", "/stats"]) {
      expect(classifyPath(path), path).toEqual({ action: "pass" });
    }
    expect([...HTML_ONLY_PAGES]).toEqual(["/resume", "/search", "/stats"]);
  });

  it("does not treat a page name as a twin once it is a file or has a sub-path", () => {
    for (const path of ["/about.md", "/privacy.md", "/developers.md"]) {
      expect(classifyPath(path), path).toEqual({ action: "pass" });
    }
    for (const path of ["/about/team", "/privacy/x", "/About", "/api/md/pages/about.x"]) {
      expect(classifyPath(path).action, path).not.toBe("rewrite");
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

describe("classifyPath — files with underscores in their extension", () => {
  it.each([
    "/pagefind/fragment/en_x.pf_fragment",
    "/pagefind/index/en_y.pf_index",
    "/pagefind/pagefind-entry.json",
    "/pagefind/pagefind.en_abc123.pf_meta",
  ])("passes %s through instead of answering a Markdown 404", (path) => {
    expect(classifyPath(path)).toEqual({ action: "pass" });
  });
});

describe("the proxy bundle", () => {
  it("does not pull the content layer or the filesystem into every proxied request", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const seen = new Set<string>();
    const queue = ["src/proxy.ts"];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      const source = readFileSync(join(process.cwd(), file), "utf-8");
      for (const m of source.matchAll(/from\s+["']@\/([^"']+)["']/g)) {
        for (const ext of [".ts", ".tsx"]) {
          const next = `src/${m[1]}${ext}`;
          if (existsSync(join(process.cwd(), next))) queue.push(next);
        }
      }
    }
    const reached = [...seen];
    expect(reached.some((f) => f.endsWith("lib/content.ts"))).toBe(false);
    expect(reached.some((f) => f.endsWith("lib/markdown-content.ts"))).toBe(false);
    for (const file of reached) {
      expect(readFileSync(join(process.cwd(), file), "utf-8"), file).not.toMatch(/from\s+["']node:fs["']/);
    }
  });
});
