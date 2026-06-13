import { describe, it, expect } from "vitest";
import { buildCorpus } from "./corpus";
import { hasPersonalContent, hasNow } from "./personal";
import { profile } from "./profile";

/**
 * The chat grounding corpus. It must always carry the professional record, and include
 * the "Personal" section ONLY when the owner has populated personal.ts — so an
 * unpopulated portfolio's concierge behaves exactly as today (and never fabricates a
 * personal answer).
 */
describe("buildCorpus", () => {
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
