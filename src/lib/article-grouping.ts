import type { Article } from "@/lib/content";
import type { ArticleSource } from "@/components/platform-badge";
import type { DedupPrimaryKey } from "@/lib/writing-flags";
import { ARTICLE_DEDUP_KEY } from "@/lib/writing-flags";

/** Stable display order for filter bar — new platforms added here appear automatically. */
const SOURCE_ORDER: ArticleSource[] = ["medium", "substack", "linkedin", "devto", "hashnode", "native"];

/** Safe date-to-ms — guards against malformed ISO dates producing NaN in sort. */
const safeMs = (d: string): number => {
  const ms = new Date(d).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Configuration for the article grouping algorithm.
 * Passed as an optional second argument to groupArticles().
 * The application default is driven by the ARTICLE_DEDUP_KEY flag.
 */
export interface GroupingConfig {
  /**
   * Which frontmatter field to check first when building the dedup key.
   * - "linkedNote"   → prefer internal note slug (stable, survives URL changes)
   * - "canonicalUrl" → prefer canonical URL (useful for external-only pipelines)
   * Both strategies always fall back to the other field.
   */
  primaryKey: DedupPrimaryKey;
}

const DEFAULT_CONFIG: GroupingConfig = { primaryKey: ARTICLE_DEDUP_KEY };

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
 * Dedup key strategy — controlled by config.primaryKey (default: ARTICLE_DEDUP_KEY flag):
 *   "linkedNote"   → tries linkedNote first, falls back to canonicalUrl
 *   "canonicalUrl" → tries canonicalUrl first, falls back to linkedNote
 *   Ungrouped if neither field is present.
 *
 * O(n log n) — two linear passes + per-group sort (groups are tiny: 1–5 items).
 */
export function groupArticles(
  articles: Article[],
  config: GroupingConfig = DEFAULT_CONFIG,
): ArticleGroup[] {
  const groups = new Map<string, Article[]>();
  const ungrouped: Article[] = [];

  // Pass 1 — categorise each article into a keyed group or ungrouped
  for (const article of articles) {
    let key: string | null = null;

    if (config.primaryKey === "canonicalUrl") {
      // canonicalUrl-first: best for external-only pipelines
      if (article.canonicalUrl) {
        key = `canonical:${article.canonicalUrl}`;
      } else if (article.linkedNote) {
        key = `note:${article.linkedNote}`;
      }
    } else {
      // linkedNote-first (default): stable internal slug survives URL changes
      if (article.linkedNote) {
        key = `note:${article.linkedNote}`;
      } else if (article.canonicalUrl) {
        key = `canonical:${article.canonicalUrl}`;
      }
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
      return safeMs(b.date) - safeMs(a.date);
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

  // Final sort: newest canonical first; slug as deterministic tiebreaker for same-date groups.
  return result.sort((a, b) => {
    const dt = safeMs(b.canonical.date) - safeMs(a.canonical.date);
    return dt !== 0 ? dt : a.canonical.slug.localeCompare(b.canonical.slug);
  });
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
  return SOURCE_ORDER.filter((s) => seen.has(s));
}

/** Filter groups to only those containing at least one article with the given source. */
export function filterGroupsBySource(
  groups: ArticleGroup[],
  source: "all" | ArticleSource,
): ArticleGroup[] {
  if (source === "all") return groups;
  return groups.filter((g) => g.platforms.some((a) => a.source === source));
}
