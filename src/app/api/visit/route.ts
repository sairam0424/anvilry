import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const runtime = "nodejs";

/**
 * POST /api/visit — increments a global visitor counter backed by Upstash Redis.
 * Called once per page load from the footer VisitorBadge component.
 *
 * Rate-limited to 1 increment per IP per 30 minutes to prevent gaming (accidental or
 * intentional rapid reloads don't inflate the count). Fails open when Redis is absent
 * (local dev without Upstash configured) — the badge just shows 0.
 *
 * Gate: only active when NEXT_PUBLIC_VISITOR_COUNTER=true. The API itself is always
 * reachable (no flag check here) so the rate-limit state is consistent even if the
 * flag is toggled at the edge.
 */

function clientIp(req: Request): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",").pop()!.trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}

const limiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1, "30 m"),
      prefix: "anvilry:visit",
      analytics: false,
    })
  : null;

export async function POST(req: Request) {
  if (!redis) return NextResponse.json({ total: 0, today: 0 });

  // Rate-limit: 1 increment per IP per 30 min — fails open on error.
  if (limiter) {
    try {
      const { success } = await limiter.limit(clientIp(req));
      if (!success) {
        // Still return the current counts (don't leak a 429 to the badge).
        const [total] = await redis.mget<number[]>(
          "anvilry:visits:total",
        );
        return NextResponse.json({ total: total ?? 0, today: 0 });
      }
    } catch {
      // Fail open — limiter error should not prevent the badge from rendering.
    }
  }

  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const ttl = Math.floor((midnight.getTime() - now.getTime()) / 1000);

  const [total, today] = await redis.pipeline()
    .incr("anvilry:visits:total")
    .incr("anvilry:visits:daily")
    .exec() as [number, number];

  // Set daily TTL only on the first increment of the day (when today === 1).
  if (today === 1 && ttl > 0) {
    await redis.expire("anvilry:visits:daily", ttl);
  }

  return NextResponse.json({ total, today });
}
