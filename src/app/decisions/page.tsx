"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { allDecisions, type LedgerEntry } from "@/lib/decisions";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";

const CATEGORY_OPTIONS: {
  value: "all" | LedgerEntry["sourceKind"];
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "work", label: "Professional" },
  { value: "project", label: "Open Source" },
];

export default function DecisionsPage() {
  const [activeCategory, setActiveCategory] = useState<
    "all" | LedgerEntry["sourceKind"]
  >("all");
  const [activeTag, setActiveTag] = useState<"all" | string>("all");

  // Category is the coarse, mutually-exclusive dimension (radio semantics) — filtered
  // first. Tags are freeform and only make sense scoped to whatever category is active,
  // since Work entries never carry tags (decisions.ts) and would otherwise always read
  // as "untagged" noise in a combined list.
  const byCategory = useMemo(
    () =>
      activeCategory === "all"
        ? allDecisions
        : allDecisions.filter((e) => e.sourceKind === activeCategory),
    [activeCategory],
  );

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of byCategory) for (const t of e.tags) set.add(t);
    return ["all", ...[...set].sort()];
  }, [byCategory]);

  const filtered =
    activeTag === "all"
      ? byCategory
      : byCategory.filter((e) => e.tags.includes(activeTag));

  return (
    <main className="flex-1">
      <Section
        label={`// decisions — ${allDecisions.length} entries`}
        title="Decisions"
        titleAs="h1"
      >
        <p className="max-w-2xl text-fg-muted">
          Real architecture and engineering tradeoffs from across my production
          work and open-source projects — the choice made, the alternative
          considered, and the cost actually paid. Every entry links back to the
          project or case study it came from.
        </p>

        <Reveal className="mt-8">
          <div
            role="radiogroup"
            aria-label="Filter decisions by category"
            className="inline-flex items-center rounded-lg border border-border-strong bg-bg-surface/80 p-0.5 backdrop-blur gap-0.5"
          >
            {CATEGORY_OPTIONS.map((opt) => {
              const active = activeCategory === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setActiveCategory(opt.value);
                    setActiveTag("all");
                  }}
                  className={[
                    "relative inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base",
                    active ? "text-bg-base" : "text-fg-muted hover:text-fg",
                  ].join(" ")}
                >
                  {active && (
                    <motion.span
                      layoutId="decisions-category-segment"
                      aria-hidden="true"
                      className="absolute inset-0 z-0 rounded-md bg-accent"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </Reveal>

        {tagOptions.length > 2 && (
          <Reveal className="mt-3">
            <div className="relative">
              <div
                className="w-full overflow-x-auto overscroll-x-contain scrollbar-hide"
                style={{ WebkitOverflowScrolling: "touch" }}
                tabIndex={0}
              >
                <div
                  role="group"
                  aria-label="Filter decisions by tag"
                  className="inline-flex items-center rounded-full border border-border bg-bg-surface/80 p-0.5 backdrop-blur gap-0.5"
                >
                  {tagOptions.map((opt) => {
                    const active = activeTag === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setActiveTag(opt)}
                        aria-pressed={active}
                        className={[
                          "relative inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base",
                          active
                            ? "text-bg-base"
                            : "text-fg-muted hover:text-fg",
                        ].join(" ")}
                      >
                        {active && (
                          <motion.span
                            layoutId="decisions-filter-pill"
                            aria-hidden="true"
                            className="absolute inset-0 z-0 rounded-full bg-accent"
                            transition={{
                              type: "spring",
                              stiffness: 420,
                              damping: 34,
                            }}
                          />
                        )}
                        <span className="relative z-10">
                          {opt === "all" ? "All tags" : opt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Scroll-affordance fade, mirroring the chat composer's chip-rail pattern —
                  a sibling of the scrolling row (not a descendant) so it stays pinned to the edge. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg-surface via-bg-surface/85 via-45% to-transparent"
              />
            </div>
          </Reveal>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {filtered.map((e) => (
            <Reveal key={e.id}>
              <Link
                href={e.href}
                className="card-surface group flex h-full flex-col p-5"
              >
                <p className="mono-label text-fg-subtle">{e.sourceName}</p>
                <h2 className="mt-2 text-base font-semibold tracking-tight">
                  {e.title}
                </h2>
                <p className="mt-2 flex-1 text-sm text-fg-muted">{e.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs text-accent">
                  View source <ArrowUpRight size={13} aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-8 text-sm text-fg-subtle">
            No decisions found for this filter.
          </p>
        )}
      </Section>
    </main>
  );
}
