import { describe, expect, it } from "vitest";
import {
  AI_CAPTION,
  AI_VOICE_HINT,
  NAMES_A_MODEL_OR_VENDOR,
} from "./ai-disclosure";

/**
 * The owner removed the model and provider line under chat answers in v3.9.0 (#291), which
 * left phones with no visible text saying the answers are AI-generated. The cue that
 * replaces it says that and nothing more: it must never name a model, a vendor or a host.
 */

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

describe("the neutrality pattern itself", () => {
  // A pattern that silently stops catching a name would let the copy drift back to naming one.
  it.each([
    "Claude",
    "Claude Sonnet 5.5",
    "Anthropic",
    "Amazon Bedrock",
    "AWS",
    "GPT-4",
    "GPT5",
    "ChatGPT",
    "OpenAI",
    "Gemini",
    "Llama",
    "Ollama",
    "Mistral",
    "Cohere",
    "DeepSeek",
    "Copilot",
    "Bard",
    "Grok",
    "Qwen",
    "Kimi",
    "Azure",
    "Google",
    "Vertex AI",
    "Vercel",
    "Railway",
  ])("catches %s", (name) => {
    expect(`Answered by ${name}`).toMatch(NAMES_A_MODEL_OR_VENDOR);
  });

  it.each([
    "flaws",
    "laws",
    "draws on real work",
    "Claudette",
    "may simplify details",
  ])("does not trip on the innocent text %j", (text) => {
    expect(text).not.toMatch(NAMES_A_MODEL_OR_VENDOR);
  });
});
