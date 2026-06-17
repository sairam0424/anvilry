import { getProject, getWork, type Project, type Work } from "@/lib/content";
import { VIEWS, type View } from "@/components/view-context";

/**
 * Splits an assistant message into ordered text + card + command segments.
 *
 * Supported tokens:
 *   [[card:project:<slug>]]   — render a rich project card
 *   [[card:work:<slug>]]      — render a rich work card
 *   [[cmd:view:<view>]]       — side-effect: switch the active portfolio view
 *   [[cmd:highlight:<slug>]]  — side-effect: briefly glow-highlight a project card
 *
 * All tokens are fail-closed: unknown slugs / unknown views are DROPPED (rendered as
 * nothing), not echoed. A hallucinated slug can never produce output or navigation.
 * cmd-* segments have NO visible DOM output — they are pure side-effect triggers
 * dispatched by ChatMessages when it encounters them in the segment list.
 *
 * Text around tokens is returned verbatim and rendered as React text nodes by the
 * caller — this module never produces HTML.
 */
export type CardSegment =
  | { type: "text"; text: string }
  | { type: "project"; project: Project }
  | { type: "work"; work: Work }
  | { type: "cmd-view"; view: View }
  | { type: "cmd-highlight"; slug: string };

// [[card:project:some-slug]] or [[card:work:some-slug]]
const CARD_RE = /\[\[card:(project|work):([a-z0-9-]+)\]\]/g;
// [[cmd:view:gamified]] or [[cmd:highlight:mindforge]]
const CMD_RE = /\[\[cmd:(view|highlight):([a-z0-9-]+)\]\]/g;
// Combined regex to match both token types in document order.
const ALL_RE = /\[\[(card:(project|work)|cmd:(view|highlight)):([a-z0-9-]+)\]\]/g;

export function parseCards(content: string): CardSegment[] {
  const segments: CardSegment[] = [];
  let lastIndex = 0;
  ALL_RE.lastIndex = 0;

  for (const match of content.matchAll(ALL_RE)) {
    const token = match[0];
    const start = match.index ?? 0;

    // Text before this token.
    if (start > lastIndex) {
      segments.push({ type: "text", text: content.slice(lastIndex, start) });
    }
    lastIndex = start + token.length;

    const cardKind = match[2]; // "project" | "work" | undefined
    const cmdKind = match[3];  // "view" | "highlight" | undefined
    const slug = match[4];

    if (cardKind === "project") {
      const project = getProject(slug);
      if (project) segments.push({ type: "project", project });
    } else if (cardKind === "work") {
      const work = getWork(slug);
      if (work) segments.push({ type: "work", work });
    } else if (cmdKind === "view") {
      // Fail-closed: only known views allowed.
      if ((VIEWS as readonly string[]).includes(slug)) {
        segments.push({ type: "cmd-view", view: slug as View });
      }
    } else if (cmdKind === "highlight") {
      // Fail-closed: only slugs that exist in the content allowlist.
      const exists = !!getProject(slug) || !!getWork(slug);
      if (exists) segments.push({ type: "cmd-highlight", slug });
    }
  }

  // Trailing text after the last token.
  if (lastIndex < content.length) {
    segments.push({ type: "text", text: content.slice(lastIndex) });
  }

  return segments;
}

/** True if the content contains at least one card token (resolved or not). */
export function hasCardToken(content: string): boolean {
  CARD_RE.lastIndex = 0;
  return CARD_RE.test(content);
}

// Re-export for callers that only care about the regex shape (unused internally).
export { CMD_RE };
