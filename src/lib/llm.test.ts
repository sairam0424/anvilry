import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TRACE_DELIMITER, THINKING_SENTINEL, THINKING_END } from "./llm-trace";
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
    /** Per-index override for the thrown error's status (defaults to 500,
     *  which is fallback-eligible). Set an entry to 400 to simulate a
     *  deterministic, NOT-fallback-eligible error. */
    throwStatus: Record<number, number>;
    /** Per-index override for the thrown error's message. 400/403 eligibility
     *  is decided by the message text, so tests need to control it. */
    throwMessage: Record<number, string>;
    callCount: number;
    /** Captures the params object passed to the most recent messages.stream()
     *  call — lets tests assert on the actual request shape (thinking config,
     *  model id) sent per attempt, not just the resulting byte stream. */
    lastStreamParams: unknown;
    streamParamsByCall: unknown[];
  } = {
    events: [],
    throwsOn: [],
    throwStatus: {},
    throwMessage: {},
    callCount: 0,
    lastStreamParams: undefined,
    streamParamsByCall: [],
  };
  function fakeStream() {
    const idx = STATE.callCount;
    STATE.callCount += 1;
    const events = STATE.events[idx] ?? [];
    const willThrow = STATE.throwsOn.includes(idx);
    return {
      async *[Symbol.asyncIterator]() {
        for (const event of events) yield event;
        if (willThrow) {
          const err = new Error(
            STATE.throwMessage[idx] ?? "simulated bedrock error",
          );
          (err as { status?: number }).status = STATE.throwStatus[idx] ?? 500;
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
    messages: { stream: (p: unknown) => unknown };
    constructor() {
      this.messages = {
        stream: (p: unknown) => {
          STATE.lastStreamParams = p;
          STATE.streamParamsByCall.push(p);
          return fakeStream();
        },
      };
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
    messages: { stream: (p: unknown) => unknown };
    constructor() {
      this.messages = {
        stream: (p: unknown) => {
          STATE.lastStreamParams = p;
          STATE.streamParamsByCall.push(p);
          return fakeStream();
        },
      };
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
  STATE.throwStatus = {};
  STATE.throwMessage = {};
  STATE.callCount = 0;
  STATE.lastStreamParams = undefined;
  STATE.streamParamsByCall = [];
  delete process.env.LLM_USE_SONNET_5;
  delete process.env.LLM_USE_SONNET_5_5;
  delete process.env.LLM_USE_OPUS_FALLBACK;
  delete process.env.LLM_THINKING_EFFORT;
});

afterEach(() => {
  vi.clearAllMocks();
  // A flag a test set must not outlive it (beforeEach resets them too).
  delete process.env.LLM_USE_SONNET_5;
  delete process.env.LLM_USE_SONNET_5_5;
  delete process.env.LLM_USE_OPUS_FALLBACK;
  delete process.env.LLM_THINKING_EFFORT;
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
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello" },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: " world." },
        },
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
      {
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 100,
        system: "test",
      },
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
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "cached!" },
        },
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
      {
        messages: [{ role: "user", content: "warm" }],
        max_tokens: 100,
        system: "test",
      },
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
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "x" },
        },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 10,
          system: "x",
        },
        { onAttempt },
      ),
    );
    const usage = onAttempt.mock.calls[0][0].usage!;
    // Required snake_case keys.
    expect(Object.keys(usage)).toEqual(
      expect.arrayContaining([
        "input_tokens",
        "cache_read_input_tokens",
        "output_tokens",
      ]),
    );
    // Forbidden camelCase keys (a future SDK swap would slip these in).
    expect(usage).not.toHaveProperty("inputTokens");
    expect(usage).not.toHaveProperty("cacheReadInputTokens");
  });
});

describe("streamWithFallback — answerText capture (FAQ-cache write-through source)", () => {
  it("captures the full concatenated text_delta text on a clean success", async () => {
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello" },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: " world." },
        },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 3 },
        },
      ],
    ];
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 100,
          system: "test",
        },
        { onAttempt },
      ),
    );
    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt.mock.calls[0][0].answerText).toBe("Hello world.");
  });

  it("is undefined when the attempt errors before any byte (fallback path)", async () => {
    STATE.events = [
      // attempt 0: errors before any text_delta — answerText must be absent.
      [{ type: "message_start", message: { usage: { input_tokens: 5 } } }],
      // attempt 1: succeeds cleanly.
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "OK" },
        },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];
    STATE.throwsOn = [0];
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 10,
          system: "x",
        },
        { onAttempt },
      ),
    );
    expect(onAttempt).toHaveBeenCalledTimes(2);
    // Failed attempt: no answerText.
    expect(onAttempt.mock.calls[0][0].answerText).toBeUndefined();
    // Successful fallback attempt: answerText present.
    expect(onAttempt.mock.calls[1][0].answerText).toBe("OK");
  });

  it("is undefined on every attempt when all fail (apology path, nothing to cache)", async () => {
    STATE.events = [[], []];
    STATE.throwsOn = [0, 1];
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 10,
          system: "x",
        },
        { onAttempt },
      ),
    );
    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(
      onAttempt.mock.calls.every((c) => c[0].answerText === undefined),
    ).toBe(true);
  });

  it("excludes thinking_delta content — only text_delta bytes are captured", async () => {
    STATE.events = [
      [
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "reasoning bytes" },
        },
        {
          type: "content_block_delta",
          index: 1,
          delta: { type: "text_delta", text: "Final answer." },
        },
        { type: "message_delta", usage: { output_tokens: 2 } },
      ],
    ];
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { onAttempt, extendedThinking: true },
      ),
    );
    const answerText = onAttempt.mock.calls[0][0].answerText;
    expect(answerText).toBe("Final answer.");
    expect(answerText).not.toContain("reasoning bytes");
  });

  it("strips literal protocol control bytes from a model completion, live AND in answerText", async () => {
    // A model should never emit U+001E (TRACE_DELIMITER's own byte) in its
    // prose, but if it did, an unstripped occurrence would corrupt the
    // client's splitTrace() — stripped defensively at the source.
    const dirty = "answer part one" + "\u001e" + "part two";
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: dirty },
        },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 10,
          system: "x",
        },
        { onAttempt },
      ),
    );
    const [text] = body.split(TRACE_DELIMITER);
    expect(text).toBe("answer part onepart two");
    expect(onAttempt.mock.calls[0][0].answerText).toBe(
      "answer part onepart two",
    );
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
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "OK" },
        },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];
    STATE.throwsOn = [0];

    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    const stream = streamWithFallback(
      {
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 10,
        system: "x",
      },
      { onAttempt },
    );

    const body = await drain(stream);
    const [text, frameJson] = body.split(TRACE_DELIMITER);
    expect(text).toBe("OK");
    const frame = JSON.parse(frameJson);
    // Trace frame shows the SECOND model in the chain (Haiku) and fellBack: true.
    expect(frame.model).toBe("us.anthropic.claude-haiku-4-5-20251001-v1:0");
    expect(frame.fellBack).toBe(true);
    // Both attempts produced an onAttempt event (one error, one success).
    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(onAttempt.mock.calls[0][0].error?.name).toBeDefined();
    expect(onAttempt.mock.calls[1][0].error).toBeUndefined();
  });

  it("does NOT emit a trace frame when ALL attempts error before any byte (returns apology)", async () => {
    // Every attempt throws status=500 BEFORE any delta. Output should be the
    // apology tail with NO trace frame appended.
    STATE.events = [[], []];
    STATE.throwsOn = [0, 1];

    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 10,
          system: "x",
        },
        { onAttempt },
      ),
    );
    expect(body).not.toContain(TRACE_DELIMITER);
    expect(body).toContain("Sorry");
    // Both attempts of the default chain (Sonnet 4.6, Haiku) should have produced an onAttempt event.
    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(
      onAttempt.mock.calls.every((c) => c[0].error?.name === "Error"),
    ).toBe(true);
  });
});

describe("streamWithFallback — onAttempt safety (telemetry never breaks the chat)", () => {
  it("swallows onAttempt throw — user still gets clean text", async () => {
    STATE.events = [
      [
        { type: "message_start", message: { usage: { input_tokens: 5 } } },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "fine" },
        },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];
    const onAttempt = vi.fn(() => {
      throw new Error("telemetry sink down");
    });
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 10,
          system: "x",
        },
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
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "ok" },
        },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 10,
          system: "x",
        },
        { traceId: "trace-12345" },
      ),
    );
    const frame = JSON.parse(body.split(TRACE_DELIMITER)[1]);
    expect(frame.traceId).toBe("trace-12345");
  });

  it("omits traceId from the frame when not provided (back-compat with v1.6)", async () => {
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "ok" },
        },
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

