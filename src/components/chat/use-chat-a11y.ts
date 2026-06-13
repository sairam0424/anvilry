"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/components/chat/use-chat";

/**
 * ANNOUNCE-ON-SETTLE for the streaming transcript, kept out of the render component:
 * a single aria-live="polite" string — "Answering…" while streaming, then the FINAL
 * answer announced ONCE after the stream settles (debounced ~150ms). Per-token
 * announcements into a live region are themselves an AT failure mode, so we
 * deliberately avoid them. Updates run inside a timer callback (never synchronously in
 * the effect body) — the genuine debounce the feature needs, and it keeps the render
 * loop clean.
 *
 * (Autoscroll used to live here too, as a per-frame distance check; it moved to the
 * shared useAutoScroll engine — intent flag + ResizeObserver — which fixes the de-pin
 * and stale-height bugs this couldn't.)
 */
export function useChatA11y(messages: ChatMessage[], isStreaming: boolean) {
  const [liveMessage, setLiveMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Announce-on-settle (deferred via timer — no synchronous setState-in-effect).
  const last = messages[messages.length - 1];
  const lastText = last?.role === "assistant" ? last.content : "";
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (isStreaming) {
      timer.current = setTimeout(() => setLiveMessage("Answering…"), 0);
    } else if (lastText) {
      timer.current = setTimeout(() => setLiveMessage(lastText), 150);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [isStreaming, lastText]);

  return { liveMessage };
}
