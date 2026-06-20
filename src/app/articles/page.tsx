"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, ArrowUpRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { allArticles, inkforgeArticles } from "@/lib/content";
import { INKFORGE_ARTICLES_ENABLED } from "@/lib/writing-flags";
import { ArticleCard } from "@/components/article-card";
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

function resolveHref(a: (typeof allArticles)[number]): { href: string; external: boolean } {
  if (a.linkedNote) return { href: `/notes/${a.linkedNote}`, external: false };
  if (a.source !== "native" && a.externalUrl) return { href: a.externalUrl, external: true };
  return { href: a.url, external: false };
}

const ALL_SOURCES = ["medium", "substack", "linkedin", "native"] as const;

const SOURCE_LABELS: Record<ArticleSource, string> = {
  medium: "Medium",
  substack: "Substack",
  linkedin: "LinkedIn",
  native: "Essay",
};

// When flag off, generated section is hidden — show only published count in label.
const visibleInkforge = INKFORGE_ARTICLES_ENABLED ? inkforgeArticles : [];
const totalCount = allArticles.length + visibleInkforge.length;

export default function ArticlesPage() {
  if (allArticles.length === 0) notFound();

  // Derive available sources from actual articles (only show tabs that have content)
  const presentSources = ALL_SOURCES.filter((s) => allArticles.some((a) => a.source === s));
  const filterOptions: ("all" | ArticleSource)[] = ["all", ...presentSources];

  const [activeFilter, setActiveFilter] = useState<"all" | ArticleSource>("all");

  const [featured, ...rest] = allArticles;
  const featuredHref = featured ? resolveHref(featured) : null;

  const filteredRest = rest.filter(
    (a) => activeFilter === "all" || a.source === activeFilter,
  );

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

        {/* ── Syndicated articles (curator model) ─────────────────────── */}
        {allArticles.length > 0 && (
          <>
            {visibleInkforge.length > 0 && (
              <Reveal className="mb-6">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase tracking-widest text-fg-muted">
                    Published
                  </span>
                  <span className="font-mono text-xs text-fg-subtle">
                    — {allArticles.length} article{allArticles.length !== 1 ? "s" : ""} on Medium, Substack &amp; more
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
            {featured && featuredHref && (activeFilter === "all" || featured.source === activeFilter) && (
              <Reveal>
                <motion.div
                  whileHover={{ scale: 1.008, boxShadow: "var(--glow-accent)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="card-surface group mb-8"
                >
                  <Link
                    href={featuredHref.href}
                    {...(featuredHref.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex flex-col gap-4 p-7 sm:p-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset rounded-[inherit]"
                  >
                    {/* hero meta row */}
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-[11px] uppercase tracking-widest text-accent">Featured</span>
                      <PlatformBadge source={featured.source} />
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
                        {featuredHref.external ? "Read article" : "Read note"}
                        <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              </Reveal>
            )}

            {/* ── 2-col grid ──────────────────────────────────────────────── */}
            <AnimatePresence mode="popLayout">
              {filteredRest.length > 0 && (
                <motion.div
                  layout
                  className="grid gap-5 sm:grid-cols-2"
                >
                  {filteredRest.map((a, i) => (
                    <Reveal key={a.slug} delay={(i % 2) * 0.06}>
                      <ArticleCard article={a} />
                    </Reveal>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* empty state when filter yields nothing */}
            <AnimatePresence>
              {filteredRest.length === 0 && activeFilter !== "all" && (
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

        {/* empty state when both collections are empty (should not reach here due to notFound above) */}
        {totalCount === 0 && (
          <p className="font-mono text-sm text-fg-subtle">No articles yet — come back soon.</p>
        )}

      </Section>
    </main>
  );
}
