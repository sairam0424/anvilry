import { checkRateLimit } from "@/lib/rate-limit";
import {
  resolveGoogleVoiceName,
  validateVoiceForEngine,
} from "@/lib/voice-catalog";
import { cacheGet, cacheKey, cacheSet } from "./cache";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * Optional v1.7 TTS engine: Google Cloud Text-to-Speech (Chirp 3 HD voices) as a
 * permanent-free hedge against AWS Polly's 12-month free-tier cliff. Mirrors the
 * Polly route's pattern (same rate-limit guard, same content-length precheck,
 * same in-process LRU, same 10s race timeout, same fail-closed contract) so the
 * client's fallback chain (google → polly → browser) works uniformly.
 *
 * The free tier here is the differentiator: 1 million chars/mo Chirp 3 HD,
 * permanent — never expires, unlike Polly Neural's 12-mo / 1M and Generative's
 * 12-mo / 100k. At Anvilry-scale traffic this is the cost-zero default for
 * year-2-and-beyond. When GOOGLE_TTS_API_KEY is unset, this route returns 503
 * and the client falls back to Polly (which falls back to browser TTS) — voice
 * never breaks, it just degrades.
 *
 * Uses the REST API directly (not @google-cloud/text-to-speech SDK) to keep the
 * Vercel function bundle small. The API key auth flow is the simplest viable —
 * no service-account JWT signing — and AVAILABLE keys can be scoped to just the
 * texttospeech.googleapis.com endpoint via GCP API restrictions.
 */

const MAX_CHARS = 600;

const GOOGLE_TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

function getApiKey(): string | undefined {
  const k = process.env.GOOGLE_TTS_API_KEY;
  return k && k.length > 0 ? k : undefined;
}

function isConfigured(): boolean {
  return Boolean(getApiKey());
}

/** Extract the language code from a Google voice name (e.g. "en-US-Chirp3-HD-Aoede"
 *  → "en-US"). Google's API requires both fields even when the name uniquely
 *  determines the language; pulling the prefix off the name keeps the catalog as
 *  the single source of truth (no separate language column to drift). */
function languageCodeFor(googleVoiceName: string): string {
  // The first two segments are language-region (e.g. "en-US"); rest is the voice id.
  const parts = googleVoiceName.split("-");
  if (parts.length < 2) return "en-US";
  return `${parts[0]}-${parts[1]}`;
}

export async function POST(req: Request) {
  if (!isConfigured()) {
    // No API key wired -> fail closed to the next engine in the client's fallback chain.
    return Response.json({ error: "TTS-Google not configured." }, { status: 503 });
  }

  // Same per-IP guard as /api/tts and /api/chat — Google free tier IS bounded
  // (1M chars/mo) so a bot can still exhaust it without rate limiting.
  const rl = await checkRateLimit(req);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

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

  // voiceId is REQUIRED for the Google route — there's no historical hardcoded
  // default to fall back on (this engine is new in v1.7), and the catalog requires
  // an explicit pick to land here. An unknown id rejects with 400.
  const requestedVoiceId =
    typeof body.voiceId === "string" && body.voiceId.length > 0 && body.voiceId.length < 64
      ? body.voiceId
      : undefined;

  if (!requestedVoiceId) {
    return Response.json({ error: "voiceId is required." }, { status: 400 });
  }

  if (!validateVoiceForEngine(requestedVoiceId, "google")) {
    return Response.json(
      { error: "Unknown voice for this engine." },
      { status: 400 },
    );
  }

  const googleVoiceName = resolveGoogleVoiceName(requestedVoiceId);
  // validateVoiceForEngine already guarantees this — narrow for TS.
  if (!googleVoiceName) {
    return Response.json({ error: "Voice resolution failed." }, { status: 400 });
  }

  const key = cacheKey(text, googleVoiceName);
  const cached = cacheGet(key);
  if (cached) {
    return new Response(new Uint8Array(cached), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
        "X-TTS-Cache": "hit",
      },
    });
  }

  const apiKey = getApiKey();
  // The isConfigured() check above already proved this; narrow for TS.
  if (!apiKey) {
    return Response.json({ error: "TTS-Google not configured." }, { status: 503 });
  }

  // Google REST POST. Body shape per v1 spec:
  //   { input: { text }, voice: { languageCode, name }, audioConfig: { audioEncoding } }
  // Response: { audioContent: <base64 string> }.
  // We race against a 10s timeout for the same reason Polly does — a stalled fetch
  // would burn the whole maxDuration window; failing fast lets the client cascade.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${GOOGLE_TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: languageCodeFor(googleVoiceName), name: googleVoiceName },
        audioConfig: { audioEncoding: "MP3" },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Surface the Google-side error class for log triage but never leak the body
      // to the client (might contain quota details). Fail closed so the client
      // falls back to Polly / browser.
      console.warn(`[tts-google] HTTP ${res.status} ${res.statusText}`);
      return Response.json({ error: "TTS failed." }, { status: 502 });
    }

    const json = (await res.json()) as { audioContent?: unknown };
    if (typeof json.audioContent !== "string" || json.audioContent.length === 0) {
      return Response.json({ error: "No audio." }, { status: 502 });
    }

    const buf = Buffer.from(json.audioContent, "base64");
    cacheSet(key, buf);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
        "X-TTS-Cache": "miss",
      },
    });
  } catch (err) {
    const name = (err as Error)?.name ?? "error";
    console.warn(`[tts-google] failed: ${name}`);
    return Response.json({ error: "TTS failed." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
