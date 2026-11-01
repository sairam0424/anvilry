import { afterEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/lib/content";

/**
 * The selection behind the homepage "Latest articles" section. `allArticles` is replaced by a
 * fixture, because the real data cannot show the ordering rule: its two newest raw items already
 * belong to different articles, so grouping before slicing and slicing before grouping agree on it.
 * Flags are pinned in every test and the modules are re-imported, never inherited.
 */

const article = (over: Partial<Article> & Pick<Article, "slug" | "date">): Article =>
  ({
    title: over.slug,
    summary: "s",
    source: "devto",
    tags: [],
    draft: false,
    url: `/articles/${over.slug}`,
    ...over,
  }) as Article;

// Newest first, as content.ts sorts them. `alpha` was syndicated twice, and the two copies are the
// newest raw items: slicing the raw list to two entries would leave a single group.
const FIXTURE: Article[] = [
  article({ slug: "alpha-devto", date: "2026-06-30T00:00:00.000Z", canonicalUrl: "https://anvilry.vercel.app/notes/alpha" }),
  article({ slug: "alpha-substack", date: "2026-06-29T00:00:00.000Z", source: "substack", canonicalUrl: "https://anvilry.vercel.app/notes/alpha" }),
  article({ slug: "beta-devto", date: "2026-06-28T00:00:00.000Z", canonicalUrl: "https://anvilry.vercel.app/notes/beta" }),
  article({ slug: "gamma-devto", date: "2026-06-27T00:00:00.000Z", canonicalUrl: "https://anvilry.vercel.app/notes/gamma" }),
];

async function load(articles: "true" | "false", rows: Article[] = FIXTURE) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_ARTICLES_ENABLED", articles);
  vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", "false");
  vi.doMock("@/lib/content", () => ({ allArticles: rows }));
  return import("./home-articles");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/content");
});

describe("homeArticleGroups", () => {
  it("groups the articles BEFORE it takes the newest two, so two platform copies are one card", async () => {
    const { homeArticleGroups, HOME_ARTICLE_COUNT } = await load("true");
    const groups = homeArticleGroups();

    expect(HOME_ARTICLE_COUNT).toBe(2);
    expect(groups).toHaveLength(HOME_ARTICLE_COUNT);
    expect(groups[0].platforms.map((a) => a.slug)).toEqual(["alpha-devto", "alpha-substack"]);
    expect(groups[1].canonical.slug).toBe("beta-devto");
    // Slicing the raw list first would have returned one group (alpha) and dropped beta.
    expect(groups.some((g) => g.canonical.slug === "gamma-devto")).toBe(false);
  });

  it("lists the newest article first", async () => {
    const { homeArticleGroups } = await load("true");
    const dates = homeArticleGroups().map((g) => Date.parse(g.canonical.date));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("returns every group when there are fewer than the section shows", async () => {
    const { homeArticleGroups } = await load("true", FIXTURE.slice(0, 2));
    expect(homeArticleGroups()).toHaveLength(1);
  });

  it("returns nothing while articles are disabled", async () => {
    const { homeArticleGroups } = await load("false");
    expect(homeArticleGroups()).toEqual([]);
  });

  it("returns nothing when there are no articles", async () => {
    const { homeArticleGroups } = await load("true", []);
    expect(homeArticleGroups()).toEqual([]);
  });
});
