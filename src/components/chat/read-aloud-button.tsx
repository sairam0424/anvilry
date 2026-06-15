"use client";

import { Volume2, Square } from "lucide-react";

/**
 * A small per-answer "read aloud" toggle. Stateless/presentational — the single
 * useSpeechSynthesis instance lives in ChatMessages (one engine for the whole
 * transcript), which passes `speaking` (is THIS message being read) + onToggle.
 *
 * aria-pressed communicates the on/off state to AT; the icon swaps (speaker -> stop,
 * not color-only) per WCAG 1.4.1. Rendered only where TTS is supported + opted in.
 */
export function ReadAloudButton({
  speaking,
  onToggle,
}: {
  speaking: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={speaking}
      aria-label={speaking ? "Stop reading aloud" : "Read this answer aloud"}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-mono text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        speaking ? "text-accent" : "text-fg-subtle hover:text-fg"
      }`}
    >
      {speaking ? (
        <Square size={11} className="fill-current" aria-hidden="true" />
      ) : (
        <Volume2 size={12} aria-hidden="true" />
      )}
      {speaking ? "Stop" : "Listen"}
    </button>
  );
}
