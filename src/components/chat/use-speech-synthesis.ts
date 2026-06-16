"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  findBrowserVoice,
  getDefaultVoiceId,
  getVoiceById,
  type VoiceEntry,
} from "@/lib/voice-catalog";
import {
  DEFAULT_VOICE_CHARACTER,
  type TtsEngine,
  type VoiceCharacter,
} from "@/lib/voice-settings-context";

/**
 * Text-to-speech across three engines, free-first by default:
 *   - browser  → window.speechSynthesis (zero network, zero cost, Baseline-wide).
 *   - polly    → AWS Polly Neural / Generative via /api/tts (server-proxied).
 *   - google   → Google Cloud TTS Chirp 3 HD via /api/tts-google (server-proxied,
 *                permanent-free hedge against Polly's 12-mo cliff).
 *
 * Used by the per-answer "read aloud" button + the two-way talk mode. It speaks
 * text the caller already has (the streamed assistant message) — no LLM involved.
 *
 * Incremental speech: speakChunk() can be called repeatedly as an answer streams;
 * the engine's internal FIFO queue means sentence 1 starts speaking while 2..N
 * still arrive, so audio begins ~one sentence after the first token rather than
 * after the whole answer. Per-sentence utterances are also short enough to dodge
 * Chromium's ~15s wall-clock utterance cutoff (browser engine only — the cutoff
 * is a SpeechSynthesis quirk; remote engines play <audio> blobs and don't apply).
 *
 * cancel() is synchronous and clears the whole queue across engines — the single
 * kill wired to barge-in, the chat Stop button, view/route changes, tab-hide,
 * and unmount. A monotonic token invalidates any in-flight remote fetch so a late
 * response can't resurrect stopped speech.
 *
 * Failure cascade: any remote-engine error falls back through the chain. The two
 * remote engines (polly, google) share the same blob-audio playback shape, so the
 * remote-playback code is engine-parameterized — only the fetch URL + body shape
 * differ. A google fetch failure speaks the rest of the answer via the browser
 * engine; a polly fetch failure does the same. There is no google→polly hop in
 * v1.7 (would require resolving cross-engine voice equivalents, deferred).
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

/** Pick the best browser voice for this catalog entry — voiceURI prefix match
 *  when the catalog has one, else the first English localService fallback. The
 *  prefix path handles macOS localization + Linux speech-dispatcher modifiers
 *  (pitfall #14: never trust voice.name). */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  catalogEntry: VoiceEntry | undefined,
): SpeechSynthesisVoice | null {
  if (catalogEntry && catalogEntry.engine === "browser") {
    const matched = findBrowserVoice(catalogEntry.id, voices);
    if (matched) return matched;
    // Curated browser voice not present (Apple Premium not downloaded, etc.) —
    // fall through to the localService heuristic rather than 500.
  }
  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  if (en.length === 0) return voices[0] ?? null;
  return en.find((v) => v.localService) ?? en[0];
}

const isAndroid = () =>
  typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

/** Map the catalog's VoiceCharacter to safe-range browser SpeechSynthesisUtterance
 *  values. Tight clamps (rate 0.85–1.15, pitch 0.95–1.10) avoid the cartoonish
 *  extremes the API allows but no professional voice should sound like. */
function rateForSpeed(speed: VoiceCharacter["speed"]): number {
  switch (speed) {
    case "slow":
      return 0.85;
    case "fast":
      return 1.15;
    default:
      return 1.0;
  }
}
function pitchForTone(tone: VoiceCharacter["tone"]): number {
  switch (tone) {
    case "warm":
      return 0.95;
    case "crisp":
      return 1.1;
    default:
      return 1.0;
  }
}

/** Re-export for convenience so the hook + the store agree on the union — there
 *  is one source of truth for engine ids (the store). */
export type { TtsEngine };

/**
 * The hook's options object. Backward-compatible: the legacy `string` form
 * (a bare TtsEngine) still works for old callers, the new object form supports
 * voice selection + character knobs.
 */
export type UseSpeechSynthesisOptions = {
  engine?: TtsEngine;
  /** Catalog id (e.g. "polly-generative-stephen"). undefined → default per-engine. */
  voiceId?: string;
  /** Cross-engine character knobs. Defaults to {natural, neutral, normal}. */
  character?: VoiceCharacter;
};

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

