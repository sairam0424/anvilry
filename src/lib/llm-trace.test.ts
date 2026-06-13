import { describe, it, expect } from "vitest";
import { TRACE_DELIMITER } from "./llm-trace";

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
