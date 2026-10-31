/**
 * Content negotiation for pages that have a Markdown twin (https://acceptmarkdown.com).
 *
 * The rules are RFC 9110 section 12.5.1 as the published guide restates them:
 *  - rank the representations we can produce by the q of the MOST SPECIFIC Accept range that
 *    matches each one (text/markdown beats text/*, which beats the catch-all);
 *  - a matching range with q=0 means "never send me this", even when it is all we have;
 *  - equal q is broken by the client's order, then by our own preference order;
 *  - a missing, blank or catch-all Accept means "no constraint": serve the default;
 *  - null (a 406) is returned only when nothing we can produce is acceptable.
 *
 * Substring tests such as `accept.includes("text/markdown")` are the classic wrong
 * implementation, so nothing outside this module is allowed to decide a representation.
 */

/** Our representations in order of preference: HTML is the default. */
export const PRODUCES = ["text/html", "text/markdown"] as const;

type Entry = { type: string; q: number; specificity: 0 | 1 | 2; position: number };

const MEDIA_RANGE = /^(\*\/\*|[a-z0-9!#$&^_.+-]+\/\*|[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+)$/;

function parseAccept(header: string): Entry[] {
  const entries: Entry[] = [];
  header.split(",").forEach((raw, position) => {
    const [rawType = "", ...params] = raw.split(";").map((part) => part.trim());
    const type = rawType.toLowerCase();
    if (!MEDIA_RANGE.test(type)) return;
    let q = 1;
    for (const param of params) {
      const eq = param.indexOf("=");
      if (eq < 0 || param.slice(0, eq).trim().toLowerCase() !== "q") continue;
      const value = Number(param.slice(eq + 1).trim());
      if (Number.isFinite(value)) q = Math.min(1, Math.max(0, value));
    }
    const specificity = type === "*/*" ? 0 : type.endsWith("/*") ? 1 : 2;
    entries.push({ type, q, specificity, position });
  });
  return entries;
}

function covers(entry: Entry, candidate: string): boolean {
  if (entry.type === "*/*") return true;
  if (entry.type.endsWith("/*")) return candidate.startsWith(entry.type.slice(0, -1));
  return entry.type === candidate;
}

/** The most specific range that covers the candidate; the earlier one wins a specificity tie. */
function bestMatch(entries: Entry[], candidate: string): Entry | null {
  let best: Entry | null = null;
  for (const entry of entries) {
    if (!covers(entry, candidate)) continue;
    if (best === null || entry.specificity > best.specificity) best = entry;
  }
  return best;
}

/**
 * The representation to serve for an Accept header, or null when none is acceptable (406).
 * `produces` is in our order of preference.
 */
export function negotiate(
  header: string | null | undefined,
  produces: readonly string[] = PRODUCES,
): string | null {
  const first = produces[0] ?? null;
  if (header == null || header.trim() === "") return first;
  const entries = parseAccept(header);
  if (entries.length === 0) return first;

  // A header that only EXCLUDES types ("text/markdown;q=0") puts no positive constraint on us:
  // serve the first representation it did not exclude.
  if (!entries.some((entry) => entry.q > 0)) {
    return produces.find((candidate) => bestMatch(entries, candidate) === null) ?? null;
  }

  let chosen: string | null = null;
  let chosenQ = 0;
  let chosenPosition = Infinity;
  for (const candidate of produces) {
    const match = bestMatch(entries, candidate);
    if (match === null || match.q <= 0) continue;
    if (match.q > chosenQ || (match.q === chosenQ && match.position < chosenPosition)) {
      chosen = candidate;
      chosenQ = match.q;
      chosenPosition = match.position;
    }
  }
  return chosen;
}

/** Cheap pre-check: does the header name text/markdown at all? (Not a negotiation.) */
export function mentionsMarkdown(header: string | null | undefined): boolean {
  return header != null && /text\/markdown/i.test(header);
}

/** Adds `token` to the Vary header unless it is already there (or Vary is "*"). */
export function appendVary(headers: Headers, token: string): void {
  const existing = headers.get("vary");
  if (!existing) {
    headers.set("vary", token);
    return;
  }
  const tokens = existing.split(",").map((part) => part.trim().toLowerCase());
  if (tokens.includes("*") || tokens.includes(token.toLowerCase())) return;
  headers.set("vary", `${existing}, ${token}`);
}