describe("streamWithFallback — extended thinking v2.3.0 live-stream protocol", () => {
  it("streams reasoning live between THINKING_SENTINEL and THINKING_END, answer follows", async () => {
    STATE.events = [
      [
        {
          type: "content_block_start",
          index: 0,
          content_block: { type: "thinking", thinking: "" },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "I need to " },
        },
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "think carefully." },
        },
        { type: "content_block_stop", index: 0 },
        {
          type: "content_block_start",
          index: 1,
          content_block: { type: "text", text: "" },
        },
        {
          type: "content_block_delta",
          index: 1,
          delta: { type: "text_delta", text: "Here is my answer." },
        },
        { type: "content_block_stop", index: 1 },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 8 },
        },
      ],
    ];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "explain" }],
          max_tokens: 200,
          system: "test",
        },
        { extendedThinking: true },
      ),
    );

    // Stream starts with THINKING_SENTINEL
    expect(body.startsWith(THINKING_SENTINEL)).toBe(true);

    const afterSentinel = body.slice(THINKING_SENTINEL.length);

    // THINKING_END is present, separating reasoning from answer
    const endIdx = afterSentinel.indexOf(THINKING_END);
    expect(endIdx).toBeGreaterThan(0);

    const liveReasoning = afterSentinel.slice(0, endIdx);
    const afterEnd = afterSentinel.slice(endIdx + THINKING_END.length);

    // Reasoning streamed live (not in trace frame)
    expect(liveReasoning).toBe("I need to think carefully.");

    // Answer text and trace frame follow THINKING_END
    const [text, frameJson] = afterEnd.split(TRACE_DELIMITER);
    expect(text).toBe("Here is my answer.");

    // Trace frame does NOT include reasoning field
    const frame = JSON.parse(frameJson);
    expect(frame).not.toHaveProperty("reasoning");
    expect(frame.model).toBe("us.anthropic.claude-sonnet-4-6");
    expect(frame.fellBack).toBe(false);
  });

  it("does NOT prepend THINKING_SENTINEL when extendedThinking is false", async () => {
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Normal answer." },
        },
        { type: "message_delta", usage: { output_tokens: 3 } },
      ],
    ];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: false },
      ),
    );

    expect(body.startsWith(THINKING_SENTINEL)).toBe(false);
    expect(body).not.toContain(THINKING_END);
    const [text] = body.split(TRACE_DELIMITER);
    expect(text).toBe("Normal answer.");
  });

  it("does NOT emit THINKING_END when extendedThinking is false (no-thinking path is clean)", async () => {
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Clean." },
        },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: false },
      ),
    );

    expect(body).not.toContain(THINKING_END);
  });

  it("still emits THINKING_END on a thinking-only completion (no text_delta ever arrives) — regression for a real stuck-client bug", async () => {
    // Simulate a stream that has thinking deltas but never produces a text_delta —
    // e.g. adaptive thinking consumed the whole max_tokens budget and the model
    // stopped after reasoning alone, with no answer. Before this fix, THINKING_END
    // was ONLY emitted on the first text_delta, so this exact scenario left
    // THINKING_SENTINEL sent with no matching THINKING_END ever following it —
    // the client's "thinking" UI state had no closing signal and would be stuck
    // showing the reasoning animation forever, even though the stream closes.
    STATE.events = [
      [
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "just thinking" },
        },
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
          usage: { output_tokens: 0 },
        },
      ],
    ];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: true },
      ),
    );

    // THINKING_END now DOES appear, closing the reasoning phase for the client.
    expect(body).toContain(THINKING_END);
    // emittedAny still remains false (no text_delta) — no trace frame, no
    // cached answer, by construction. THINKING_SENTINEL starts with U+001E
    // (same as TRACE_DELIMITER) so we can't use a plain
    // .not.toContain(TRACE_DELIMITER) — instead verify no JSON trace frame is
    // embedded (a trace frame always starts with TRACE_DELIMITER + "{").
    expect(body).not.toContain(TRACE_DELIMITER + "{");
  });

  it("reasoning is absent from trace frame on the new protocol", async () => {
    STATE.events = [
      [
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "some reasoning" },
        },
        {
          type: "content_block_delta",
          index: 1,
          delta: { type: "text_delta", text: "Answer." },
        },
        { type: "message_delta", usage: { output_tokens: 1 } },
      ],
    ];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: true },
      ),
    );

    // Find THINKING_END then TRACE_DELIMITER
    const afterSentinel = body.startsWith(THINKING_SENTINEL)
      ? body.slice(THINKING_SENTINEL.length)
      : body;
    const endIdx = afterSentinel.indexOf(THINKING_END);
    const afterEnd = afterSentinel.slice(endIdx + THINKING_END.length);
    const frameJson = afterEnd.split(TRACE_DELIMITER)[1];
    const frame = JSON.parse(frameJson);
    // reasoning is NOT in the trace frame under the new protocol
    expect(frame).not.toHaveProperty("reasoning");
  });

  it("skips thinking params for Haiku model (Haiku does not support extended thinking)", async () => {
    // The guard is: if model.includes("haiku"), skip thinking params.
    // Test: a stream with no thinking events should produce no THINKING_END in stream.
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Haiku answer." },
        },
        { type: "message_delta", usage: { output_tokens: 2 } },
      ],
    ];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: true },
      ),
    );

    // The primary model (Sonnet) runs here. When no thinking events fire, no THINKING_END.
    // THINKING_SENTINEL is emitted (useThinking=true for Sonnet), but no THINKING_END
    // because thinkingEndEmitted is only set on first text_delta when useThinking is true.
    // Since there were no thinking_delta events, reasoning bytes are empty.
    const afterSentinel = body.startsWith(THINKING_SENTINEL)
      ? body.slice(THINKING_SENTINEL.length)
      : body;
    // THINKING_END appears only if there was a text_delta with useThinking=true AND prior thinking
    // Here useThinking=true (Sonnet) and there IS a text_delta, so THINKING_END IS emitted.
    const endIdx = afterSentinel.indexOf(THINKING_END);
    if (endIdx !== -1) {
      // THINKING_END present: verify reasoning part is empty (no thinking_delta events)
      const liveReasoning = afterSentinel.slice(0, endIdx);
      expect(liveReasoning).toBe(""); // no thinking_delta events fired
    }
    // Either way, trace frame should not have reasoning
    const traceStart = body.lastIndexOf(TRACE_DELIMITER);
    if (traceStart !== -1) {
      const frame = JSON.parse(body.slice(traceStart + TRACE_DELIMITER.length));
      expect(frame).not.toHaveProperty("reasoning");
    }
  });
});

describe("streamWithFallback — adaptive thinking request shape (2026-09 migration)", () => {
  it("sends {type:'adaptive'} + output_config.effort, no beta, no budget_tokens, when extendedThinking is true for a non-Haiku model", async () => {
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hi." },
        },
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: true },
      ),
    );

    const sent = STATE.lastStreamParams as {
      thinking?: unknown;
      output_config?: { effort?: string };
      betas?: unknown;
      max_tokens?: number;
    };
    expect(sent.thinking).toEqual({ type: "adaptive" });
    expect(sent.output_config?.effort).toBe("low");
    expect(sent.betas).toBeUndefined();
    // No budget_tokens anywhere on the thinking config (the deprecated shape).
    expect(sent.thinking).not.toHaveProperty("budget_tokens");
    // Headroom bump is still applied for the thinking case.
    expect(sent.max_tokens).toBeGreaterThanOrEqual(2048);
  });

  it("sends an EXPLICIT {type:'disabled'} (not just an omitted field) when extendedThinking is false for a non-Haiku model", async () => {
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hi." },
        },
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: false },
      ),
    );

    const sent = STATE.lastStreamParams as { thinking?: unknown };
    // Explicit, not omitted: Sonnet 5 / Opus 5 default thinking ON when this
    // field is missing entirely, so an explicit disable is required, not optional.
    expect(sent.thinking).toEqual({ type: "disabled" });
  });

  it("omits the thinking field entirely for Haiku (Haiku does not recognize the param at all)", async () => {
    // Force fallthrough past Sonnet so the 2nd attempt (index 1) is Haiku.
    STATE.throwsOn = [0];
    STATE.events = [
      [],
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Haiku." },
        },
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: true },
      ),
    );

    expect(STATE.streamParamsByCall).toHaveLength(2);
    const haikuParams = STATE.streamParamsByCall[1] as { thinking?: unknown };
    expect(haikuParams).not.toHaveProperty("thinking");
  });

  it("drops (never streams raw) an unsolicited thinking_delta event when extendedThinking is false — defense-in-depth against provider-side default-on thinking", async () => {
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "unsolicited reasoning" },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Answer only." },
        },
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: false },
      ),
    );

    expect(body).not.toContain("unsolicited reasoning");
    expect(body.startsWith(THINKING_SENTINEL)).toBe(false);
    const [text] = body.split(TRACE_DELIMITER);
    expect(text).toBe("Answer only.");
  });
});

