import type { ArticleGroup } from "@/lib/article-grouping";
import { NOTES_ENABLED } from "@/lib/writing-flags";

/**
 * Where the card for an article group sends a visitor. The article card (a client component) and
 * the homepage JSON-LD (a server component, which cannot call functions exported by a client
 * module) both call this, so the rule exists once. Pure: no JSX, no "use client".
 *
 * `notesEnabled` defaults to the build flag; a test passes it to pin either setting.
 */
export function resolveCanonicalHref(
  group: ArticleGroup,
  notesEnabled: boolean = NOTES_ENABLED,
): { href: string; external: boolean } {
  const { canonical, externalPlatforms } = group;
  // Route to /notes only when the notes section is enabled.
  if (canonical.linkedNote && notesEnabled)
    return { href: `/notes/${canonical.linkedNote}`, external: false };
  // Use canonical's own externalUrl if present.
  if (canonical.externalUrl) return { href: canonical.externalUrl, external: true };
  // Fallback: use first available externalPlatform URL (e.g. DNS Essay has
  // no externalUrl itself but Dev.to/Hashnode are in externalPlatforms).
  const firstExternal = externalPlatforms.find((p) => p.externalUrl);
  if (firstExternal?.externalUrl) return { href: firstExternal.externalUrl, external: true };
  return { href: canonical.url, external: false };
}
