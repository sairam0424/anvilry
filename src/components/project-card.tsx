import Link from "next/link";
import { ArrowUpRight, GitCommitHorizontal } from "lucide-react";
import { Github } from "@/components/icons";
import type { Project } from "@/lib/content";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="card-surface group flex flex-col p-5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <Link href={project.url} className="text-lg font-semibold tracking-tight hover:text-accent">
          {project.name}
        </Link>
        <a
          href={project.repo}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${project.name} on GitHub`}
          className="shrink-0 text-fg-subtle transition-colors hover:text-accent"
        >
          <Github size={18} />
        </a>
      </div>

      <p className="mt-2 text-sm text-fg-muted">{project.tagline}</p>
      <p className="mt-3 line-clamp-3 text-sm text-fg-subtle">{project.excerpt}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {project.tech.slice(0, 5).map((t) => (
          <span
            key={t}
            className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        {project.commits != null ? (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-fg-subtle">
            <GitCommitHorizontal size={13} />
            {project.commits.toLocaleString()} commits
          </span>
        ) : (
          <span className="font-mono text-[11px] text-fg-subtle">{project.group}</span>
        )}
        <Link
          href={project.url}
          className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted transition-colors group-hover:text-accent"
        >
          Details <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  );
}
