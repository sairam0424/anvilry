import { Star, GitFork } from "lucide-react";
import type { GithubRepo } from "@/lib/github";

/**
 * First-party GitHub repo feed (server-rendered from getRepoFeed()). Replaces the
 * external github-readme-stats <img> cards: no third-party request in the visitor's
 * path, no "Something went wrong" card, and the data is ISR-cached with the page.
 *
 * Empty-safe: with no resolved repos (token unset + all private, or rate-limited at
 * build) the whole section renders nothing — never an error or an empty shell.
 */

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago" from an ISO timestamp; "" if unparseable (hidden). */
function pushedAgo(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffDays = Math.round((then - Date.now()) / 86_400_000);
  if (diffDays <= -365) return RELATIVE.format(Math.round(diffDays / 365), "year");
  if (diffDays <= -30) return RELATIVE.format(Math.round(diffDays / 30), "month");
  if (diffDays <= -7) return RELATIVE.format(Math.round(diffDays / 7), "week");
  return RELATIVE.format(diffDays, "day");
}

export function GithubFeed({ repos }: { repos: GithubRepo[] }) {
  if (repos.length === 0) return null;

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {repos.map((r) => {
        const ago = pushedAgo(r.pushedAt);
        return (
          <li key={r.fullName}>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-surface flex h-full flex-col gap-2 p-4 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm font-medium text-fg">{r.name}</span>
                <span className="flex items-center gap-3 font-mono text-xs text-fg-subtle">
                  <span className="inline-flex items-center gap-1">
                    <Star size={12} aria-hidden="true" />
                    <span className="sr-only">Stars: </span>
                    {r.stars}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GitFork size={12} aria-hidden="true" />
                    <span className="sr-only">Forks: </span>
                    {r.forks}
                  </span>
                </span>
              </div>
              {r.description && (
                <p className="line-clamp-2 text-sm text-fg-muted">{r.description}</p>
              )}
              <div className="mt-auto flex items-center gap-3 pt-1 font-mono text-[11px] text-fg-subtle">
                {r.language && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
                    {r.language}
                  </span>
                )}
                {ago && <span>updated {ago}</span>}
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
