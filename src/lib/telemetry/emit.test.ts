import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { TelemetryEvent } from "./schema";

/**
 * emit() is the dual-sink fire-and-forget telemetry pump. Tests verify:
 *  1. The console.log("[trace]", ...) sink ALWAYS fires — that is the source of
 *     truth, not Redis.
 *  2. The Upstash Redis sink runs against the right key shape (per-kind sorted
 *     set), with a parallel ZREMRANGEBYSCORE that trims past-7-days entries.
 *  3. Every Redis failure mode (rejected promise, throw on call) is swallowed
 *     and logged via console.warn — emit() never throws or returns a Promise.
 *  4. When the redis singleton is null (local dev without Upstash creds), the
 *     Redis path is skipped entirely but the console sink still fires.
 *
 * Mock strategy: vi.hoisted gives us a `redisMock` that the @/lib/redis module
 * factory hands out. Each test resets the mock state in beforeEach. Resetting
 * the singleton between "redis is set" and "redis is null" tests requires
 * mutating the mock's exports — vi.doMock + dynamic import would work too, but
 * the hoisted-state pattern is what llm.test.ts uses and matches the codebase's
 * existing convention (Phase 0.2).
 */

const { redisMock, redisStateRef } = vi.hoisted(() => {
  const redisMock = {
    zadd: vi.fn<(key: string, args: { score: number; member: string }) => Promise<number>>(),
    zremrangebyscore: vi.fn<(key: string, min: number, max: number) => Promise<number>>(),
  };
  // A ref object so the mock factory can read the CURRENT redis (or null)
  // without binding to the value at module-load time. Tests flip
  // redisStateRef.current to simulate the unconfigured-singleton path.
  const redisStateRef: { current: typeof redisMock | null } = { current: redisMock };
  return { redisMock, redisStateRef };
});

vi.mock("@/lib/redis", () => ({
  get redis() {
    return redisStateRef.current;
  },
  isRedisConfigured: () => redisStateRef.current !== null,
}));

beforeEach(() => {
  redisStateRef.current = redisMock;
  redisMock.zadd.mockReset();
  redisMock.zremrangebyscore.mockReset();
  redisMock.zadd.mockResolvedValue(1);
  redisMock.zremrangebyscore.mockResolvedValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Build a minimal valid TelemetryEvent for the given kind. */
function makeEvent(overrides: Partial<TelemetryEvent> = {}): TelemetryEvent {
  return {
    ts: 1_700_000_000_000,
    traceId: "trace-abc",
    spanId: "span-001",
    kind: "llm.attempt",
    level: "info",
    attrs: { model: "claude-sonnet-4-6" },
    ...overrides,
  };
}

describe("emit — console sink (always fires)", () => {
  it("calls console.log with [trace] prefix and a JSON-parseable payload", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { emit } = await import("./emit");
    const event = makeEvent();

    emit(event);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [prefix, payload] = logSpy.mock.calls[0];
    expect(prefix).toBe("[trace]");
    // Second arg must be a string AND round-trip through JSON.parse to the original event.
    expect(typeof payload).toBe("string");
    expect(JSON.parse(payload as string)).toEqual(event);
  });

  it("still fires console.log when redis is null (singleton unconfigured)", async () => {
    redisStateRef.current = null;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { emit } = await import("./emit");

    emit(makeEvent());

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(redisMock.zadd).not.toHaveBeenCalled();
    expect(redisMock.zremrangebyscore).not.toHaveBeenCalled();
  });

  it("does not throw when console.log itself throws (defensive)", async () => {
    // A user-installed monkey-patch on console.log that throws would otherwise
    // take down the request — emit must swallow it and continue to the Redis sink.
    vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("console is broken");
    });
    const { emit } = await import("./emit");

    expect(() => emit(makeEvent())).not.toThrow();
    // Redis sink still ran despite the broken console.
    expect(redisMock.zadd).toHaveBeenCalledTimes(1);
  });
});

describe("emit — redis sink (best-effort, fail-open)", () => {
  it("calls zadd with key shape `anvilry:trace:<kind>` and ts as the score", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { emit } = await import("./emit");
    const event = makeEvent({ kind: "llm.attempt", ts: 1_700_000_000_000 });

    emit(event);

    expect(redisMock.zadd).toHaveBeenCalledTimes(1);
    const [key, payload] = redisMock.zadd.mock.calls[0];
    expect(key).toBe("anvilry:trace:llm.attempt");
    expect(payload.score).toBe(1_700_000_000_000);
    expect(JSON.parse(payload.member)).toEqual(event);
  });

  it("calls zremrangebyscore with min=0 and max=ts-7days for retention", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { emit } = await import("./emit");
    const ts = 1_700_000_000_000;
    const SEVEN_DAYS = 7 * 86_400_000;

    emit(makeEvent({ kind: "tts.request", ts }));

    expect(redisMock.zremrangebyscore).toHaveBeenCalledTimes(1);
    const [key, min, max] = redisMock.zremrangebyscore.mock.calls[0];
    expect(key).toBe("anvilry:trace:tts.request");
    expect(min).toBe(0);
    expect(max).toBe(ts - SEVEN_DAYS);
  });

  it("uses a different key per kind (one sorted set per event kind)", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { emit } = await import("./emit");

    emit(makeEvent({ kind: "llm.attempt" }));
    emit(makeEvent({ kind: "tts.request" }));
    emit(makeEvent({ kind: "client.error" }));

    const keys = redisMock.zadd.mock.calls.map((c) => c[0]);
    expect(keys).toEqual([
      "anvilry:trace:llm.attempt",
      "anvilry:trace:tts.request",
      "anvilry:trace:client.error",
    ]);
  });

  it("swallows a rejected zadd and logs console.warn (does NOT throw)", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = new Error("upstash 503");
    err.name = "UpstashError";
    redisMock.zadd.mockRejectedValueOnce(err);
    const { emit } = await import("./emit");

    expect(() => emit(makeEvent())).not.toThrow();

    // Wait for the swallowed promise rejection to flush.
    await new Promise((r) => setImmediate(r));

    expect(warnSpy).toHaveBeenCalled();
    const warnArgs = warnSpy.mock.calls[0];
    expect(warnArgs[0]).toContain("[telemetry] redis sink failed");
    expect(warnArgs[1]).toBe("UpstashError");
  });

  it("returns synchronously — emit is void, not a Promise", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { emit } = await import("./emit");

    const result = emit(makeEvent());

    // The fire-and-forget contract: emit returns undefined (no Promise).
    // A caller MUST NOT be able to `await` it (which would couple request
    // latency to Upstash availability).
    expect(result).toBeUndefined();
  });

  it("skips the redis path entirely when redis is null", async () => {
    redisStateRef.current = null;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { emit } = await import("./emit");

    emit(makeEvent());
    emit(makeEvent({ kind: "tts.request" }));

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(redisMock.zadd).not.toHaveBeenCalled();
    expect(redisMock.zremrangebyscore).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("swallows a rejected zremrangebyscore (retention failure ≠ request failure)", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    redisMock.zremrangebyscore.mockRejectedValueOnce(new Error("trim failed"));
    const { emit } = await import("./emit");

    expect(() => emit(makeEvent())).not.toThrow();
    await new Promise((r) => setImmediate(r));

    // The trim is best-effort; failure is warned but never propagates.
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain("[telemetry] redis sink failed");
  });
});
