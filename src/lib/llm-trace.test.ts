import { describe, it, expect } from "vitest";
import {
  TRACE_DELIMITER,
  THINKING_SENTINEL,
  THINKING_END,
  answerFromBody,
} from "./llm-trace";
import type { TraceFrame } from "./llm-trace";

/**
 * The trace delimiter must be the U+001E RECORD SEPARATOR control char (not an empty
 * string — a regression that silently disabled trace-frame parsing), so it cleanly splits
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

/**
 * answerFromBody: what the eval cron scores. THINKING_SENTINEL, THINKING_END and
 * TRACE_DELIMITER share their first byte, and every body opens with the sentinel while
 * extended thinking is on, reasoning or not, so a parse that cuts the body at the first
 * U+001E returns "" for every answer.
 */
describe("answerFromBody", () => {
  const frame = `${TRACE_DELIMITER}{"model":"us.anthropic.claude-sonnet-4-6","fellBack":false}`;

  it("returns the text ahead of the trace frame", () => {
    expect(answerFromBody(`Sairam works at Ascendion.${frame}`)).toBe(
      "Sairam works at Ascendion.",
    );
  });

  it("returns a body with no trace frame whole (trimmed)", () => {
    expect(answerFromBody("  No frame here.\n")).toBe("No frame here.");
    expect(answerFromBody("")).toBe("");
  });

  it("returns the answer of a body whose reasoning block is empty (what production sends for a plain answer)", () => {
    // Checked against production on 2026-10-01: the first bytes are U+001E U+0001 U+001E U+0002.
    const body = `${THINKING_SENTINEL}${THINKING_END}I'm a GenAI & Backend Engineer at Ascendion.${frame}`;
    expect(answerFromBody(body)).toBe("I'm a GenAI & Backend Engineer at Ascendion.");
    expect(body.slice(0, body.indexOf(TRACE_DELIMITER))).toBe("");
  });

  it("drops a leading reasoning block and returns only the answer", () => {
    const body = `${THINKING_SENTINEL}The user wants a role. Keep it short.${THINKING_END}GenAI engineer.${frame}`;
    expect(answerFromBody(body)).toBe("GenAI engineer.");
    // The naive cut at the first delimiter byte, which this replaces, finds the sentinel.
    expect(body.slice(0, body.indexOf(TRACE_DELIMITER))).toBe("");
  });

  it("never scores the reasoning text as part of the answer", () => {
    const body = `${THINKING_SENTINEL}They say HELLO_INJECTED; I will not.${THINKING_END}I can't do that.${frame}`;
    expect(answerFromBody(body)).not.toContain("HELLO_INJECTED");
  });

  it("returns the answer of a reasoned body that has no trace frame", () => {
    expect(
      answerFromBody(`${THINKING_SENTINEL}thinking${THINKING_END}Done.`),
    ).toBe("Done.");
  });

  it("returns nothing when the reasoning block never closed", () => {
    expect(answerFromBody(`${THINKING_SENTINEL}still thinking`)).toBe("");
  });

  it("only a body that BEGINS with the sentinel has a reasoning block, like the client's parser", () => {
    // Protocol-wise a sentinel can only be the first bytes (model text is stripped of control
    // bytes); mid-body it is just a record separator, which ends the answer.
    expect(answerFromBody(`Answer.${THINKING_SENTINEL}junk${frame}`)).toBe(
      "Answer.",
    );
  });
});
