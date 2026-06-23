"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ChatMessage } from "@/components/chat/use-chat";
import { parseCards } from "@/components/chat/parse-cards";
import { ChatCard } from "@/components/chat/chat-card";
import { ReadAloudButton } from "@/components/chat/read-aloud-button";
import { useChatA11y } from "@/components/chat/use-chat-a11y";
import { useSpeechSynthesis } from "@/components/chat/use-speech-synthesis";
import { useVoiceSettings } from "@/lib/voice-settings-context";
import { useAutoScroll } from "@/lib/scroll/use-auto-scroll";
import { JumpToLatest } from "@/components/scroll/jump-to-latest";
import { useView } from "@/components/view-context";
import { highlightProject } from "@/lib/highlight-store";
import { unlock } from "@/lib/discovery-store";
import { SkeletonMarkdownLine } from "@/components/ui/skeleton";

/**
 * Fullscreen image lightbox — inspired by gptme, VS Code Copilot Chat, and ChatGPT patterns:
 * - Filename header (accessible DialogTitle equivalent) + "Open original" link (gptme pattern)
 * - Backdrop blur overlay, click-outside to dismiss (universal pattern)
 * - Escape key + arrow keys for multi-image navigation
 * - Download button in header (VS Code Copilot / Slack-inspired hover affordance)
 */
