import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { profile } from "@/lib/profile";
import {
  TRACE_DELIMITER,
  THINKING_SENTINEL,
  THINKING_END,
  stripControlBytes,
} from "@/lib/llm-trace";

/**
 * LLM provider abstraction for the "Ask my portfolio" chatbot.
 *
 * Single source of truth for: provider choice, client construction, the model
 * fallback chain, AWS credential decoding, fallback-eligibility, and the
 * streaming-with-fallback loop. The route imports only from here, so swapping
 * AWS Bedrock <-> the direct Anthropic API is an env change (LLM_PROVIDER), not
 * a code change.
 *
 * Chain: Sonnet (4.6, 5 when LLM_USE_SONNET_5 is set, or 5.5 when LLM_USE_SONNET_5_5
 * is set) primary -> Sonnet 4.6 (when the primary is a 5.x) -> Haiku 4.5. Opus 4.6 is an
 * opt-in rung (LLM_USE_OPUS_FALLBACK=true) since 2026-10-01: it was the original
 * secondary, but this account IAM-denies the whole Opus family, so that rung could only
 * ever answer 403 before Haiku (a weaker model) got the request.
 * (Updated 2026-06-17 to match the BEDROCK_CHAIN order below — earlier wording said
 * "Opus primary" while the array shipped Sonnet-first since v1.6, leaving log
 * analysis ambiguous about which model was the "expected primary" on a given turn.)
 * (Updated 2026-09-18: added the LLM_USE_SONNET_5 toggle — see isSonnet5PrimaryEnabled()
 * below — so the primary rung can move to Claude Sonnet 5 without requiring a code
 * change to roll back.)
 * Ported from the production pattern in Too-Hot-To-Loose (career_copilot provider.py).
 */

export type LlmProvider = "bedrock" | "anthropic";

const PER_ATTEMPT_TIMEOUT_MS = 15_000;

/** Feature flag: when "true", Claude Sonnet 5 replaces Sonnet 4.6 as the
 *  PRIMARY rung on both chains, and Sonnet 4.6 becomes the rung behind it. Haiku
 *  4.5 is still Bedrock's current Haiku generation, so it does not move. Default
 *  OFF: this is a capability
 *  upgrade, not a fix, so it stays an explicit opt-in until proven in
 *  production. REQUIRES the adaptive-thinking shape below — Sonnet 5 rejects
 *  the old thinking.enabled+budget_tokens request shape outright (400). */
export function isSonnet5PrimaryEnabled(): boolean {
  return process.env.LLM_USE_SONNET_5 === "true";
}

/** Feature flag: when "true", Claude Sonnet 5.5 becomes the PRIMARY rung on both
 *  chains, taking precedence over LLM_USE_SONNET_5; Sonnet 4.6 is the rung behind
 *  it. Default OFF, for the same reason as the Sonnet 5 flag: a
 *  capability upgrade stays an explicit opt-in until proven in production.
 *
 *  Things a naive "swap the id" change gets wrong (verified live against
 *  Bedrock, 2026-09-30):
 *  - Bedrock serves 5.5 ONLY through the GLOBAL inference profile. There is no
 *    `us.` profile: that id answers "model identifier is invalid", which
 *    isFallbackEligible reads as "model unavailable", so a wrong id would not
 *    fail loudly, it would skip the primary on every request. Global routing
 *    means a request may be processed outside the US regions.
 *  - The principal needs IAM on the global profile. Without it 5.5 answers 403
 *    (eligible) and Sonnet 4.6 answers EVERY request: no error, only
 *    fell_back / attrs.status 403 in llm.attempt. Check fellBack after enabling.
 *  - It rejects `thinking: {type:"disabled"}`; see thinkingOff().
 *  - It rejects `temperature`; this module sends no sampling parameters. */
export function isSonnet55PrimaryEnabled(): boolean {
  return process.env.LLM_USE_SONNET_5_5 === "true";
}

/** Feature flag: when "true", Claude Opus 4.6 (direct API: Opus 4.7) is added to the
 *  chain right behind the primary, the position it held before 2026-10-01. Default
 *  OFF: this account IAM-denies the whole Opus family, so with the rung on, every
 *  fallback would first spend a round trip on a guaranteed 403 (telemetry would
 *  log it as attrs.status 403 on each one). Turn it on only where Opus is allowed. */
export function isOpusFallbackEnabled(): boolean {
  return process.env.LLM_USE_OPUS_FALLBACK === "true";
}

