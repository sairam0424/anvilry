"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import type { ChatMessage } from "@/components/chat/use-chat";
import { parseCards } from "@/components/chat/parse-cards";
import { ChatCard } from "@/components/chat/chat-card";
import { useChatA11y } from "@/components/chat/use-chat-a11y";

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
 * server-sourced. Pin-aware autoscroll + a single announce-on-settle aria-live
 * region come from useChatA11y.
 */
export function ChatMessages({
  messages,
  isStreaming,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { liveMessage } = useChatA11y(messages, isStreaming, scrollRef);

  // A single polite live region: announces "Answering…" then the settled answer
  // once. Always present (even when empty) so the region is registered with AT.
  const liveRegion = (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {liveMessage}
    </div>
  );

  if (messages.length === 0) return <div className="flex-1">{liveRegion}</div>;

  return (
    <div ref={scrollRef} className="mt-6 flex-1 space-y-4 overflow-y-auto">
      {liveRegion}
      {messages.map((m, i) => {
        const isLast = i === messages.length - 1;
        if (m.role === "user") {
          return (
            <div key={i} className="flex justify-end">
              <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl bg-accent px-4 py-2.5 text-sm leading-relaxed text-bg-base">
                {m.content}
              </div>
            </div>
          );
        }
        // Assistant: split into text + resolved cards. Cards render full-width below text.
        const segments = parseCards(m.content);
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
          </div>
        );
      })}
    </div>
  );
}
