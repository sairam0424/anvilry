import { describe, it, expect } from "vitest";
import { personal, now, hasPersonalContent, hasNow } from "./personal";

/**
 * Pins the empty-safe contract: until the owner populates personal.ts, every reveal
 * surface must stay dark — `hasPersonalContent`/`hasNow` are the gates that guarantee
 * "no content" never becomes a fabricated or placeholder output to a recruiter. Also
 * locks the shape so reveal commands can rely on it.
 */
describe("personal content source", () => {
  it("exposes the expected shape (arrays + now object)", () => {
    expect(Array.isArray(personal.hobbies)).toBe(true);
    expect(Array.isArray(personal.funFacts)).toBe(true);
    expect(Array.isArray(personal.currentlyLearning)).toBe(true);
    expect(Array.isArray(personal.askMeAbout)).toBe(true);
    expect(Array.isArray(personal.uses)).toBe(true);
    expect(typeof now.updated).toBe("string");
    expect(Array.isArray(now.focus)).toBe(true);
  });

  it("hasPersonalContent is true IFF at least one content list is non-empty", () => {
    const anyContent =
      personal.hobbies.length > 0 ||
      personal.funFacts.length > 0 ||
      personal.currentlyLearning.length > 0 ||
      personal.askMeAbout.length > 0 ||
      personal.uses.length > 0;
    expect(hasPersonalContent).toBe(anyContent);
  });

  it("hasNow is true IFF now is both dated and non-empty (staleness honesty)", () => {
    expect(hasNow).toBe(now.updated !== "" && now.focus.length > 0);
  });

  it("uses groups (when present) have a label and at least one item", () => {
    for (const g of personal.uses) {
      expect(typeof g.group).toBe("string");
      expect(g.group.length).toBeGreaterThan(0);
      expect(g.items.length).toBeGreaterThan(0);
    }
  });
});
