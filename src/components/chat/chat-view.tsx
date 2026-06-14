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
    // Fixed height (not min-h): the console must be a BOUNDED flex container so the
    // transcript scrolls INTERNALLY. With only min-height the element is content-sized
    // and unbounded, so a tall conversation grows the document and the inner
    // overflow-y-auto never engages (the autoscroll snap then no-ops). `dvh` (not vh)
    // keeps the composer clear of iOS Safari's address bar.
    <main className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-3xl flex-col px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <ViewEscapeHatch />
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-accent">
          <Sparkles size={13} aria-hidden="true" /> AI Concierge
        </p>
      </div>

      {/* Bordered "console" panel — frames the whole conversation so it reads as a
          contained concierge terminal, not scattered elements in an empty void. */}
      {/* min-h-0 lets this flex child shrink below its content so the transcript
          (the flex-1 child below) can own the overflow instead of pushing the page. */}
      <section className="mt-4 flex min-h-0 flex-1 flex-col rounded-2xl border border-border-strong bg-bg-surface/40 p-5 shadow-xl shadow-black/20 backdrop-blur sm:p-6">
      {/* Answer-first greeting + verified impact strip (recruiter visual triage).
          min-h-0 + overflow-y-auto + shrink: on a SHORT viewport this tall block (greeting +
          6-tile metric grid) must scroll WITHIN itself rather than push the composer out of
          the bordered console (it was a rigid flex sibling, so it shoved the composer + caption
          past the section border). It collapses to nothing once a conversation starts (empty). */}
      {empty && (
        <header className="min-h-0 shrink overflow-y-auto">
          <h1 className="text-2xl font-semibold tracking-tight">
            Ask me anything about {profile.name.split(" ")[0]}&apos;s work
          </h1>
          <p className="mt-2 max-w-xl text-sm text-fg-muted">
            Grounded in real projects and production systems — GenAI, backend, and open source.
            I answer in the first person and never invent details.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {impactMetrics.map((m) => (
              <div key={m.label + m.sub} className="rounded-xl border border-border bg-bg-surface/60 px-3 py-2.5">
                {/* dt = term (the metric), dd = description (its value+context) */}
                <dt className="font-mono text-lg font-semibold text-fg">{m.value}</dt>
                <dd className="text-xs text-fg-muted">{m.label}</dd>
                <dd className="text-[11px] text-fg-subtle">{m.sub}</dd>
              </div>
            ))}
          </dl>
        </header>
      )}

      {/* Conversation. Grows to fill; messages + a11y live region live here (2.3). */}
      <ChatMessages messages={messages} isStreaming={isStreaming} />

      {/* Persistent recruiter chip-rail — one-tap strongest-work / impact paths.
          shrink-0: never let a short viewport compress the chips into the transcript. */}
      <div className="mt-4 shrink-0">
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

      {/* Composer. shrink-0: the input the user types in must NEVER be compressed or
          pushed below the console border on a short viewport (it was escaping the section). */}
      <form onSubmit={onSubmit} className="mt-3 flex shrink-0 items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about my work, projects, or what I'm looking for…"
          aria-label="Ask a question about Sairam"
          className="flex-1 rounded-xl border border-border bg-bg-base px-4 py-3 text-sm outline-none placeholder:text-fg-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base"
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
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-bg-base transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base"
          >
            <Send size={16} />
          </button>
        )}
      </form>
      <p className="mt-2 shrink-0 text-center text-[11px] text-fg-subtle">
        Grounded in real work · may simplify details
      </p>
      </section>
    </main>
  );
}
