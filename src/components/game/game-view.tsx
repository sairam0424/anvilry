"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { ViewEscapeHatch } from "@/components/view-escape-hatch";
import { GraphIndex } from "@/components/game/graph-index";
import { BuildGraph } from "@/components/game/build-graph";
import { Terminal } from "@/components/game/terminal/terminal";
import { TerminalOverlay } from "@/components/game/terminal/terminal-overlay";
import { EasterEggs } from "@/components/game/easter-eggs";
import { consumeDevMode, subscribeDevMode } from "@/components/game/dev-mode-intent";
import { useReducedMotion } from "motion/react";

/**
 * GAMIFIED view — "The Build Graph". The accessible DOM-first index is the DEFAULT
 * and the mobile / reduced-motion / no-JS / screen-reader layer; the interactive 3D
 * graph (3.2) layers on top as a desktop+motion enhancement. The terminal is now a
 * prominent, labelled "Developer Mode" panel (a keyboard-native CLI over the same
 * content) with a maximize control that opens a fullscreen overlay. The escape hatch
 * is the FIRST focusable element.
 *
 * Unmounting this subtree on view exit is what lets the (3.2) R3F canvas dispose its
 * WebGL context — see view-router.tsx.
 */
export function GameView() {
  const [termMax, setTermMax] = useState(false);
  const maximizeRef = useRef<HTMLButtonElement>(null);
  const devSectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  // Bring the Developer Mode terminal into view + focus its input when the ⌘K
  // "Developer mode" entry fires (the palette lives outside this subtree). Handles
  // both a fresh mount (consume the pending intent) and an already-mounted view
  // (subscribe). Without this, the ⌘K entry would dump the user at the top of Play.
  const revealDevMode = useCallback(() => {
    const section = devSectionRef.current;
    if (!section) return;
    section.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    // Defer the focus past the command palette's own close-effect (which restores
    // focus to its trigger). Without the rAF, that restore steals focus right back
    // when this fires synchronously from the already-mounted (subscribe) path.
    requestAnimationFrame(() => {
      section.querySelector<HTMLInputElement>('input[aria-label="Terminal command input"]')?.focus();
    });
  }, [reduced]);

  useEffect(() => {
    if (consumeDevMode()) revealDevMode();
    return subscribeDevMode(revealDevMode);
  }, [revealDevMode]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-5xl flex-col px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <ViewEscapeHatch />
        <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-accent">
          <Gamepad2 size={13} aria-hidden="true" /> Build Graph
        </p>
      </div>

      <header className="mt-8">
        <h1 className="text-2xl font-semibold tracking-tight">Explore the systems I&apos;ve built</h1>
        <p className="mt-2 max-w-xl text-sm text-fg-muted">
          A map of every project and flagship system — each node is real, verifiable work.
          Open any dossier to dive into the details.
        </p>
      </header>

      {/* Desktop + full-motion: interactive 3D graph. Renders nothing otherwise. */}
      <BuildGraph />

      {/* Prominent Developer Mode panel — a keyboard-native CLI over the same content.
          Gates no content; the maximize control opens the fullscreen overlay. */}
      <section ref={devSectionRef} className="mt-10 scroll-mt-20" aria-labelledby="devmode-label">
        <div className="flex items-center justify-between gap-3">
          <p id="devmode-label" className="mono-label">
            {"// developer mode — query my work via CLI"}
          </p>
          <span className="hidden font-mono text-[11px] text-fg-subtle sm:inline">
            try: whoami · ls work · cat pensieve
          </span>
        </div>
        <div className="mt-3">
          <Terminal onMaximize={() => setTermMax(true)} maximizeRef={maximizeRef} />
        </div>
      </section>

      {/* Accessible default + the mobile / reduced-motion / SR / keyboard layer. */}
      <GraphIndex />

      {/* Zero-cost delight — console greeting + Konami toast. Gates no content. */}
      <EasterEggs />

      {/* Fullscreen "beast mode" — fresh terminal session, focus-trapped, Esc closes,
          focus restored to the maximize button on close (WCAG 2.4.3). */}
      <TerminalOverlay open={termMax} onOpenChange={setTermMax} triggerRef={maximizeRef} />
    </main>
  );
}
