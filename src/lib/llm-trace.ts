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

// The three control chars used by the protocol above: U+001E is
// TRACE_DELIMITER and the shared prefix of THINKING_SENTINEL (+U+0001) and
// THINKING_END (+U+0002). A legitimate model completion should never contain
// any of these bytes in its own generated text — stripped defensively from
// every model-generated chunk (both live and before a cache write) so an
// anomalous completion can never smuggle in a byte that collides with this
// protocol's own framing and corrupts the client's splitTrace() parsing.
const CONTROL_BYTES_RE = /[\u001e\u0001\u0002]/g;

export function stripControlBytes(text: string): string {
  return text.replace(CONTROL_BYTES_RE, "");
}

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

/**
 * The visible answer in a COMPLETE /api/chat body, for server-side callers that only
 * score the text (the eval cron): drops the leading reasoning block, then the trailing
 * trace frame.
 *
 * THINKING_SENTINEL and THINKING_END both start with the byte TRACE_DELIMITER is made
 * of, so the delimiter must be searched for only AFTER the reasoning block. Searching
 * the whole body finds the sentinel at index 0 and returns an empty answer whenever
 * extended thinking is on (the sentinel goes out first, reasoning or not). An unclosed block leaves no answer.
 */
export function answerFromBody(body: string): string {
  let rest = body;
  if (rest.startsWith(THINKING_SENTINEL)) {
    const endIdx = rest.indexOf(THINKING_END);
    rest = endIdx === -1 ? "" : rest.slice(endIdx + THINKING_END.length);
  }
  const delimIdx = rest.indexOf(TRACE_DELIMITER);
  return (delimIdx === -1 ? rest : rest.slice(0, delimIdx)).trim();
}