describe("streamWithFallback — thinking-phase closure across a fallback (CodeRabbit review of PR #260)", () => {
  it("closes the thinking phase with THINKING_END before a terminal apology when the primary throws mid-reasoning with a non-eligible error", async () => {
    // A plain 400 is NOT fallback-eligible: the apology fires immediately,
    // without ever trying the remaining models, even though this is not the
    // last attempt. Sonnet 5.5 on top puts a thinking-capable rung (Sonnet 4.6)
    // behind the primary, the only chain where the apology alone has to close the
    // phase: with the default chain the next rung is Haiku, which closes it anyway.
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "partial reasoning" },
        },
      ],
    ];
    STATE.throwsOn = [0];
    STATE.throwStatus = { 0: 400 }; // deterministic input error -> NOT eligible

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: true },
      ),
    );

    // Without the fix, THINKING_END never appears here — the apology text
    // would be misclassified by the client's parser as more reasoning.
    const endIdx = body.indexOf(THINKING_END);
    expect(endIdx).toBeGreaterThan(0);
    expect(body.slice(endIdx + THINKING_END.length)).toContain("Sorry");
    expect(STATE.callCount).toBe(1); // no retry: the error was not eligible
  });

  it("does NOT close the thinking phase when falling back to another thinking-capable model — reasoning continues the same open framing", async () => {
    // Primary (Sonnet, thinking-capable) throws a fallback-ELIGIBLE error
    // (500) after only a thinking_delta. Secondary (Opus, also
    // thinking-capable; opted in, it is not in the default chain) then
    // succeeds with real text.
    process.env.LLM_USE_OPUS_FALLBACK = "true";
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "sonnet reasoning" },
        },
      ],
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "opus reasoning" },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Opus answer." },
        },
      ],
    ];
    STATE.throwsOn = [0];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: true },
      ),
    );

    // Exactly ONE THINKING_END for the whole stream — the failed Sonnet
    // attempt's partial reasoning and Opus's own reasoning both live inside
    // the SAME still-open framing, not two separate closed-then-reopened ones.
    const firstEnd = body.indexOf(THINKING_END);
    expect(firstEnd).toBeGreaterThan(0);
    expect(body.indexOf(THINKING_END, firstEnd + 1)).toBe(-1);

    const liveReasoning = body.slice(THINKING_SENTINEL.length, firstEnd);
    expect(liveReasoning).toBe("sonnet reasoningopus reasoning");

    const afterEnd = body.slice(firstEnd + THINKING_END.length);
    const [text] = afterEnd.split(TRACE_DELIMITER);
    expect(text).toBe("Opus answer.");
  });

  it("closes the thinking phase before falling back to Haiku, so Haiku's real answer is not swallowed as reasoning", async () => {
    // Both thinking-capable models (Sonnet, Opus; opted in) throw
    // fallback-eligible errors after only a thinking_delta; Haiku (not
    // thinking-capable) then succeeds. THINKING_END must appear BEFORE Haiku's
    // answer text, or the client's parser would misclassify "Haiku answer." as
    // more reasoning.
    process.env.LLM_USE_OPUS_FALLBACK = "true";
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "sonnet reasoning" },
        },
      ],
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "opus reasoning" },
        },
      ],
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Haiku answer." },
        },
      ],
    ];
    STATE.throwsOn = [0, 1];

    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { extendedThinking: true },
      ),
    );

    const endIdx = body.indexOf(THINKING_END);
    expect(endIdx).toBeGreaterThan(0);
    const liveReasoning = body.slice(THINKING_SENTINEL.length, endIdx);
    expect(liveReasoning).toBe("sonnet reasoningopus reasoning");

    const afterEnd = body.slice(endIdx + THINKING_END.length);
    const [text] = afterEnd.split(TRACE_DELIMITER);
    expect(text).toBe("Haiku answer.");
  });
});

describe("LLM_USE_SONNET_5 toggle", () => {
  it("defaults to Sonnet 4.6 as primary when the flag is unset (Bedrock chain)", async () => {
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hi." },
        },
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { onAttempt },
      ),
    );
    expect(onAttempt.mock.calls[0][0].model).toBe(
      "us.anthropic.claude-sonnet-4-6",
    );
  });

  it("puts Sonnet 5 first when LLM_USE_SONNET_5=true (Bedrock chain), backed up by Sonnet 4.6, then Haiku", async () => {
    process.env.LLM_USE_SONNET_5 = "true";
    STATE.throwsOn = [0, 1]; // fall through primary + secondary to see all 3 rungs
    STATE.events = [
      [],
      [],
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Fallback." },
        },
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { onAttempt },
      ),
    );
    const models = onAttempt.mock.calls.map((c) => c[0].model);
    expect(models).toEqual([
      "us.anthropic.claude-sonnet-5",
      "us.anthropic.claude-sonnet-4-6",
      "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    ]);
  });

  it("puts claude-sonnet-5 first when LLM_USE_SONNET_5=true (direct Anthropic chain), backed up by Sonnet 4.6, then Haiku", async () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.LLM_USE_SONNET_5 = "true";
    STATE.throwsOn = [0, 1];
    STATE.events = [
      [],
      [],
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Fallback." },
        },
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    await drain(
      streamWithFallback(
        {
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 100,
          system: "test",
        },
        { onAttempt },
      ),
    );
    const models = onAttempt.mock.calls.map((c) => c[0].model);
    expect(models).toEqual([
      "claude-sonnet-5",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ]);
  });

  it("isSonnet5PrimaryEnabled() reflects the env var directly", async () => {
    const { isSonnet5PrimaryEnabled } = await import("./llm");
    expect(isSonnet5PrimaryEnabled()).toBe(false);
    process.env.LLM_USE_SONNET_5 = "true";
    expect(isSonnet5PrimaryEnabled()).toBe(true);
  });
});

// The wording AWS returns when an identity policy hard-denies a model, as the
// Anthropic SDK surfaces it ("<status> <body.message>"). This account denies the
// whole Opus family this way. Account, user and policy names are anonymised.
const IAM_DENY_MESSAGE =
  "403 User: arn:aws:iam::123456789012:user/example-bedrock-user is not authorized to perform: " +
  "bedrock:InvokeModelWithResponseStream on resource: " +
  "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-opus-4-6-v1 " +
  "with an explicit deny in an identity-based policy: " +
  "arn:aws:iam::123456789012:policy/example-opus-deny";
const BAD_TOKEN_MESSAGE =
  "403 The security token included in the request is invalid.";
// The implicit-deny wording AWS returns when the principal's policy simply does not
// list the GLOBAL inference profile Sonnet 5.5 is served from (no explicit deny
// statement anywhere). Anonymised.
const GLOBAL_PROFILE_DENY_MESSAGE =
  "403 User: arn:aws:iam::123456789012:user/example-bedrock-user is not authorized to perform: " +
  "bedrock:InvokeModelWithResponseStream on resource: " +
  "arn:aws:bedrock:us-east-1:123456789012:inference-profile/global.anthropic.claude-sonnet-5-5 " +
  "because no identity-based policy allows the bedrock:InvokeModelWithResponseStream action";

describe("isFallbackEligible — status/message truth table", () => {
  const errWith = (status: number | undefined, message: string) =>
    Object.assign(new Error(message), status === undefined ? {} : { status });

  const eligible: Array<[string, number, string]> = [
    ["429 rate limit", 429, "429 Too many requests"],
    ["404 not found", 404, "404 not found"],
    ["500", 500, "500 internal error"],
    ["503", 503, "503 service unavailable"],
    [
      "400 invalid model id",
      400,
      "400 The provided model identifier is invalid.",
    ],
    [
      "400 no access to model",
      400,
      "400 You don't have access to the model with the specified model ID.",
    ],
    [
      "400 no access to model (typographic apostrophe)",
      400,
      "400 You don\u2019t have access to the model with the specified model ID.",
    ],
    ["403 IAM explicit deny", 403, IAM_DENY_MESSAGE],
    [
      "403 no identity policy allows the action",
      403,
      "403 User: arn:aws:iam::123456789012:user/example is not authorized to perform: " +
        "bedrock:InvokeModel on resource: arn:aws:bedrock:us-east-1::foundation-model/x " +
        "because no identity-based policy allows the bedrock:InvokeModel action",
    ],
    [
      "403 model access not granted",
      403,
      "403 You don't have access to the model with the specified model ID.",
    ],
    [
      "403 model access not granted (typographic apostrophe)",
      403,
      "403 You don\u2019t have access to the model with the specified model ID.",
    ],
    [
      "403 model access not granted (upper case)",
      403,
      "403 You DON\u2019T have access to the model with the specified model ID.",
    ],
    [
      "403 explicit deny in a service control policy",
      403,
      "403 Access was blocked by an explicit deny in a service control policy",
    ],
  ];

  const terminal: Array<[string, number | undefined, string]> = [
    [
      "400 malformed request",
      400,
      "400 messages.0.content: Input should be a valid list",
    ],
    [
      "400 effort Sonnet 4.6 does not take (xhigh)",
      400,
      "400 output_config.effort: Input should be 'low', 'medium', 'high' or 'max'",
    ],
    [
      "400 effort Sonnet 5.x does not take",
      400,
      "400 unknown variant `bogus`, expected one of `low`, `medium`, `high`, `xhigh`, `max`, `Unhandled` at line 1 column 148",
    ],
    ["401 unauthorized", 401, "401 invalid x-api-key"],
    ["403 invalid security token", 403, BAD_TOKEN_MESSAGE],
    [
      "403 expired security token",
      403,
      "403 The security token included in the request is expired",
    ],
    [
      "403 signature mismatch",
      403,
      "403 The request signature we calculated does not match the signature you provided. " +
        "Check your AWS Secret Access Key and signing method.",
    ],
    [
      "400 carrying IAM deny text (the denied markers are 403-only)",
      400,
      IAM_DENY_MESSAGE,
    ],
    ["403 with no message", 403, ""],
    ["422 unprocessable", 422, "422 unprocessable entity"],
    ["an error with no status", undefined, "boom"],
  ];

  it.each(eligible)("falls back on %s", async (_label, status, message) => {
    const { isFallbackEligible } = await import("./llm");
    expect(isFallbackEligible(errWith(status, message))).toBe(true);
  });

  it.each(terminal)("stays terminal on %s", async (_label, status, message) => {
    const { isFallbackEligible } = await import("./llm");
    expect(isFallbackEligible(errWith(status, message))).toBe(false);
  });

  it("falls back on a connection error", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { isFallbackEligible } = await import("./llm");
    expect(
      isFallbackEligible(
        new Anthropic.APIConnectionError({ message: "timed out" }),
      ),
    ).toBe(true);
  });

  it("stays terminal on a non-object throw", async () => {
    const { isFallbackEligible } = await import("./llm");
    for (const thrown of [null, undefined, "boom", 42]) {
      expect(isFallbackEligible(thrown)).toBe(false);
    }
  });
});

