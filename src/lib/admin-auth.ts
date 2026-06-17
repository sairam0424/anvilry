import { timingSafeEqual, createHash } from "node:crypto";

/**
 * HTTP Basic Auth guard for /admin/* server pages. A single ADMIN_PASSWORD
 * env var is the credential — no username, no session token, no OAuth. This
 * is intentionally minimal: the /admin/telemetry page is a read-only dashboard
 * used occasionally by the owner; full auth infrastructure would be overkill
 * and would add dependencies that complicate the security surface.
 *
 * Uses crypto.timingSafeEqual so the compare is not vulnerable to timing
 * attacks (a naive === comparison short-circuits on first mismatched byte,
 * leaking partial password information under repeated probing).
 *
 * When ADMIN_PASSWORD is unset the function denies everything — there is no
 * default password. An unset env means the page is locked out entirely, which
 * is the safer failure mode for a production deployment.
 */

/** Returns { ok: true } when the request carries the correct Basic credentials,
 *  or a ready-to-return 401 Response when they are absent or wrong. */
export function requireAdmin(req: Request): { ok: true } | Response {
  const envPassword = process.env.ADMIN_PASSWORD;
  if (!envPassword) {
    // No password configured → deny all access. Log once so it's findable
    // in Vercel Logs, but do NOT leak the reason to the HTTP client.
    console.warn("[admin-auth] ADMIN_PASSWORD is not set — /admin/* is locked out.");
    return unauthorized();
  }

  const header = req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Basic ")) {
    return unauthorized();
  }

  const encoded = header.slice("Basic ".length).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return unauthorized();
  }

  // Support both "password" (no colon) and "anything:password" forms so curl
  // users can do -u admin:mypassword or -u :mypassword without extra flags.
  const supplied = decoded.includes(":") ? decoded.split(":").slice(1).join(":") : decoded;

  if (!constantTimeEqual(supplied, envPassword)) {
    return unauthorized();
  }

  return { ok: true };
}

/** Timing-safe compare via SHA-256 digests — comparisons against digests of
 *  equal length are safe, and padding secrets that way avoids the variable-
 *  length constraint in timingSafeEqual (which throws if buffers differ). */
function constantTimeEqual(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="anvilry"',
      "Cache-Control": "no-store",
    },
  });
}
