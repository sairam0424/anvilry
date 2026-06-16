import { PollyClient, SynthesizeSpeechCommand, type VoiceId } from "@aws-sdk/client-polly";
import { bedrockCreds } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getDefaultVoiceId,
  resolvePollyParams,
  validateVoiceForEngine,
} from "@/lib/voice-catalog";
import { cacheGet, cacheKey, cacheSet } from "./cache";

export const runtime = "nodejs";
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
  if (!isConfigured()) {
    // Not wired up -> client falls back to browser TTS.
    return Response.json({ error: "TTS not configured." }, { status: 503 });
  }

  // Same per-IP guard as /api/chat — Polly is real spend, so bound it.
  const rl = await checkRateLimit(req);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  // A single sentence is tiny; reject an oversized body by declared length up front.
  if (Number(req.headers.get("content-length") ?? 0) > 8 * 1024) {
    return Response.json({ error: "Request too large." }, { status: 413 });
  }

  let body: { text?: unknown; voiceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  if (!text) return Response.json({ error: "Expected text." }, { status: 400 });

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
    return Response.json(
      { error: "Unknown voice for this engine." },
      { status: 400 },
    );
  }

  const polly = resolvePollyParams(requestedVoiceId);
  // validateVoiceForEngine already guarantees this — narrow for TS.
  if (!polly) {
    return Response.json({ error: "Voice resolution failed." }, { status: 400 });
  }

  const key = cacheKey(text, polly.pollyVoiceId, polly.tier);
  const cached = cacheGet(key);
  if (cached) {
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
      return Response.json({ error: "No audio." }, { status: 502 });
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
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600", "X-TTS-Cache": "miss" },
    });
  } catch (err) {
    console.warn(`[tts] Polly failed: ${(err as Error)?.name ?? "error"}`);
    // Fail closed — client falls back to browser speechSynthesis.
    return Response.json({ error: "TTS failed." }, { status: 502 });
  }
}
