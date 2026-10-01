import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level wiring test for /api/chat — NOT a re-test of streamWithFallback's
 * own fallback/streaming correctness (that's llm.test.ts) or chat-cache.ts's own
 * gating logic (that's chat-cache.test.ts). This only pins the GLUE: does the
 * route call the right things in the right order given the cache-eligibility
 * inputs (message count, X-Chat-Skip-Cache header, cache hit/miss)?
 *
 * Mock strategy matches src/app/api/error/route.test.ts: vi.hoisted shared
 * state, vi.mock factories, vi.resetModules() + dynamic re-import per test so
 * each test gets a fresh route module bound to fresh mock state.
 */

const {
  faqCacheGetMock,
  faqCacheSemanticGetMock,
  faqCacheSetMock,
  isSemanticMatchEnabledMock,
  streamWithFallbackMock,
  isConfiguredMock,
  rateLimitState,
  fetchMock,
} = vi.hoisted(() => ({
  faqCacheGetMock: vi.fn(),
  faqCacheSemanticGetMock: vi.fn(),
  faqCacheSetMock: vi.fn(),
  isSemanticMatchEnabledMock: vi.fn(() => false),
  streamWithFallbackMock: vi.fn(),
  isConfiguredMock: vi.fn(() => true),
  rateLimitState: { ok: true as boolean, retryAfter: 0 },
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/chat-cache", () => ({
  faqCacheGet: faqCacheGetMock,
  faqCacheSemanticGet: faqCacheSemanticGetMock,
  faqCacheSet: faqCacheSetMock,
  isSemanticMatchEnabled: isSemanticMatchEnabledMock,
}));

vi.mock("@/lib/llm", () => ({
  isConfigured: isConfiguredMock,
  streamWithFallback: streamWithFallbackMock,
  // Real value (U+001E) — the route builds the cache-hit response body with
  // this exact delimiter, and assertions below need to match it.
  TRACE_DELIMITER: "",
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() =>
    Promise.resolve(
      rateLimitState.ok
        ? { ok: true as const }
        : { ok: false as const, retryAfter: rateLimitState.retryAfter },
    ),
  ),
}));

vi.mock("@/lib/telemetry/emit", () => ({ emit: vi.fn() }));

// Passthrough withTrace, same shape as error/route.test.ts's mock.
vi.mock("@/lib/telemetry/with-trace", () => ({
  withTrace: vi.fn(
    async (
      _req: Request,
      _route: string,
      handler: (ctx: {
        traceId: string;
        spanId: string;
        startedAt: number;
        ipHash: string;
        uaHash: string;
        attrs: (extra: Record<string, unknown>) => void;
      }) => Promise<Response>,
    ) => {
      const ctx = {
        traceId: "test-trace-id",
        spanId: "test-span-id",
        startedAt: Date.now(),
        ipHash: "test-ip-hash",
        uaHash: "test-ua-hash",
        attrs: vi.fn(),
      };
      return handler(ctx);
    },
  ),
}));

let POST: (req: Request) => Promise<Response>;

async function importRoute() {
  vi.resetModules();
  const mod = await import("./route");
  POST = mod.POST;
}

beforeEach(async () => {
  faqCacheGetMock.mockReset().mockResolvedValue(null);
  faqCacheSemanticGetMock.mockReset().mockResolvedValue(null);
  faqCacheSetMock.mockReset();
  isSemanticMatchEnabledMock.mockReset().mockReturnValue(false);
  isConfiguredMock.mockReset().mockReturnValue(true);
  streamWithFallbackMock.mockReset().mockReturnValue(new ReadableStream());
  rateLimitState.ok = true;
  rateLimitState.retryAfter = 0;
  fetchMock
    .mockReset()
    .mockRejectedValue(new Error("fetch should not be called"));
  vi.stubGlobal("fetch", fetchMock);
  await importRoute();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeReq(
  messages: Array<{ role: "user" | "assistant"; content: unknown }>,
  headers: Record<string, string> = {},
): Request {
  const json = JSON.stringify({ messages });
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: json,
  });
}

describe("/api/chat — rate-limit class", () => {
  it("charges the chat bucket", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    await POST(makeReq([{ role: "user", content: "What stack do you use?" }]));
    expect(checkRateLimit).toHaveBeenCalledWith(expect.any(Request), "chat");
  });
});

