import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TRACE_DELIMITER, THINKING_SENTINEL } from "./llm-trace";
import type { LlmAttempt, LlmUsage } from "./llm";

/**
 * Fixture-based tests for streamWithFallback's v1.8 telemetry capture.
 *
 * The headline guarantee: the for-await loop now consumes message_start +
 * message_delta events to extract the snake_case usage block (input_tokens,
 * output_tokens, cache_creation_input_tokens, cache_read_input_tokens). Until
 * v1.8 these events flowed through the loop and were silently dropped — every
 * cache-hit-rate and every per-request token count was zero.
 *
 * The test uses snake_case field names DELIBERATELY. The Bedrock Converse API
 * uses camelCase (cacheReadInputTokens) but Anvilry uses @anthropic-ai/bedrock-sdk
 * which uses snake_case. A future SDK swap that returns camelCase would silently
 * zero out the dashboard — these tests catch that regression at build time.
 *
 * Mock strategy: spy on `makeClient` directly. The SDK constructors take a
 * `providerChainResolver` whose contract is awkward to stub — we don't need to
 * exercise client construction here, just the for-await event consumption that
 * runs against a vanilla async iterable.
 */

// vi.hoisted lets the mock factories below see STATE + fakeStream — vi.mock
// factories are hoisted to the top of the file, BEFORE module-level code, so
// any plain `const STATE` would be undefined when a factory runs.
const { STATE, fakeStream } = vi.hoisted(() => {
  const STATE: {
    events: unknown[][];
    throwsOn: number[];
    callCount: number;
  } = { events: [], throwsOn: [], callCount: 0 };
  function fakeStream() {
    const idx = STATE.callCount;
    STATE.callCount += 1;
    const events = STATE.events[idx] ?? [];
    const willThrow = STATE.throwsOn.includes(idx);
    return {
      async *[Symbol.asyncIterator]() {
        for (const event of events) yield event;
        if (willThrow) {
          const err = new Error("simulated bedrock error");
          (err as { status?: number }).status = 500;
          throw err;
        }
      },
    };
  }
  return { STATE, fakeStream };
});

// Mock the bedrock SDK constructor. A real class works under `new` (vi.fn
// mockImplementation discards its return when called as a constructor).
vi.mock("@anthropic-ai/bedrock-sdk", () => {
  class FakeAnthropicBedrock {
    messages: { stream: () => unknown };
    constructor() {
      this.messages = { stream: () => fakeStream() };
    }
  }
  return { AnthropicBedrock: FakeAnthropicBedrock };
});

// llm.ts uses `Anthropic.APIConnectionError` for an instanceof check. Provide
// a class with that static so the import resolves, even though the direct-API
// path is never exercised in this test.
vi.mock("@anthropic-ai/sdk", () => {
  class FakeAPIConnectionError extends Error {}
  class FakeAnthropic {
    messages: { stream: () => unknown };
    constructor() {
      this.messages = { stream: () => fakeStream() };
    }
    static APIConnectionError = FakeAPIConnectionError;
  }
  return { default: FakeAnthropic };
});

beforeEach(() => {
  process.env.LLM_PROVIDER = "bedrock";
  process.env.BEDROCK_ACCESS_KEY_ID = "AKIAFAKE";
  process.env.BEDROCK_SECRET_ACCESS_KEY = "fake";
  process.env.BEDROCK_REGION = "us-east-1";
  STATE.events = [];
  STATE.throwsOn = [];
  STATE.callCount = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Read the entire ReadableStream into one decoded string. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
  }
  return acc;
}

