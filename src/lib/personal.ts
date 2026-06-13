/**
 * Owner-authored "beyond the résumé" content — the SINGLE source every personal-reveal
 * surface reads (the hidden `secret`/`uses`/`now` terminal commands, the visible
 * `about` command, the Konami disclosure card, and the chat corpus).
 *
 * EMPTY BY DEFAULT. Every easter egg + reveal stays DARK until Sairam populates this —
 * so an unpopulated portfolio looks exactly as it does today, and a recruiter never
 * sees a "TODO" placeholder. NOTHING here may be invented: every value must be true,
 * defensible, and recruiter-safe (no politics / religion / relationship / health).
 *
 * OWNER TODO (fill these to light up the eggs):
 *   [ ] hobbies (2–5)            e.g. "Competitive programming for fun"
 *   [ ] funFacts (2–4)           e.g. "Mentored 250–300 students on DSA"
 *   [ ] currentlyLearning (1–3)  e.g. "Rust for systems work"
 *   [ ] askMeAbout (3–4)         e.g. "Multi-agent orchestration tradeoffs"
 *   [ ] uses (≥3 groups)         e.g. { group: "Editor & terminal", items: [...] }
 *   [ ] now.focus (1–4) + now.updated ("YYYY-MM-DD")
 */

/** Personal toolkit group (uses.tech convention) — mirrors the profile `skills` shape. */
export type UsesGroup = { group: string; items: string[] };

export const personal = {
  /** Short, character-revealing, recruiter-safe lines. */
  hobbies: [] as string[],
  /** True "beyond the résumé" facts (don't restate achievements verbatim). */
  funFacts: [] as string[],
  /** Things actively being learned right now. */
  currentlyLearning: [] as string[],
  /** Conversation starters for a recruiter / fellow engineer. */
  askMeAbout: [] as string[],
  /** uses.tech-style personal toolkit — distinct from the professional `skills`. */
  uses: [] as UsesGroup[],
} as const;

/**
 * The /now convention (Derek Sivers / nownownow.com): what I'm focused on right now,
 * plus the date it was last refreshed. `updated` MUST be re-touched whenever `focus`
 * changes, or the `now` command will honestly report it as stale. Leave `updated` as
 * "" to keep the `now` command dark.
 */
export const now = {
  /** ISO date, e.g. "2026-06-14". "" => the `now` command stays dark. */
  updated: "",
  /** 1–4 short lines: what I'm building / learning right now. */
  focus: [] as string[],
} as const;

/**
 * The empty-safe gate every reveal checks. True ONLY when there is real content — so
 * "no content" reliably means "no egg fires / no fabricated output", never a placeholder.
 */
export const hasPersonalContent: boolean =
  personal.hobbies.length > 0 ||
  personal.funFacts.length > 0 ||
  personal.currentlyLearning.length > 0 ||
  personal.askMeAbout.length > 0 ||
  personal.uses.length > 0;

/** Whether the `now` command has real, owner-dated content to show. */
export const hasNow: boolean = now.updated !== "" && now.focus.length > 0;