describe("/api/chat — cache eligibility wiring", () => {
  it("checks the cache on a single first-turn text question", async () => {
    const res = await POST(
      makeReq([{ role: "user", content: "What stack do you use?" }]),
    );
    expect(res.status).toBe(200);
    expect(faqCacheGetMock).toHaveBeenCalledWith("What stack do you use?");
  });

  it("never checks the cache on a multi-turn request, even with an identical first message", async () => {
    const res = await POST(
      makeReq([
        { role: "user", content: "What stack do you use?" },
        { role: "assistant", content: "TypeScript, mostly." },
        { role: "user", content: "Anything else?" },
      ]),
    );
    expect(res.status).toBe(200);
    expect(faqCacheGetMock).not.toHaveBeenCalled();
    expect(streamWithFallbackMock).toHaveBeenCalledTimes(1);
  });

  it("honors X-Chat-Skip-Cache on an otherwise cache-eligible request, regardless of FAQ_CACHE_ENABLED state inside chat-cache.ts", async () => {
    // isSemanticMatchEnabledMock/faqCacheGetMock are mocked here at the module
    // boundary — the point is the ROUTE's own cacheEligible gate short-circuits
    // before ever calling into chat-cache.ts, independent of whatever that
    // module's own kill switch would otherwise decide.
    const res = await POST(
      makeReq([{ role: "user", content: "What stack do you use?" }], {
        "X-Chat-Skip-Cache": "1",
      }),
    );
    expect(res.status).toBe(200);
    expect(faqCacheGetMock).not.toHaveBeenCalled();
    expect(faqCacheSemanticGetMock).not.toHaveBeenCalled();
    expect(streamWithFallbackMock).toHaveBeenCalledTimes(1);
  });
});

