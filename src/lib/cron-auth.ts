import { createHash, timingSafeEqual } from "node:crypto";

/** SHA-256 digest, so both sides of the compare are always the same length. */
function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * True when the request carries `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Fail-CLOSED: an unset/empty CRON_SECRET never authorises anything. Both sides are
 * hashed with SHA-256 before `timingSafeEqual`, so the comparison is constant-time and
 * the secret's length never leaks (timingSafeEqual throws on unequal-length inputs).
 */
export function hasValidCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader === null) return false;
  return timingSafeEqual(digest(authHeader), digest(`Bearer ${secret}`));
}

/** Route guard: null when authorised, otherwise the 401 response every cron route returns. */
export function unauthorizedUnlessCron(req: Request): Response | null {
  if (hasValidCronSecret(req)) return null;
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
