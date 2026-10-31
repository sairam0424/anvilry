import { apiError, methodNotAllowed, optionsFor } from "@/lib/api-error";
import { PollyClient, SynthesizeSpeechCommand, type VoiceId } from "@aws-sdk/client-polly";
import { bedrockCreds } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getDefaultVoiceId,
  resolvePollyParams,
  validateVoiceForEngine,
} from "@/lib/voice-catalog";
import { withTrace } from "@/lib/telemetry/with-trace";
import { emit } from "@/lib/telemetry/emit";
import { redact } from "@/lib/telemetry/schema";
import { randomUUID } from "node:crypto";
import { cacheGet, cacheKey, cacheSet } from "./cache";

export const maxDuration = 15;

/**
 * Optional, flag-gated TTS upgrade: AWS Polly Neural via the SAME AWS account/creds
 * the chat already uses for Bedrock (no new vendor). The client only hits this when
 * the visitor sets ttsEngine="polly"; otherwise it speaks via the free browser
 * speechSynthesis and this route is never called.
 *
 * Cost note: Polly Neural is free for the first 1M chars/mo (first 12 months) then
 * ~$16/1M. The client sends ONE sentence per request (so audio starts early), and we
 * cap length hard; a tiny in-process LRU caches identical sentences so a repeated
 * answer costs nothing. The per-IP Upstash limit also applies, so a bot can't run up
 * Polly spend.
 *
 * Fails CLOSED to the free path: any misconfiguration/error returns a non-2xx and the
 * client falls back to browser speechSynthesis — voice never breaks, it just degrades.
 */

const MAX_CHARS = 600;
const REGION_FALLBACK = "us-east-1";

// The catalog default ("polly-neural-joanna") is what an unspecified body resolves
// to — preserves v1.6 behavior exactly. resolvePollyParams() unwraps this to the
// AWS-native VoiceId + tier the SynthesizeSpeechCommand actually expects.
const DEFAULT_CATALOG_ID = getDefaultVoiceId();

function isConfigured(): boolean {
  const { accessKeyId, secretAccessKey } = bedrockCreds();
  return Boolean(accessKeyId && secretAccessKey);
}

let client: PollyClient | null = null;
function getClient(): PollyClient {
  if (client) return client;
  const { accessKeyId, secretAccessKey, sessionToken, region } = bedrockCreds();
  client = new PollyClient({
    region: region || REGION_FALLBACK,
    credentials: {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    },
  });
  return client;
}

