import { describe, it, expect } from "vitest";
import { TRACE_DELIMITER, THINKING_SENTINEL, THINKING_END } from "./llm-trace";
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

describe("THINKING_END", () => {
  it("is exactly two bytes: U+001E followed by U+0002", () => {
    expect(THINKING_END.length).toBe(2);
    expect(THINKING_END.charCodeAt(0)).toBe(0x001e); // RECORD SEPARATOR
    expect(THINKING_END.charCodeAt(1)).toBe(0x0002); // START OF TEXT
  });

  it("is distinct from THINKING_SENTINEL and TRACE_DELIMITER", () => {
    expect(THINKING_END).not.toBe(THINKING_SENTINEL);
    expect(THINKING_END).not.toBe(TRACE_DELIMITER);
  });

  it("does not appear in typical model prose", () => {
    const prose = "Here is a detailed explanation of the portfolio architecture.";
    expect(prose).not.toContain(THINKING_END);
  });

  it("correctly delineates reasoning from answer in protocol bytes", () => {
    const reasoning = "I need to think carefully.";
    const answer = "Here is my answer.";
    const stream = `${THINKING_SENTINEL}${reasoning}${THINKING_END}${answer}${TRACE_DELIMITER}{"model":"test","fellBack":false}`;
    expect(stream.startsWith(THINKING_SENTINEL)).toBe(true);
    const afterSentinel = stream.slice(THINKING_SENTINEL.length);
    const endIdx = afterSentinel.indexOf(THINKING_END);
    expect(endIdx).toBeGreaterThan(0);
    const parsedReasoning = afterSentinel.slice(0, endIdx);
    const afterEnd = afterSentinel.slice(endIdx + THINKING_END.length);
    const [text] = afterEnd.split(TRACE_DELIMITER);
    expect(parsedReasoning).toBe(reasoning);
    expect(text).toBe(answer);
  });
});

describe("TraceFrame type", () => {
  it("does not include reasoning field (reasoning streams live via THINKING_END protocol)", () => {
    const frame: TraceFrame = {
      model: "us.anthropic.claude-sonnet-4-6",
      fellBack: false,
    };
    // reasoning is no longer in TraceFrame — confirm it is not present
    expect(frame).not.toHaveProperty("reasoning");
  });
});
