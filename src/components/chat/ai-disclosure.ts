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

/** Idle hint on the voice surface: spoken answers are a synthetic voice. Shown until the
 *  mic opens (the phone modal); the desktop panel auto-starts, so it shows the active hint. */
export const AI_VOICE_HINT = "AI assistant, grounded in real work";

/**
 * The contract above as a pattern: a model, a vendor or a host must never appear in the copy.
 * Word-bounded, so "flaws" or "laws" do not trip "aws". The tests run the caption, the hint, the
 * Chat view intro and the widget greeting through it (not the voice dialog description).
 */
export const NAMES_A_MODEL_OR_VENDOR =
  /\b(?:claude|anthropic|bedrock|sonnet|haiku|opus|chatgpt|gpt\d*|openai|gemini|llama|ollama|mistral|cohere|deepseek|copilot|bard|grok|qwen|kimi|amazon|aws|azure|google|vertex|vercel|railway)\b/i;