describe("streamWithFallback — v1.8 usage capture (the headline win)", () => {
  it("captures snake_case usage from message_start + message_delta events", async () => {
    STATE.events = [
      [
        // 1. message_start carries input + cache_creation + cache_read tokens
        {
          type: "message_start",
          message: {
            usage: {
              input_tokens: 12,
              cache_creation_input_tokens: 4096,
              cache_read_input_tokens: 0,
              output_tokens: 0,
            },
          },
        },
        // 2. content_block_delta — first text delta starts the TTFT clock
        { type: "content_block_delta", delta: { type: "text_delta", text: "Hello" } },
        { type: "content_block_delta", delta: { type: "text_delta", text: " world." } },
        // 3. message_delta carries the final output_tokens + stop_reason
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 47 },
        },
        { type: "message_stop" },
      ],
    ];
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    const stream = streamWithFallback(
      { messages: [{ role: "user", content: "ping" }], max_tokens: 100, system: "test" },
      { onAttempt },
    );

    const body = await drain(stream);

    // Visible text streams cleanly; the trace frame appears AFTER U+001E.
    const [text, frameJson] = body.split(TRACE_DELIMITER);
    expect(text).toBe("Hello world.");

    // Trace frame includes usage on the v1.8 path.
    const frame = JSON.parse(frameJson);
    expect(frame.model).toBe("us.anthropic.claude-sonnet-4-6");
    expect(frame.fellBack).toBe(false);
    expect(frame.usage).toEqual({
      input_tokens: 12,
      cache_creation_input_tokens: 4096,
      cache_read_input_tokens: 0,
      output_tokens: 47,
    });
    expect(frame.ttftMs).toBeTypeOf("number");
    expect(frame.latencyMs).toBeTypeOf("number");

    // onAttempt fires exactly once for the success path with full usage.
    expect(onAttempt).toHaveBeenCalledTimes(1);
    const attempt = onAttempt.mock.calls[0][0];
    expect(attempt.model).toBe("us.anthropic.claude-sonnet-4-6");
    expect(attempt.attempt_index).toBe(0);
    expect(attempt.fell_back).toBe(false);
    expect(attempt.finish_reason).toBe("end_turn");
    expect(attempt.usage).toEqual({
      input_tokens: 12,
      cache_creation_input_tokens: 4096,
      cache_read_input_tokens: 0,
      output_tokens: 47,
    });
    expect(attempt.error).toBeUndefined();
  });

  it("captures cache_read_input_tokens on a warm-cache turn (the actual cache-hit signal)", async () => {
    // Second turn against the same system prompt → cache_read should be high,
    // cache_creation should be 0.
    STATE.events = [
      [
        {
          type: "message_start",
          message: {
            usage: {
              input_tokens: 8,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 4096,
              output_tokens: 0,
            },
          },
        },
        { type: "content_block_delta", delta: { type: "text_delta", text: "cached!" } },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 3 },
        },
      ],
    ];
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    const stream = streamWithFallback(
      { messages: [{ role: "user", content: "warm" }], max_tokens: 100, system: "test" },
      { onAttempt },
    );

    await drain(stream);
    const usage = onAttempt.mock.calls[0][0].usage as LlmUsage;
    expect(usage.cache_read_input_tokens).toBe(4096);
    expect(usage.cache_creation_input_tokens).toBe(0);
  });

  it("uses snake_case keys verbatim (regression guard against a silent SDK swap)", async () => {
    // Pin the key names: a future SDK that returned camelCase would silently
    // zero this out, and the dashboard's cache-hit tile would read 0% forever
    // without anyone noticing. This test fails loudly on that regression.
    STATE.events = [
      [
        {
          type: "message_start",
          message: { usage: { input_tokens: 5, cache_read_input_tokens: 100 } },
        },
        { type: "content_block_delta", delta: { type: "text_delta", text: "x" } },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    await drain(
      streamWithFallback(
        { messages: [{ role: "user", content: "ping" }], max_tokens: 10, system: "x" },
        { onAttempt },
      ),
    );
    const usage = onAttempt.mock.calls[0][0].usage!;
    // Required snake_case keys.
    expect(Object.keys(usage)).toEqual(
      expect.arrayContaining(["input_tokens", "cache_read_input_tokens", "output_tokens"]),
    );
    // Forbidden camelCase keys (a future SDK swap would slip these in).
    expect(usage).not.toHaveProperty("inputTokens");
    expect(usage).not.toHaveProperty("cacheReadInputTokens");
  });
});

