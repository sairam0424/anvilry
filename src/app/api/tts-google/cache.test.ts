import { afterEach, describe, expect, it } from "vitest";
import {
  cacheGet,
  cacheKey,
  cacheSet,
  __cacheSizeForTest,
  __resetCacheForTest,
} from "./cache";

afterEach(() => {
  __resetCacheForTest();
});

describe("/api/tts-google cache", () => {
  it("distinct voice ids produce distinct keys", () => {
    expect(cacheKey("hi", "en-US-Chirp3-HD-Aoede")).not.toBe(
      cacheKey("hi", "en-US-Chirp3-HD-Charon"),
    );
  });

  it("identical inputs produce the same key", () => {
    expect(cacheKey("hi", "en-US-Chirp3-HD-Aoede")).toBe(
      cacheKey("hi", "en-US-Chirp3-HD-Aoede"),
    );
  });

  it("set/get round-trips", () => {
    const k = cacheKey("hello", "en-US-Chirp3-HD-Aoede");
    cacheSet(k, Buffer.from("audio-aoede"));
    expect(cacheGet(k)).toEqual(Buffer.from("audio-aoede"));
  });

  it("different voices for the same text don't collide", () => {
    const aoede = cacheKey("Same.", "en-US-Chirp3-HD-Aoede");
    const charon = cacheKey("Same.", "en-US-Chirp3-HD-Charon");
    cacheSet(aoede, Buffer.from("A"));
    cacheSet(charon, Buffer.from("C"));
    expect(cacheGet(aoede)).toEqual(Buffer.from("A"));
    expect(cacheGet(charon)).toEqual(Buffer.from("C"));
  });

  it("evicts oldest beyond CACHE_MAX (100)", () => {
    const oldKey = cacheKey("oldest", "en-US-Chirp3-HD-Aoede");
    cacheSet(oldKey, Buffer.from("oldest"));
    for (let i = 0; i < 100; i++) {
      cacheSet(cacheKey(`new-${i}`, "en-US-Chirp3-HD-Aoede"), Buffer.from(String(i)));
    }
    expect(cacheGet(oldKey)).toBeUndefined();
    expect(__cacheSizeForTest()).toBeLessThanOrEqual(100);
  });
});