describe("/api/chat — cache hit short-circuits the live path entirely", () => {
  it("returns the cached answer and never calls streamWithFallback or fetches live GitHub stats", async () => {
    faqCacheGetMock.mockResolvedValue({
      tier: "exact" as const,
      entry: {
        answer: "I mostly use TypeScript and Next.js.",
        model: "us.anthropic.claude-sonnet-4-6",
        costUsd: 0.001,
        cachedAt: Date.now(),
        corpusBuiltAt: null,
      },
    });

    const res = await POST(
      makeReq([{ role: "user", content: "What stack do you use?" }]),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Chat-Cache")).toBe("hit");
    const body = await res.text();
    expect(body.startsWith("I mostly use TypeScript and Next.js.")).toBe(true);

    expect(streamWithFallbackMock).not.toHaveBeenCalled();
    // getLiveGithubStats() calls global fetch — a cache hit returns before that
    // line is ever reached, so fetch must never fire.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls through to the live path on a cache miss", async () => {
    faqCacheGetMock.mockResolvedValue(null);
    const res = await POST(
      makeReq([{ role: "user", content: "What stack do you use?" }]),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Chat-Cache")).toBeNull();
    expect(streamWithFallbackMock).toHaveBeenCalledTimes(1);
  });
});

describe("/api/chat — write-through glue", () => {
  it("calls faqCacheSet with the question, answer, model, cost, and finish_reason from onAttempt", async () => {
    streamWithFallbackMock.mockImplementation((_params, opts) => {
      opts?.onAttempt?.({
        model: "us.anthropic.claude-sonnet-4-6",
        attempt_index: 0,
        fell_back: false,
        latency_ms: 500,
        finish_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
        answerText: "I mostly use TypeScript and Next.js.",
      });
      return new ReadableStream();
    });

    const res = await POST(
      makeReq([{ role: "user", content: "What stack do you use?" }]),
    );
    expect(res.status).toBe(200);

    expect(faqCacheSetMock).toHaveBeenCalledTimes(1);
    const [question, answer, model, cost, finishReason] =
      faqCacheSetMock.mock.calls[0]!;
    expect(question).toBe("What stack do you use?");
    expect(answer).toBe("I mostly use TypeScript and Next.js.");
    expect(model).toBe("us.anthropic.claude-sonnet-4-6");
    expect(cost).toBeGreaterThan(0);
    expect(finishReason).toBe("end_turn");
  });

  it("never calls faqCacheSet when the attempt has no answerText (error/fallback path)", async () => {
    streamWithFallbackMock.mockImplementation((_params, opts) => {
      opts?.onAttempt?.({
        model: "us.anthropic.claude-sonnet-4-6",
        attempt_index: 0,
        fell_back: false,
        latency_ms: 500,
        error: { name: "ThrottlingException", message: "rate limited" },
      });
      return new ReadableStream();
    });

    const res = await POST(
      makeReq([{ role: "user", content: "What stack do you use?" }]),
    );
    expect(res.status).toBe(200);
    expect(faqCacheSetMock).not.toHaveBeenCalled();
  });

  it("never calls faqCacheSet for an answer served by a fallback rung (a transient degradation must not be pinned in the 24 h cache)", async () => {
    streamWithFallbackMock.mockImplementation((_params, opts) => {
      opts?.onAttempt?.({
        model: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        attempt_index: 2,
        fell_back: true,
        latency_ms: 400,
        finish_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
        answerText: "I mostly use TypeScript and Next.js.",
      });
      return new ReadableStream();
    });

    const res = await POST(
      makeReq([{ role: "user", content: "What stack do you use?" }]),
    );
    expect(res.status).toBe(200);
    expect(faqCacheSetMock).not.toHaveBeenCalled();
  });

  it("never calls faqCacheSet on a multi-turn request (question is null, not cache-eligible)", async () => {
    streamWithFallbackMock.mockImplementation((_params, opts) => {
      opts?.onAttempt?.({
        model: "us.anthropic.claude-sonnet-4-6",
        attempt_index: 0,
        fell_back: false,
        latency_ms: 500,
        finish_reason: "end_turn",
        answerText: "Sure, here is more detail.",
      });
      return new ReadableStream();
    });

    const res = await POST(
      makeReq([
        { role: "user", content: "What stack do you use?" },
        { role: "assistant", content: "TypeScript." },
        { role: "user", content: "Anything else?" },
      ]),
    );
    expect(res.status).toBe(200);
    expect(faqCacheSetMock).not.toHaveBeenCalled();
  });
});

describe("/api/chat — llm.attempt cost telemetry", () => {
  type EmitArg = {
    kind: string;
    level?: string;
    attrs: Record<string, unknown>;
  };

  async function emittedAttempts(): Promise<EmitArg[]> {
    const { emit } = await import("@/lib/telemetry/emit");
    return (emit as unknown as { mock: { calls: [EmitArg][] } }).mock.calls
      .map(([e]) => e)
      .filter((e) => e.kind === "llm.attempt");
  }

  /** One mocked rung reporting `a` on top of a Sonnet 5.5 attempt. */
  function attemptOf(a: Record<string, unknown>): void {
    streamWithFallbackMock.mockImplementation((_params, opts) => {
      opts?.onAttempt?.({
        model: "global.anthropic.claude-sonnet-5-5",
        attempt_index: 0,
        fell_back: false,
        latency_ms: 900,
        ...a,
      });
      return new ReadableStream();
    });
  }

  const ask = () =>
    POST(makeReq([{ role: "user", content: "What do you build?" }]));

  afterEach(() => {
    vi.doUnmock("@/lib/llm-pricing"); // a doMock outlives the test that made it
  });

  it("records the verified price of the model that answered, not Sonnet 4.6's", async () => {
    streamWithFallbackMock.mockImplementation((_params, opts) => {
      opts?.onAttempt?.({
        model: "global.anthropic.claude-sonnet-5-5",
        attempt_index: 0,
        fell_back: false,
        latency_ms: 900,
        finish_reason: "end_turn",
        usage: {
          input_tokens: 29,
          cache_read_input_tokens: 5247,
          output_tokens: 286,
        },
        answerText: "I build production multi-agent LLM systems.",
      });
      return new ReadableStream();
    });

    await POST(makeReq([{ role: "user", content: "What do you build?" }]));

    const [attempt] = await emittedAttempts();
    // $2 / $10 / $0.20 per million tokens (Sonnet 5.5, global profile).
    expect(attempt.attrs.cost_usd).toBeCloseTo(
      (29 * 2.0 + 5247 * 0.2 + 286 * 10.0) / 1_000_000,
      10,
    );
  });

  it("leaves cost_usd out, and caches a zero saving, for a model with no verified price", async () => {
    streamWithFallbackMock.mockImplementation((_params, opts) => {
      opts?.onAttempt?.({
        model: "claude-sonnet-5-5", // direct-API id: not on the Bedrock price list
        attempt_index: 0,
        fell_back: false,
        latency_ms: 900,
        finish_reason: "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
        answerText: "I build agent infrastructure.",
      });
      return new ReadableStream();
    });

    await POST(makeReq([{ role: "user", content: "What do you build?" }]));

    const [attempt] = await emittedAttempts();
    expect(attempt.attrs).not.toHaveProperty("cost_usd");
    expect(faqCacheSetMock.mock.calls[0]![3]).toBe(0);
  });

  it("records cost_usd: 0, not nothing, for a priced model whose usage block is empty (free is not unknown)", async () => {
    attemptOf({ usage: {}, finish_reason: "end_turn", answerText: "ok" });
    await ask();
    const [attempt] = await emittedAttempts();
    expect(attempt.attrs).toHaveProperty("cost_usd", 0);
    expect(attempt.level).toBe("info");
  });

  it("leaves cost_usd out of an attempt that failed before any usage arrived, and logs it as an error", async () => {
    attemptOf({
      error: { name: "ThrottlingException", message: "429", status: 429 },
    });
    await ask();
    const [attempt] = await emittedAttempts();
    expect(attempt.attrs).not.toHaveProperty("cost_usd");
    expect(attempt.level).toBe("error");
  });

  it("still records what an attempt spent when it failed after message_start", async () => {
    attemptOf({
      usage: { input_tokens: 29, cache_read_input_tokens: 5247 },
      error: { name: "APIError", message: "stream died", status: 500 },
    });
    await ask();
    const [attempt] = await emittedAttempts();
    expect(attempt.attrs.cost_usd).toBeCloseTo(
      (29 * 2.0 + 5247 * 0.2) / 1_000_000,
      10,
    );
  });

  it("prices cache WRITES at the 1-hour rate end to end: every usage field reaches costUsd", async () => {
    attemptOf({
      usage: {
        input_tokens: 29,
        cache_creation_input_tokens: 5247,
        cache_read_input_tokens: 0,
        output_tokens: 286,
      },
      finish_reason: "end_turn",
      answerText: "ok",
    });
    await ask();
    const [attempt] = await emittedAttempts();
    // $2 in / $4 cache write (1 h) / $10 out per million (Sonnet 5.5, global profile).
    expect(attempt.attrs.cost_usd).toBeCloseTo(
      (29 * 2.0 + 5247 * 4.0 + 286 * 10.0) / 1_000_000,
      10,
    );
  });

  it("puts the model id and the usage block on the event: the dashboard prices its savings from them", async () => {
    const usage = {
      input_tokens: 29,
      cache_read_input_tokens: 5247,
      output_tokens: 286,
    };
    attemptOf({ usage, finish_reason: "end_turn", answerText: "ok" });
    await ask();
    const [attempt] = await emittedAttempts();
    expect(attempt.attrs).toMatchObject({
      model: "global.anthropic.claude-sonnet-5-5",
      usage,
    });
  });

  it("takes the cache_control TTL from CACHE_WRITE_TTL, not from a literal that could drift from the price", async () => {
    vi.doMock("@/lib/llm-pricing", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/llm-pricing")>()),
      CACHE_WRITE_TTL: "5m" as const,
    }));
    await importRoute(); // resets the module registry, so the route binds to the mock above
    await ask();

    const params = streamWithFallbackMock.mock.calls[0]![0] as {
      system: Array<{ cache_control?: { type: string; ttl: string } }>;
    };
    expect(params.system[0].cache_control).toEqual({
      type: "ephemeral",
      ttl: "5m",
    });
  });
});

