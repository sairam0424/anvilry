import Link from "next/link";
import { ArrowUpRight, GitCommitHorizontal } from "lucide-react";
import { Github } from "@/components/icons";
import type { CardSegment } from "@/components/chat/parse-cards";

/**
 * Compact inline card rendered when the model emits a [[card:...]] intent token.
 * ALL fields come from resolved Velite content (the slug allowlist) — never from
 * model output — so the card cannot show fabricated data and the deep-link href is
 * server-sourced. Mirrors the Classic project/work card styling at a smaller scale.
 */
export function ChatCard({ segment }: { segment: Extract<CardSegment, { type: "project" | "work" }> }) {
  if (segment.type === "project") {
    const p = segment.project;
    return (
      <div className="card-surface group my-3 flex flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={p.url} className="text-base font-semibold tracking-tight hover:text-accent">
            {p.name}
          </Link>
          <a
            href={p.repo}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${p.name} on GitHub`}
            className="shrink-0 text-fg-subtle transition-colors hover:text-accent"
          >
            <Github size={16} />
          </a>
        </div>
        <p className="mt-1 text-sm text-fg-muted">{p.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.tech.slice(0, 5).map((t) => (
            <span key={t} className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted">
              {t}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          {p.commits != null ? (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-fg-subtle">
              <GitCommitHorizontal size={13} />
              {p.commits.toLocaleString()} commits
            </span>
          ) : (
            <span className="font-mono text-[11px] text-fg-subtle">{p.group}</span>
          )}
          <Link
            href={p.url}
            className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted transition-colors group-hover:text-accent"
          >
            Details <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  const w = segment.work;
  return (
    <Link href={w.url} className="card-surface group my-3 flex flex-col p-4 transition-colors">
      <div className="flex items-center justify-between">
        <span className="mono-label">{w.register}</span>
        <ArrowUpRight size={16} className="text-fg-subtle transition-colors group-hover:text-accent" />
      </div>
      <h3 className="mt-2 text-base font-semibold tracking-tight group-hover:text-accent">{w.name}</h3>
      <p className="mt-1 text-sm text-fg-muted">{w.summary}</p>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3">
        {w.metrics.map((m) => (
          <div key={m.label}>
            <dt className="text-base font-semibold text-accent">{m.value}</dt>
            <dd className="text-[11px] text-fg-subtle">{m.label}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}