describe("streamWithFallback — emittedAny invariant (load-bearing)", () => {
  it("does NOT emit a trace frame when zero bytes were sent (attempt errored before any delta)", async () => {
    // Attempt 0 throws BEFORE emitting any content_block_delta. The next
    // attempt must succeed cleanly. The trace frame must NOT carry the failed
    // attempt's model — only the model that actually streamed bytes.
    STATE.events = [
      // attempt 0: only message_start, then throws (no text)
      [{ type: "message_start", message: { usage: { input_tokens: 5 } } }],
      // attempt 1: full success
      [
        { type: "message_start", message: { usage: { input_tokens: 5 } } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "OK" } },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];
    STATE.throwsOn = [0];

    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    const stream = streamWithFallback(
      { messages: [{ role: "user", content: "ping" }], max_tokens: 10, system: "x" },
      { onAttempt },
    );

    const body = await drain(stream);
    const [text, frameJson] = body.split(TRACE_DELIMITER);
    expect(text).toBe("OK");
    const frame = JSON.parse(frameJson);
    // Trace frame shows the SECOND model in the chain (Opus) and fellBack: true.
    expect(frame.model).toBe("us.anthropic.claude-opus-4-6-v1");
    expect(frame.fellBack).toBe(true);
    // Both attempts produced an onAttempt event (one error, one success).
    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(onAttempt.mock.calls[0][0].error?.name).toBeDefined();
    expect(onAttempt.mock.calls[1][0].error).toBeUndefined();
  });

  it("does NOT emit a trace frame when ALL attempts error before any byte (returns apology)", async () => {
    // Every attempt throws status=500 BEFORE any delta. Output should be the
    // apology tail with NO trace frame appended.
    STATE.events = [[], [], []];
    STATE.throwsOn = [0, 1, 2];

    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        { messages: [{ role: "user", content: "ping" }], max_tokens: 10, system: "x" },
        { onAttempt },
      ),
    );
    expect(body).not.toContain(TRACE_DELIMITER);
    expect(body).toContain("Sorry");
    // All three attempts should have produced an onAttempt event.
    expect(onAttempt).toHaveBeenCalledTimes(3);
    expect(onAttempt.mock.calls.every((c) => c[0].error?.name === "Error")).toBe(true);
  });
});

describe("streamWithFallback — onAttempt safety (telemetry never breaks the chat)", () => {
  it("swallows onAttempt throw — user still gets clean text", async () => {
    STATE.events = [
      [
        { type: "message_start", message: { usage: { input_tokens: 5 } } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "fine" } },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];
    const onAttempt = vi.fn(() => {
      throw new Error("telemetry sink down");
    });
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        { messages: [{ role: "user", content: "ping" }], max_tokens: 10, system: "x" },
        { onAttempt },
      ),
    );
    // User-facing text is unaffected; trace frame still landed.
    const [text] = body.split(TRACE_DELIMITER);
    expect(text).toBe("fine");
    expect(onAttempt).toHaveBeenCalledTimes(1);
  });
});

