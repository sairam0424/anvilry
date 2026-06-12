"use client";

import { useCallback, useRef, useState } from "react";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

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
          setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc }]);
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