describe("/api/chat — the extended-thinking switch that LLM_THINKING_EFFORT depends on", () => {
  const original = process.env.EXTENDED_THINKING;
  afterEach(() => {
    if (original === undefined) delete process.env.EXTENDED_THINKING;
    else process.env.EXTENDED_THINKING = original;
  });

  // llm.ts only sends an effort when the route asks for extended thinking, so a route that stops
  // passing it turns every LLM_THINKING_EFFORT setting into a silent no-op.
  it.each([
    [undefined, true],
    ["true", true],
    ["", true],
    ["FALSE", true],
    ["false", false],
  ])("EXTENDED_THINKING=%j reaches streamWithFallback as extendedThinking: %s", async (value, expected) => {
    if (value === undefined) delete process.env.EXTENDED_THINKING;
    else process.env.EXTENDED_THINKING = value;
    await POST(makeReq([{ role: "user", content: "What do you build?" }]));
    const opts = streamWithFallbackMock.mock.calls[0]![1] as { extendedThinking: boolean };
    expect(opts.extendedThinking).toBe(expected);
  });

  it("allows a 60 s function budget: a 5.5 run at max plus a fallback run on 4.6 can pass 30 s", async () => {
    const mod = await import("./route");
    expect(mod.maxDuration).toBeGreaterThanOrEqual(60);
  });
});
