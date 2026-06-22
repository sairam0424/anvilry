import { describe, it, expect } from "vitest";
import { TRACE_DELIMITER, THINKING_SENTINEL } from "./llm-trace";
import type { TraceFrame } from "./llm-trace";

/**
 * The trace delimiter must be the U+001E RECORD SEPARATOR control char (not an empty
 * string — a regression that silently disabled the model badge), so it cleanly splits
 * the visible answer from the trailing {model, fellBack} frame and never collides with
 * model prose.
 */
describe("TRACE_DELIMITER", () => {
  it("is exactly U+001E (RECORD SEPARATOR), not empty", () => {
    expect(TRACE_DELIMITER).toBe("");
    expect(TRACE_DELIMITER.length).toBe(1);
    expect(TRACE_DELIMITER).not.toBe("");
  });

  it("a stream split on it yields [visible text, json frame]", () => {
    const stream = `Here is your answer.${TRACE_DELIMITER}{"model":"us.anthropic.claude-opus-4-6-v1","fellBack":false}`;
    const [text, frame] = stream.split(TRACE_DELIMITER);
    expect(text).toBe("Here is your answer.");
    const parsed = JSON.parse(frame);
    expect(parsed.model).toContain("opus");
    expect(parsed.fellBack).toBe(false);
  });
});

describe("THINKING_SENTINEL", () => {
  it("is exactly two bytes: U+001E followed by U+0001", () => {
    expect(THINKING_SENTINEL.length).toBe(2);
    expect(THINKING_SENTINEL.charCodeAt(0)).toBe(0x001e); // RECORD SEPARATOR
    expect(THINKING_SENTINEL.charCodeAt(1)).toBe(0x0001); // START OF HEADING
  });

  it("is distinct from TRACE_DELIMITER", () => {
    expect(THINKING_SENTINEL).not.toBe(TRACE_DELIMITER);
    expect(THINKING_SENTINEL).not.toContain(TRACE_DELIMITER.slice(0, 1) + TRACE_DELIMITER.slice(0, 1));
  });

  it("does not appear in typical model prose", () => {
    const prose = "Here is a detailed explanation of the portfolio architecture.";
    expect(prose).not.toContain(THINKING_SENTINEL);
  });
});

describe("TraceFrame type", () => {
  it("accepts a reasoning field when extended thinking ran", () => {
    // Type-level test: if this compiles, the type is correct.
    const frame: TraceFrame = {
      model: "us.anthropic.claude-sonnet-4-6",
      fellBack: false,
      reasoning: "I need to think about this carefully...",
    };
    expect(frame.reasoning).toBe("I need to think about this carefully...");
  });

  it("reasoning field is optional", () => {
    const frame: TraceFrame = {
      model: "us.anthropic.claude-sonnet-4-6",
      fellBack: false,
    };
    expect(frame.reasoning).toBeUndefined();
  });
});
