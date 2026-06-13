"use client";

import { useRef, useEffect } from "react";
import { TerminalSquare } from "lucide-react";
import { useTerminal } from "./use-terminal";
import { cn } from "@/lib/utils";

/**
 * Presentational terminal shell. Output is a polite role="log" live region (only new
 * lines announce). Keyboard-native: ↑/↓ history, Tab autocomplete, Enter to run. The
 * input opts out of the global focus ring (no-focus-ring) — the section is the
 * affordance. Pin-aware autoscroll. All logic lives in useTerminal + the registry.
 */
export function Terminal({ maxHeightClass = "max-h-72" }: { maxHeightClass?: string }) {
  const { lines, input, setInput, run, recall, complete } = useTerminal();
  const histRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = histRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      const v = recall("up");
      if (v !== null) {
        e.preventDefault();
        setInput(v);
      }
    } else if (e.key === "ArrowDown") {
      const v = recall("down");
      if (v !== null) {
        e.preventDefault();
        setInput(v);
      }
    } else if (e.key === "Tab") {
      const c = complete(input);
      if (c) {
        e.preventDefault();
        setInput(c);
      }
    }
  };

  return (
    <section
      aria-label="Developer mode terminal"
      className="overflow-hidden rounded-2xl border border-border bg-bg-base/80 font-mono text-xs"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-fg-subtle">
        <TerminalSquare size={13} className="text-accent" />
        <span>sairam@anvilry</span>
        <span className="ml-auto text-[10px]">keyboard-native · type &apos;help&apos;</span>
      </div>

      <div
        ref={histRef}
        className={cn("space-y-1 overflow-y-auto px-4 py-3", maxHeightClass)}
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {lines.map((l, i) => (
          <pre
            key={i}
            className={
              l.kind === "in"
                ? "whitespace-pre-wrap text-accent"
                : l.kind === "err"
                  ? "whitespace-pre-wrap text-amber"
                  : "whitespace-pre-wrap text-fg-muted"
            }
          >
            {l.text}
          </pre>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
          setInput("");
        }}
        className="flex items-center gap-2 border-t border-border px-4 py-2"
      >
        <span className="text-accent" aria-hidden="true">
          {">"}
        </span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="type a command — e.g. ls, open mindforge, whoami"
          aria-label="Terminal command input"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          className="no-focus-ring flex-1 bg-transparent py-1 text-fg outline-none placeholder:text-fg-subtle"
        />
      </form>
    </section>
  );
}
