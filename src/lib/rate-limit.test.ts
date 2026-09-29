import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * rate-limit.ts tests. Two module boundaries are mocked, both at their
 * respective package-import boundary (matching the convention chat-cache.test.ts
 * and telemetry/emit.test.ts already use for @/lib/redis):
 *
 *  - @/lib/redis — the shared singleton. rate-limit.ts's module-scope
 *    `const limiter = redis ? new Ratelimit({...}) : null` is built ONCE at
 *    import time, so redisStateRef.current must be set BEFORE the dynamic
 *    `await import("./rate-limit")` in each test.
 *  - @upstash/ratelimit — mocked at the package boundary rather than faking
 *    its real Lua-script/evalsha protocol against a fake Redis client, which
 *    would be a second, divergent mocking strategy for no real benefit here:
 *    this file's own logic (checkRateLimit's fail-open catch, clientIp's
 *    header priority) is what needs coverage, not @upstash/ratelimit's own
 *    internals (that package has its own test suite upstream).
 */

const {
  redisMock,
  redisStateRef,
  ratelimitInstanceMock,
  RatelimitMock,
  prefixesHit,
} =
  vi.hoisted(() => {
    const redisMock = {};
    const redisStateRef: { current: typeof redisMock | null } = {
      current: redisMock,
    };
    const ratelimitInstanceMock = {
      limit:
        vi.fn<
          (identifier: string) => Promise<{ success: boolean; reset: number }>
        >(),
    };
    // A plain function, not an arrow: `new Ratelimit(...)` in rate-limit.ts
    // requires something constructible, and arrow functions can never be
    // called with `new` (throws "is not a constructor") regardless of what
    // vi.fn() wraps around them.
    const prefixesHit: string[] = [];
    const RatelimitMock = vi.fn(function RatelimitCtor(opts: {
      prefix: string;
    }) {
      return {
        limit: (identifier: string) => {
          prefixesHit.push(opts.prefix);
          return ratelimitInstanceMock.limit(identifier);
        },
      };
    });
    // @upstash/ratelimit's real Ratelimit class exposes static factory
    // methods (slidingWindow, fixedWindow, ...) on the constructor itself —
    // rate-limit.ts calls `Ratelimit.slidingWindow(8, "60 s")` as a plain
    // value passed into the constructor, so the mock just needs the static
    // to exist and return anything (rate-limit.ts never inspects its value).
    Object.assign(RatelimitMock, {
      slidingWindow: vi.fn(() => "sliding-window-config"),
    });
    return {
      redisMock,
      redisStateRef,
      ratelimitInstanceMock,
      RatelimitMock,
      prefixesHit,
    };
  });

vi.mock("@/lib/redis", () => ({
  get redis() {
    return redisStateRef.current;
  },
  isRedisConfigured: () => redisStateRef.current !== null,
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: RatelimitMock,
}));

beforeEach(() => {
  // rate-limit.ts builds its `limiter` once at module-evaluation time from
  // whatever `redis` is at that moment. Without resetting the module
  // registry, every test's `await import("./rate-limit")` after the first
  // would just return the SAME cached module — built against redisMock,
  // never reflecting a later test's `redisStateRef.current = null`.
  vi.resetModules();
  // Fixed clock: checkRateLimit's retryAfter math calls Date.now() a second
  // time, after the mock's `reset` value is computed here. A real clock makes
  // that arithmetic depend on however many real milliseconds elapse between
  // the two calls — fake timers pin both to the same instant instead.
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  redisStateRef.current = redisMock;
  RatelimitMock.mockClear();
  prefixesHit.length = 0;
  ratelimitInstanceMock.limit.mockReset();
  ratelimitInstanceMock.limit.mockResolvedValue({
    success: true,
    reset: Date.now() + 60_000,
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://anvilry.vercel.app/api/chat", { headers });
}

describe("rate-limit — module-load configuration", () => {
  it("isRateLimitEnabled is true when redis is configured", async () => {
    const { isRateLimitEnabled } = await import("./rate-limit");
    expect(isRateLimitEnabled).toBe(true);
    expect(RatelimitMock).toHaveBeenCalledTimes(3);
  });

  it("builds one limiter per route class, each with a SEPARATE key prefix and the unchanged 8/min limit", async () => {
    await import("./rate-limit");
    const prefixes = RatelimitMock.mock.calls.map(
      ([opts]) => (opts as { prefix: string }).prefix,
    );
    expect(prefixes).toEqual(
      expect.arrayContaining(["anvilry:chat", "anvilry:voice", "anvilry:beacon"]),
    );
    expect(new Set(prefixes).size).toBe(prefixes.length);
    const slidingWindow = (RatelimitMock as unknown as {
      slidingWindow: ReturnType<typeof vi.fn>;
    }).slidingWindow;
    expect(slidingWindow.mock.calls).toEqual([
      [8, "60 s"],
      [8, "60 s"],
      [8, "60 s"],
    ]);
  });

  it("isRateLimitEnabled is false, and no Ratelimit instance is built, when redis is null", async () => {
    redisStateRef.current = null;
    const { isRateLimitEnabled } = await import("./rate-limit");
    expect(isRateLimitEnabled).toBe(false);
    expect(RatelimitMock).not.toHaveBeenCalled();
  });
});

describe("checkRateLimit — configured happy path", () => {
  it("returns { ok: true } when the limiter reports success", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    await expect(checkRateLimit(makeRequest(), "chat")).resolves.toEqual({
      ok: true,
    });
  });

  it("returns { ok: false, retryAfter } when the limiter reports the budget is exhausted", async () => {
    // Both Date.now() calls (here, and inside checkRateLimit's retryAfter
    // math) resolve to the SAME fixed instant via vi.setSystemTime() in
    // beforeEach, so retryAfter is exactly ceil(12345/1000) — not merely
    // "close to it modulo real elapsed time."
    const reset = Date.now() + 12_345;
    ratelimitInstanceMock.limit.mockResolvedValue({ success: false, reset });
    const { checkRateLimit } = await import("./rate-limit");

    const result = await checkRateLimit(makeRequest(), "chat");
    expect(result).toEqual({ ok: false, retryAfter: 13 });
  });

  it("passes x-vercel-forwarded-for (unspoofable) as the identifier when present", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    await checkRateLimit(
      makeRequest({
        "x-vercel-forwarded-for": "203.0.113.1",
        "x-forwarded-for": "attacker-controlled, 203.0.113.1",
      }),
      "chat",
    );
    expect(ratelimitInstanceMock.limit).toHaveBeenCalledWith("203.0.113.1");
  });

  it("falls back to the LAST segment of x-forwarded-for (not the attacker-controlled first segment)", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    await checkRateLimit(
      makeRequest({ "x-forwarded-for": "attacker-spoofed, 203.0.113.9" }),
      "chat",
    );
    expect(ratelimitInstanceMock.limit).toHaveBeenCalledWith("203.0.113.9");
  });

  it('falls back to x-real-ip, then "anonymous", when no forwarded headers are present', async () => {
    const { checkRateLimit } = await import("./rate-limit");
    await checkRateLimit(makeRequest({ "x-real-ip": "203.0.113.42" }), "chat");
    expect(ratelimitInstanceMock.limit).toHaveBeenCalledWith("203.0.113.42");

    await checkRateLimit(makeRequest(), "chat");
    expect(ratelimitInstanceMock.limit).toHaveBeenLastCalledWith("anonymous");
  });
});

