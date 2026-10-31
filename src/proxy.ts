import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { appendVary, negotiate, PRODUCES } from "@/lib/accept-negotiation";
import { apiError } from "@/lib/api-error";
import { API_VERSION, API_VERSION_HEADER, deprecationHeaders } from "@/lib/api-policy";
import { classifyPath } from "@/lib/markdown-routing";
import { isPublicApiPath } from "@/lib/public-api-paths";
import { publicApiClientKey, publicApiLimiter, rateLimitHeaders } from "@/lib/public-api-limit";

/**
 * Next 16 Proxy (formerly Middleware) — runs on the Node.js runtime by default
 * (see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md),
 * before any route handler. Two responsibilities:
 *
 * 1. Gate /admin/* behind HTTP Basic Auth so the request gets a REAL 401 with a
 *    WWW-Authenticate header — something App Router server components cannot return on their
 *    own (they must return React nodes). The credential check is shared with the page and
 *    route layers via isAdminAuthorized (src/lib/admin-auth.ts), which compares SHA-256
 *    digests with crypto.timingSafeEqual. The admin pages re-check auth themselves, so this
 *    proxy is the first filter, not the only gate.
 *
 * 2. Markdown content negotiation (https://acceptmarkdown.com). The `has` matcher entry wakes
 *    this function ONLY for requests whose Accept header mentions text/markdown, so browsers
 *    and crawlers that do not ask for Markdown never invoke it. The full Accept rules (q-values,
 *    specificity, q=0) then decide per path, see src/lib/markdown-routing.ts.
 *
 * 3. The public API contract (src/lib/api-policy.ts). Paths accepted by isPublicApiPath get the
 *    API-Version header, the RateLimit headers and, when a deprecation is scheduled, Deprecation
 *    and Sunset. A client over its budget gets a JSON 429 with Retry-After, and a request that
 *    names an API-Version other than the current one gets a JSON 400. This must run in the
 *    proxy because most of these responses are prerendered or cached and so cannot compute a
 *    per-client number themselves. The matcher below lists the same paths as isPublicApiPath;
 *    public-api-paths.test.ts fails if they disagree.
 */

// The regex is spelled out letter by letter because a matcher value is a plain JS regular
// expression with no flags, and media type names are case-insensitive (RFC 9110), exactly as
// negotiate() treats them.
export const config = {
  matcher: [
    "/admin/:path*",
    "/api/:path*",
    "/llms.txt",
    "/llms-full.txt",
    "/openapi.json",
    "/feed.xml",
    "/sitemap.xml",
    "/robots.txt",
    "/:page.md",
    "/:kind(projects|work|articles|notes)/:slug.md",
    {
      source: "/:path*",
      has: [{ type: "header", key: "accept", value: "(.*)[Tt][Ee][Xx][Tt]/[Mm][Aa][Rr][Kk][Dd][Oo][Ww][Nn](.*)" }],
    },
  ],
};

const NOT_ACCEPTABLE =
  "Not Acceptable\n\nThis page is available as text/html and text/markdown.\nTry: Accept: text/markdown\n";

function negotiateMarkdown(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const route = classifyPath(pathname);
  if (route.action === "pass") return NextResponse.next();

  const chosen = negotiate(req.headers.get("accept"), PRODUCES);

  if (chosen === "text/markdown") {
    if (route.action === "rewrite") return NextResponse.rewrite(new URL(route.destination, req.url));
    const notFound = new URL("/api/md/not-found", req.url);
    notFound.searchParams.set("p", pathname);
    return NextResponse.rewrite(notFound);
  }

  // Nothing we can produce is acceptable. Only a page that really is negotiated answers 406;
  // everything else keeps its normal behaviour.
  if (chosen === null && route.action === "rewrite") {
    return new NextResponse(NOT_ACCEPTABLE, {
      status: 406,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        Vary: "Accept",
        "Cache-Control": "no-store",
      },
    });
  }

  // HTML wins: serve the page, and say that this URL varies with Accept.
  const html = NextResponse.next();
  if (route.action === "rewrite") appendVary(html.headers, "Accept");
  return html;
}

const MAX_ECHOED_VERSION = 20;

/** Adds the headers every public API response carries; returns the same response. */
function stamp(res: Response, req: NextRequest, rateLimit: [string, string][]): Response {
  res.headers.set(API_VERSION_HEADER, API_VERSION);
  for (const [name, value] of rateLimit) res.headers.set(name, value);
  for (const [name, value] of deprecationHeaders(req.nextUrl.pathname)) {
    // Link may already carry the Markdown alternates; append rather than overwrite.
    if (name === "Link" && res.headers.has("Link")) res.headers.append(name, value);
    else res.headers.set(name, value);
  }
  return res;
}

function servePublicApi(req: NextRequest): Response {
  const requested = req.headers.get(API_VERSION_HEADER)?.trim();
  if (requested !== undefined && requested !== API_VERSION) {
    return stamp(
      apiError(400, "invalid_request", `Unsupported ${API_VERSION_HEADER} "${requested.slice(0, MAX_ECHOED_VERSION)}".`, {
        hint: `The only version is ${API_VERSION}. Omit the header or send ${API_VERSION_HEADER}: ${API_VERSION}.`,
      }),
      req,
      [],
    );
  }

  // Preflight requests are not API calls and must never spend a client's budget.
  if (req.method === "OPTIONS") return stamp(negotiateMarkdown(req), req, []);

  const decision = publicApiLimiter.hit(publicApiClientKey(req));
  const headers = rateLimitHeaders(decision);
  if (!decision.allowed) {
    return stamp(
      apiError(429, "rate_limited", "Too many requests from this client.", {
        hint: `Wait ${decision.resetSeconds} seconds (see Retry-After), then retry.`,
      }),
      req,
      headers,
    );
  }
  return stamp(negotiateMarkdown(req), req, headers);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!isAdminAuthorized(req.headers.get("Authorization"))) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="anvilry"' },
      });
    }
    // Auth passed — let the request through to the page component.
    return NextResponse.next();
  }

  if (isPublicApiPath(pathname)) return servePublicApi(req);

  return negotiateMarkdown(req);
}
