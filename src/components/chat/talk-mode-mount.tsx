"use client";

import { TalkModeOverlay } from "@/components/chat/talk-mode-overlay";
import {
  useTalkModeOpen,
  setTalkModeOpen,
  getTalkOpener,
} from "@/components/chat/talk-overlay-store";

/**
 * Single global mount for the talk-mode modal, placed once in the layout so EVERY
 * entry point (the Chat-view "Talk" button, the ⌘K "Start voice conversation"
 * command) drives one shared overlay via the module store. Renders nothing until
 * opened. Focus is restored to whichever element opened it (the store remembers it),
 * satisfying WCAG 2.4.3 regardless of entry point.
 */
export function TalkModeMount() {
  const open = useTalkModeOpen();
  return (
    <TalkModeOverlay open={open} onOpenChange={setTalkModeOpen} getOpener={getTalkOpener} />
  );
}
