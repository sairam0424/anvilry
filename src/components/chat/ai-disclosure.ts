/**
 * The copy that tells a visitor the answers are AI-generated. One module, so the Chat view,
 * the floating widget on the Classic page and the voice surface cannot drift apart.
 *
 * It is deliberately neutral: no model, vendor or provider name. v3.9.0 (#291) removed the
 * "Answered by <model> · <provider>" line under answers at the owner's request, and that line
 * had been the only visible text on phones saying the answers are AI-generated (the header
 * label is icon-only below the sm breakpoint). This says that and nothing else.
 */
export const AI_CAPTION =
  "AI assistant · grounded in real work · may simplify details";

/** Idle hint on the voice surface. Spoken answers are a synthetic voice reading the
 *  assistant's text, so the voice surface says so before the visitor starts talking. */
export const AI_VOICE_HINT = "AI assistant, grounded in real work";
