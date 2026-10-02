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
function mockGetByKey(entryValue: unknown, tag: string | number | null) {
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
    expect(performance.now() - start).toBeLessThan(1000);
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

describe("FAQ cache — the reasoning summary stored beside the answer", () => {
  const CLEAN = "end_turn";
  const REASONING =
    "The user asks about Pensieve, so I'll lead with its 2K+ daily users.";

  function storedEntry(call = 0): Record<string, unknown> {
    const [, json] = redisMock.set.mock.calls[call];
    return JSON.parse(json as string) as Record<string, unknown>;
  }

  it("stores the reasoning next to the answer, trimmed", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "a", "m", 0, CLEAN, `  ${REASONING}\n\n`);
    expect(storedEntry().reasoning).toBe(REASONING);
    expect(storedEntry().answer).toBe("a");
  });

  it("strips the protocol's control bytes from the reasoning before storing it", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    // U+001E U+0002 would end the thinking block early on replay; U+0001 reopens it.
    await faqCacheSet(
      "q",
      "a",
      "m",
      0,
      CLEAN,
      `before${"\u001e\u0002"}after${"\u0001"}`,
    );
    expect(storedEntry().reasoning).toBe("beforeafter");
  });

  it("writes no reasoning key when none was given: the entry is exactly what it was before", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "a", "m", 0, CLEAN);
    expect(Object.keys(storedEntry()).sort()).toEqual([
      "answer",
      "cachedAt",
      "corpusBuiltAt",
      "costUsd",
      "model",
    ]);
  });

  it.each([
    ["an empty string", ""],
    ["only whitespace", " \n\t "],
    ["only control bytes", "\u001e\u0002\u0001"],
    ["a value that is not a string", 42 as unknown as string],
  ])(
    "stores no reasoning for %s, and still caches the answer (without throwing)",
    async (_label, reasoning) => {
      const { faqCacheSet } = await import("./chat-cache");
      await expect(
        faqCacheSet("q", "a", "m", 0, CLEAN, reasoning),
      ).resolves.toBeUndefined();
      expect(storedEntry().answer).toBe("a");
      expect(storedEntry()).not.toHaveProperty("reasoning");
    },
  );

  it("stores no reasoning when it is longer than the bound, and still caches the answer", async () => {
    const { faqCacheSet, MAX_CACHEABLE_REASONING_CHARS } =
      await import("./chat-cache");
    await faqCacheSet(
      "q",
      "a",
      "m",
      0,
      CLEAN,
      "x".repeat(MAX_CACHEABLE_REASONING_CHARS + 1),
    );
    expect(storedEntry().answer).toBe("a");
    expect(storedEntry()).not.toHaveProperty("reasoning");
  });

  it("stores reasoning right at the bound", async () => {
    const { faqCacheSet, MAX_CACHEABLE_REASONING_CHARS } =
      await import("./chat-cache");
    await faqCacheSet(
      "q",
      "a",
      "m",
      0,
      CLEAN,
      "x".repeat(MAX_CACHEABLE_REASONING_CHARS),
    );
    expect(storedEntry().reasoning).toHaveLength(MAX_CACHEABLE_REASONING_CHARS);
  });

  it("stores nothing at all, reasoning included, for a completion that is not clean", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "a", "m", 0, "max_tokens", REASONING);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("stores nothing when the answer is unusable, even with reasoning", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "  ", "m", 0, CLEAN, REASONING);
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("keeps the reasoning in the embedding-augmented second write", async () => {
    process.env.FAQ_CACHE_SEMANTIC_MATCH = "true";
    embedTextMock.mockResolvedValue([0.1, 0.2, 0.3]);
    const { faqCacheSet } = await import("./chat-cache");
    redisMock.get.mockImplementation(async (key: string) => {
      if (key === CORPUS_BUILT_AT_KEY) return null;
      const [, storedJson] = redisMock.set.mock.calls[0] ?? [];
      return storedJson ?? null;
    });
    await faqCacheSet("q", "a", "m", 0, CLEAN, REASONING);
    expect(redisMock.set).toHaveBeenCalledTimes(2);
    expect(storedEntry(1).reasoning).toBe(REASONING);
    expect(storedEntry(1).embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("hands the stored reasoning back on an exact hit", async () => {
    const entry = {
      answer: "It's a...",
      reasoning: REASONING,
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

  it("still serves an entry written before the reasoning was stored", async () => {
    const legacy = {
      answer: "It's a...",
      model: "sonnet",
      costUsd: 0.001,
      cachedAt: 1,
      corpusBuiltAt: null,
    };
    mockGetByKey(JSON.stringify(legacy), null);
    const { faqCacheGet } = await import("./chat-cache");
    const hit = await faqCacheGet("What is Pensieve?");
    expect(hit?.tier).toBe("exact");
    expect(hit?.entry.answer).toBe("It's a...");
    expect(hit?.entry).not.toHaveProperty("reasoning");
  });

  it("never hands reasoning back on a semantic hit: it paraphrases a different, merely similar, question", async () => {
    process.env.FAQ_CACHE_SEMANTIC_MATCH = "true";
    embedTextMock.mockResolvedValue([1, 0]);
    const { cosineSimilarity } = await import("./faq-embeddings");
    vi.mocked(cosineSimilarity).mockReturnValue(0.95);
    const stored = {
      answer: "It's a...",
      reasoning: REASONING,
      model: "sonnet",
      costUsd: 0.001,
      cachedAt: 1,
      corpusBuiltAt: null,
      embedding: [1, 0],
    };
    redisMock.zrange.mockResolvedValue(["k1"]);
    redisMock.mget.mockResolvedValue([JSON.stringify(stored)]);
    const { faqCacheSemanticGet } = await import("./chat-cache");
    const hit = await faqCacheSemanticGet("What is Pensieve exactly?");
    expect(hit?.tier).toBe("semantic");
    expect(hit?.entry.answer).toBe("It's a...");
    expect(hit?.entry).not.toHaveProperty("reasoning");
    expect(JSON.stringify(hit)).not.toContain(REASONING);
  });

  it("does not copy the stored entry into a server.error event when a write fails (Upstash echoes the whole command in its message)", async () => {
    const QUOTED = "QUOTED-FROM-THE-VISITORS-QUESTION";
    redisMock.set.mockRejectedValueOnce(
      new Error(
        `ERR max daily request limit exceeded, command was: ["set","k","{\\"answer\\":\\"a\\",\\"reasoning\\":\\"${QUOTED}\\"}"]`,
      ),
    );
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "a", "m", 0, CLEAN, QUOTED);
    const traceWrites = redisMock.zadd.mock.calls.filter(
      ([key]) => key === "anvilry:trace:server.error",
    );
    expect(traceWrites).toHaveLength(1);
    const written = JSON.stringify(traceWrites[0]);
    expect(written).toContain("max daily request limit exceeded");
    expect(written).not.toContain(QUOTED);
    expect(written).not.toContain("command was");
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(QUOTED),
    );
  });
});

describe("FAQ cache — reasoning: the question-length bound, the read side and the round trip", () => {
  const CLEAN = "end_turn";
  const REASONING =
    "The user asks about Pensieve, so I'll lead with its 2K+ daily users.";

  function storedEntry(call = 0): Record<string, unknown> {
    const [, json] = redisMock.set.mock.calls[call];
    return JSON.parse(json as string) as Record<string, unknown>;
  }

  it("stores reasoning for a question right at the length bound and drops it one character over, caching the answer either way", async () => {
    const { faqCacheSet, MAX_REASONING_QUESTION_CHARS } =
      await import("./chat-cache");
    await faqCacheSet(
      "q".repeat(MAX_REASONING_QUESTION_CHARS),
      "a",
      "m",
      0,
      CLEAN,
      REASONING,
    );
    await faqCacheSet(
      "q".repeat(MAX_REASONING_QUESTION_CHARS + 1),
      "a",
      "m",
      0,
      CLEAN,
      REASONING,
    );
    expect(storedEntry(0).reasoning).toBe(REASONING);
    expect(storedEntry(1).answer).toBe("a");
    expect(storedEntry(1)).not.toHaveProperty("reasoning");
  });

  it("measures the bound on the NORMALIZED question (case, padding and trailing punctuation do not count)", async () => {
    const { faqCacheSet, MAX_REASONING_QUESTION_CHARS } =
      await import("./chat-cache");
    const padded = `  ${"Q".repeat(MAX_REASONING_QUESTION_CHARS)}???  `;
    await faqCacheSet(padded, "a", "m", 0, CLEAN, REASONING);
    expect(storedEntry().reasoning).toBe(REASONING);
  });

  it("warns, with the length only and never the text, when a summary is over the bound", async () => {
    const { faqCacheSet, MAX_CACHEABLE_REASONING_CHARS } =
      await import("./chat-cache");
    const long = "SUMMARY-TEXT-".repeat(400);
    expect(long.length).toBeGreaterThan(MAX_CACHEABLE_REASONING_CHARS);
    await faqCacheSet("q", "a", "m", 0, CLEAN, long);
    const warnings = vi
      .mocked(console.warn)
      .mock.calls.map((c) => String(c[0]));
    const bound = warnings.find((w) => w.includes("is over the"));
    expect(bound).toContain(String(long.length));
    expect(warnings.join("\n")).not.toContain("SUMMARY-TEXT-");
  });

  it("does not warn when the summary is merely empty or absent", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "a", "m", 0, CLEAN, "   ");
    await faqCacheSet("q", "a", "m", 0, CLEAN);
    const warnings = vi
      .mocked(console.warn)
      .mock.calls.map((c) => String(c[0]));
    expect(warnings).toEqual([]);
  });

  it.each([
    ["a number", 42, undefined],
    ["an object", { nested: "text" }, undefined],
    ["only whitespace", "  \n ", undefined],
    ["only control bytes", "\u001e\u0002\u0001", undefined],
    [
      "text with an embedded end marker",
      `safe${"\u001e\u0002"}INJECTED`,
      "safeINJECTED",
    ],
    ["text past the bound", "x".repeat(4001), undefined],
    ["text with padding", `  ${REASONING}\n`, REASONING],
  ])(
    "normalizes stored reasoning that is %s on an exact hit, so the hit path never sees a bad value",
    async (_label, stored, expected) => {
      const entry = {
        answer: "It's a...",
        reasoning: stored,
        model: "sonnet",
        costUsd: 0.001,
        cachedAt: 1,
        corpusBuiltAt: null,
      };
      mockGetByKey(JSON.stringify(entry), null);
      const { faqCacheGet } = await import("./chat-cache");
      const hit = await faqCacheGet("What is Pensieve?");
      expect(hit?.tier).toBe("exact");
      expect(hit?.entry.answer).toBe("It's a...");
      if (expected === undefined) {
        expect(hit?.entry).not.toHaveProperty("reasoning");
      } else {
        expect(hit?.entry).toHaveProperty("reasoning", expected);
      }
    },
  );

  it.each([
    ["the JSON string Redis stores", (json: string) => json],
    [
      "the parsed object the Upstash client returns",
      (json: string) => JSON.parse(json),
    ],
  ])(
    "replays through faqCacheGet exactly what faqCacheSet wrote (%s)",
    async (_label, asRead) => {
      const { faqCacheSet, faqCacheGet } = await import("./chat-cache");
      await faqCacheSet(
        "What is Pensieve?",
        "It's a...",
        "m",
        0.5,
        CLEAN,
        `  ${REASONING}\n\n`,
      );
      const [, written] = redisMock.set.mock.calls[0];
      mockGetByKey(asRead(written as string), null);
      const hit = await faqCacheGet("what is pensieve");
      expect(hit?.tier).toBe("exact");
      expect(hit?.entry).toMatchObject({
        answer: "It's a...",
        reasoning: REASONING,
        model: "m",
        costUsd: 0.5,
      });
    },
  );

  it("still writes no question field when a reasoning summary is stored", async () => {
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet(
      "What is my email PII test@example.com?",
      "answer",
      "m",
      0,
      CLEAN,
      REASONING,
    );
    expect(storedEntry()).not.toHaveProperty("question");
    expect(JSON.stringify(storedEntry())).not.toContain("test@example.com");
  });
});

