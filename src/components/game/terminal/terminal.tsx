"use client";

import { useState, useRef, useEffect } from "react";
import { track } from "@vercel/analytics";
import { TerminalSquare, Maximize2 } from "lucide-react";
import { useTerminal } from "./use-terminal";
import { useAutoScroll } from "@/lib/scroll/use-auto-scroll";
import { getSuggestions } from "./completion";
import { COMMANDS } from "./commands";
import { cn } from "@/lib/utils";

/** Quick-run chips so non-typers (and touch users) get the full experience. Each
 *  runs through the same registry path as typing the command. */
const CHIPS = ["whoami", "ls work", "stack", "tree", "resume"];

/** All visible commands as Suggestion objects for fuzzy dropdown. */
const COMMAND_SUGGESTIONS = Object.values(COMMANDS)
  .filter((c) => !c.hidden)
  .map((c) => ({ name: c.name, description: c.description }));

/**
 * Presentational terminal shell. Output is a polite role="log" live region (only new
 * lines announce). Keyboard-native: ↑/↓ history, Tab autocomplete, Enter to run.
 * Fuzzy autocomplete dropdown + ghost completion hint while typing.
 */
const THEME_TEXT: Record<string, string> = {
  cyan: "text-accent",
  green: "text-green",
  amber: "text-amber",
};

