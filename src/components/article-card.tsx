"use client";

import Link from "next/link";
import { ExternalLink, Clock } from "lucide-react";
import { motion } from "motion/react";
import type { Article } from "@/lib/content";
import { PlatformBadge } from "@/components/platform-badge";

/** Absolute, human-readable date (UTC; no relative drift). */
function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function resolveHref(a: Article): { href: string; external: boolean } {
  if (a.linkedNote) return { href: `/notes/${a.linkedNote}`, external: false };
  if (a.source !== "native" && a.externalUrl) return { href: a.externalUrl, external: true };
  return { href: a.url, external: false };
}

export function ArticleCard({ article }: { article: Article }) {
  const { href, external } = resolveHref(article);

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
        {/* header row: platform badge + date */}
        <div className="flex items-center justify-between gap-3">
          <PlatformBadge source={article.source} />
          <span className="shrink-0 font-mono text-[11px] text-fg-subtle">{fmt(article.date)}</span>
        </div>

        {/* title */}
        <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-fg transition-colors group-hover:text-accent">
          {article.title}
        </h3>

        {/* summary */}
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-fg-muted">{article.summary}</p>

        {/* footer: tags + reading time + external arrow */}
        <div className="mt-4 flex items-end justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap gap-1">
            {article.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted">
                {t}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] text-fg-subtle">
            {article.readingTime && (
              <span className="inline-flex items-center gap-1">
                <Clock size={11} aria-hidden="true" />
                {article.readingTime} min
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