function ImageLightbox({
  images,
  startIndex,
  onClose,
}: {
  images: { src: string; name: string }[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = React.useState(startIndex);
  const current = images[idx];
  const hasPrev = idx > 0;
  const hasNext = idx < images.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) setIdx((i) => i - 1);
      if (e.key === "ArrowRight" && hasNext) setIdx((i) => i + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, hasPrev, hasNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={current?.name ?? "Image viewer"}
    >
      {/* Header — filename + open original + download + close (gptme + Copilot pattern) */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="max-w-[60%] truncate text-sm font-medium text-white/90">
          {current?.name}
        </span>
        <div className="flex items-center gap-2">
          {/* "Open original" link — gptme pattern, opens blob URL in new tab */}
          <a
            href={current?.src}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Open original ↗
          </a>
          {/* Download button — VS Code Copilot / Slack pattern */}
          <a
            href={current?.src}
            download={current?.name}
            className="rounded-lg px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={(e) => e.stopPropagation()}
          >
            ↓ Download
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Image + prev/next arrows */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL */}
        <img
          src={current?.src}
          alt={current?.name}
          className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => i - 1); }}
            aria-label="Previous image"
            className="absolute left-3 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            ‹
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => i + 1); }}
            aria-label="Next image"
            className="absolute right-3 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            ›
          </button>
        )}
      </div>

      {/* Image counter for multi-image */}
      {images.length > 1 && (
        <div className="shrink-0 pb-3 text-center text-xs text-white/40">
          {idx + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

/** Renders Claude's extended thinking.
 *
 * Phase 1 (thinking): "Thinking… 12s" live timer + scrolling reasoning text.
 * Phase 2 (settled):  "Thought for 12s (ctrl+o to expand)" — matches Claude Code pattern.
 *                     Click or ctrl+o to toggle the full reasoning.
 */
function ThinkingBlock({
  isThinking,
  liveReasoning,
  isStreaming,
  thinkingStartedAt,
  thinkingDuration,
}: {
  isThinking?: boolean;
  liveReasoning?: string;
  isStreaming: boolean;
  thinkingStartedAt?: number;
  thinkingDuration?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const liveEndRef = useRef<HTMLPreElement>(null);
  const enabled = process.env.NEXT_PUBLIC_EXTENDED_THINKING !== "false";

  // Live elapsed timer — ticks every second while thinking is in progress.
  // Initial value stays 0; first tick fires at ~1s which is accurate enough.
  useEffect(() => {
    if (!isThinking || !thinkingStartedAt) return;
    const id = setInterval(() => {
      setElapsed(Math.round((Date.now() - thinkingStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isThinking, thinkingStartedAt]);

  // Auto-scroll live reasoning to bottom as it streams in.
  useEffect(() => {
    if (!enabled || !isThinking || !liveEndRef.current) return;
    liveEndRef.current.scrollTop = liveEndRef.current.scrollHeight;
  }, [enabled, isThinking, liveReasoning]);

  // Ctrl+O keyboard shortcut — toggles the reasoning panel when settled.
  useEffect(() => {
    if (!liveReasoning || isThinking) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [liveReasoning, isThinking]);

  if (!enabled) return null;

  // Phase 1 — thinking in progress: "Thinking… 12s" + live scrolling reasoning.
  if (isThinking && isStreaming) {
    return (
      <div className="mb-2 max-w-[88%] rounded-2xl border border-border bg-bg-surface px-4 py-2.5 text-sm text-fg-subtle">
        <div className="flex items-center gap-2">
          <span className="inline-flex gap-1" aria-label="Thinking">
            <span className="animate-pulse">·</span>
            <span className="animate-pulse [animation-delay:150ms]">·</span>
            <span className="animate-pulse [animation-delay:300ms]">·</span>
          </span>
          <span>
            Thinking…{" "}
            {elapsed > 0 && <strong className="font-semibold text-fg-muted">{elapsed}s</strong>}
          </span>
        </div>
        {liveReasoning && (
          <pre
            ref={liveEndRef}
            className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap border-l-2 border-accent/30 pl-3 font-mono text-xs text-fg-subtle"
            aria-live="polite"
            aria-label="Claude's live reasoning"
          >
            {liveReasoning}
          </pre>
        )}
      </div>
    );
  }

  // Phase 2 — settled: "Thought for Xs (ctrl+o to expand)" — Claude Code pattern.
  if (!liveReasoning) return null;
  const duration = thinkingDuration ?? elapsed;

  return (
    <div className="mb-2 max-w-[88%]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] text-fg-subtle/70 transition-colors hover:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-expanded={open}
        title={open ? "Collapse reasoning (ctrl+o)" : "Expand reasoning (ctrl+o)"}
      >
        <span className="text-fg-subtle/40">{open ? "▾" : "▶"}</span>
        <span>
          Thought for{" "}
          <strong className="font-semibold text-fg-muted">{duration > 0 ? `${duration}s` : "a moment"}</strong>
          {!open && <span className="ml-1.5 text-fg-subtle/40">(ctrl+o to expand)</span>}
        </span>
      </button>
      {open && (
        <pre className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap border-l-2 border-accent/30 pl-3 font-mono text-xs text-fg-subtle">
          {liveReasoning}
        </pre>
      )}
    </div>
  );
}

/** Map a Bedrock/Anthropic model id to a readable name for the badge. */
function friendlyModel(id: string): string {
  const m = id.toLowerCase();
  if (m.includes("opus")) return "Claude Opus";
  if (m.includes("sonnet")) return "Claude Sonnet";
  if (m.includes("haiku")) return "Claude Haiku";
  return "Claude";
}

// Lazy-loaded so the ~46KB react-markdown tree stays OUT of the initial route
// bundle — the chat is interaction-gated, so it only loads when a view/widget opens.
const MarkdownMessage = dynamic(
  () => import("@/components/chat/markdown-message").then((m) => m.MarkdownMessage),
  { ssr: false, loading: () => <SkeletonMarkdownLine /> },
);

/**
 * Renders the conversation. Assistant text is rendered as React TEXT NODES (never
 * dangerouslySetInnerHTML) so model output can't inject markup. Generative cards
 * are resolved from a slug allowlist (parse-cards.ts) against real Velite content,
 * not parsed from model HTML — so a card can't show fabricated data and its href is
 * server-sourced.
 *
 * Autoscroll comes from the shared useAutoScroll engine (intent flag + ResizeObserver):
 * scrollRef on the overflow container, contentRef on the inner wrapper that GROWS (so
 * the observer catches the late dynamic-markdown paint), anchorRef on the newest user
 * message (message-top mode), and a JumpToLatest resume control (WCAG 2.2.2). The
 * announce-on-settle aria-live region stays in useChatA11y.
 */
export function ChatMessages({
  messages,
  isStreaming,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
}) {
  const { setView } = useView();

  // Lightbox state — null when closed, images array + start index when open.
  const [lightbox, setLightbox] = useState<{ images: { src: string; name: string }[]; startIndex: number } | null>(null);
  const openLightbox = useCallback((images: { src: string; name: string }[], startIndex: number) => setLightbox({ images, startIndex }), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  // Dispatch cmd-view and cmd-highlight tokens from completed (non-streaming) assistant
  // messages. We track which message indices have been dispatched so cmd tokens only
  // fire once per message, not on every re-render. Kept in a ref (not state) so the
  // dispatch doesn't trigger another render.
  const dispatchedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    // Discovery: unlock "chat-question" when the user has sent at least 1 message.
    if (messages.some((m) => m.role === "user" && m.content.trim())) {
      unlock("chat-question");
    }
    if (isStreaming) return; // Only dispatch cmd tokens from settled messages.
    messages.forEach((m, i) => {
      if (m.role !== "assistant" || dispatchedRef.current.has(i)) return;
      const segments = parseCards(m.content);
      for (const seg of segments) {
        if (seg.type === "cmd-view") setView(seg.view);
        if (seg.type === "cmd-highlight") highlightProject(seg.slug);
      }
      dispatchedRef.current.add(i);
    });
  }, [messages, isStreaming, setView]);

  // Single TTS engine for the whole transcript (speechSynthesis is a singleton).
  // `speakingIdx` tracks WHICH message is being read aloud so only its button shows
  // the active state and the answer's live-region announcement is suppressed (no
  // double-speak). Gated by the opt-in ttsEnabled pref + runtime support.
  const { settings } = useVoiceSettings();
  const tts = useSpeechSynthesis({
    engine: settings.ttsEngine,
    voiceId: settings.voiceId,
    character: settings.voiceCharacter,
  });
  const ttsAvailable = settings.ttsEnabled && tts.supported;
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  // When the engine stops on its own (answer finished), clear the active index.
  const activeIdx = tts.isSpeaking ? speakingIdx : null;

  const toggleRead = useCallback(
    (idx: number, text: string) => {
      if (activeIdx === idx) {
        tts.cancel();
        setSpeakingIdx(null);
        return;
      }
      setSpeakingIdx(idx);
      tts.speak(text);
    },
    [activeIdx, tts],
  );

  // Suppress the full-text announce-on-settle while TTS is reading the latest answer.
  const { liveMessage } = useChatA11y(messages, isStreaming, activeIdx !== null);
  const { scrollRef, contentRef, anchorRef, isAtBottom, scrollToBottom } = useAutoScroll({
    threshold: 120,
    surface: "chat",
  });

  // Keep our own handle on the scroll container so the jump button can return focus
  // there (the engine's scrollRef is a callback ref we don't own the node of).
  const scrollNode = useRef<HTMLDivElement | null>(null);
  const setScroll = useCallback(
    (node: HTMLDivElement | null) => {
      scrollNode.current = node;
      scrollRef(node);
    },
    [scrollRef],
  );

  // A single polite live region: announces "Answering…" then the settled answer
  // once. Always present (even when empty) so the region is registered with AT.
  const liveRegion = (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {liveMessage}
    </div>
  );

  if (messages.length === 0) return <div className="flex-1">{liveRegion}</div>;

  // Index of the newest user message — anchored to the viewport top in message-top mode.
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  const onJump = () => {
    scrollToBottom();
    // Return focus to the transcript so keyboard users land where they jumped (the
    // container is tabIndex=-1 so it's focusable but not in the tab order).
    scrollNode.current?.focus();
  };

  return (
    // relative wrapper anchors the floating JumpToLatest; min-h-0 lets the inner
    // scroll child shrink below content so overflow-y-auto engages (see chat-view).
    <>
    {lightbox && <ImageLightbox images={lightbox.images} startIndex={lightbox.startIndex} onClose={closeLightbox} />}
    <div className="relative mt-6 flex min-h-0 flex-1 flex-col">
      <div
        ref={setScroll}
        // [overflow-anchor:none] stops the browser's scroll-anchoring from fighting
        // the JS pin (defensive; Safari 27).
        aria-live="polite"
        aria-atomic="false"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto outline-none [overflow-anchor:none]"
        tabIndex={-1}
      >
        {liveRegion}
        {/* contentRef wrapper: the ResizeObserver target that grows as messages/markdown
            mount, so the late dynamic-markdown paint triggers the follow snap. */}
        <div ref={contentRef} className="space-y-4">
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            if (m.role === "user") {
              return (
                <div
                  key={i}
                  ref={i === lastUserIdx ? anchorRef : undefined}
                  className="flex justify-end scroll-mt-3"
                >
                  <div className="flex max-w-[88%] flex-col items-end gap-1.5">
                    {/* Attachment previews — mosaic grid for images (xopc/Telegram pattern),
                        filename badge for PDFs, hover-download (VS Code Copilot / Slack pattern) */}
                    {m.attachments && m.attachments.length > 0 && (() => {
                      const images = m.attachments!.filter((f) => f.mediaType !== "application/pdf");
                      const pdfs = m.attachments!.filter((f) => f.mediaType === "application/pdf");
                      const lightboxImages = images.map((f) => ({ src: f.previewUrl, name: f.name }));
                      const count = images.length;
                      // Mosaic grid classes — 1: single large, 2: side by side, 3: first spans 2 rows + 2 stacked, 3+: 2-col grid
                      const gridClass =
                        count === 1 ? "flex" :
                        count === 2 ? "grid grid-cols-2 gap-1.5" :
                        count === 3 ? "grid grid-cols-2 grid-rows-2 gap-1.5 h-44" :
                        "grid grid-cols-2 gap-1.5";
                      return (
                        <div className="flex flex-col items-end gap-1.5">
                          {images.length > 0 && (
                            <div className={gridClass}>
                              {images.map((f, fi) => (
                                <button
                                  key={fi}
                                  type="button"
                                  onClick={() => openLightbox(lightboxImages, fi)}
                                  aria-label={`View full size: ${f.name}`}
                                  className={[
                                    "group relative overflow-hidden rounded-xl border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                    count === 1 ? "h-40 w-40" :
                                    count === 3 && fi === 0 ? "row-span-2 h-full min-h-0" :
                                    "h-20 w-20",
                                  ].join(" ")}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL */}
                                  <img
                                    src={f.previewUrl}
                                    alt={f.name}
                                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                  />
                                  {/* Hover overlay — view label (download in lightbox header via "↓ Download" button) */}
                                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/40 group-hover:opacity-100">
                                    <span className="text-white text-[11px] font-medium">View</span>
                                    {/* TODO: uncomment to re-enable "↓ Save" on hover (Slack/Copilot pattern)
                                    <a
                                      href={f.previewUrl}
                                      download={f.name}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-white/70 text-[10px] hover:text-white"
                                      aria-label={`Download ${f.name}`}
                                    >
                                      ↓ Save
                                    </a>
                                    */}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                          {pdfs.map((f, fi) => (
                            <div
                              key={fi}
                              className="flex items-center gap-1.5 rounded-xl bg-accent/80 px-3 py-2 text-xs text-bg-base"
                            >
                              <span aria-hidden="true">📄</span>
                              <span className="max-w-[120px] truncate">{f.name}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <div className="whitespace-pre-wrap rounded-2xl bg-accent px-4 py-2.5 text-sm leading-relaxed text-bg-base">
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            }
            // Assistant: split into text + resolved cards. Cards render full-width below text.
            const segments = parseCards(m.content);
            const showBadge = !!m.model && (!isStreaming || !isLast);
            // Plain prose for TTS = the text segments only (card tokens never spoken).
            // Read-aloud is offered once an answer is complete (not mid-stream).
            const spokenText = segments
              .filter((s): s is { type: "text"; text: string } => s.type === "text")
              .map((s) => s.text)
              .join(" ")
              .trim();
            const canRead = ttsAvailable && !!spokenText && (!isStreaming || !isLast);
            return (
              <div key={i} className="flex flex-col items-start gap-2">
                {/* ThinkingBlock: visible in all three states:
                    (a) isThinking=true, isStreaming=true  → dots + live reasoning
                    (b) isThinking=false, liveReasoning set, isStreaming=true  → collapsed toggle above streaming answer
                    (c) isThinking=false, liveReasoning set, isStreaming=false → collapsed toggle above settled answer */}
                {m.liveReasoning !== undefined || m.isThinking ? (
                  <ThinkingBlock
                    isThinking={m.isThinking}
                    liveReasoning={m.liveReasoning}
                    isStreaming={isStreaming && isLast}
                    thinkingStartedAt={m.thinkingStartedAt}
                    thinkingDuration={m.thinkingDuration}
                  />
                ) : null}
                {/* Pre-flight waiting indicator — shown when streaming has started but no bytes
                    have arrived yet (content="", no thinking sentinel, no segments).
                    This covers: (a) PDF extraction delay before send(), (b) network latency
                    before the first byte, (c) any gap between send and THINKING_SENTINEL.
                    Collapses immediately once any content, thinking, or reasoning appears. */}
                {isStreaming && isLast && !m.isThinking && m.liveReasoning === undefined && !m.content && (
                  <div className="flex max-w-[88%] items-center gap-2 rounded-2xl border border-border bg-bg-surface px-4 py-2.5 text-sm text-fg-subtle">
                    <span className="inline-flex gap-1" aria-label="Waiting for response">
                      <span className="animate-pulse">·</span>
                      <span className="animate-pulse [animation-delay:200ms]">·</span>
                      <span className="animate-pulse [animation-delay:400ms]">·</span>
                    </span>
                    <span>Waiting…</span>
                  </div>
                )}
                {/* Answer segments — hidden while still in thinking phase (no content yet) */}
                {!(m.isThinking && isStreaming && isLast) &&
                  segments.map((seg, j) =>
                    seg.type === "text" ? (
                      seg.text.trim() ? (
                        <div
                          key={j}
                          className="max-w-[88%] rounded-2xl border border-border bg-bg-surface px-4 py-2.5 text-sm leading-relaxed text-fg"
                        >
                          <MarkdownMessage text={seg.text} />
                        </div>
                      ) : null
                    ) : seg.type === "project" || seg.type === "work" ? (
                      <div key={j} className="w-full max-w-md">
                        <ChatCard segment={seg} />
                      </div>
                    ) : null /* cmd-view and cmd-highlight are side-effect-only; no DOM */,
                  )}
                {/* Answer footer: the honest model badge + the optional read-aloud
                    toggle. The badge shows which model served the bytes (and if the
                    Opus→Sonnet→Haiku fallback fired) — NOT a RAG citation. Read-aloud
                    appears only when TTS is opted in + supported + the answer is done. */}
                {(showBadge || canRead) && (
                  <div className="flex items-center gap-2 px-1">
                    {showBadge && (
                      <p className="font-mono text-[10px] text-fg-subtle">
                        {m.fellBack ? "↳ primary unavailable · " : ""}Answered by{" "}
                        {friendlyModel(m.model!)} · Bedrock
                      </p>
                    )}
                    {canRead && (
                      <ReadAloudButton
                        speaking={activeIdx === i}
                        onToggle={() => toggleRead(i, spokenText)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <JumpToLatest show={!isAtBottom} onClick={onJump} />
    </div>
    </>
  );
}
