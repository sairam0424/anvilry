/**
 * Per-instance LRU for /api/tts-google. Mirrors /api/tts/cache.ts (same shape, same
 * eviction policy) but lives in its own module so the two engines don't share a hot
 * cache slot — a Polly visitor and a Google visitor both saying "Hello." should
 * each get their own cache entry, not contend for one. Lifted out of route.ts for
 * the same Next 16 App Router reason: route files only permit HTTP method exports
 * plus the fixed segment-config exports.
 */

const CACHE_MAX = 100;
const cache = new Map<string, Buffer>();

/** Pipe-delimited (text|voiceId) — Google has no tier dimension (Chirp 3 HD is the
 *  only engine the catalog exposes), so the key is simpler than Polly's. */
export function cacheKey(text: string, voiceId: string): string {
  return `${voiceId}|${text}`;
}

export function cacheGet(key: string): Buffer | undefined {
  const v = cache.get(key);
  if (v) {
    cache.delete(key);
    cache.set(key, v); // bump to MRU
  }
  return v;
}

export function cacheSet(key: string, val: Buffer): void {
  cache.set(key, val);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/** TEST-ONLY reset between cases. */
export function __resetCacheForTest(): void {
  cache.clear();
}

/** TEST-ONLY snapshot for assertions. */
export function __cacheSizeForTest(): number {
  return cache.size;
}
