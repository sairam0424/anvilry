"use client";

import { Gamepad2 } from "lucide-react";
import { ViewEscapeHatch } from "@/components/view-escape-hatch";
import { GraphIndex } from "@/components/game/graph-index";
import { BuildGraph } from "@/components/game/build-graph";
import { EasterEggs } from "@/components/game/easter-eggs";

/**
 * GAMIFIED view — "The Build Graph". The accessible DOM-first index is the DEFAULT
 * and the mobile / reduced-motion / no-JS / screen-reader layer; the interactive 3D
 * graph (3.2) layers on top as a desktop+motion enhancement, and the terminal (3.4)
 * adds a power-user command bar. The escape hatch is the FIRST focusable element.
 *
 * Unmounting this subtree on view exit is what lets the (3.2) R3F canvas dispose its
 * WebGL context — see view-router.tsx.
 */
export function GameView() {
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

      {/* Accessible default + the mobile / reduced-motion / SR / keyboard layer. */}
      <GraphIndex />

      {/* Zero-cost delight — console greeting + Konami toast. Gates no content. */}
      <EasterEggs />
    </main>
  );
}
