/**
 * Owner-authored testimonials / recommendations — the SINGLE source for the social-proof
 * strip + corpus seeding. EMPTY BY DEFAULT: the strip ships DARK until Sairam adds real
 * recommendations, so an unpopulated portfolio looks exactly as today.
 *
 * ZERO-FABRICATION GATE: every entry REQUIRES a `sourceUrl` — the public LinkedIn
 * recommendation permalink. The verifiable link IS the anti-fabrication guarantee; an
 * entry with no real, checkable source is invalid and must not be added. Lead with
 * manager / senior-peer quotes; keep mentee quotes to at most one.
 *
 * OWNER TODO (to light up the strip): add 3–6 real recommendations, each with the
 * person's name, role, your relationship to them, the quote, and the LinkedIn permalink.
 */
export type Testimonial = {
  /** The recommendation text, verbatim (trim to a tight pull-quote if long). */
  quote: string;
  name: string;
  /** Their role/title at the time, e.g. "Engineering Manager, Ascendion". */
  role: string;
  /** Your relationship, e.g. "Manager", "Senior peer", "Mentee". */
  relationship: string;
  /** REQUIRED public permalink (LinkedIn recommendation) — the verifiability guarantee. */
  sourceUrl: string;
};

export const testimonials: Testimonial[] = [];

/** True only when there is at least one real, source-linked testimonial to show. */
export const hasTestimonials: boolean = testimonials.length > 0;
