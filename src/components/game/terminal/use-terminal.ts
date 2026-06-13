"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useView } from "@/components/view-context";
import { runCommand, COMMAND_NAMES } from "./commands";
import { bootBanner } from "./boot-banner";
import { nextHistoryIndex } from "./history";
import { completeCommand } from "./completion";
import { nextTheme } from "./theme";
import type { Line, Theme } from "./types";

const greeting: Line[] = bootBanner();

/**
 * Terminal session state: scrollback, input, command history (↑/↓), prefix
 * autocomplete, and the run() dispatcher that executes a command's NavAction
 * (view switch / route push / external open / clear) — keeping commands pure.
 */
export function useTerminal() {
  const router = useRouter();
  const { setView } = useView();
  const [lines, setLines] = useState<Line[]>(greeting);
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState<Theme>("cyan");
  const history = useRef<string[]>([]); // past commands (newest last)
  const histIndex = useRef<number>(-1); // -1 = not browsing history

  const run = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed) {
        history.current = [...history.current, trimmed];
        histIndex.current = -1;
      }
      // `theme` is a shell concern (cosmetic state) — handle before the pure registry.
      if (trimmed.toLowerCase() === "theme") {
        const next = nextTheme(theme);
        setTheme(next);
        setLines((prev) => [
          ...prev,
          { kind: "in", text: "$ theme" },
          { kind: "out", text: `theme → ${next}` },
        ]);
        return;
      }
      const { lines: newLines, nav } = runCommand(raw);
      if (nav?.type === "clear") {
        setLines([]);
        return;
      }
      setLines((prev) => [...prev, ...newLines]);
      if (nav?.type === "view") setView(nav.view);
      else if (nav?.type === "route") router.push(nav.href);
      else if (nav?.type === "external" && typeof window !== "undefined") {
        window.open(nav.href, "_blank", "noopener,noreferrer");
      }
    },
    [router, setView, theme],
  );

  /** ↑/↓ history navigation; returns the value to put in the input, or null to ignore.
   *  The index arithmetic lives in the pure, unit-tested nextHistoryIndex helper. */
  const recall = useCallback((dir: "up" | "down"): string | null => {
    const { idx, value } = nextHistoryIndex(history.current, histIndex.current, dir);
    histIndex.current = idx;
    return value;
  }, []);

  /** Autocomplete: command-name prefix match on the first (and only) token.
   *  The matching logic lives in the pure, unit-tested completeCommand helper. */
  const complete = useCallback((value: string): string | null => {
    return completeCommand(value, COMMAND_NAMES);
  }, []);

  return { lines, input, setInput, run, recall, complete, theme };
}