/** Normalize the legacy string form to the options shape so the body has one path. */
function normalizeOptions(arg?: TtsEngine | UseSpeechSynthesisOptions): {
  engine: TtsEngine;
  voiceId: string | undefined;
  character: VoiceCharacter;
} {
  if (arg === undefined) {
    return { engine: "browser", voiceId: undefined, character: DEFAULT_VOICE_CHARACTER };
  }
  if (typeof arg === "string") {
    return { engine: arg, voiceId: undefined, character: DEFAULT_VOICE_CHARACTER };
  }
  return {
    engine: arg.engine ?? "browser",
    voiceId: arg.voiceId,
    character: arg.character ?? DEFAULT_VOICE_CHARACTER,
  };
}

export function useSpeechSynthesis(
  arg?: TtsEngine | UseSpeechSynthesisOptions,
): UseSpeechSynthesis {
  const { engine, voiceId, character } = normalizeOptions(arg);

  const browserSupported = useSyncExternalStore(
    noopSubscribe,
    getSupportedClient,
    getSupportedServer,
  );
  // Remote engines play through an <audio> element, so "supported" only needs the
  // browser to do audio playback (effectively always) — but we still report browser
  // support so callers can gate a "read aloud" button even before an engine choice.
  // With a remote engine selected, a fetch failure transparently falls back below.
  const supported = browserSupported;
  const [isSpeaking, setIsSpeaking] = useState(false);

  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  // For speakChunk streaming: how many chunks of the current answer we've already
  // enqueued, so a re-call only speaks the NEW sentences.
  const spokenCountRef = useRef(0);

  // --- Remote playback (engine="polly" | "google") ----------------------------
  // <audio> plays one source at a time, so we run our own sentence queue: fetch
  // sentence N, play it, advance on `ended`. A monotonically-increasing token
  // invalidates an in-flight fetch when cancel() fires (so a late response can't
  // resurrect stopped speech). Polly + Google share this state — only one can be
  // active at a time (they're alternative engines, never concurrent).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remoteQueueRef = useRef<string[]>([]);
  const remoteIdxRef = useRef(0);
  const remoteTokenRef = useRef(0);
  // Ref to the browser enqueue fn so the remote fallback can call it without a
  // forward dependency (enqueue is defined below). Assigned in an effect.
  const enqueueBrowserRef = useRef<(chunks: string[], from: number) => void>(() => {});
  // Desktop-only keep-alive against Chromium's ~15s SpeechSynthesis cutoff
  // (pause/resume). Skipped on Android, where pause() behaves like cancel() and
  // would truncate speech. Browser engine only — remote engines aren't subject
  // to the cutoff (they're <audio> blobs).
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

  /** Stop the remote-engine <audio> playback + invalidate any in-flight fetch. */
  const cancelRemote = useCallback(() => {
    remoteTokenRef.current += 1; // invalidate pending fetches
    remoteQueueRef.current = [];
    remoteIdxRef.current = 0;
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
    }
  }, []);

  const cancel = useCallback(() => {
    cancelBrowser();
    cancelRemote();
    spokenCountRef.current = 0;
    setIsSpeaking(false);
  }, [cancelBrowser, cancelRemote]);

  /** Build the request URL + body for the active remote engine. The catalog id
   *  flows through verbatim — the route validates it server-side. */
  const buildRemoteRequest = useCallback(
    (sentence: string): { url: string; body: string } | null => {
      if (engine === "polly") {
        return {
          url: "/api/tts",
          body: JSON.stringify({ text: sentence, voiceId }),
        };
      }
      if (engine === "google") {
        // Google route requires an explicit voiceId (no historical default).
        if (!voiceId) return null;
        return {
          url: "/api/tts-google",
          body: JSON.stringify({ text: sentence, voiceId }),
        };
      }
      return null;
    },
    [engine, voiceId],
  );

  /** Play the remote queue from remoteIdxRef; fetch each sentence then play it.
   *  On any failure, fall back to speaking the WHOLE remaining text via the
   *  browser engine. */
  const playRemoteFrom = useCallback(
    async (token: number) => {
      const fallback = () => {
        const rest = remoteQueueRef.current.slice(remoteIdxRef.current).join(" ");
        cancelRemote();
        if (rest && browserSupported) {
          spokenCountRef.current = 0;
          enqueueBrowserRef.current(splitSentences(rest), 0);
        }
      };
      while (remoteIdxRef.current < remoteQueueRef.current.length) {
        if (token !== remoteTokenRef.current) return; // cancelled
        const sentence = remoteQueueRef.current[remoteIdxRef.current];
        const req = buildRemoteRequest(sentence);
        if (!req) return fallback();
        let url: string;
        try {
          const res = await fetch(req.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: req.body,
          });
          if (!res.ok) return fallback();
          const blob = await res.blob();
          if (token !== remoteTokenRef.current) return;
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
        if (token !== remoteTokenRef.current) return;
        remoteIdxRef.current += 1;
      }
      if (token === remoteTokenRef.current) setIsSpeaking(false);
    },
    [browserSupported, buildRemoteRequest, cancelRemote],
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
      // Resolve voice from the catalog when a voiceId is set; falls back to the
      // localService English heuristic when undefined or not on this device.
      const catalogEntry = voiceId ? getVoiceById(voiceId) : undefined;
      const voice = pickVoice(cached, catalogEntry);
      const rate = rateForSpeed(character.speed);
      const pitch = pitchForTone(character.tone);
      for (let i = from; i < chunks.length; i++) {
        const u = new SpeechSynthesisUtterance(chunks[i]);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? "en-US";
        u.rate = rate;
        u.pitch = pitch;
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
    [browserSupported, character, voiceId, startKeepAlive, stopKeepAlive],
  );

  // Keep the fallback ref pointing at the live enqueue fn (set in an effect, never
  // during render — react-hooks/refs).
  useEffect(() => {
    enqueueBrowserRef.current = enqueue;
  }, [enqueue]);

  /** True iff the active engine is one of the remote (server-proxied) engines. */
  const isRemoteEngine = engine === "polly" || engine === "google";

  /** Resolve the effective voiceId for this engine, falling back to the catalog
   *  default when undefined. The Polly route accepts a missing voiceId (defaults
   *  to Joanna server-side); the Google route requires one explicitly. */
  const effectiveVoiceId =
    voiceId ?? (engine === "polly" ? getDefaultVoiceId() : undefined);

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      cancel(); // replace anything in flight (both engines)
      const chunks = splitSentences(text);
      spokenCountRef.current = chunks.length;
      if (isRemoteEngine) {
        // Google requires an explicit voiceId; if missing, fall through to browser.
        if (engine === "google" && !effectiveVoiceId) {
          if (browserSupported) enqueue(chunks, 0);
          return;
        }
        remoteQueueRef.current = chunks;
        remoteIdxRef.current = 0;
        const token = (remoteTokenRef.current += 1);
        void playRemoteFrom(token);
      } else if (browserSupported) {
        enqueue(chunks, 0);
      }
    },
    [
      engine,
      effectiveVoiceId,
      isRemoteEngine,
      browserSupported,
      cancel,
      enqueue,
      playRemoteFrom,
    ],
  );

  /**
   * Zero ONLY the browser dedup counter so the next speakChunk() of a NEW answer starts
   * fresh. Deliberately does NOT touch the remote queue/index/token: those self-manage
   * (speakChunk's `wasEmpty` restart + remoteTokenRef invalidation), and clearing them
   * mid-tail could truncate a still-playing remote sentence or trip a false isSpeaking
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

      if (isRemoteEngine) {
        if (engine === "google" && !effectiveVoiceId) {
          // No voice picked + Google selected → fall through to browser path so
          // streaming TTS still works. Mirrors speak()'s no-voice fallthrough.
          if (browserSupported) {
            enqueue(ready, spokenCountRef.current);
            spokenCountRef.current = ready.length;
          }
          return;
        }
        const wasEmpty = remoteIdxRef.current >= remoteQueueRef.current.length;
        remoteQueueRef.current = ready;
        spokenCountRef.current = ready.length;
        // If the queue had drained, restart the player at the current index.
        if (wasEmpty) void playRemoteFrom(remoteTokenRef.current);
      } else if (browserSupported) {
        enqueue(ready, spokenCountRef.current);
        spokenCountRef.current = ready.length;
      }
    },
    [
      engine,
      effectiveVoiceId,
      isRemoteEngine,
      browserSupported,
      enqueue,
      playRemoteFrom,
    ],
  );

  // Stop speech if the tab is hidden (visibilitychange) and always on unmount —
  // covers all engines (cancel() stops the browser synth AND the remote <audio>).
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
