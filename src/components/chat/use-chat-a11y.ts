"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { ChatMessage } from "@/components/chat/use-chat";

/**
 * Accessibility behaviors for the streaming transcript, kept out of the render
 * component:
 *
 *  1. PIN-AWARE AUTOSCROLL — only scroll to the newest content when the user is
 *     already near the bottom. If they've scrolled up to re-read, their position is
 *     left alone (the old unconditional smooth-scroll fought SR + low-vision users).
 *
 *  2. ANNOUNCE-ON-SETTLE — a single aria-live="polite" string: "Answering…" while
 *     streaming, then the FINAL answer announced ONCE after the stream settles
 *     (debounced ~150ms). Per-token announcements into a live region are themselves
 *     an AT failure mode, so we deliberately avoid them. Both updates run inside a
 *     timer callback (never synchronously in the effect body) — this is the genuine
 *     debounce the feature needs and also keeps the render loop clean.
 */
export function useChatA11y(
  messages: ChatMessage[],
  isStreaming: boolean,
  scrollRef: RefObject<HTMLElement | null>,
) {
  const [liveMessage, setLiveMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Pin-aware autoscroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) el.scrollTop = el.scrollHeight; // within ~a bubble
    // scrollRef is a stable ref (never changes) so it adds no extra runs; kept in
    // deps to satisfy exhaustive-deps. The audit's "remove it" was a false positive.
  }, [messages, scrollRef]);

  // 2. Announce-on-settle (deferred via timer — no synchronous setState-in-effect).
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