export function Terminal({
  maxHeightClass = "max-h-72",
  fill = false,
  onMaximize,
  maximizeRef,
  initialLines,
}: {
  maxHeightClass?: string;
  fill?: boolean;
  onMaximize?: () => void;
  maximizeRef?: React.Ref<HTMLButtonElement>;
  initialLines?: import("./types").Line[];
}) {
  const { lines, input, setInput, run, recall, complete, theme } = useTerminal(initialLines);
  const promptColor = THEME_TEXT[theme] ?? "text-accent";

  // Fuzzy autocomplete dropdown state
  const [suggestions, setSuggestions] = useState<{ name: string; description: string }[]>([]);
  const [suggIdx, setSuggIdx] = useState(-1);
  const [showSugg, setShowSugg] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { scrollRef, contentRef, scrollToBottom } = useAutoScroll({
    threshold: 32,
    surface: "terminal",
    mode: "bottom-pin",
  });

  // Update suggestions whenever input changes
  useEffect(() => {
    const sugg = getSuggestions(input, COMMAND_SUGGESTIONS);
    setSuggestions(sugg); // eslint-disable-line react-hooks/set-state-in-effect -- intentional derived-state sync on input change
    setSuggIdx(-1); // eslint-disable-line react-hooks/set-state-in-effect -- intentional derived-state sync on input change
    setShowSugg(sugg.length > 0 && input.trim().length > 0); // eslint-disable-line react-hooks/set-state-in-effect -- intentional derived-state sync on input change
  }, [input]);

  // Ghost hint: the suffix of the top suggestion after what's already typed
  const ghostHint = (() => {
    if (!showSugg || suggestions.length === 0 || input.includes(" ")) return "";
    const top = suggestions[0].name;
    return top.startsWith(input.toLowerCase()) ? top.slice(input.length) : "";
  })();

  const runAndPin = (cmd: string) => {
    run(cmd);
    scrollToBottom();
    setShowSugg(false);
    setSuggestions([]);
  };

  const acceptSuggestion = (name: string) => {
    setInput(name + " ");
    setShowSugg(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key.length === 1) scrollToBottom();

    if (e.key === "ArrowDown") {
      if (showSugg) {
        e.preventDefault();
        setSuggIdx((i) => Math.min(i + 1, suggestions.length - 1));
      } else {
        const v = recall("down");
        if (v !== null) { e.preventDefault(); setInput(v); }
      }
    } else if (e.key === "ArrowUp") {
      if (showSugg) {
        e.preventDefault();
        setSuggIdx((i) => Math.max(i - 1, 0));
      } else {
        const v = recall("up");
        if (v !== null) { e.preventDefault(); setInput(v); }
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (showSugg && suggestions.length > 0) {
        // Accept highlighted suggestion or top suggestion
        acceptSuggestion(suggIdx >= 0 ? suggestions[suggIdx].name : suggestions[0].name);
      } else {
        const c = complete(input);
        if (c) setInput(c);
      }
    } else if (e.key === "ArrowRight" && ghostHint && input === inputRef.current?.value) {
      // Accept ghost hint with →
      e.preventDefault();
      setInput(input + ghostHint);
    } else if (e.key === "Escape") {
      setShowSugg(false);
    } else if (e.key === "Enter" && showSugg && suggIdx >= 0) {
      e.preventDefault();
      acceptSuggestion(suggestions[suggIdx].name);
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-bg-base/80 font-mono text-xs",
        fill && "flex h-full flex-col",
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-fg-subtle">
        <TerminalSquare size={13} className="shrink-0 text-accent" />
        <span className="truncate">sairam@anvilry</span>
        <span className="ml-auto hidden text-[10px] sm:inline">keyboard-native · type &apos;help&apos;</span>
        {onMaximize && (
          <button
            ref={maximizeRef}
            type="button"
            onClick={() => { track("terminal_maximize"); onMaximize(); }}
            aria-label="Maximize terminal to fullscreen"
            className="-mr-1 ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:ml-0"
          >
            <Maximize2 size={13} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Scrollback */}
      <div
        ref={scrollRef}
        className={cn(
          "terminal-boot overflow-y-auto px-4 py-3 [overflow-anchor:none]",
          fill ? "min-h-0 flex-1" : maxHeightClass,
        )}
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        <div ref={contentRef} className="space-y-0.5">
          {lines.map((l, i) => (
            <pre
              key={i}
              aria-hidden={l.kind === "art" || undefined}
              className={cn(
                "whitespace-pre-wrap",
                l.kind === "in"  ? "text-accent" :
                l.kind === "err" ? "text-amber" :
                l.kind === "art" ? "whitespace-pre text-fg-subtle/60" :
                                   "text-fg-muted",
              )}
            >
              {l.text}
            </pre>
          ))}
        </div>
      </div>

      {/* Quick-run chips */}
      <div
        className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2"
        role="group"
        aria-label="Quick commands"
      >
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { track("terminal_chip", { name: c }); runAndPin(c); }}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {c}
          </button>
        ))}
      </div>

      {/* Input row + autocomplete dropdown */}
      <div className="relative border-t border-border">
        {/* Autocomplete dropdown — floats above the input */}
        {showSugg && suggestions.length > 0 && (
          <ul
            className="absolute bottom-full left-0 right-0 z-10 overflow-hidden rounded-t-xl border border-accent/20 bg-bg-surface shadow-lg"
            role="listbox"
            aria-label="Command suggestions"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.name}
                role="option"
                aria-selected={i === suggIdx}
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-1.5 text-[11px] transition-colors",
                  i === suggIdx
                    ? "bg-accent/10 text-fg"
                    : "text-fg-muted hover:bg-bg-elevated hover:text-fg",
                )}
                onMouseDown={(e) => { e.preventDefault(); acceptSuggestion(s.name); }}
              >
                <span className={cn("font-semibold", i === suggIdx ? "text-accent" : "text-fg-muted")}>
                  {i === 0 ? "▸" : " "} {s.name}
                </span>
                <span className="truncate text-fg-subtle">{s.description}</span>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const cmd = suggIdx >= 0 && showSugg ? suggestions[suggIdx].name : input;
            runAndPin(cmd);
            setInput("");
          }}
          className="flex items-center gap-2 px-4 py-2 transition-shadow focus-within:ring-2 focus-within:ring-inset focus-within:ring-accent"
        >
          <span className={promptColor} aria-hidden="true">{">"}</span>

          {/* Input + ghost hint overlay */}
          <div className="relative min-w-0 flex-1">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              placeholder="type a command — e.g. ls, open mindforge, whoami"
              aria-label="Terminal command input"
              aria-autocomplete="list"
              aria-expanded={showSugg}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              className="no-focus-ring w-full bg-transparent py-1 text-fg outline-none placeholder:text-fg-subtle"
            />
            {/* Ghost hint — greyed suffix of top suggestion */}
            {ghostHint && (
              <span
                className="pointer-events-none absolute left-0 top-0 py-1 text-fg-subtle/40 select-none"
                aria-hidden="true"
              >
                {/* Invisible text to position the ghost correctly */}
                <span className="invisible">{input}</span>
                {ghostHint}
              </span>
            )}
          </div>

          {input === "" && (
            <span className={cn("terminal-cursor select-none", promptColor)} aria-hidden="true">
              ▍
            </span>
          )}
        </form>
      </div>
    </div>
  );
}