/** The primary rung's id: 5.5 (LLM_USE_SONNET_5_5) beats 5 (LLM_USE_SONNET_5),
 *  which beats the 4.6 default. */
function pickPrimary(ids: {
  sonnet46: string;
  sonnet5: string;
  sonnet55: string;
}): string {
  if (isSonnet55PrimaryEnabled()) return ids.sonnet55;
  return isSonnet5PrimaryEnabled() ? ids.sonnet5 : ids.sonnet46;
}

type ChainIds = {
  sonnet46: string;
  sonnet5: string;
  sonnet55: string;
  opus: string;
  haiku: string;
};

/** [primary, Opus if opted in, Sonnet 4.6, Haiku], with repeats dropped: when the
 *  primary IS Sonnet 4.6 it is not listed again, so the default chain is
 *  [4.6, Haiku] and a 5.x primary is backed up by the model it replaced, which is
 *  reachable on this account and has its own quota, before the weaker Haiku. */
function buildChain(ids: ChainIds): string[] {
  const rungs = [
    pickPrimary(ids),
    ...(isOpusFallbackEnabled() ? [ids.opus] : []),
    ids.sonnet46,
    ids.haiku,
  ];
  return rungs.filter((id, i) => rungs.indexOf(id) === i);
}

/**
 * Region-prefixed Bedrock inference-profile IDs (verified live in the reference
 * account). NOTE: Opus 4.6 REQUIRES the `-v1` suffix — the bare id 400s with
 * "model identifier is invalid". Sonnet 4.6's and Sonnet 5's bare ids resolve fine.
 * Sonnet 5.5 is the exception: no `us.` profile, only `global.anthropic.claude-sonnet-5-5`.
 */
function bedrockChain(): string[] {
  return buildChain({
    sonnet46: "us.anthropic.claude-sonnet-4-6", // default primary; backs up a 5.x primary
    sonnet5: "us.anthropic.claude-sonnet-5",
    sonnet55: "global.anthropic.claude-sonnet-5-5",
    opus: "us.anthropic.claude-opus-4-6-v1", // opt-in (LLM_USE_OPUS_FALLBACK)
    haiku: "us.anthropic.claude-haiku-4-5-20251001-v1:0", // last resort
  });
}

/** Direct-API chain (used only when LLM_PROVIDER=anthropic). */
function anthropicChain(): string[] {
  return buildChain({
    sonnet46: "claude-sonnet-4-6",
    sonnet5: "claude-sonnet-5",
    sonnet55: "claude-sonnet-5-5",
    opus: "claude-opus-4-7",
    haiku: "claude-haiku-4-5",
  });
}

/** The explicit "thinking off" request shape for a thinking-capable model.
 *  Sonnet 5.5 rejects `{type:"disabled"}` with a 400 (`"thinking.type.disabled"
 *  is not supported for this model`) and names `between_tools` as its lowest
 *  setting; every other thinking-capable rung takes "disabled". Keep this
 *  per-model: that 400 contains "is not supported" (see
 *  MODEL_UNAVAILABLE_MARKERS), so the wrong shape would silently skip the
 *  primary instead of failing. Verified live on the streaming path: with
 *  `between_tools` a tool-less request streams no thinking blocks; with the
 *  field omitted, 5.5 thinks by default (a thinking block appears). */
function thinkingOff(model: string): {
  type: "disabled" | "between_tools";
} {
  return model.includes("sonnet-5-5")
    ? { type: "between_tools" }
    : { type: "disabled" };
}

/** Sonnet 5 and 5.5 (every id form: `us.anthropic.claude-sonnet-5`,
 *  `global.anthropic.claude-sonnet-5-5`, `claude-sonnet-5-5`, ...). */
function isSonnet5Family(model: string): boolean {
  return model.includes("sonnet-5");
}

const THINKING_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

type ThinkingEffort = (typeof THINKING_EFFORTS)[number];

