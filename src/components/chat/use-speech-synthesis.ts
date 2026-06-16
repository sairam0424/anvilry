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

/** Which engine speaks: free browser speechSynthesis (default), AWS Polly via /api/tts,
 *  or Google Cloud TTS via /api/tts-google. Imported from the settings store so the
 *  hook + the store agree on the union — there is one source of truth for engine ids. */
import type { TtsEngine } from "@/lib/voice-settings-context";
export type { TtsEngine };

export type UseSpeechSynthesis = {
  supported: boolean;
  isSpeaking: boolean;
  /** Speak a full block of text (split into per-sentence utterances). Cancels any prior. */
  speak: (text: string) => void;
  /** Append a streaming chunk to the spoken queue without cancelling what's playing. */
  speakChunk: (fullTextSoFar: string) => void;
  /** Stop all speech immediately (synchronous) and reset streaming state. */
  cancel: () => void;
  /**
   * Restart the per-answer dedup counter at a NEW assistant turn — WITHOUT cancelling
   * what is still playing (a prior tail finishes cleanly) and WITHOUT re-speaking. Must
   * be called once on each new turn's rising edge: speakChunk() dedups against
   * spokenCountRef, which only ever climbs, so a fresh answer (whose sentence count is
   * ≤ the previous turn's) would otherwise be silently dropped by the guard. This is
   * the surgical alternative to speak(), which cancels + re-speaks the whole answer.
   */
  resetTurn: () => void;
};

