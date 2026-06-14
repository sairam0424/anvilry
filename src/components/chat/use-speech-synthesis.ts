"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Text-to-speech over the browser-native window.speechSynthesis — free, client-side,
 * Baseline-widely-available, zero rate-limit pressure. Used by the per-answer "read
 * aloud" button (Phase 2) and later the two-way talk mode (Phase 3). It speaks text
 * the caller already has (the streamed assistant message) — no network, no provider.
 *
 * Incremental speech: speakChunk() can be called repeatedly as an answer streams; the
 * engine's internal FIFO queue means sentence 1 starts speaking while 2..N still
 * arrive, so audio begins ~one sentence after the first token rather than after the
 * whole answer. Per-sentence utterances are also short enough to dodge Chromium's
 * ~15s wall-clock utterance cutoff (a timer on the ACTIVE utterance, worst on remote
 * "Google" voices — so we also prefer localService voices).
 *
 * cancel() is synchronous and clears the whole queue — the single kill wired to
 * barge-in, the chat Stop button, view/route changes, tab-hide, and unmount.
 */

// SSR-safe support flag (no setState-in-effect; matches use-mounted.ts idiom).
const noopSubscribe = () => () => {};
const getSupportedClient = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const getSupportedServer = () => false;

/** Sentence-boundary split: end punctuation followed by whitespace/quote/bracket. */
const SENTENCE_RE = /[^.!?]*[.!?]+(?:["')\]]+)?\s*/g;
const MAX_CHUNK = 200; // hard safety cut so one runaway "sentence" can't exceed the cutoff

/**
 * Split text into speakable chunks at sentence boundaries, with a length cap. A
 * trailing fragment with no terminal punctuation is returned too (so the last,
 * still-streaming partial sentence eventually speaks once finalized).
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const matches = text.match(SENTENCE_RE) ?? [];
  let consumed = 0;
  for (const m of matches) {
    consumed += m.length;
    let s = m.trim();
    while (s.length > MAX_CHUNK) {
      // Break an over-long chunk at the last space within the cap (else hard-cut).
      const slice = s.slice(0, MAX_CHUNK);
      const cut = slice.lastIndexOf(" ");
      const at = cut > 40 ? cut : MAX_CHUNK;
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) out.push(s);
  }
  const tail = text.slice(consumed).trim();
  if (tail) out.push(tail);
  return out;
}

/** Pick the best English voice: prefer an on-device (localService) "en" voice. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  if (en.length === 0) return voices[0] ?? null;
  return en.find((v) => v.localService) ?? en[0];
}

const isAndroid = () =>
  typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

export type UseSpeechSynthesis = {
  supported: boolean;
  isSpeaking: boolean;
  /** Speak a full block of text (split into per-sentence utterances). Cancels any prior. */
  speak: (text: string) => void;
  /** Append a streaming chunk to the spoken queue without cancelling what's playing. */
  speakChunk: (fullTextSoFar: string) => void;
  /** Stop all speech immediately (synchronous) and reset streaming state. */
  cancel: () => void;
};

export function useSpeechSynthesis(): UseSpeechSynthesis {
  const supported = useSyncExternalStore(noopSubscribe, getSupportedClient, getSupportedServer);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  // For speakChunk streaming: how many chunks of the current answer we've already
  // enqueued, so a re-call only speaks the NEW sentences.
  const spokenCountRef = useRef(0);
  // Desktop-only keep-alive against Chromium's ~15s cutoff (pause/resume). Skipped on
  // Android, where pause() behaves like cancel() and would truncate speech.
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load voices (async on Chromium — getVoices() is [] until voiceschanged fires).
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => {
      voicesRef.current = synth.getVoices();
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => synth.removeEventListener?.("voiceschanged", load);
  }, [supported]);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  const startKeepAlive = useCallback(() => {
    if (isAndroid() || keepAliveRef.current) return;
    keepAliveRef.current = setInterval(() => {
      const synth = window.speechSynthesis;
      if (synth.speaking) {
        // The canonical desktop workaround: a brief pause+resume resets the ~15s timer.
        synth.pause();
        synth.resume();
      }
    }, 12_000);
  }, []);

  const cancel = useCallback(() => {
    if (!supported) return;
    stopKeepAlive();
    window.speechSynthesis.cancel();
    spokenCountRef.current = 0;
    setIsSpeaking(false);
  }, [supported, stopKeepAlive]);

  /** Enqueue chunks[from..] as utterances; wire speaking state on first/last. */
  const enqueue = useCallback(
    (chunks: string[], from: number) => {
      const synth = window.speechSynthesis;
      const voice = pickVoice(voicesRef.current);
      for (let i = from; i < chunks.length; i++) {
        const u = new SpeechSynthesisUtterance(chunks[i]);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? "en-US";
        u.rate = 1;
        u.pitch = 1;
        u.onstart = () => {
          setIsSpeaking(true);
          startKeepAlive();
        };
        u.onend = () => {
          // Speaking ends only when the engine has nothing left queued.
          if (!synth.speaking && !synth.pending) {
            setIsSpeaking(false);
            stopKeepAlive();
          }
        };
        u.onerror = () => {
          if (!synth.speaking && !synth.pending) {
            setIsSpeaking(false);
            stopKeepAlive();
          }
        };
        synth.speak(u);
      }
    },
    [startKeepAlive, stopKeepAlive],
  );

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel(); // replace anything in flight
      const chunks = splitSentences(text);
      spokenCountRef.current = chunks.length;
      enqueue(chunks, 0);
    },
    [supported, enqueue],
  );

  const speakChunk = useCallback(
    (fullTextSoFar: string) => {
      if (!supported) return;
      // Only complete sentences are safe to speak mid-stream; hold back a trailing
      // partial (no terminal punctuation) until more arrives or speak() finalizes it.
      const all = splitSentences(fullTextSoFar);
      const endsClean = /[.!?]["')\]]?\s*$/.test(fullTextSoFar);
      const ready = endsClean ? all : all.slice(0, -1);
      if (ready.length > spokenCountRef.current) {
        enqueue(ready, spokenCountRef.current);
        spokenCountRef.current = ready.length;
      }
    },
    [supported, enqueue],
  );

  // Stop speech if the tab is hidden (visibilitychange) and always on unmount.
  useEffect(() => {
    if (!supported) return;
    const onHide = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      cancel();
    };
  }, [supported, cancel]);

  return { supported, isSpeaking, speak, speakChunk, cancel };
}