/** How hard the model may think. LLM_THINKING_EFFORT (exactly one of "low", "medium", "high",
 *  "xhigh" or "max", lower case; anything else is ignored) overrides every thinking-capable
 *  rung; otherwise Sonnet 5.x gets "medium" and everything else keeps "low".
 *
 *  Which levels a model takes was read off Bedrock's own 400 on the streaming action
 *  (2026-10-01): Sonnet 5 and 5.5 accept all five, Sonnet 4.6 accepts "low", "medium", "high"
 *  and "max" and answers 400 to "xhigh". A 400 is not fallback-eligible, so "xhigh" is never
 *  sent to a model that is not Sonnet 5.x: it becomes "max", the level above (Opus 4.7 may take it).
 *
 *  What the levels do on Sonnet 5.5 (production prompt, 90 calls over 15 recruiter-style
 *  questions, 2026-10-01): "low" reasoned on 1 of 15 calls, "medium" on 3 of 15, "high" on 16 of
 *  25 (it skipped "hi", "What is your current role?" and "What is Pensieve?" every time),
 *  "xhigh" on 30 of 30 (first answer text after 4.1 s on average, 7.6 s at most) and "max" on
 *  5 of 5 (10 s on average, 20.5 s at most). So "medium", the default, reasons mostly on the
 *  hard questions (2 of its 3 reasoned calls); "xhigh" shows reasoning on every question.
 *  Sonnet 4.6 keeps the "low" it has always been sent. */
function thinkingEffort(model: string): ThinkingEffort {
  const override = process.env.LLM_THINKING_EFFORT;
  const level = THINKING_EFFORTS.find((known) => known === override);
  if (level !== undefined) {
    return level === "xhigh" && !isSonnet5Family(model) ? "max" : level;
  }
  return isSonnet5Family(model) ? "medium" : "low";
}

/** The shared thinking-plus-answer ceiling: `max_tokens` counts reasoning and answer together,
 *  and a completion that spends it all on reasoning ends with no answer and no fallback. Output
 *  measured on Sonnet 5.5 over the same 90 calls: at most 593 tokens at "low", 578 at "medium",
 *  694 at "high", 960 at "xhigh" and 2,902 at "max", for answers of two to four sentences; each
 *  floor leaves several times that. A larger value from the caller is never lowered. */
function thinkingTokenFloor(model: string, effort: ThinkingEffort): number {
  switch (effort) {
    case "max":
      return 32_000;
    case "xhigh":
      return 16_000;
    case "high":
      return 8_192;
    default:
      return isSonnet5Family(model) ? 4096 : 2048;
  }
}

/** The adaptive-thinking request shape. Sonnet 5.x returns a thinking block with EMPTY
 *  text unless `display: "summarized"` is set (the default is "omitted"), while
 *  billing the same thinking tokens, so without it the panel can never show anything.
 *  Sonnet 4.6 already returns summaries by default and keeps the request it has
 *  always sent. Verified live on the streaming path: thinking_delta events carry the
 *  summary, then one signature_delta (ignored by the loop below), then the answer. */
function adaptiveThinking(model: string): {
  type: "adaptive";
  display?: "summarized";
} {
  return isSonnet5Family(model)
    ? { type: "adaptive", display: "summarized" }
    : { type: "adaptive" };
}

/** 400 messages that mean "this MODEL is unavailable" (Bedrock reports an
 *  un-enabled / mistyped inference-profile id as a 400, not a 404). Only these
 *  400s trigger fallback; every other 400 is a deterministic input error. A 403
 *  saying the same (model access not granted) advances the chain too. */
const MODEL_UNAVAILABLE_MARKERS = [
  "model identifier is invalid",
  "model id is invalid",
  "could not be found",
  "not authorized to access the model",
  "don't have access to the model",
  "is not supported",
];

/** 403 messages that mean "this principal may not use THIS model": an IAM
 *  identity-policy deny (this account hard-denies the whole Opus family) or a
 *  missing allow. The next rung may still be permitted, so these advance the
 *  chain. A bad-credential 403 (invalid/expired token, signature mismatch) says
 *  none of this and stays terminal — every rung would fail the same way. */
const MODEL_DENIED_MARKERS = ["is not authorized to perform", "explicit deny"];

export function getProvider(): LlmProvider {
  return process.env.LLM_PROVIDER === "anthropic" ? "anthropic" : "bedrock";
}

/**
 * Decode a base64-encoded secret; return it unchanged if it isn't base64.
 * Uses a round-trip equality check (re-encode the decode and compare) — many
 * raw secrets are coincidentally valid base64, so a plain "decodes ok" test is
 * too loose. Raw AKIA… keys are not valid base64 of themselves, so they fall
 * through unchanged. Empty/undefined -> "".
 */
