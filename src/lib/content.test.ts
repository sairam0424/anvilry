import { describe, it, expect } from "vitest";
import {
  allProjects,
  featuredProjects,
  pinnedProjects,
  projectGroups,
  projectsByGroup,
  publicProjects,
  repoLink,
  type Project,
} from "@/lib/content";

/**
 * Invariants of the project collection that the pages, the chat corpus, the MCP tools and the
 * résumé JSON all rely on. Chained into `pnpm build` (vitest run), so a card that breaks one of
 * these fails the deploy instead of shipping a dead link or a card that no page lists.
 */
describe("projectGroups", () => {
  it("lists the four groups, the platform group first", () => {
    expect([...projectGroups]).toEqual([
      "Platform, Guardrails & Observability",
      "Agent Frameworks & Infrastructure",
      "Code Intelligence & Engines",
      "Tooling & Lab",
    ]);
  });

  it("places every project in exactly one group, so none is missing from /projects", () => {
    const placed = projectsByGroup().flatMap((g) => g.items.map((p) => p.slug));
    expect([...placed].sort()).toEqual(allProjects.map((p) => p.slug).sort());
  });

  it("leaves no group empty (an empty heading on /projects would look broken)", () => {
    for (const g of projectsByGroup()) {
      expect(g.items.length, `group "${g.group}" has no project`).toBeGreaterThan(0);
    }
  });
});

describe("repoLink and private repositories", () => {
  const base = allProjects[0];

  it("returns the repo URL for a public project", () => {
    const p = { ...base, visibility: "public", repo: "https://github.com/o/r" } as Project;
    expect(repoLink(p)).toBe("https://github.com/o/r");
  });

  it("returns null for a private project, so no surface links to a page that 404s", () => {
    const p = { ...base, visibility: "private", repo: "https://github.com/o/r" } as Project;
    expect(repoLink(p)).toBeNull();
  });

  it("treats a project as public unless it says otherwise", () => {
    const withoutField = { ...base, repo: "https://github.com/o/r" } as Project;
    delete (withoutField as { visibility?: string }).visibility;
    expect(repoLink(withoutField)).toBe("https://github.com/o/r");
  });

  it("publicProjects is allProjects minus the private ones", () => {
    const privateSlugs = allProjects.filter((p) => p.visibility === "private").map((p) => p.slug);
    expect(publicProjects.length + privateSlugs.length).toBe(allProjects.length);
    expect(publicProjects.some((p) => privateSlugs.includes(p.slug))).toBe(false);
  });

  it("never features a private project (its repo link would 404 on the home page)", () => {
    expect(featuredProjects.filter((p) => p.visibility === "private")).toEqual([]);
  });

  it("omits dateCreated and license for a private project (nothing unauthenticated to verify)", () => {
    for (const p of allProjects.filter((x) => x.visibility === "private")) {
      expect(p.dateCreated, `${p.slug} is private but carries dateCreated`).toBeUndefined();
      expect(p.license, `${p.slug} is private but carries license`).toBeUndefined();
    }
  });
});

describe("ordering", () => {
  it("gives every project its own order, so the home list and /projects have one stable order", () => {
    const orders = allProjects.map((p) => p.order);
    expect(new Set(orders).size, "two projects share an order value").toBe(orders.length);
  });

  it("lists featured projects in ascending order", () => {
    const orders = featuredProjects.map((p) => p.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
});

describe("pins", () => {
  it("gives every pinned project a rank and every rank to one project only", () => {
    const pinned = allProjects.filter((p) => p.pinned);
    for (const p of pinned) expect(p.pinRank, `${p.slug} is pinned without a pinRank`).toBeTypeOf("number");
    const ranks = pinned.map((p) => p.pinRank);
    expect(new Set(ranks).size, "two pinned projects share a pinRank").toBe(ranks.length);
  });

  it("leaves an unpinned project without a rank (a stray rank would silently never show)", () => {
    for (const p of allProjects.filter((x) => !x.pinned)) {
      expect(p.pinRank, `${p.slug} carries pinRank ${p.pinRank} but is not pinned`).toBeUndefined();
    }
  });

  it("exposes the pinned projects in rank order", () => {
    const ranks = pinnedProjects.map((p) => p.pinRank ?? 99);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(pinnedProjects.length).toBe(allProjects.filter((p) => p.pinned).length);
  });
});
