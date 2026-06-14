"use client";

import { useSpeechRecognition, type UseSpeechRecognition } from "@/components/chat/use-speech-recognition";
import { useTranscribeRecognition } from "@/components/chat/use-transcribe-recognition";

/** Which STT engine: free browser Web Speech (default) or AWS Transcribe. */
export type SttEngine = "browser" | "transcribe";

/**
 * Engine selector for speech-to-text. Both hooks are always called (Rules of Hooks),
 * but only the selected one is driven — the other sits idle (it opens no mic until its
 * start() is called). Returns the unified UseSpeechRecognition shape so the mic button
 * and talk session are engine-agnostic.
 *
 * Fallback (the always-available default is the browser engine): when "transcribe" is
 * selected we use it only when it is BOTH supported AND has not errored. A static
 * unsupported (Firefox without AudioContext, etc.) OR a runtime failure — permission
 * denied, no device, or a route 503/5xx surfaced as `error` — transparently degrades to
 * the browser engine, honoring the "voice always degrades to the text composer" promise.
 */
export function useStt(engine: SttEngine = "browser"): UseSpeechRecognition {
  const browser = useSpeechRecognition();
  const transcribe = useTranscribeRecognition();

  if (engine === "transcribe" && transcribe.supported && !transcribe.error) {
    return transcribe;
  }
  return browser;
}