export function useSpeechSynthesis(engine: TtsEngine = "browser"): UseSpeechSynthesis {
  const browserSupported = useSyncExternalStore(
    noopSubscribe,
    getSupportedClient,
    getSupportedServer,
  );
  // Polly plays through an <audio> element, so "supported" only needs the browser to
  // do audio playback (effectively always) — but we still report browser support so
  // callers can gate a "read aloud" button even before an engine choice. With Polly
  // selected, a fetch failure transparently falls back to the browser path below.
  const supported = browserSupported;
  const [isSpeaking, setIsSpeaking] = useState(false);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  // For speakChunk streaming: how many chunks of the current answer we've already
  // enqueued, so a re-call only speaks the NEW sentences.
  const spokenCountRef = useRef(0);

  // --- Polly playback (engine="polly") ------------------------------------------
  // <audio> plays one source at a time, so we run our own sentence queue: fetch
  // sentence N, play it, advance on `ended`. A monotonically-increasing token
  // invalidates an in-flight fetch when cancel() fires (so a late response can't
  // resurrect stopped speech). Any fetch/play failure falls back to the browser path.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollyQueueRef = useRef<string[]>([]);
  const pollyIdxRef = useRef(0);
  const pollyTokenRef = useRef(0);
  // Ref to the browser enqueue fn so the Polly fallback can call it without a forward
  // dependency (enqueue is defined below). Assigned in an effect.
  const enqueueBrowserRef = useRef<(chunks: string[], from: number) => void>(() => {});
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

  /** Stop the browser engine. */
  const cancelBrowser = useCallback(() => {
    stopKeepAlive();
    if (browserSupported) window.speechSynthesis.cancel();
  }, [browserSupported, stopKeepAlive]);

  /** Stop the Polly <audio> playback + invalidate any in-flight fetch. */
  const cancelPolly = useCallback(() => {
    pollyTokenRef.current += 1; // invalidate pending fetches
    pollyQueueRef.current = [];
    pollyIdxRef.current = 0;
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
    }
  }, []);

  const cancel = useCallback(() => {
    cancelBrowser();
    cancelPolly();
    spokenCountRef.current = 0;
    setIsSpeaking(false);
  }, [cancelBrowser, cancelPolly]);

  /** Play the Polly queue from pollyIdxRef; fetch each sentence then play it. On any
   *  failure, fall back to speaking the WHOLE remaining text via the browser engine. */
  const playPollyFrom = useCallback(
    async (token: number) => {
      const fallback = () => {
        const rest = pollyQueueRef.current.slice(pollyIdxRef.current).join(" ");
        cancelPolly();
        if (rest && browserSupported) {
          spokenCountRef.current = 0;
          enqueueBrowserRef.current(splitSentences(rest), 0);
        }
      };
      while (pollyIdxRef.current < pollyQueueRef.current.length) {
        if (token !== pollyTokenRef.current) return; // cancelled
        const sentence = pollyQueueRef.current[pollyIdxRef.current];
        let url: string;
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: sentence }),
          });
          if (!res.ok) return fallback();
          const blob = await res.blob();
          if (token !== pollyTokenRef.current) return;
          url = URL.createObjectURL(blob);
        } catch {
          return fallback();
        }
        // An HTMLAudioElement is an imperative media object — assigning .src and
        // wiring .onended/.onerror is the only way to drive it (the same exception
        // hero-graph/scene.tsx makes for its WebGL objects).
        const a = audioRef.current ?? new Audio();
        audioRef.current = a;
        setIsSpeaking(true);
        try {
          await new Promise<void>((resolve, reject) => {
            a.src = url;
            a.onended = () => resolve();
            a.onerror = () => reject(new Error("audio"));
            void a.play().catch(reject);
          });
        } catch {
          URL.revokeObjectURL(url);
          return fallback();
        }
        URL.revokeObjectURL(url);
        if (token !== pollyTokenRef.current) return;
        pollyIdxRef.current += 1;
      }
      if (token === pollyTokenRef.current) setIsSpeaking(false);
    },
    [browserSupported, cancelPolly],
  );

  /** Enqueue chunks[from..] as utterances; wire speaking state on first/last. */
  const enqueue = useCallback(
    (chunks: string[], from: number) => {
      const synth = window.speechSynthesis;
      // Harden the turn-1 race: getVoices() is async on Chromium ([] until
      // 'voiceschanged'). If the first utterance enqueues before the cache fills, re-read
      // synchronously so we pick a real voice instead of falling back to the engine default.
      let cached = voicesRef.current;
      if (cached.length === 0 && browserSupported) {
        cached = synth.getVoices();
        voicesRef.current = cached;
      }
      const voice = pickVoice(cached);
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
    [browserSupported, startKeepAlive, stopKeepAlive],
  );

  // Keep the fallback ref pointing at the live enqueue fn (set in an effect, never
  // during render — react-hooks/refs).
  useEffect(() => {
    enqueueBrowserRef.current = enqueue;
  }, [enqueue]);

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      cancel(); // replace anything in flight (both engines)
      const chunks = splitSentences(text);
      spokenCountRef.current = chunks.length;
      if (engine === "polly") {
        pollyQueueRef.current = chunks;
        pollyIdxRef.current = 0;
        const token = (pollyTokenRef.current += 1);
        void playPollyFrom(token);
      } else if (browserSupported) {
        enqueue(chunks, 0);
      }
    },
    [engine, browserSupported, cancel, enqueue, playPollyFrom],
  );

  /**
   * Zero ONLY the browser dedup counter so the next speakChunk() of a NEW answer starts
   * fresh. Deliberately does NOT touch the Polly queue/index/token: those self-manage
   * (speakChunk's `wasEmpty` restart + pollyTokenRef invalidation), and clearing them
   * mid-tail could truncate a still-playing Polly sentence or trip a false isSpeaking
   * flip that re-opens the mic while audio is audible (self-hearing).
   */
  const resetTurn = useCallback(() => {
    spokenCountRef.current = 0;
  }, []);

  const speakChunk = useCallback(
    (fullTextSoFar: string) => {
      // Only complete sentences are safe to speak mid-stream; hold back a trailing
      // partial (no terminal punctuation) until more arrives or speak() finalizes it.
      const all = splitSentences(fullTextSoFar);
      const endsClean = /[.!?]["')\]]?\s*$/.test(fullTextSoFar);
      const ready = endsClean ? all : all.slice(0, -1);
      if (ready.length <= spokenCountRef.current) return;

      if (engine === "polly") {
        const wasEmpty = pollyIdxRef.current >= pollyQueueRef.current.length;
        pollyQueueRef.current = ready;
        spokenCountRef.current = ready.length;
        // If the queue had drained, restart the player at the current index.
        if (wasEmpty) void playPollyFrom(pollyTokenRef.current);
      } else if (browserSupported) {
        enqueue(ready, spokenCountRef.current);
        spokenCountRef.current = ready.length;
      }
    },
    [engine, browserSupported, enqueue, playPollyFrom],
  );

  // Stop speech if the tab is hidden (visibilitychange) and always on unmount —
  // covers both engines (cancel() stops the browser synth AND Polly <audio>).
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      cancel();
    };
  }, [cancel]);

  return { supported, isSpeaking, speak, speakChunk, cancel, resetTurn };
}
