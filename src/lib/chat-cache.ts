import { createHash, randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";
import { emit } from "@/lib/telemetry/emit";
import { redact } from "@/lib/telemetry/schema";
import { stripControlBytes } from "@/lib/llm-trace";

/**
 * Full-response FAQ cache for /api/chat — serves repeat first-turn questions
 * instantly with zero Bedrock spend. Backed by the shared Upstash Redis
 * singleton (@/lib/redis), never a Map: Vercel serverless instances don't
 * share memory, so an in-memory cache (like tts/cache.ts's) would only ever
 * hit within a single warm lambda. Follows the same fail-open convention as
 * redis.ts/rate-limit.ts — every function guards on `redis === null` and
 * swallows/logs any Redis error rather than throwing into the request path.
 *
 * Two lookup tiers:
 *  - Exact (default ON): normalize + hash the question, direct key lookup.
 *  - Semantic (default OFF, FAQ_CACHE_SEMANTIC_MATCH=true): embedding
 *    similarity scan over a capped index, via ./faq-embeddings (Phase 2b).
 *    Dynamically imported so the extra AWS SDK dependency + per-miss latency
 *    are paid only when the flag is on.
 *
 * Safety layers added after an adversarial audit of the first cut:
 *  - FAQ_CACHE_ENABLED kill switch, independent of Redis-overall.
 *  - Content-safety gate (finish_reason === "end_turn" only) + control-char
 *    stripping + a max-length sanity bound before anything is cached — a
 *    single jailbroken/truncated completion must never get replayed to every
 *    future visitor.
 *  - Entries are tagged with the corpus build they were answered against, so
 *    a content-correcting deploy can't have its old answer survive the TTL.
 *  - No raw question text is persisted (the key is already a hash of it).
 *  - Cache-layer errors are emitted as a distinguishable server.error event,
 *    not silently folded into the same signal as a genuine miss.
 *
 * Accepted tradeoff, deliberately NOT fixed: `make health` and one e2e spec
 * hit production /api/chat directly with a fixed literal question, sharing
 * this same cache namespace with real visitor traffic when run locally
 * against pulled production credentials (CI itself never touches it — no
 * Bedrock/Upstash secrets are set there). A dev-authored entry is now
 * content-gated, corpus-tagged, and purgeable, so it's functionally
 * indistinguishable from a real visitor's — the theoretical "leak" is the
 * cache doing its job, not a real risk, for a single-owner portfolio site.
 * A VERCEL_ENV-scoped key namespace would close this fully but is
 * disproportionate complexity for the actual risk here; revisit only if
 * this ever stops being a personal portfolio site's chatbot.
 */

const ENTRY_PREFIX = "anvilry:chat:cache:";
const INDEX_KEY = "anvilry:chat:cache:index";
const CORPUS_BUILT_AT_KEY = "anvilry:corpus:built_at";

/** 24h: long enough to catch same-day repeat traffic, short enough to bound
 *  staleness if the owner corrects a fact — this repo's content authorship
 *  rules treat an honest, current contribution register as load-bearing, so a
 *  week-old cached answer repeating a corrected fact would be a real
 *  credibility problem, not just a minor staleness nit. (The weekly eval cron
 *  at /api/cron/eval sends X-Chat-Skip-Cache and never participates in this
 *  cache at all — see src/app/api/chat/route.ts.) */
export const FAQ_CACHE_TTL_SECONDS = 24 * 60 * 60;

/** Caps the semantic-tier scan cost and the index's own storage footprint. */
export const FAQ_CACHE_INDEX_CAP = 500;

/** A legitimate answer from this bot is 2-4 sentences (per its own system
 *  prompt). 4000 chars is a generous multiple of that, not a tight limit —
 *  it exists purely to reject anomalous completions, not to truncate normal
 *  ones (an anomalously long completion is rejected outright, never cached
 *  truncated, since a truncated cached answer would look permanently broken). */
export const MAX_CACHEABLE_ANSWER_CHARS = 4000;

export type FaqCacheEntry = {
  answer: string;
  model: string;
  costUsd: number;
  cachedAt: number;
  /** Value of anvilry:corpus:built_at at write time (null if unset — e.g.
   *  local dev/preview, where instrumentation.ts never stamps it). A mismatch
   *  against the CURRENT value at read time means the corpus changed since
   *  this answer was cached — treated as an automatic miss. */
  corpusBuiltAt: string | null;
  /** Present only when FAQ_CACHE_SEMANTIC_MATCH is enabled at write time. */
  embedding?: number[];
};

export type FaqCacheHit =
  | { entry: FaqCacheEntry; tier: "exact" }
  | { entry: FaqCacheEntry; tier: "semantic"; similarity: number };

/** Lowercase, trim, collapse whitespace, strip trailing punctuation. Cheap,
 *  no new dependency; catches near-identical phrasing but not true paraphrases
 *  ("what tech do you use" vs "what's your stack") — that gap is what the
 *  optional semantic tier is for. */
export function normalizeQuestion(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?!.,;:]+$/g, "");
}

