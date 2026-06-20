import { getRepoFeed } from "@/lib/github";

export const runtime = "nodejs";
export const revalidate = 3600; // Revalidate once per hour — matches getRepoFeed() ISR cadence.

/**
 * GET /api/github/stats
 *
 * Aggregates live GitHub data into a compact summary for the homepage strip
 * and /api/chat system prompt. Results are ISR-cached for 1 hour.
 *
 * Fail-open: if any fetch fails the response still returns valid JSON with
 * zero/fallback values so the UI can degrade gracefully.
 */
export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Fetch repos + user profile in parallel — fail-open on either.
  const [repos, userJson] = await Promise.all([
    getRepoFeed(),
    fetch("https://api.github.com/users/sairam0424", { headers, next: { revalidate: 3600 } })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const totalStars = repos.reduce((sum, r) => sum + (r.stars ?? 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forks ?? 0), 0);

  const langCounts = new Map<string, number>();
  for (const r of repos) {
    if (r.language) langCounts.set(r.language, (langCounts.get(r.language) ?? 0) + 1);
  }
  const topLanguages = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  const mostRecentPush =
    repos.length > 0
      ? repos.reduce((latest, r) => (!latest || r.pushedAt > latest ? r.pushedAt : latest), "")
      : null;

  return Response.json({
    totalStars,
    totalForks,
    topLanguages,
    mostRecentPush,
    repoCount: repos.length,
    followers: (userJson as { followers?: number } | null)?.followers ?? 0,
    publicRepos: (userJson as { public_repos?: number } | null)?.public_repos ?? repos.length,
  });
}
