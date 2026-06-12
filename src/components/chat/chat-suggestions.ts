/**
 * Recruiter chip-rail prompts — the one-tap fast paths a hiring manager actually
 * wants (strongest backend project / GenAI work / impact / what he's looking for).
 * These map to questions the corpus can answer from verified content, so the
 * answers stay grounded. Persistent (always offered) so the strongest-work and
 * impact answers are literally one tap from the empty state.
 */
export const RECRUITER_CHIPS: string[] = [
  "What's your strongest backend project?",
  "Tell me about your GenAI / multi-agent work.",
  "What's your impact — real metrics?",
  "What are you looking for in a role?",
];

/** Secondary starters surfaced only in the empty state, below the recruiter chips. */
export const STARTER_CHIPS: string[] = [
  "What did you build at Ascendion?",
  "Tell me about MindForge.",
  "Which open-source projects are you proudest of?",
];