export async function POST(req: Request) {
  return withTrace(req, "tts", async (ctx) => {
    if (!isConfigured()) {
      // Not wired up -> client falls back to browser TTS.
      return apiError(503, "not_configured", "TTS not configured.");
    }

    // Per-IP guard (shared "voice" bucket, separate from chat) — Polly is real spend, so bound it.
    const rl = await checkRateLimit(req, "voice");
    if (!rl.ok) {
      return apiError(429, "rate_limited", "Too many requests.", {
        hint: `Wait ${rl.retryAfter} seconds, then retry.`,
        headers: { "Retry-After": String(rl.retryAfter) },
      });
    }

    // A single sentence is tiny; reject an oversized body by declared length up front.
    if (Number(req.headers.get("content-length") ?? 0) > 8 * 1024) {
      return apiError(413, "payload_too_large", "Request too large.");
    }

    let body: { text?: unknown; voiceId?: unknown };
    try {
      body = await req.json();
    } catch {
      return apiError(400, "invalid_request", "Invalid request.");
    }

    const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
    if (!text) return apiError(400, "invalid_request", "Expected text.");

    // The body's voiceId is a catalog id (e.g. "polly-neural-joanna"). The catalog is
    // the source of truth for which Polly voices we expose AND which tier each voice
    // runs on — so we don't accept a separate `tier` field; mismatches (Joanna +
    // generative would 5xx at AWS) are impossible by construction. An unknown id
    // rejects with 400 instead of silently falling back, so a typo in client code
    // surfaces immediately rather than masquerading as Joanna.
    const requestedVoiceId =
      typeof body.voiceId === "string" && body.voiceId.length > 0 && body.voiceId.length < 64
        ? body.voiceId
        : DEFAULT_CATALOG_ID;

    if (!validateVoiceForEngine(requestedVoiceId, "polly")) {
      return apiError(400, "invalid_request", "Unknown voice for this engine.");
    }

    const polly = resolvePollyParams(requestedVoiceId);
    // validateVoiceForEngine already guarantees this — narrow for TS.
    if (!polly) {
      return apiError(400, "invalid_request", "Voice resolution failed.");
    }

    const key = cacheKey(text, polly.pollyVoiceId, polly.tier);
    const cached = cacheGet(key);
    if (cached) {
      ctx.attrs({
        voiceId: requestedVoiceId,
        polly_voice_id: polly.pollyVoiceId,
        tier: polly.tier,
        char_count: text.length,
        cache_hit: true,
      });
      return new Response(new Uint8Array(cached), {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600", "X-TTS-Cache": "hit" },
      });
    }

    try {
      const out = await getClient().send(
        new SynthesizeSpeechCommand({
          Text: text,
          OutputFormat: "mp3",
          // Cast: polly.pollyVoiceId comes from the validated catalog entry (a known
          // AWS VoiceId). The SDK types it as a string-literal union and won't accept
          // a plain string, but the runtime semantics are identical.
          VoiceId: polly.pollyVoiceId as VoiceId,
          Engine: polly.tier,
        }),
      );
      if (!out.AudioStream) {
        // Capture the AWS request id even on a no-audio response — useful for triage.
        ctx.attrs({
          voiceId: requestedVoiceId,
          polly_voice_id: polly.pollyVoiceId,
          tier: polly.tier,
          char_count: text.length,
          cache_hit: false,
          aws_request_id: out.$metadata?.requestId,
          error_kind: "no-audio-stream",
        });
        return apiError(502, "upstream_error", "No audio.");
      }
      // The SDK stream -> bytes. transformToByteArray() can hang mid-stream on a stalled
      // connection (no built-in timeout), which would burn the whole maxDuration window.
      // Race it against a 10s cap so a hang fails FAST to 502 -> the client falls back to
      // free browser TTS, instead of blocking the function for the full 15s.
      const bytes = await Promise.race([
        out.AudioStream.transformToByteArray(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("polly-timeout")), 10_000),
        ),
      ]);
      const buf = Buffer.from(bytes);
      cacheSet(key, buf);
      ctx.attrs({
        voiceId: requestedVoiceId,
        polly_voice_id: polly.pollyVoiceId,
        tier: polly.tier,
        char_count: text.length,
        cache_hit: false,
        aws_request_id: out.$metadata?.requestId,
        byte_count: buf.length,
      });
      return new Response(new Uint8Array(buf), {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600", "X-TTS-Cache": "miss" },
      });
    } catch (err) {
      // Replaces the v1.7 console.warn with structured server.error — captures
      // err.name/message AND the AWS request id from $metadata (Polly SDK exposes
      // it on every error response; never read until v1.8). Then 502 keeps the
      // existing fail-closed contract so the client falls back to browser TTS.
      const e = err as { name?: string; message?: string; $metadata?: { requestId?: string } };
      emit({
        ts: Date.now(),
        traceId: ctx.traceId,
        spanId: randomUUID(),
        parentSpanId: ctx.spanId,
        kind: "server.error",
        route: "/api/tts",
        level: "error",
        message: e?.name ?? "error",
        attrs: {
          error_name: e?.name ?? "Error",
          error_message: e?.message ? redact(e.message) : undefined,
          aws_request_id: e?.$metadata?.requestId,
          voiceId: requestedVoiceId,
          polly_voice_id: polly.pollyVoiceId,
          tier: polly.tier,
          char_count: text.length,
        },
      });
      return apiError(502, "upstream_error", "TTS failed.");
    }
  });
}

// Methods this route does not implement answer a JSON 405 (with Allow) instead of Next's empty one.
const notAllowed = methodNotAllowed(["POST"]);
export const GET = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = optionsFor(["POST"]);