describe("FAQ cache — the over-bound warning agrees with what is stored", () => {
  it("neither warns nor drops a summary that is over the bound only before control bytes and padding are removed", async () => {
    const { faqCacheSet, MAX_CACHEABLE_REASONING_CHARS } =
      await import("./chat-cache");
    const fits = "x".repeat(MAX_CACHEABLE_REASONING_CHARS);
    const raw = `  ${fits}\u001e\u0002  `;
    expect(raw.length).toBeGreaterThan(MAX_CACHEABLE_REASONING_CHARS);

    await faqCacheSet("q", "a", "m", 0, "end_turn", raw);

    const [, json] = redisMock.set.mock.calls[0];
    expect(
      (JSON.parse(json as string) as { reasoning?: string }).reasoning,
    ).toBe(fits);
    const warnings = vi
      .mocked(console.warn)
      .mock.calls.map((c) => String(c[0]));
    expect(warnings.filter((w) => w.includes("is over the"))).toEqual([]);
  });
});

describe("FAQ cache — the Upstash command echo stays out of error events and purge results", () => {
  const CLEAN = "end_turn";

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Just enough of the Upstash REST protocol for the real client: a SET of a cache entry is
   *  refused the way an exhausted quota is (HTTP 400 plus a JSON error), everything else
   *  succeeds. Returns the ZADDs that reached the server.error trace set. */
  function stubUpstashRest() {
    const traceWrites: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as unknown;
        const isPipeline = String(url).endsWith("/pipeline");
        const commands = isPipeline
          ? (body as unknown[][])
          : [body as unknown[]];
        const refused = commands.some(
          (c) =>
            String(c[0]).toLowerCase() === "set" &&
            String(c[1]).startsWith("anvilry:chat:cache:"),
        );
        if (refused) {
          return new Response(
            JSON.stringify({
              error:
                "ERR max daily request limit exceeded. Limit: 10000, Usage: 10000",
            }),
            { status: 400 },
          );
        }
        const results = commands.map((c) => {
          if (
            String(c[0]).toLowerCase() === "zadd" &&
            c[1] === "anvilry:trace:server.error"
          )
            traceWrites.push(JSON.stringify(c));
          return { result: null };
        });
        return new Response(JSON.stringify(isPipeline ? results : results[0]), {
          status: 200,
        });
      }),
    );
    return traceWrites;
  }

  it("keeps a refused write's entry out of the server.error event, in the wording the real client produces", async () => {
    const traceWrites = stubUpstashRest();
    const { Redis } = await import("@upstash/redis");
    const real = new Redis({
      url: "https://example.upstash.io",
      token: "test",
    });
    redisStateRef.current = real as unknown as typeof redisMock;

    // Precondition that pins the SDK's wording: the marker the cut looks for is really there.
    const direct = await real
      .set("anvilry:chat:cache:probe", "x")
      .catch((e: Error) => e.message);
    expect(direct).toContain(", command was:");

    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet(
      "q",
      "ANSWER-TYPED-BY-THE-MODEL",
      "m",
      0,
      CLEAN,
      "REASONING-QUOTING-THE-VISITOR",
    );

    await vi.waitFor(() => expect(traceWrites).toHaveLength(1));
    const written = traceWrites[0];
    expect(written).toContain("max daily request limit exceeded");
    expect(written).not.toContain("command was");
    expect(written).not.toContain("ANSWER-TYPED-BY-THE-MODEL");
    expect(written).not.toContain("REASONING-QUOTING-THE-VISITOR");
  });

  it("bounds a long error message that has no marker to 300 characters", async () => {
    // Words, not one long run: redact() masks any 32+ character token before it is recorded.
    redisMock.set.mockRejectedValueOnce(new Error("word ".repeat(600)));
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet("q", "a", "m", 0, CLEAN);
    const traceWrites = redisMock.zadd.mock.calls.filter(
      ([key]) => key === "anvilry:trace:server.error",
    );
    expect(traceWrites).toHaveLength(1);
    const kept = (JSON.stringify(traceWrites[0]).match(/word/g) ?? []).length;
    expect(kept).toBe(60);
  });

  it("returns the purge failure without the echo, so the admin response never carries an entry", async () => {
    redisMock.del.mockRejectedValueOnce(
      new Error('ERR boom, command was: [["del","k"]] ENTRY-TEXT'),
    );
    const { faqCachePurge } = await import("./chat-cache");
    const result = await faqCachePurge("q");
    expect(result).toMatchObject({ status: "error", message: "ERR boom" });
    expect(JSON.stringify(result)).not.toContain("ENTRY-TEXT");
  });

  it.each([
    ["a number", 123],
    ["an object", { a: 1 }],
  ])(
    "fails open, rather than throwing, when a cache error carries %s as its message",
    async (_label, message) => {
      const err = Object.assign(new Error("x"), { message });
      redisMock.mget.mockRejectedValueOnce(err);
      redisMock.del.mockRejectedValueOnce(err);
      const { faqCacheGet, faqCachePurge } = await import("./chat-cache");
      await expect(faqCacheGet("q")).resolves.toBeNull();
      await expect(faqCachePurge("q")).resolves.toMatchObject({
        status: "error",
      });
    },
  );
});

