import { Ratelimit } from "@upstash/ratelimit";
import { hasValidCronSecret } from "./cron-auth";
import { redis } from "./redis";

/**
 * Per-IP rate limiter backed by Upstash Redis (distributed — survives across Vercel
 * instances/regions). Guards real AWS Bedrock spend from bots hammering the API.
 *
 * FAILS OPEN by design: if the Upstash env vars are absent (local dev, or before
 * the account is wired up), the limiter is a no-op so the routes still work. It
 * activates automatically once UPSTASH_REDIS_REST_URL + _TOKEN are set in the
 * deploy env. The Redis client and its env handling are owned by ./redis (shared
 * singleton), so every Redis-backed feature toggles in lockstep.
 *
 * Route classes each get their OWN sliding-window bucket so one class can never
 * starve another: per-sentence TTS or an error-beacon loop must not 429 the user's
 * own chat. `chat` keeps the original `anvilry:chat` prefix so live counters carry over.
 */
export type RateLimitClass = "chat" | "voice" | "beacon";

// 8 requests per minute per IP per class — generous for a real visitor, hostile to a bot.
const REQUESTS_PER_WINDOW = 8;
const WINDOW = "60 s";

const KEY_PREFIX: Record<RateLimitClass, string> = {
  chat: "anvilry:chat",
  voice: "anvilry:voice",
  beacon: "anvilry:beacon",
};

const RATE_LIMIT_CLASSES = Object.keys(KEY_PREFIX) as RateLimitClass[];

function buildLimiters(): Record<RateLimitClass, Ratelimit> | null {
  const client = redis;
  if (!client) return null;
  const entries = RATE_LIMIT_CLASSES.map((cls) => [
    cls,
    new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(REQUESTS_PER_WINDOW, WINDOW),
      prefix: KEY_PREFIX[cls],
      analytics: false,
    }),
  ]);
  return Object.fromEntries(entries) as Record<RateLimitClass, Ratelimit>;
}

const limiters = buildLimiters();

/** Whether a distributed limiter is configured (false -> fail-open no-op). */
export const isRateLimitEnabled = limiters != null;

/**
 * Loud guard against a SILENT fail-open in production. Failing open on a *transient*
 * Upstash error mid-request is intentional (a cost guard must never take the chat
 * down). But shipping to PRODUCTION with the limiter entirely UNCONFIGURED means the
 * cost-bearing routes (/api/chat, /api/tts, /api/transcribe) have NO protection and no
 * signal — a misconfig that only surfaces as an AWS bill. We emit one clear warning at
 * module load so it's visible in the deploy logs. (Local dev stays quiet — fail-open is
 * the right default there.)
 */
if (!isRateLimitEnabled && process.env.NODE_ENV === "production") {
  console.warn(
    "[rate-limit] CRITICAL: UPSTASH_REDIS_REST_URL / _TOKEN are not set in production — " +
      "/api/chat, /api/tts, and /api/transcribe are UNPROTECTED against per-IP abuse and " +
      "AWS cost attacks. Configure Upstash in the deploy environment.",
  );
}

/** Derive the real client IP. On Vercel, x-vercel-forwarded-for is set by the
 *  platform and cannot be spoofed. Falling back to the LAST segment of
 *  x-forwarded-for (set by Vercel's infrastructure) rather than the first (which
 *  is attacker-controlled) prevents rate-limit bypass via rotating spoofed headers. */
function clientIp(req: Request): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",").pop()!.trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}

/**
 * Returns { ok: true } when the request is within budget (or when no limiter is
 * configured), or { ok: false, retryAfter } when the per-IP budget for `cls` is
 * exhausted. `cls` is required so a route can never silently share another class's bucket.
 *
 * A request carrying a valid CRON_SECRET bearer bypasses the limiter: the eval cron
 * fires 12 sequential chats and would otherwise self-throttle against the 8/min budget.
 *
 * FAILS OPEN on ANY error — if Upstash is unreachable / times out / 5xxs mid-request,
 * we let the request through rather than 500 the chat. A rate limiter must never be
 * a single point of failure for the feature it protects: a cost guard going down
 * should degrade to "no limit", not "no chat".
 */
export async function checkRateLimit(
  req: Request,
  cls: RateLimitClass,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  if (!limiters) return { ok: true }; // not configured -> fail open
  if (hasValidCronSecret(req)) return { ok: true };
  try {
    const { success, reset } = await limiters[cls].limit(clientIp(req));
    if (success) return { ok: true };
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return { ok: false, retryAfter };
  } catch (err) {
    console.warn(`[rate-limit] check failed, failing open: ${(err as Error)?.name ?? "error"}`);
    return { ok: true };
  }
}
