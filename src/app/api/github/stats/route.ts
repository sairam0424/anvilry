import { getRepoFeed } from "@/lib/github";

export const runtime = "nodejs";
export const revalidate = 3600; // Revalidate once per hour — matches getRepoFeed() ISR cadence.

/**
 * GET /api/github/stats
 *
 * Aggregates live GitHub data from the REPO_ALLOWLIST into a compact summary the
 * /api/chat system prompt injects as "LIVE GITHUB STATS". Results are ISR-cached for
 * 1 hour — the same cadence as getRepoFeed() itself — so chat turns never block on
 * a fresh GitHub API call; they hit the ISR cache.
 *
 * Fail-open: if getRepoFeed() returns [] (no token, rate-limited, etc.) the response
 * is still valid JSON with zero values. The /api/chat route treats this gracefully.
 */
export async function GET() {
  const repos = await getRepoFeed();

  const totalStars = repos.reduce((sum, r) => sum + (r.stars ?? 0), 0);

  // Frequency-sort languages; filter nulls.
  const langCounts = new Map<string, number>();
  for (const r of repos) {
    if (r.language) {
      langCounts.set(r.language, (langCounts.get(r.language) ?? 0) + 1);
    }
  }
  const topLanguages = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  // Most recent push across all repos.
  const mostRecentPush =
    repos.length > 0
      ? repos.reduce((latest, r) =>
          !latest || r.pushedAt > latest ? r.pushedAt : latest,
          "",
        )
      : null;

  return Response.json({
    totalStars,
    topLanguages,
    mostRecentPush,
    repoCount: repos.length,
  });
}
