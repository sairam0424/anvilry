/**
 * The published contract for the public API: which version exists, how a change of version is
 * announced, and how much traffic one client may send. Every surface that states a policy (the
 * OpenAPI document, /developers, llms.txt, the response headers) reads it from here, so the
 * promise an agent reads and the promise the server keeps cannot differ.
 *
 * Changing a number below is a product decision. The budget is also pinned in privacy-facts.ts
 * and in proxy.test.ts, which fail until they agree; the 180-day notice is only here.
 */

/** The only API version that exists. A breaking change ships as "2" next to it. */
export const API_VERSION = "1";

/** Optional request header and always-present response header that carry the version. */
export const API_VERSION_HEADER = "API-Version";

/** Base path of the versioned JSON API. Unversioned /api/* paths are aliases of version 1. */
export const API_V1_BASE = "/api/v1";

/** Minimum days between announcing a deprecation and removing the deprecated surface. */
export const DEPRECATION_NOTICE_DAYS = 180;

/** Per-client request budget enforced by src/proxy.ts on every public API path. */
export const RATE_LIMIT_POLICY = {
  name: "default",
  requests: 300,
  windowSeconds: 60,
} as const;

/** One deprecated surface. `deprecatedOn` and `sunsetOn` are ISO dates (UTC midnight). */
export interface Deprecation {
  /** Request paths that start with this prefix are covered. */
  readonly prefix: string;
  readonly deprecatedOn: string;
  readonly sunsetOn: string;
  /** Absolute or root-relative URL of the replacement. */
  readonly successor: string;
}

/**
 * Surfaces currently deprecated. Empty today: version 1 is current and nothing is scheduled for
 * removal. Adding an entry makes the proxy send the headers below on every matching response.
 */
export const DEPRECATIONS: readonly Deprecation[] = [];

const MS_PER_SECOND = 1000;
const MS_PER_DAY = 86_400_000;

/**
 * The response headers that announce a deprecation:
 *  - Deprecation (RFC 9745): the date it was deprecated, as a structured-field date `@<seconds>`;
 *  - Sunset (RFC 8594): the HTTP-date after which it may stop working;
 *  - Link rel="successor-version" (RFC 5829): where to go instead.
 * Returns an empty array when the path is not deprecated.
 */
export function deprecationHeaders(
  pathname: string,
  deprecations: readonly Deprecation[] = DEPRECATIONS,
): [string, string][] {
  const hit = deprecations.find((d) => pathname.startsWith(d.prefix));
  if (!hit) return [];
  const deprecatedAt = Date.parse(`${hit.deprecatedOn}T00:00:00Z`);
  const sunsetAt = Date.parse(`${hit.sunsetOn}T00:00:00Z`);
  if (Number.isNaN(deprecatedAt) || Number.isNaN(sunsetAt)) {
    throw new Error(`Deprecation for ${hit.prefix} has an unparseable date`);
  }
  return [
    ["Deprecation", `@${Math.floor(deprecatedAt / MS_PER_SECOND)}`],
    ["Sunset", new Date(sunsetAt).toUTCString()],
    ["Link", `<${hit.successor}>; rel="successor-version"`],
  ];
}

/** True when a deprecation entry leaves less than the promised notice before its sunset. */
export function givesEnoughNotice(d: Deprecation): boolean {
  const days =
    (Date.parse(`${d.sunsetOn}T00:00:00Z`) -
      Date.parse(`${d.deprecatedOn}T00:00:00Z`)) /
    MS_PER_DAY;
  return days >= DEPRECATION_NOTICE_DAYS;
}

/**
 * The prose of the policy, written once. The OpenAPI description and the /developers page both
 * print these sentences.
 */
export const VERSIONING_POLICY = [
  `The API is at version ${API_VERSION}. Its JSON routes live under ${API_V1_BASE}/, and the unversioned /api/resume.json and /api/github/stats are aliases of the same version.`,
  `Every public response carries ${API_VERSION_HEADER}: ${API_VERSION}. You may send ${API_VERSION_HEADER}: ${API_VERSION} on a request; any other value is answered with a 400 so you never receive a contract you did not ask for.`,
  "Adding a route, an optional parameter or a response field is not a breaking change and happens within a version, so ignore fields you do not recognise.",
  `A breaking change ships as a new version (/api/v2/) next to the old one. The old version is then deprecated for at least ${DEPRECATION_NOTICE_DAYS} days before it is removed, and every response from a deprecated surface carries Deprecation (RFC 9745), Sunset (RFC 8594) and a Link with rel="successor-version".`,
] as const;

/** Same idea for the rate limit, so the page and the spec quote the enforced numbers. */
export const RATE_LIMIT_POLICY_TEXT = [
  `Each client address may send ${RATE_LIMIT_POLICY.requests} requests per ${RATE_LIMIT_POLICY.windowSeconds} seconds across the public API (the ${API_V1_BASE} routes, /api/resume.json, /api/github/stats, the MCP endpoint, the Markdown twins and the discovery files such as /llms.txt and /openapi.json).`,
  "Every response that counts against the budget reports it (a malformed API-Version, a disallowed method and a preflight do not; a 429 does): RateLimit-Policy and RateLimit follow the current IETF draft (draft-ietf-httpapi-ratelimit-headers), and RateLimit-Limit, RateLimit-Remaining and RateLimit-Reset carry the same numbers under the names earlier drafts used.",
  "Beyond the budget the answer is 429 with the rate_limited error code and a Retry-After header in seconds.",
  "The budget is counted per server instance, so the numbers describe the instance that answered; keep to them and you will not be limited.",
] as const;