function decodeSecret(value: string | undefined): string {
  if (!value) return "";
  try {
    const decoded = Buffer.from(value, "base64").toString("utf-8");
    if (Buffer.from(decoded, "utf-8").toString("base64") === value)
      return decoded;
  } catch {
    /* fall through */
  }
  return value;
}

// Exported so other AWS-backed routes (e.g. /api/tts -> Polly, which uses the SAME
// account + region) reuse the exact base64-decode + reserved-var handling instead of
// re-deriving it. Returns decoded creds + region; values are "" when unset.
export function bedrockCreds() {
  return {
    accessKeyId: decodeSecret(process.env.BEDROCK_ACCESS_KEY_ID),
    secretAccessKey: decodeSecret(process.env.BEDROCK_SECRET_ACCESS_KEY),
    sessionToken: process.env.BEDROCK_SESSION_TOKEN
      ? decodeSecret(process.env.BEDROCK_SESSION_TOKEN)
      : undefined,
    // Prefer BEDROCK_REGION: AWS_REGION is a RESERVED var on Vercel/Lambda and was
    // observed corrupted in prod ("s-east-1") — using a non-reserved name avoids the
    // platform mangling it. Fall back to AWS_REGION (local dev) then a sane default.
    region: process.env.BEDROCK_REGION || process.env.AWS_REGION || "us-east-1",
  };
}

/** Provider-aware readiness for the 503 gate — pure env check, no network. */
export function isConfigured(): boolean {
  if (getProvider() === "bedrock") {
    const { accessKeyId, secretAccessKey } = bedrockCreds();
    return Boolean(accessKeyId && secretAccessKey);
  }
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Ordered model chain for the active provider: [primary, Opus if opted in, Sonnet 4.6,
 *  Haiku], repeats dropped (see buildChain). */
export function modelChain(): string[] {
  return getProvider() === "bedrock" ? bedrockChain() : anthropicChain();
}

/**
 * Construct the client for the active provider, typed as the base SDK surface
 * (AnthropicBedrock extends Anthropic, so messages.create/stream line up).
 */
export function makeClient(): Anthropic {
  if (getProvider() === "bedrock") {
    const { accessKeyId, secretAccessKey, sessionToken, region } =
      bedrockCreds();
    // Pass DECODED creds explicitly via providerChainResolver (the .env stores
    // them base64-encoded under BEDROCK_* names, so the AWS default chain would
    // otherwise sign with the still-encoded values). Double-async by design:
    // the resolver returns a credential provider, which returns the credentials.
    return new AnthropicBedrock({
      awsRegion: region,
      timeout: PER_ATTEMPT_TIMEOUT_MS,
      providerChainResolver: async () => async () => ({
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      }),
    }) as unknown as Anthropic;
  }
  // anthropic: key read from ANTHROPIC_API_KEY in env.
  return new Anthropic({ timeout: PER_ATTEMPT_TIMEOUT_MS });
}

/**
 * True if `err` means "try a different model" (transient/availability), false
 * for deterministic input errors (malformed prompt/schema, bad creds) that fail
 * identically on every model. status+message-driven so it survives even a
 * hypothetical double-install of the SDK where `instanceof` could break.
 *
 * A 403 is eligible only when its message names a per-model deny
 * (MODEL_DENIED_MARKERS / MODEL_UNAVAILABLE_MARKERS). Without that, an
 * IAM-denied rung (the opt-in Opus rung, or the global Sonnet 5.5 profile when
 * the policy lacks it) would end the chain in the apology and the rungs behind
 * it would never be reached.
 */
export function isFallbackEligible(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionError) return true; // incl. timeout subclass
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 404) return true;
  if (typeof status === "number" && status >= 500) return true;
  if (status === 400 || status === 403) {
    // AWS may spell an apostrophe typographically where the markers use the
    // ASCII one; fold it so "don't have access to the model" matches either
    // spelling. Only the listed markers count: "isn't supported" would not.
    const msg = String((err as { message?: string })?.message ?? "")
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'");
    const markers =
      status === 403
        ? [...MODEL_UNAVAILABLE_MARKERS, ...MODEL_DENIED_MARKERS]
        : MODEL_UNAVAILABLE_MARKERS;
    return markers.some((m) => msg.includes(m));
  }
  // plain 400, 422, 401, and a 403 that is not a per-model deny (bad or expired
  // credentials, signature mismatch) -> deterministic -> NOT eligible
  return false;
}

