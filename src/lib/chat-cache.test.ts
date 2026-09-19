import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * chat-cache.ts tests. Mocks at the @/lib/redis singleton boundary — the same
 * pattern telemetry/emit.test.ts already uses — NOT the raw @upstash/redis
 * package. This is the correct boundary per redis.ts's own convention ("every
 * Redis consumer imports this same singleton"); a chat-cache-specific
 * @upstash/redis mock would be a second, divergent mocking strategy for the
 * exact same client. Since chat-cache.ts now also imports emit()/redact()
 * from the telemetry module, and emit()'s Redis sink goes through the SAME
 * mocked @/lib/redis singleton, emitCacheError's server.error events are
 * observable here too (via redisMock.zadd on the "anvilry:trace:server.error"
 * key) without a separate mock.
 */

const CORPUS_BUILT_AT_KEY = "anvilry:corpus:built_at";

const { redisMock, redisStateRef } = vi.hoisted(() => {
  const redisMock = {
    get: vi.fn<(key: string) => Promise<unknown>>(),
    set: vi.fn<
      (key: string, value: unknown, opts?: unknown) => Promise<unknown>
    >(),
    del: vi.fn<(key: string) => Promise<number>>(),
    zadd: vi.fn<(key: string, ...args: unknown[]) => Promise<number | null>>(),
    zrem: vi.fn<(key: string, ...members: string[]) => Promise<number>>(),
    zrange:
      vi.fn<(key: string, min: number, max: number) => Promise<string[]>>(),
    mget: vi.fn<(...keys: string[]) => Promise<unknown[]>>(),
    zremrangebyscore:
      vi.fn<(key: string, min: number, max: number) => Promise<number>>(),
    zremrangebyrank:
      vi.fn<(key: string, min: number, max: number) => Promise<number>>(),
  };
  const redisStateRef: { current: typeof redisMock | null } = {
    current: redisMock,
  };
  return { redisMock, redisStateRef };
});

// chat-cache.ts's semantic-tier branch does `await import("./faq-embeddings")`
// dynamically, but vitest's module mocking intercepts dynamic imports the
// same way as static ones. Mocked here (not left to the real module) so
// tests can control whether embedText "succeeds" without making a real AWS
// call — faq-embeddings.test.ts covers the real module's own AWS-call logic.
const { embedTextMock } = vi.hoisted(() => ({ embedTextMock: vi.fn() }));
vi.mock("./faq-embeddings", () => ({
  embedText: embedTextMock,
  cosineSimilarity: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  get redis() {
    return redisStateRef.current;
  },
  isRedisConfigured: () => redisStateRef.current !== null,
}));

/** Sets up redisMock.get AND redisMock.mget to answer the corpus-build-tag key
 *  with `tag` and every other key (the entry lookup) with `entryValue`. Covers
 *  faqCacheSemanticGet/faqCacheSet (still call redis.get for the corpus tag)
 *  and faqCacheGet (now merges the entry lookup + corpus tag into one mget). */
function mockGetByKey(entryValue: unknown, tag: string | null) {
  redisMock.get.mockImplementation(async (key: string) =>
    key === CORPUS_BUILT_AT_KEY ? tag : entryValue,
  );
  redisMock.mget.mockImplementation(async (...keys: string[]) =>
    keys.map((key) => (key === CORPUS_BUILT_AT_KEY ? tag : entryValue)),
  );
}

