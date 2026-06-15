"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { SpeechErrorKind, UseSpeechRecognition } from "@/components/chat/use-speech-recognition";

/**
 * AWS Transcribe variant of the STT hook — SAME shape as useSpeechRecognition, so it's
 * a drop-in alternative selected by the sttEngine flag. Stronger privacy story
 * (audio processed on the owner's own AWS, not Google's cloud), at the cost of NO live
 * interim words: it records 16-bit PCM @ 16kHz mono in the browser and POSTs the whole
 * buffer to /api/transcribe on stop(), then fires onFinal with the returned text.
 *
 * `supported` requires getUserMedia + AudioContext (effectively all modern browsers,
 * INCLUDING Firefox — where browser SpeechRecognition is off-by-default — so Transcribe
 * is the way to offer Firefox visitors voice input). Any failure surfaces an error the
 * caller can use to fall back to browser STT.
 */

function getSupported(): boolean {
  if (typeof window === "undefined") return false;
  const hasAudioContext =
    "AudioContext" in window || "webkitAudioContext" in window;
  return Boolean(navigator.mediaDevices?.getUserMedia) && hasAudioContext;
}

// SSR-safe support flag via useSyncExternalStore (server snapshot = false, client
// upgrades after hydration) — matches use-speech-recognition.ts / use-mounted.ts. Using
// useState(getSupported) here caused an SSR/hydration mismatch (server omits the mic
// button, client renders it).
const noopSubscribe = () => () => {};
const getSupportedServer = () => false;

/** Downsample Float32 mono @ ctxRate to 16-bit PCM @ 16kHz (Transcribe's required format). */
function floatToPcm16k(input: Float32Array, ctxRate: number): Int16Array {
  const ratio = ctxRate / 16_000;
  const outLen = Math.floor(input.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const s = input[Math.floor(i * ratio)] ?? 0;
    const clamped = Math.max(-1, Math.min(1, s));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

export function useTranscribeRecognition(): UseSpeechRecognition {
  const supported = useSyncExternalStore(noopSubscribe, getSupported, getSupportedServer);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<SpeechErrorKind>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Int16Array[]>([]);
  const onFinalRef = useRef<((t: string) => void) | null>(null);

  const teardown = useCallback(() => {
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (!isListening) {
      teardown();
      return;
    }
    setIsListening(false);

    // Flatten captured PCM and POST it. Empty capture -> nothing to send.
    const chunks = chunksRef.current;
    chunksRef.current = [];
    teardown();

    const total = chunks.reduce((n, c) => n + c.length, 0);
    if (total === 0) return;
    const pcm = new Int16Array(total);
    let off = 0;
    for (const c of chunks) {
      pcm.set(c, off);
      off += c.length;
    }

    fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: pcm.buffer,
    })
      .then(async (res) => {
        if (!res.ok) {
          // 503 = Transcribe not configured (a deploy state, not a failure): set the
          // error so useStt transparently falls back to browser STT, but the caller
          // treats it as a quiet engine-unavailable signal, not a user-facing fault.
          // 5xx during transcription (502/504) is a genuine service error.
          setError("unknown");
          return;
        }
        const data = (await res.json()) as { transcript?: string };
        const text = (data.transcript ?? "").trim();
        if (text) onFinalRef.current?.(text);
      })
      .catch(() => setError("network"));
  }, [isListening, teardown]);

  const start = useCallback(
    (onFinal: (transcript: string) => void) => {
      if (!supported || isListening) return;
      onFinalRef.current = onFinal;
      setError(null);
      chunksRef.current = [];

      navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        .then((stream) => {
          streamRef.current = stream;
          const AC =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new AC();
          ctxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          // ScriptProcessor is deprecated but universally supported and adequate for a
          // short capture; an AudioWorklet would need a separate module file for a
          // marginal gain. 4096-frame buffer, mono in/out.
          const node = ctx.createScriptProcessor(4096, 1, 1);
          nodeRef.current = node;
          node.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            chunksRef.current.push(floatToPcm16k(input, ctx.sampleRate));
          };
          source.connect(node);
          node.connect(ctx.destination);
          setIsListening(true);
        })
        .catch((err: unknown) => {
          const name = (err as { name?: string })?.name;
          setError(name === "NotFoundError" ? "no-device" : "denied");
          setIsListening(false);
        });
    },
    [supported, isListening],
  );

  // Transcribe has no live interim text (it returns the final after stop()).
  return { supported, isListening, interim: "", error, start, stop };
}
