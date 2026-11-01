import { apiError } from "@/lib/api-error";
import {
  API_V1_BASE,
  BATCH_MAX_REQUESTS,
  BATCH_MAX_RESPONSE_BYTES,
  BATCH_PATH,
} from "@/lib/api-policy";
import { jsonResponse } from "@/lib/content-api";
import { SITE_URL } from "@/lib/site-url";

/**
 * The logic behind POST /api/v1/batch: read a capped body, validate the whole batch before anything
 * runs, then run each operation in process through the real route handler.
 *
 * Why in process: a self-fetch would arrive at the proxy as one shared server address and distort
 * the per-client rate limit, and it could be pointed anywhere. Here the only thing a request can
 * choose is a row of BATCH_ROUTES below, which is a closed list of /api/v1 GET handlers.
 */

export const BATCH_MAX_ID_LENGTH = 64;
export const BATCH_MAX_PATH_LENGTH = 512;

/**
 * What a batch path may look like, as a regular expression the OpenAPI spec prints too. The path
 * part is an allowlist, not a list of bad things: /api/v1 followed by segments of letters, digits,
 * hyphen and underscore. That leaves no way to write a dot segment, a percent-escape, a backslash,
 * a double slash, a scheme, a host or a control character. The optional query may hold printable
 * ASCII except space, "#" and backslash; anything else must be percent-encoded.
 */
const PATHNAME_SOURCE = String.raw`/api/v1(?:/[A-Za-z0-9_-]+)*`;
const QUERY_SOURCE = String.raw`[\x21\x22\x24-\x5b\x5d-\x7e]*`;
export const BATCH_PATH_PATTERN = `^${PATHNAME_SOURCE}(?:\\?${QUERY_SOURCE})?$`;
const PATH_REGEX = new RegExp(BATCH_PATH_PATTERN);

/** What a registered route's GET handler looks like to the batch (the Next 16 route signature). */
export type BatchHandler = (
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) => Response | Promise<Response>;

export interface BatchRoute {
  /** The route as the OpenAPI document writes it; "{slug}" stands for one path segment. */
  template: string;
  load: () => Promise<{ GET: BatchHandler }>;
  /** Query parameters the handler reads. Any other is ignored by it, so it cannot make two operations differ. */
  queryParams?: readonly string[];
}

/**
 * Every operation a batch can run: the GET routes of the versioned API and nothing else. Admin,
 * cron, chat, voice, the MCP endpoint, the unversioned aliases and the batch endpoint itself are
 * absent, so a batch can neither reach them nor recurse. batch.test.ts pins this list to the
 * OpenAPI document, so a new /api/v1 route has to be added here knowingly.
 */
export const BATCH_ROUTES: readonly BatchRoute[] = [
  { template: API_V1_BASE, load: () => import("@/app/api/v1/route") },
  {
    template: `${API_V1_BASE}/profile`,
    load: () => import("@/app/api/v1/profile/route"),
  },
  {
    template: `${API_V1_BASE}/work`,
    load: () => import("@/app/api/v1/work/route"),
  },
  {
    template: `${API_V1_BASE}/work/{slug}`,
    load: () => import("@/app/api/v1/work/[slug]/route"),
  },
  {
    template: `${API_V1_BASE}/projects`,
    load: () => import("@/app/api/v1/projects/route"),
  },
  {
    template: `${API_V1_BASE}/projects/{slug}`,
    load: () => import("@/app/api/v1/projects/[slug]/route"),
  },
  {
    template: `${API_V1_BASE}/articles`,
    load: () => import("@/app/api/v1/articles/route"),
  },
  {
    template: `${API_V1_BASE}/articles/{slug}`,
    load: () => import("@/app/api/v1/articles/[slug]/route"),
  },
  {
    template: `${API_V1_BASE}/notes`,
    load: () => import("@/app/api/v1/notes/route"),
  },
  {
    template: `${API_V1_BASE}/notes/{slug}`,
    load: () => import("@/app/api/v1/notes/[slug]/route"),
  },
  {
    template: `${API_V1_BASE}/decisions`,
    queryParams: ["tag"],
    load: () => import("@/app/api/v1/decisions/route"),
  },
  {
    template: `${API_V1_BASE}/search`,
    queryParams: ["q"],
    load: () => import("@/app/api/v1/search/route"),
  },
  {
    template: `${API_V1_BASE}/resume`,
    load: () => import("@/app/api/v1/resume/route"),
  },
  {
    template: `${API_V1_BASE}/github/stats`,
    load: () => import("@/app/api/v1/github/stats/route"),
  },
];

export interface BatchItem {
  id: string;
  path: string;
}

