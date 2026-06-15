"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Push-to-talk speech-to-text over the browser-native Web Speech API, as PROGRESSIVE
 * ENHANCEMENT: when the API is absent the hook reports `supported: false` and the UI
 * silently keeps the text composer. The transcript is handed back to the caller,
 * which calls useChat().send() — this hook owns recognition only, never the network.
 *
 * Privacy/trust (the load-bearing constraints for a recruiter-facing site):
 *  - recognition starts ONLY from an explicit user gesture (start()), never on mount;
 *  - on stop we call track.stop() on a parallel getUserMedia stream so the OS/browser
 *    "recording" indicator clears immediately (the Web Speech engine opens its own
 *    stream we can't directly close, so we hold a sibling stream purely as the visible
 *    mic-live signal + clean release);
 *  - on Chrome/Edge the audio is sent to the browser vendor's cloud (processLocally
 *    defaults to false) — the CALLER is responsible for disclosing this before first
 *    listen; this hook just exposes `supported` so the disclosure can gate it.
 *
 * Browser reality (verified mid-2026): feature-detect BOTH window.SpeechRecognition
 * (Chrome/Edge 139+ unprefixed) and window.webkitSpeechRecognition (Chrome/Edge <139,
 * Safari 14.1+/iOS 14.5+). Firefox keeps it disabled-by-default behind a pref, so it
 * reads as unsupported here — correct, we degrade to text.
 */

// Minimal Web Speech typings — NOT in TS's lib.dom.d.ts. We declare only the surface
// this hook uses (single-shot dictation), not the full spec.
interface SpeechRecognitionAlternative {
  readonly transcript: string;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** A user-facing error category — never a raw engine string. */
export type SpeechErrorKind = "denied" | "no-device" | "no-speech" | "network" | "unknown" | null;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// SSR-safe capability flag without setState-in-effect (the codebase idiom — see
// use-mounted.ts). Server snapshot = false (text-only first paint), client snapshot
// resolves the real support, and the value never changes after mount so the empty
// subscribe is correct.
const noopSubscribe = () => () => {};
const getSupportedClient = () => getCtor() !== null;
const getSupportedServer = () => false;

/** Map the spec's raw `error` strings to a small, user-friendly taxonomy. */
function classifyError(raw: string): SpeechErrorKind {
  switch (raw) {
    case "not-allowed":
    case "service-not-allowed":
      return "denied";
    case "audio-capture":
      return "no-device";
    case "no-speech":
      return "no-speech";
    case "network":
      return "network";
    case "aborted":
      return null; // a deliberate stop() — not an error to surface
    default:
      return "unknown";
  }
}

export type UseSpeechRecognition = {
  /** Whether this browser exposes the Web Speech API at all. */
  supported: boolean;
  /** True between start() and the engine's end/abort. */
  isListening: boolean;
  /** Live (non-final) transcript while speaking — for the composer + a11y. */
  interim: string;
  /** Last user-facing error (null when none / on a clean abort). */
  error: SpeechErrorKind;
  /**
   * Begin listening (an explicit user gesture). `onFinal` fires once per final result;
   * optional `onInterim` fires with live partial text so the composer can show it as
   * the user speaks (also exposed as the `interim` field for direct binders).
   */
  start: (onFinal: (transcript: string) => void, onInterim?: (text: string) => void) => void;
  /** Stop listening and release the mic indicator. */
  stop: () => void;
};

export function useSpeechRecognition(): UseSpeechRecognition {
  // `supported` is resolved on the client only (SSR returns false → text-only first
  // paint, then upgrades after hydration) via useSyncExternalStore — no
  // setState-in-effect, matching the codebase's use-mounted.ts idiom.
  const supported = useSyncExternalStore(noopSubscribe, getSupportedClient, getSupportedServer);
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<SpeechErrorKind>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const onFinalRef = useRef<((t: string) => void) | null>(null);
  const onInterimRef = useRef<((t: string) => void) | null>(null);

  /** Drop the sibling mic stream (clears the OS recording indicator). */
  const releaseMic = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    releaseMic();
    setIsListening(false);
    setInterim("");
  }, [releaseMic]);

  const start = useCallback(
    (onFinal: (transcript: string) => void, onInterim?: (text: string) => void) => {
      const Ctor = getCtor();
      if (!Ctor || isListening) return;
      onFinalRef.current = onFinal;
      onInterimRef.current = onInterim ?? null;
      setError(null);
      setInterim("");

      const rec = new Ctor();
      rec.lang = "en-US";
      rec.continuous = false; // single utterance — push-to-talk, not always-on
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (e) => {
        let live = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) final += text;
          else live += text;
        }
        if (live) {
          setInterim(live);
          onInterimRef.current?.(live);
        }
        if (final && onFinalRef.current) {
          setInterim("");
          onFinalRef.current(final.trim());
        }
      };
      rec.onerror = (e) => {
        const kind = classifyError(e.error);
        if (kind) setError(kind);
      };
      rec.onend = () => {
        recognitionRef.current = null;
        releaseMic();
        setIsListening(false);
      };

      recognitionRef.current = rec;
      setIsListening(true);

      // Hold a sibling getUserMedia stream purely as the explicit mic-live signal + a
      // handle we can track.stop() on. If permission is denied, surface it and bail —
      // the engine would otherwise fail opaquely. echoCancellation requested so a later
      // talk mode doesn't self-hear (the engine opens its own stream, but requesting it
      // here at least primes the device constraints).
      navigator.mediaDevices
        ?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        .then((stream) => {
          micStreamRef.current = stream;
          // Only start the engine once we actually hold the mic.
          try {
            rec.start();
          } catch {
            // start() throws if called twice in a tick; the engine is already running.
          }
        })
        .catch((err: unknown) => {
          const name = (err as { name?: string })?.name;
          setError(name === "NotFoundError" ? "no-device" : "denied");
          recognitionRef.current = null;
          setIsListening(false);
        });
    },
    [isListening, releaseMic],
  );

  // Cleanup on unmount — never leave the mic open.
  useEffect(() => () => stop(), [stop]);

  return { supported, isListening, interim, error, start, stop };
}