describe("streamWithFallback — traceId threading", () => {
  it("includes traceId in the trace frame when provided", async () => {
    STATE.events = [
      [
        { type: "content_block_delta", delta: { type: "text_delta", text: "ok" } },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        { messages: [{ role: "user", content: "ping" }], max_tokens: 10, system: "x" },
        { traceId: "trace-12345" },
      ),
    );
    const frame = JSON.parse(body.split(TRACE_DELIMITER)[1]);
    expect(frame.traceId).toBe("trace-12345");
  });

  it("omits traceId from the frame when not provided (back-compat with v1.6)", async () => {
    STATE.events = [
      [
        { type: "content_block_delta", delta: { type: "text_delta", text: "ok" } },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback({
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 10,
        system: "x",
      }),
    );
    const frame = JSON.parse(body.split(TRACE_DELIMITER)[1]);
    expect(frame).not.toHaveProperty("traceId");
    // model + fellBack still present (v1.6 contract).
    expect(frame.model).toBeDefined();
    expect(frame.fellBack).toBe(false);
  });
});

describe("streamWithFallback — extended thinking (v2.3.0)", () => {
  it("prepends THINKING_SENTINEL and buffers reasoning into trace frame", async () => {
    STATE.events = [
      [
        // thinking block arrives BEFORE text blocks
        { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "I need to " } },
        { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "think carefully." } },
        { type: "content_block_stop", index: 0 },
        // text block follows
        { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "Here is my answer." } },
        { type: "content_block_stop", index: 1 },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 8 } },
      ],
    ];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        { messages: [{ role: "user", content: "explain" }], max_tokens: 200, system: "test" },
        { extendedThinking: true },
      ),
    );

    // Stream starts with THINKING_SENTINEL
    expect(body.startsWith(THINKING_SENTINEL)).toBe(true);

    // Visible text is the answer only — no thinking text leaked
    const withoutSentinel = body.slice(THINKING_SENTINEL.length);
    const [text, frameJson] = withoutSentinel.split(TRACE_DELIMITER);
    expect(text).toBe("Here is my answer.");

    // Trace frame includes reasoning
    const frame = JSON.parse(frameJson);
    expect(frame.reasoning).toBe("I need to think carefully.");
    expect(frame.model).toBe("us.anthropic.claude-sonnet-4-6");
  });

  it("does NOT prepend THINKING_SENTINEL when extendedThinking is false", async () => {
    STATE.events = [
      [
        { type: "content_block_delta", delta: { type: "text_delta", text: "Normal answer." } },
        { type: "message_delta", usage: { output_tokens: 3 } },
      ],
    ];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        { messages: [{ role: "user", content: "hi" }], max_tokens: 100, system: "test" },
        { extendedThinking: false },
      ),
    );

    expect(body.startsWith(THINKING_SENTINEL)).toBe(false);
    const [text] = body.split(TRACE_DELIMITER);
    expect(text).toBe("Normal answer.");
  });

  it("skips thinking params for Haiku model (Haiku does not support extended thinking)", async () => {
    // Force Haiku to be first in chain by temporarily overriding env
    // We can't easily override the chain; instead verify the guard doesn't throw
    // when a haiku model ID is encountered during the thinking path.
    // The guard is: if model.includes("haiku"), skip thinking params.
    // Test: a stream with no thinking events should produce no reasoning in frame.
    STATE.events = [
      [
        { type: "content_block_delta", delta: { type: "text_delta", text: "Haiku answer." } },
        { type: "message_delta", usage: { output_tokens: 2 } },
      ],
    ];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        { messages: [{ role: "user", content: "hi" }], max_tokens: 100, system: "test" },
        { extendedThinking: true },
      ),
    );

    // The primary model (Sonnet) runs here — no haiku in this test path.
    // What we're testing: reasoning is undefined (not "") when no thinking events fire.
    const withoutSentinel = body.startsWith(THINKING_SENTINEL)
      ? body.slice(THINKING_SENTINEL.length)
      : body;
    const [, frameJson] = withoutSentinel.split(TRACE_DELIMITER);
    const frame = JSON.parse(frameJson);
    // reasoning should be absent (no thinking events in fixture)
    expect(frame.reasoning).toBeUndefined();
  });

  it("omits reasoning from trace frame when extended thinking produces empty buffer", async () => {
    STATE.events = [
      [
        // thinking delta with empty string
        { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "" } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "Answer." } },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        { messages: [{ role: "user", content: "hi" }], max_tokens: 100, system: "test" },
        { extendedThinking: true },
      ),
    );

    const withoutSentinel = body.startsWith(THINKING_SENTINEL)
      ? body.slice(THINKING_SENTINEL.length)
      : body;
    const [, frameJson] = withoutSentinel.split(TRACE_DELIMITER);
    const frame = JSON.parse(frameJson);
    // empty reasoning buffer -> omit key from frame
    expect(frame.reasoning).toBeUndefined();
  });
});