describe("FAQ cache — the documented reasoning bounds and the semantic miss", () => {
  it("keeps the two bounds the docs state as policy: 4,000 characters of summary, questions of at most 200", async () => {
    const { MAX_CACHEABLE_REASONING_CHARS, MAX_REASONING_QUESTION_CHARS } =
      await import("./chat-cache");
    // CLAUDE.md, TELEMETRY.md, docs/configuration.md and docs/index quote these numbers, and
    // the other tests measure the bounds relative to the exports; changing one is a decision.
    expect(MAX_CACHEABLE_REASONING_CHARS).toBe(4000);
    expect(MAX_REASONING_QUESTION_CHARS).toBe(200);
  });

  it("returns null on a semantic miss without recording a server.error", async () => {
    process.env.FAQ_CACHE_SEMANTIC_MATCH = "true";
    embedTextMock.mockResolvedValue([1, 0]);
    const { cosineSimilarity } = await import("./faq-embeddings");
    vi.mocked(cosineSimilarity).mockReturnValue(0.5);
    redisMock.zrange.mockResolvedValue(["k1"]);
    redisMock.mget.mockResolvedValue([
      JSON.stringify({
        answer: "a",
        model: "m",
        costUsd: 0,
        cachedAt: 1,
        corpusBuiltAt: null,
        embedding: [0, 1],
      }),
    ]);
    const { faqCacheSemanticGet } = await import("./chat-cache");
    await expect(faqCacheSemanticGet("q")).resolves.toBeNull();
    expect(redisMock.zadd).not.toHaveBeenCalledWith(
      "anvilry:trace:server.error",
      expect.anything(),
    );
  });
});