/**
 * Stream a completion, falling through the model chain on availability errors.
 *
 * THE LOAD-BEARING INVARIANT: streaming errors surface inside the `for await`
 * loop (never at the .stream() callsite), so connect-time and mid-stream errors
 * are indistinguishable by call site. The ONLY reliable fallback discriminator
 * is whether any text byte has already been sent to the client — once bytes are
 * on the wire we cannot un-send them, so a later error is terminal.
 */
// TRACE_DELIMITER lives in the client-safe llm-trace module (so the chat client can
// import it without the Bedrock SDK); re-exported here for existing server callers.
export { TRACE_DELIMITER, THINKING_SENTINEL, THINKING_END };

/**
 * Per-attempt usage block captured from the streamed events. Snake-case fields
 * mirror the Anthropic SDK shape exactly (the Bedrock Converse API uses camelCase
 * — Anvilry uses the SDK, NOT raw Converse, so snake_case is correct here). A
 * future SDK swap that returns camelCase fields would silently zero this out;
 * the fixture test in llm.test.ts pins the snake_case names so that regression
 * is caught at build time, not in production after a $200 Polly bill.
 */
export type LlmUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

/** Per-attempt span surfaced via the onAttempt callback. One emission per model
 *  in the fallback chain — success OR error. The chat route passes onAttempt to
 *  emit() a structured llm.attempt event for the dashboard's cache-hit-rate +
 *  fallback-dynamics tiles. */
export type LlmAttempt = {
  model: string;
  attempt_index: number;
  fell_back: boolean;
  /** Time from the first byte of the request to the first content_block_delta event,
   *  in ms. Undefined if the attempt errored before any delta arrived. */
  ttft_ms?: number;
  /** Total wall-clock from attempt start to attempt resolution (success or error). */
  latency_ms: number;
  /** Bedrock-side reason (end_turn / max_tokens / stop_sequence / tool_use / error). */
  finish_reason?: string;
  usage?: LlmUsage;
  error?: { name: string; message: string; status?: number };
  /** Full answer prose for THIS attempt. Present ONLY on a clean, complete
   *  success (mirrors "a trace frame was appended"); absent on every error,
   *  mid-stream failure, or thinking-only/zero-byte completion. Excludes
   *  thinking_delta bytes and the trailing trace frame structurally — it is
   *  built from the exact same text_delta bytes the client renders. */
  answerText?: string;
};

