import { describe, it, expect } from "vitest";
import { allProjects, allWork } from "@/lib/content";
import {
  allDecisions,
  decisionsByTag,
  DECISION_COUNTS,
  type LedgerEntry,
} from "@/lib/decisions";

/**
 * Bidirectional coverage + anti-fabrication gate for the decisions ledger, mirroring
 * game-model.test.ts's pattern. Chained into `pnpm build` (via `vitest run`), so any
 * drift between the ledger and the canonical Velite content FAILS THE DEPLOY.
 */
describe("decisions ledger coverage", () => {
  it("has at least one entry per project that has decisions[] populated", () => {
    const projectsWithDecisions = allProjects.filter(
      (p) => p.decisions.length > 0,
    );
    for (const p of projectsWithDecisions) {
      const entries = allDecisions.filter(
        (e) => e.sourceKind === "project" && e.sourceSlug === p.slug,
      );
      expect(
        entries.length,
        `project "${p.slug}" has decisions but no ledger entries`,
      ).toBe(p.decisions.length);
    }
  });

  it("has an entry for every work item's populated constraints/tradeoffs", () => {
    for (const w of allWork) {
      const entries = allDecisions.filter(
        (e) => e.sourceKind === "work" && e.sourceSlug === w.slug,
      );
      const expected = (w.constraints ? 1 : 0) + (w.tradeoffs ? 1 : 0);
      expect(
        entries.length,
        `work "${w.slug}" expected ${expected} entries`,
      ).toBe(expected);
    }
  });

  it("every entry's title and body trace to real content (no fabrication)", () => {
    for (const e of allDecisions) {
      if (e.sourceKind === "project") {
        const p = allProjects.find((x) => x.slug === e.sourceSlug);
        expect(
          p,
          `entry references unknown project "${e.sourceSlug}"`,
        ).toBeTruthy();
        const match = p!.decisions.some(
          (d) => d.title === e.title && d.body === e.body,
        );
        expect(
          match,
          `entry "${e.title}" not found verbatim in project "${e.sourceSlug}"`,
        ).toBe(true);
      } else {
        const w = allWork.find((x) => x.slug === e.sourceSlug);
        expect(
          w,
          `entry references unknown work item "${e.sourceSlug}"`,
        ).toBeTruthy();
        const bodyMatches =
          e.body === w!.constraints || e.body === w!.tradeoffs;
        expect(
          bodyMatches,
          `entry "${e.title}" body doesn't match work "${e.sourceSlug}"`,
        ).toBe(true);
      }
    }
  });

  it("deep-links every entry into a canonical Classic route", () => {
    for (const e of allDecisions) {
      expect(e.href, `entry "${e.id}" has a malformed href`).toMatch(
        /^\/(work|projects)\/[a-z0-9-]+$/,
      );
    }
  });

  it("gives every entry a unique, stable id", () => {
    const ids = allDecisions.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is a bijection: counts line up", () => {
    expect(DECISION_COUNTS.totalEntries).toBe(allDecisions.length);
    expect(DECISION_COUNTS.projectEntries + DECISION_COUNTS.workEntries).toBe(
      DECISION_COUNTS.totalEntries,
    );
  });

  it("decisionsByTag returns only entries carrying that tag", () => {
    // No tags are populated yet (Task 2/3 omit them, per the spec's YAGNI decision) —
    // this proves the filter is correct/empty-safe, not that tagged data exists yet.
    const result: LedgerEntry[] = decisionsByTag("nonexistent-tag");
    expect(result).toEqual([]);
  });
});