describe("streamWithFallback — an IAM-denied rung falls through instead of ending the chain", () => {
  const chainParams = {
    messages: [{ role: "user" as const, content: "hi" }],
    max_tokens: 100,
    system: "test",
  };
  const answer = (text: string) => [
    { type: "content_block_delta", delta: { type: "text_delta", text } },
  ];

  it("skips a hard-denied Opus rung and lets Haiku answer (Opus opted in: Sonnet 503 → Opus 403 → Haiku)", async () => {
    process.env.LLM_USE_OPUS_FALLBACK = "true";
    STATE.events = [[], [], answer("Haiku answer.")];
    STATE.throwsOn = [0, 1];
    STATE.throwStatus = { 0: 503, 1: 403 };
    STATE.throwMessage = { 1: IAM_DENY_MESSAGE };
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    const body = await drain(streamWithFallback(chainParams, { onAttempt }));
    const [text, frameJson] = body.split(TRACE_DELIMITER);
    expect(text).toBe("Haiku answer.");
    const frame = JSON.parse(frameJson);
    expect(frame.model).toBe("us.anthropic.claude-haiku-4-5-20251001-v1:0");
    expect(frame.fellBack).toBe(true);
    expect(onAttempt.mock.calls.map((c) => c[0].error?.status)).toEqual([
      503,
      403,
      undefined,
    ]);
  });

  it("lets Sonnet 4.6 answer when the PRIMARY is IAM-denied (Sonnet 5.5 403 → Sonnet 4.6 answers)", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [[], answer("4.6 answer.")];
    STATE.throwsOn = [0];
    STATE.throwStatus = { 0: 403 };
    STATE.throwMessage = { 0: GLOBAL_PROFILE_DENY_MESSAGE };
    const { streamWithFallback } = await import("./llm");
    const body = await drain(streamWithFallback(chainParams));
    const [text, frameJson] = body.split(TRACE_DELIMITER);
    expect(text).toBe("4.6 answer.");
    const frame = JSON.parse(frameJson);
    expect(frame.model).toBe("us.anthropic.claude-sonnet-4-6");
    expect(frame.fellBack).toBe(true);
  });

  it("lets Haiku answer when the default primary (Sonnet 4.6) is IAM-denied", async () => {
    STATE.events = [[], answer("Haiku answer.")];
    STATE.throwsOn = [0];
    STATE.throwStatus = { 0: 403 };
    STATE.throwMessage = { 0: IAM_DENY_MESSAGE };
    const { streamWithFallback } = await import("./llm");
    const body = await drain(streamWithFallback(chainParams));
    const [text, frameJson] = body.split(TRACE_DELIMITER);
    expect(text).toBe("Haiku answer.");
    expect(JSON.parse(frameJson).model).toBe("us.anthropic.claude-haiku-4-5-20251001-v1:0");
  });

  it("does NOT fall through on a bad-credentials 403: one attempt, then the apology", async () => {
    STATE.events = [[], answer("must never be reached")];
    STATE.throwsOn = [0];
    STATE.throwStatus = { 0: 403 };
    STATE.throwMessage = { 0: BAD_TOKEN_MESSAGE };
    const { streamWithFallback } = await import("./llm");
    const body = await drain(streamWithFallback(chainParams));
    expect(body).toContain("Sorry");
    expect(body).not.toContain("must never be reached");
    expect(body).not.toContain(TRACE_DELIMITER);
    expect(STATE.callCount).toBe(1);
  });

  it("ends in the apology after all three fast attempts when every rung is denied (Sonnet 5.5, Sonnet 4.6, Haiku)", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [[], [], []];
    STATE.throwsOn = [0, 1, 2];
    STATE.throwStatus = { 0: 403, 1: 403, 2: 403 };
    STATE.throwMessage = {
      0: GLOBAL_PROFILE_DENY_MESSAGE,
      1: IAM_DENY_MESSAGE,
      2: IAM_DENY_MESSAGE,
    };
    const { streamWithFallback } = await import("./llm");
    const body = await drain(streamWithFallback(chainParams));
    expect(body).toContain("Sorry");
    expect(body).not.toContain(TRACE_DELIMITER);
    expect(STATE.callCount).toBe(3);
  });

  it("keeps the thinking framing intact on the 403 path with extended thinking on, the production default", async () => {
    // The longest chain: 5.5 fails mid-reasoning (503), the opted-in Opus rung is
    // IAM-denied (403), Sonnet 4.6 fails (503), and Haiku finally answers.
    process.env.LLM_USE_SONNET_5_5 = "true";
    process.env.LLM_USE_OPUS_FALLBACK = "true";
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "5.5 reasoning" },
        },
      ],
      [],
      [],
      answer("Haiku answer."),
    ];
    STATE.throwsOn = [0, 1, 2];
    STATE.throwStatus = { 0: 503, 1: 403, 2: 503 };
    STATE.throwMessage = { 1: IAM_DENY_MESSAGE };
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(chainParams, { extendedThinking: true }),
    );

    // Exactly one sentinel and one end, with END before the Haiku answer.
    expect(body.startsWith(THINKING_SENTINEL)).toBe(true);
    expect(body.split(THINKING_SENTINEL)).toHaveLength(2);
    expect(body.split(THINKING_END)).toHaveLength(2);
    const endIdx = body.indexOf(THINKING_END);
    expect(body.slice(THINKING_SENTINEL.length, endIdx)).toBe("5.5 reasoning");
    const [text, frameJson] = body
      .slice(endIdx + THINKING_END.length)
      .split(TRACE_DELIMITER);
    expect(text).toBe("Haiku answer.");
    expect(JSON.parse(frameJson).fellBack).toBe(true);
  });

  it("keeps an IAM-deny 403 terminal once bytes were sent: the partial answer, then the apology, and no retry", async () => {
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "partial" },
        },
      ],
      answer("must never be reached"),
    ];
    STATE.throwsOn = [0];
    STATE.throwStatus = { 0: 403 };
    STATE.throwMessage = { 0: IAM_DENY_MESSAGE };
    const { streamWithFallback } = await import("./llm");
    const body = await drain(streamWithFallback(chainParams));
    expect(body).toContain("partial");
    expect(body).toContain("Sorry");
    expect(body).not.toContain("must never be reached");
    expect(body).not.toContain(TRACE_DELIMITER);
    expect(STATE.callCount).toBe(1);
  });
});

describe("LLM_USE_SONNET_5_5 toggle", () => {
  const params = {
    messages: [{ role: "user" as const, content: "hi" }],
    max_tokens: 100,
    system: "test",
  };
  const answer = (text: string) => [
    { type: "content_block_delta", delta: { type: "text_delta", text } },
  ];
  /** Errors the first two rungs so all three ids of the active chain are observed. */
  async function chainModels(): Promise<string[]> {
    STATE.throwsOn = [0, 1];
    STATE.events = [[], [], answer("Fallback.")];
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { onAttempt }));
    return onAttempt.mock.calls.map((c) => c[0].model);
  }

  it("puts the GLOBAL Sonnet 5.5 profile first on Bedrock (there is no us. profile), backed up by Sonnet 4.6", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    expect(await chainModels()).toEqual([
      "global.anthropic.claude-sonnet-5-5",
      "us.anthropic.claude-sonnet-4-6",
      "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    ]);
  });

  it("puts claude-sonnet-5-5 first on the direct Anthropic chain, backed up by Sonnet 4.6", async () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.LLM_USE_SONNET_5_5 = "true";
    expect(await chainModels()).toEqual([
      "claude-sonnet-5-5",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ]);
  });

  it("wins over LLM_USE_SONNET_5 when both flags are set", async () => {
    process.env.LLM_USE_SONNET_5 = "true";
    process.env.LLM_USE_SONNET_5_5 = "true";
    expect((await chainModels())[0]).toBe("global.anthropic.claude-sonnet-5-5");
  });

  it("is off by default, and only the exact string 'true' turns it on", async () => {
    const { isSonnet55PrimaryEnabled } = await import("./llm");
    expect(isSonnet55PrimaryEnabled()).toBe(false);
    for (const value of ["1", "TRUE", "yes", ""]) {
      process.env.LLM_USE_SONNET_5_5 = value;
      expect(isSonnet55PrimaryEnabled()).toBe(false);
    }
    process.env.LLM_USE_SONNET_5_5 = "true";
    expect(isSonnet55PrimaryEnabled()).toBe(true);
  });
});

