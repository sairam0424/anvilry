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
 *  - Completion-integrity gate (finish_reason === "end_turn" only) + control-char
 *    stripping + a max-length sanity bound before anything is cached — a
 *    truncated/anomalous completion must never get replayed to every future
 *    visitor. NOTE: this checks completion cleanliness, not actual content
 *    safety — a jailbreak that finishes cleanly (end_turn) still passes this
 *    gate and would be cached. The blast radius is bounded (TTL, corpus-tag
 *    invalidation, admin purge below) but this is a known accepted gap, not
 *    a moderation layer.
 *  - Entries are tagged with the corpus build they were answered against, so
 *    a content-correcting deploy can't have its old answer survive the TTL.
 *  - No raw question text is persisted (the key is already a hash of it). The
 *    one exception in spirit is the stored reasoning summary: it is model-written
 *    prose that can paraphrase or quote the question, so it is replayed only on
 *    an EXACT-tier hit (the next visitor typed the same normalized text) and never
 *    on a semantic hit, where it would show one visitor's wording to another.
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

/** Same sampling technique and rationale as telemetry/emit.ts's identically-named
 *  constant: the index trims below are best-effort housekeeping, not a
 *  correctness requirement, so this bounds their Redis-command cost to 1-in-20
 *  cache writes instead of every one. */
export const TRIM_SAMPLE_EVERY = 20;

/** A legitimate answer from this bot is 2-4 sentences (per its own system
 *  prompt). 4000 chars is a generous multiple of that, not a tight limit —
 *  it exists purely to reject anomalous completions, not to truncate normal
 *  ones (an anomalously long completion is rejected outright, never cached
 *  truncated, since a truncated cached answer would look permanently broken). */
export const MAX_CACHEABLE_ANSWER_CHARS = 4000;

/** A reasoning summary is a few sentences (Sonnet 5.5 at xhigh: median 380, p95 810,
 *  max 1,077 characters over 41 measured calls). Same role as the bound above: reject an
 *  anomalous one outright, never store it truncated. A rejected summary costs only the
 *  summary: the ANSWER is still cached, and a hit then replays it without reasoning. */
export const MAX_CACHEABLE_REASONING_CHARS = 4000;

/** The summary is stored only for a question this short (normalized). A model-written summary
 *  of a long free-text question is the likeliest to carry personal detail the visitor typed,
 *  and an exact-match repeat of a long question almost never happens, so the summary would buy
 *  nothing there; the answer is cached regardless. The starter chips are under 60 characters. */
export const MAX_REASONING_QUESTION_CHARS = 200;