beforeEach(() => {
  redisStateRef.current = redisMock;
  for (const fn of Object.values(redisMock)) fn.mockReset();
  redisMock.get.mockResolvedValue(null);
  redisMock.set.mockResolvedValue("OK");
  redisMock.del.mockResolvedValue(1);
  redisMock.zadd.mockResolvedValue(1);
  redisMock.zrem.mockResolvedValue(1);
  redisMock.zrange.mockResolvedValue([]);
  redisMock.mget.mockResolvedValue([]);
  redisMock.zremrangebyscore.mockResolvedValue(0);
  redisMock.zremrangebyrank.mockResolvedValue(0);
  embedTextMock.mockReset();
  embedTextMock.mockResolvedValue(null);
  delete process.env.FAQ_CACHE_SEMANTIC_MATCH;
  delete process.env.FAQ_CACHE_ENABLED;
  // Keep test output clean — emitCacheError's console.warn and emit()'s own
  // console.log("[trace]", ...) sink both fire in several tests below.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("normalizeQuestion", () => {
  it("lowercases, trims, collapses whitespace, and strips trailing punctuation", async () => {
    const { normalizeQuestion } = await import("./chat-cache");
    expect(normalizeQuestion("  What's YOUR   Tech Stack??  ")).toBe(
      "what's your tech stack",
    );
    expect(normalizeQuestion("What is Pensieve?")).toBe("what is pensieve");
  });

  it("makes near-identical phrasing collide on the same normalized form", async () => {
    const { normalizeQuestion } = await import("./chat-cache");
    expect(normalizeQuestion("What is Pensieve?")).toBe(
      normalizeQuestion("what is pensieve"),
    );
    expect(normalizeQuestion("What is Pensieve?")).toBe(
      normalizeQuestion("  what is pensieve  "),
    );
  });

  it("strips a mix of trailing punctuation characters, not just one kind", async () => {
    const { normalizeQuestion } = await import("./chat-cache");
    expect(normalizeQuestion("what is pensieve?!.,;:")).toBe(
      "what is pensieve",
    );
  });

  it("stays fast on a long adversarial run of trailing punctuation (CodeQL js/polynomial-redos regression guard)", async () => {
    const { normalizeQuestion } = await import("./chat-cache");
    // normalizeQuestion previously ended in `.replace(/[?!.,;:]+$/g, "")`,
    // flagged by CodeQL as polynomial-time on adversarial input (many
    // repetitions of one of these chars). This input is exactly that shape,
    // reachable with unbounded length via the admin purge route (no length
    // cap there, unlike the main chat path) — assert it resolves quickly
    // rather than hanging, using a plain loop instead of that regex.
    const adversarial = "question" + "!".repeat(50_000);
    const start = performance.now();
    const result = normalizeQuestion(adversarial);
    expect(performance.now() - start).toBeLessThan(100);
    expect(result).toBe("question");
  });
});

describe("faqCacheKey", () => {
  it("is stable for the same normalized input", async () => {
    const { faqCacheKey } = await import("./chat-cache");
    expect(faqCacheKey("what is pensieve")).toBe(
      faqCacheKey("what is pensieve"),
    );
  });

  it("differs for different input and is namespaced under anvilry:chat:cache:", async () => {
    const { faqCacheKey } = await import("./chat-cache");
    const a = faqCacheKey("what is pensieve");
    const b = faqCacheKey("what is aava");
    expect(a).not.toBe(b);
    expect(a.startsWith("anvilry:chat:cache:")).toBe(true);
  });
});

describe("isFaqCacheEnabled (kill switch)", () => {
  it("is true by default", async () => {
    const { isFaqCacheEnabled } = await import("./chat-cache");
    expect(isFaqCacheEnabled()).toBe(true);
  });

  it("is false only when the env var is exactly 'false'", async () => {
    process.env.FAQ_CACHE_ENABLED = "false";
    const { isFaqCacheEnabled } = await import("./chat-cache");
    expect(isFaqCacheEnabled()).toBe(false);
  });

  it("stays true for any other value (e.g. a typo)", async () => {
    process.env.FAQ_CACHE_ENABLED = "FALSE";
    const { isFaqCacheEnabled } = await import("./chat-cache");
    expect(isFaqCacheEnabled()).toBe(true);
  });
});

