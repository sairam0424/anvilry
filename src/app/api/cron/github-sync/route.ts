import { redis } from "@/lib/redis";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/cron/github-sync
 *
 * Hourly GitHub stats cache warm. Fetches /api/github/stats with cache:no-store
 * to bust ISR and writes the result to Redis for instant dashboard reads.
 *
 * Idempotent: if the key already exists with a fresh TTL, skips the re-fetch.
 * This means double-invocations (Vercel best-effort delivery) are harmless.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 * Cost: 1 GitHub API call per hour — well within unauthenticated rate limits.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    return Response.json({ synced: false, reason: "Redis not configured" });
  }

  // Idempotency: skip if a fresh result already exists.
  const existing = await redis.get("anvilry:github:stats:latest");
  if (existing) {
    return Response.json({ synced: false, reason: "cache_fresh", run_at: Date.now() });
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  let stats: unknown = null;
  try {
    const res = await fetch(`${base}/api/github/stats`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) stats = await res.json();
  } catch {
    return Response.json({ synced: false, reason: "fetch_failed", run_at: Date.now() });
  }

  // Explicit upstream-error branch — must come before the Redis write so a failed
  // GitHub API call (429, 503, etc.) returns synced:false, not synced:true.
  if (!stats) {
    return Response.json({ synced: false, reason: "upstream_error", run_at: Date.now() });
  }

  await redis.set("anvilry:github:stats:latest", JSON.stringify(stats), { ex: 5400 });
  return Response.json({ synced: true, run_at: Date.now() });
}
