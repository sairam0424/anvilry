"use client";

import { useCallback, useRef, useState } from "react";
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
  { ssr: false, loading: () => null },
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
  // Single TTS engine for the whole transcript (speechSynthesis is a singleton).
  // `speakingIdx` tracks WHICH message is being read aloud so only its button shows
  // the active state and the answer's live-region announcement is suppressed (no
  // double-speak). Gated by the opt-in ttsEnabled pref + runtime support.
  const { settings } = useVoiceSettings();
  const tts = useSpeechSynthesis();
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
    <div className="relative mt-6 flex min-h-0 flex-1 flex-col">
      <div
        ref={setScroll}
        // [overflow-anchor:none] stops the browser's scroll-anchoring from fighting
        // the JS pin (defensive; Safari 27).
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
                  <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl bg-accent px-4 py-2.5 text-sm leading-relaxed text-bg-base">
                    {m.content}
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
                {segments.length === 0 && isStreaming && isLast ? (
                  <div className="max-w-[88%] rounded-2xl border border-border bg-bg-surface px-4 py-2.5 text-sm text-fg">
                    Thinking…
                  </div>
                ) : (
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
                    ) : (
                      <div key={j} className="w-full max-w-md">
                        <ChatCard segment={seg} />
                      </div>
                    ),
                  )
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
  );
}
