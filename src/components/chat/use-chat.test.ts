import { describe, it, expect } from "vitest";
import { TRACE_DELIMITER, THINKING_SENTINEL } from "@/lib/llm-trace";

/**
 * Tests for the stream-parsing logic in use-chat.ts.
 * We test the pure parsing behaviour by replicating the splitTrace function here
 * and verifying it against streams that include the THINKING_SENTINEL prefix
 * and reasoning in the trace frame.
 */

// Replicate the splitTrace function shape to test parsing logic
function splitTrace(acc: string): {
  text: string;
  trace?: { model: string; fellBack: boolean; reasoning?: string };
} {
  const idx = acc.indexOf(TRACE_DELIMITER);
  if (idx === -1) return { text: acc };
  const text = acc.slice(0, idx);
  const rest = acc.slice(idx + TRACE_DELIMITER.length);
  try {
    return { text, trace: JSON.parse(rest) };
  } catch {
    return { text };
  }
}

describe("use-chat stream parsing — THINKING_SENTINEL and reasoning", () => {
  it("strips THINKING_SENTINEL prefix from accumulated stream before parsing", () => {
    // Simulate what use-chat does: detect sentinel prefix, strip it
    const rawStream = THINKING_SENTINEL + "Here is my answer." + TRACE_DELIMITER +
      JSON.stringify({ model: "us.anthropic.claude-sonnet-4-6", fellBack: false, reasoning: "I thought carefully." });

    const hasThinkingSentinel = rawStream.startsWith(THINKING_SENTINEL);
    expect(hasThinkingSentinel).toBe(true);

    const withoutSentinel = rawStream.slice(THINKING_SENTINEL.length);
    const { text, trace } = splitTrace(withoutSentinel);
    expect(text).toBe("Here is my answer.");
    expect(trace?.model).toBe("us.anthropic.claude-sonnet-4-6");
    expect(trace?.reasoning).toBe("I thought carefully.");
  });

  it("handles stream without THINKING_SENTINEL (standard generation path)", () => {
    const rawStream = "Normal answer." + TRACE_DELIMITER +
      JSON.stringify({ model: "us.anthropic.claude-sonnet-4-6", fellBack: false });

    expect(rawStream.startsWith(THINKING_SENTINEL)).toBe(false);
    const { text, trace } = splitTrace(rawStream);
    expect(text).toBe("Normal answer.");
    expect(trace?.reasoning).toBeUndefined();
  });

  it("reasoning word count is calculable from trace.reasoning", () => {
    const reasoning = "I need to consider the architecture carefully before answering.";
    const wordCount = reasoning.split(" ").length;
    expect(wordCount).toBe(9);
  });

  it("isThinking transitions: true when sentinel seen and no text yet, false once text arrives", () => {
    // Simulate progressive stream accumulation
    let acc = "";
    let isThinking = false;

    // First chunk: just the sentinel
    acc += THINKING_SENTINEL;
    if (acc.startsWith(THINKING_SENTINEL)) isThinking = true;

    // At this point no text content yet — still thinking
    const textSoFar = acc.startsWith(THINKING_SENTINEL) ? acc.slice(THINKING_SENTINEL.length) : acc;
    expect(textSoFar.trim()).toBe("");
    expect(isThinking).toBe(true);

    // Second chunk: text starts arriving
    acc += "Here";
    const newText = acc.startsWith(THINKING_SENTINEL) ? acc.slice(THINKING_SENTINEL.length) : acc;
    if (newText.trim().length > 0 && !newText.includes(TRACE_DELIMITER)) {
      isThinking = false;
    }
    expect(isThinking).toBe(false);
  });
});
