import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Per-IP rate limiter for the chat API, backed by Upstash Redis (distributed —
 * survives across Vercel instances/regions). Guards real AWS Bedrock spend from
 * bots hammering /api/chat.
 *
 * FAILS OPEN by design: if the Upstash env vars are absent (local dev, or before
 * the account is wired up), the limiter is a no-op so the chat still works. It
 * activates automatically once UPSTASH_REDIS_REST_URL + _TOKEN are set in the
 * deploy env — no code change needed to turn it on.
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const limiter =
  url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        // 8 messages per minute per IP — generous for a real visitor, hostile to a bot.
        limiter: Ratelimit.slidingWindow(8, "60 s"),
        prefix: "anvilry:chat",
        analytics: false,
      })
    : null;

/** Whether a distributed limiter is configured (false -> fail-open no-op). */
export const isRateLimitEnabled = limiter != null;

/** Derive a best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}

/**
 * Returns { ok: true } when the request is within budget (or when no limiter is
 * configured), or { ok: false, retryAfter } when the per-IP budget is exhausted.
 *
 * FAILS OPEN on ANY error — if Upstash is unreachable / times out / 5xxs mid-request,
 * we let the request through rather than 500 the chat. A rate limiter must never be
 * a single point of failure for the feature it protects: a cost guard going down
 * should degrade to "no limit", not "no chat".
 */
export async function checkRateLimit(
  req: Request,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  if (!limiter) return { ok: true }; // not configured -> fail open
  try {
    const { success, reset } = await limiter.limit(clientIp(req));
    if (success) return { ok: true };
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return { ok: false, retryAfter };
  } catch (err) {
    console.warn(`[rate-limit] check failed, failing open: ${(err as Error)?.name ?? "error"}`);
    return { ok: true };
  }
}