export type FaqCacheEntry = {
  answer: string;
  /** The reasoning summary the model streamed before this answer (sanitized, at most
   *  MAX_CACHEABLE_REASONING_CHARS). Absent on entries written before it was stored, when
   *  the model did not reason, and when the summary failed the bound. Replayed by the
   *  chat route on an exact-tier hit only. */
  reasoning?: string;
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

/** A semantic hit answers a question that is merely SIMILAR to the one the entry was
 *  written for, so it never carries the reasoning summary (which paraphrases that
 *  other question): the type leaves the field out and faqCacheSemanticGet removes it,
 *  so a later caller cannot replay it by forgetting a tier check. */
export type FaqCacheHit =
  | { entry: FaqCacheEntry; tier: "exact" }
  | {
      entry: Omit<FaqCacheEntry, "reasoning">;
      tier: "semantic";
      similarity: number;
    };

/** Lowercase, trim, collapse whitespace, strip trailing punctuation. Cheap,
 *  no new dependency; catches near-identical phrasing but not true paraphrases
 *  ("what tech do you use" vs "what's your stack") — that gap is what the
 *  optional semantic tier is for. */
const TRAILING_PUNCTUATION = new Set(["?", "!", ".", ",", ";", ":"]);

export function normalizeQuestion(text: string): string {
  const collapsed = text.trim().toLowerCase().replace(/\s+/g, " ");
  // Plain loop, not a `[...]+$` regex: CodeQL flagged that pattern as
  // polynomial-time on adversarial input (e.g. a long run of "!"). `text`
  // here isn't length-capped at every call site (the admin purge route
  // accepts an arbitrary-length question), so this is provably linear
  // instead of relying on the regex engine's backtracking behavior.
  let end = collapsed.length;
  while (end > 0 && TRAILING_PUNCTUATION.has(collapsed[end - 1])) end--;
  return collapsed.slice(0, end);
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

/** A reasoning summary in the form that is safe to store AND to replay: a string with the
 *  thinking protocol's own control bytes stripped, trimmed, non-empty and within
 *  MAX_CACHEABLE_REASONING_CHARS; anything else is undefined. Applied on BOTH sides of Redis,
 *  because Redis is a trust boundary (an older writer, a hand edit, a bug): a bad stored value
 *  must degrade to "no reasoning", never to an error or a mis-framed body on the hit path,
 *  which has no try/catch of its own. */
function replayableReasoning(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = stripControlBytes(value).trim();
  return clean.length > 0 && clean.length <= MAX_CACHEABLE_REASONING_CHARS
    ? clean
    : undefined;
}

/** `entry` with its stored reasoning normalized by replayableReasoning (dropped if unusable). */
function withReplayableReasoning(entry: FaqCacheEntry): FaqCacheEntry {
  const { reasoning: stored, ...rest } = entry;
  const reasoning = replayableReasoning(stored);
  return reasoning === undefined ? rest : { ...rest, reasoning };
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

/** An Upstash client error ends with ", command was: <the whole command as JSON>".
 *  For a failed SET that is the entire cache entry, the answer and its reasoning
 *  summary, so what follows the marker must never be copied into a telemetry event
 *  or a log line. Also bounded, so one message cannot bloat the trace sink. */
function withoutCommandEcho(message: string): string {
  const cut = message.indexOf(", command was:");
  return (cut === -1 ? message : message.slice(0, cut)).slice(0, 300);
}

/** Logs AND emits a distinguishable server.error telemetry event for a cache
 *  operation failure, so a broken cache is visible on /admin/telemetry's
 *  existing error-rate tile instead of silently looking identical to a
 *  genuine miss. Not tied to one specific request trace (a Redis-layer
 *  failure, not a request-scoped one), so it mints its own trace/span pair. */
function emitCacheError(op: string, err: unknown): void {
  const name = (err as Error)?.name ?? "Error";
  const message = withoutCommandEcho((err as Error)?.message ?? String(err));
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
    // MGET, not a get() + a separate getCurrentCorpusBuildTag() call: both are
    // plain Redis reads against the same instance, and MGET is billed as ONE
    // command (confirmed against Upstash's own billing docs) versus two GETs —
    // a real, verified contributor to exhausting the free-tier monthly quota.
    // faqCacheSemanticGet and faqCacheSet still call getCurrentCorpusBuildTag()
    // directly, since their own Redis reads aren't a plain single-key GET this
    // can merge with.
    const [raw, currentTag] = await redis.mget<
      [string | FaqCacheEntry | null, string | null]
    >(key, CORPUS_BUILT_AT_KEY);
    if (!raw) return null;
    const entry = parseEntry(raw);
    if (!isSameCorpusBuild(entry, currentTag)) return null;
    return { entry: withReplayableReasoning(entry), tier: "exact" };
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
    if (!best) return null;
    const entry: Omit<FaqCacheEntry, "reasoning"> & { reasoning?: string } = {
      ...best.entry,
    };
    delete entry.reasoning;
    return { entry, tier: "semantic", similarity: best.similarity };
  } catch (err) {
    emitCacheError("semantic-get", err);
    return null;
  }
}

/** Write-through on a clean, successful completion. Never blocks or throws
 *  into the request path — call as `void faqCacheSet(...)`. Rejects (does not
 *  cache) anything that isn't a clean `end_turn` completion, anything that
 *  sanitizes to empty, and anything anomalously long — see the module header.
 *  `reasoning` (the summary streamed before the answer) gets the same control-byte
 *  stripping and is stored beside the answer only when it is non-empty, within
 *  MAX_CACHEABLE_REASONING_CHARS, and the normalized question is at most
 *  MAX_REASONING_QUESTION_CHARS; otherwise the answer is still cached, without it.
 *  The optional semantic-embedding write is itself best-effort and never
 *  blocks the base exact-match write above it. */
export async function faqCacheSet(
  question: string,
  answer: string,
  model: string,
  costUsd: number,
  finishReason: string | undefined,
  reasoning?: string,
): Promise<void> {
  if (!isFaqCacheEnabled() || !redis) return;

  // Completion-integrity gate: only cache a clean, complete completion. A
  // max_tokens-truncated (or otherwise non-clean) stop cached as canonical
  // would be wrong for every future cache-hit visitor. NOT a content-safety
  // check — a jailbreak that finishes with end_turn still passes this.
  if (finishReason !== "end_turn") return;

  const sanitized = stripControlBytes(answer).trim();
  if (sanitized.length === 0 || sanitized.length > MAX_CACHEABLE_ANSWER_CHARS)
    return;

  const normalized = normalizeQuestion(question);
  const key = faqCacheKey(normalized);
  const cachedAt = Date.now();
  const corpusBuiltAt = await getCurrentCorpusBuildTag();
  const storedReasoning =
    normalized.length <= MAX_REASONING_QUESTION_CHARS
      ? replayableReasoning(reasoning)
      : undefined;
  if (
    typeof reasoning === "string" &&
    stripControlBytes(reasoning).trim().length > MAX_CACHEABLE_REASONING_CHARS
  ) {
    // Length only, never the text: an over-long summary is dropped silently otherwise.
    console.warn(
      `[chat-cache] reasoning summary of ${reasoning.length} characters is over the ${MAX_CACHEABLE_REASONING_CHARS} bound: answer cached without it`,
    );
  }
  const entry: FaqCacheEntry = {
    answer: sanitized,
    ...(storedReasoning !== undefined ? { reasoning: storedReasoning } : {}),
    model,
    costUsd,
    cachedAt,
    corpusBuiltAt,
  };

  try {
    await redis.set(key, JSON.stringify(entry), { ex: FAQ_CACHE_TTL_SECONDS });
    await redis.zadd(INDEX_KEY, { score: cachedAt, member: key });
    // Both index trims are sampled to 1-in-20 writes (same TRIM_SAMPLE_EVERY
    // technique as telemetry/emit.ts, deterministic off cachedAt rather than
    // Math.random() so it stays reproducible in tests) -- they bound the
    // index's staleness/size but aren't needed on every single write, and
    // this repo's own live audit found this exact command multiplicity
    // contributing to exhausting the free-tier Upstash quota.
    if (cachedAt % TRIM_SAMPLE_EVERY === 0) {
      await redis.zremrangebyscore(
        INDEX_KEY,
        0,
        cachedAt - FAQ_CACHE_TTL_SECONDS * 1000,
      );
      await redis.zremrangebyrank(INDEX_KEY, 0, -(FAQ_CACHE_INDEX_CAP + 1));
    }
  } catch (err) {
    emitCacheError("set", err);
    return;
  }

  if (isSemanticMatchEnabled()) {
    try {
      const { embedText } = await import("./faq-embeddings");
      const embedding = await embedText(normalized);
      if (embedding) {
        // embedText's network round trip is a real window for the entry to
        // be purged (an admin remediating a bad answer) or replaced (a
        // fresher write for the same question) before this second write
        // lands. Re-check right before writing: only proceed if `cachedAt`
        // still matches what THIS call wrote above — not a full atomic CAS,
        // so a narrower TOCTOU window still exists between this GET and the
        // SET below (a purge/replace landing in that exact gap would still
        // resurrect the embedding-less entry). Closing it fully would need a
        // Lua script (GET+conditional SET as one atomic op via the Upstash
        // SDK's eval support) — not done here since the narrowed window is
        // small and the entry it could resurrect is still content-gated.
        const current = await redis.get<string | FaqCacheEntry>(key);
        const currentEntry = current ? parseEntry(current) : null;
        if (currentEntry?.cachedAt === cachedAt) {
          await redis.set(key, JSON.stringify({ ...entry, embedding }), {
            ex: FAQ_CACHE_TTL_SECONDS,
          });
        }
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

export type FaqCachePurgeResult =
  | { status: "purged"; key: string }
  | { status: "not_found"; key: string }
  | { status: "error"; key: string; message: string };

/** Admin-only purge of a single cache entry by its (unnormalized) question
 *  text — used by /api/admin/faq-cache/purge so a discovered-bad entry can be
 *  removed without a deploy or direct Upstash console access. Deliberately
 *  NOT gated on isFaqCacheEnabled() — an operator purging a bad entry while
 *  investigating shouldn't first need the cache itself to be enabled.
 *
 *  Returns a distinguishable "error" status rather than collapsing a real
 *  Redis failure into the same shape as "nothing was there to purge" — during
 *  an actual incident, an operator needs to tell those two apart (the route
 *  maps "error" to HTTP 503). "not_found" is still success, not an error:
 *  purging a non-existent key is idempotent. */
export async function faqCachePurge(
  question: string,
): Promise<FaqCachePurgeResult> {
  const key = faqCacheKey(normalizeQuestion(question));
  if (!redis)
    return { status: "error", key, message: "Redis is not configured" };
  try {
    const deleted = await redis.del(key);
    await redis.zrem(INDEX_KEY, key);
    return deleted > 0
      ? { status: "purged", key }
      : { status: "not_found", key };
  } catch (err) {
    emitCacheError("purge", err);
    return {
      status: "error",
      key,
      message: (err as Error)?.message ?? "unknown error",
    };
  }
}
