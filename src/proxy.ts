import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";
import { appendVary, negotiate, PRODUCES } from "@/lib/accept-negotiation";
import { classifyPath } from "@/lib/markdown-routing";

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
 * 2. Markdown content negotiation (https://acceptmarkdown.com). The second matcher entry wakes
 *    this function ONLY for requests whose Accept header mentions text/markdown, so browsers
 *    and crawlers that do not ask for Markdown never invoke it. The full Accept rules (q-values,
 *    specificity, q=0) then decide per path, see src/lib/markdown-routing.ts.
 */

export const config = {
  matcher: [
    "/admin/:path*",
    {
      source: "/:path*",
      has: [{ type: "header", key: "accept", value: "(.*)[Tt]ext/[Mm]arkdown(.*)" }],
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

  return negotiateMarkdown(req);
}
