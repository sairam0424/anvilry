"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, ArrowUpRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { allArticles, inkforgeArticles } from "@/lib/content";
import { INKFORGE_ARTICLES_ENABLED, NOTES_ENABLED } from "@/lib/writing-flags";
import { groupArticles, getGroupSources, filterGroupsBySource } from "@/lib/article-grouping";
import { ArticleGroupCard } from "@/components/article-group-card";
import { NoteCard } from "@/components/note-card";
import { PlatformBadge, type ArticleSource } from "@/components/platform-badge";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";

/** Absolute, human-readable date (UTC; no relative drift). */
function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

const SOURCE_LABELS: Record<ArticleSource, string> = {
  medium:   "Medium",
  substack: "Substack",
  linkedin: "LinkedIn",
  devto:    "Dev.to",
  hashnode: "Hashnode",
  native:   "Essay",
};

// When flag off, generated section is hidden.
const visibleInkforge = INKFORGE_ARTICLES_ENABLED ? inkforgeArticles : [];

// Deduplicate: group same-content articles published on multiple platforms.
const grouped = groupArticles(allArticles);

export default function ArticlesPage() {
  if (allArticles.length === 0) notFound();

  // Filter bar only shows sources that actually have content in groups.
  const presentSources = getGroupSources(grouped);
  const filterOptions: ("all" | ArticleSource)[] = ["all", ...presentSources];

  const [activeFilter, setActiveFilter] = useState<"all" | ArticleSource>("all");

  const filteredGroups = filterGroupsBySource(grouped, activeFilter);
  const [featuredGroup, ...restGroups] = filteredGroups;
  const featured = featuredGroup?.canonical;

  // Total count = unique article groups + visible inkforge notes
  const totalCount = grouped.length + visibleInkforge.length;

  return (
    <main className="flex-1">
      <Section
        label={`// writing — ${totalCount} article${totalCount !== 1 ? "s" : ""}`}
        title="Articles"
        titleAs="h1"
      >
        {/* ── Inkforge generated notes — hidden by default (flag off) ─── */}
        {visibleInkforge.length > 0 && (
          <Reveal className="mb-12">
            <div className="mb-6 flex items-center gap-2">
              <Sparkles size={14} className="text-accent" aria-hidden="true" />
              <span className="font-mono text-xs uppercase tracking-widest text-accent">
                Generated
              </span>
              <span className="font-mono text-xs text-fg-subtle">
                — {visibleInkforge.length} article{visibleInkforge.length !== 1 ? "s" : ""} via inkforge
              </span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {visibleInkforge.map((note, i) => (
                <Reveal key={note.slug} delay={(i % 2) * 0.06}>
                  <NoteCard note={note} />
                </Reveal>
              ))}
            </div>
          </Reveal>
        )}

        {/* ── Published articles (deduplicated) ───────────────────────── */}
        {grouped.length > 0 && (
          <>
            {visibleInkforge.length > 0 && (
              <Reveal className="mb-6">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-widest text-fg-muted">
                    Published
                  </span>
                  <span className="font-mono text-xs text-fg-subtle">
                    — {grouped.length} article{grouped.length !== 1 ? "s" : ""} on Medium, Substack &amp; more
                  </span>
                </div>
              </Reveal>
            )}

            {/* ── Filter bar ─────────────────────────────────────────────── */}
            {filterOptions.length > 2 && (
              <Reveal className="mb-10">
                <div
                  role="group"
                  aria-label="Filter articles by platform"
                  className="inline-flex items-center rounded-full border border-border bg-bg-surface/80 p-0.5 backdrop-blur gap-0.5"
                >
                  {filterOptions.map((opt) => {
                    const active = activeFilter === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setActiveFilter(opt)}
                        aria-pressed={active}
                        className={[
                          "relative inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base",
                          active ? "text-bg-base" : "text-fg-muted hover:text-fg",
                        ].join(" ")}
                      >
                        {active && (
                          <motion.span
                            layoutId="article-filter-pill"
                            aria-hidden="true"
                            className="absolute inset-0 z-0 rounded-full bg-accent"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                          />
                        )}
                        <span className="relative z-10">
                          {opt === "all" ? "All" : SOURCE_LABELS[opt]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Reveal>
            )}

            {/* ── Featured hero card ──────────────────────────────────────── */}
            {featuredGroup && featured && (activeFilter === "all" || featuredGroup.platforms.some((p) => p.source === activeFilter)) && (
              <Reveal>
                <motion.div
                  whileHover={{ scale: 1.008, boxShadow: "var(--glow-accent)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="card-surface group mb-8"
                >
                  {/* Hero card uses the canonical href */}
                  <Link
                    href={
                      featuredGroup.canonical.linkedNote && NOTES_ENABLED
                        ? `/notes/${featuredGroup.canonical.linkedNote}`
                        : (featuredGroup.canonical.externalUrl
                            ?? featuredGroup.externalPlatforms.find((p) => p.externalUrl)?.externalUrl
                            ?? featuredGroup.canonical.url)
                    }
                    {...(featuredGroup.canonical.source !== "native" && featuredGroup.canonical.externalUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex flex-col gap-4 p-7 sm:p-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset rounded-[inherit]"
                  >
                    {/* hero meta row — all platform badges */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-[11px] uppercase tracking-widest text-accent">Featured</span>
                      <PlatformBadge source={featured.source} />
                      {featuredGroup.externalPlatforms.map((p) => (
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
                      {featured.readingTime && (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-fg-subtle">
                          <Clock size={11} aria-hidden="true" />
                          {featured.readingTime} min read
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[11px] text-fg-subtle">{fmt(featured.date)}</span>
                    </div>

                    {/* title */}
                    <h2 className="text-2xl font-semibold leading-snug tracking-tight text-fg transition-colors group-hover:text-accent sm:text-3xl">
                      {featured.title}
                    </h2>

                    {/* summary */}
                    <p className="text-base text-fg-muted">{featured.summary}</p>

                    {/* footer: tags + CTA */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <div className="flex flex-wrap gap-1.5">
                        {featured.tags.slice(0, 4).map((t: string) => (
                          <span key={t} className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted">
                            {t}
                          </span>
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors group-hover:text-accent">
                        {featuredGroup.canonical.linkedNote && NOTES_ENABLED ? "Read note" : "Read article"}
                        <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              </Reveal>
            )}

            {/* ── 2-col grid of deduplicated group cards ───────────────── */}
            <AnimatePresence mode="popLayout">
              {restGroups.length > 0 && (
                <motion.div layout className="grid gap-5 sm:grid-cols-2">
                  {restGroups.map((group, i) => (
                    <Reveal key={group.canonical.slug} delay={(i % 2) * 0.06}>
                      <ArticleGroupCard group={group} />
                    </Reveal>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* empty state when filter yields no groups */}
            <AnimatePresence>
              {filteredGroups.length === 0 && activeFilter !== "all" && (
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.3 }}
                  className="mt-2 font-mono text-sm text-fg-subtle"
                >
                  No {SOURCE_LABELS[activeFilter as ArticleSource]} articles yet.
                </motion.p>
              )}
            </AnimatePresence>
          </>
        )}
      </Section>
    </main>
  );
}
