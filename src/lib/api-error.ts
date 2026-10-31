import { SITE_URL } from "@/lib/site-url";

/**
 * The JSON error shape of this site's public API.
 *
 *   { error, code, status, hint, docs }
 *
 * `error` is the human message and keeps its pre-existing name so any client that already
 * reads `body.error` keeps working; `code` is the stable machine-readable key an agent
 * should branch on; `hint` says what to do next; `docs` points at the catalogue below,
 * which /developers renders from this same array (one source, so the page cannot drift).
 *
 * Scope: the failures the public routes raise themselves. Not covered, on purpose: the MCP
 * endpoint's JSON-RPC errors (clients parse those), operator-only routes (cron, admin and the
 * flags endpoint keep their own bodies) and an exception in a route outside withJsonErrors.
 * Every code below must be emitted by some route; api-error.test.ts fails on a dead one.
 */
export const ERROR_DOCS_URL = `${SITE_URL}/developers#errors`;

export const API_ERROR_CODES = [
  {
    code: "invalid_request",
    status: 400,
    meaning:
      "The request body or a parameter is missing, malformed or not allowed.",
    hint: "Check the request against the schema in /openapi.json and send it again.",
  },
  {
    code: "not_found",
    status: 404,
    meaning: "No API route or content item exists at this path.",
    hint: "List the real routes in /openapi.json, or browse /llms.txt for content slugs.",
  },
  {
    code: "method_not_allowed",
    status: 405,
    meaning: "The route exists but not for this HTTP method.",
    hint: "Use a method from the Allow response header.",
  },
  {
    code: "payload_too_large",
    status: 413,
    meaning: "The request body is bigger than the route accepts.",
    hint: "Send a smaller body; limits are listed per route in /openapi.json.",
  },
  {
    code: "rate_limited",
    status: 429,
    meaning: "Too many requests from this client in the current window.",
    hint: "Wait for the number of seconds in the Retry-After header, then retry.",
  },
  {
    code: "internal_error",
    status: 500,
    meaning: "The server failed while handling a valid request.",
    hint: "Retry once after a short delay; if it keeps failing, report it via /contact.",
  },
  {
    code: "upstream_error",
    status: 502,
    meaning:
      "A third-party service this route depends on failed or returned nothing.",
    hint: "Retry after a short delay; the failure is outside this server.",
  },
  {
    code: "not_configured",
    status: 503,
    meaning:
      "The feature is switched off or missing its server-side configuration.",
    hint: "This is a deployment setting, not something a client can fix. Use another route.",
  },
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]["code"];

export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
  status: number;
  hint: string;
  docs: string;
}

interface ApiErrorOptions {
  /** Overrides the catalogue hint when the caller knows something more specific. */
  hint?: string;
  headers?: HeadersInit;
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  options: ApiErrorOptions = {},
): Response {
  const entry = API_ERROR_CODES.find((c) => c.code === code);
  if (!entry || entry.status !== status) {
    // A typo here would ship a lying status/code pair; fail loudly in tests instead.
    throw new Error(
      `apiError: code "${code}" is documented as ${entry?.status ?? "unknown"}, not ${status}`,
    );
  }
  const body: ApiErrorBody = {
    error: message,
    code,
    status,
    hint: options.hint ?? entry.hint,
    docs: ERROR_DOCS_URL,
  };
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Wraps a route handler so an unexpected exception leaves the server as the shared JSON error
 * (500, internal_error) instead of Next's empty-bodied 500. The cause is logged server-side by
 * name only; nothing from the exception reaches the client.
 */
export function withJsonErrors<Args extends unknown[]>(
  handler: (...args: Args) => Response | Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(`[api] unhandled error in route handler: ${(err as Error)?.name ?? "error"}`);
      return apiError(500, "internal_error", "The server could not complete the request.");
    }
  };
}

/**
 * Handler for the HTTP methods a route does not implement. Next answers those with an
 * empty-bodied 405; this gives the same status a JSON body and an accurate Allow header.
 * OPTIONS is always listed because Next answers it itself.
 */
export function methodNotAllowed(allowed: readonly string[]): () => Response {
  const allow = [...new Set([...allowed, "OPTIONS"])].join(", ");
  return () =>
    apiError(405, "method_not_allowed", "Method not allowed for this route.", {
      hint: `Use one of: ${allow}.`,
      headers: { Allow: allow },
    });
}

const MAX_ECHOED_MESSAGE = 200;

/**
 * Wraps a response we do not author (the MCP transport library's 404/405 text, for
 * instance) so an error always leaves the server as JSON. It never rewrites a body that
 * is already JSON: a JSON-RPC error is the contract MCP clients parse, so a JSON body that
 * merely lacks a content type is labelled, not replaced.
 */
export async function ensureJsonError(res: Response): Promise<Response> {
  if (res.status < 400) return res;
  const type = res.headers.get("content-type") ?? "";
  if (/json|event-stream/i.test(type)) return res;

  const text = await res.text();
  const headers = new Headers(res.headers);
  headers.delete("content-length");

  try {
    JSON.parse(text);
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(text, { status: res.status, headers });
  } catch {
    // Not JSON: fall through to the shared error shape.
  }

  const entry = API_ERROR_CODES.find((c) => c.status === res.status);
  if (!entry) return new Response(text, { status: res.status, headers });

  const message =
    text.trim().slice(0, MAX_ECHOED_MESSAGE) || res.statusText || entry.meaning;
  const allow = headers.get("allow");
  return apiError(res.status, entry.code, message, {
    headers: allow ? { Allow: allow } : undefined,
  });
}

/**
 * Answer to OPTIONS on a route that stubs other methods. Next would build Allow from the exported
 * handlers, which lists the stubs as if they worked; this keeps it equal to the 405 answer's.
 */
export function optionsFor(allowed: readonly string[]): () => Response {
  const allow = [...new Set([...allowed, "OPTIONS"])].join(", ");
  return () => new Response(null, { status: 204, headers: { Allow: allow } });
}
