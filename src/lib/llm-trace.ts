/**
 * Shared constants and types for the chat stream protocol — kept in their own
 * client-safe module so the chat client can import them WITHOUT pulling in the
 * server-only Bedrock SDK from llm.ts.
 *
 * Protocol layout (bytes in order):
 *   [THINKING_SENTINEL][reasoning bytes][THINKING_END][answer text][TRACE_DELIMITER][TraceFrame JSON]
 *   OR (no extended thinking):
 *   [answer text][TRACE_DELIMITER][TraceFrame JSON]
 *
 * THINKING_SENTINEL — emitted as the very first bytes when extended thinking is
 *   enabled. Two non-printable chars (U+001E U+0001) so it never collides with
 *   model prose. Client strips it and sets isThinking: true immediately.
 *
 * THINKING_END — emitted when reasoning phase is complete and the answer is about
 *   to begin. Two non-printable chars (U+001E U+0002). Client uses this to flip
 *   isThinking → false and begin rendering the answer stream.
 *
 * TRACE_DELIMITER — U+001E (RECORD SEPARATOR). Splits visible answer from the
 *   trailing JSON trace frame {model, fellBack, ...}. Unchanged from v1.6.
 *   NOTE: reasoning is no longer included in the trace frame — it streams live.
 */
export const TRACE_DELIMITER = "";
export const THINKING_SENTINEL = "";
export const THINKING_END = ""; // U+001E + U+0002 (STX) — signals thinking→answering transition

export type LlmUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export type TraceFrame = {
  model: string;
  fellBack: boolean;
  traceId?: string;
  usage?: LlmUsage;
  ttftMs?: number;
  latencyMs?: number;
  // reasoning is no longer in the trace frame — it streams live via THINKING_END protocol
};
