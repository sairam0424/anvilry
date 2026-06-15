"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import { useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { useMediaQuery, useWebGLSupported } from "@/lib/use-media-query";
import { questNodes } from "@/lib/game-model";
import { DossierCard } from "@/components/game/dossier-card";
import { WebGLBoundary } from "@/components/game/webgl-boundary";
import { useTalkModeOpen } from "@/components/chat/talk-overlay-store";

// Client-only, lazily loaded — Three.js never enters the critical path / SSR.
const BuildGraphScene = dynamic(() => import("./build-graph-scene"), { ssr: false });

/**
 * Desktop + full-motion WEBGL ENHANCEMENT over the DOM index. Mounts the
 * interactive R3F graph only when not reduced-motion AND viewport is desktop —
 * exactly the gate the hero uses (useReducedMotion + min-width:768px). On mobile /
 * reduced-motion / no-JS, this renders nothing and the DOM index (always present
 * below) is the sole experience. Selecting a node opens its REAL dossier inline
 * (resolved content, deep-link to Classic) without leaving the gamified view.
 */
export function BuildGraph() {
  const reduced = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const webglOk = useWebGLSupported();
  // While the voice overlay is open, the Anvil 3D orb owns a live WebGL context. The
  // talk modal is layout-global and does NOT change the active view, so it can open over
  // the gamified view — unmount this scene meanwhile so there's only ONE live context
  // (avoids two concurrent GL contexts on lower-end GPUs / the per-page context cap).
  const talkOpen = useTalkModeOpen();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const onSelect = useCallback((id: string) => setSelectedId(id), []);
  const onFail = useCallback(() => setWebglFailed(true), []);
  const selected = selectedId ? questNodes.find((n) => n.id === selectedId) ?? null : null;

  // No 3D on mobile / reduced-motion, if WebGL is unsupported (probed proactively —
  // R3F's context failure is an async rejection an error boundary can't catch), if a
  // context was lost at runtime, or while the voice orb holds the one live context:
  // the DOM index below is the whole experience in every such case.
  if (!isDesktop || reduced || !webglOk || webglFailed || talkOpen) return null;

  return (
    <div className="relative mt-6 hidden sm:block">
      <p className="text-xs text-fg-subtle">
        Drag to rotate · click a node to open its dossier · or browse the full index below.
      </p>
      <div className="relative mt-3 h-[26rem] overflow-hidden rounded-2xl border border-border bg-bg-surface/40">
        {/* Absolute-fill wrapper gives the R3F Canvas a definite-size parent, so its
            ResizeObserver measures the real box (not the 300x150 canvas default).
            WebGLBoundary catches a failed GL context so the DOM index below stays the
            full experience even if the GPU refuses a context. */}
        <div className="absolute inset-0">
          <WebGLBoundary onFail={onFail}>
            <BuildGraphScene onSelect={onSelect} />
          </WebGLBoundary>
        </div>

        {/* Inline dossier panel — the node's REAL resolved card, dismissible. */}
        {selected && (
          <div className="absolute right-4 top-4 w-[min(22rem,calc(100%-2rem))]">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close dossier"
                className="absolute -right-1 -top-1 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-strong bg-bg-elevated text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X size={14} />
              </button>
              <DossierCard node={selected} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
