"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TRACE_DELIMITER,
  THINKING_SENTINEL,
  THINKING_END,
} from "@/lib/llm-trace";

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
  mediaType:
    "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";
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
function splitTrace(acc: string): {
  text: string;
  trace?: { model: string; fellBack: boolean };
} {
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

/** Fields derived from the accumulated stream buffer, before merging with previous state. */
type ParsedAccumulation = {
  liveReasoning?: string;
  isThinking?: boolean;
  text: string;
  trace?: { model: string; fellBack: boolean };
};

/**
 * Parse the whole accumulated buffer into the assistant-message fields.
 *
 * Protocol: [THINKING_SENTINEL][reasoning][THINKING_END][answer][TRACE_DELIMITER][JSON]
 *
 * Extracted from the read loop so the frame-coalesced flush and the final trailing flush
 * run byte-identical logic — previously this lived inline and could only ever be exercised
 * on the per-chunk path.
 */
function parseAccumulated(acc: string): ParsedAccumulation {
  if (!acc.startsWith(THINKING_SENTINEL)) {
    const { text, trace } = splitTrace(acc);
    return { text, trace };
  }

  const afterSentinel = acc.slice(THINKING_SENTINEL.length);
  const endIdx = afterSentinel.indexOf(THINKING_END);

  if (endIdx === -1) {
    // THINKING_END not yet arrived: still reasoning, nothing to show as answer text.
    return { liveReasoning: afterSentinel, isThinking: true, text: "" };
  }

  const { text, trace } = splitTrace(
    afterSentinel.slice(endIdx + THINKING_END.length),
  );
  return {
    liveReasoning: afterSentinel.slice(0, endIdx),
    isThinking: false,
    text,
    trace,
  };
}

/**
 * How long to wait before force-flushing when requestAnimationFrame never fires.
 * Browsers pause rAF in hidden/background tabs, so a stream that completes while
 * backgrounded would otherwise never paint. Coarse on purpose — it only ever runs when
 * rAF is unavailable, and 250ms is imperceptible on return to the tab.
 */
const BACKGROUND_FLUSH_MS = 250;

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

  // --- Streaming write coalescing -------------------------------------------------------
  // The read loop used to call setMessages once per network chunk. React's automatic
  // batching does NOT help here: chunks arrive on separate macrotasks, so each one produced
  // its own render, and every render re-parsed the entire accumulated message as markdown
  // downstream. Cost therefore grew with message length (verified: 60 macrotask-spaced
  // writes => 60 flushes, vs 1 for a synchronous burst).
  //
  // Now the loop only records the latest buffer and asks for a flush; at most one commit
  // happens per animation frame, so render count is bounded by frame rate rather than by
  // chunk count. The display cannot update faster than a frame anyway, so nothing visible
  // is lost.
  const pendingRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Thinking-phase timing is captured from BYTE ARRIVAL in the read loop, not derived from
  // render-to-render deltas. The previous approach diffed timestamps across two renders (the
  // first with isThinking=true, the later one with false) — which coalescing breaks, because
  // a short thinking phase can collapse into a single frame so the intermediate render never
  // happens and the duration silently becomes undefined. Anchoring to arrival makes the
  // measurement independent of paint cadence, and is more accurate: it times actual thinking
  // rather than render latency.
  const thinkingStartRef = useRef<number | null>(null);
  const thinkingEndRef = useRef<number | null>(null);

  /** Apply an accumulated buffer to the message list. */
  const commit = useCallback((acc: string) => {
    const { liveReasoning, isThinking, text, trace } = parseAccumulated(acc);
    const startedAt = thinkingStartRef.current;
    const endedAt = thinkingEndRef.current;
    // While thinking, expose the start so the UI can run its live elapsed timer. Once the
    // phase has settled, report the arrival-to-arrival duration (floored at 0 — a sub-second
    // thinking phase is a legitimate 0s, not a missing value).
    const newStartedAt =
      isThinking === true && startedAt !== null ? startedAt : undefined;
    const newDuration =
      startedAt !== null && endedAt !== null
        ? Math.max(0, Math.round((endedAt - startedAt) / 1000))
        : undefined;
    setMessages((prev) => {
      return [
        ...prev.slice(0, -1),
        {
          role: "assistant" as const,
          content: text,
          model: trace?.model,
          fellBack: trace?.fellBack,
          reasoning:
            (trace as { reasoning?: string } | undefined)?.reasoning ??
            liveReasoning,
          liveReasoning,
          isThinking,
          thinkingStartedAt: newStartedAt,
          thinkingDuration: newDuration,
        },
      ];
    });
  }, []);

  /**
   * Commit whatever is pending and clear both schedulers.
   * `pendingRef` is a single-consumption token: whichever of rAF / the safety timer runs
   * first takes the buffer and nulls it, so the loser is a no-op instead of a double render.
   */
  const flushPending = useCallback(() => {
    const acc = pendingRef.current;
    pendingRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (safetyRef.current !== null) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
    if (acc !== null) commit(acc);
  }, [commit]);

  /** Record the latest buffer; schedule a flush if one isn't already pending. */
  const scheduleFlush = useCallback(
    (acc: string) => {
      pendingRef.current = acc;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushPending);
      }
      if (safetyRef.current === null) {
        safetyRef.current = setTimeout(flushPending, BACKGROUND_FLUSH_MS);
      }
    },
    [flushPending],
  );

  /** Commit immediately, bypassing the frame wait. Used when the stream ends or aborts. */
  const flushNow = useCallback(
    (acc: string) => {
      pendingRef.current = acc;
      flushPending();
    },
    [flushPending],
  );

  // Never leave a frame or timer behind on unmount (e.g. the widget closing mid-stream).
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (safetyRef.current !== null) clearTimeout(safetyRef.current);
    },
    [],
  );

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
      const userMsg: ChatMessage = {
        role: "user" as const,
        content: q,
        attachments: files,
      };
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
          return {
            type: "image",
            source: { type: "base64", media_type: f.mediaType, data: f.data },
          };
        });
        if (m.content) blocks.push({ type: "text", text: m.content });
        return { role: "user", content: blocks };
      });

      // Reset per-request state: arrival clocks for the thinking phase, and any buffer left
      // pending from a previous stream (so a new answer can never inherit stale bytes).
      thinkingStartRef.current = null;
      thinkingEndRef.current = null;
      pendingRef.current = null;

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
          setMessages((m) => [
            ...m.slice(0, -1),
            { role: "assistant", content: msg },
          ]);
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

          // Stamp the thinking phase from ARRIVAL, not from render cadence. Both are
          // latched once (monotonic buffer => these transitions happen at most once).
          if (thinkingStartRef.current === null && acc.startsWith(THINKING_SENTINEL)) {
            thinkingStartRef.current = Date.now();
          }
          if (
            thinkingEndRef.current === null &&
            thinkingStartRef.current !== null &&
            acc.includes(THINKING_END)
          ) {
            thinkingEndRef.current = Date.now();
          }

          // Record only. The frame scheduler decides when to paint, so a burst of chunks
          // inside one frame costs one render instead of one render each.
          scheduleFlush(acc);
        }
        // Trailing flush is mandatory, not an optimisation: the stream can close between
        // frames, so anything that arrived after the last frame would never be committed.
        flushNow(acc);
        setStatus("idle");
      } catch (err) {
        // Commit whatever was still waiting on a frame before touching the message list.
        // Without this, an abort (or network error) mid-flight would append to a STALE
        // buffer and silently discard the last coalesced chunk of the partial answer.
        flushPending();
        // Abort is a user action, not an error — keep what streamed, but mark it
        // stopped so a half-finished answer isn't mistaken for a complete one.
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((m) => {
            const last = m[m.length - 1];
            if (!last || last.role !== "assistant") return m;
            const stopped = last.content
              ? `${last.content} …[stopped]`
              : "[stopped]";
            return [...m.slice(0, -1), { role: "assistant", content: stopped }];
          });
          setStatus("idle");
          return;
        }
        setMessages((m) => [
          ...m.slice(0, -1),
          { role: "assistant", content: "Network error — please try again." },
        ]);
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [messages, status, scheduleFlush, flushNow, flushPending],
  );

  const reset = useCallback(() => {
    stop();
    setMessages((prev) => {
      // Revoke any object URLs created for attachment previews to avoid memory leaks
      prev.forEach((m) =>
        m.attachments?.forEach((f) => URL.revokeObjectURL(f.previewUrl)),
      );
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
