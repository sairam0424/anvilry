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
 * Fallback: if "transcribe" is selected but unsupported, we transparently return the
 * browser engine instead (so a Firefox visitor who picked Transcribe still gets the
 * browser path if available, and vice-versa). Per-request failures (route 5xx) are
 * surfaced via `error` for the caller to react to; the browser engine remains the
 * always-available default.
 */
export function useStt(engine: SttEngine = "browser"): UseSpeechRecognition {
  const browser = useSpeechRecognition();
  const transcribe = useTranscribeRecognition();

  if (engine === "transcribe") {
    // Prefer Transcribe when selected AND usable; else fall back to the browser engine.
    return transcribe.supported ? transcribe : browser;
  }
  return browser;
}