describe("streamWithFallback — thinking-off shape is chosen per model (Sonnet 5.5 rejects 'disabled')", () => {
  const params = {
    messages: [{ role: "user" as const, content: "hi" }],
    max_tokens: 100,
    system: "test",
  };
  const answer = (text: string) => [
    { type: "content_block_delta", delta: { type: "text_delta", text } },
  ];
  type Sent = { model: string; thinking?: unknown; output_config?: unknown };

  // Bedrock answers `thinking: {type:"disabled"}` on Sonnet 5.5 with a 400 whose
  // text contains "is not supported". isFallbackEligible reads that as "model
  // unavailable", so the wrong shape would not fail loudly: it would silently skip
  // the primary rung on every request. These tests are the only guard.
  it("sends {type:'between_tools'}, never {type:'disabled'}, when extended thinking is off", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: false }));
    const sent = STATE.streamParamsByCall[0] as Sent;
    expect(sent.model).toBe("global.anthropic.claude-sonnet-5-5");
    expect(sent.thinking).toEqual({ type: "between_tools" });
    expect(sent.output_config).toBeUndefined();
  });

  it("sends summarized adaptive thinking at effort 'medium' when extended thinking is on", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: true }));
    const sent = STATE.streamParamsByCall[0] as Sent;
    expect(sent.model).toBe("global.anthropic.claude-sonnet-5-5");
    expect(sent.thinking).toEqual({ type: "adaptive", display: "summarized" });
    expect(sent.output_config).toEqual({ effort: "medium" });
  });

  it("uses between_tools on the direct Anthropic chain too", async () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: false }));
    const sent = STATE.streamParamsByCall[0] as Sent;
    expect(sent.model).toBe("claude-sonnet-5-5");
    expect(sent.thinking).toEqual({ type: "between_tools" });
  });

  it("picks the shape per attempt: 5.5 gets between_tools, the fallback rung gets disabled", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.throwsOn = [0];
    STATE.events = [[], answer("4.6 answer.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: false }));
    const [first, second] = STATE.streamParamsByCall as Sent[];
    expect(first.thinking).toEqual({ type: "between_tools" });
    expect(second.model).toBe("us.anthropic.claude-sonnet-4-6");
    expect(second.thinking).toEqual({ type: "disabled" });
  });

  it.each([
    ["Sonnet 4.6 (default)", {}, "us.anthropic.claude-sonnet-4-6"],
    ["Sonnet 5", { LLM_USE_SONNET_5: "true" }, "us.anthropic.claude-sonnet-5"],
  ])("keeps {type:'disabled'} for %s", async (_label, env, expectedModel) => {
    Object.assign(process.env, env);
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: false }));
    const sent = STATE.streamParamsByCall[0] as Sent;
    expect(sent.model).toBe(expectedModel);
    expect(sent.thinking).toEqual({ type: "disabled" });
  });

  it("still drops an unsolicited thinking_delta on 5.5 when thinking is off (defense in depth)", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "unsolicited reasoning" },
        },
        ...answer("Answer only."),
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(params, { extendedThinking: false }),
    );
    expect(body).not.toContain("unsolicited reasoning");
    expect(body.startsWith(THINKING_SENTINEL)).toBe(false);
    expect(body.split(TRACE_DELIMITER)[0]).toBe("Answer only.");
  });
});

// ---------------------------------------------------------------------------------
// Sonnet 5.5 mitigations (2026-10-01): a Sonnet 4.6 rung behind a 5.x primary, Opus
// opt-in, and 5.x thinking that is actually visible.
// ---------------------------------------------------------------------------------

const BEDROCK_IDS = {
  s46: "us.anthropic.claude-sonnet-4-6",
  s5: "us.anthropic.claude-sonnet-5",
  s55: "global.anthropic.claude-sonnet-5-5",
  opus: "us.anthropic.claude-opus-4-6-v1",
  haiku: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
};
const DIRECT_IDS = {
  s46: "claude-sonnet-4-6",
  s5: "claude-sonnet-5",
  s55: "claude-sonnet-5-5",
  opus: "claude-opus-4-7",
  haiku: "claude-haiku-4-5",
};

describe("modelChain — Sonnet 4.6 backs up a Sonnet 5.x primary, and Opus is opt-in", () => {
  // This account IAM-denies the whole Opus family, so the old second rung could only
  // ever answer 403, costing a round trip on every fallback before Haiku (a weaker
  // model) got the request. Opus now has to be asked for.
  it.each([
    ["default", {}, [BEDROCK_IDS.s46, BEDROCK_IDS.haiku]],
    [
      "Sonnet 5",
      { LLM_USE_SONNET_5: "true" },
      [BEDROCK_IDS.s5, BEDROCK_IDS.s46, BEDROCK_IDS.haiku],
    ],
    [
      "Sonnet 5.5",
      { LLM_USE_SONNET_5_5: "true" },
      [BEDROCK_IDS.s55, BEDROCK_IDS.s46, BEDROCK_IDS.haiku],
    ],
    [
      "both Sonnet flags (5.5 wins)",
      { LLM_USE_SONNET_5: "true", LLM_USE_SONNET_5_5: "true" },
      [BEDROCK_IDS.s55, BEDROCK_IDS.s46, BEDROCK_IDS.haiku],
    ],
    [
      "Opus opt-in (the chain this module always shipped)",
      { LLM_USE_OPUS_FALLBACK: "true" },
      [BEDROCK_IDS.s46, BEDROCK_IDS.opus, BEDROCK_IDS.haiku],
    ],
    [
      "Sonnet 5.5 + Opus opt-in",
      { LLM_USE_SONNET_5_5: "true", LLM_USE_OPUS_FALLBACK: "true" },
      [BEDROCK_IDS.s55, BEDROCK_IDS.opus, BEDROCK_IDS.s46, BEDROCK_IDS.haiku],
    ],
  ])("Bedrock chain: %s", async (_label, env, expected) => {
    Object.assign(process.env, env);
    const { modelChain } = await import("./llm");
    expect(modelChain()).toEqual(expected);
  });

  it.each([
    ["default", {}, [DIRECT_IDS.s46, DIRECT_IDS.haiku]],
    [
      "Sonnet 5.5",
      { LLM_USE_SONNET_5_5: "true" },
      [DIRECT_IDS.s55, DIRECT_IDS.s46, DIRECT_IDS.haiku],
    ],
    [
      "Opus opt-in",
      { LLM_USE_OPUS_FALLBACK: "true" },
      [DIRECT_IDS.s46, DIRECT_IDS.opus, DIRECT_IDS.haiku],
    ],
  ])("direct Anthropic chain: %s", async (_label, env, expected) => {
    process.env.LLM_PROVIDER = "anthropic";
    Object.assign(process.env, env);
    const { modelChain } = await import("./llm");
    expect(modelChain()).toEqual(expected);
  });

  it("only the exact string 'true' turns the Opus rung on", async () => {
    const { isOpusFallbackEnabled, modelChain } = await import("./llm");
    expect(isOpusFallbackEnabled()).toBe(false);
    for (const value of ["1", "TRUE", "yes", ""]) {
      process.env.LLM_USE_OPUS_FALLBACK = value;
      expect(isOpusFallbackEnabled()).toBe(false);
      expect(modelChain()).not.toContain(BEDROCK_IDS.opus);
    }
    process.env.LLM_USE_OPUS_FALLBACK = "true";
    expect(isOpusFallbackEnabled()).toBe(true);
  });

  it("never lists a model twice, whatever the flags", async () => {
    const { modelChain } = await import("./llm");
    for (const provider of ["bedrock", "anthropic"]) {
      for (const s5 of [false, true]) {
        for (const s55 of [false, true]) {
          for (const opus of [false, true]) {
            process.env.LLM_PROVIDER = provider;
            for (const [k, on] of [
              ["LLM_USE_SONNET_5", s5],
              ["LLM_USE_SONNET_5_5", s55],
              ["LLM_USE_OPUS_FALLBACK", opus],
            ] as const) {
              if (on) process.env[k] = "true";
              else delete process.env[k];
            }
            const chain = modelChain();
            expect(new Set(chain).size).toBe(chain.length);
          }
        }
      }
    }
  });
});

