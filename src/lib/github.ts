import { profile } from "@/lib/profile";

/**
 * First-party GitHub repo feed — replaces the third-party github-readme-stats
 * <img> embeds (which hit an external service live on every page view) with our
 * own server-side fetch, cached via ISR (revalidate=3600 on the /projects page).
 *
 * SERVER-ONLY: imported solely by the /projects Server Component. It reads
 * process.env.GITHUB_TOKEN, which must never reach the client. (No `server-only`
 * package is installed; the single server-component import site is the guarantee.)
 *
 * FAIL-OPEN, ALLOWLIST-GATED, RENDER-ONLY-WHAT-RESOLVES:
 *  - Only repos on REPO_ALLOWLIST are ever fetched (no scraping the whole account).
 *  - A missing token, a 404 (private/renamed repo), a rate-limit, or a network
 *    error degrades to FEWER cards — never an error surfaced to a recruiter.
 *  - Unauthenticated GitHub allows 60 req/hr; with a PAT, 5000/hr. Either way the
 *    fetch runs at build + once/hour (ISR), not per visitor.
 */

const GITHUB_API = "https://api.github.com";

/**
 * Repos shown in the feed. The 8 Velite-featured projects + two extras the owner
 * called out (Thunderboard-Labs, Shop.this). Private repos that 404 unauthenticated
 * (Agent-Forge, Graph-Forge, not-humans-lab) simply don't render until a token with
 * access is configured — by design (render only what resolves). Casing matches the
 * canonical GitHub repo name.
 */
export const REPO_ALLOWLIST: readonly string[] = [
  "ag-bash",
  "Agent-Forge",
  "CommandVault",
  "ContextOS",
  "Graph-Forge",
  "gRPC-micro-services",
  "MindForge",
  "not-humans-lab",
  "Thunderboard-Labs",
  "Shop.this",
] as const;

/** The slice of the GitHub repo payload we render — nothing more. */
export type GithubRepo = {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  pushedAt: string;
};

type RawRepo = {
  full_name?: unknown;
  html_url?: unknown;
  description?: unknown;
  language?: unknown;
  stargazers_count?: unknown;
  forks_count?: unknown;
  pushed_at?: unknown;
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/** Normalize a raw GitHub repo into our render shape; null if it lacks essentials. */
function normalize(name: string, raw: RawRepo): GithubRepo | null {
  const url = str(raw.html_url);
  const fullName = str(raw.full_name);
  if (!url || !fullName) return null;
  return {
    name,
    fullName,
    url,
    description: str(raw.description),
    language: str(raw.language),
    stars: num(raw.stargazers_count),
    forks: num(raw.forks_count),
    pushedAt: typeof raw.pushed_at === "string" ? raw.pushed_at : "",
  };
}

/** Auth + content headers. The token is optional — absent => unauthenticated. */
function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Fetch one repo; null on any non-200 / parse failure (fail-open per repo). */
async function fetchRepo(owner: string, name: string): Promise<GithubRepo | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${name}`, {
      headers: headers(),
      // ISR data cache: refetched at most once/hour, in lockstep with the page.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null; // 404 (private/renamed), 403 (rate-limit), etc. — drop it.
    const raw = (await res.json()) as RawRepo;
    return normalize(name, raw);
  } catch {
    return null; // network error — degrade, never throw into the page render.
  }
}

/**
 * Resolve the allowlist into render-ready repo cards, newest-push first.
 * Returns [] on total failure (e.g. all rate-limited) — the feed just hides.
 */
export async function getRepoFeed(): Promise<GithubRepo[]> {
  const owner = profile.githubUser;
  const results = await Promise.all(REPO_ALLOWLIST.map((name) => fetchRepo(owner, name)));
  return results
    .filter((r): r is GithubRepo => r !== null)
    .sort((a, b) => (a.pushedAt < b.pushedAt ? 1 : -1));
}
