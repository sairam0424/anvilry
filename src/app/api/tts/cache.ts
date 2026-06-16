/**
 * Per-instance LRU for /api/tts so a re-read of an answer doesn't re-bill Polly. Lives
 * outside route.ts because Next 16 App Router route files only permit HTTP method
 * exports (+ a fixed set of segment-config exports — see route.md); arbitrary helper
 * exports would either be ignored or break the contract. Lifting the cache here also
 * makes it directly testable without spinning up a route handler.
 *
 * CRITICAL invariant: the cache key MUST include voiceId + tier. Without that, two
 * visitors picking different voices for the same text would collide on the same key
 * and the second visitor would get the first visitor's audio. The v1.7 voice picker
 * shipment depends on this isolation; the empty-key path (text-only) was the v1.6
 * default and stayed correct only because there was a single hardcoded voice.
 */
export type PollyTier = "neural" | "generative";
export const ALLOWED_TIERS: ReadonlySet<PollyTier> = new Set(["neural", "generative"]);

const CACHE_MAX = 100;
const cache = new Map<string, Buffer>();

/** Pipe is a control char never legal inside the alphanumeric voiceId/tier values, so
 *  a literal pipe delimiter is collision-safe vs. any text payload. */
export function cacheKey(text: string, voiceId: string, tier: PollyTier): string {
  return `${voiceId}|${tier}|${text}`;
}

export function cacheGet(key: string): Buffer | undefined {
  const v = cache.get(key);
  if (v) {
    cache.delete(key);
    cache.set(key, v); // bump to most-recently-used
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

/** TEST-ONLY reset between cases (the cache is module-level + would otherwise leak
 *  state across tests). Kept exported so the route file does not need to know about it. */
export function __resetCacheForTest(): void {
  cache.clear();
}

/** TEST-ONLY snapshot for assertions. */
export function __cacheSizeForTest(): number {
  return cache.size;
}
