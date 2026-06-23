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
 * Fullscreen image lightbox — click a thumbnail to expand, click backdrop or press
 * Escape to dismiss. Uses a fixed overlay so it escapes the scroll container.
 * Fade-in transition matches the site's dark aesthetic.
 */
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Full size: ${alt}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image unsupported */}
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        ✕
      </button>
    </div>
  );
}

/** Renders Claude's extended thinking — animated + live reasoning while streaming,
 *  expandable collapsed toggle once the reasoning phase is complete. */
function ThinkingBlock({
  isThinking,
  liveReasoning,
  isStreaming,
}: {
  isThinking?: boolean;
  liveReasoning?: string;
  isStreaming: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const liveEndRef = useRef<HTMLPreElement>(null);
  const enabled = process.env.NEXT_PUBLIC_EXTENDED_THINKING !== "false";

  // useEffect MUST come before any early return — Rules of Hooks.
  useEffect(() => {
    if (!enabled || !isThinking || !liveEndRef.current) return;
    liveEndRef.current.scrollTop = liveEndRef.current.scrollHeight;
  }, [enabled, isThinking, liveReasoning]);

  if (!enabled) return null;

  // Phase 1 — thinking in progress: animated dots + live reasoning text below.
  if (isThinking && isStreaming) {
    return (
      <div className="mb-2 max-w-[88%] rounded-2xl border border-border bg-bg-surface px-4 py-2.5 text-sm text-fg-subtle">
        <div className="flex items-center gap-2">
          <span className="inline-flex gap-1" aria-label="Thinking">
            <span className="animate-pulse">·</span>
            <span className="animate-pulse [animation-delay:150ms]">·</span>
            <span className="animate-pulse [animation-delay:300ms]">·</span>
          </span>
          <span>Thinking…</span>
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

  // Phase 2 — thinking done: show collapsed toggle with the full liveReasoning.
  // This renders whether streaming is ongoing (answer phase) or complete.
  if (!liveReasoning) return null;
  const wordCount = liveReasoning.trim().split(/\s+/).length;

  return (
    <div className="mb-2 max-w-[88%]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[11px] text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-expanded={open}
      >
        <span>{open ? "▾" : "▶"}</span>
        <span>Show reasoning ({wordCount} words)</span>
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

  // Lightbox state — null when closed, { src, alt } when open.
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const openLightbox = useCallback((src: string, alt: string) => setLightbox({ src, alt }), []);
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
    {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={closeLightbox} />}
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
                    {/* Attachment previews — images show as thumbnails, PDFs as filename badges */}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {m.attachments.map((f, fi) =>
                          f.mediaType !== "application/pdf" ? (
                            <button
                              key={fi}
                              type="button"
                              onClick={() => openLightbox(f.previewUrl, f.name)}
                              aria-label={`View full size: ${f.name}`}
                              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL */}
                              <img
                                src={f.previewUrl}
                                alt={f.name}
                                className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                              />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 group-hover:bg-black/30 group-hover:opacity-100">
                                <span className="text-white text-xs font-medium">View</span>
                              </span>
                            </button>
                          ) : (
                            <div
                              key={fi}
                              className="flex items-center gap-1.5 rounded-xl bg-accent/80 px-3 py-2 text-xs text-bg-base"
                            >
                              <span aria-hidden="true">📄</span>
                              <span className="max-w-[120px] truncate">{f.name}</span>
                            </div>
                          )
                        )}
                      </div>
                    )}
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
                  />
                ) : null}
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