export type ParsedBatch =
  { ok: true; items: BatchItem[] } | { ok: false; reason: string };

const ITEM_FIELDS: ReadonlySet<string> = new Set(["id", "method", "path"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The media type of a Content-Type header is application/json, whatever parameters follow it. */
export function isJsonContentType(header: string | null): boolean {
  return header?.split(";")[0].trim().toLowerCase() === "application/json";
}

/** Why one item is unacceptable, or null. Every reason names the index and none repeats what the client sent. */
function itemProblem(entry: unknown, index: number): string | null {
  const at = `requests[${index}]`;
  if (!isRecord(entry)) return `${at} must be an object with an id and a path.`;
  if (Object.keys(entry).some((key) => !ITEM_FIELDS.has(key))) {
    return `${at} may contain only id, method and path.`;
  }
  const { id, method, path } = entry;
  // Counted in characters (code points), as the published JSON Schema maxLength counts them.
  if (
    typeof id !== "string" ||
    id.length < 1 ||
    [...id].length > BATCH_MAX_ID_LENGTH
  ) {
    return `${at}: id must be a string of 1 to ${BATCH_MAX_ID_LENGTH} characters.`;
  }
  if (method !== undefined && method !== "GET") {
    return `${at}: method must be GET, or left out; a batch only reads.`;
  }
  if (
    typeof path !== "string" ||
    path.length < 1 ||
    path.length > BATCH_MAX_PATH_LENGTH
  ) {
    return `${at}: path must be a string of 1 to ${BATCH_MAX_PATH_LENGTH} characters.`;
  }
  if (!PATH_REGEX.test(path)) {
    return `${at}: path must be ${API_V1_BASE} or a path below it such as ${API_V1_BASE}/projects/trelix, without a scheme or host, dots, percent-escapes, backslashes or spaces in the path, and with any query string in printable ASCII.`;
  }
  if (path.split("?")[0] === BATCH_PATH) {
    return `${at}: a batch cannot contain another batch.`;
  }
  return null;
}

/**
 * Validates the whole body before anything runs. The first problem found is the answer, and it
 * names the index of the item; a batch is accepted only if every item is.
 */
export function parseBatchBody(text: string): ParsedBatch {
  const reject = (reason: string): ParsedBatch => ({ ok: false, reason });
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return reject(
      'The body is not valid JSON. Send an object like {"requests":[{"id":"a","path":"/api/v1/profile"}]}.',
    );
  }
  if (!isRecord(value) || !Array.isArray(value.requests)) {
    return reject('The body must be a JSON object with a "requests" array.');
  }
  if (Object.keys(value).some((key) => key !== "requests")) {
    return reject('The body may contain only "requests".');
  }
  const { requests } = value;
  if (requests.length < 1 || requests.length > BATCH_MAX_REQUESTS) {
    return reject(`requests must hold 1 to ${BATCH_MAX_REQUESTS} operations.`);
  }

  const items: BatchItem[] = [];
  const firstIndexOfId = new Map<string, number>();
  for (const [index, entry] of requests.entries()) {
    const problem = itemProblem(entry, index);
    if (problem) return reject(problem);
    const { id, path } = entry as BatchItem;
    const earlier = firstIndexOfId.get(id);
    if (earlier !== undefined) {
      return reject(
        `requests[${index}]: the id repeats the id of requests[${earlier}]; ids must be unique.`,
      );
    }
    firstIndexOfId.set(id, index);
    items.push({ id, path });
  }
  return { ok: true, items };
}

/** The 400 for any batch that fails validation: nothing ran, and the hint says which item to fix. */
export function rejectBatch(reason: string): Response {
  return apiError(
    400,
    "invalid_request",
    "The batch was rejected and nothing ran.",
    {
      hint: `${reason} Validation is all-or-nothing: fix this and send the whole batch again.`,
    },
  );
}

export type BodyRead =
  | { kind: "text"; text: string }
  | { kind: "too_large" }
  | { kind: "invalid_encoding" };

/**
 * Reads a request body as UTF-8 text without ever holding more than `maxBytes`. The declared
 * Content-Length is believed only to refuse early; the real count is of the bytes that arrive, so
 * a chunked body or a lying header cannot get past it. Bytes, not characters: the limit is on what
 * crosses the wire.
 */
export async function readBodyWithin(
  req: Request,
  maxBytes: number,
): Promise<BodyRead> {
  if (Number(req.headers.get("content-length")) > maxBytes)
    return { kind: "too_large" };
  if (!req.body) return { kind: "text", text: "" };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { kind: "too_large" };
    }
    chunks.push(value);
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks),
    );
    return { kind: "text", text };
  } catch {
    return { kind: "invalid_encoding" };
  }
}

