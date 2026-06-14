"use client";

import { useId, useState } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { useStt } from "@/components/chat/use-stt";
import { useVoiceSettings } from "@/lib/voice-settings-context";

/**
 * Push-to-talk mic for the chat composer. Progressive enhancement: renders ONLY when
 * the browser supports the Web Speech API (Firefox / unsupported → nothing, the text
 * composer is untouched). Press-to-toggle (NOT hold — a motor-accessibility barrier).
 *
 * Consent flow (recruiter-trust critical): the FIRST activation shows a one-line
 * disclosure that on Chrome/Edge the browser sends audio to its vendor for
 * transcription and nothing is stored here. Accepting flips the persisted
 * `micEnabled` flag (so it's shown once), then listening starts; subsequent clicks
 * skip straight to listening. The mic never opens without this explicit gesture.
 *
 * Transcription is FILL-FOR-REVIEW: interim + final text flow up via onText so the
 * user edits/confirms in the input before sending (recognition mishears proper nouns
 * like "Ascendion"/"MindForge"). The parent owns send().
 */
export function MicButton({
  onText,
  disabled = false,
  compact = false,
}: {
  /** Called with live (interim) and final transcripts; the parent fills its input. */
  onText: (text: string) => void;
  /** True while a response is streaming — mic is disabled then (mirrors Send/Stop). */
  disabled?: boolean;
  /** Smaller (h-9 w-9) variant to match the floating widget's compact controls. */
  compact?: boolean;
}) {
  const { settings, set } = useVoiceSettings();
  const { supported, isListening, error, start, stop } = useStt(settings.sttEngine);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const disclosureId = useId();

  if (!supported) return null;

  const beginListening = () => {
    // Both interim and final transcripts fill the composer live (fill-for-review):
    // the user watches words appear, then edits/confirms before sending.
    start(
      (finalText) => {
        if (finalText) onText(finalText);
      },
      (interimText) => onText(interimText),
    );
  };

  const onMicClick = () => {
    if (isListening) {
      stop();
      return;
    }
    // First-ever use → disclose before opening the mic. After acceptance the persisted
    // flag short-circuits this on every later click.
    if (!settings.micEnabled) {
      setShowDisclosure(true);
      return;
    }
    beginListening();
  };

  const acceptDisclosure = () => {
    set({ micEnabled: true });
    setShowDisclosure(false);
    beginListening();
  };

  return (
    <div className="relative">
      {showDisclosure && (
        <div
          id={disclosureId}
          role="dialog"
          aria-modal="false"
          aria-label="Microphone privacy notice"
          className="absolute bottom-full right-0 z-10 mb-2 w-72 rounded-xl border border-border-strong bg-bg-surface p-3 text-left shadow-2xl"
        >
          <p className="text-xs leading-relaxed text-fg-muted">
            {settings.sttEngine === "transcribe"
              ? "Voice is optional. Your speech is transcribed on Sairam's own AWS — not a third party — and nothing is stored."
              : "Voice is optional. Your browser (Chrome/Safari) may send the audio to Google or Apple to turn speech into text. Nothing is recorded or stored here."}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDisclosure(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={acceptDisclosure}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-bg-base transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Use microphone
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onMicClick}
        disabled={disabled}
        aria-pressed={isListening}
        aria-label={isListening ? "Stop listening" : "Ask by voice"}
        aria-haspopup={!settings.micEnabled ? "dialog" : undefined}
        title={error === "denied" ? "Microphone blocked — check browser permissions, or just type" : undefined}
        className={`inline-flex items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base disabled:opacity-40 ${
          compact ? "h-9 w-9 rounded-lg" : "h-11 w-11"
        } ${
          isListening
            ? "border-accent bg-accent/15 text-accent"
            : "border-border text-fg-muted hover:border-accent hover:text-fg"
        }`}
      >
        {/* Pulsing dot + icon swap (NOT color-only) so the listening state is
            perceivable without relying on hue — WCAG 1.4.1. */}
        {isListening ? (
          <span className="relative inline-flex">
            <Square size={compact ? 13 : 15} className="fill-current" aria-hidden="true" />
            <span className="absolute -right-1.5 -top-1.5 h-2 w-2 animate-pulse rounded-full bg-accent" />
          </span>
        ) : error === "denied" ? (
          <MicOff size={compact ? 15 : 17} aria-hidden="true" />
        ) : (
          <Mic size={compact ? 15 : 17} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
