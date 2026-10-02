import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `register()` runs once per server process, i.e. on every cold start and every new
 * instance of every function, and stamps `anvilry:corpus:built_at` in production. The FAQ
 * cache used to tag its entries with that stamp, so any cold start of any function retired
 * every cached answer (and the reasoning summary stored with it). On Vercel the cache now
 * tags entries with the id of the deployment that wrote them (VERCEL_DEPLOYMENT_ID, see
 * `ownDeploymentTag` in chat-cache.ts) and the stamp only feeds the dashboard's "Corpus age"
 * tile and the cache of a host that gives no deployment id. These tests pin both halves:
 * what `register()` writes, and what survives a start, against the REAL chat cache over an
 * in-memory Redis that deserialises like the Upstash SDK (a numeric string comes back as a
 * number).
 */

const STAMP_KEY = "anvilry:corpus:built_at";
const WEEK_SECONDS = 7 * 24 * 3600;
const T0 = 1_780_000_000_000;

/** In-memory stand-in for the Upstash client: just the commands the cache and the
 *  stamp use. Values are stored as strings and come back through JSON.parse when they
 *  parse (so "1780000000000" is a number and an entry is an object), like the SDK. */
class FakeRedis {
  readonly store = new Map<string, string>();

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
  async set(key: string, value: string) {
    this.store.set(key, value);
    return "OK";
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
  getSpy = vi.spyOn(fake, "get");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
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

describe("register() — the corpus stamp", () => {
  it("stamps the current time with a one-week expiry on every production start", async () => {
    await register();
    later();
    await register();
    expect(setSpy).toHaveBeenCalledTimes(2);
    expect(setSpy).toHaveBeenNthCalledWith(1, STAMP_KEY, String(T0), {
      ex: WEEK_SECONDS,
    });
    expect(setSpy).toHaveBeenNthCalledWith(2, STAMP_KEY, String(T0 + 60_000), {
      ex: WEEK_SECONDS,
    });
  });

  it("stamps a self-hosted production build (no VERCEL_ENV, NODE_ENV=production) the same way", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    deployment(undefined);
    await register();
    expect(setSpy).toHaveBeenCalledWith(STAMP_KEY, String(T0), {
      ex: WEEK_SECONDS,
    });
  });

  it.each([
    // A Vercel preview runs NODE_ENV=production too: VERCEL_ENV is what keeps it out.
    ["a preview deployment", { VERCEL_ENV: "preview", NODE_ENV: "production" }],
    ["a development run", { VERCEL_ENV: "development", NODE_ENV: "development" }],
    ["a local run", { VERCEL_ENV: "", NODE_ENV: "development" }],
    ["the edge runtime", { NEXT_RUNTIME: "edge" }],
  ])("never touches Redis on %s", async (_label, env) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    await register();
    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("does nothing when Redis is not configured", async () => {
    holder.redis = null;
    await expect(register()).resolves.toBeUndefined();
  });

  it("never lets a Redis failure escape (an exception out of register() fails every request on the instance)", async () => {
    setSpy.mockRejectedValueOnce(new Error("upstash is down"));
    await expect(register()).resolves.toBeUndefined();
    expect(fake.store.has(STAMP_KEY)).toBe(false);
    later();
    await register();
    expect(fake.store.get(STAMP_KEY)).toBe(String(T0 + 60_000));
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

    log.mockClear();
    deployment("");
    await register();
    const third = log.mock.calls.find((call) => call[0] === "[config]");
    expect(JSON.parse(String(third?.[1])).deployment_id).toBe(false);
  });
});

describe("the FAQ cache across process starts", () => {
  const QUESTION = "What is your strongest backend project?";
  const OTHER = "Tell me about your GenAI work.";
  const ANSWER = "I would start with AAVA Code.";

  async function cacheAs(id: string | undefined, question = QUESTION) {
    deployment(id);
    await faqCacheSet(question, ANSWER, "model-x", 0.001, "end_turn", "Why.");
  }

  it("keeps an answer, and the reasoning stored with it, through any number of starts of the same deployment", async () => {
    await register();
    await cacheAs("dpl_A");
    for (let start = 0; start < 5; start++) {
      later(3_600_000); // another function's cold start, or a new instance, an hour on
      await register();
    }
    const hit = await faqCacheGet(QUESTION);
    expect(hit?.tier).toBe("exact");
    expect(hit?.entry.answer).toBe(ANSWER);
    expect(hit?.entry).toHaveProperty("reasoning", "Why.");
  });

  it("tags the entry with the deployment id, not the stamp", async () => {
    await register();
    await cacheAs("dpl_A");
    const entryKey = [...fake.store.keys()].find(
      (key) => key.startsWith("anvilry:chat:cache:") && !key.endsWith(":index"),
    );
    expect(
      JSON.parse(fake.store.get(entryKey ?? "") ?? "{}").corpusBuiltAt,
    ).toBe("dpl_A");
  });

  it("keeps serving a deployment's answers whatever becomes of the stamp key", async () => {
    await register();
    await cacheAs("dpl_A");
    fake.store.delete(STAMP_KEY);
    expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER);
    fake.store.set(STAMP_KEY, "nonsense");
    expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER);
  });

  it("does not serve one deployment's answers to another, and caches again under the new one", async () => {
    await register();
    await cacheAs("dpl_A");
    expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER); // its own, so it was cached
    deployment("dpl_B");
    later();
    await register();
    expect(await faqCacheGet(QUESTION)).toBeNull();
    await cacheAs("dpl_B");
    later();
    await register(); // a cold start of dpl_B
    expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER);
  });

  it("never serves a preview's answer to production, or production's to a preview", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await cacheAs("dpl_PREVIEW");
    expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER);
    vi.stubEnv("VERCEL_ENV", "production");
    deployment("dpl_A");
    await register();
    expect(await faqCacheGet(QUESTION)).toBeNull();
    await cacheAs("dpl_A", OTHER);
    expect((await faqCacheGet(OTHER))?.entry.answer).toBe(ANSWER);
    deployment("dpl_PREVIEW");
    expect(await faqCacheGet(OTHER)).toBeNull();
  });

  it("gives a rolled-back deployment its own answers again and never the ones written in between", async () => {
    await register();
    await cacheAs("dpl_A");
    deployment("dpl_B");
    later();
    await register();
    await cacheAs("dpl_B", OTHER);
    expect((await faqCacheGet(OTHER))?.entry.answer).toBe(ANSWER);
    deployment("dpl_A");
    later();
    await register(); // dpl_A is promoted again
    expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER);
    expect(await faqCacheGet(OTHER)).toBeNull();
  });

  it("keeps a late write with the deployment that started it, when the next deployment has already started", async () => {
    await register();
    deployment("dpl_B");
    later();
    await register(); // dpl_B is up; a dpl_A request is still in flight
    await cacheAs("dpl_A"); // ... and its answer is written afterwards
    deployment("dpl_B");
    expect(await faqCacheGet(QUESTION)).toBeNull(); // the new deployment does not serve it
    deployment("dpl_A");
    expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER);
  });

  it.each([
    ["no deployment id", undefined],
    ["an empty deployment id", ""],
  ])(
    "falls back to the stamp, which every start re-writes, with %s",
    async (_label, id) => {
      deployment(id);
      await register();
      await faqCacheSet(QUESTION, ANSWER, "model-x", 0.001, "end_turn");
      expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER);
      later();
      await register();
      expect(await faqCacheGet(QUESTION)).toBeNull();
    },
  );
});
