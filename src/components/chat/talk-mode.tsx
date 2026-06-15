"use client";

import { useEffect, useRef } from "react";
import { Mic, Square, X, Captions, CaptionsOff } from "lucide-react";
import { useVoiceSession, toCaptionText, type VoiceSessionState } from "@/components/chat/use-voice-session";
import { useVoiceLevel } from "@/components/chat/use-voice-level";
import { VoiceOrb } from "@/components/chat/voice-orb";
import { useVoiceSettings } from "@/lib/voice-settings-context";

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

function lastUserText(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

export function TalkMode({
  onClose,
  prompts,
}: {
  onClose: () => void;
  /** Optional example-prompt chips (Anvil view). Each is asked by voice via the
   *  session's own seam — one transcript, one mic. The modal passes none (unchanged). */
  prompts?: readonly string[];
}) {
  const session = useVoiceSession();
  const { supported, active, state, interim, messages, start, ask, stop, interrupt, pause, resume } =
    session;
  const { settings, toggle } = useVoiceSettings();
  // Smoothed 0..1 amplitude driving the orb (synthetic per-state envelope — browser
  // TTS isn't audio-tappable; see use-voice-level).
  const level = useVoiceLevel(state);
  // The persistent primary control (mic/orb). Focus rescues here when the prompt chips
  // unmount on the first turn (else focus would orphan to <body> — WCAG 2.4.3).
  const primaryRef = useRef<HTMLButtonElement>(null);
  const hadMessages = useRef(false);
  useEffect(() => {
    const has = messages.length > 0;
    if (has && !hadMessages.current && document.activeElement === document.body) {
      // The just-clicked chip has unmounted; move focus to the always-present control.
      primaryRef.current?.focus();
    }
    hadMessages.current = has;
  }, [messages.length]);

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

  // Two distinct caption tracks so the user always sees BOTH sides of the turn:
  //  - "You said" — the live interim words (verbatim, already plain STT) while speaking,
  //    falling through to the last COMMITTED user message once interim clears, so the
  //    user's words persist instead of flashing empty the instant the final lands.
  //  - the answer — the latest assistant reply stripped of markdown + card tokens, so
  //    the screen shows exactly what is SPOKEN (was leaking **markdown** / [[card:...]]).
  const youSaid = interim || lastUserText(messages);
  const answerText = toCaptionText(lastAssistantText(messages));

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

      {/* Audio-reactive orb (decorative, aria-hidden). The orb pulses/glows from the
          synthetic per-state `level`; a FAINT, blurred state hint sits inside the glow
          (demoted from a solid glyph that read as a sticker) — meaning is carried by the
          visible label + the aria-live region, so this is a glance cue only.
          Reduced-motion -> the canvas draws a calm static ring (handled inside). */}
      <div className="relative flex h-40 w-40 items-center justify-center" aria-hidden="true">
        <VoiceOrb level={level} state={state} size={160} />
        <span className="pointer-events-none absolute text-accent/30 blur-[1px]">
          {speaking ? <Square size={18} className="fill-current" /> : <Mic size={18} />}
        </span>
      </div>

      {/* Visible status label (sighted mirror of the live region). */}
      <p className="font-mono text-xs uppercase tracking-widest text-fg-muted">
        {active ? STATUS_LABEL[state] : "Tap the mic to talk"}
      </p>

      {/* Live captions — both sides of the turn as text so voice is never the only
          channel (good UX + 4.1.3; NOT a WCAG-1.2.2 claim — computer-gen audio isn't
          "live"). "You said" persists the user's words; the answer shows what is SPOKEN.
          Toggleable via the cc control below; default on. */}
      {settings.captions && (
        <div className="flex min-h-[3.5rem] w-full max-w-md flex-col items-center gap-1.5 text-center">
          {youSaid && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
                You said
              </p>
              <p className="text-sm leading-relaxed text-fg-muted">{youSaid}</p>
            </>
          )}
          {answerText && <p className="text-sm leading-relaxed text-fg">{answerText}</p>}
          {!youSaid && !answerText && (
            <p className="text-sm text-fg-subtle">
              Ask about my work, projects, or what I&apos;m looking for.
            </p>
          )}
        </div>
      )}

      {/* Example-prompt chips (Anvil view only) — solve the "what do I say?" problem.
          Shown before the conversation starts; each is asked BY VOICE through the
          session's own ask() (one transcript, one mic). Hidden once a turn exists, and
          omitted entirely where STT is unsupported (the text fallback covers that). */}
      {prompts && prompts.length > 0 && messages.length === 0 && (
        <div className="flex max-w-md flex-wrap items-center justify-center gap-2">
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => ask(p)}
              className="rounded-full border border-border bg-bg-surface px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Controls. */}
      <div className="flex items-center gap-3">
        <button
          ref={primaryRef}
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
        {/* Captions on/off (cc) — default on; persists in voice settings. */}
        <button
          type="button"
          onClick={() => toggle("captions")}
          aria-pressed={settings.captions}
          aria-label={settings.captions ? "Hide captions" : "Show captions"}
          title={settings.captions ? "Hide captions" : "Show captions"}
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            settings.captions
              ? "border-accent/60 text-accent"
              : "border-border text-fg-muted hover:border-accent hover:text-fg"
          }`}
        >
          {settings.captions ? <Captions size={16} /> : <CaptionsOff size={16} />}
        </button>
      </div>

      <p className="text-center text-[11px] text-fg-subtle">
        {active
          ? "Tap the orb or press Space to take your turn · Esc to close"
          : "Tap the orb or press Space to start · grounded in real work"}
      </p>
    </div>
  );
}
