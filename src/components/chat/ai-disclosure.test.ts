import { describe, expect, it } from "vitest";
import { AI_CAPTION, AI_VOICE_HINT } from "./ai-disclosure";

/**
 * The owner removed the model and provider line under chat answers in v3.9.0 (#291), which
 * left phones with no visible text saying the answers are AI-generated. The cue that
 * replaces it says that and nothing more: it must never name a model, a vendor or a host.
 */
const NAMES_A_MODEL_OR_VENDOR =
  /claude|anthropic|bedrock|sonnet|haiku|opus|gpt|openai|gemini|llama|mistral|amazon|aws/i;

const COPY = [
  ["caption", AI_CAPTION],
  ["voice hint", AI_VOICE_HINT],
] as const;

describe("AI disclosure copy", () => {
  it.each(COPY)("the %s says the answers are AI", (_name, text) => {
    expect(text).toMatch(/\bAI\b/);
  });

  it.each(COPY)("the %s names no model, vendor or provider", (_name, text) => {
    expect(text).not.toMatch(NAMES_A_MODEL_OR_VENDOR);
  });

  it("keeps the caveats the old caption carried", () => {
    expect(AI_CAPTION).toContain("grounded in real work");
    expect(AI_CAPTION).toContain("may simplify details");
    expect(AI_VOICE_HINT).toContain("grounded in real work");
  });
});
