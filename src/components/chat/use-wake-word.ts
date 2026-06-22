"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Opt-in "Hey portfolio" wake word. OFF by default and the highest-trust-cost feature
 * here — an unexpected always-on mic on a recruiter-facing site reads as malware, so
 * this hook is never started without an explicit toggle, ALWAYS pairs with a visible
 * "Listening" banner + one-tap kill (the UI owns that), and is Chat-view-scoped.
 *
 * Engine: browser SpeechRecognition in continuous mode, matching a small set of
 * phrases. This is a TRANSPARENT, fully-disclosed cloud path (on Chrome/Edge the
 * ambient audio streams to Google while active) — never silent. An on-device engine
 * (openWakeWord ONNX) would remove the cloud round-trip but is out-of-scope "ocean"
 * work (custom model asset + AudioWorklet); the hook's shape is engine-agnostic so it
 * can be swapped later without touching callers.
 *
 * Robustness: continuous recognition self-terminates on silence/timeouts, so we
 * re-arm in onend while still enabled (debounced). track.stop() + abort on disable
 * releases the mic immediately.
 */

const PHRASES = ["hey portfolio", "hey sairam", "ask my portfolio", "hey anvil"];
const REARM_DELAY_MS = 400;

// Minimal Web Speech typings (shared shape with use-speech-recognition; redeclared
// locally to keep this hook self-contained).
interface SRResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { readonly transcript: string };
}
interface SREventLike extends Event {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [i: number]: SRResultLike };
}
interface SRLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREventLike) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SRLike;

function getCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// SSR-safe support flag (no setState-in-effect; matches use-mounted idiom).
const noopSubscribe = () => () => {};
const getSupportedClient = () => getCtor() !== null;
const getSupportedServer = () => false;

function matched(transcript: string): boolean {
  const t = transcript.toLowerCase();
  return PHRASES.some((p) => t.includes(p));
}

export type UseWakeWord = {
  /** Whether continuous recognition exists at all (else the toggle is hidden). */
  supported: boolean;
  /** True while actively listening for the phrase (drives the persistent banner). */
  listening: boolean;
  /** Begin listening (explicit gesture — opens the mic). */
  arm: (onDetect: () => void) => void;
  /** Stop listening and release the mic. */
  disarm: () => void;
};

export function useWakeWord(): UseWakeWord {
  const supported = useSyncExternalStore(noopSubscribe, getSupportedClient, getSupportedServer);
  const [listening, setListening] = useState(false);

  const recRef = useRef<SRLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const enabledRef = useRef(false);
  const onDetectRef = useRef<(() => void) | null>(null);
  const rearmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const disarm = useCallback(() => {
    enabledRef.current = false;
    if (rearmRef.current) {
      clearTimeout(rearmRef.current);
      rearmRef.current = null;
    }
    recRef.current?.abort();
    recRef.current = null;
    releaseMic();
    setListening(false);
  }, [releaseMic]);

  // eslint-disable-next-line react-hooks/immutability -- useCallback; setTimeout(startEngine) is intentional re-arm after recognition ends
  const startEngine = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || !enabledRef.current) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0]?.transcript ?? "";
        if (matched(text)) {
          onDetectRef.current?.();
          // One activation per detection — disarm so it doesn't loop on the same phrase.
          disarm();
          return;
        }
      }
    };
    rec.onerror = () => {
      /* re-arm handled in onend */
    };
    rec.onend = () => {
      // Continuous mode self-terminates; re-arm while still enabled (debounced so a
      // rapid stop/start can't trip Chrome's restart rate-limit).
      recRef.current = null;
      if (!enabledRef.current) return;
      rearmRef.current = setTimeout(startEngine, REARM_DELAY_MS); // eslint-disable-line react-hooks/immutability -- intentional self-reference; re-arm after recognition ends
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* already started */
    }
  }, [disarm]);

  const arm = useCallback(
    (onDetect: () => void) => {
      const Ctor = getCtor();
      if (!Ctor || enabledRef.current) return;
      onDetectRef.current = onDetect;
      enabledRef.current = true;
      // Hold a sibling stream as the explicit mic-live signal + clean release handle.
      navigator.mediaDevices
        ?.getUserMedia({ audio: true })
        .then((stream) => {
          if (!enabledRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          setListening(true);
          startEngine();
        })
        .catch(() => {
          enabledRef.current = false;
          setListening(false);
        });
    },
    [startEngine],
  );

  // Never leave the mic open on unmount.
  useEffect(() => () => disarm(), [disarm]);

  return { supported, listening, arm, disarm };
}
