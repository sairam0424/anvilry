"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Github } from "@/components/icons";
import { kindColor } from "@/lib/graph-data";
import { dossierFor, type QuestNode } from "@/lib/game-model";
import { unlock } from "@/lib/discovery-store";

/**
 * A "dossier" card for one system in the gamified index. Every value is derived
 * from canonical content via dossierFor (real metrics, honest register — NO XP /
 * scores). The accent rail uses the node's visual kind color, tying the DOM index
 * to the 3D graph. The whole card deep-links into the Classic /work|/projects page
 * (reusing Classic as the reading surface — never a re-skinned clone).
 */
export function DossierCard({ node }: { node: QuestNode }) {
  const d = dossierFor(node);
  const color = kindColor[node.visualKind];

  return (
    <div className="card-surface group relative flex flex-col overflow-hidden p-5">
      {/* Kind-color accent rail (matches the 3D node color). */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />

      <div className="flex items-start justify-between gap-3">
        <Link
          href={d.href}
          className="text-base font-semibold tracking-tight hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {d.name}
        </Link>
        {d.repo && (
          <a
            href={d.repo}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${d.name} on GitHub`}
            className="shrink-0 text-fg-subtle transition-colors hover:text-accent"
          >
            <Github size={16} />
          </a>
        )}
      </div>

      {d.register && <p className="mono-label mt-1">{d.register}</p>}
      <p className="mt-1 text-sm text-fg-muted">{d.subtitle}</p>
      <p className="mt-2 line-clamp-2 text-sm text-fg-subtle">{d.blurb}</p>

      {d.facts.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {d.facts.map((f) => (
            <div key={f.label}>
              <dt className="font-mono text-sm font-semibold text-fg">{f.value}</dt>
              <dd className="text-[11px] text-fg-subtle">{f.label}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {d.tech.slice(0, 5).map((t) => (
          <span key={t} className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted">
            {t}
          </span>
        ))}
      </div>

      <Link
        href={d.href}
        onClick={() => unlock("dossier-open")}
        className="mt-4 inline-flex items-center gap-1 self-start text-xs font-medium text-fg-muted transition-colors group-hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Open dossier <ArrowUpRight size={13} />
      </Link>
    </div>
  );
}