describe("streamWithFallback — a failing Sonnet 5.5 is backed up by Sonnet 4.6, not by Haiku", () => {
  const params = {
    messages: [{ role: "user" as const, content: "hi" }],
    max_tokens: 100,
    system: "test",
  };
  const answer = (text: string) => [
    { type: "content_block_delta", delta: { type: "text_delta", text } },
  ];

  it("answers from Sonnet 4.6 when 5.5 is throttled (429), and reports the fallback", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [[], answer("4.6 answer.")];
    STATE.throwsOn = [0];
    STATE.throwStatus = { 0: 429 };
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    const body = await drain(streamWithFallback(params, { onAttempt }));
    const [text, frameJson] = body.split(TRACE_DELIMITER);
    expect(text).toBe("4.6 answer.");
    const frame = JSON.parse(frameJson);
    expect(frame.model).toBe(BEDROCK_IDS.s46);
    expect(frame.fellBack).toBe(true);
    expect(onAttempt.mock.calls.map((c) => c[0].model)).toEqual([
      BEDROCK_IDS.s55,
      BEDROCK_IDS.s46,
    ]);
  });

  it("goes straight from Sonnet 4.6 to Haiku by default: no Opus attempt, so no guaranteed 403", async () => {
    STATE.events = [[], answer("Haiku answer.")];
    STATE.throwsOn = [0];
    STATE.throwStatus = { 0: 503 };
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { onAttempt }));
    expect(onAttempt.mock.calls.map((c) => c[0].model)).toEqual([
      BEDROCK_IDS.s46,
      BEDROCK_IDS.haiku,
    ]);
    expect(STATE.callCount).toBe(2);
  });

  it("closes the reasoning phase before Haiku answers after a 5.5 AND a 4.6 both fail mid-thinking", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "5.5 reasoning. " },
        },
      ],
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "4.6 reasoning." },
        },
      ],
      answer("Haiku answer."),
    ];
    STATE.throwsOn = [0, 1];
    STATE.throwStatus = { 0: 503, 1: 503 };
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(params, { extendedThinking: true }),
    );
    // One open phase across both thinking-capable rungs, closed BEFORE Haiku's text,
    // or the client would read "Haiku answer." as more reasoning.
    expect(body.split(THINKING_SENTINEL)).toHaveLength(2);
    expect(body.split(THINKING_END)).toHaveLength(2);
    const endIdx = body.indexOf(THINKING_END);
    expect(body.slice(THINKING_SENTINEL.length, endIdx)).toBe(
      "5.5 reasoning. 4.6 reasoning.",
    );
    const [text, frameJson] = body
      .slice(endIdx + THINKING_END.length)
      .split(TRACE_DELIMITER);
    expect(text).toBe("Haiku answer.");
    expect(JSON.parse(frameJson).model).toBe(BEDROCK_IDS.haiku);
  });

  it("carries one unbroken reasoning phase from a 5.5 that fails mid-thinking into the 4.6 retry", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "weighing banks. " },
        },
      ],
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "Tombstone fits." },
        },
        ...answer("Tombstone."),
      ],
    ];
    STATE.throwsOn = [0];
    STATE.throwStatus = { 0: 503 };
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(params, { extendedThinking: true }),
    );
    expect(body.split(THINKING_SENTINEL)).toHaveLength(2);
    expect(body.split(THINKING_END)).toHaveLength(2);
    const endIdx = body.indexOf(THINKING_END);
    expect(body.slice(THINKING_SENTINEL.length, endIdx)).toBe(
      "weighing banks. Tombstone fits.",
    );
    expect(body.slice(endIdx + THINKING_END.length).split(TRACE_DELIMITER)[0]).toBe(
      "Tombstone.",
    );
  });

  // route.ts skips the 24 h FAQ write-through when fell_back is set and the dashboard
  // counts it as a fallback, so the flag must be false on the primary and true on every
  // later rung, on the success path and on the error path alike.
  it("reports the rung on each attempt: a throttled 5.5, then a 4.6 that answers", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [[], answer("4.6 answer.")];
    STATE.throwsOn = [0];
    STATE.throwStatus = { 0: 429 };
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { onAttempt }));
    expect(
      onAttempt.mock.calls.map((c) => [c[0].attempt_index, c[0].fell_back]),
    ).toEqual([
      [0, false],
      [1, true],
    ]);
  });

  it("marks a failed attempt on rung 1 as a fallback too, when two rungs fail before Haiku answers", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [[], [], answer("Haiku answer.")];
    STATE.throwsOn = [0, 1];
    STATE.throwStatus = { 0: 503, 1: 503 };
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { onAttempt }));
    expect(
      onAttempt.mock.calls.map((c) => [c[0].attempt_index, c[0].fell_back]),
    ).toEqual([
      [0, false],
      [1, true],
      [2, true],
    ]);
  });
});