describe("faqCacheGet", () => {
  it("returns null on a miss", async () => {
    const { faqCacheGet } = await import("./chat-cache");
    expect(await faqCacheGet("What is Pensieve?")).toBeNull();
  });

  it("returns a hit with tier=exact, parsing a JSON-string value", async () => {
    const entry = {
      answer: "It's a...",
      model: "sonnet",
      costUsd: 0.001,
      cachedAt: 1,
      corpusBuiltAt: null,
    };
    mockGetByKey(JSON.stringify(entry), null);
    const { faqCacheGet } = await import("./chat-cache");
    const hit = await faqCacheGet("What is Pensieve?");
    expect(hit).toEqual({ entry, tier: "exact" });
  });

  it("returns a hit unchanged when the client already returns a parsed object", async () => {
    const entry = {
      answer: "It's a...",
      model: "sonnet",
      costUsd: 0.001,
      cachedAt: 1,
      corpusBuiltAt: null,
    };
    mockGetByKey(entry, null);
    const { faqCacheGet } = await import("./chat-cache");
    const hit = await faqCacheGet("What is Pensieve?");
    expect(hit).toEqual({ entry, tier: "exact" });
  });

  it("treats a mismatched corpus build tag as a miss (stale-across-deploy protection)", async () => {
    const entry = {
      answer: "old answer",
      model: "sonnet",
      costUsd: 0.001,
      cachedAt: 1,
      corpusBuiltAt: "1000",
    };
    mockGetByKey(JSON.stringify(entry), "2000");
    const { faqCacheGet } = await import("./chat-cache");
    await expect(faqCacheGet("What is Pensieve?")).resolves.toBeNull();
  });

  it("treats a matching corpus build tag as a hit", async () => {
    const entry = {
      answer: "fresh answer",
      model: "sonnet",
      costUsd: 0.001,
      cachedAt: 1,
      corpusBuiltAt: "1000",
    };
    mockGetByKey(JSON.stringify(entry), "1000");
    const { faqCacheGet } = await import("./chat-cache");
    await expect(faqCacheGet("What is Pensieve?")).resolves.toEqual({
      entry,
      tier: "exact",
    });
  });

  it("treats both-null (local dev, corpus tag never stamped) as a match, not stale", async () => {
    const entry = {
      answer: "dev answer",
      model: "sonnet",
      costUsd: 0.001,
      cachedAt: 1,
      corpusBuiltAt: null,
    };
    mockGetByKey(JSON.stringify(entry), null);
    const { faqCacheGet } = await import("./chat-cache");
    await expect(faqCacheGet("What is Pensieve?")).resolves.toEqual({
      entry,
      tier: "exact",
    });
  });

  it("fails open to null when Redis throws, and emits a distinguishable server.error event", async () => {
    redisMock.mget.mockRejectedValue(new Error("upstash down"));
    const { faqCacheGet } = await import("./chat-cache");
    await expect(faqCacheGet("What is Pensieve?")).resolves.toBeNull();
    expect(redisMock.zadd).toHaveBeenCalledWith(
      "anvilry:trace:server.error",
      expect.anything(),
    );
  });

  it("fails open to null when malformed JSON is stored", async () => {
    mockGetByKey("{not valid json", null);
    const { faqCacheGet } = await import("./chat-cache");
    await expect(faqCacheGet("What is Pensieve?")).resolves.toBeNull();
  });

  it("fails open to null when Redis is not configured", async () => {
    redisStateRef.current = null;
    const { faqCacheGet } = await import("./chat-cache");
    await expect(faqCacheGet("What is Pensieve?")).resolves.toBeNull();
    expect(redisMock.mget).not.toHaveBeenCalled();
  });

  it("returns null and touches no Redis calls when the kill switch is off", async () => {
    process.env.FAQ_CACHE_ENABLED = "false";
    const { faqCacheGet } = await import("./chat-cache");
    await expect(faqCacheGet("What is Pensieve?")).resolves.toBeNull();
    expect(redisMock.mget).not.toHaveBeenCalled();
  });
});

