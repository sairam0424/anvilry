"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { allDecisions } from "@/lib/decisions";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";

export default function DecisionsPage() {
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of allDecisions) for (const t of e.tags) set.add(t);
    return [...set].sort();
  }, []);

  const [activeTag, setActiveTag] = useState<"all" | string>("all");
  const filterOptions: ("all" | string)[] = ["all", ...allTags];

  const filtered =
    activeTag === "all"
      ? allDecisions
      : allDecisions.filter((e) => e.tags.includes(activeTag));

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

        {filterOptions.length > 2 && (
          <Reveal className="mb-10 mt-8">
            <div
              className="w-full overflow-x-auto overscroll-x-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div
                role="group"
                aria-label="Filter decisions by tag"
                className="inline-flex items-center rounded-full border border-border bg-bg-surface/80 p-0.5 backdrop-blur gap-0.5"
              >
                {filterOptions.map((opt) => {
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
                        active ? "text-bg-base" : "text-fg-muted hover:text-fg",
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
                        {opt === "all" ? "All" : opt}
                      </span>
                    </button>
                  );
                })}
              </div>
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
            No decisions tagged &ldquo;{activeTag}&rdquo;.
          </p>
        )}
      </Section>
    </main>
  );
}
