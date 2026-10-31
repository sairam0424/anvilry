import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listHtml, resolveSearchSource } from "../../scripts/build-search-index.mjs";

/**
 * Pagefind must index the prerendered pages in both layouts Next can produce: the classic
 * `.next/server/app/<path>.html` and, when a deployment adapter is active (Vercel builds with
 * Next >= 16.4), `.next/server/route-cache/APP_PAGE/<hash>/$/<path>.html`. The adapter layout
 * once made the Vercel build fail with "Found 0 files matching" the html glob while every local and
 * CI build passed, so these tests build both layouts by hand.
 */
function fixture(files: Record<string, string>): { server: string; stage: string } {
  const root = mkdtempSync(join(tmpdir(), "anvilry-search-"));
  const server = join(root, "server");
  for (const [rel, body] of Object.entries(files)) {
    const full = join(server, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body);
  }
  mkdirSync(server, { recursive: true });
  return { server, stage: join(root, "stage") };
}

describe("resolveSearchSource", () => {
  it("indexes .next/server/app directly when the classic layout is present", () => {
    const { server, stage } = fixture({
      "app/index.html": "<html><body>home</body></html>",
      "app/work/pensieve.html": "<html><body>pensieve</body></html>",
      "app/work/pensieve.rsc": "not html",
    });
    const source = resolveSearchSource(server, stage);
    expect(source.layout).toBe("app");
    expect(source.dir).toBe(join(server, "app"));
    expect(source.files.sort()).toEqual(["index.html", "work/pensieve.html"]);
  });

  it("stages the adapter layout under the URL path each page is served at", () => {
    const { server, stage } = fixture({
      "route-cache/APP_PAGE/aaa/$/index.html": "<html><body>home</body></html>",
      "route-cache/APP_PAGE/bbb/$/work.html": "<html><body>work</body></html>",
      "route-cache/APP_PAGE/ccc/$/work/pensieve.html": "<html><body>pensieve</body></html>",
      "route-cache/APP_PAGE/ccc/$/work/pensieve.rsc": "not html",
      "route-cache/APP_PAGE/ccc/$/work/pensieve.segments/_tree.segment.rsc": "not html",
      "pages/404.html": "<html><body>pages router status page</body></html>",
    });
    const source = resolveSearchSource(server, stage);
    expect(source.layout).toBe("route-cache");
    expect(source.dir).toBe(stage);
    expect(source.files.sort()).toEqual(["index.html", "work.html", "work/pensieve.html"]);
    expect(readFileSync(join(stage, "work/pensieve.html"), "utf-8")).toContain("pensieve");
  });

  it("prefers the classic layout when both exist, so CI behaves exactly as before", () => {
    const { server, stage } = fixture({
      "app/index.html": "<html></html>",
      "route-cache/APP_PAGE/aaa/$/other.html": "<html></html>",
    });
    expect(resolveSearchSource(server, stage).layout).toBe("app");
  });

  it("keeps the first copy when two sources claim the same URL path", () => {
    const { server, stage } = fixture({
      "route-cache/APP_PAGE/aaa/$/dup.html": "<html><body>first</body></html>",
      "route-cache/APP_PAGE/bbb/$/dup.html": "<html><body>second</body></html>",
    });
    const source = resolveSearchSource(server, stage);
    expect(source.files).toEqual(["dup.html"]);
    expect(source.duplicates).toEqual(["dup.html"]);
  });

  it("fails loudly when neither layout holds a page, instead of building an empty index", () => {
    const { server, stage } = fixture({ "pages/404.html": "<html></html>" });
    expect(() => resolveSearchSource(server, stage)).toThrow(/no prerendered HTML/i);
  });
});

describe("listHtml", () => {
  it("returns only .html files, relative to the directory, and tolerates a missing directory", () => {
    const { server } = fixture({ "a/b.html": "x", "a/c.json": "x", "d.html": "x" });
    expect(listHtml(server).sort()).toEqual(["a/b.html", "d.html"]);
    expect(listHtml(join(server, "nope"))).toEqual([]);
  });
});
