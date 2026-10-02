import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The corpus stamp (`anvilry:corpus:built_at`) is the tag every FAQ-cache entry is
 * written under and compared against on read, so a change of stamp retires every
 * cached answer at once. `register()` runs once per server process, on every cold
 * start and every new instance; on Vercel the stamp must therefore change when the
 * DEPLOYMENT changes (new content), not when a process starts, or a cached answer
 * (and the reasoning summary stored with it) dies at the next cold start of any
 * function. These tests pin that, against the real chat cache over an in-memory
 * Redis that deserialises like the Upstash SDK (a numeric string comes back as a number).
 */

const STAMP_KEY = "anvilry:corpus:built_at";
const WEEK_SECONDS = 7 * 24 * 3600;
const T0 = 1_780_000_000_000;

/** In-memory stand-in for the Upstash client: just the commands the cache and the
 *  stamp use. Values are stored as strings and come back through JSON.parse when they
 *  parse (so "1780000000000" is a number and an entry is an object), like the SDK. */
class FakeRedis {
  readonly store = new Map<string, string>();
  readonly expiries = new Map<string, number>();

  private read(key: string): unknown {
    const raw = this.store.get(key);
    if (raw === undefined) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  async get(key: string) {
    return this.read(key);
  }
  async mget(...keys: string[]) {
    return keys.map((key) => this.read(key));
  }
  async set(key: string, value: string, opts?: { ex?: number }) {
    this.store.set(key, value);
    if (opts?.ex !== undefined) this.expiries.set(key, opts.ex);
    return "OK";
  }
  async expire(key: string, seconds: number) {
    this.expiries.set(key, seconds);
    return 1;
  }
  async zadd() {
    return 1;
  }
  async zremrangebyscore() {
    return 0;
  }
  async zremrangebyrank() {
    return 0;
  }
}

const holder = vi.hoisted(() => ({ redis: null as unknown }));
vi.mock("@/lib/redis", () => ({
  get redis() {
    return holder.redis;
  },
}));

import { faqCacheGet, faqCacheSet } from "@/lib/chat-cache";
import { register } from "./instrumentation";

let fake: FakeRedis;
let setSpy: ReturnType<typeof vi.spyOn>;
let expireSpy: ReturnType<typeof vi.spyOn>;
let getSpy: ReturnType<typeof vi.spyOn>;

function deployment(id: string | undefined): void {
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", id);
}

/** Later in wall-clock time: a new process never starts in the same millisecond. */
function later(ms = 60_000): void {
  vi.setSystemTime(Date.now() + ms);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  fake = new FakeRedis();
  holder.redis = fake;
  setSpy = vi.spyOn(fake, "set");
  expireSpy = vi.spyOn(fake, "expire");
  getSpy = vi.spyOn(fake, "get");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  // State every switch the code under test reads instead of inheriting the build's.
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("FAQ_CACHE_ENABLED", "true");
  vi.stubEnv("FAQ_CACHE_SEMANTIC_MATCH", "false");
  deployment("dpl_A");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  holder.redis = null;
});

