import { redis } from "@/lib/redis";
import { allArticles, allNotes } from "@/lib/content";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/content-audit
 *
 * Weekly content freshness check. Flags articles and notes that haven't been
 * updated in over 18 months — potential staleness signals for the content loop.
 * Writes results to Redis for the telemetry dashboard tile.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */

const EIGHTEEN_MONTHS_MS = 18 * 30 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threshold = Date.now() - EIGHTEEN_MONTHS_MS;

  const stale_articles = allArticles
    .filter((a) => new Date(a.date).getTime() < threshold)
    .map((a) => a.slug);

  const stale_notes = allNotes
    .filter((n) => new Date(n.date).getTime() < threshold)
    .map((n) => n.slug);

  const result = {
    run_at: Date.now(),
    stale_articles,
    stale_notes,
    total_stale: stale_articles.length + stale_notes.length,
    total_articles: allArticles.length,
    total_notes: allNotes.length,
  };

  if (redis) {
    await redis.set("anvilry:content:audit:latest", JSON.stringify(result), {
      ex: 7 * 24 * 3600, // 1 week
    });
  }

  return Response.json(result);
}