export function faqCacheKey(normalized: string): string {
  return `${ENTRY_PREFIX}${createHash("sha256").update(normalized).digest("hex")}`;
}

export function isSemanticMatchEnabled(): boolean {
  return process.env.FAQ_CACHE_SEMANTIC_MATCH === "true";
}

/** Kill switch for the FAQ cache as a whole (both tiers) — independent of
 *  Redis being configured at all, so it can be flipped without also
 *  disabling rate-limiting/telemetry, which share the same Redis singleton.
 *  Default ON. */
export function isFaqCacheEnabled(): boolean {
  return process.env.FAQ_CACHE_ENABLED !== "false";
}

function parseEntry(raw: string | FaqCacheEntry): FaqCacheEntry {
  return typeof raw === "string" ? (JSON.parse(raw) as FaqCacheEntry) : raw;
}

/** Current corpus build tag, or null if unset (local dev/preview) or on any
 *  Redis error — fails open to null, same posture as everything else here. */
async function getCurrentCorpusBuildTag(): Promise<string | null> {
  if (!redis) return null;
  try {
    return (await redis.get<string>(CORPUS_BUILT_AT_KEY)) ?? null;
  } catch {
    return null;
  }
}

/** True if `entry` was cached under the SAME corpus build as `currentTag` —
 *  "both null" (e.g. local dev, where the key is never stamped) counts as a
 *  match, so local-dev caching still works without a production deploy stamp. */
function isSameCorpusBuild(
  entry: FaqCacheEntry,
  currentTag: string | null,
): boolean {
  return (entry.corpusBuiltAt ?? null) === (currentTag ?? null);
}

/** Logs AND emits a distinguishable server.error telemetry event for a cache
 *  operation failure, so a broken cache is visible on /admin/telemetry's
 *  existing error-rate tile instead of silently looking identical to a
 *  genuine miss. Not tied to one specific request trace (a Redis-layer
 *  failure, not a request-scoped one), so it mints its own trace/span pair. */
function emitCacheError(op: string, err: unknown): void {
  const name = (err as Error)?.name ?? "Error";
  const message = (err as Error)?.message ?? String(err);
  console.warn(`[chat-cache] ${op} failed, failing open: ${name}`);
  try {
    emit({
      ts: Date.now(),
      traceId: randomUUID(),
      spanId: randomUUID(),
      kind: "server.error",
      route: "/api/chat",
      level: "error",
      message: redact(`chat-cache ${op}: ${message}`),
      attrs: { source: "chat-cache", op, error_name: name },
    });
  } catch {
    // emit() itself should never throw, but this whole function must not either.
  }
}

/** Exact-match tier lookup. Fails open to `null` on any Redis error, a
 *  malformed stored value, the kill switch being off, or when Redis isn't
 *  configured. Also returns `null` (a "miss") when the entry predates the
 *  current corpus build. */
export async function faqCacheGet(
  question: string,
): Promise<FaqCacheHit | null> {
  if (!isFaqCacheEnabled() || !redis) return null;
  try {
    const key = faqCacheKey(normalizeQuestion(question));
    const [raw, currentTag] = await Promise.all([
      redis.get<string | FaqCacheEntry>(key),
      getCurrentCorpusBuildTag(),
    ]);
    if (!raw) return null;
    const entry = parseEntry(raw);
    if (!isSameCorpusBuild(entry, currentTag)) return null;
    return { entry, tier: "exact" };
  } catch (err) {
    emitCacheError("get", err);
    return null;
  }
}

/** Semantic-similarity tier lookup (Phase 2b) — no-op unless
 *  FAQ_CACHE_SEMANTIC_MATCH=true (and the kill switch is on). Scans the capped
 *  index in one ZRANGE + one batched MGET, filters out entries from a stale
 *  corpus build, then compares in-process. Deliberately high threshold (0.92):
 *  a false-positive semantic hit serves a wrong canned answer, a correctness
 *  bug, not just a missed optimization. */
