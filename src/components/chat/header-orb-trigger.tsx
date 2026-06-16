"use client";

import { useSyncExternalStore } from "react";
import { openTalkMode } from "@/components/chat/talk-overlay-store";
import { openInlineVoice } from "@/components/chat/anvil-inline-store";
import { useMediaQuery } from "@/lib/use-media-query";
import { useView } from "@/components/view-context";

/**
 * The "Anvil" header orb — a small, persistent Siri-style button in the global header.
 * Visible on every route + every viewport. On click it opens the two-way voice surface;
 * WHICH surface depends on the build-time mode flag:
 *
 *   NEXT_PUBLIC_ANVIL_ORB_MODE = "inplace" (default) | "modal" | "off"
 *     - inplace : the Siri-style IN-PLACE panel that expands from the orb (desktop);
 *                 on mobile (< 768px) it falls back to the centered modal — iOS Siri is
 *                 itself a full-screen takeover on phones, so the modal IS the phone's
 *                 "in place" (and reuses the modal's focus-trap + tests).
 *     - modal   : always the centered modal overlay (the prior behavior — instant revert).
 *     - off     : the orb is hidden (kill-switch / ship dark).
 *
 * (Subsumes the old boolean NEXT_PUBLIC_ENABLE_ANVIL_ORB: "false" maps to "off".)
 *
 * The orb is a real <button> (Enter/Space free); the gradient blob inside is aria-hidden.
 * Idle visual is pure CSS (no rAF, no WebGL — it must cost nothing on the Classic/SSG
 * critical path every visitor lands on); reduced-motion → static. It is a BUTTON, not a
 * listener: the mic only opens after the surface is open. The reactive 3D orb lives only
 * inside the open surface, never here.
 */

// Read once at module load — NEXT_PUBLIC_ vars are inlined at build time.
type OrbMode = "inplace" | "modal" | "off";
const ORB_MODE: OrbMode = (() => {
  const raw = process.env.NEXT_PUBLIC_ANVIL_ORB_MODE;
  if (raw === "modal" || raw === "off") return raw;
  // Back-compat: the old boolean kill-switch maps "false" → off.
  if (process.env.NEXT_PUBLIC_ENABLE_ANVIL_ORB === "false") return "off";
  return "inplace"; // default
})();

// SSR-safe STT support flag (no setState-in-effect; the use-mounted idiom). The voice
// loop needs recognition; gate on it so we never show a dead door.
const noopSubscribe = () => () => {};
const getSttClient = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
const getSttServer = () => false;

export function HeaderOrbTrigger() {
  const supported = useSyncExternalStore(noopSubscribe, getSttClient, getSttServer);
  // Mobile uses the centered modal even in "inplace" mode (the tiny header has no room
  // for an anchored panel; the modal is the phone's full-screen "in place").
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { view } = useView();

  if (ORB_MODE === "off" || !supported) return null;

  // The Voice VIEW already IS a live talk surface (its own session/mic). Opening a
  // second surface from the orb there would stack a second concurrent mic — so on that
  // view the orb is inert (a full one-mic mutex across all surfaces lands in P2).
  const onVoiceView = view === "voice";

  const open = (el: HTMLElement) => {
    if (onVoiceView) return; // don't stack a second session over the voice view
    if (ORB_MODE === "inplace" && isDesktop) openInlineVoice(el);
    else openTalkMode(el);
  };

  return (
    <button
      type="button"
      onClick={(e) => open(e.currentTarget)}
      disabled={onVoiceView}
      aria-label={
        onVoiceView
          ? "Anvil voice is already open in this view"
          : "Ask Anvil — talk to the portfolio by voice"
      }
      title={onVoiceView ? "You're in the Voice view" : "Ask Anvil"}
      // ≥44px hit area (WCAG 2.5.8) via padding around the ~28px visual; the visual is
      // the gradient blob, the padding is the comfortable tap target. Dimmed + inert on
      // the Voice view (that view is itself the live talk surface).
      className="group inline-flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base disabled:cursor-default disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className="anvil-orb-idle block h-7 w-7 rounded-full transition-transform group-hover:scale-110"
      />
    </button>
  );
}
