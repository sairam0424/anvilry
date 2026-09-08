import { allProjects, allWork } from "@/lib/content";

/**
 * Derivation layer that surfaces the architecture-decision narratives already living
 * in project MDX frontmatter (Project.decisions) and work case studies
 * (Work.constraints/Work.tradeoffs) as one flat, typed ledger — zero duplication, zero
 * fabrication. Mirrors the role of src/lib/game-model.ts for the gamified view.
 * decisions.test.ts asserts every entry traces to real content and every populated
 * source field is represented (bidirectional coverage).
 */

export type LedgerEntry = {
  id: string;
  sourceKind: "work" | "project";
  sourceSlug: string;
  sourceName: string;
  title: string;
  body: string;
  tags: string[];
  href: string;
};

const projectEntries: LedgerEntry[] = allProjects.flatMap((p) =>
  p.decisions.map((d, i) => ({
    id: `project:${p.slug}:${i}`,
    sourceKind: "project" as const,
    sourceSlug: p.slug,
    sourceName: p.name,
    title: d.title,
    body: d.body,
    tags: d.tags,
    href: p.url,
  })),
);

const workEntries: LedgerEntry[] = allWork.flatMap((w) => {
  const entries: LedgerEntry[] = [];
  if (w.constraints) {
    entries.push({
      id: `work:${w.slug}:constraints`,
      sourceKind: "work",
      sourceSlug: w.slug,
      sourceName: w.name,
      title: "Constraints",
      body: w.constraints,
      tags: [],
      href: w.url,
    });
  }
  if (w.tradeoffs) {
    entries.push({
      id: `work:${w.slug}:tradeoffs`,
      sourceKind: "work",
      sourceSlug: w.slug,
      sourceName: w.name,
      title: "Tradeoffs",
      body: w.tradeoffs,
      tags: [],
      href: w.url,
    });
  }
  return entries;
});

export const allDecisions: LedgerEntry[] = [...projectEntries, ...workEntries];

export function decisionsByTag(tag: string): LedgerEntry[] {
  return allDecisions.filter((e) => e.tags.includes(tag));
}

/** Sanity counts used by the coverage test (kept here so the test imports one module). */
export const DECISION_COUNTS = {
  projectEntries: projectEntries.length,
  workEntries: workEntries.length,
  totalEntries: allDecisions.length,
};
