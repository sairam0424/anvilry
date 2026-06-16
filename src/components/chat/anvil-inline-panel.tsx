"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { TalkMode } from "@/components/chat/talk-mode";
import {
  useInlineVoiceOpen,
  setInlineVoiceOpen,
  getInlineVoiceOpener,
} from "@/components/chat/anvil-inline-store";

/**
 * The IN-PLACE Anvil voice panel — the Siri-style surface that expands FROM the header
 * orb (top-right) instead of opening a centered modal. NON-MODAL by design: the page
 * stays scrollable + interactive behind it (no overlay, no inert, no scroll-lock, no
 * focus trap — a non-modal trap would be a WCAG 2.1.2 failure). It uses the ARIA
 * DISCLOSURE pattern, not role=dialog.
 *
 * Because Radix Dialog's free focus-trap + dismiss are deliberately NOT used here, the
 * disclosure obligations are hand-rolled and must stay correct:
 *  - the orb button carries aria-expanded + aria-controls (wired here via a shared id);
 *  - on open, focus moves to the panel's primary control (TalkMode's own onOpenAutoFocus
 *    analog — we focus the first button after mount);
 *  - on close, focus returns to the orb (the store remembers the opener — WCAG 2.4.3);
 *  - Esc is handled by TalkMode's existing window keydown (do NOT add a second handler);
 *  - an outside pointerdown closes it — but EXCLUDING the orb itself, or the orb's own
 *    onClick would re-open in the same gesture (open/close race);
 *  - closing fully ENDS the session (TalkMode.onClose → session.stop via End, plus we
 *    stop on every close path) so no hot mic is ever left running in the background.
 *
 * The genie entrance scales/translates/fades from the orb's rect (compositor-only props),
 * reading as the orb blooming in place. The single global mount lives in the layout.
 */

const PANEL_ID = "anvil-inline-panel";

export function AnvilInlinePanel() {
  const open = useInlineVoiceOpen();
  const panelRef = useRef<HTMLDivElement>(null);
  // Anchor the panel DIRECTLY below the orb button (like Siri — attached, not floating
  // separately). Measured from the orb's bounding rect so it hangs from the trigger.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const orb = getInlineVoiceOpener();
    if (!orb) return;
    const update = () => {
      const r = orb.getBoundingClientRect();
      setPos({
        top: Math.round(r.bottom + 8), // 8px gap below the orb
        right: Math.max(8, Math.round(window.innerWidth - r.right)),
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open]);

  // One idempotent close path: end the session UI (TalkMode's End handles stop()), drop
  // the open flag, and restore focus to the orb that opened it.
  const close = useCallback(() => {
    setInlineVoiceOpen(false);
    const opener = getInlineVoiceOpener();
    if (opener) opener.focus();
  }, []);

  // Wire aria-expanded + aria-controls onto the live opener (the orb) while open, and
  // clear it on close. The orb is a plain <button> in a server-rendered header, so we
  // reflect its expanded state imperatively rather than prop-drilling across the store.
  useEffect(() => {
    const orb = getInlineVoiceOpener();
    if (!orb) return;
    if (open) {
      orb.setAttribute("aria-expanded", "true");
      orb.setAttribute("aria-controls", PANEL_ID);
    } else {
      orb.setAttribute("aria-expanded", "false");
      orb.removeAttribute("aria-controls");
    }
  }, [open]);

  // Move focus into the panel on open (first focusable control).
  useEffect(() => {
    if (!open) return;
    const primary = panelRef.current?.querySelector<HTMLButtonElement>('button[type="button"]');
    primary?.focus();
  }, [open]);

  // Outside-pointerdown closes — but ignore clicks on the orb (its onClick re-toggles),
  // and ignore clicks inside the panel. pointerdown (not click) so a drag that starts
  // inside doesn't accidentally dismiss.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return; // inside the panel
      const orb = getInlineVoiceOpener();
      if (orb && (orb === target || orb.contains(target))) return; // the orb itself
      close();
    };
    // Capture phase so it runs before React onClick handlers elsewhere.
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, close]);

  if (!open) return null;

  return (
    <motion.div
      ref={panelRef}
      id={PANEL_ID}
      role="region"
      aria-label="Anvil voice"
      // Genie entrance: scale + lift + fade from the orb's corner (transform-origin
      // top-right). Compositor-only props (transform/opacity) — never width/height/top.
      // MotionConfig reducedMotion="user" (app-wide) drops the scale/translate for
      // reduced-motion users, leaving the opacity fade.
      initial={{ opacity: 0, scale: 0.6, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 460, damping: 34, mass: 0.7 }}
      // Directly below the orb (like Siri — attached to the trigger, not floating apart).
      style={{
        transformOrigin: "top right",
        top: pos?.top ?? 64,
        right: pos?.right ?? 16,
      }}
      className="fixed z-50 w-[min(85vw,18rem)] overflow-hidden rounded-xl border border-border-strong bg-bg-surface shadow-xl"
    >
      {/* autoStart: the orb click that opened this panel IS the user gesture, so the mic
          opens immediately (Siri "tap = talk"). Safe now that the P2 one-mic mutex
          guarantees no other surface is concurrently listening. */}
      <TalkMode onClose={close} autoStart />
    </motion.div>
  );
}
