"use client";

import dynamic from "next/dynamic";
import { Gamepad2 } from "lucide-react";
import { ViewEscapeHatch } from "@/components/view-escape-hatch";
import { GraphIndex } from "@/components/game/graph-index";
import { BuildGraph } from "@/components/game/build-graph";
import { GlassBoxDemo } from "@/components/game/glass-box-demo";

const SkillTree = dynamic(
  () => import("@/components/game/skill-tree").then((m) => m.SkillTree),
  { ssr: false },
);

/**
 * GAMIFIED view — "The Build Graph". The accessible DOM-first index is the DEFAULT
 * and the mobile / reduced-motion / no-JS / screen-reader layer; the interactive 3D
 * graph layers on top as a desktop+motion enhancement. The escape hatch is the FIRST
 * focusable element.
 *
 * The keyboard-native CLI now lives in its own first-class DEVELOPER view (⌘K
 * "Developer mode" / ?view=developer / the `developer` terminal command) — Play is the
 * Build Graph, Developer is the terminal, cleanly separated.
 *
 * Unmounting this subtree on view exit is what lets the R3F canvas dispose its WebGL
 * context — see view-router.tsx.
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

      {/* Glass-box multi-agent demo — renders only once the owner has approved the
          scripted traces (ships dark otherwise). Last child; escape hatch stays first. */}
      <GlassBoxDemo />

      {/* SVG Skill Tree — opt-in via NEXT_PUBLIC_SKILL_TREE=true (hidden by default). */}
      {process.env.NEXT_PUBLIC_SKILL_TREE === "true" && (
        <section className="mt-10 rounded-2xl border border-border bg-bg-surface/60 p-6">
          <h2 className="mono-label mb-5">{"// skill tree"}</h2>
          <SkillTree />
        </section>
      )}
    </main>
  );
}