describe("FAQ cache — a rejection that is not an Error", () => {
  it("records what was thrown and still fails open", async () => {
    redisMock.mget.mockRejectedValueOnce("plain string thrown by a client");
    const { faqCacheGet } = await import("./chat-cache");
    await expect(faqCacheGet("q")).resolves.toBeNull();
    const traceWrites = redisMock.zadd.mock.calls.filter(
      ([key]) => key === "anvilry:trace:server.error",
    );
    expect(traceWrites).toHaveLength(1);
    expect(JSON.stringify(traceWrites[0])).toContain(
      "plain string thrown by a client",
    );
  });
});

describe("FAQ cache — the reasoning policy holds where the questions really come from", () => {
  it("keeps every starter chip within the question bound, so the questions most often repeated can be replayed", async () => {
    const { normalizeQuestion, MAX_REASONING_QUESTION_CHARS } =
      await import("./chat-cache");
    const { RECRUITER_CHIPS, STARTER_CHIPS } =
      await import("@/components/chat/chat-suggestions");
    const chips = [...RECRUITER_CHIPS, ...STARTER_CHIPS];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips)
      expect(normalizeQuestion(chip).length).toBeLessThanOrEqual(
        MAX_REASONING_QUESTION_CHARS,
      );
  });

  it("types a semantic hit without the reasoning field, so a forgotten tier check is a compile error", async () => {
    const { faqCacheSemanticGet } = await import("./chat-cache");
    const hit = await faqCacheSemanticGet("q");
    expect(hit).toBeNull();
    if (hit?.tier === "semantic") {
      // @ts-expect-error the semantic arm of FaqCacheHit omits `reasoning` on purpose
      void hit.entry.reasoning;
    }
  });
});

