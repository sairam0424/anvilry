import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isAdminAuthorized } from "@/lib/admin-auth";

/**
 * Next 16 Proxy (formerly Middleware) — runs on the Node.js runtime by default
 * (see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md),
 * before any route handler.
 *
 * Sole responsibility here: gate /admin/* behind HTTP Basic Auth so the request
 * gets a REAL 401 with WWW-Authenticate header — something App Router server
 * components cannot return on their own (they must return React nodes).
 *
 * The credential check is shared with the page and route layers via
 * isAdminAuthorized (src/lib/admin-auth.ts), which compares SHA-256 digests with
 * crypto.timingSafeEqual. The admin pages re-check auth themselves, so this
 * proxy is the first filter, not the only gate.
 */

export const config = {
  matcher: ["/admin/:path*"],
};

export async function proxy(req: NextRequest) {
  if (!isAdminAuthorized(req.headers.get("Authorization"))) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="anvilry"' },
    });
  }

  // Auth passed — let the request through to the page component.
  return NextResponse.next();
}
