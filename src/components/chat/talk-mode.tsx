"use client";

import { useEffect } from "react";
import { Mic, Square, X } from "lucide-react";
import { useVoiceSession, toCaptionText, type VoiceSessionState } from "@/components/chat/use-voice-session";
import { useVoiceLevel } from "@/components/chat/use-voice-level";
import { VoiceOrb } from "@/components/chat/voice-orb";

/**
 * The two-way "talk mode" surface — an orb + live transcript + controls over the
 * useVoiceSession state machine. Used by BOTH the modal overlay (default) and the
 * optional 5th view, so it takes onClose and renders no chrome of its own beyond the
 * conversation UI.
 *
 * A11y: the orb is decorative (aria-hidden) and STATIC under prefers-reduced-motion
 * (verified useReducedMotion gate). A polite, aria-atomic status region announces the
 * turn ("Listening", "Thinking", "Speaking") without stealing focus (WCAG 4.1.3). The
 * live transcript is the visible caption track so voice is never the only channel
 * (WCAG 1.2.2 intent) — the spoken answer and the user's recognized words are both on
 * screen. Every control is a keyboard-operable button; Space toggles talk/stop, Esc
 * closes (the modal wrapper also wires Esc). The text composer in the Chat view
 * remains the always-available fallback — talk mode is purely additive.
 */

const STATUS_LABEL: Record<VoiceSessionState, string> = {
  idle: "Tap to start",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  paused: "Paused — tap to talk",
};

function lastAssistantText(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return messages[i].content;
  }
  return "";
}

export function TalkMode({ onClose }: { onClose: () => void }) {
  const session = useVoiceSession();
  const { supported, active, state, interim, messages, start, stop, interrupt, pause, resume } =
    session;
  // Smoothed 0..1 amplitude driving the orb (synthetic per-state envelope — browser
  // TTS isn't audio-tappable; see use-voice-level).
  const level = useVoiceLevel(state);

  // Space toggles the current turn (talk / stop-speaking / resume); Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
        // Space is the universal turn toggle (skip when a button is focused so it
        // doesn't double-fire the button's own activation).
        e.preventDefault();
        if (!active) start();
        else if (state === "speaking") interrupt();
        else if (state === "paused") resume();
        else pause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, state, start, stop, interrupt, pause, resume, onClose]);

  // The transcript caption: the user's live interim words (verbatim — already plain
  // STT text), or the latest answer stripped of markdown + card tokens so the screen
  // shows exactly what is SPOKEN (was leaking raw **markdown** / [[card:...]] tokens).
  const answer = lastAssistantText(messages);
  const caption = interim || toCaptionText(answer);

  if (!supported) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <p className="text-sm text-fg-muted">
          Voice conversation isn&apos;t available in this browser. You can still type your
          questions in the chat.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-4 py-2 text-sm text-fg-muted hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Back to chat
        </button>
      </div>
    );
  }

  const speaking = state === "speaking";
  const listening = state === "listening";

  // Primary control depends on the turn: start / stop-speaking / resume / mute.
  const onPrimary = () => {
    if (!active) start();
    else if (speaking) interrupt();
    else if (state === "paused") resume();
    else pause();
  };
  const primaryLabel = !active
    ? "Start voice conversation"
    : speaking
      ? "Stop speaking"
      : state === "paused"
        ? "Resume listening"
        : "Mute microphone";

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-8">
      {/* Status (polite, atomic — announced without stealing focus). */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {active ? STATUS_LABEL[state] : ""}
      </div>

      {/* Audio-reactive orb (decorative, aria-hidden). The canvas blob pulses/glows
          from the synthetic per-state `level`; a centered state icon stays for a quick
          glance. Reduced-motion -> the canvas draws a calm static ring (handled inside). */}
      <div className="relative flex h-40 w-40 items-center justify-center" aria-hidden="true">
        <VoiceOrb level={level} state={state} size={160} />
        <span className="pointer-events-none absolute text-accent">
          {speaking ? <Square size={26} className="fill-current" /> : <Mic size={26} />}
        </span>
      </div>

      {/* Visible status label (sighted mirror of the live region). */}
      <p className="font-mono text-xs uppercase tracking-widest text-fg-muted">
        {active ? STATUS_LABEL[state] : "Tap the mic to talk"}
      </p>

      {/* Live transcript caption — voice is never the only channel (WCAG 1.2.2). */}
      <div className="min-h-[3.5rem] w-full max-w-md text-center">
        {caption ? (
          <p className={`text-sm leading-relaxed ${interim ? "text-fg-muted" : "text-fg"}`}>
            {caption}
          </p>
        ) : (
          <p className="text-sm text-fg-subtle">
            Ask about my work, projects, or what I&apos;m looking for.
          </p>
        )}
      </div>

      {/* Controls. */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPrimary}
          aria-label={primaryLabel}
          // The dynamic aria-label carries the action; aria-pressed exposes the
          // dominant mic on/off state to AT (true while actively listening) — WCAG 4.1.2.
          aria-pressed={listening}
          className={`inline-flex h-14 w-14 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ${
            active && !speaking && state !== "paused"
              ? "border-accent bg-accent text-bg-base"
              : "border-border bg-bg-surface text-fg hover:border-accent"
          }`}
        >
          {speaking ? <Square size={22} className="fill-current" /> : <Mic size={22} />}
        </button>
        <button
          type="button"
          onClick={() => {
            stop();
            onClose();
          }}
          aria-label="End voice conversation"
          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={15} aria-hidden="true" />
          End
        </button>
      </div>

      <p className="text-center text-[11px] text-fg-subtle">
        Turn-based voice · grounded in real work · press Space to talk, Esc to close
      </p>
    </div>
  );
}
