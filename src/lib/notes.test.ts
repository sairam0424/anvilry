import { describe, it, expect } from "vitest";
import { allNotes, hasNotes, getNote } from "./content";

/**
 * Notes collection contract: empty-safe (ships dark until posts exist), drafts excluded,
 * newest-first, dates parseable. The nav link + section gate on hasNotes, so an empty
 * collection must report hasNotes=false (no dead "coming soon" link).
 */
describe("notes collection", () => {
  it("hasNotes reflects published-note count (dark when empty)", () => {
    expect(hasNotes).toBe(allNotes.length > 0);
  });

  it("excludes drafts and sorts newest-first with parseable dates", () => {
    for (const n of allNotes) {
      expect(n.draft).toBe(false);
      expect(Number.isNaN(new Date(n.date).getTime()), `${n.slug} has an unparseable date`).toBe(false);
    }
    for (let i = 1; i < allNotes.length; i++) {
      expect(allNotes[i - 1].date >= allNotes[i].date, "notes must be newest-first").toBe(true);
    }
  });

  it("getNote resolves a real slug and misses on a fake one", () => {
    if (allNotes.length > 0) {
      expect(getNote(allNotes[0].slug)?.slug).toBe(allNotes[0].slug);
    }
    expect(getNote("definitely-not-a-real-note")).toBeUndefined();
  });
});
