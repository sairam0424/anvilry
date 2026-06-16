"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { TalkMode } from "@/components/chat/talk-mode";

/**
 * Modal wrapper for talk mode — the DEFAULT surface (talkSurface "modal"). Radix
 * Dialog gives the focus trap + Esc-to-close for free, mirroring TerminalOverlay.
 *
 * Focus restoration (WCAG 2.4.3): this is a CONTROLLED dialog opened by an external
 * button, so Radix doesn't know the trigger and would drop focus to <body> on close.
 * We restore it ourselves via onCloseAutoFocus + triggerRef, the same pattern the
 * terminal overlay uses. The visually-hidden Title/Description satisfy the
 * "DialogContent requires DialogTitle" a11y contract.
 *
 * TalkMode handles its own Esc (turn-toggle vs close) and tears the voice session
 * down on End/close, so closing the dialog always stops the mic + speech.
 */
export function TalkModeOverlay({
  open,
  onOpenChange,
  getOpener,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Returns the element to restore focus to on close (the opener varies by entry point). */
  getOpener?: () => HTMLElement | null;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg-base/85 backdrop-blur-sm" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            // Land focus on the primary (mic/start) control rather than the dialog
            // container, so a keyboard user can start talking immediately (WCAG 2.4.3).
            const content = e.currentTarget as HTMLElement | null;
            const primary = content?.querySelector<HTMLButtonElement>('button[type="button"]');
            if (primary) {
              e.preventDefault();
              primary.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            const opener = getOpener?.();
            if (opener) {
              e.preventDefault();
              opener.focus();
            }
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 focus:outline-none"
        >
          {/* "Bloom open" entrance — the panel scales + fades up, reading as the header
              orb expanding (a single in-portal Motion element; NOT a cross-portal layout
              morph, which would churn the WebGL context). MotionConfig reducedMotion="user"
              auto-drops the scale/translate for reduced-motion users, leaving the opacity
              fade — the documented safe fallback. No WebGL touched here. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.82, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.7 }}
            className="rounded-2xl border border-border-strong bg-bg-surface shadow-2xl"
          >
            <Dialog.Title className="sr-only">Voice conversation</Dialog.Title>
            <Dialog.Description className="sr-only">
              Talk with the portfolio assistant. Press Space to talk, Escape to close. A
              live transcript is shown, and you can always type instead.
            </Dialog.Description>
            <TalkMode onClose={() => onOpenChange(false)} />
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
