"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Sparkles, X, Send, CornerDownLeft } from "lucide-react";
import { useView } from "@/components/view-context";
import { parseCards } from "@/components/chat/parse-cards";
import { ChatCard } from "@/components/chat/chat-card";

// Lazy markdown renderer — same safe config as the full chat view, kept off the
// initial bundle (the widget is interaction-gated).
const MarkdownMessage = dynamic(
  () => import("@/components/chat/markdown-message").then((m) => m.MarkdownMessage),
  { ssr: false, loading: () => null },
);

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "What did you build at Ascendion?",
  "Tell me about MindForge.",
  "What's your strongest backend project?",
  "What are you looking for?",
];

/**
 * View-gate: the full Chat view IS the concierge, so the floating widget is hidden
 * there. Keying the inner widget by `view` remounts it on any view change, so its
 * transcript/open state never leaks across a classic<->gamified switch (no
 * setState-in-effect needed).
 */
export function AskPortfolio() {
  const { view } = useView();
  if (view === "chat") return null;
  return <AskPortfolioWidget key={view} />;
}

function AskPortfolioWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Pin-aware autoscroll: only follow new content when already near the bottom, so
  // a user who scrolled up to re-read isn't yanked down (mirrors use-chat-a11y.ts).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  // Restore focus to the trigger when the panel closes (WCAG 2.4.3 focus order).
  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      const next = [...messages, { role: "user" as const, content: q }];
      setMessages(next);
      setInput("");
      setBusy(true);
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
        });
        if (!res.ok || !res.body) {
          const msg =
            res.status === 503
              ? "The chat isn't switched on yet — but you can reach Sairam by email or check the résumé."
              : "Something went wrong. Please try again.";
          setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: msg }]);
          setBusy(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: acc }]);
        }
      } catch {
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: "Network error — please try again." }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages],
  );

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        aria-label="Ask my portfolio"
        className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-bg-surface/90 px-4 py-2.5 text-sm font-medium text-fg shadow-lg shadow-accent/10 backdrop-blur transition-colors hover:border-accent"
      >
        <Sparkles size={16} className="text-accent" />
        Ask my portfolio
      </button>

      {open && (
        <div className="fixed bottom-20 left-5 z-50 flex h-[28rem] max-h-[calc(100vh-7rem)] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-2xl border border-border-strong bg-bg-surface shadow-2xl">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-accent" />
              <span className="text-sm font-medium">Ask my portfolio</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X size={16} />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-fg-muted">
                  Hi! 👋 Ask me anything about Sairam&apos;s work, projects, or what he&apos;s looking for.
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-lg border border-border px-3 py-2 text-left text-xs text-fg-muted transition-colors hover:border-accent hover:text-fg"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-accent px-3.5 py-2 text-sm text-bg-base">
                      {m.content}
                    </div>
                  </div>
                );
              }
              // Assistant: render markdown text segments + resolved cards (same safe
              // model as the full chat view — tokens parsed out before markdown).
              if (!m.content) {
                return busy ? (
                  <div key={i} className="flex justify-start">
                    <div className="rounded-2xl border border-border bg-bg-elevated px-3.5 py-2 text-sm text-fg-muted">
                      Thinking…
                    </div>
                  </div>
                ) : null;
              }
              return (
                <div key={i} className="flex flex-col items-start gap-2">
                  {parseCards(m.content).map((seg, j) =>
                    seg.type === "text" ? (
                      seg.text.trim() ? (
                        <div
                          key={j}
                          className="max-w-[85%] rounded-2xl border border-border bg-bg-elevated px-3.5 py-2 text-sm text-fg-muted"
                        >
                          <MarkdownMessage text={seg.text} />
                        </div>
                      ) : null
                    ) : (
                      <div key={j} className="w-full">
                        <ChatCard segment={seg} />
                      </div>
                    ),
                  )}
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              aria-label="Ask a question about Sairam"
              disabled={busy}
              className="flex-1 rounded-lg border border-border bg-bg-base px-3 py-2 text-sm outline-none placeholder:text-fg-muted focus:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-surface disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-bg-base transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-surface"
            >
              <Send size={15} />
            </button>
          </form>
          <p className="flex items-center justify-center gap-1 pb-2 text-[10px] text-fg-subtle">
            <CornerDownLeft size={10} /> Grounded in real work · may simplify details
          </p>
        </div>
      )}
    </>
  );
}
