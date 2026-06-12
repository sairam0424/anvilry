"use client";

import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { useChat } from "@/components/chat/use-chat";
import { RECRUITER_CHIPS, STARTER_CHIPS } from "@/components/chat/chat-suggestions";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ViewEscapeHatch } from "@/components/view-escape-hatch";
import { profile, impactMetrics } from "@/lib/profile";

/**
 * AI-CHAT view — a full "concierge console", not a bare chat box. Opens answer-
 * first: identity + impact strip + a persistent recruiter chip-rail so the
 * strongest-work / GenAI / impact answers are one tap. Reuses the existing Bedrock
 * backend (/api/chat -> streamWithFallback) untouched via the useChat transport.
 *
 * The escape hatch is the FIRST focusable element (never a keyboard trap). Full
 * a11y (aria-live announce-on-settle, Stop, pin-aware autoscroll) lands in 2.3.
 */
export function ChatView() {
  const { messages, send, stop, isStreaming } = useChat();
  const [input, setInput] = useState("");
  const empty = messages.length === 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
    setInput("");
  };

  const ask = (q: string) => {
    if (isStreaming) return;
    send(q);
    setInput("");
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <ViewEscapeHatch />
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-accent">
          <Sparkles size={13} aria-hidden="true" /> AI Concierge
        </p>
      </div>

      {/* Answer-first greeting + verified impact strip (recruiter visual triage). */}
      {empty && (
        <header className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Ask me anything about {profile.name.split(" ")[0]}&apos;s work
          </h1>
          <p className="mt-2 max-w-xl text-sm text-fg-muted">
            Grounded in real projects and production systems — GenAI, backend, and open source.
            I answer in the first person and never invent details.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {impactMetrics.map((m) => (
              <div key={m.label + m.sub} className="rounded-xl border border-border bg-bg-surface/60 px-3 py-2.5">
                <dd className="font-mono text-lg font-semibold text-fg">{m.value}</dd>
                <dt className="text-xs text-fg-muted">{m.label}</dt>
                <dt className="text-[11px] text-fg-subtle">{m.sub}</dt>
              </div>
            ))}
          </dl>
        </header>
      )}

      {/* Conversation. Grows to fill; messages + a11y live region live here (2.3). */}
      <ChatMessages messages={messages} isStreaming={isStreaming} />

      {/* Persistent recruiter chip-rail — one-tap strongest-work / impact paths. */}
      <div className="mt-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested questions">
          {RECRUITER_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => ask(c)}
              disabled={isStreaming}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
        {empty && (
          <div className="mt-2 flex flex-wrap gap-2">
            {STARTER_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => ask(c)}
                disabled={isStreaming}
                className="rounded-full px-3 py-1.5 text-xs text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer. */}
      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about my work, projects, or what I'm looking for…"
          aria-label="Ask a question about Sairam"
          className="flex-1 rounded-xl border border-border bg-bg-base px-4 py-3 text-sm outline-none placeholder:text-fg-muted focus:border-accent"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-bg-base transition-opacity disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        )}
      </form>
      <p className="mt-2 text-center text-[11px] text-fg-subtle">
        Grounded in real work · may simplify details
      </p>
    </main>
  );
}
