"use client";

import { useRef, useState } from "react";
import { TerminalSquare } from "lucide-react";
import { ViewEscapeHatch } from "@/components/view-escape-hatch";
import { Terminal } from "@/components/game/terminal/terminal";
import { TerminalOverlay } from "@/components/game/terminal/terminal-overlay";

/**
 * DEVELOPER view — a focused, full-page terminal destination. The keyboard-native CLI
 * over the same canonical content, promoted to its own first-class view (reachable via
 * ⌘K, the `developer` terminal command, and the ?view=developer deep-link).
 *
 * Lazy + unmounted-when-inactive (see view-router.tsx), like chat/gamified. The escape
 * hatch is the FIRST focusable element (never a keyboard trap). A maximize control
 * opens the fullscreen overlay; focus is restored to it on close (WCAG 2.4.3).
 */
export function DeveloperView() {
  const [termMax, setTermMax] = useState(false);
  const maximizeRef = useRef<HTMLButtonElement>(null);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-4xl flex-col px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <ViewEscapeHatch />
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-accent">
          <TerminalSquare size={13} aria-hidden="true" /> Developer Mode
        </p>
      </div>

      <header className="mt-8">
        <h1 className="text-2xl font-semibold tracking-tight">Query my work via the CLI</h1>
        <p className="mt-2 max-w-xl text-sm text-fg-muted">
          A keyboard-native terminal over the same verified projects and systems. Type{" "}
          <code className="rounded bg-bg-surface px-1 py-0.5 font-mono text-xs text-fg">help</code>{" "}
          to list commands, or try <code className="rounded bg-bg-surface px-1 py-0.5 font-mono text-xs text-fg">whoami</code>,{" "}
          <code className="rounded bg-bg-surface px-1 py-0.5 font-mono text-xs text-fg">ls work</code>,{" "}
          <code className="rounded bg-bg-surface px-1 py-0.5 font-mono text-xs text-fg">cat pensieve</code>.
        </p>
      </header>

      <div className="mt-6">
        <Terminal
          maxHeightClass="max-h-[60vh]"
          onMaximize={() => setTermMax(true)}
          maximizeRef={maximizeRef}
        />
      </div>

      {/* Fullscreen "beast mode" — focus-trapped, Esc closes, focus restored to the
          maximize button on close (WCAG 2.4.3). */}
      <TerminalOverlay open={termMax} onOpenChange={setTermMax} triggerRef={maximizeRef} />
    </main>
  );
}
