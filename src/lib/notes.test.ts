import { describe, it, expect } from "vitest";
import { allNotes, publishedNotes, hasNotes, getNote } from "./content";

/**
 * Notes collection contract: empty-safe (ships dark until posts exist), drafts excluded, newest-first,
 * dates parseable — asserted over `publishedNotes`: `allNotes` is [] while NOTES_ENABLED is off (the CI
 * default), so looping over it would check nothing. hasNotes gates the nav link (no dead "coming soon").
 */
describe("notes collection", () => {
  it("hasNotes reflects published-note count (dark when empty)", () => {
    expect(hasNotes).toBe(allNotes.length > 0);
  });

  it("published notes exclude drafts and sort newest-first with parseable dates", () => {
    for (const n of publishedNotes) {
      expect(n.draft).toBe(false);
      expect(Number.isNaN(new Date(n.date).getTime()), `${n.slug} has an unparseable date`).toBe(false);
    }
    for (let i = 1; i < publishedNotes.length; i++) {
      expect(publishedNotes[i - 1].date >= publishedNotes[i].date, "notes must be newest-first").toBe(true);
    }
  });

  it("getNote resolves a real slug and misses on a fake one", () => {
    if (allNotes.length > 0) {
      expect(getNote(allNotes[0].slug)?.slug).toBe(allNotes[0].slug);
    }
    expect(getNote("definitely-not-a-real-note")).toBeUndefined();
  });
});
