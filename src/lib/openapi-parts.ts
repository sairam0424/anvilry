import {
  API_VERSION,
  API_VERSION_HEADER,
  RATE_LIMIT_POLICY,
} from "@/lib/api-policy";
import type {
  Json,
  OpenApiHeader,
  OpenApiParameter,
  OpenApiResponse,
} from "@/lib/openapi";

/**
 * Pieces every OpenAPI operation shares: the version header parameter, the headers a success
 * carries and the typed error responses. They are written out inline on each operation rather
 * than as $refs because a client that does not resolve references (several agent frameworks
 * and scanners do not) must still see the version parameter and the error schema on the
 * operation itself. The `default` response keeps its shared $ref for clients that do resolve.
 */

export const ERROR_SCHEMA_REF: Json = { $ref: "#/components/schemas/Error" };

/** The optional API-Version request header, identical on every operation. */
export function apiVersionParameter(): OpenApiParameter {
  return {
    name: API_VERSION_HEADER,
    in: "header",
    required: false,
    description: `Optional. The API version you expect. The only version is ${API_VERSION}; any other value is answered with a 400 so you never receive a contract you did not ask for.`,
    schema: { type: "string", enum: [API_VERSION], default: API_VERSION },
    example: API_VERSION,
  };
}

const RATE_LIMIT_HEADER_DOCS: Record<string, OpenApiHeader> = {
  [API_VERSION_HEADER]: {
    description: `The API version that answered. Always ${API_VERSION}.`,
    schema: { type: "string" },
  },
  "RateLimit-Policy": {
    description: `The quota, as an IETF structured field: "${RATE_LIMIT_POLICY.name}";q=${RATE_LIMIT_POLICY.requests};w=${RATE_LIMIT_POLICY.windowSeconds} means ${RATE_LIMIT_POLICY.requests} requests per ${RATE_LIMIT_POLICY.windowSeconds} seconds.`,
    schema: { type: "string" },
  },
  RateLimit: {
    description:
      'Requests left in the current window and seconds until it resets, as an IETF structured field, for example "default";r=299;t=60.',
    schema: { type: "string" },
  },
  "RateLimit-Limit": {
    description:
      "The quota for the window (earlier-draft name for the q value of RateLimit-Policy).",
    schema: { type: "integer" },
  },
  "RateLimit-Remaining": {
    description:
      "Requests left in the current window (earlier-draft name for the r value of RateLimit).",
    schema: { type: "integer" },
  },
  "RateLimit-Reset": {
    description:
      "Seconds until the window resets (earlier-draft name for the t value of RateLimit).",
    schema: { type: "integer" },
  },
};

/** Headers on every successful response: the version and the rate-limit state. */
export function successHeaders(): Record<string, OpenApiHeader> {
  return { ...RATE_LIMIT_HEADER_DOCS };
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: "The request is malformed: a missing or invalid parameter, or an API-Version this server does not serve.",
  404: "No route or content item exists at this path.",
  405: "The route exists but not for this HTTP method; the Allow header lists the methods it accepts.",
  413: "The request body is larger than the route accepts; the operation description gives the limit.",
  406: "The Accept header asks for a format this route cannot produce.",
  429: "This client is over its request budget; wait for the number of seconds in Retry-After.",
  500: "The server failed while handling a valid request.",
};

/**
 * A typed JSON error response for each requested status, all referencing the Error schema. An
 * operation whose status means something more specific than the shared wording (the batch's 413
 * names its two limits) passes its own text in `overrides`.
 */
export function errorResponses(
  statuses: readonly number[],
  overrides: Readonly<Record<number, string>> = {},
): Record<string, OpenApiResponse> {
  const responses: Record<string, OpenApiResponse> = {};
  for (const status of statuses) {
    const description = overrides[status] ?? ERROR_DESCRIPTIONS[status];
    if (!description)
      throw new Error(`errorResponses: no description for status ${status}`);
    const headers: Record<string, OpenApiHeader> = {
      [API_VERSION_HEADER]: RATE_LIMIT_HEADER_DOCS[API_VERSION_HEADER],
    };
    if (status === 405) {
      headers.Allow = {
        description: "The methods the route accepts.",
        schema: { type: "string" },
      };
    }
    if (status === 429) {
      headers["Retry-After"] = {
        description: "Seconds to wait before retrying.",
        schema: { type: "integer" },
      };
      headers["RateLimit-Policy"] = RATE_LIMIT_HEADER_DOCS["RateLimit-Policy"];
      headers.RateLimit = RATE_LIMIT_HEADER_DOCS.RateLimit;
    }
    responses[String(status)] = {
      description,
      headers,
      content: { "application/json": { schema: ERROR_SCHEMA_REF } },
    };
  }
  return responses;
}
