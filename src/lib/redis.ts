import { Redis } from "@upstash/redis";

/**
 * Shared Upstash Redis singleton.
 *
 * Singleton extracted from rate-limit.ts in v1.8 so other callers (telemetry emit,
 * budget counter, /admin/telemetry reader) can share one Upstash client. Rate-limit.ts
 * now imports this module + wraps with Ratelimit. The singleton is null in local dev
 * without Upstash creds — every caller must guard.
 *
 * Why one client, not one per caller: the @upstash/redis SDK is REST-based (no
 * persistent connection to leak), but constructing a fresh one per call still
 * re-resolves the env vars on every import — which means a typo in one caller's
 * env handling would silently diverge from another caller's. Keeping ONE place
 * to read UPSTASH_REDIS_REST_URL + _TOKEN keeps the fail-open semantics uniform:
 * either every Redis-backed feature is configured, or none are. No half-on state.
 *
 * Failure mode: if either env var is unset, `redis` is `null` and every caller
 * MUST treat that as "Redis-backed feature is off". This is the deliberate
 * fail-open posture for local dev — chat works, telemetry degrades to log-only,
 * rate-limit becomes a no-op. Production protection comes from the loud warning
 * in rate-limit.ts, not from forcing creds at module load (a hard throw here would
 * kill `next build` on any environment that doesn't ship Upstash creds at build time).
 */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// Wrap in try/catch: the @upstash/redis SDK throws a synchronous UrlError at
// construction time if the URL has an invalid scheme (e.g. redis://, bare hostname,
// trailing newline from env injection). Without the guard, a malformed
// UPSTASH_REDIS_REST_URL crashes every API route cold start because redis.ts is
// imported by rate-limit.ts, emit.ts, and with-trace.ts.
let _redis: Redis | null = null;
try {
  if (url && token) _redis = new Redis({ url, token });
} catch (e) {
  console.error("[redis] Invalid Upstash configuration — Redis is disabled. Fix UPSTASH_REDIS_REST_URL:", e);
}
export const redis: Redis | null = _redis;

/** True iff both Upstash env vars were present at module-load time. */
export function isRedisConfigured(): boolean {
  return redis !== null;
}
