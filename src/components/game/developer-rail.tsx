"use client";

import { Download, Mail } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile, impactMetrics, resumeVariants } from "@/lib/profile";

/**
 * The Developer view's recruiter rail — a quiet GUI sidebar beside the terminal on lg+
 * that fills the otherwise-wasted horizontal space with NET-NEW, recruiter-first
 * affordances (NOT a re-print of the terminal's boot banner): the verified impact
 * metrics, real résumé downloads, and contact links. All data comes from the single
 * profile source. Rendered as a plain <aside> (a complementary region, not a second
 * landmark that would duplicate the terminal's). On mobile it's hidden by the parent.
 */
export function DeveloperRail() {
  return (
    <aside aria-label="Profile & contact" className="space-y-6 text-sm">
      {/* Verified impact metrics (same single source as the hero strip). */}
      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {impactMetrics.map((m) => (
          <div key={m.sub} className="bg-bg-surface p-3.5">
            <dt className="font-mono text-xl font-semibold text-fg">{m.value}</dt>
            <dd className="mt-0.5 text-xs text-fg-muted">
              {m.label}
              <span className="block text-fg-subtle">{m.sub}</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* Résumé variants — real downloadable PDFs (the #1 recruiter action). */}
      <div>
        <p className="mono-label mb-2">{"// résumé"}</p>
        <ul className="space-y-1.5">
          {resumeVariants.map((r) => (
            <li key={r.file}>
              <a
                href={r.file}
                download
                className="group flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Download size={13} className="shrink-0 text-fg-subtle group-hover:text-accent" aria-hidden="true" />
                <span className="truncate">{r.label}</span>
                <span className="ml-auto shrink-0 text-[10px] text-fg-subtle">{r.tag}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Contact — direct links. */}
      <div>
        <p className="mono-label mb-2">{"// contact"}</p>
        <div className="flex flex-col gap-1.5">
          <a
            href={`mailto:${profile.email}`}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Mail size={13} className="text-accent" aria-hidden="true" /> {profile.email}
          </a>
          <a
            href={profile.links.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub profile"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Github size={13} className="text-accent" /> github.com/{profile.githubUser}
          </a>
          <a
            href={profile.links.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn profile"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Linkedin size={13} className="text-accent" /> linkedin.com/in/{profile.githubUser}
          </a>
        </div>
      </div>
    </aside>
  );
}