describe("FAQ cache — the deployment is the corpus tag", () => {
  const QUESTION = "What is Pensieve?";
  const ANSWER = "An answer written under one corpus.";
  const entryTaggedWith = (tag: string | number | null) => ({
    answer: ANSWER,
    model: "sonnet",
    costUsd: 0.001,
    cachedAt: 1,
    corpusBuiltAt: tag,
  });

  it("tags a new entry with the id of the deployment that writes it, without reading the stamp", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_A");
    const { faqCacheSet } = await import("./chat-cache");
    await faqCacheSet(QUESTION, "A clean answer.", "sonnet", 0.001, "end_turn");
    const [, json] = redisMock.set.mock.calls[0];
    expect(JSON.parse(json as string).corpusBuiltAt).toBe("dpl_A");
    expect(redisMock.get).not.toHaveBeenCalled();
  });

  it("serves an entry to the deployment that wrote it, whatever the stamp key says, and to no other", async () => {
    mockGetByKey(JSON.stringify(entryTaggedWith("dpl_A")), "1000");
    const { faqCacheGet } = await import("./chat-cache");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_A");
    expect((await faqCacheGet(QUESTION))?.entry.answer).toBe(ANSWER);
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_B");
    await expect(faqCacheGet(QUESTION)).resolves.toBeNull();
  });

  it("asks for the entry alone when the host gives an id, and for the entry and the stamp in one command when it does not", async () => {
    mockGetByKey(JSON.stringify(entryTaggedWith("dpl_A")), "1000");
    const { faqCacheGet } = await import("./chat-cache");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_A");
    await faqCacheGet(QUESTION);
    expect(redisMock.mget).toHaveBeenCalledTimes(1);
    expect(redisMock.mget.mock.calls[0]).toHaveLength(1);
    expect(redisMock.get).not.toHaveBeenCalled();
    redisMock.mget.mockClear();
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "");
    await faqCacheGet(QUESTION);
    expect(redisMock.mget).toHaveBeenCalledTimes(1);
    expect(redisMock.mget.mock.calls[0]).toEqual([
      expect.any(String),
      CORPUS_BUILT_AT_KEY,
    ]);
  });

  it("takes an empty id for none and compares the stamp, as before", async () => {
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "");
    const { faqCacheGet } = await import("./chat-cache");
    mockGetByKey(JSON.stringify(entryTaggedWith("1000")), "1000");
    await expect(faqCacheGet(QUESTION)).resolves.not.toBeNull();
    mockGetByKey(JSON.stringify(entryTaggedWith("dpl_A")), "1000");
    await expect(faqCacheGet(QUESTION)).resolves.toBeNull();
  });

  it("gives the semantic tier the same rule: another deployment's entries are skipped", async () => {
    process.env.FAQ_CACHE_SEMANTIC_MATCH = "true";
    embedTextMock.mockResolvedValue([1, 0]);
    const { cosineSimilarity } = await import("./faq-embeddings");
    vi.mocked(cosineSimilarity).mockReturnValue(0.95);
    redisMock.zrange.mockResolvedValue(["k1"]);
    redisMock.mget.mockResolvedValue([
      JSON.stringify({ ...entryTaggedWith("dpl_A"), embedding: [1, 0] }),
    ]);
    const { faqCacheSemanticGet } = await import("./chat-cache");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_B");
    await expect(faqCacheSemanticGet("What is Pensieve exactly?")).resolves.toBeNull();
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_A");
    expect((await faqCacheSemanticGet("What is Pensieve exactly?"))?.tier).toBe("semantic");
  });

  it("writes the embedding-augmented entry under the deployment id, and only that deployment's semantic lookup serves it", async () => {
    process.env.FAQ_CACHE_SEMANTIC_MATCH = "true";
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_A");
    embedTextMock.mockResolvedValue([1, 0]);
    const { cosineSimilarity } = await import("./faq-embeddings");
    vi.mocked(cosineSimilarity).mockReturnValue(0.95);
    const { faqCacheSet, faqCacheSemanticGet } = await import("./chat-cache");
    // the write-back re-reads the entry it just wrote before it adds the embedding
    redisMock.get.mockImplementation(
      async () => (redisMock.set.mock.calls[0]?.[1] as string) ?? null,
    );
    await faqCacheSet(QUESTION, ANSWER, "sonnet", 0.001, "end_turn");
    expect(redisMock.set).toHaveBeenCalledTimes(2);
    expect(JSON.parse(redisMock.set.mock.calls[1][1] as string)).toMatchObject({
      corpusBuiltAt: "dpl_A",
      embedding: [1, 0],
    });
    redisMock.zrange.mockResolvedValue(["k1"]);
    redisMock.mget.mockResolvedValue([redisMock.set.mock.calls[1][1]]);
    expect((await faqCacheSemanticGet("What is Pensieve exactly?"))?.tier).toBe("semantic");
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "dpl_B");
    await expect(faqCacheSemanticGet("What is Pensieve exactly?")).resolves.toBeNull();
  });

  it("compares the semantic tier against the stamp on a host that gives no id", async () => {
    process.env.FAQ_CACHE_SEMANTIC_MATCH = "true";
    embedTextMock.mockResolvedValue([1, 0]);
    const { cosineSimilarity } = await import("./faq-embeddings");
    vi.mocked(cosineSimilarity).mockReturnValue(0.95);
    redisMock.zrange.mockResolvedValue(["k1"]);
    redisMock.get.mockImplementation(async (key: string) =>
      key === CORPUS_BUILT_AT_KEY ? "2000" : null,
    );
    const { faqCacheSemanticGet } = await import("./chat-cache");
    redisMock.mget.mockResolvedValue([
      JSON.stringify({ ...entryTaggedWith("2000"), embedding: [1, 0] }),
    ]);
    expect((await faqCacheSemanticGet("What is Pensieve exactly?"))?.tier).toBe("semantic");
    redisMock.mget.mockResolvedValue([
      JSON.stringify({ ...entryTaggedWith("1000"), embedding: [1, 0] }),
    ]);
    await expect(faqCacheSemanticGet("What is Pensieve exactly?")).resolves.toBeNull();
  });

  // What an entry can carry as its tag in Redis: an id, the stamp v3.12.0 wrote (the SDK hands a
  // numeric string back as a NUMBER), or nothing. Each is a hit only for the tag it carries.
  it.each([
    ["an untagged entry (null) under a deployment id", null, "dpl_A", null],
    ["a v3.12.0 entry tagged with its numeric stamp under a deployment id", 1780000000000, "dpl_A", null],
    ["an entry tagged with an id, on a host with neither id nor stamp", "dpl_A", "", null],
  ])("misses %s, and serves the same entry to the tag it carries", async (_label, entryTag, id, stamp) => {
    const { faqCacheGet } = await import("./chat-cache");
    mockGetByKey(JSON.stringify(entryTaggedWith(entryTag)), entryTag);
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", "");
    expect(await faqCacheGet(QUESTION)).not.toBeNull();
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", id);
    mockGetByKey(JSON.stringify(entryTaggedWith(entryTag)), stamp);
    await expect(faqCacheGet(QUESTION)).resolves.toBeNull();
  });

  it("counts an entry without the corpusBuiltAt field as untagged", async () => {
    const legacy = { answer: ANSWER, model: "sonnet", costUsd: 0.001, cachedAt: 1 };
    const { faqCacheGet } = await import("./chat-cache");
    mockGetByKey(JSON.stringify(legacy), null);
    expect(await faqCacheGet(QUESTION)).not.toBeNull();
    mockGetByKey(JSON.stringify(legacy), "1000");
    await expect(faqCacheGet(QUESTION)).resolves.toBeNull();
  });

  it("leaves the tag null and still writes when the stamp read fails (no id)", async () => {
    redisMock.get.mockRejectedValue(new Error("upstash down"));
    const { faqCacheSet } = await import("./chat-cache");
    await expect(faqCacheSet("q", "a", "m", 0, "end_turn")).resolves.toBeUndefined();
    expect(JSON.parse(redisMock.set.mock.calls[0][1] as string).corpusBuiltAt).toBeNull();
  });

  it("does not record a plain exact-tier miss as a cache error", async () => {
    const { faqCacheGet } = await import("./chat-cache");
    await expect(faqCacheGet(QUESTION)).resolves.toBeNull();
    expect(redisMock.zadd).not.toHaveBeenCalledWith("anvilry:trace:server.error", expect.anything());
    expect(console.warn).not.toHaveBeenCalled();
  });
});

// Root-level hooks are file-level, wherever they sit, so they apply to all of
// its tests: the suite must not inherit the deployment id of the Vercel build that runs it
// (VERCEL_DEPLOYMENT_ID is set there), because it decides which corpus tag the cache compares.
beforeEach(() => {
  vi.stubEnv("VERCEL_DEPLOYMENT_ID", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});