export async function faqCacheSemanticGet(
  question: string,
): Promise<FaqCacheHit | null> {
  if (!isFaqCacheEnabled() || !redis || !isSemanticMatchEnabled()) return null;
  const SIMILARITY_THRESHOLD = 0.92;
  try {
    const { embedText, cosineSimilarity } = await import("./faq-embeddings");
    const [queryEmbedding, currentTag] = await Promise.all([
      embedText(normalizeQuestion(question)),
      getCurrentCorpusBuildTag(),
    ]);
    if (!queryEmbedding) return null;

    const hashes = await redis.zrange<string[]>(INDEX_KEY, 0, -1);
    if (!hashes.length) return null;

    const raws = await redis.mget<(string | FaqCacheEntry | null)[]>(...hashes);
    let best: { entry: FaqCacheEntry; similarity: number } | null = null;
    for (const raw of raws) {
      if (!raw) continue;
      const entry = parseEntry(raw);
      if (!entry.embedding) continue;
      if (!isSameCorpusBuild(entry, currentTag)) continue;
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (
        similarity >= SIMILARITY_THRESHOLD &&
        (!best || similarity > best.similarity)
      ) {
        best = { entry, similarity };
      }
    }
    return best
      ? { entry: best.entry, tier: "semantic", similarity: best.similarity }
      : null;
  } catch (err) {
    emitCacheError("semantic-get", err);
    return null;
  }
}

/** Write-through on a clean, successful completion. Never blocks or throws
 *  into the request path — call as `void faqCacheSet(...)`. Rejects (does not
 *  cache) anything that isn't a clean `end_turn` completion, anything that
 *  sanitizes to empty, and anything anomalously long — see the module header.
 *  The optional semantic-embedding write is itself best-effort and never
 *  blocks the base exact-match write above it. */
export async function faqCacheSet(
  question: string,
  answer: string,
  model: string,
  costUsd: number,
  finishReason: string | undefined,
): Promise<void> {
  if (!isFaqCacheEnabled() || !redis) return;

  // Content-safety gate: only cache a clean, complete completion. A
  // max_tokens-truncated (or otherwise non-clean) stop cached as canonical
  // would be wrong for every future cache-hit visitor.
  if (finishReason !== "end_turn") return;

  const sanitized = stripControlBytes(answer).trim();
  if (sanitized.length === 0 || sanitized.length > MAX_CACHEABLE_ANSWER_CHARS)
    return;

  const normalized = normalizeQuestion(question);
  const key = faqCacheKey(normalized);
  const cachedAt = Date.now();
  const corpusBuiltAt = await getCurrentCorpusBuildTag();
  const entry: FaqCacheEntry = {
    answer: sanitized,
    model,
    costUsd,
    cachedAt,
    corpusBuiltAt,
  };

  try {
    await redis.set(key, JSON.stringify(entry), { ex: FAQ_CACHE_TTL_SECONDS });
    await redis.zadd(INDEX_KEY, { score: cachedAt, member: key });
    await redis.zremrangebyscore(
      INDEX_KEY,
      0,
      cachedAt - FAQ_CACHE_TTL_SECONDS * 1000,
    );
    await redis.zremrangebyrank(INDEX_KEY, 0, -(FAQ_CACHE_INDEX_CAP + 1));
  } catch (err) {
    emitCacheError("set", err);
    return;
  }

  if (isSemanticMatchEnabled()) {
    try {
      const { embedText } = await import("./faq-embeddings");
      const embedding = await embedText(normalized);
      if (embedding) {
        await redis.set(key, JSON.stringify({ ...entry, embedding }), {
          ex: FAQ_CACHE_TTL_SECONDS,
        });
      }
    } catch (err) {
      // Non-fatal: the base entry already wrote successfully above, so this
      // isn't the "cache looks broken" signal emitCacheError exists for.
      console.warn(
        `[chat-cache] embedding write failed (non-fatal): ${(err as Error)?.name ?? "error"}`,
      );
    }
  }
}

/** Admin-only purge of a single cache entry by its (unnormalized) question
 *  text — used by /api/admin/faq-cache/purge so a discovered-bad entry can be
 *  removed without a deploy or direct Upstash console access. Deliberately
 *  NOT gated on isFaqCacheEnabled() — an operator purging a bad entry while
 *  investigating shouldn't first need the cache itself to be enabled.
 *  Idempotent: purging a non-existent key is not an error. */
export async function faqCachePurge(
  question: string,
): Promise<{ purged: boolean; key: string }> {
  const key = faqCacheKey(normalizeQuestion(question));
  if (!redis) return { purged: false, key };
  try {
    const deleted = await redis.del(key);
    await redis.zrem(INDEX_KEY, key);
    return { purged: deleted > 0, key };
  } catch (err) {
    emitCacheError("purge", err);
    return { purged: false, key };
  }
}
