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

const { redisMock, redisStateRef, ratelimitInstanceMock, RatelimitMock } =
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
    const RatelimitMock = vi.fn(function RatelimitCtor() {
      return ratelimitInstanceMock;
    });
    // @upstash/ratelimit's real Ratelimit class exposes static factory
    // methods (slidingWindow, fixedWindow, ...) on the constructor itself —
    // rate-limit.ts calls `Ratelimit.slidingWindow(8, "60 s")` as a plain
    // value passed into the constructor, so the mock just needs the static
    // to exist and return anything (rate-limit.ts never inspects its value).
    Object.assign(RatelimitMock, {
      slidingWindow: vi.fn(() => "sliding-window-config"),
    });
    return { redisMock, redisStateRef, ratelimitInstanceMock, RatelimitMock };
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
  redisStateRef.current = redisMock;
  RatelimitMock.mockClear();
  ratelimitInstanceMock.limit.mockReset();
  ratelimitInstanceMock.limit.mockResolvedValue({
    success: true,
    reset: Date.now() + 60_000,
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://anvilry.vercel.app/api/chat", { headers });
}

describe("rate-limit — module-load configuration", () => {
  it("isRateLimitEnabled is true when redis is configured", async () => {
    const { isRateLimitEnabled } = await import("./rate-limit");
    expect(isRateLimitEnabled).toBe(true);
    expect(RatelimitMock).toHaveBeenCalledTimes(1);
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
    await expect(checkRateLimit(makeRequest())).resolves.toEqual({
      ok: true,
    });
  });

  it("returns { ok: false, retryAfter } when the limiter reports the budget is exhausted", async () => {
    // reset is comfortably mid-second (12_345ms out) so the real elapsed time
    // between computing it here and rate-limit.ts's own Date.now() call a few
    // lines later can never cross a whole-second boundary in practice — the
    // expected retryAfter is thus a fixed, deterministic 13 (ceil(12345/1000)),
    // not a range.
    const reset = Date.now() + 12_345;
    ratelimitInstanceMock.limit.mockResolvedValue({ success: false, reset });
    const { checkRateLimit } = await import("./rate-limit");

    const result = await checkRateLimit(makeRequest());
    expect(result).toEqual({ ok: false, retryAfter: 13 });
  });

  it("passes x-vercel-forwarded-for (unspoofable) as the identifier when present", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    await checkRateLimit(
      makeRequest({
        "x-vercel-forwarded-for": "203.0.113.1",
        "x-forwarded-for": "attacker-controlled, 203.0.113.1",
      }),
    );
    expect(ratelimitInstanceMock.limit).toHaveBeenCalledWith("203.0.113.1");
  });

  it("falls back to the LAST segment of x-forwarded-for (not the attacker-controlled first segment)", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    await checkRateLimit(
      makeRequest({ "x-forwarded-for": "attacker-spoofed, 203.0.113.9" }),
    );
    expect(ratelimitInstanceMock.limit).toHaveBeenCalledWith("203.0.113.9");
  });

  it('falls back to x-real-ip, then "anonymous", when no forwarded headers are present', async () => {
    const { checkRateLimit } = await import("./rate-limit");
    await checkRateLimit(makeRequest({ "x-real-ip": "203.0.113.42" }));
    expect(ratelimitInstanceMock.limit).toHaveBeenCalledWith("203.0.113.42");

    await checkRateLimit(makeRequest());
    expect(ratelimitInstanceMock.limit).toHaveBeenLastCalledWith("anonymous");
  });
});

describe("checkRateLimit — fail-open behavior", () => {
  it("returns { ok: true } when redis is not configured (no limiter at all)", async () => {
    redisStateRef.current = null;
    const { checkRateLimit } = await import("./rate-limit");
    await expect(checkRateLimit(makeRequest())).resolves.toEqual({
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

    await expect(checkRateLimit(makeRequest())).resolves.toEqual({
      ok: true,
    });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("[rate-limit] check failed, failing open"),
    );
  });
});