describe("register() — the corpus stamp follows the deployment", () => {
  it("stamps a new deployment with the time of its first start and its id, expiring in a week", async () => {
    await register();
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith(STAMP_KEY, `${T0}:dpl_A`, {
      ex: WEEK_SECONDS,
    });
    expect(expireSpy).not.toHaveBeenCalled();
  });

  it("leaves the stamp alone on a later start of the same deployment and only keeps it alive", async () => {
    await register();
    setSpy.mockClear();
    later();
    await register();
    expect(setSpy).not.toHaveBeenCalled();
    expect(expireSpy).toHaveBeenCalledTimes(1);
    expect(expireSpy).toHaveBeenCalledWith(STAMP_KEY, WEEK_SECONDS);
    expect(fake.store.get(STAMP_KEY)).toBe(`${T0}:dpl_A`);
  });

  it("re-stamps when the deployment changes, keeping the new deployment's own start time", async () => {
    await register();
    deployment("dpl_B");
    later();
    await register();
    expect(fake.store.get(STAMP_KEY)).toBe(`${T0 + 60_000}:dpl_B`);
  });

  it("re-stamps on a rollback to the deployment that was live before", async () => {
    await register();
    deployment("dpl_B");
    later();
    await register();
    deployment("dpl_A");
    later();
    await register();
    expect(fake.store.get(STAMP_KEY)).toBe(`${T0 + 120_000}:dpl_A`);
  });

  it.each([
    ["a bare timestamp, as the previous release wrote it", String(T0 - 1)],
    ["an id that merely starts with this one", `${T0 - 1}:dpl_A2`],
    ["an id this one ends", `${T0 - 1}:xdpl_A`],
    ["a value with no timestamp", "dpl_A"],
  ])("does not take %s for the current deployment", async (_label, stored) => {
    fake.store.set(STAMP_KEY, stored);
    await register();
    expect(fake.store.get(STAMP_KEY)).toBe(`${T0}:dpl_A`);
    expect(expireSpy).not.toHaveBeenCalled();
  });

  it("reads a bare numeric stamp as the SDK returns it (a number) and replaces it", async () => {
    fake.store.set(STAMP_KEY, String(T0 - 1));
    expect(await fake.get(STAMP_KEY)).toBe(T0 - 1); // the fake deserialises like the SDK
    await register();
    expect(fake.store.get(STAMP_KEY)).toBe(`${T0}:dpl_A`);
  });

  it("stamps on every start, as before, where the host gives no deployment id", async () => {
    deployment(undefined);
    await register();
    later();
    await register();
    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalledTimes(2);
    expect(setSpy).toHaveBeenNthCalledWith(1, STAMP_KEY, String(T0), {
      ex: WEEK_SECONDS,
    });
    expect(setSpy).toHaveBeenNthCalledWith(2, STAMP_KEY, String(T0 + 60_000), {
      ex: WEEK_SECONDS,
    });
  });

  it("treats an empty deployment id as none", async () => {
    deployment("");
    await register();
    expect(setSpy).toHaveBeenCalledWith(STAMP_KEY, String(T0), {
      ex: WEEK_SECONDS,
    });
  });

  it("stamps a self-hosted production build (no VERCEL_ENV, NODE_ENV=production) the old way", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    deployment(undefined);
    await register();
    expect(setSpy).toHaveBeenCalledWith(STAMP_KEY, String(T0), {
      ex: WEEK_SECONDS,
    });
  });

  it.each([
    ["a preview deployment", { VERCEL_ENV: "preview" }],
    ["a development run", { VERCEL_ENV: "development" }],
    ["a local run", { VERCEL_ENV: "", NODE_ENV: "development" }],
    ["the edge runtime", { NEXT_RUNTIME: "edge" }],
  ])("never touches Redis on %s", async (_label, env) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    await register();
    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(expireSpy).not.toHaveBeenCalled();
  });

  it("does nothing when Redis is not configured", async () => {
    holder.redis = null;
    await expect(register()).resolves.toBeUndefined();
  });

  it("never lets a Redis failure escape, and the next start of the deployment tries again", async () => {
    setSpy.mockRejectedValueOnce(new Error("upstash is down"));
    await expect(register()).resolves.toBeUndefined();
    expect(fake.store.has(STAMP_KEY)).toBe(false);
    later();
    await register();
    expect(fake.store.get(STAMP_KEY)).toBe(`${T0 + 60_000}:dpl_A`);
  });

  it("logs the error's name, never its message, when the stamp cannot be written", async () => {
    const warn = vi.mocked(console.warn);
    class UpstashError extends Error {
      name = "UpstashError";
    }
    setSpy.mockRejectedValueOnce(
      new UpstashError('boom, command was: [["set","anvilry:corpus:built_at"]]'),
    );
    await register();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[config] corpus stamp not written:",
      "UpstashError",
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("command was");
    setSpy.mockRejectedValueOnce("not an Error");
    warn.mockClear();
    later();
    await register();
    expect(warn).toHaveBeenCalledWith("[config] corpus stamp not written:", "unknown");
  });

  it("survives a failing read and a failing expiry", async () => {
    getSpy.mockRejectedValueOnce(new Error("read failed"));
    await expect(register()).resolves.toBeUndefined();
    await register();
    expireSpy.mockRejectedValueOnce(new Error("expire failed"));
    await expect(register()).resolves.toBeUndefined();
  });

  it("reports whether a deployment id is present in the config log, never the id", async () => {
    const log = vi.mocked(console.log);
    await register();
    const line = log.mock.calls.find((call) => call[0] === "[config]");
    expect(line).toBeDefined();
    expect(JSON.parse(String(line?.[1])).deployment_id).toBe(true);
    expect(JSON.stringify(log.mock.calls)).not.toContain("dpl_A");

    log.mockClear();
    deployment(undefined);
    await register();
    const second = log.mock.calls.find((call) => call[0] === "[config]");
    expect(JSON.parse(String(second?.[1])).deployment_id).toBe(false);
  });
});

describe("the FAQ cache across process starts", () => {
  const QUESTION = "What is your strongest backend project?";
  const ANSWER = "I would start with AAVA Code.";

  async function cache(): Promise<void> {
    await faqCacheSet(QUESTION, ANSWER, "model-x", 0.001, "end_turn", "Why.");
  }

  it("keeps an answer, and the reasoning stored with it, through a cold start of the same deployment", async () => {
    await register();
    await cache();
    later(3_600_000); // an hour on: another function's cold start, or a new instance
    await register();
    const hit = await faqCacheGet(QUESTION);
    expect(hit?.tier).toBe("exact");
    expect(hit?.entry.answer).toBe(ANSWER);
    expect(hit?.entry).toHaveProperty("reasoning", "Why.");
  });

  it("still serves it after many starts of the same deployment", async () => {
    await register();
    await cache();
    for (let start = 0; start < 5; start++) {
      later();
      await register();
    }
    expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER);
  });

  it("retires every cached answer when a new deployment starts", async () => {
    await register();
    await cache();
    deployment("dpl_B");
    later();
    await register();
    expect(await faqCacheGet(QUESTION)).toBeNull();
  });

  it("retires them again on a rollback, instead of serving what a newer deployment left", async () => {
    await register();
    deployment("dpl_B");
    later();
    await register();
    await cache(); // written under dpl_B
    deployment("dpl_A");
    later();
    await register();
    expect(await faqCacheGet(QUESTION)).toBeNull();
  });

  it("caches again under the new deployment's stamp", async () => {
    await register();
    await cache();
    deployment("dpl_B");
    later();
    await register();
    await cache();
    later();
    await register(); // a cold start of dpl_B
    expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER);
  });

  it("still retires everything at every start where the host gives no deployment id", async () => {
    deployment(undefined);
    await register();
    await cache();
    expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER);
    later();
    await register();
    expect(await faqCacheGet(QUESTION)).toBeNull();
  });
});
