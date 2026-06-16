"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useVoiceSession, toCaptionText } from "@/components/chat/use-voice-session";
import { useVoiceLevel } from "@/components/chat/use-voice-level";
import { VoiceOrb } from "@/components/chat/voice-orb";
import {
  useCoreVoiceOpen,
  setCoreVoiceOpen,
  getCoreVoiceOpener,
} from "@/components/chat/anvil-core-store";

/**
 * The CORE Siri voice surface — a minimal orb-only auto-listening interface.
 *
 * On click of the header orb (when ORB_EXPERIENCE=core), this shows ONLY:
 *  - The enlarged reactive orb (~200px) — state (listening/thinking/speaking) conveyed
 *    by the orb's envelope alone (useVoiceLevel + the 3D uSpeaking surge).
 *  - A tiny "listening" dot (the mic-hot trust cue) that reflects paused-vs-listening.
 *  - A minimal frosted result card beneath the orb: the answer text only, scrollable,
 *    persists until the next turn.
 *  - An sr-only aria-live status region (WCAG 4.1.3).
 *
 * NO panel chrome, NO caption "You said" track, NO control bar, NO prompt chips. Close
 * via Esc / outside-pointerdown / tap-orb-again — all call stop() (no hot mic lingers).
 *
 * Drives the SAME useVoiceSession (one mic, one transcript, grounded via /api/chat).
 * Does NOT fork TalkMode — it's a lean container, <200 lines. Mounted ONCE in the
 * layout; self-gates (renders null when closed). Never remounts mid-turn.
 */

export function AnvilCoreSurface() {
  const open = useCoreVoiceOpen();
  const panelRef = useRef<HTMLDivElement>(null);
  const { supported, active, state, messages, isStreaming, start, stop } =
    useVoiceSession();
  const level = useVoiceLevel(state);

  // Auto-start on open (the orb tap is the gesture).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (open && supported && !active && !autoStarted.current) {
      autoStarted.current = true;
      start();
    }
    if (!open) autoStarted.current = false;
  }, [open, supported, active, start]);

  // Close: stop session + restore focus to the orb.
  const close = useCallback(() => {
    stop();
    setCoreVoiceOpen(false);
    getCoreVoiceOpener()?.focus();
  }, [stop]);

  // Esc to close (window-scoped, idempotent).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Outside-pointerdown closes (excluding the orb button).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      const orb = getCoreVoiceOpener();
      if (orb && (orb === target || orb.contains(target))) return;
      close();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, close]);

  // aria-expanded on the orb trigger.
  useEffect(() => {
    const orb = getCoreVoiceOpener();
    if (!orb) return;
    orb.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) orb.setAttribute("aria-controls", "anvil-core-surface");
    else orb.removeAttribute("aria-controls");
  }, [open]);

  // Anchor to the orb's right edge (measured on open, updated on resize).
  const rightRef = useRef(16);
  useEffect(() => {
    if (!open) return;
    const orb = getCoreVoiceOpener();
    if (!orb) return;
    const update = () => {
      const r = orb.getBoundingClientRect();
      rightRef.current = Math.max(12, Math.round(window.innerWidth - r.right));
      panelRef.current?.style.setProperty("right", `${rightRef.current}px`);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

  if (!open) return null;

  // The last assistant answer (answer-only, no "You said").
  const lastAnswer = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return toCaptionText(messages[i].content);
    }
    return "";
  })();

  const listening = state === "listening";
  const speaking = state === "speaking";
  const thinking = state === "thinking";

  return (
    <motion.div
      ref={panelRef}
      id="anvil-core-surface"
      role="region"
      aria-label="Anvil voice"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.6 }}
      style={{ transformOrigin: "top right", right: rightRef.current }}
      className="fixed top-16 z-50 flex flex-col items-center gap-3 p-4"
    >
      {/* sr-only live region for AT (WCAG 4.1.3) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {listening ? "Listening" : thinking ? "Thinking" : speaking ? "Speaking" : ""}
      </div>

      {/* The enlarged reactive orb — state conveyed by animation alone. */}
      <div className="relative" aria-hidden="true">
        <VoiceOrb level={level} state={state} size={200} />
      </div>

      {/* Mic-hot trust cue — a tiny pulsing dot when listening, muted when paused. */}
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block h-2 w-2 rounded-full transition-colors ${
            listening
              ? "animate-pulse bg-accent"
              : state === "paused"
                ? "bg-fg-subtle"
                : "bg-accent/60"
          }`}
        />
        <span className="text-[10px] text-fg-subtle">
          {listening ? "Listening" : state === "paused" ? "Tap to talk" : speaking ? "Speaking" : "Thinking"}
        </span>
      </div>

      {/* Minimal frosted result card — answer only, no "You said", scrollable. */}
      {lastAnswer && (
        <div className="w-[min(88vw,22rem)] rounded-xl border border-border/60 bg-bg-surface/80 px-4 py-3 shadow-lg backdrop-blur-sm">
          <p
            className="max-h-[clamp(7.5rem,40vh,18rem)] overflow-y-auto text-sm leading-relaxed text-fg"
            style={{ maskImage: "linear-gradient(to bottom, black 85%, transparent 100%)" }}
          >
            {lastAnswer}
          </p>
        </div>
      )}
      {/* Streaming shimmer while waiting for the answer. */}
      {(thinking || isStreaming) && !lastAnswer && (
        <div className="w-[min(88vw,22rem)] rounded-xl border border-border/60 bg-bg-surface/80 px-4 py-3 shadow-lg backdrop-blur-sm">
          <div className="h-4 w-3/4 animate-pulse rounded bg-fg-subtle/20" />
        </div>
      )}
    </motion.div>
  );
}
