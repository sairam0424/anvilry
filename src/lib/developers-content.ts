import {
  API_V1_BASE,
  API_VERSION,
  API_VERSION_HEADER,
  BATCH_MAX_BODY_BYTES,
  BATCH_MAX_REQUESTS,
  BATCH_MAX_RESPONSE_BYTES,
  BATCH_PATH,
  DEPRECATION_NOTICE_DAYS,
  DEPRECATIONS,
  RATE_LIMIT_POLICY,
  type Deprecation,
} from "@/lib/api-policy";
import {
  listOperations,
  type OpenApiDocument,
  type OpenApiParameter,
} from "@/lib/openapi";
import { SITE_URL } from "@/lib/site-url";

/**
 * The facts the /developers page states about the API contract that are not prose: the response
 * headers and the curl recipes. Every number is read from src/lib/api-policy.ts (the values
 * src/proxy.ts enforces) and every recipe from the OpenAPI document (the routes that exist), so
 * the page cannot promise a limit or show a call the server does not honour. It lives beside the
 * page because a Next page module may export nothing but the page.
 */

export interface ResponseHeaderDoc {
  readonly name: string;
  readonly sent: string;
  readonly meaning: string;
}

const {
  name: POLICY_NAME,
  requests: QUOTA,
  windowSeconds: WINDOW,
} = RATE_LIMIT_POLICY;
const COUNTED = "Every counted response";

export const RESPONSE_HEADERS: readonly ResponseHeaderDoc[] = [
  {
    name: "RateLimit-Policy",
    sent: COUNTED,
    meaning: `The budget as a structured field. "${POLICY_NAME}";q=${QUOTA};w=${WINDOW} is a quota of ${QUOTA} requests in a window of ${WINDOW} seconds.`,
  },
  {
    name: "RateLimit",
    sent: COUNTED,
    meaning: `What is left of it, for example "${POLICY_NAME}";r=${QUOTA - 1};t=${WINDOW} right after the first request of a window: ${QUOTA - 1} requests remaining, ${WINDOW} seconds until the window resets.`,
  },
  {
    name: "RateLimit-Limit",
    sent: COUNTED,
    meaning: `The quota (${QUOTA}), the same number as q in RateLimit-Policy under the name earlier drafts used.`,
  },
  {
    name: "RateLimit-Remaining",
    sent: COUNTED,
    meaning:
      "Requests left in the current window, the same number as r in RateLimit.",
  },
  {
    name: "RateLimit-Reset",
    sent: COUNTED,
    meaning:
      "Whole seconds until the window ends, the same number as t in RateLimit.",
  },
  {
    name: "Retry-After",
    sent: "Only on a 429 response",
    meaning: "Whole seconds to wait before sending again (RFC 9110).",
  },
  {
    name: API_VERSION_HEADER,
    sent: "Every API response",
    meaning: `The version that answered (${API_VERSION}). Send ${API_VERSION_HEADER}: ${API_VERSION} yourself to pin it; any other value is refused with a 400.`,
  },
  {
    name: "Deprecation",
    sent: "Only on a deprecated surface",
    meaning:
      "When the surface was deprecated, as a structured-field date (RFC 9745).",
  },
  {
    name: "Sunset",
    sent: "Only on a deprecated surface",
    meaning: `The HTTP date after which the surface may stop working (RFC 8594), at least ${DEPRECATION_NOTICE_DAYS} days after the deprecation.`,
  },
];

/** What is deprecated right now, from the same list the proxy reads. */
export function deprecationSummary(
  deprecations: readonly Deprecation[] = DEPRECATIONS,
): string {
  if (deprecations.length === 0) {
    return "No surface is deprecated today, so Deprecation and Sunset do not appear yet.";
  }
  const list = deprecations
    .map(
      (d) =>
        `${d.prefix} (deprecated ${d.deprecatedOn}, sunset ${d.sunsetOn}, use ${d.successor})`,
    )
    .join("; ");
  return `Deprecated now: ${list}.`;
}

/** A value to put in a parameter: its documented example, else its first enum member or default. */
function exampleValue(param: OpenApiParameter): string | undefined {
  if (param.example !== undefined) return param.example;
  if (param.schema.enum?.length) return param.schema.enum[0];
  return param.schema.default === undefined
    ? undefined
    : String(param.schema.default);
}

