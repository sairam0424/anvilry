"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { useMediaQuery } from "@/lib/use-media-query";

// Client-only, lazily loaded — Three.js never enters the critical path / SSR.
const HeroGraphScene = dynamic(() => import("./scene"), { ssr: false });

/**
 * Hero WebGL slot. Mounts the R3F graph ONLY when:
 *  - not reduced-motion (verified useReducedMotion gate), AND
 *  - viewport is desktop-width (research: drop the WebGL layer on mobile).
 * Otherwise renders a lightweight CSS fallback. Absolutely positioned behind the
 * hero text, so it can never block the static LCP.
 */
export function HeroGraph() {
  const reduced = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const showWebGL = isDesktop && !reduced;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Always-present CSS glow fallback (mobile / reduced-motion / pre-hydration). */}
      <div className="absolute right-[-10%] top-[-20%] h-[36rem] w-[36rem] rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute left-[10%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-violet/10 blur-3xl" />
      {showWebGL && (
        <div className="absolute inset-0 opacity-70 [mask-image:radial-gradient(60%_60%_at_70%_30%,#000_40%,transparent_100%)]">
          <HeroGraphScene />
        </div>
      )}
    </div>
  );
}