export function streamWithFallback(
  params: Omit<Anthropic.MessageStreamParams, "model">,
  opts?: {
    onError?: (err: unknown, model: string) => void;
    /** Per-attempt span callback — fires once per model in the fallback chain
     *  (success or error). Use this in the chat route to emit() llm.attempt
     *  telemetry events. Synchronous + non-throwing by contract; any throw is
     *  swallowed to preserve the stream. */
    onAttempt?: (attempt: LlmAttempt) => void;
    /** Optional traceId threaded into the trace frame so the client can correlate
     *  the streamed answer with the server-side llm.attempt events. */
    traceId?: string;
    /** When true, enables Anthropic adaptive extended thinking (effort: see thinkingEffort()).
     *  Haiku models are silently excluded — they do not support extended thinking.
     *  The stream is: THINKING_SENTINEL + reasoning bytes + THINKING_END + answer bytes.
     *  Reasoning streams live to the client; the trace frame does NOT include reasoning. */
    extendedThinking?: boolean;
  },
): ReadableStream<Uint8Array> {
  const chain = modelChain();
  const encoder = new TextEncoder();
  // Derive the contact from the single source so the failure path can't go stale.
  const apologyTail = `\n\n[Sorry — something went wrong. Please email ${profile.email}.]`;
  // Trace frame extends the v1.6 {model, fellBack} shape with v1.8 fields. The
  // shape is ADDITIVE — splitTrace at use-chat.ts:13-24 does JSON.parse(rest) and
  // spreads into ChatMessage, so unknown keys are silently kept. Existing
  // llm-trace.test.ts only pins the U+001E delimiter character, which is unchanged.
  const traceFrame = (
    model: string,
    index: number,
    extra: { usage?: LlmUsage; ttft_ms?: number; latency_ms?: number },
  ) =>
    encoder.encode(
      `${TRACE_DELIMITER}${JSON.stringify({
        model,
        fellBack: index > 0,
        ...(opts?.traceId ? { traceId: opts.traceId } : {}),
        ...(extra.usage ? { usage: extra.usage } : {}),
        ...(extra.ttft_ms != null ? { ttftMs: extra.ttft_ms } : {}),
        ...(extra.latency_ms != null ? { latencyMs: extra.latency_ms } : {}),
      })}`,
    );

  // Best-effort callback runner — onAttempt is observability, never let it
  // affect the user-facing stream.
  const safeOnAttempt = (attempt: LlmAttempt) => {
    try {
      opts?.onAttempt?.(attempt);
    } catch {
      /* swallow — telemetry must never break the chat */
    }
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let emittedAny = false;
      // Tracks whether THINKING_SENTINEL has been sent for the WHOLE stream,
      // not per attempt — the old `!emittedAny` guard re-fired it on every
      // fallback attempt that hadn't produced text yet (e.g. Sonnet throws
      // mid-thinking, the next rung retries: a second, spurious THINKING_SENTINEL
      // landed mid-reasoning). The sentinel opens the framing exactly once;
      // matches thinkingEndEmitted's per-attempt closing counterpart below.
      let thinkingSentinelEmitted = false;
      let closed = false;
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      // Build the client INSIDE start() so a constructor failure (bad cred shape,
      // SDK init error) becomes a graceful apology stream — not an uncaught 500 at
      // the route. (makeClient ran synchronously outside the stream before.)
      let client: Anthropic;
      try {
        client = makeClient();
      } catch (err) {
        opts?.onError?.(err, "client-init");
        safeOnAttempt({
          model: "client-init",
          attempt_index: -1,
          fell_back: false,
          latency_ms: 0,
          error: {
            name: (err as Error)?.name ?? "Error",
            message: (err as Error)?.message ?? String(err),
          },
        });
        controller.enqueue(encoder.encode(apologyTail.replace(/^\n\n/, "")));
        close();
        return;
      }

      for (let i = 0; i < chain.length; i++) {
        const model = chain[i];
        const attemptStart = Date.now();
        // Per-attempt usage accumulator. message_start carries input_tokens +
        // cache_creation/read_input_tokens; message_delta carries output_tokens.
        // Start undefined so the trace frame omits the key when the SDK doesn't
        // emit a usage block (defensive against future event-shape changes).
        let usage: LlmUsage | undefined;
        let ttftMs: number | undefined;
        let finishReason: string | undefined;
        let thinkingEndEmitted = false;
        // Accumulates ONLY text_delta bytes (never thinking_delta, never the
        // trailing trace frame — both are appended/emitted elsewhere in this
        // loop). Read by route.ts's onAttempt handler to write-through a clean
        // answer into the FAQ cache; undefined on any error/fallback path.
        let answerText = "";

        // Extended thinking: only for non-Haiku models (Haiku doesn't support the
        // `thinking` param at all — not even an explicit "disabled"). NOTE: If
        // multimodal attachments are present (content is a ContentBlockParam[]),
        // extended thinking + image content blocks may conflict on some Bedrock
        // inference profiles. If this becomes an issue, disable thinking when
        // content is not a plain string by checking:
        // messages.some(m => Array.isArray(m.content)).
        const useThinking =
          opts?.extendedThinking === true && !model.includes("haiku");
        const modelSupportsThinking = !model.includes("haiku");

        // Adaptive thinking (`{type:"adaptive"}` + `output_config.effort`)
        // replaces the deprecated `{type:"enabled", budget_tokens}` shape: AWS
        // Bedrock docs mark that shape deprecated on Sonnet/Opus 4.6 ("to be
        // removed in a future model release"), and Claude Sonnet 5/Opus 5 reject
        // it outright with a ValidationException. Adaptive thinking needs no
        // beta header (client.messages.stream() is enough — no more
        // client.beta.messages.stream() special-casing) and no max_tokens bump
        // for the budget itself; "effort" bounds thinking cost directly. "low"
        // approximates this route's prior small 1024-token budget's intent (a
        // quick portfolio-bot answer, not a deep research task); Sonnet 5.x gets
        // "medium" because at "low" it did not think when measured (see thinkingEffort()). The
        // max_tokens bump below is shared thinking+answer headroom, sized by thinkingTokenFloor():
        // 2048, 4096 on Sonnet 5.x, and up to 32000 at the highest efforts.
        //
        // CRITICAL: Sonnet 5 / Opus 5 run adaptive thinking ON BY DEFAULT when
        // the `thinking` field is omitted entirely — unlike 4.6, where omission
        // means no thinking at all. So the "off" case below sends an EXPLICIT
        // off shape (thinkingOff()) for any thinking-capable model, never just omits
        // the field — omission would silently start reasoning (and billing for
        // it) the moment LLM_USE_SONNET_5 flips on, even with extendedThinking
        // false. Haiku gets no `thinking` key at all, since it doesn't
        // recognize the param.
        // (That shape is "disabled", or `between_tools` for Sonnet 5.5, which
        // rejects "disabled": see thinkingOff().)
        const stream = client.messages.stream({
          ...params,
          model,
          ...(useThinking
            ? {
                max_tokens: Math.max(
                  (params as { max_tokens?: number }).max_tokens ?? 0,
                  thinkingTokenFloor(model, thinkingEffort(model)),
                ),
              }
            : {}),
          ...(modelSupportsThinking
            ? {
                thinking: useThinking
                  ? adaptiveThinking(model)
                  : thinkingOff(model),
                ...(useThinking
                  ? { output_config: { effort: thinkingEffort(model) } }
                  : {}),
              }
            : {}),
        } as Anthropic.MessageStreamParams & { model: string });

        // Emit THINKING_SENTINEL immediately so client shows animation without
        // waiting for the first thinking_delta (which may take several hundred ms).
        // Guarded on thinkingSentinelEmitted (once per stream), not emittedAny
        // (once per attempt) — see the declaration above.
        if (useThinking && !emittedAny && !thinkingSentinelEmitted) {
          controller.enqueue(encoder.encode(THINKING_SENTINEL));
          thinkingSentinelEmitted = true;
        }
        try {
          for await (const event of stream) {
            // message_start carries the initial usage block: input_tokens (the
            // non-cached prompt tokens charged at full rate) + cache_creation +
            // cache_read input tokens. THIS is where prompt-cache verification
            // lives — until v1.8 these were silently dropped.
            if (event.type === "message_start") {
              const u = (event.message as { usage?: LlmUsage } | undefined)
                ?.usage;
              if (u) {
                usage = {
                  ...(u.input_tokens != null
                    ? { input_tokens: u.input_tokens }
                    : {}),
                  ...(u.cache_creation_input_tokens != null
                    ? {
                        cache_creation_input_tokens:
                          u.cache_creation_input_tokens,
                      }
                    : {}),
                  ...(u.cache_read_input_tokens != null
                    ? { cache_read_input_tokens: u.cache_read_input_tokens }
                    : {}),
                };
              }
              continue;
            }
            // message_delta carries output_tokens (incremented as the model
            // emits) + the final stop_reason on the closing event.
            if (event.type === "message_delta") {
              const u = (event as { usage?: { output_tokens?: number } }).usage;
              if (u?.output_tokens != null) {
                usage = { ...(usage ?? {}), output_tokens: u.output_tokens };
              }
              const sr = (event as { delta?: { stop_reason?: string } }).delta
                ?.stop_reason;
              if (sr) finishReason = sr;
              continue;
            }
            // Extended thinking: stream thinking_delta bytes live to the client.
            // They arrive BEFORE text_delta events. The client uses THINKING_SENTINEL
            // (already emitted above) + THINKING_END (emitted on first text_delta below)
            // to delineate the reasoning phase from the answer phase.
            //
            // Gated on useThinking, not just "did a thinking_delta event
            // arrive": the explicit request-side thinking-off shape set above
            // should make this unreachable in practice, but Sonnet
            // 5/Opus 5's adaptive-thinking-on-by-default behavior is exactly
            // the kind of provider-side default this repo has already been
            // burned by once — if a thinking_delta ever arrives despite the
            // explicit off shape, drop it here rather than streaming raw, unframed
            // bytes (no THINKING_SENTINEL was emitted for this attempt in that case).
            // Also dropped once THINKING_END is out: it would read as answer text.
            if (
              event.type === "content_block_delta" &&
              (event.delta as { type: string; thinking?: string }).type ===
                "thinking_delta"
            ) {
              if (!useThinking || thinkingEndEmitted) continue;
              // Stripped defensively: a legitimate thinking chunk should never
              // contain the protocol's own framing bytes (see llm-trace.ts) —
              // this is a live stream, not something faqCacheSet can sanitize
              // after the fact.
              const chunk = stripControlBytes(
                (event.delta as { type: string; thinking?: string }).thinking ??
                  "",
              );
              if (chunk) controller.enqueue(encoder.encode(chunk));
              continue;
            }
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              if (ttftMs == null) ttftMs = Date.now() - attemptStart;
              // On the FIRST text_delta: emit THINKING_END to signal reasoning is done.
              if (useThinking && !thinkingEndEmitted) {
                controller.enqueue(encoder.encode(THINKING_END));
                thinkingEndEmitted = true;
              }
              // Stripped defensively — same reasoning as the thinking_delta
              // branch above; also keeps answerText (the FAQ-cache write
              // source) clean without needing a second pass later.
              const text = stripControlBytes(event.delta.text);
              controller.enqueue(encoder.encode(text));
              answerText += text;
              emittedAny = true;
              continue;
            }
            // message_stop, content_block_start, content_block_stop — ignored;
            // their payloads are already covered by message_delta + the byte stream.
          }
          // Loop ended with zero text_delta events (e.g. adaptive thinking
          // consumed the whole max_tokens budget and the model stopped after
          // reasoning alone — a real risk now that adaptive thinking has no
          // hard budget_tokens ceiling reserving headroom for an answer, unlike
          // the deprecated shape this replaced). Without this, thinkingEndEmitted
          // stays false forever: THINKING_SENTINEL was already sent, but
          // THINKING_END — the ONLY signal that closes the client's "thinking"
          // UI state — would never fire, leaving the client stuck reasoning
          // forever even though the stream is about to close with no answer.
          if (useThinking && !thinkingEndEmitted) {
            controller.enqueue(encoder.encode(THINKING_END));
            thinkingEndEmitted = true;
          }
          const latencyMs = Date.now() - attemptStart;
          safeOnAttempt({
            model,
            attempt_index: i,
            fell_back: i > 0,
            ttft_ms: ttftMs,
            latency_ms: latencyMs,
            finish_reason: finishReason,
            usage,
            // Present iff a trace frame is about to be appended below — i.e. iff
            // the client will render a fully-formed assistant message. Never set
            // on the catch-block's safeOnAttempt call, so a partial answer is
            // never cached (the route also skips fell_back successes).
            ...(emittedAny ? { answerText } : {}),
          });
          // Clean finish — append the honest trace frame (which model served the bytes,
          // whether a fallback fired, and the v1.8 usage + ttft + latency telemetry).
          // Only on a real answer (emittedAny) — preserves the v1.6 invariant that the
          // trace frame can't materialize on a zero-byte attempt.
          if (emittedAny)
            controller.enqueue(
              traceFrame(model, i, {
                usage,
                ttft_ms: ttftMs,
                latency_ms: latencyMs,
              }),
            );
          close();
          return;
        } catch (err) {
          const latencyMs = Date.now() - attemptStart;
          opts?.onError?.(err, model);
          safeOnAttempt({
            model,
            attempt_index: i,
            fell_back: i > 0,
            ttft_ms: ttftMs,
            latency_ms: latencyMs,
            finish_reason: finishReason,
            usage,
            error: {
              name: (err as Error)?.name ?? "Error",
              message: (err as Error)?.message ?? String(err),
              status: (err as { status?: number })?.status,
            },
          });
          const isLast = i === chain.length - 1;
          const goingToApology =
            emittedAny || isLast || !isFallbackEligible(err);
          // Close THIS attempt's thinking phase before a terminal apology or
          // a fallback to a model that doesn't support thinking (Haiku) — the
          // client's parser treats every byte after THINKING_SENTINEL as
          // reasoning until THINKING_END arrives, so without this, the NEXT
          // thing streamed (the apology text, or Haiku's real answer) would
          // be silently misclassified as more reasoning and never rendered
          // as the visible answer. A retry to a model that DOES support
          // thinking deliberately skips this: its own reasoning continues
          // the same still-open framing seamlessly (see CodeRabbit review of
          // PR #260 — this is the catch-path counterpart to the "always emit
          // THINKING_END" fix above, which only covered the non-throwing path).
          const nextModelSupportsThinking =
            !isLast && !chain[i + 1].includes("haiku");
          if (
            useThinking &&
            !thinkingEndEmitted &&
            (goingToApology || !nextModelSupportsThinking)
          ) {
            controller.enqueue(encoder.encode(THINKING_END));
            thinkingEndEmitted = true;
          }
          if (goingToApology) {
            controller.enqueue(encoder.encode(apologyTail));
            close();
            return;
          }
          // zero bytes emitted + eligible + models remain -> try the next model
        }
      }
      close();
    },
  });
}
