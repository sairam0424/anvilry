import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allArticles, allProjects, allWork, publishedNotes } from "@/lib/content";
import {
  getArticleBody,
  getNoteBody,
  getProjectBody,
  getWorkBody,
} from "@/lib/content-bodies";

/**
 * Compiled MDX is about 300 KB across the four collections. `@/lib/content` is imported by roughly
 * a dozen client modules (nav, command palette, footer, resume, chat), and a bundler cannot
 * tree-shake a JSON module, so every body used to ride along in the first-load JS of every route.
 * Each project card cost about 11 KB of that. The bodies now live in sibling Velite collections that
 * only `@/lib/content-bodies` reads, and the four detail pages are its only importers.
 *
 * Chained into `pnpm build` (vitest run). The build-level backstop is the compiled-MDX marker check
 * in scripts/bundle-budget.mjs, which also catches a transitive leak this file cannot see.
 */
describe("content metadata carries no compiled MDX", () => {
  it.each([
    ["projects", allProjects],
    ["work", allWork],
    ["notes", publishedNotes],
    ["articles", allArticles],
  ] as const)("%s records have no body field", (_name, rows) => {
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(Object.keys(row)).not.toContain("body");
  });
});

describe("content bodies", () => {
  it("has a compiled body for every project, work item and note", () => {
    for (const p of allProjects) expect(getProjectBody(p.slug), p.slug).toContain("_createMdxContent");
    for (const w of allWork) expect(getWorkBody(w.slug), w.slug).toContain("_createMdxContent");
    for (const n of publishedNotes) expect(getNoteBody(n.slug), n.slug).toContain("_createMdxContent");
  });

  it("has a body entry for every article, empty for the link-only ones", () => {
    for (const a of allArticles) expect(typeof getArticleBody(a.slug), a.slug).toBe("string");
  });

  it("returns undefined for a slug that does not exist", () => {
    expect(getProjectBody("no-such-project")).toBeUndefined();
    expect(getWorkBody("no-such-work")).toBeUndefined();
    expect(getNoteBody("no-such-note")).toBeUndefined();
    expect(getArticleBody("no-such-article")).toBeUndefined();
  });
});

/** Source files under src/ (tests excluded) that import the bodies module, discovered not assumed. */
function importersOfBodies(dir = "src"): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...importersOfBodies(path));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      const source = readFileSync(path, "utf8");
      if (/from\s+["'](?:@\/lib\/|(?:\.{1,2}\/)+(?:lib\/)?)content-bodies["']/.test(source)) found.push(path);
    }
  }
  return found.sort();
}

describe("content-bodies import boundary", () => {
  it("is imported only by the four detail pages that render a body", () => {
    expect(importersOfBodies()).toEqual([
      "src/app/articles/[slug]/page.tsx",
      "src/app/notes/[slug]/page.tsx",
      "src/app/projects/[slug]/page.tsx",
      "src/app/work/[slug]/page.tsx",
    ]);
  });

  it("is never imported by a client module", () => {
    for (const file of importersOfBodies()) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/^\s*["']use client["']/m);
    }
  });
});
