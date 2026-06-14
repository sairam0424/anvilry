import { describe, it, expect } from "vitest";
import { testimonials, hasTestimonials } from "./testimonials";

/**
 * Empty-safe + provenance contract: the strip ships dark until real testimonials exist,
 * and EVERY testimonial (when present) MUST carry a real verifiable sourceUrl — the
 * permalink is the anti-fabrication guarantee, so an entry without one is invalid.
 */
describe("testimonials", () => {
  it("hasTestimonials reflects the array (dark when empty)", () => {
    expect(hasTestimonials).toBe(testimonials.length > 0);
  });

  it("every testimonial (when present) has a real source URL + required fields", () => {
    for (const t of testimonials) {
      expect(t.quote.length, "quote must be non-empty").toBeGreaterThan(0);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.role.length).toBeGreaterThan(0);
      expect(t.relationship.length).toBeGreaterThan(0);
      expect(t.sourceUrl, `${t.name}: sourceUrl is required (the verifiability guarantee)`).toMatch(/^https?:\/\//);
    }
  });
});
