import { apiError } from "@/lib/api-error";
import { API_V1_BASE } from "@/lib/api-policy";
import { allArticles, allNotes } from "@/lib/content";
import { getContentItemData, type NotFound } from "@/lib/mcp-tools";
import { SITE_URL } from "@/lib/site-url";

/**
 * What the /api/v1 route handlers share: the response shape, the slug rule, the 400/404 answers and
 * the list of routes. The data itself comes from src/lib/mcp-tools.ts (the same functions the MCP
 * server calls), so the REST view and the MCP tools cannot disagree.
 */

/** A slug is letters, digits, underscore and hyphen, 1 to 120 characters. The OpenAPI spec prints this exact pattern. */
export const SLUG_PATTERN = "^[A-Za-z0-9_-]{1,120}$";
const SLUG_REGEX = new RegExp(SLUG_PATTERN);

/** Longest value, after trimming, of a free-text query parameter (`q` on search, `tag` on decisions). */
export const MAX_TEXT_PARAM_LENGTH = 100;

/** Longest list of valid slugs a 404 hint carries; the list route has the rest. */
const MAX_HINTED_SLUGS = 30;

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

/** Every route under /api/v1 that has no path parameter, by the name the index calls it. */
export const V1_RESOURCES = {
  profile: `${API_V1_BASE}/profile`,
  work: `${API_V1_BASE}/work`,
  projects: `${API_V1_BASE}/projects`,
  articles: `${API_V1_BASE}/articles`,
  notes: `${API_V1_BASE}/notes`,
  decisions: `${API_V1_BASE}/decisions`,
  search: `${API_V1_BASE}/search`,
  resume: `${API_V1_BASE}/resume`,
  githubStats: `${API_V1_BASE}/github/stats`,
} as const;

/** The collections that have an item route, and the noun a 404 uses for one of their items. */
const COLLECTION_NOUNS = {
  work: "case study",
  projects: "project",
  articles: "article",
  notes: "note",
} as const;

type Collection = keyof typeof COLLECTION_NOUNS;

/** The second argument Next 16 hands an item route's handler. */
export type SlugRouteContext = { params: Promise<{ slug: string }> };

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

/** The trimmed text of a query parameter, or null when it is missing, blank or longer than the limit. */
export function parseTextParam(raw: string | null): string | null {
  const value = raw?.trim();
  return value && value.length <= MAX_TEXT_PARAM_LENGTH ? value : null;
}

export function jsonResponse(body: unknown, headers: HeadersInit = {}): Response {
  const merged = new Headers(headers);
  merged.set("Content-Type", JSON_CONTENT_TYPE);
  return new Response(JSON.stringify(body), { headers: merged });
}

/** Every list route answers `{ count, items }`, and `count` is always `items.length`. */
export function listResponse(items: readonly unknown[]): Response {
  return jsonResponse({ count: items.length, items });
}

function isNotFound(result: object): result is NotFound {
  return "notFound" in result;
}

function validSlugsHint(
  collection: Collection,
  valid: readonly string[],
): string {
  const listUrl = `${SITE_URL}${API_V1_BASE}/${collection}`;
  if (valid.length === 0) {
    return `The ${collection} collection has no items on this deployment. List it at ${listUrl}.`;
  }
  const shown = valid.slice(0, MAX_HINTED_SLUGS).join(", ");
  if (valid.length <= MAX_HINTED_SLUGS) return `Valid slugs: ${shown}.`;
  return `Valid slugs (${MAX_HINTED_SLUGS} of ${valid.length}): ${shown}. The full list is at ${listUrl}.`;
}

/**
 * The whole body of an item route: validate the slug (400), look the item up (404 with the valid
 * slugs as the hint) and answer it as JSON. Neither error repeats the slug that was sent.
 */
export async function respondWithItem(
  collection: Collection,
  params: Promise<{ slug: string }>,
  lookup: (slug: string) => object,
): Promise<Response> {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return apiError(
      400,
      "invalid_request",
      `The slug must match ${SLUG_PATTERN}.`,
    );
  }
  const result = lookup(slug);
  if (isNotFound(result)) {
    return apiError(
      404,
      "not_found",
      `No ${COLLECTION_NOUNS[collection]} with this slug exists in the ${collection} collection.`,
      { hint: validSlugsHint(collection, result.valid) },
    );
  }
  return jsonResponse(result);
}

function itemsOf(type: "article" | "note", slugs: readonly string[]): object[] {
  return slugs.flatMap((slug) => {
    const item = getContentItemData(type, slug);
    return isNotFound(item) ? [] : [item];
  });
}

/** Articles and notes have no list function in mcp-tools, so the list is built from its item function. */
export const listArticlesData = () =>
  itemsOf(
    "article",
    allArticles.map((a) => a.slug),
  );
export const listNotesData = () =>
  itemsOf(
    "note",
    allNotes.map((n) => n.slug),
  );
export const getArticleData = (slug: string) =>
  getContentItemData("article", slug);
export const getNoteData = (slug: string) => getContentItemData("note", slug);
