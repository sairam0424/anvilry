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
