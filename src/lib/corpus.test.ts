import { describe, it, expect } from "vitest";
import { buildCorpus } from "./corpus";
import { allProjects } from "./content";
import { hasPersonalContent, hasNow } from "./personal";
import { profile } from "./profile";

/**
 * The chat grounding corpus. It must always carry the professional record, and include
 * the "Personal" section ONLY when the owner has populated personal.ts — so an
 * unpopulated portfolio's concierge behaves exactly as today (and never fabricates a
 * personal answer).
 */
describe("buildCorpus", () => {
  it("lists a private project without its repo URL, so the concierge never sends a visitor to a 404", () => {
    const c = buildCorpus();
    for (const p of allProjects.filter((x) => x.visibility === "private")) {
      expect(c, `${p.name} must stay in the corpus`).toContain(`### ${p.name}`);
      expect(c, `${p.name}'s private repo URL leaked into the corpus`).not.toContain(p.repo);
      expect(c).toContain("Repo: private repository");
    }
    for (const p of allProjects.filter((x) => x.visibility !== "private")) {
      expect(c).toContain(`Repo: ${p.repo}`);
    }
  });

  it("always includes the professional record", () => {
    const c = buildCorpus();
    expect(c).toContain(profile.name);
    expect(c).toContain("## Production Work");
    expect(c).toContain("## Skills");
  });

  it("includes the Personal section IFF personal.ts is populated (empty-safe)", () => {
    const c = buildCorpus();
    if (hasPersonalContent || hasNow) {
      expect(c).toContain("## Personal");
    } else {
      // Unpopulated → no Personal section leaks into the corpus.
      expect(c).not.toContain("## Personal");
    }
  });
});
