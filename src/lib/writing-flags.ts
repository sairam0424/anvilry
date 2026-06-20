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
