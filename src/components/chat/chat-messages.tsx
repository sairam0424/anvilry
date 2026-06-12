"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/components/chat/use-chat";
import { cn } from "@/lib/utils";

/**
 * Renders the conversation. Assistant text is rendered as React TEXT NODES (never
 * dangerouslySetInnerHTML) so model output can't inject markup — generative cards
 * (2.2) are resolved from a slug allowlist, not parsed from model HTML. The
 * aria-live announce-on-settle region + pin-aware autoscroll land in 2.3.
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
      {messages.map((m, i) => (
        <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
          <div
            className={cn(
              "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              m.role === "user"
                ? "bg-accent text-bg-base"
                : "border border-border bg-bg-surface text-fg",
            )}
          >
            {m.content || (isStreaming && i === messages.length - 1 ? "Thinking…" : "")}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
