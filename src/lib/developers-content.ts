import {
  API_V1_BASE,
  API_VERSION,
  API_VERSION_HEADER,
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
