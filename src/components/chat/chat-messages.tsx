"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/components/chat/use-chat";
import { parseCards } from "@/components/chat/parse-cards";
import { ChatCard } from "@/components/chat/chat-card";

/**
 * Renders the conversation. Assistant text is rendered as React TEXT NODES (never
 * dangerouslySetInnerHTML) so model output can't inject markup. Generative cards
 * are resolved from a slug allowlist (parse-cards.ts) against real Velite content,
 * not parsed from model HTML — so a card can't show fabricated data and its href is
 * server-sourced. The aria-live announce-on-settle region + pin-aware autoscroll
 * land in 2.3.
 */
export function ChatMessages({
  messages,
  isStreaming,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  // Placeholder autoscroll — replaced by pin-aware logic in 2.3.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  if (messages.length === 0) return <div className="flex-1" />;

  return (
    <div className="mt-6 flex-1 space-y-4 overflow-y-auto">
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
                      className="max-w-[88%] whitespace-pre-wrap rounded-2xl border border-border bg-bg-surface px-4 py-2.5 text-sm leading-relaxed text-fg"
                    >
                      {seg.text}
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
      <div ref={endRef} />
    </div>
  );
}
