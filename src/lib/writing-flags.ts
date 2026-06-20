/**
 * Build-time feature flags for the writing sections.
 *
 * NEXT_PUBLIC_ARTICLES_ENABLED = "true" | "false"
 *   Controls /articles route, nav link, sitemap, RSS feed.
 *   Default: true  (articles are live by default)
 *
 * NEXT_PUBLIC_NOTES_ENABLED = "true" | "false"
 *   Controls /notes route, nav link, sitemap, RSS feed.
 *   Default: false (notes ship dark until explicitly enabled)
 *
 * NEXT_PUBLIC_ vars are inlined at build time — a redeploy is needed to toggle.
 * Both flags are independent and additive to the content-length gates
 * (allNotes.length / allArticles.length) already in place — both must be true
 * for a section to appear.
 */

export const ARTICLES_ENABLED =
  process.env.NEXT_PUBLIC_ARTICLES_ENABLED !== "false";

export const NOTES_ENABLED =
  process.env.NEXT_PUBLIC_NOTES_ENABLED === "true";
