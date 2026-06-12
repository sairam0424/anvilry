import { describe, it, expect } from "vitest";
import { allProjects, allWork } from "@/lib/content";
import { graphNodes } from "@/lib/graph-data";
import {
  NODE_CONTENT,
  resolveNode,
  questNodes,
  questGroups,
  dossierFor,
  CONTENT_COUNTS,
} from "@/lib/game-model";

/**
 * Bidirectional coverage + anti-fabrication gate for the gamified content layer.
 * Chained into `pnpm build` (via `vitest run`), so any drift between the graph,
 * the nodeId->slug map, and the canonical Velite content FAILS THE DEPLOY — the
 * "every node opens a real card" promise is a build assertion, not a hope.
 *
 * Imports the REAL shipping modules (game-model + .velite output), never a copy.
 */
describe("game-model coverage", () => {
  it("maps every graph node id (no node left unmapped)", () => {
    const unmapped = graphNodes.filter((n) => !(n.id in NODE_CONTENT));
    expect(unmapped.map((n) => n.id)).toEqual([]);
  });

  it("resolves every graph node to a real content item (forward coverage)", () => {
    const broken = graphNodes.filter((n) => resolveNode(n.id) === null);
    expect(broken.map((n) => n.id)).toEqual([]);
    // questNodes drops unresolved nodes, so a full graph means a full quest set.
    expect(questNodes).toHaveLength(graphNodes.length);
  });

  it("points every node at a slug that actually exists in Velite", () => {
    for (const [nodeId, ref] of Object.entries(NODE_CONTENT)) {
      const pool = ref.kind === "work" ? allWork : allProjects;
      const hit = pool.find((c) => c.slug === ref.slug);
      expect(hit, `node "${nodeId}" -> ${ref.kind}:${ref.slug} not found in Velite`).toBeTruthy();
    }
  });

  it("covers every content item with a graph node (reverse coverage)", () => {
    const mappedWork = new Set(
      Object.values(NODE_CONTENT).filter((r) => r.kind === "work").map((r) => r.slug),
    );
    const mappedProjects = new Set(
      Object.values(NODE_CONTENT).filter((r) => r.kind === "project").map((r) => r.slug),
    );
    const orphanWork = allWork.filter((w) => !mappedWork.has(w.slug)).map((w) => w.slug);
    const orphanProjects = allProjects.filter((p) => !mappedProjects.has(p.slug)).map((p) => p.slug);
    expect(orphanWork, "work items not reachable in the gamified view").toEqual([]);
    expect(orphanProjects, "projects not reachable in the gamified view").toEqual([]);
  });

  it("is a bijection between nodes and content (counts line up)", () => {
    expect(CONTENT_COUNTS.nodes).toBe(CONTENT_COUNTS.quests);
    expect(CONTENT_COUNTS.work + CONTENT_COUNTS.projects).toBe(CONTENT_COUNTS.nodes);
  });

  it("deep-links every quest node into a canonical Classic route", () => {
    for (const n of questNodes) {
      expect(n.href, `node "${n.id}" has a malformed href`).toMatch(/^\/(work|projects)\/[a-z0-9-]+$/);
    }
  });

  it("groups every quest node exactly once (no loss, no dup)", () => {
    const grouped = questGroups().flatMap((g) => g.nodes.map((n) => n.id));
    expect(grouped.sort()).toEqual(questNodes.map((n) => n.id).sort());
  });
});

describe("game-model anti-fabrication", () => {
  it("dossier facts trace to real content values (no invented metrics)", () => {
    for (const n of questNodes) {
      const d = dossierFor(n);
      if (n.resolved.kind === "work") {
        const w = n.resolved.item;
        // Every fact must be one of the work's real metrics (value+label verbatim).
        for (const f of d.facts) {
          const match = w.metrics.some((m) => m.value === f.value && m.label === f.label);
          expect(match, `work "${n.id}" dossier fact "${f.value} ${f.label}" is not a real metric`).toBe(true);
        }
        expect(d.register).toBe(w.register); // honest register passed through verbatim
        expect(d.blurb).toBe(w.summary);
      } else {
        const p = n.resolved.item;
        expect(d.blurb).toBe(p.excerpt);
        // Project facts are derived counts only (commits, tech count) — assert they
        // equal the real source, never an invented number.
        const techFact = d.facts.find((f) => f.label === "technologies");
        expect(techFact?.value).toBe(`${p.tech.length}`);
        if (p.commits != null) {
          const commitFact = d.facts.find((f) => f.label === "commits");
          expect(commitFact?.value).toBe(`${p.commits}`);
        }
      }
      // Dossier name/subtitle/tech must be the content's own, not synthesized.
      expect(d.name).toBe(n.resolved.item.name);
    }
  });
});
