"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, X, Captions, CaptionsOff, ChevronDown } from "lucide-react";
import { useVoiceSession, toCaptionText, type VoiceSessionState } from "@/components/chat/use-voice-session";
import { useVoiceLevel } from "@/components/chat/use-voice-level";
import { VoiceOrb } from "@/components/chat/voice-orb";
import { VoicePicker } from "@/components/chat/voice-picker";
import { useVoiceSettings } from "@/lib/voice-settings-context";
import { getDefaultVoiceId, getVoiceById } from "@/lib/voice-catalog";
import {
  hasSeenFirstRunPrimer,
  markFirstRunPrimerSeen,
} from "@/components/chat/voice-pitfalls";

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
  autoStart = false,
}: {
  onClose: () => void;
  /** Optional example-prompt chips (Anvil view). Each is asked by voice via the
   *  session's own seam — one transcript, one mic. The modal passes none (unchanged). */
  prompts?: readonly string[];
  /** Start listening immediately on mount (the Siri "tap = talk" feel) — used by the
   *  desktop inline panel, which mounts from the orb click. Best-effort: the mic open
   *  (getUserMedia) is async and runs a few ticks after the click, so on iOS Safari's
   *  first permission grant the user-activation may have lapsed and a second tap on the
   *  mic is needed; it degrades safely (the session falls to "paused — tap to talk", and
   *  the primary control rescues it — never a hot mic or a hang). Chrome/Edge honor it. */
  autoStart?: boolean;
}) {
  const session = useVoiceSession();
  const { supported, active, state, interim, messages, start, ask, stop, interrupt, pause, resume } =
    session;
  const { settings, toggle, set } = useVoiceSettings();
  // Voice picker mounted INSIDE TalkMode so it inherits the voice-settings store
  // (one source of truth) and so opening the picker doesn't tear down the session.
  // Resolves the current voice via the catalog default when settings.voiceId is unset
  // (preserves v1.6 Joanna behavior for legacy localStorage payloads).
  const [pickerOpen, setPickerOpen] = useState(false);
  const voiceLabelRef = useRef<HTMLButtonElement>(null);
  const currentVoiceId = settings.voiceId ?? getDefaultVoiceId();
  const currentVoiceName = getVoiceById(currentVoiceId)?.displayName ?? "Default";

  // First-run primer: a one-time, dismissible card that surfaces the picker
  // affordance to a visitor who's never opened TalkMode before. The catalog
  // default voiceId resolves to Joanna by default, but most visitors won't
  // know they CAN swap voices unless we tell them once. Not shown when the
  // user has already picked a voice (settings.voiceId set) — that's already
  // a clear signal they know about the picker.
  const [showPrimer, setShowPrimer] = useState(false);
  useEffect(() => {
    if (settings.voiceId === undefined && !hasSeenFirstRunPrimer()) {
      setShowPrimer(true);
    }
  }, [settings.voiceId]);
  const dismissPrimer = () => {
    markFirstRunPrimerSeen();
    setShowPrimer(false);
  };
  // Smoothed 0..1 amplitude driving the orb (synthetic per-state envelope — browser
  // TTS isn't audio-tappable; see use-voice-level).
  const level = useVoiceLevel(state);
  // The persistent primary control (mic/orb). Focus rescues here when the prompt chips
  // unmount on the first turn (else focus would orphan to <body> — WCAG 2.4.3).
  const primaryRef = useRef<HTMLButtonElement>(null);
  // Root, so the Space turn-toggle fires ONLY when focus is within this surface. In the
  // page-covering modal that didn't matter (nothing behind was reachable); in the
  // NON-MODAL inline panel the page stays scrollable, so an unscoped window Space would
  // hijack the page's Space. Esc stays window-wide (close-from-anywhere, idempotent).
  const containerRef = useRef<HTMLDivElement>(null);
  // Auto-start once on mount (Siri "tap = talk"). Guarded by a ref so it fires exactly
  // once and never re-triggers across re-renders; only when supported + not already active.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && supported && !active && !autoStarted.current) {
      autoStarted.current = true;
      start();
    }
  }, [autoStart, supported, active, start]);
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
      } else if (
        e.key === " " &&
        !(e.target instanceof HTMLButtonElement) &&
        containerRef.current?.contains(document.activeElement)
      ) {
        // Space is the turn toggle — but ONLY when focus is within this surface (so it
        // never hijacks the page's Space behind the non-modal panel). Skipped when a
        // button is focused so it doesn't double-fire the button's own activation.
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
    <div ref={containerRef} className="flex flex-col items-center gap-6 px-6 py-8">
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
          Toggleable via the cc control below; default on.
          aria-hidden flips ON while speaking so a screen reader doesn't double-announce
          the text the page is currently reading aloud (pitfall #1 — the SR + read-aloud
          double-speak). The visible caption stays for sighted users; only the AT path
          is suppressed during active speech. */}
      {settings.captions && (
        <div
          aria-hidden={speaking}
          className="flex min-h-[3.5rem] w-full max-w-md flex-col items-center gap-1.5 text-center"
        >
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

      {/* Voice picker trigger — sits BELOW the controls so it doesn't compete with
          the primary mic button for visual weight. Mirrors the captions toggle's
          height + frosted-pill aesthetic. */}
      <button
        ref={voiceLabelRef}
        type="button"
        onClick={() => setPickerOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        aria-label={`Pick voice — current: ${currentVoiceName}`}
        title="Pick voice"
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/60 bg-bg-surface/40 px-3 text-[11px] text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="font-mono uppercase tracking-widest">Voice:</span>
        <span className="text-fg">{currentVoiceName}</span>
        <ChevronDown size={12} aria-hidden="true" className="opacity-60" />
      </button>

      <p className="text-center text-[11px] text-fg-subtle">
        {active
          ? "Tap the orb or press Space to take your turn · Esc to close"
          : "Tap the orb or press Space to start · grounded in real work"}
      </p>

      {/* First-run primer — one-time hint surfacing the picker affordance. Dismissed
          forever via markFirstRunPrimerSeen() so we don't nag returning visitors.
          aria-live polite so AT users hear it without focus theft. Closes
          automatically once the user picks a voice (settings.voiceId set). */}
      {showPrimer && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto flex max-w-md items-start gap-3 rounded-lg border border-border-strong/40 bg-bg-base/80 px-3 py-2.5 text-xs text-fg-muted backdrop-blur-sm"
        >
          <span className="flex-1 leading-relaxed">
            <span className="font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
              Tip ·{" "}
            </span>
            Anvil reads answers in {currentVoiceName} by default. Press{" "}
            <kbd className="rounded bg-bg-elevated px-1 py-0.5 text-[10px]">⌘K</kbd>{" "}
            → "Pick voice" or use the Voice menu above to swap.
          </span>
          <button
            type="button"
            onClick={dismissPrimer}
            aria-label="Dismiss tip"
            className="-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Voice picker dialog. Picking a voice persists to the settings store; the
          session's TTS hook (Phase 2.3) re-renders on the next utterance with the
          new voiceId — no in-flight audio is interrupted by the swap. */}
      <VoicePicker
        mode="dialog"
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        currentVoiceId={currentVoiceId}
        onPick={(id) => set({ voiceId: id })}
        getOpener={() => voiceLabelRef.current}
      />
    </div>
  );
}