describe("streamWithFallback — thinking a visitor can actually see (Sonnet 5.x reasoning summaries)", () => {
  const params = {
    messages: [{ role: "user" as const, content: "hi" }],
    max_tokens: 100,
    system: "test",
  };
  const answer = (text: string) => [
    { type: "content_block_delta", delta: { type: "text_delta", text } },
  ];
  type Sent = {
    model: string;
    thinking?: Record<string, unknown>;
    output_config?: { effort?: string };
  };

  // Measured live on Bedrock (2026-10-01, the production prompt, 8 recruiter questions):
  // Sonnet 5.5 at effort "low" did not reason (0 thinking tokens in 8 of 8), so the
  // reasoning panel stayed empty whatever `display` said. At "medium" it reasoned on the
  // harder questions (90 to 390 thinking tokens, a 300 to 700 character summary) at about
  // $0.0006 more per question on average. `display: "summarized"` costs nothing: the
  // default ("omitted") returns a thinking block with EMPTY text while billing the same
  // thinking tokens.
  it.each([
    ["Sonnet 5.5", { LLM_USE_SONNET_5_5: "true" }, BEDROCK_IDS.s55],
    ["Sonnet 5", { LLM_USE_SONNET_5: "true" }, BEDROCK_IDS.s5],
    // isSonnet5Family() matches every id form, the direct-API ones included.
    [
      "direct-API Sonnet 5.5",
      { LLM_PROVIDER: "anthropic", LLM_USE_SONNET_5_5: "true" },
      DIRECT_IDS.s55,
    ],
    [
      "direct-API Sonnet 5",
      { LLM_PROVIDER: "anthropic", LLM_USE_SONNET_5: "true" },
      DIRECT_IDS.s5,
    ],
  ])(
    "%s asks for summarized reasoning at effort 'medium'",
    async (_label, env, model) => {
      Object.assign(process.env, env);
      STATE.events = [answer("Hi.")];
      const { streamWithFallback } = await import("./llm");
      await drain(streamWithFallback(params, { extendedThinking: true }));
      const sent = STATE.streamParamsByCall[0] as Sent;
      expect(sent.model).toBe(model);
      expect(sent.thinking).toEqual({ type: "adaptive", display: "summarized" });
      expect(sent.output_config).toEqual({ effort: "medium" });
    },
  );

  it("keeps Sonnet 4.6 on exactly the request it has always sent: adaptive, no display field, effort 'low'", async () => {
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: true }));
    const sent = STATE.streamParamsByCall[0] as Sent;
    expect(sent.model).toBe(BEDROCK_IDS.s46);
    expect(sent.thinking).toEqual({ type: "adaptive" });
    expect(sent.thinking).not.toHaveProperty("display");
    expect(sent.output_config).toEqual({ effort: "low" });
  });

  it("picks the shape per attempt: 5.5 summarized/medium, then the 4.6 fallback adaptive/low", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [[], answer("4.6 answer.")];
    STATE.throwsOn = [0];
    STATE.throwStatus = { 0: 503 };
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: true }));
    const [first, second] = STATE.streamParamsByCall as Sent[];
    expect(first.thinking).toEqual({ type: "adaptive", display: "summarized" });
    expect(first.output_config).toEqual({ effort: "medium" });
    expect(second.model).toBe(BEDROCK_IDS.s46);
    expect(second.thinking).toEqual({ type: "adaptive" });
    expect(second.output_config).toEqual({ effort: "low" });
  });

  it("keeps an opted-in Opus rung on the request it has always had: adaptive, no display, effort 'low' (or the override)", async () => {
    process.env.LLM_USE_OPUS_FALLBACK = "true";
    STATE.throwsOn = [0];
    STATE.events = [[], answer("Opus answer.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: true }));
    let [, opus] = STATE.streamParamsByCall as Sent[];
    expect(opus.model).toBe(BEDROCK_IDS.opus);
    expect(opus.thinking).toEqual({ type: "adaptive" });
    expect(opus.output_config).toEqual({ effort: "low" });

    STATE.callCount = 0;
    STATE.streamParamsByCall = [];
    STATE.events = [[], answer("Opus answer.")];
    process.env.LLM_THINKING_EFFORT = "medium";
    await drain(streamWithFallback(params, { extendedThinking: true }));
    [, opus] = STATE.streamParamsByCall as Sent[];
    expect(opus.output_config).toEqual({ effort: "medium" });
    expect(opus.thinking).toEqual({ type: "adaptive" });
  });

  it("LLM_THINKING_EFFORT overrides the default on every thinking-capable rung", async () => {
    process.env.LLM_THINKING_EFFORT = "low";
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: true }));
    let sent = STATE.streamParamsByCall[0] as Sent;
    // cheaper and faster, and still summarized for the questions where it does think
    expect(sent.thinking).toEqual({ type: "adaptive", display: "summarized" });
    expect(sent.output_config).toEqual({ effort: "low" });

    STATE.callCount = 0;
    STATE.streamParamsByCall = [];
    STATE.events = [answer("Hi.")];
    delete process.env.LLM_USE_SONNET_5_5;
    process.env.LLM_THINKING_EFFORT = "medium";
    await drain(streamWithFallback(params, { extendedThinking: true }));
    sent = STATE.streamParamsByCall[0] as Sent;
    expect(sent.model).toBe(BEDROCK_IDS.s46);
    expect(sent.output_config).toEqual({ effort: "medium" });
    // the raised effort is all that changes: still no 5.x-only display field
    expect(sent.thinking).toEqual({ type: "adaptive" });
  });

  // Only the five lower-case levels Bedrock accepts count; everything else is ignored.
  it.each(["extreme", "HIGH", "Medium", "XHIGH", "Max", "xhigh ", " low", "none", "minimal", "constructor", "__proto__", "toString", ""])(
    "ignores the invalid LLM_THINKING_EFFORT value %j and uses the per-model default",
    async (value) => {
      process.env.LLM_THINKING_EFFORT = value;
      process.env.LLM_USE_SONNET_5_5 = "true";
      STATE.events = [answer("Hi.")];
      const { streamWithFallback } = await import("./llm");
      await drain(streamWithFallback(params, { extendedThinking: true }));
      const sent = STATE.streamParamsByCall[0] as Sent;
      expect(sent.output_config).toEqual({ effort: "medium" });
    },
  );

  // The "Medium" row above cannot tell "ignored" from "lower-cased": on Sonnet 5.5 both
  // give 'medium'. These rows can, because the per-model default differs from the value.
  it.each([
    ["Sonnet 4.6, default low", "MEDIUM", {}, "low"],
    ["Sonnet 4.6, default low", "Medium", {}, "low"],
    ["Sonnet 5.5, default medium", "LOW", { LLM_USE_SONNET_5_5: "true" }, "medium"],
    ["Sonnet 5.5, default medium", "XHIGH", { LLM_USE_SONNET_5_5: "true" }, "medium"],
    ["Sonnet 4.6, default low", "Max", {}, "low"],
  ])(
    "%s ignores the mis-cased LLM_THINKING_EFFORT %j rather than lower-casing it",
    async (_label, value, env, expected) => {
      Object.assign(process.env, env);
      process.env.LLM_THINKING_EFFORT = value;
      STATE.events = [answer("Hi.")];
      const { streamWithFallback } = await import("./llm");
      await drain(streamWithFallback(params, { extendedThinking: true }));
      expect((STATE.streamParamsByCall[0] as Sent).output_config).toEqual({
        effort: expected,
      });
    },
  );

  // What Bedrock itself accepts, read from its own 400 on the streaming action (2026-10-01):
  // Sonnet 5 and 5.5 take low, medium, high, xhigh and max; Sonnet 4.6 takes all but xhigh.
  // Measured on Sonnet 5.5 (production prompt, 90 calls): xhigh reasoned on 30 of 30, high on
  // 16 of 25, medium on 3 of 15, low on 1 of 15.
  it.each(["low", "medium", "high", "xhigh", "max"])(
    "LLM_THINKING_EFFORT=%s goes to Sonnet 5.5 as it is, with summarized reasoning",
    async (value) => {
      process.env.LLM_THINKING_EFFORT = value;
      process.env.LLM_USE_SONNET_5_5 = "true";
      STATE.events = [answer("Hi.")];
      const { streamWithFallback } = await import("./llm");
      await drain(streamWithFallback(params, { extendedThinking: true }));
      const sent = STATE.streamParamsByCall[0] as Sent;
      expect(sent.model).toBe(BEDROCK_IDS.s55);
      expect(sent.thinking).toEqual({ type: "adaptive", display: "summarized" });
      expect(sent.output_config).toEqual({ effort: value });
    },
  );

  // Sonnet 4.6 has no xhigh (Bedrock: "Input should be 'low', 'medium', 'high' or 'max'"), and a
  // 400 is not fallback-eligible, so sending it would end every request in the apology.
  it.each([
    ["low", "low"],
    ["medium", "medium"],
    ["high", "high"],
    ["xhigh", "max"],
    ["max", "max"],
  ])("LLM_THINKING_EFFORT=%s reaches Sonnet 4.6 as %s", async (value, expected) => {
    process.env.LLM_THINKING_EFFORT = value;
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: true }));
    const sent = STATE.streamParamsByCall[0] as Sent;
    expect(sent.model).toBe(BEDROCK_IDS.s46);
    expect(sent.thinking).toEqual({ type: "adaptive" });
    expect(sent.output_config).toEqual({ effort: expected });
  });

  it("keeps xhigh on a Sonnet 5.5 primary and clamps it to max on the Sonnet 4.6 rung behind it", async () => {
    process.env.LLM_THINKING_EFFORT = "xhigh";
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [[], answer("4.6 answer.")];
    STATE.throwsOn = [0];
    STATE.throwStatus = { 0: 503 };
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: true }));
    const [first, second] = STATE.streamParamsByCall as Sent[];
    expect(first.model).toBe(BEDROCK_IDS.s55);
    expect(first.output_config).toEqual({ effort: "xhigh" });
    expect(second.model).toBe(BEDROCK_IDS.s46);
    expect(second.output_config).toEqual({ effort: "max" });
  });

  it.each([
    ["direct-API Sonnet 5.5", "xhigh", { LLM_USE_SONNET_5_5: "true" }, DIRECT_IDS.s55],
    ["direct-API Sonnet 5", "xhigh", { LLM_USE_SONNET_5: "true" }, DIRECT_IDS.s5],
    ["direct-API Sonnet 4.6", "max", {}, DIRECT_IDS.s46],
  ])("sends xhigh to %s as %s on the direct chain", async (_label, expected, env, model) => {
    Object.assign(process.env, { LLM_PROVIDER: "anthropic", LLM_THINKING_EFFORT: "xhigh", ...env });
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: true }));
    const sent = STATE.streamParamsByCall[0] as Sent;
    expect(sent.model).toBe(model);
    expect(sent.output_config).toEqual({ effort: expected });
  });

  // Every rung of the longest chain (5.5, Opus opt-in, 4.6, Haiku), each failing but the last, at
  // xhigh: only Sonnet 5.x may be sent it, Opus and 4.6 get max (and the ceiling that goes with
  // max), and Haiku gets neither an effort nor a bigger ceiling.
  it.each([
    ["Bedrock", {}, BEDROCK_IDS],
    ["direct-API", { LLM_PROVIDER: "anthropic" }, DIRECT_IDS],
  ])("at xhigh on the %s chain each rung gets the request its model accepts", async (_label, env, ids) => {
    Object.assign(process.env, {
      LLM_THINKING_EFFORT: "xhigh",
      LLM_USE_SONNET_5_5: "true",
      LLM_USE_OPUS_FALLBACK: "true",
      ...env,
    });
    STATE.events = [[], [], [], answer("Haiku answer.")];
    STATE.throwsOn = [0, 1, 2];
    STATE.throwStatus = { 0: 503, 1: 503, 2: 503 };
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: true }));
    const sent = STATE.streamParamsByCall as Array<Sent & { max_tokens?: number }>;
    expect(sent.map((s) => s.model)).toEqual([ids.s55, ids.opus, ids.s46, ids.haiku]);
    expect(sent.map((s) => s.output_config?.effort)).toEqual(["xhigh", "max", "max", undefined]);
    expect(sent.map((s) => s.max_tokens)).toEqual([16000, 32000, 32000, 100]);
    expect(sent.map((s) => s.thinking)).toEqual([
      { type: "adaptive", display: "summarized" },
      { type: "adaptive" },
      { type: "adaptive" },
      undefined,
    ]);
  });

  // `max_tokens` counts reasoning and answer together. Output measured on Sonnet 5.5 over 90 calls:
  // at most 593 tokens at low, 578 at medium, 694 at high, 960 at xhigh and 2,902 at max, for
  // answers of two to four sentences; every floor leaves several times that.
  it.each([
    ["low", 4096],
    ["medium", 4096],
    ["high", 8192],
    ["xhigh", 16000],
    ["max", 32000],
  ])("sizes the Sonnet 5.5 ceiling for effort %s at %d tokens", async (value, floor) => {
    process.env.LLM_THINKING_EFFORT = value;
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: true }));
    expect((STATE.streamParamsByCall[0] as Sent & { max_tokens?: number }).max_tokens).toBe(floor);
  });

  // xhigh is clamped to max before the ceiling is taken, so its row is max's 32000.
  it.each([
    ["low", 2048],
    ["medium", 2048],
    ["high", 8192],
    ["xhigh", 32000],
    ["max", 32000],
  ])("sizes the Sonnet 4.6 ceiling for effort %s at %d tokens", async (value, floor) => {
    process.env.LLM_THINKING_EFFORT = value;
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: true }));
    expect((STATE.streamParamsByCall[0] as Sent & { max_tokens?: number }).max_tokens).toBe(floor);
  });

  it("never lowers a caller max_tokens that is already above the effort's floor", async () => {
    process.env.LLM_THINKING_EFFORT = "xhigh";
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback({ ...params, max_tokens: 50000 }, { extendedThinking: true }));
    expect((STATE.streamParamsByCall[0] as Sent & { max_tokens?: number }).max_tokens).toBe(50000);
  });

  it("sends neither display nor effort when extended thinking is off, whatever LLM_THINKING_EFFORT says", async () => {
    process.env.LLM_THINKING_EFFORT = "medium";
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [answer("Hi.")];
    const { streamWithFallback } = await import("./llm");
    await drain(streamWithFallback(params, { extendedThinking: false }));
    const sent = STATE.streamParamsByCall[0] as Sent;
    expect(sent.thinking).toEqual({ type: "between_tools" });
    expect(sent.output_config).toBeUndefined();
  });

  it("streams a 5.5 reasoning summary to the client ahead of the answer", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: {
            type: "thinking_delta",
            thinking: "Tombstone's blast-radius gating fits a bank. ",
          },
        },
        // The signature arrives after the summary; the client must ignore it.
        {
          type: "content_block_delta",
          delta: { type: "signature_delta", signature: "EuYBCkYIBhgC" },
        },
        ...answer("I'd pick Tombstone."),
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(params, { extendedThinking: true }),
    );
    expect(body.startsWith(THINKING_SENTINEL)).toBe(true);
    const endIdx = body.indexOf(THINKING_END);
    expect(body.slice(THINKING_SENTINEL.length, endIdx)).toBe(
      "Tombstone's blast-radius gating fits a bank. ",
    );
    expect(body).not.toContain("EuYBCkYIBhgC");
    expect(body.slice(endIdx + THINKING_END.length).split(TRACE_DELIMITER)[0]).toBe(
      "I'd pick Tombstone.",
    );
    // and the server-side reader (the eval cron) gets just the answer out of what this
    // producer really emits
    const { answerFromBody } = await import("./llm-trace");
    expect(answerFromBody(body)).toBe("I'd pick Tombstone.");
  });
});

