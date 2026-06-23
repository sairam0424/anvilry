"use client";

import { useCallback, useRef, useState } from "react";
import { TRACE_DELIMITER, THINKING_SENTINEL, THINKING_END } from "@/lib/llm-trace";

export type ChatRole = "user" | "assistant";
/** `model`/`fellBack` come from the server's honest trailing trace frame (which model
 *  served the bytes), parsed out of the stream — never shown as message text. */
export type ChatMessage = {
  role: ChatRole;
  content: string;
  model?: string;
  fellBack?: boolean;
  /** Reasoning text as it streams live (populated while isThinking may still be true).
   *  Set from the bytes between THINKING_SENTINEL and THINKING_END. */
  liveReasoning?: string;
  /** true while THINKING_SENTINEL seen but THINKING_END not yet received.
   *  false once THINKING_END arrives (thinking phase complete). */
  isThinking?: boolean;
};

/** Split a streamed assistant chunk into visible text + an optional parsed trace frame.
 *  The frame (if present) is the LAST record after TRACE_DELIMITER. */
function splitTrace(acc: string): { text: string; trace?: { model: string; fellBack: boolean } } {
  const idx = acc.indexOf(TRACE_DELIMITER);
  if (idx === -1) return { text: acc };
  const text = acc.slice(0, idx);
  const rest = acc.slice(idx + TRACE_DELIMITER.length);
  try {
    return { text, trace: JSON.parse(rest) };
  } catch {
    // Frame not fully arrived yet — show text, hold the trace until it parses.
    return { text };
  }
}

export type ChatStatus = "idle" | "streaming" | "error";

/**
 * Shared chat transport for the "Ask my portfolio" experiences. Owns the message
 * list, the streaming fetch against /api/chat, and (Phase 2.3) abort support. Kept
 * framework-light so both the floating widget and the full concierge view render
 * from one tested transport — no duplicated stream-reading loops.
 *
 * The 503 (chat not configured) and network paths surface as a graceful assistant
 * message rather than a thrown error, matching the existing widget behavior.
 */
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || status === "streaming") return;

      const history = [...messages, { role: "user" as const, content: q }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setStatus("streaming");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const msg =
            res.status === 503
              ? "The chat isn't switched on yet — but you can reach Sairam by email or check the résumé."
              : res.status === 429
                ? "That's a lot of questions! Give it a moment and try again."
                : "Something went wrong. Please try again.";
          setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: msg }]);
          setStatus("error");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });

          // --- New THINKING_SENTINEL + THINKING_END state machine ---
          // Protocol: [THINKING_SENTINEL][reasoning bytes][THINKING_END][answer bytes][TRACE_DELIMITER][JSON]
          const hasSentinel = acc.startsWith(THINKING_SENTINEL);

          let liveReasoning: string | undefined;
          let isThinking: boolean | undefined;
          let textRegion: string; // the part to pass through splitTrace

          if (hasSentinel) {
            const afterSentinel = acc.slice(THINKING_SENTINEL.length);
            const endIdx = afterSentinel.indexOf(THINKING_END);
            if (endIdx === -1) {
              // THINKING_END not yet arrived: still in reasoning phase.
              // Everything after the sentinel is live reasoning.
              liveReasoning = afterSentinel;
              isThinking = true;
              textRegion = ""; // no answer text yet
            } else {
              // THINKING_END arrived: reasoning is the slice before it, answer is after.
              liveReasoning = afterSentinel.slice(0, endIdx);
              isThinking = false;
              textRegion = afterSentinel.slice(endIdx + THINKING_END.length);
            }
          } else {
            // No thinking sentinel — standard path.
            liveReasoning = undefined;
            isThinking = undefined;
            textRegion = acc;
          }

          // Strip the trailing trace frame from the DISPLAYED text; capture the model
          // (honest, server-sourced — which model served the bytes / did it fall back).
          const { text, trace } = splitTrace(textRegion);
          setMessages((m) => [
            ...m.slice(0, -1),
            {
              role: "assistant",
              content: text,
              model: trace?.model,
              fellBack: trace?.fellBack,
              liveReasoning,
              isThinking,
            },
          ]);
        }
        setStatus("idle");
      } catch (err) {
        // Abort is a user action, not an error — keep what streamed, but mark it
        // stopped so a half-finished answer isn't mistaken for a complete one.
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((m) => {
            const last = m[m.length - 1];
            if (!last || last.role !== "assistant") return m;
            const stopped = last.content ? `${last.content} …[stopped]` : "[stopped]";
            return [...m.slice(0, -1), { role: "assistant", content: stopped }];
          });
          setStatus("idle");
          return;
        }
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "Network error — please try again." }]);
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [messages, status],
  );

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setStatus("idle");
  }, [stop]);

  return { messages, status, send, stop, reset, isStreaming: status === "streaming" };
}
