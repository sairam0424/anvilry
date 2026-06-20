/**
 * Build-time feature flags for writing sections and hiring signals.
 *
 * NEXT_PUBLIC_ARTICLES_ENABLED = "true" | "false"
 *   Controls /articles route, nav link, sitemap, RSS feed.
 *   Default: true  (articles are live by default)
 *
 * NEXT_PUBLIC_NOTES_ENABLED = "true" | "false"
 *   Controls /notes route, nav link, sitemap, RSS feed.
 *   Default: false (notes ship dark until explicitly enabled)
 *
 * NEXT_PUBLIC_OPEN_TO_WORK = "true" | "false"
 *   Shows a subtle "Open to work" banner below the nav.
 *   Default: false — flip to "true" when actively job searching.
 *
 * NEXT_PUBLIC_ vars are inlined at build time — a redeploy is needed to toggle.
 */

export const ARTICLES_ENABLED =
  process.env.NEXT_PUBLIC_ARTICLES_ENABLED !== "false";

export const NOTES_ENABLED =
  process.env.NEXT_PUBLIC_NOTES_ENABLED === "true";

export const OPEN_TO_WORK =
  process.env.NEXT_PUBLIC_OPEN_TO_WORK === "true";

/** /stats page — aggregate open-source impact numbers.
 *  Default: false — enable when the page content is populated. */
export const STATS_ENABLED =
  process.env.NEXT_PUBLIC_STATS_ENABLED === "true";

export const SEARCH_ENABLED =
  process.env.NEXT_PUBLIC_SEARCH_ENABLED === "true";

/** Recommendations / testimonials section on homepage.
 *  Default: false — hide until real LinkedIn recommendations are added. */
export const TESTIMONIALS_ENABLED =
  process.env.NEXT_PUBLIC_TESTIMONIALS_ENABLED === "true";

/** Show inkforge-generated notes in the Articles page "Generated" section.
 *  Default: false — only manually published articles show by default. */
export const INKFORGE_ARTICLES_ENABLED =
  process.env.NEXT_PUBLIC_INKFORGE_ARTICLES_ENABLED === "true";

/** GitHub stats strip on homepage (followers, repos, stars, forks).
 *  Default: false — enable when stats are worth showing (more stars/followers). */
export const GITHUB_STATS_ENABLED =
  process.env.NEXT_PUBLIC_GITHUB_STATS_ENABLED === "true";

/**
 * Article dedup primary key strategy.
 *
 * Controls which frontmatter field is checked first when grouping same-content
 * articles published on multiple platforms:
 *
 *   "linkedNote"   (DEFAULT) — prefer the internal note slug as the group key.
 *                              Best when your content pipeline always sets linkedNote.
 *                              Stable: survives URL changes / note renames.
 *
 *   "canonicalUrl" — prefer the canonical URL as the group key.
 *                    Best when syndicating to platforms that don't reference local notes.
 *                    Falls back to linkedNote if canonicalUrl is absent.
 *
 * Both strategies always fall back to the other field, so switching only affects
 * which key wins when an article has BOTH fields set.
 *
 * Set NEXT_PUBLIC_ARTICLE_DEDUP_KEY=canonicalUrl to switch. Requires redeploy.
 */
export type DedupPrimaryKey = "linkedNote" | "canonicalUrl";

const raw = process.env.NEXT_PUBLIC_ARTICLE_DEDUP_KEY;
export const ARTICLE_DEDUP_KEY: DedupPrimaryKey =
  raw === "canonicalUrl" ? "canonicalUrl" : "linkedNote";