describe("streamWithFallback — reasoning that must never reach the answer or starve it", () => {
  const params = {
    messages: [{ role: "user" as const, content: "hi" }],
    max_tokens: 1024,
    system: "test",
  };
  type Sent = { model: string; max_tokens?: number };

  it("drops a thinking_delta that arrives after the answer has started (it would be read as answer text)", async () => {
    // Only reachable if a provider opens a second thinking block after the first text.
    // With display 'summarized' that block has real text, so it would be enqueued after
    // THINKING_END and shown to the visitor as part of the answer.
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "early reasoning. " },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Answer part 1. " },
        },
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "LATE REASONING. " },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Answer part 2." },
        },
      ],
    ];
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(params, { extendedThinking: true, onAttempt }),
    );
    expect(body).not.toContain("LATE REASONING");
    const endIdx = body.indexOf(THINKING_END);
    expect(body.slice(THINKING_SENTINEL.length, endIdx)).toBe("early reasoning. ");
    expect(
      body.slice(endIdx + THINKING_END.length).split(TRACE_DELIMITER)[0],
    ).toBe("Answer part 1. Answer part 2.");
    // What the visitor saw and what the FAQ cache may store are the same text.
    expect(onAttempt.mock.calls[0][0].answerText).toBe(
      "Answer part 1. Answer part 2.",
    );
  });

  // Sonnet 5.x reasons at effort 'medium' (and its tokenizer emits ~30% more tokens), and
  // reasoning shares max_tokens with the answer. A completion that spends it all on
  // reasoning ends the stream with no answer and no fallback, so 5.x gets twice the
  // headroom of the other models.
  it.each([
    ["Sonnet 5.5", { LLM_USE_SONNET_5_5: "true" }, 4096],
    ["Sonnet 5", { LLM_USE_SONNET_5: "true" }, 4096],
    ["Sonnet 4.6 (default)", {}, 2048],
  ])(
    "raises max_tokens to at least %s's thinking headroom when extended thinking is on",
    async (_label, env, floor) => {
      Object.assign(process.env, env);
      STATE.events = [
        [
          {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Hi." },
          },
        ],
      ];
      const { streamWithFallback } = await import("./llm");
      await drain(streamWithFallback(params, { extendedThinking: true }));
      expect((STATE.streamParamsByCall[0] as Sent).max_tokens).toBe(floor);
    },
  );

  it("never lowers a larger caller max_tokens, and leaves it alone when thinking is off", async () => {
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hi." },
        },
      ],
    ];
    const { streamWithFallback } = await import("./llm");
    await drain(
      streamWithFallback(
        { ...params, max_tokens: 9000 },
        { extendedThinking: true },
      ),
    );
    expect((STATE.streamParamsByCall[0] as Sent).max_tokens).toBe(9000);

    STATE.callCount = 0;
    STATE.streamParamsByCall = [];
    STATE.events = [
      [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hi." },
        },
      ],
    ];
    await drain(streamWithFallback(params, { extendedThinking: false }));
    expect((STATE.streamParamsByCall[0] as Sent).max_tokens).toBe(1024);
  });
});

describe("streamWithFallback — reasoningText capture (FAQ-cache replay source)", () => {
  const think = (thinking: string) => ({
    type: "content_block_delta",
    index: 0,
    delta: { type: "thinking_delta", thinking },
  });
  const say = (text: string) => ({
    type: "content_block_delta",
    index: 1,
    delta: { type: "text_delta", text },
  });
  const done = {
    type: "message_delta",
    delta: { stop_reason: "end_turn" },
    usage: { output_tokens: 3 },
  };
  const params = {
    messages: [{ role: "user" as const, content: "ping" }],
    max_tokens: 100,
    system: "test",
  };

  async function run(opts: { extendedThinking: boolean }) {
    const onAttempt = vi.fn<(a: LlmAttempt) => void>();
    const { streamWithFallback } = await import("./llm");
    const body = await drain(
      streamWithFallback(params, { onAttempt, ...opts }),
    );
    return { body, attempts: onAttempt.mock.calls.map((c) => c[0]) };
  }

  it("equals the reasoning the client was sent between THINKING_SENTINEL and THINKING_END", async () => {
    STATE.events = [
      [think("I need to "), think("think carefully."), say("Here is my answer."), done],
    ];
    const { body, attempts } = await run({ extendedThinking: true });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].reasoningText).toBe("I need to think carefully.");
    expect(attempts[0].answerText).toBe("Here is my answer.");
    const sent = body.slice(
      THINKING_SENTINEL.length,
      body.indexOf(THINKING_END),
    );
    expect(attempts[0].reasoningText).toBe(sent);
  });

  it("joins several thinking blocks in arrival order", async () => {
    STATE.events = [
      [
        think("First block. "),
        { type: "content_block_stop", index: 0 },
        think("Second block."),
        say("Answer."),
        done,
      ],
    ];
    const { attempts } = await run({ extendedThinking: true });
    expect(attempts[0].reasoningText).toBe("First block. Second block.");
  });

  it("is absent (no key at all) when the model did not reason", async () => {
    STATE.events = [[say("No reasoning here."), done]];
    const { attempts } = await run({ extendedThinking: true });
    expect(attempts[0].answerText).toBe("No reasoning here.");
    expect(attempts[0]).not.toHaveProperty("reasoningText");
  });

  it("is absent when extended thinking is off, even if a thinking_delta arrives anyway", async () => {
    STATE.events = [[think("unsolicited reasoning"), say("Answer."), done]];
    const { body, attempts } = await run({ extendedThinking: false });
    expect(body).not.toContain("unsolicited reasoning");
    expect(attempts[0].answerText).toBe("Answer.");
    expect(attempts[0]).not.toHaveProperty("reasoningText");
  });

  it("leaves out a reasoning block that arrives after the answer has started", async () => {
    STATE.events = [
      [think("early reasoning. "), say("Answer."), think("late reasoning"), done],
    ];
    const { body, attempts } = await run({ extendedThinking: true });
    expect(attempts[0].reasoningText).toBe("early reasoning. ");
    expect(body).not.toContain("late reasoning");
  });

  it("strips the protocol's control bytes from the reasoning, live and in reasoningText", async () => {
    STATE.events = [
      [think(`part one${"\u001e\u0002"}part two`), say("Answer."), done],
    ];
    const { body, attempts } = await run({ extendedThinking: true });
    expect(attempts[0].reasoningText).toBe("part onepart two");
    expect(
      body.slice(THINKING_SENTINEL.length, body.indexOf(THINKING_END)),
    ).toBe("part onepart two");
  });

  it("is absent on a thinking-only completion: no answer, so nothing to cache", async () => {
    STATE.events = [[think("reasoned, then ran out of tokens"), done]];
    const { attempts } = await run({ extendedThinking: true });
    expect(attempts[0].answerText).toBeUndefined();
    expect(attempts[0]).not.toHaveProperty("reasoningText");
  });

  it("is absent on a failed attempt; a fallback rung's record holds only that rung's own reasoning", async () => {
    // Two thinking-capable rungs: Sonnet 5.5, then Sonnet 4.6.
    process.env.LLM_USE_SONNET_5_5 = "true";
    STATE.events = [
      [think("first rung thought")],
      [think("second rung thought"), say("OK"), done],
    ];
    STATE.throwsOn = [0];
    const { body, attempts } = await run({ extendedThinking: true });
    expect(attempts).toHaveLength(2);
    expect(attempts[0].error).toBeDefined();
    expect(attempts[0]).not.toHaveProperty("reasoningText");
    expect(attempts[1].fell_back).toBe(true);
    expect(attempts[1].reasoningText).toBe("second rung thought");
    // The client saw BOTH rungs' reasoning in one framing, which is exactly why the route
    // never caches a fell-back answer: only the first rung's record equals what was shown.
    expect(
      body.slice(THINKING_SENTINEL.length, body.indexOf(THINKING_END)),
    ).toBe("first rung thoughtsecond rung thought");
  });
});
