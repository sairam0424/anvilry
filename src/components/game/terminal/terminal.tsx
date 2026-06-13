"use client";

import { useRef, useEffect } from "react";
import { TerminalSquare, Maximize2 } from "lucide-react";
import { useTerminal } from "./use-terminal";
import { cn } from "@/lib/utils";

/** Quick-run chips so non-typers (and touch users) get the full experience. Each
 *  runs through the same registry path as typing the command. */
const CHIPS = ["whoami", "ls work", "stack", "tree", "resume"];

/**
 * Presentational terminal shell. Output is a polite role="log" live region (only new
 * lines announce). Keyboard-native: ↑/↓ history, Tab autocomplete, Enter to run. The
 * input opts out of the harsh global focus box (no-focus-ring); its row instead shows
 * an inset accent ring on focus-within — a visible, less jarring focus indicator
 * (WCAG 2.4.7). Pin-aware autoscroll. Logic lives in useTerminal.
 */
const THEME_TEXT: Record<string, string> = {
  cyan: "text-accent",
  green: "text-green",
  amber: "text-amber",
};

export function Terminal({
  maxHeightClass = "max-h-72",
  onMaximize,
  maximizeRef,
}: {
  maxHeightClass?: string;
  /** When provided, a maximize control appears in the title bar (opens the overlay). */
  onMaximize?: () => void;
  /** Ref to the maximize button so the overlay can restore focus on close (WCAG 2.4.3). */
  maximizeRef?: React.Ref<HTMLButtonElement>;
}) {
  const { lines, input, setInput, run, recall, complete, theme } = useTerminal();
  const histRef = useRef<HTMLDivElement>(null);
  const promptColor = THEME_TEXT[theme] ?? "text-accent";

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
    // Plain <div>, not a labelled <section>: the parent (the game-view "developer
    // mode" section, or the overlay's Dialog) already provides the region/dialog
    // landmark + accessible name — a second named landmark here would duplicate it.
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-base/80 font-mono text-xs">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-fg-subtle">
        <TerminalSquare size={13} className="shrink-0 text-accent" />
        <span className="truncate">sairam@anvilry</span>
        {/* Hidden on narrow screens so the row can't overflow and clip the maximize
            button (the bar is overflow-hidden); reappears at sm+. */}
        <span className="ml-auto hidden text-[10px] sm:inline">keyboard-native · type &apos;help&apos;</span>
        {onMaximize && (
          <button
            ref={maximizeRef}
            type="button"
            onClick={onMaximize}
            aria-label="Maximize terminal to fullscreen"
            className="-mr-1 ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:ml-0"
          >
            <Maximize2 size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        ref={histRef}
        className={cn(
          "terminal-boot space-y-1 overflow-y-auto px-4 py-3 [overflow-anchor:none]",
          maxHeightClass,
        )}
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {lines.map((l, i) => (
          <pre
            key={i}
            // Decorative figlet rows are hidden from assistive tech (they'd announce
            // as meaningless punctuation); the real identity lines stay readable.
            aria-hidden={l.kind === "art" || undefined}
            className={
              l.kind === "in"
                ? "whitespace-pre-wrap text-accent"
                : l.kind === "err"
                  ? "whitespace-pre-wrap text-amber"
                  : l.kind === "art"
                    ? "whitespace-pre text-fg-subtle"
                    : "whitespace-pre-wrap text-fg-muted"
            }
          >
            {l.text}
          </pre>
        ))}
      </div>

      <div
        className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2"
        role="group"
        aria-label="Quick commands"
      >
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => run(c)}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {c}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
          setInput("");
        }}
        // A ring (box-shadow), NOT border-color, is the focus affordance: the global
        // `* { border-color: var(--border) }` rule is UNLAYERED and beats any layered
        // `focus-within:border-*` utility, so a border-color swap is silently a no-op.
        // A ring has no such universal override and reliably shows keyboard focus (2.4.7).
        className="flex items-center gap-2 border-t border-border px-4 py-2 transition-shadow focus-within:ring-2 focus-within:ring-inset focus-within:ring-accent"
      >
        <span className={promptColor} aria-hidden="true">
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
          className="no-focus-ring min-w-0 flex-1 bg-transparent py-1 text-fg outline-none placeholder:text-fg-subtle"
        />
        {/* Cosmetic blinking cursor when the input is empty (decorative only). */}
        {input === "" && (
          <span className={cn("terminal-cursor select-none", promptColor)} aria-hidden="true">
            ▍
          </span>
        )}
      </form>
    </div>
  );
}
