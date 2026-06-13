"use client";

import { useRef, useState } from "react";
import { TerminalSquare } from "lucide-react";
import { ViewEscapeHatch } from "@/components/view-escape-hatch";
import { Terminal } from "@/components/game/terminal/terminal";
import { TerminalOverlay } from "@/components/game/terminal/terminal-overlay";
import { DeveloperRail } from "@/components/game/developer-rail";

/**
 * DEVELOPER view — a focused, full-page terminal destination. The keyboard-native CLI
 * over the same canonical content, promoted to its own first-class view (reachable via
 * the nav switcher, ⌘K, the `developer` terminal command, and ?view=developer).
 *
 * Layout: on lg+ a two-zone grid — the terminal FILLS the column height (a real-tool
 * feel, no wasted void) beside a quiet recruiter rail (metrics + résumé + contact).
 * Below lg the rail drops and it's a single-column terminal (mobile byte-unchanged →
 * WCAG 1.4.10 reflow safe). Lazy + unmounted-when-inactive (see view-router.tsx). The
 * escape hatch is the FIRST focusable element (never a keyboard trap).
 */
export function DeveloperView() {
  const [termMax, setTermMax] = useState(false);
  const maximizeRef = useRef<HTMLButtonElement>(null);

  return (
    // Fixed height on lg+ (not just min-h): the terminal can only scroll INTERNALLY if
    // an ancestor is height-BOUNDED — with only min-height the chain grows past the
    // viewport and the document scrolls instead (same trap fixed on the chat view).
    // Mobile keeps min-h so a short terminal doesn't get awkwardly capped. dvh avoids
    // the iOS Safari address-bar jump.
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-6xl flex-col px-6 py-6 lg:h-[calc(100dvh-3.5rem)] lg:min-h-0">
      <div className="flex items-center justify-between gap-3">
        <ViewEscapeHatch />
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-accent">
          <TerminalSquare size={13} aria-hidden="true" /> Developer Mode
        </p>
      </div>

      {/* One concise heading (demoted) — the boot banner prints identity, so don't repeat. */}
      <header className="mt-6">
        <h1 className="text-base font-semibold tracking-tight">Query my work via the CLI</h1>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">
          A keyboard-native terminal over the same verified projects and systems. Type{" "}
          <code className="rounded bg-bg-surface px-1 py-0.5 font-mono text-xs text-fg">help</code>{" "}
          for commands, or try{" "}
          <code className="rounded bg-bg-surface px-1 py-0.5 font-mono text-xs text-fg">summary</code>,{" "}
          <code className="rounded bg-bg-surface px-1 py-0.5 font-mono text-xs text-fg">ls work</code>,{" "}
          <code className="rounded bg-bg-surface px-1 py-0.5 font-mono text-xs text-fg">about</code>.
        </p>
      </header>

      {/* Content region: single column on mobile; on lg+ a [terminal | 19rem rail] grid.
          flex-1 + min-h-0 lets the terminal column own the leftover height. */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-6 lg:items-stretch">
        {/* Terminal cell — fills the available column height (real-tool feel). The
            min-h-[24rem] floor keeps it usable if the viewport is very short. */}
        <div className="flex min-h-[24rem] flex-1 flex-col">
          <Terminal fill onMaximize={() => setTermMax(true)} maximizeRef={maximizeRef} />
        </div>

        {/* Recruiter rail — lg+ only; in DOM AFTER the terminal so the terminal stays the
            hero in the tab/reading order even when it visually sits to the left. */}
        <div className="mt-6 hidden lg:mt-0 lg:block">
          <DeveloperRail />
        </div>
      </div>

      {/* Fullscreen "beast mode" — focus-trapped, Esc closes, focus restored to the
          maximize button on close (WCAG 2.4.3). */}
      <TerminalOverlay open={termMax} onOpenChange={setTermMax} triggerRef={maximizeRef} />
    </main>
  );
}
