"use client";

import Link from "next/link";
import { ExternalLink, Clock } from "lucide-react";
import { motion } from "motion/react";
import type { ArticleGroup } from "@/lib/article-grouping";
import { PlatformBadge } from "@/components/platform-badge";
import { NOTES_ENABLED } from "@/lib/writing-flags";

/** Absolute, human-readable date (UTC). */
function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function resolveCanonicalHref(group: ArticleGroup): { href: string; external: boolean } {
  const { canonical } = group;
  // Only route to /notes when the notes section is enabled — otherwise fall
  // through to externalUrl so the article opens on its original platform.
  if (canonical.linkedNote && NOTES_ENABLED)
    return { href: `/notes/${canonical.linkedNote}`, external: false };
  if (canonical.externalUrl) return { href: canonical.externalUrl, external: true };
  return { href: canonical.url, external: false };
}

export function ArticleGroupCard({ group }: { group: ArticleGroup }) {
  const { canonical, externalPlatforms } = group;
  const { href, external } = resolveCanonicalHref(group);
  const isMultiPlatform = externalPlatforms.length > 0;

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.015, boxShadow: "var(--glow-accent)" }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="card-surface group h-full"
    >
      <Link
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="flex h-full flex-col p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset rounded-[inherit]"
      >
        {/* Platform badges row + date */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Primary platform badge — always shown */}
            <PlatformBadge source={canonical.source} />

            {/* Secondary platform badges — buttons (not <a>) to avoid nested anchor invalid HTML */}
            {isMultiPlatform && (
              <>
                <span className="font-mono text-[10px] text-fg-subtle">also on</span>
                {externalPlatforms.map((p) => (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      window.open(p.externalUrl ?? p.url, "_blank", "noopener,noreferrer");
                    }}
                    aria-label={`Read on ${p.source}`}
                    className="cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-full"
                  >
                    <PlatformBadge source={p.source} />
                  </button>
                ))}
              </>
            )}
          </div>
          <span className="shrink-0 font-mono text-[11px] text-fg-subtle">{fmt(canonical.date)}</span>
        </div>

        {/* Title */}
        <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-fg transition-colors group-hover:text-accent">
          {canonical.title}
        </h3>

        {/* Summary */}
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-fg-muted">{canonical.summary}</p>

        {/* Footer: tags + reading time + external icon */}
        <div className="mt-4 flex items-end justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap gap-1">
            {canonical.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted">
                {t}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-fg-subtle">
            {canonical.readingTime && (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} aria-hidden="true" />
                {canonical.readingTime} min
              </span>
            )}
            <ExternalLink
              size={12}
              className="text-fg-subtle opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
              aria-hidden="true"
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
