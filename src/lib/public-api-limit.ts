import { RATE_LIMIT_POLICY } from "@/lib/api-policy";

/**
 * The per-client request budget of the public API, enforced in src/proxy.ts.
 *
 * It is a fixed-window counter held in memory on purpose. The routes it guards are free,
 * read-only and mostly cached, so the limit exists to be honest and to stop a runaway loop, not
 * to protect spend; the chat, voice and beacon routes keep their own Redis-backed limiter
 * (src/lib/rate-limit.ts) and are not touched here. Keeping this out of Redis also means a
 * crawler cannot burn the Upstash command quota that the cost guard depends on.
 *
 * The consequence is stated in the published policy: the count is per server instance.
 */

export interface LimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  /** Whole seconds until the current window ends (at least 1). */
  readonly resetSeconds: number;
}

interface WindowLimiterOptions {
  readonly requests: number;
  readonly windowSeconds: number;
  /** Upper bound on tracked clients, so a flood of addresses cannot grow memory without limit. */
  readonly maxKeys?: number;
  readonly now?: () => number;
}

interface Bucket {
  readonly count: number;
  readonly resetAt: number;
}

const DEFAULT_MAX_KEYS = 10_000;
const MS_PER_SECOND = 1000;

export function createWindowLimiter(options: WindowLimiterOptions) {
  const {
    requests,
    windowSeconds,
    maxKeys = DEFAULT_MAX_KEYS,
    now = Date.now,
  } = options;
  const buckets = new Map<string, Bucket>();

  function prune(at: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= at) buckets.delete(key);
    }
    // Still full of live clients: drop the oldest insertions until there is room.
    for (const key of buckets.keys()) {
      if (buckets.size < maxKeys) break;
      buckets.delete(key);
    }
  }

  return {
    hit(key: string): LimitDecision {
      const at = now();
      const current = buckets.get(key);
      const live = current && current.resetAt > at ? current : undefined;

      if (!live && buckets.size >= maxKeys) prune(at);

      const bucket: Bucket = live
        ? { count: live.count + 1, resetAt: live.resetAt }
        : { count: 1, resetAt: at + windowSeconds * MS_PER_SECOND };
      // Re-insert so Map order tracks recency of the window start, not of every hit.
      if (!live) buckets.delete(key);
      buckets.set(key, bucket);

      return {
        allowed: bucket.count <= requests,
        limit: requests,
        remaining: Math.max(0, requests - bucket.count),
        resetSeconds: Math.max(
          1,
          Math.ceil((bucket.resetAt - at) / MS_PER_SECOND),
        ),
      };
    },
    size: () => buckets.size,
  };
}

/** The process-wide limiter for the public API, sized from the published policy. */
export const publicApiLimiter = createWindowLimiter({
  requests: RATE_LIMIT_POLICY.requests,
  windowSeconds: RATE_LIMIT_POLICY.windowSeconds,
});

/**
 * The RateLimit header fields for a decision.
 *  - RateLimit-Policy and RateLimit: draft-ietf-httpapi-ratelimit-headers (structured fields,
 *    `"name";q=quota;w=window` and `"name";r=remaining;t=seconds-to-reset`);
 *  - RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset: the names earlier drafts used and
 *    many clients still read, with the same numbers;
 *  - Retry-After (RFC 9110) on a refusal.
 */
export function rateLimitHeaders(decision: LimitDecision): [string, string][] {
  const { name, windowSeconds } = RATE_LIMIT_POLICY;
  const fields: [string, string][] = [
    ["RateLimit-Policy", `"${name}";q=${decision.limit};w=${windowSeconds}`],
    [
      "RateLimit",
      `"${name}";r=${decision.remaining};t=${decision.resetSeconds}`,
    ],
    ["RateLimit-Limit", String(decision.limit)],
    ["RateLimit-Remaining", String(decision.remaining)],
    ["RateLimit-Reset", String(decision.resetSeconds)],
  ];
  if (!decision.allowed)
    fields.push(["Retry-After", String(decision.resetSeconds)]);
  return fields;
}

/**
 * The real client address. Vercel sets x-vercel-forwarded-for and it cannot be spoofed; the
 * fallback is the LAST x-forwarded-for segment, which Vercel's infrastructure appends, never
 * the first, which the client controls. Duplicated on purpose, like the other copies listed in
 * client-ip-consistency.test.ts, so this module does not import the Redis-backed limiter.
 */
function clientIp(req: Request): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",").pop()!.trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}

export function publicApiClientKey(req: Request): string {
  return clientIp(req);
}
