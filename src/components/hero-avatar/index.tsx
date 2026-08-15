"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMediaQuery } from "@/lib/use-media-query";
import { useView } from "@/components/view-context";
import { WebGLBoundary } from "@/components/game/webgl-boundary";

const AvatarSceneLazy = dynamic(
  () => import("./avatar-scene").then((m) => ({ default: m.AvatarScene })),
  { ssr: false },
);

/**
 * CSS glow fallback — identical to HeroGraph fallback so switching between
 * hero modes produces no visible layout shift on the fallback path.
 */
function GlowFallback() {
  return (
    <>
      <div className="absolute right-[-10%] top-[-20%] h-[36rem] w-[36rem] rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute left-[10%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-violet/10 blur-3xl" />
    </>
  );
}

/**
 * Hero avatar gate.
 *
 * Reads both feature flags inside the function body (never module scope)
 * so vi.stubEnv works in tests.
 *
 * Guards (same as HeroGraph):
 *   - Desktop only (≥768px) — canvas too heavy for mobile
 *   - prefers-reduced-motion: off — animation would be distracting
 *   - Classic view only — unmount when gamified/chat/dev are active
 *
 * Three layout positions controlled by NEXT_PUBLIC_AVATAR_POSITION:
 *   "hero-side"  (default) — right slot, behind text (same zone as knowledge graph)
 *   "hero-split"           — right column with border separator
 *   "hero-top"             — centered above headline
 */
export function HeroAvatar(): React.JSX.Element | null {
  const reduced   = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { view }  = useView();

  // Read flags inside function body — NOT module scope (required for vi.stubEnv in tests).
  const heroMode = process.env.NEXT_PUBLIC_HERO_MODE;
  const position = process.env.NEXT_PUBLIC_AVATAR_POSITION ?? "hero-side";

  // Early exit when avatar mode is not active — renders nothing.
  if (heroMode !== "avatar") return null;

  const showWebGL = isDesktop && !reduced && view === "classic";

  const scene = showWebGL ? (
    <WebGLBoundary>
      <AvatarSceneLazy />
    </WebGLBoundary>
  ) : null;

  // ── hero-side: right zone, behind text, same slot as knowledge graph ──
  if (position === "hero-side") {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <GlowFallback />
        {showWebGL && (
          <>
            <div className="absolute inset-0 opacity-60 [mask-image:radial-gradient(45%_60%_at_82%_45%,#000_30%,transparent_78%)]">
              {scene}
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/85 via-45% to-transparent" />
          </>
        )}
      </div>
    );
  }

  // ── hero-split: right column with left border ──
  if (position === "hero-split") {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-[42%] overflow-hidden border-l border-border"
      >
        <GlowFallback />
        {showWebGL && (
          <div className="h-full w-full">
            {scene}
          </div>
        )}
      </div>
    );
  }

  // ── hero-top: centered above headline ──
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-8 -z-10 h-36 w-36 -translate-x-1/2 overflow-hidden"
    >
      <GlowFallback />
      {showWebGL && scene}
    </div>
  );
}
