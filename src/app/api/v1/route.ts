import { API_VERSION, API_V1_BASE, DEPRECATIONS, RATE_LIMIT_POLICY } from "@/lib/api-policy";
import { jsonResponse, V1_RESOURCES } from "@/lib/content-api";
import { SITE_URL } from "@/lib/site-url";

/**
 * GET /api/v1: the entry point of the versioned JSON API. It states the version, the rate limit,
 * what is deprecated and where every resource lives, all read from the same constants the OpenAPI
 * document and the response headers use. Static: it has no request input.
 */
export function GET() {
  return jsonResponse({
    version: API_VERSION,
    status: "stable",
    baseUrl: `${SITE_URL}${API_V1_BASE}`,
    openapi: `${SITE_URL}/openapi.json`,
    docs: `${SITE_URL}/developers`,
    rateLimit: {
      requests: RATE_LIMIT_POLICY.requests,
      windowSeconds: RATE_LIMIT_POLICY.windowSeconds,
    },
    deprecations: DEPRECATIONS.map(({ prefix, deprecatedOn, sunsetOn, successor }) => ({
      prefix,
      deprecatedOn,
      sunsetOn,
      successor,
    })),
    resources: Object.fromEntries(
      Object.entries(V1_RESOURCES).map(([name, path]) => [name, `${SITE_URL}${path}`]),
    ),
  });
}
