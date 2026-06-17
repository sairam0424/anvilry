import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { profile } from "@/lib/profile";
import { TRACE_DELIMITER } from "@/lib/llm-trace";

/**
 * LLM provider abstraction for the "Ask my portfolio" chatbot.
 *
 * Single source of truth for: provider choice, client construction, the model
 * fallback chain, AWS credential decoding, fallback-eligibility, and the
 * streaming-with-fallback loop. The route imports only from here, so swapping
 * AWS Bedrock <-> the direct Anthropic API is an env change (LLM_PROVIDER), not
 * a code change.
 *
 * Owner directive: Sonnet 4.6 primary -> Opus 4.6 secondary -> Haiku 4.5 fallback.
 * (Updated 2026-06-17 to match the BEDROCK_CHAIN order below — earlier wording said
 * "Opus primary" while the array shipped Sonnet-first since v1.6, leaving log
 * analysis ambiguous about which model was the "expected primary" on a given turn.)
 * Ported from the production pattern in Too-Hot-To-Loose (career_copilot provider.py).
 */

export type LlmProvider = "bedrock" | "anthropic";

const PER_ATTEMPT_TIMEOUT_MS = 15_000;

/**
 * Region-prefixed Bedrock inference-profile IDs (verified live in the reference
 * account). NOTE: Opus 4.6 REQUIRES the `-v1` suffix — the bare id 400s with
 * "model identifier is invalid". Sonnet 4.6's bare id resolves fine.
 */
const BEDROCK_CHAIN = [
  "us.anthropic.claude-sonnet-4-6", // primary (fast, cost-effective)
  "us.anthropic.claude-opus-4-6-v1", // secondary (deeper reasoning if needed)
  "us.anthropic.claude-haiku-4-5-20251001-v1:0", // fallback
];

/** Direct-API chain (used only when LLM_PROVIDER=anthropic). */
const ANTHROPIC_CHAIN = ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5"];

/** 400 messages that mean "this MODEL is unavailable" (Bedrock reports an
 *  un-enabled / mistyped inference-profile id as a 400, not a 404). Only these
 *  400s trigger fallback; every other 400 is a deterministic input error. */
const MODEL_UNAVAILABLE_MARKERS = [
  "model identifier is invalid",
  "model id is invalid",
  "could not be found",
  "not authorized to access the model",
  "don't have access to the model",
  "is not supported",
];

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
    if (Buffer.from(decoded, "utf-8").toString("base64") === value) return decoded;
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

/** Ordered model chain [primary, secondary, fallback] for the active provider. */
export function modelChain(): string[] {
  return getProvider() === "bedrock" ? BEDROCK_CHAIN : ANTHROPIC_CHAIN;
}

/**
 * Construct the client for the active provider, typed as the base SDK surface
 * (AnthropicBedrock extends Anthropic, so messages.create/stream line up).
 */
export function makeClient(): Anthropic {
  if (getProvider() === "bedrock") {
    const { accessKeyId, secretAccessKey, sessionToken, region } = bedrockCreds();
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
 */
export function isFallbackEligible(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionError) return true; // incl. timeout subclass
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 404) return true;
  if (typeof status === "number" && status >= 500) return true;
  if (status === 400) {
    const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
    return MODEL_UNAVAILABLE_MARKERS.some((m) => msg.includes(m));
  }
  // plain 400, 422, 401, 403 -> deterministic -> NOT eligible
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
export { TRACE_DELIMITER };

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
        const stream = client.messages.stream({ ...params, model });
        try {
          for await (const event of stream) {
            // message_start carries the initial usage block: input_tokens (the
            // non-cached prompt tokens charged at full rate) + cache_creation +
            // cache_read input tokens. THIS is where prompt-cache verification
            // lives — until v1.8 these were silently dropped.
            if (event.type === "message_start") {
              const u = (event.message as { usage?: LlmUsage } | undefined)?.usage;
              if (u) {
                usage = {
                  ...(u.input_tokens != null ? { input_tokens: u.input_tokens } : {}),
                  ...(u.cache_creation_input_tokens != null
                    ? { cache_creation_input_tokens: u.cache_creation_input_tokens }
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
              const sr = (event as { delta?: { stop_reason?: string } }).delta?.stop_reason;
              if (sr) finishReason = sr;
              continue;
            }
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              if (ttftMs == null) ttftMs = Date.now() - attemptStart;
              controller.enqueue(encoder.encode(event.delta.text));
              emittedAny = true;
              continue;
            }
            // message_stop, content_block_start, content_block_stop — ignored;
            // their payloads are already covered by message_delta + the byte stream.
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
          });
          // Clean finish — append the honest trace frame (which model served the bytes,
          // whether a fallback fired, and the v1.8 usage + ttft + latency telemetry).
          // Only on a real answer (emittedAny) — preserves the v1.6 invariant that the
          // trace frame can't materialize on a zero-byte attempt.
          if (emittedAny)
            controller.enqueue(traceFrame(model, i, { usage, ttft_ms: ttftMs, latency_ms: latencyMs }));
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
          if (emittedAny || isLast || !isFallbackEligible(err)) {
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
