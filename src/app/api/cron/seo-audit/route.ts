import { redis } from "@/lib/redis";
import { allWork, allProjects, allArticles, allNotes } from "@/lib/content";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/seo-audit
 *
 * Weekly SEO health check. Verifies critical discoverability routes return 200
 * and scans content for missing summary fields. Writes results to Redis for
 * the telemetry dashboard tile. Zero LLM calls — pure HTTP + content scan.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (secret && authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const routesToCheck = [
    "/sitemap.xml",
    "/llms.txt",
    "/robots.txt",
    "/feed.xml",
  ];

  const checks = await Promise.all(
    routesToCheck.map(async (path) => {
      try {
        const res = await fetch(`${base}${path}`, {
          signal: AbortSignal.timeout(10_000),
        });
        return { name: path, pass: res.status === 200, status: res.status };
      } catch {
        return { name: path, pass: false, status: 0 };
      }
    }),
  );

  // Count content items missing a summary (our canonical description field).
  const allContent = [
    ...allWork.map((i) => ({ ...i, type: "work" as const })),
    ...allProjects.map((i) => ({ ...i, type: "project" as const })),
    ...allArticles.map((i) => ({ ...i, type: "article" as const })),
    ...allNotes.map((i) => ({ ...i, type: "note" as const })),
  ];
  const content_missing_summary = allContent.filter(
    (i) => !("summary" in i) || !i.summary,
  ).length;

  const result = {
    run_at: Date.now(),
    checks,
    all_routes_pass: checks.every((c) => c.pass),
    content_missing_summary,
    total_content: allContent.length,
  };

  if (redis) {
    await redis.set("anvilry:seo:audit:latest", JSON.stringify(result), {
      ex: 7 * 24 * 3600, // 1 week
    });
  }

  return Response.json(result);
}
