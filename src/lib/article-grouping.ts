import type { Article } from "@/lib/content";
import type { ArticleSource } from "@/components/platform-badge";

export interface ArticleGroup {
  /** Primary article — native > linkedNote > external, then newest first. */
  canonical: Article;
  /** All articles in this group including canonical. */
  platforms: Article[];
  /** External syndications only (canonical excluded). */
  externalPlatforms: Article[];
}

/**
 * Group articles by canonical URL or linkedNote reference.
 *
 * Dedup key strategy (in order of preference):
 *   1. canonicalUrl — the "source of truth" URL all syndications point to
 *   2. linkedNote   — fallback when canonicalUrl absent but all versions reference same note
 *   3. ungrouped    — no match key; treated as a standalone single-item group
 *
 * O(n log n) — two linear passes + per-group sort (groups are tiny: 1–5 items).
 */
export function groupArticles(articles: Article[]): ArticleGroup[] {
  const groups = new Map<string, Article[]>();
  const ungrouped: Article[] = [];

  // Pass 1 — categorise each article into a keyed group or ungrouped
  for (const article of articles) {
    let key: string | null = null;
    if (article.canonicalUrl) {
      key = `canonical:${article.canonicalUrl}`;
    } else if (article.linkedNote) {
      key = `note:${article.linkedNote}`;
    }

    if (key) {
      const bucket = groups.get(key) ?? [];
      bucket.push(article);
      groups.set(key, bucket);
    } else {
      ungrouped.push(article);
    }
  }

  const result: ArticleGroup[] = [];

  // Pass 2 — build ArticleGroup from each bucket
  for (const members of groups.values()) {
    const sorted = [...members].sort((a, b) => {
      // Prefer: native (0) > has linkedNote (1) > external (2), then newer first
      const rank = (x: Article) =>
        x.source === "native" ? 0 : x.linkedNote ? 1 : 2;
      const dr = rank(a) - rank(b);
      if (dr !== 0) return dr;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const [canonical, ...rest] = sorted;
    result.push({ canonical, platforms: sorted, externalPlatforms: rest });
  }

  // Ungrouped articles become single-item groups
  for (const article of ungrouped) {
    result.push({
      canonical: article,
      platforms: [article],
      externalPlatforms: [],
    });
  }

  // Final sort: newest canonical article first
  return result.sort(
    (a, b) =>
      new Date(b.canonical.date).getTime() -
      new Date(a.canonical.date).getTime(),
  );
}

/** Derives which source platforms actually appear across all groups.
 *  Used to build the filter bar — only shows tabs that have content. */
export function getGroupSources(groups: ArticleGroup[]): ArticleSource[] {
  const seen = new Set<ArticleSource>();
  for (const group of groups) {
    for (const art of group.platforms) {
      seen.add(art.source as ArticleSource);
    }
  }
  // Stable display order
  const ORDER: ArticleSource[] = ["medium", "substack", "linkedin", "native"];
  return ORDER.filter((s) => seen.has(s));
}

/** Filter groups to only those containing at least one article with the given source. */
export function filterGroupsBySource(
  groups: ArticleGroup[],
  source: "all" | ArticleSource,
): ArticleGroup[] {
  if (source === "all") return groups;
  return groups.filter((g) => g.platforms.some((a) => a.source === source));
}
