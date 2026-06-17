import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  type AudioStream,
} from "@aws-sdk/client-transcribe-streaming";
import { bedrockCreds } from "@/lib/llm";
import { checkRateLimit } from "@/lib/rate-limit";
import { withTrace } from "@/lib/telemetry/with-trace";
import { emit } from "@/lib/telemetry/emit";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * Optional, flag-gated STT upgrade: AWS Transcribe streaming via the SAME AWS
 * account/creds used for Bedrock (no new vendor). Stronger PRIVACY story than browser
 * Web Speech — audio is processed on the owner's own AWS, nothing is retained here, vs
 * Chrome/Edge silently streaming mic audio to Google.
 *
 * Design fits Vercel's request/response model (no long-lived socket): the client
 * records raw 16-bit PCM @ 16kHz mono, POSTs the whole buffer on mic-release, and we
 * feed it to Transcribe as a one-shot async-iterable stream, returning the final
 * transcript text. Tradeoff vs browser STT: no live interim words (text arrives after
 * you finish speaking). The client falls back to browser STT on any non-2xx.
 *
 * Fails CLOSED: unconfigured/over-limit/error -> non-2xx -> client uses browser STT.
 */

const SAMPLE_RATE = 16_000;
const MAX_BYTES = 5 * 1024 * 1024; // ~2.6 min of 16k mono PCM — a generous question cap
const CHUNK = 8 * 1024;

function isConfigured(): boolean {
  const { accessKeyId, secretAccessKey } = bedrockCreds();
  return Boolean(accessKeyId && secretAccessKey);
}

let client: TranscribeStreamingClient | null = null;
function getClient(): TranscribeStreamingClient {
  if (client) return client;
  const { accessKeyId, secretAccessKey, sessionToken, region } = bedrockCreds();
  client = new TranscribeStreamingClient({
    region: region || "us-east-1",
    credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) },
  });
  return client;
}

/** Yield the PCM buffer to Transcribe in fixed-size AudioEvent chunks. */
async function* pcmChunks(pcm: Buffer): AsyncGenerator<AudioStream> {
  for (let i = 0; i < pcm.length; i += CHUNK) {
    yield { AudioEvent: { AudioChunk: pcm.subarray(i, i + CHUNK) } };
  }
}

export async function POST(req: Request) {
  return withTrace(req, "transcribe", async (ctx) => {
    if (!isConfigured()) {
      return Response.json({ error: "Transcribe not configured." }, { status: 503 });
    }

    const rl = await checkRateLimit(req);
    if (!rl.ok) {
      return Response.json(
        { error: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    // Reject by declared length BEFORE buffering the whole audio into memory — a cheap
    // guard against a client streaming more than the cap. (The post-read byteLength check
    // below still backstops a missing/lying Content-Length.)
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) {
      return Response.json({ error: "Audio too long." }, { status: 413 });
    }

    const ab = await req.arrayBuffer();
    if (!ab.byteLength) return Response.json({ error: "Expected audio." }, { status: 400 });
    if (ab.byteLength > MAX_BYTES) {
      return Response.json({ error: "Audio too long." }, { status: 413 });
    }
    const pcm = Buffer.from(ab);

    try {
      const out = await getClient().send(
        new StartStreamTranscriptionCommand({
          LanguageCode: "en-US",
          MediaSampleRateHertz: SAMPLE_RATE,
          MediaEncoding: "pcm",
          AudioStream: pcmChunks(pcm),
        }),
      );

      let transcript = "";
      for await (const event of out.TranscriptResultStream ?? []) {
        const results = event.TranscriptEvent?.Transcript?.Results ?? [];
        for (const r of results) {
          // Take only finalized (non-partial) segments to avoid duplicated interim text.
          if (!r.IsPartial && r.Alternatives?.[0]?.Transcript) {
            transcript += (transcript ? " " : "") + r.Alternatives[0].Transcript;
          }
        }
      }
      // Surface aggregate stats only — never the transcript text itself (PII).
      // audio_seconds = byteLength / (sample_rate * 2 bytes/sample) for 16-bit mono.
      ctx.attrs({
        audio_bytes: pcm.length,
        audio_seconds: Math.round((pcm.length / (SAMPLE_RATE * 2)) * 10) / 10,
        transcript_chars: transcript.length,
        aws_request_id: out.$metadata?.requestId,
      });
      return Response.json({ transcript: transcript.trim() });
    } catch (err) {
      const e = err as { name?: string; message?: string; $metadata?: { requestId?: string } };
      emit({
        ts: Date.now(),
        traceId: ctx.traceId,
        spanId: randomUUID(),
        parentSpanId: ctx.spanId,
        kind: "server.error",
        route: "/api/transcribe",
        level: "error",
        message: e?.name ?? "error",
        attrs: {
          error_name: e?.name ?? "Error",
          error_message: e?.message,
          aws_request_id: e?.$metadata?.requestId,
          audio_bytes: pcm.length,
        },
      });
      return Response.json({ error: "Transcribe failed." }, { status: 502 });
    }
  });
}
