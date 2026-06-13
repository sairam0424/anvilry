"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Terminal } from "./terminal";

/**
 * Fullscreen "beast mode" wrapper for the terminal. Radix Dialog gives us a focus
 * trap, Esc-to-close, and focus restoration to the trigger for free (WCAG 2.4.3) —
 * a CSS-only fixed overlay can't. The visually-hidden Title/Description satisfy the
 * "DialogContent requires DialogTitle" a11y contract (same pattern as the ⌘K palette).
 *
 * Note: the overlay renders its OWN <Terminal> — a fresh session, not the inline
 * terminal's scrollback. Acceptable for v1; lifting state up is a future-only concern.
 */
export function TerminalOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg-base/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,56rem)] -translate-x-1/2 -translate-y-1/2 focus:outline-none">
          <Dialog.Title className="sr-only">Developer mode terminal</Dialog.Title>
          <Dialog.Description className="sr-only">
            A command-line interface to explore Sairam&apos;s work. Type &apos;help&apos; for commands, or press Escape to close.
          </Dialog.Description>
          <div className="relative">
            <Dialog.Close
              className="absolute -right-2 -top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-strong bg-bg-elevated text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close terminal"
            >
              <X size={14} aria-hidden="true" />
            </Dialog.Close>
            <Terminal maxHeightClass="max-h-[70vh]" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
