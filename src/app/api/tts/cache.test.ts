import { afterEach, describe, expect, it } from "vitest";
import {
  ALLOWED_TIERS,
  cacheGet,
  cacheKey,
  cacheSet,
  __cacheSizeForTest,
  __resetCacheForTest,
  type PollyTier,
} from "./cache";

/**
 * The /api/tts cache is voice-keyed by design. The original v1.6 cache keyed only on
 * raw text, which was correct ONLY because there was a single hardcoded voice (Joanna).
 * The v1.7 voice picker shipment depends on cross-voice isolation: visitor A choosing
 * Stephen + visitor B choosing Joanna for the same text MUST NOT collide, or the
 * second visitor would hear the first's audio. These tests pin that invariant.
 */

afterEach(() => {
  __resetCacheForTest();
});

describe("cacheKey()", () => {
  it("produces distinct keys for the same text under different voices", () => {
    const k1 = cacheKey("Hello world.", "Joanna", "neural");
    const k2 = cacheKey("Hello world.", "Stephen", "neural");
    expect(k1).not.toBe(k2);
  });

  it("produces distinct keys for the same text under different tiers", () => {
    const k1 = cacheKey("Hello world.", "Joanna", "neural");
    const k2 = cacheKey("Hello world.", "Joanna", "generative");
    expect(k1).not.toBe(k2);
  });

  it("is deterministic for identical inputs", () => {
    const k1 = cacheKey("Hello world.", "Joanna", "neural");
    const k2 = cacheKey("Hello world.", "Joanna", "neural");
    expect(k1).toBe(k2);
  });

  it("encodes text last so a malicious text containing a pipe cannot forge another voice", () => {
    // A naive `${text}|${voice}` builder would let text="ab|Joanna|neural" collide with
    // the canonical (text="ab", voice="Joanna", tier="neural") key. Voice and tier are
    // alphanumeric (catalog-validated upstream), so prefixing them keeps the boundary
    // unambiguous.
    const safe = cacheKey("hello", "Stephen", "neural");
    const attack = cacheKey("Stephen|neural|hello", "Joanna", "neural");
    expect(safe).not.toBe(attack);
  });
});

describe("cache isolation across voices (the regression that v1.7 fixes)", () => {
  it("returns the right buffer per (voice, tier) pair", () => {
    const text = "Hi there.";
    const aBuf = Buffer.from("audio-from-joanna");
    const bBuf = Buffer.from("audio-from-stephen");

    cacheSet(cacheKey(text, "Joanna", "neural"), aBuf);
    cacheSet(cacheKey(text, "Stephen", "generative"), bBuf);

    expect(cacheGet(cacheKey(text, "Joanna", "neural"))).toEqual(aBuf);
    expect(cacheGet(cacheKey(text, "Stephen", "generative"))).toEqual(bBuf);
  });

  it("a hit under one voice does NOT serve audio under another voice for the same text", () => {
    const text = "Same text, different voice.";
    const joannaBuf = Buffer.from("joanna-audio");
    cacheSet(cacheKey(text, "Joanna", "neural"), joannaBuf);

    // The bug we're guarding against: requesting Stephen with the same text MUST miss.
    expect(cacheGet(cacheKey(text, "Stephen", "neural"))).toBeUndefined();
    expect(cacheGet(cacheKey(text, "Joanna", "generative"))).toBeUndefined();
  });

  it("LRU bump on hit keeps a hot key from being evicted", () => {
    const buf = Buffer.from("hot");
    const k = cacheKey("hot", "Joanna", "neural");
    cacheSet(k, buf);

    // Push 100 distinct entries to fill the cache (CACHE_MAX = 100). Re-touch the hot
    // key in between so it surfaces as MRU and survives eviction.
    for (let i = 0; i < 50; i++) {
      cacheSet(cacheKey(`fill-${i}`, "Joanna", "neural"), Buffer.from(String(i)));
    }
    expect(cacheGet(k)).toEqual(buf); // bump
    for (let i = 50; i < 100; i++) {
      cacheSet(cacheKey(`fill-${i}`, "Joanna", "neural"), Buffer.from(String(i)));
    }
    // The hot key was bumped to MRU and now sits ahead of the oldest fillers.
    expect(cacheGet(k)).toEqual(buf);
  });

  it("evicts the oldest entry when CACHE_MAX is exceeded", () => {
    const oldKey = cacheKey("oldest", "Joanna", "neural");
    cacheSet(oldKey, Buffer.from("oldest"));
    for (let i = 0; i < 100; i++) {
      cacheSet(cacheKey(`new-${i}`, "Joanna", "neural"), Buffer.from(String(i)));
    }
    // CACHE_MAX = 100; after 1 + 100 inserts, the oldest is evicted.
    expect(cacheGet(oldKey)).toBeUndefined();
    expect(__cacheSizeForTest()).toBeLessThanOrEqual(100);
  });
});

describe("ALLOWED_TIERS gate", () => {
  it("lists exactly the supported Polly engines", () => {
    expect(Array.from(ALLOWED_TIERS).sort()).toEqual(["generative", "neural"]);
  });

  it("matches the PollyTier type at the type level", () => {
    const t: PollyTier = "neural";
    expect(ALLOWED_TIERS.has(t)).toBe(true);
  });
});