describe("faqCacheSet", () => {
  const CLEAN = "end_turn";

  it("writes the entry (tagged with the current corpus build), indexes it, and trims the index by age and rank (on a sampled write)", async () => {
    // cachedAt (= Date.now() inside faqCacheSet) must be divisible by
    // TRIM_SAMPLE_EVERY (20) for the index trims to fire on this call.
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_020);
    mockGetByKey(null, "build-123");
    const { faqCacheSet, faqCacheKey, normalizeQuestion } =
      await import("./chat-cache");
    await faqCacheSet(
      "What is Pensieve?",
      "It's a...",
      "us.anthropic.claude-sonnet-4-6",
      0.0012,
      CLEAN,
    );

    const key = faqCacheKey(normalizeQuestion("What is Pensieve?"));
    expect(redisMock.set).toHaveBeenCalledWith(
      key,
      expect.stringContaining('"answer":"It\'s a..."'),
      { ex: 24 * 60 * 60 },
    );
    expect(redisMock.set).toHaveBeenCalledWith(
      key,
      expect.stringContaining('"corpusBuiltAt":"build-123"'),
      expect.anything(),
    );
    expect(redisMock.zadd).toHaveBeenCalledWith(
      "anvilry:chat:cache:index",
      expect.objectContaining({ member: key }),
    );
    expect(redisMock.zremrangebyscore).toHaveBeenCalled();
    expect(redisMock.zremrangebyrank).toHaveBeenCalledWith(
      "anvilry:chat:cache:index",
      0,
      -501,
    );
  });

  it("skips the index trims on a non-sampled write (still writes the entry and indexes it)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_007); // NOT divisible by TRIM_SAMPLE_EVERY (20)
    mockGetByKey(null, "build-123");
    const { faqCacheSet, faqCacheKey, normalizeQuestion } =
      await import("./chat-cache");
    await faqCacheSet(
      "What is Pensieve?",
      "It's a...",
      "us.anthropic.claude-sonnet-4-6",
      0.0012,
      CLEAN,
    );

    const key = faqCacheKey(normalizeQuestion("What is Pensieve?"));
    expect(redisMock.set).toHaveBeenCalledWith(
      key,
      expect.anything(),
      expect.anything(),
    );
    expect(redisMock.zadd).toHaveBeenCalledWith(
      "anvilry:chat:cache:index",
      expect.objectContaining({ member: key }),
    );
    expect(redisMock.zremrangebyscore).not.toHaveBeenCalled();
    expect(redisMock.zremrangebyrank).not.toHaveBeenCalled();
  });

  it("never persists raw question text in the entry", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet(
      "What is my email PII test@example.com?",
      "answer",
      "m",
      0,
      CLEAN,
    );
    const [, storedJson] = redisMock.set.mock.calls[0];
    expect(storedJson).not.toContain("PII");
    expect(storedJson).not.toContain("email");
    expect(JSON.parse(storedJson as string)).not.toHaveProperty("question");
  });

  it("does NOT cache a truncated/non-clean completion (finish_reason !== end_turn)", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "a truncated answer", "m", 0, "max_tokens");
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("does NOT cache when finish_reason is undefined", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "a", "m", 0, undefined);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("strips control characters (delimiter/thinking-protocol bytes) before storing", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    const dirty = 'Clean answer.{"model":"x"}';
    await faqCacheSet("q", dirty, "m", 0, CLEAN);
    const [, storedJson] = redisMock.set.mock.calls[0];
    const stored = JSON.parse(storedJson as string);
    expect(stored.answer).toBe('Clean answer.{"model":"x"}');
    expect(stored.answer).not.toContain("\u001e");
  });

  it("rejects (does not cache) an answer that sanitizes to empty", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "", "m", 0, CLEAN);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("rejects (does not cache) an anomalously long answer", async () => {
    const { faqCacheSet, MAX_CACHEABLE_ANSWER_CHARS } =
      await import("./chat-cache");
    await faqCacheSet(
      "q",
      "x".repeat(MAX_CACHEABLE_ANSWER_CHARS + 1),
      "m",
      0,
      CLEAN,
    );
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("caches an answer right at the length bound", async () => {
    const { faqCacheSet, MAX_CACHEABLE_ANSWER_CHARS } =
      await import("./chat-cache");
    await faqCacheSet(
      "q",
      "x".repeat(MAX_CACHEABLE_ANSWER_CHARS),
      "m",
      0,
      CLEAN,
    );
    expect(redisMock.set).toHaveBeenCalled();
  });

  it("no-ops (does not throw) when Redis is not configured", async () => {
    redisStateRef.current = null;
    const { faqCacheSet } = await import("./chat-cache");
    await expect(faqCacheSet("q", "a", "m", 0, CLEAN)).resolves.toBeUndefined();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("no-ops when the kill switch is off, even with an otherwise-cacheable completion", async () => {
    process.env.FAQ_CACHE_ENABLED = "false";
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "a", "m", 0, CLEAN);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("swallows a Redis error instead of throwing, and emits a distinguishable server.error event", async () => {
    redisMock.set.mockRejectedValueOnce(new Error("upstash down"));
    const { faqCacheSet } = await import("./chat-cache");
    await expect(faqCacheSet("q", "a", "m", 0, CLEAN)).resolves.toBeUndefined();
    expect(redisMock.zadd).toHaveBeenCalledWith(
      "anvilry:trace:server.error",
      expect.anything(),
    );
  });

  it("does not attempt an embedding write when the semantic flag is off", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "a", "m", 0, CLEAN);
    // Only the base entry write — no second `set` call for an embedding-augmented entry.
    expect(redisMock.set).toHaveBeenCalledTimes(1);
  });
});

describe("faqCacheSemanticGet", () => {
  it("returns null when the semantic flag is off, without touching Redis", async () => {
    const { faqCacheSemanticGet } = await import("./chat-cache");
    await expect(faqCacheSemanticGet("What is Pensieve?")).resolves.toBeNull();
    expect(redisMock.zrange).not.toHaveBeenCalled();
  });

  it("returns null when Redis is not configured, even with the flag on", async () => {
    process.env.FAQ_CACHE_SEMANTIC_MATCH = "true";
    redisStateRef.current = null;
    const { faqCacheSemanticGet } = await import("./chat-cache");
    await expect(faqCacheSemanticGet("What is Pensieve?")).resolves.toBeNull();
  });

  it("returns null when the kill switch is off, even with the semantic flag on", async () => {
    process.env.FAQ_CACHE_SEMANTIC_MATCH = "true";
    process.env.FAQ_CACHE_ENABLED = "false";
    const { faqCacheSemanticGet } = await import("./chat-cache");
    await expect(faqCacheSemanticGet("What is Pensieve?")).resolves.toBeNull();
    expect(redisMock.zrange).not.toHaveBeenCalled();
  });
});

describe("isSemanticMatchEnabled", () => {
  it("is false by default", async () => {
    const { isSemanticMatchEnabled } = await import("./chat-cache");
    expect(isSemanticMatchEnabled()).toBe(false);
  });

  it("is true only when the env var is exactly 'true'", async () => {
    process.env.FAQ_CACHE_SEMANTIC_MATCH = "true";
    const { isSemanticMatchEnabled } = await import("./chat-cache");
    expect(isSemanticMatchEnabled()).toBe(true);
  });
});

describe("faqCachePurge", () => {
  it("deletes the entry key and removes it from the index, reporting status:purged on a real hit", async () => {
    redisMock.del.mockResolvedValueOnce(1);
    const { faqCachePurge, faqCacheKey, normalizeQuestion } =
      await import("./chat-cache");
    const result = await faqCachePurge("What is Pensieve?");
    const key = faqCacheKey(normalizeQuestion("What is Pensieve?"));
    expect(redisMock.del).toHaveBeenCalledWith(key);
    expect(redisMock.zrem).toHaveBeenCalledWith(
      "anvilry:chat:cache:index",
      key,
    );
    expect(result).toEqual({ status: "purged", key });
  });

  it("reports status:not_found when the key did not exist (idempotent, not an error)", async () => {
    redisMock.del.mockResolvedValueOnce(0);
    const { faqCachePurge } = await import("./chat-cache");
    const result = await faqCachePurge("Some question nobody asked");
    expect(result.status).toBe("not_found");
  });

  it("reports status:error (distinguishable from not_found) when Redis is not configured", async () => {
    redisStateRef.current = null;
    const { faqCachePurge } = await import("./chat-cache");
    const result = await faqCachePurge("q");
    expect(result.status).toBe("error");
  });

  it("swallows a Redis error, reports status:error, and emits a distinguishable server.error event", async () => {
    redisMock.del.mockRejectedValueOnce(new Error("upstash down"));
    const { faqCachePurge } = await import("./chat-cache");
    const result = await faqCachePurge("q");
    expect(result.status).toBe("error");
    if (result.status === "error")
      expect(result.message).toContain("upstash down");
    expect(redisMock.zadd).toHaveBeenCalledWith(
      "anvilry:trace:server.error",
      expect.anything(),
    );
  });

  it("works even when the kill switch is off (purge is intentionally not gated on isFaqCacheEnabled)", async () => {
    process.env.FAQ_CACHE_ENABLED = "false";
    redisMock.del.mockResolvedValueOnce(1);
    const { faqCachePurge } = await import("./chat-cache");
    const result = await faqCachePurge("q");
    expect(result.status).toBe("purged");
  });

  it("does not resurrect a purged entry via the delayed embedding write (race guard)", async () => {
    process.env.FAQ_CACHE_SEMANTIC_MATCH = "true";
    embedTextMock.mockResolvedValue([0.1, 0.2, 0.3]);
    // Simulate: base write succeeds, then before the embedding write lands,
    // an admin purge already deleted the key — the re-check's get() sees
    // nothing (this is also the default mock value, but set explicitly here
    // for clarity about what's being simulated).
    redisMock.get.mockResolvedValue(null);
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "a", "m", 0, "end_turn");
    // Only the base entry write should have happened — the embedding-augmented
    // second write must be skipped because the re-check found no entry.
    expect(redisMock.set).toHaveBeenCalledTimes(1);
  });

  it("proceeds with the embedding write when the entry is still there and unchanged", async () => {
    process.env.FAQ_CACHE_SEMANTIC_MATCH = "true";
    embedTextMock.mockResolvedValue([0.1, 0.2, 0.3]);
    const { faqCacheSet } = await import("./chat-cache");
    // The re-check's get() must see the SAME cachedAt this call wrote. Since
    // faqCacheSet computes cachedAt internally via Date.now(), capture what
    // gets written to the base `set` call and echo it back from the re-check.
    redisMock.get.mockImplementation(async (key: string) => {
      if (key === CORPUS_BUILT_AT_KEY) return null;
      const [, storedJson] = redisMock.set.mock.calls[0] ?? [];
      return storedJson ?? null;
    });
    await faqCacheSet("q", "a", "m", 0, "end_turn");
    expect(redisMock.set).toHaveBeenCalledTimes(2);
    const [, secondPayload] = redisMock.set.mock.calls[1];
    expect(JSON.parse(secondPayload as string).embedding).toEqual([
      0.1, 0.2, 0.3,
    ]);
  });
});