const SHELL_SAFE = /^[A-Za-z0-9:/._~-]+$/;
const shellQuote = (url: string) => (SHELL_SAFE.test(url) ? url : `'${url}'`);

/**
 * One `curl` line per readable operation of the versioned API, in document order. Path
 * parameters and required query parameters are filled from their examples; an operation with a
 * parameter that has none is left out rather than shown with a placeholder that would 404.
 */
export function buildCurlRecipes(doc: OpenApiDocument): string[] {
  return listOperations(doc)
    .filter(
      ({ method, path }) =>
        method === "get" &&
        (path === API_V1_BASE || path.startsWith(`${API_V1_BASE}/`)),
    )
    .flatMap(({ path, operation }) => {
      const params = (operation.parameters ?? []).filter(
        (p) => p.in === "path" || (p.in === "query" && p.required),
      );
      const values = params.map((p) => ({ param: p, value: exampleValue(p) }));
      if (values.some((v) => v.value === undefined)) return [];
      const filled = values
        .filter((v) => v.param.in === "path")
        .reduce(
          (url, v) =>
            url.replace(
              `{${v.param.name}}`,
              encodeURIComponent(v.value as string),
            ),
          path,
        );
      const query = values
        .filter((v) => v.param.in === "query")
        .map((v) => `${v.param.name}=${encodeURIComponent(v.value as string)}`)
        .join("&");
      return [
        `curl -sS ${shellQuote(`${SITE_URL}${filled}${query === "" ? "" : `?${query}`}`)}`,
      ];
    });
}

/**
 * A curl call of the batch endpoint. Its body is the example the OpenAPI document carries for the
 * request (a Media Type Object `example` on POST /api/v1/batch), so the body is written once, by the
 * owner of the route. The batch is part of the document, so a document without that example is a bug:
 * this throws rather than print a call with an invented body.
 */
export function buildBatchRecipe(doc: OpenApiDocument): string {
  const media = doc.paths[BATCH_PATH]?.post?.requestBody?.content["application/json"] as
    | { example?: unknown }
    | undefined;
  if (media?.example === undefined) {
    throw new Error(`The OpenAPI document must carry an example body for POST ${BATCH_PATH}`);
  }
  const body = JSON.stringify(media.example).replace(/'/g, "'\\''");
  return [
    `curl -sS -X POST ${SITE_URL}${BATCH_PATH} \\`,
    "  -H 'Content-Type: application/json' \\",
    `  -d '${body}'`,
  ].join("\n");
}

/** One sentence on what a batch may carry, with the limits api-policy.ts enforces. */
export function batchSentence(): string {
  return `Several reads can share one request: POST ${BATCH_PATH} carries up to ${BATCH_MAX_REQUESTS} of the read-only operations of this API in a request body of at most ${BATCH_MAX_BODY_BYTES.toLocaleString("en-US")} bytes.`;
}

/**
 * What a batch does, in the order a caller meets it: validation of the whole batch first, then one
 * result per item, how it is counted, and the cap on the answer. The facts are the route's (its
 * description in the OpenAPI document states the same ones) and every number is read from
 * api-policy.ts.
 */
export function batchSemantics(): string {
  const cap = BATCH_MAX_RESPONSE_BYTES.toLocaleString("en-US");
  return [
    "It is checked as a whole before anything runs. A malformed item, a duplicate id, a repeated operation, a path outside /api/v1/, a batch inside a batch, too many operations or too large a body rejects it with 400 (413 for size) and nothing runs; when an item is at fault, the hint names it.",
    "Each operation may appear once: two items that name the same route with the same values for the query parameters that route reads are the same operation, and the repeat is rejected.",
    `A batch that passed validation answers 200 with one result per item, in request order, each with its own id, status and body: an item carries the status its route would have answered on its own (404 for a path no route matches or a slug that does not exist, 400 for a malformed slug or query, 500 if the server failed on it), and no item affects another; if the assembled answer would exceed ${cap} bytes it is refused whole with 413 and nothing is truncated.`,
    "A batch counts as one request against the rate limit however many operations it carries, and is answered 429 like any call once the limit is spent.",
  ].join(" ");
}
