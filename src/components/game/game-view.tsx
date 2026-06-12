"use client";

import { ViewEscapeHatch } from "@/components/view-escape-hatch";

/**
 * GAMIFIED view — the explorable "Build Graph + Terminal" experience. This Phase-0
 * scaffold establishes the mount point and the escape hatch as first focusable
 * element. Unmounting this subtree on view exit is what lets the (Phase-3) R3F
 * canvas dispose its WebGL context. The accessible DOM-first index, interactive 3D
 * graph, dossier cards, and terminal land in Phase 3 tasks.
 */
export function GameView() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-5xl flex-col px-6 py-8">
      <ViewEscapeHatch />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">Build Graph</p>
        <h1 className="mt-2 text-2xl font-semibold">Explore the systems I&apos;ve built</h1>
        <p className="mt-2 max-w-md text-sm text-fg-muted">
          An explorable map of every project and flagship system. (Graph + terminal land in Phase 3.)
        </p>
      </div>
    </main>
  );
}
