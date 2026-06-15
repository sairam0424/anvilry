"use client";

import { useSyncExternalStore } from "react";
import { openTalkMode } from "@/components/chat/talk-overlay-store";

/**
 * The "Anvil" header orb — a small, persistent Siri-style button in the global header
 * that opens the two-way voice overlay (the existing modal, via the shared store —
 * one overlay instance, focus restored here on close). Visible on every route + every
 * viewport when enabled.
 *
 * Build-time flag (NEXT_PUBLIC_ENABLE_ANVIL_ORB): OFF by default so it ships dark and
 * the owner flips it on after a live prod pass. STT-gated at runtime — a voice door is
 * pointless where the browser can't listen.
 *
 * The orb is a real <button> (Enter/Space free); the gradient blob inside is aria-hidden.
 * Idle visual is a pure CSS breathe (no rAF, no WebGL — it must cost nothing on the
 * Classic/SSG critical path that every visitor lands on); reduced-motion → static. It is
 * a BUTTON, not a listener: the mic only opens after the overlay is open and the user
 * taps start. The 3D orb lives only inside the open overlay, never here.
 */

// Read once at module load — NEXT_PUBLIC_ vars are inlined at build time.
const ORB_ENABLED = process.env.NEXT_PUBLIC_ENABLE_ANVIL_ORB === "true";

// SSR-safe STT support flag (no setState-in-effect; the use-mounted idiom). The voice
// loop needs recognition; gate on it so we never show a dead door.
const noopSubscribe = () => () => {};
const getSttClient = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
const getSttServer = () => false;

export function HeaderOrbTrigger() {
  const supported = useSyncExternalStore(noopSubscribe, getSttClient, getSttServer);
  if (!ORB_ENABLED || !supported) return null;

  return (
    <button
      type="button"
      onClick={(e) => openTalkMode(e.currentTarget)}
      aria-label="Ask Anvil — talk to the portfolio by voice"
      title="Ask Anvil"
      // ≥44px hit area (WCAG 2.5.8) via padding around the ~28px visual; the visual is
      // the gradient blob, the padding is the comfortable tap target.
      className="group inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base"
    >
      <span
        aria-hidden="true"
        className="anvil-orb-idle block h-7 w-7 rounded-full transition-transform group-hover:scale-110"
      />
    </button>
  );
}
