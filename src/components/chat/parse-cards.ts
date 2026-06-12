import { getProject, getWork, type Project, type Work } from "@/lib/content";

/**
 * Splits an assistant message into ordered text + card segments.
 *
 * The model may emit ONLY an intent token — `[[card:project:<slug>]]` or
 * `[[card:work:<slug>]]` — never card content or links. The client resolves each
 * token against the SAME Velite content the Classic view uses (the slug allowlist),
 * so a card can never show fabricated data and every deep-link href is server-
 * sourced, not parsed from model output. Unknown/unresolved tokens are dropped
 * (rendered as nothing) rather than echoed, so a hallucinated slug fails closed.
 *
 * Text around tokens is returned verbatim and rendered as React text nodes by the
 * caller — this module never produces HTML.
 */
export type CardSegment =
  | { type: "text"; text: string }
  | { type: "project"; project: Project }
  | { type: "work"; work: Work };

// [[card:project:some-slug]] — kind is project|work, slug is the kebab content slug.
const CARD_RE = /\[\[card:(project|work):([a-z0-9-]+)\]\]/g;

export function parseCards(content: string): CardSegment[] {
  const segments: CardSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(CARD_RE)) {
    const [token, kind, slug] = match;
    const start = match.index ?? 0;

    // Text before this token.
    if (start > lastIndex) {
      segments.push({ type: "text", text: content.slice(lastIndex, start) });
    }
    lastIndex = start + token.length;

    // Resolve against the allowlist; drop unknown slugs (fail closed).
    if (kind === "project") {
      const project = getProject(slug);
      if (project) segments.push({ type: "project", project });
    } else {
      const work = getWork(slug);
      if (work) segments.push({ type: "work", work });
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