export interface BatchResult {
  id: string;
  status: number;
  body: unknown;
}

type Outcome = Omit<BatchResult, "id">;

/** A sub-response as the batch reports it: its status, and its body when that is JSON (null otherwise). */
async function toOutcome(res: Response): Promise<Outcome> {
  if (!/json/i.test(res.headers.get("content-type") ?? "")) {
    return { status: res.status, body: null };
  }
  try {
    return { status: res.status, body: JSON.parse(await res.text()) };
  } catch {
    return { status: res.status, body: null };
  }
}

interface Target {
  route: BatchRoute;
  slug?: string;
}

const SLUG_SUFFIX = "{slug}";

function resolveRoute(
  path: string,
  routes: readonly BatchRoute[],
): Target | null {
  const pathname = path.split("?")[0];
  for (const route of routes) {
    if (!route.template.endsWith(SLUG_SUFFIX)) {
      if (route.template === pathname) return { route };
      continue;
    }
    const prefix = route.template.slice(0, -SLUG_SUFFIX.length);
    const slug = pathname.startsWith(prefix)
      ? pathname.slice(prefix.length)
      : "";
    if (slug && !slug.includes("/")) return { route, slug };
  }
  return null;
}

/** Two items with the same key ask for the same answer, so the handler runs once for both. */
function operationKey({ route, slug }: Target, path: string): string {
  // Parsed exactly as the handler parses its request (the whole text after the first "?"), so two
  // paths share a key only if the route would read the same values from both.
  const params = new URL(`${SITE_URL}${path}`).searchParams;
  const read = (route.queryParams ?? []).map((name) =>
    JSON.stringify(params.get(name)),
  );
  return [route.template, slug ?? "", ...read].join("|");
}

async function execute(
  { route, slug }: Target,
  path: string,
): Promise<Outcome> {
  try {
    const { GET } = await route.load();
    const res = await GET(new Request(`${SITE_URL}${path}`), {
      params: Promise.resolve({ slug: slug ?? "" }),
    });
    return await toOutcome(res);
  } catch (err) {
    // The exception stays server side and is logged by name only, as withJsonErrors does.
    console.error(
      `[api] batch operation failed: ${(err as Error)?.name ?? "error"}`,
    );
    return toOutcome(
      apiError(
        500,
        "internal_error",
        "The server could not complete this operation.",
      ),
    );
  }
}

function notBatchable(routes: readonly BatchRoute[]): Response {
  return apiError(
    404,
    "not_found",
    "No batchable operation matches this path.",
    {
      hint: `Batchable paths: ${routes.map((r) => r.template).join(", ")}.`,
    },
  );
}

/**
 * Runs the validated items and returns one result per item, in request order. An item never fails
 * another: an unknown path is a 404 result, a handler that throws is a 500 result. Identical
 * operations run once, which also keeps a batch from multiplying the one route that calls GitHub.
 */
export async function runBatch(
  items: readonly BatchItem[],
  routes: readonly BatchRoute[] = BATCH_ROUTES,
): Promise<BatchResult[]> {
  const started = new Map<string, Promise<Outcome>>();
  const outcomes = items.map(({ path }) => {
    const target = resolveRoute(path, routes);
    if (!target) return toOutcome(notBatchable(routes));
    const key = operationKey(target, path);
    const existing = started.get(key);
    if (existing) return existing;
    const outcome = execute(target, path);
    started.set(key, outcome);
    return outcome;
  });
  const settled = await Promise.all(outcomes);
  return items.map(({ id }, index) => ({ id, ...settled[index] }));
}

/** The size of the answer in bytes, serialized the way it is sent. */
export function responseBytes(results: readonly BatchResult[]): number {
  return Buffer.byteLength(JSON.stringify({ responses: results }));
}

/**
 * The answer to a batch that passed validation: 200 with the results, or, if they would add up to
 * more than `maxBytes`, a 413 and none of them. A batch is one request of the client's budget, so
 * the answer is capped rather than left to grow with the number of items. Nothing is truncated:
 * the caller is told to ask for less.
 */
export function answerBatch(
  results: readonly BatchResult[],
  maxBytes: number = BATCH_MAX_RESPONSE_BYTES,
): Response {
  if (responseBytes(results) > maxBytes) {
    return apiError(413, "payload_too_large", `The batch response would exceed ${maxBytes} bytes.`, {
      hint: `The response would exceed ${maxBytes} bytes; send fewer or smaller operations, and split the rest across several batches. Nothing was cut short.`,
    });
  }
  return jsonResponse({ responses: results }, { "Cache-Control": "no-store" });
}