describe("checkRateLimit — fail-open behavior", () => {
  it("returns { ok: true } when redis is not configured (no limiter at all)", async () => {
    redisStateRef.current = null;
    const { checkRateLimit } = await import("./rate-limit");
    await expect(checkRateLimit(makeRequest(), "chat")).resolves.toEqual({
      ok: true,
    });
    // No limiter was ever built, so .limit() can't have been called.
    expect(ratelimitInstanceMock.limit).not.toHaveBeenCalled();
  });

  it("fails open to { ok: true } when limiter.limit() rejects, and logs a warning", async () => {
    const err = new Error("upstash quota exceeded");
    err.name = "UpstashError";
    ratelimitInstanceMock.limit.mockRejectedValue(err);
    const { checkRateLimit } = await import("./rate-limit");

    await expect(checkRateLimit(makeRequest(), "chat")).resolves.toEqual({
      ok: true,
    });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("[rate-limit] check failed, failing open"),
    );
  });
});

describe("checkRateLimit — per-class buckets (R-11)", () => {
  it("charges each route class against its own bucket", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    await checkRateLimit(makeRequest(), "chat");
    await checkRateLimit(makeRequest(), "voice");
    await checkRateLimit(makeRequest(), "beacon");
    expect(prefixesHit).toEqual([
      "anvilry:chat",
      "anvilry:voice",
      "anvilry:beacon",
    ]);
  });

  it("exhausting the voice bucket does not consume the chat bucket", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    ratelimitInstanceMock.limit.mockImplementation(async () => ({
      success: !prefixesHit.at(-1)?.endsWith(":voice"),
      reset: Date.now() + 5_000,
    }));
    await expect(checkRateLimit(makeRequest(), "voice")).resolves.toEqual({
      ok: false,
      retryAfter: 5,
    });
    await expect(checkRateLimit(makeRequest(), "chat")).resolves.toEqual({
      ok: true,
    });
  });
});

describe("checkRateLimit — cron bypass (R-12)", () => {
  const CRON_VALUE = "unit-test-cron-value";

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips the limiter entirely for a request carrying the valid cron secret", async () => {
    vi.stubEnv("CRON_SECRET", CRON_VALUE);
    ratelimitInstanceMock.limit.mockResolvedValue({
      success: false,
      reset: Date.now() + 10_000,
    });
    const { checkRateLimit } = await import("./rate-limit");
    const req = makeRequest({ authorization: `Bearer ${CRON_VALUE}` });
    await expect(checkRateLimit(req, "chat")).resolves.toEqual({ ok: true });
    expect(ratelimitInstanceMock.limit).not.toHaveBeenCalled();
  });

  it("still enforces the limit for a wrong cron secret", async () => {
    vi.stubEnv("CRON_SECRET", CRON_VALUE);
    ratelimitInstanceMock.limit.mockResolvedValue({
      success: false,
      reset: Date.now() + 10_000,
    });
    const { checkRateLimit } = await import("./rate-limit");
    const req = makeRequest({ authorization: "Bearer wrong" });
    await expect(checkRateLimit(req, "chat")).resolves.toEqual({
      ok: false,
      retryAfter: 10,
    });
  });

  it("does not bypass when CRON_SECRET is unset, even if the header looks plausible", async () => {
    vi.stubEnv("CRON_SECRET", "");
    ratelimitInstanceMock.limit.mockResolvedValue({
      success: false,
      reset: Date.now() + 10_000,
    });
    const { checkRateLimit } = await import("./rate-limit");
    const req = makeRequest({ authorization: "Bearer " });
    expect((await checkRateLimit(req, "chat")).ok).toBe(false);
  });
});
