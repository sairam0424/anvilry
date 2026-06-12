import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { profile } from "@/lib/profile";

/**
 * LLM provider abstraction for the "Ask my portfolio" chatbot.
 *
 * Single source of truth for: provider choice, client construction, the model
 * fallback chain, AWS credential decoding, fallback-eligibility, and the
 * streaming-with-fallback loop. The route imports only from here, so swapping
 * AWS Bedrock <-> the direct Anthropic API is an env change (LLM_PROVIDER), not
 * a code change.
 *
 * Owner directive: Opus 4.6 primary -> Sonnet 4.6 secondary -> Haiku 4.5 fallback.
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
  "us.anthropic.claude-opus-4-6-v1", // primary
  "us.anthropic.claude-sonnet-4-6", // secondary
  "us.anthropic.claude-haiku-4-5-20251001-v1:0", // fallback
];

/** Direct-API chain (used only when LLM_PROVIDER=anthropic). */
const ANTHROPIC_CHAIN = ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"];

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

function bedrockCreds() {
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
export function streamWithFallback(
  params: Omit<Anthropic.MessageStreamParams, "model">,
  opts?: { onError?: (err: unknown, model: string) => void },
): ReadableStream<Uint8Array> {
  const chain = modelChain();
  const encoder = new TextEncoder();
  // Derive the contact from the single source so the failure path can't go stale.
  const apologyTail = `\n\n[Sorry — something went wrong. Please email ${profile.email}.]`;

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
        controller.enqueue(encoder.encode(apologyTail.replace(/^\n\n/, "")));
        close();
        return;
      }

      for (let i = 0; i < chain.length; i++) {
        const model = chain[i];
        const stream = client.messages.stream({ ...params, model });
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(event.delta.text));
              emittedAny = true;
            }
          }
          close(); // clean finish
          return;
        } catch (err) {
          opts?.onError?.(err, model);
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
