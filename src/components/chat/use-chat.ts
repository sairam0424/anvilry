"use client";

import { useCallback, useRef, useState } from "react";
import { TRACE_DELIMITER, THINKING_SENTINEL, THINKING_END } from "@/lib/llm-trace";

export type ChatRole = "user" | "assistant";

/**
 * A single file attachment to be sent alongside a user message.
 * Mirrors the Anthropic SDK's base64 source shape so the API route
 * can pass blocks directly to the SDK without translation.
 *
 * For images: `data` is base64-encoded; `pdfText` is undefined.
 * For PDFs: `data` is an empty string (no base64); `pdfText` holds the
 * extracted text from pdf.js — sent as a text block to avoid base64 overhead.
 */
export type FileUIPart = {
  /** Browser-local object URL for preview rendering (URL.createObjectURL). Revoked on cleanup.
   * Empty string for PDFs (no visual thumbnail). */
  previewUrl: string;
  /** For images: base64 encoded data. For PDFs: empty string (text extracted separately). */
  data: string;
  /** For PDFs: extracted text content via pdf.js. Undefined for images. */
  pdfText?: string;
  /** MIME type validated on the client before encoding. */
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";
  /** Original filename for the preview strip label. */
  name: string;
  /** Byte size before encoding — used to enforce the per-file size guard. */
  size: number;
};

/** `model`/`fellBack` come from the server's honest trailing trace frame (which model
 *  served the bytes), parsed out of the stream — never shown as message text. */
export type ChatMessage = {
  role: ChatRole;
  content: string;
  attachments?: FileUIPart[];
  model?: string;
  fellBack?: boolean;
  /** Reasoning text as it streams live (populated while isThinking may still be true).
   *  Set from the bytes between THINKING_SENTINEL and THINKING_END. */
  liveReasoning?: string;
  /** true while THINKING_SENTINEL seen but THINKING_END not yet received.
   *  false once THINKING_END arrives (thinking phase complete). */
  isThinking?: boolean;
  /** Unix ms when THINKING_SENTINEL first arrived — used to compute live elapsed timer. */
  thinkingStartedAt?: number;
  /** How long thinking took in seconds — set when THINKING_END arrives. */
  thinkingDuration?: number;
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
  const [pendingFiles, setPendingFiles] = useState<FileUIPart[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  const send = useCallback(
    async (text: string, files?: FileUIPart[]) => {
      const q = text.trim();
      if ((!q && !files?.length) || status === "streaming") return;

      // Build local message for display (text + attachment previews)
      const userMsg: ChatMessage = { role: "user" as const, content: q, attachments: files };
      const history = [...messages, userMsg];
      setMessages([...history, { role: "assistant", content: "" }]);
      setStatus("streaming");

      // Build the wire payload: multi-modal messages use content-block arrays
      const wireMessages = history.map((m) => {
        if (m.role !== "user" || !m.attachments?.length) {
          return { role: m.role, content: m.content };
        }
        // Multi-modal: attachment blocks first (Anthropic convention), text last
        const blocks: object[] = m.attachments.map((f) => {
          if (f.mediaType === "application/pdf" && f.pdfText) {
            // PDF: send extracted text as a text block — no base64 overhead
            return { type: "text", text: `[PDF: ${f.name}]\n${f.pdfText}` };
          }
          // Image: send as base64 content block
          return { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } };
        });
        if (m.content) blocks.push({ type: "text", text: m.content });
        return { role: "user", content: blocks };
      });

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: wireMessages }),
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
          let thinkingStartedAt: number | undefined;
          let thinkingDuration: number | undefined;

          if (hasSentinel) {
            const afterSentinel = acc.slice(THINKING_SENTINEL.length);
            const endIdx = afterSentinel.indexOf(THINKING_END);
            if (endIdx === -1) {
              // THINKING_END not yet arrived: still in reasoning phase.
              liveReasoning = afterSentinel;
              isThinking = true;
              textRegion = "";
              // Preserve thinkingStartedAt from the previous state update if already set.
              // We read it from the current last message to avoid losing it on each tick.
              thinkingStartedAt = undefined; // will be set below via functional update
            } else {
              // THINKING_END arrived: compute duration from sentinel → end.
              liveReasoning = afterSentinel.slice(0, endIdx);
              isThinking = false;
              textRegion = afterSentinel.slice(endIdx + THINKING_END.length);
              thinkingStartedAt = undefined; // will be read from prev state below
              thinkingDuration = undefined;  // computed below from startedAt
            }
          } else {
            liveReasoning = undefined;
            isThinking = undefined;
            textRegion = acc;
          }

          const { text, trace } = splitTrace(textRegion);
          const now = Date.now();
          setMessages((prev) => {
            const prevLast = prev[prev.length - 1];
            const prevStartedAt = prevLast?.thinkingStartedAt;
            const newStartedAt =
              isThinking === true
                ? (prevStartedAt ?? now)           // first tick sets it; subsequent ticks preserve it
                : undefined;
            const newDuration =
              isThinking === false && prevStartedAt
                ? Math.round((now - prevStartedAt) / 1000)
                : prevLast?.thinkingDuration;      // preserve settled duration across answer streaming

            return [
            ...prev.slice(0, -1),
            {
              role: "assistant" as const,
              content: text,
              model: (trace as { model?: string } | undefined)?.model,
              fellBack: (trace as { fellBack?: boolean } | undefined)?.fellBack,
              reasoning: (trace as { reasoning?: string } | undefined)?.reasoning ?? liveReasoning,
              liveReasoning,
              isThinking,
              thinkingStartedAt: newStartedAt,
              thinkingDuration: newDuration,
            },
          ]});
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
    setMessages((prev) => {
      // Revoke any object URLs created for attachment previews to avoid memory leaks
      prev.forEach((m) => m.attachments?.forEach((f) => URL.revokeObjectURL(f.previewUrl)));
      return [];
    });
    setPendingFiles([]);
    setStatus("idle");
  }, [stop]);

  return {
    messages,
    status,
    send,
    stop,
    reset,
    isStreaming: status === "streaming",
    pendingFiles,
    setPendingFiles,
  };
}
