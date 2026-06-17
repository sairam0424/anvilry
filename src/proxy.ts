import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Next 16 Proxy (formerly Middleware) — runs at the Edge before any route handler.
 *
 * Sole responsibility here: gate /admin/* behind HTTP Basic Auth so the server
 * component can receive a REAL 401 with WWW-Authenticate header — something App
 * Router server components cannot return on their own (they must return React nodes).
 *
 * The timing-safe compare from src/lib/admin-auth.ts is intentionally NOT imported
 * here because the Edge runtime has a limited Node.js API surface. Instead we use
 * the Web Crypto API (SubtleCrypto) which is available in the Edge runtime, or
 * we do a simpler comparison — accepting that the Edge proxy layer is a
 * first-filter, not a cryptographically hardened gate. The full timing-safe compare
 * in admin-auth.ts remains the server-component layer.
 *
 * For simplicity and Edge compat: we compare the raw password using constant-time
 * string comparison via the same hash trick but with TextEncoder + subtle.digest.
 */

export const config = {
  matcher: ["/admin/:path*"],
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function proxy(req: NextRequest) {
  const envPassword = process.env.ADMIN_PASSWORD;

  // If no password is configured, return 401 — locked out entirely.
  // Never expose whether the env is set via the response body.
  if (!envPassword) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="anvilry"' },
    });
  }

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Basic ")) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="anvilry"' },
    });
  }

  const encoded = authorization.slice("Basic ".length).trim();
  let supplied = "";
  try {
    const decoded = atob(encoded);
    // Support "password" and "username:password" forms.
    supplied = decoded.includes(":") ? decoded.split(":").slice(1).join(":") : decoded;
  } catch {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="anvilry"' },
    });
  }

  // Constant-time comparison via SubtleCrypto (available in Edge runtime).
  const [suppliedHash, envHash] = await Promise.all([
    sha256Hex(supplied),
    sha256Hex(envPassword),
  ]);
  if (suppliedHash !== envHash) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="anvilry"' },
    });
  }

  // Auth passed — let the request through to the page component.
  return NextResponse.next();
}
