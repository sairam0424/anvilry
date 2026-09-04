"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMediaQuery, useWebGLSupported } from "@/lib/use-media-query";
import { useView } from "@/components/view-context";
import { WebGLBoundary } from "@/components/game/webgl-boundary";

const GRAPH_PHYSICS = process.env.NEXT_PUBLIC_GRAPH_PHYSICS === "true";

// Client-only, lazily loaded — Three.js never enters the critical path / SSR.
// When NEXT_PUBLIC_GRAPH_PHYSICS=true a drift variant is loaded instead of the static scene.
// NOTE: despite the flag name, there is no physics engine involved — scene-physics.tsx applies
// plain sinusoidal offsets in useFrame (see its docblock). `@react-three/rapier` was declared in
// package.json but imported nowhere, and was removed in v3.5.0; the flag and filename are
// historical residue of a plan that never shipped.
const HeroGraphScene = GRAPH_PHYSICS
  ? dynamic(() => import("./scene-physics").then((m) => m.HeroGraphScenePhysics), { ssr: false })
  : dynamic(() => import("./scene"), { ssr: false });

/**
 * Hero WebGL slot. Mounts the R3F graph ONLY when:
 *  - the Classic view is active (so the hidden Classic page doesn't keep a live
 *    WebGL context while the gamified view uses one — avoids a leaked/second
 *    context on low-end mobile, and frees the single context in software-GL envs), AND
 *  - not reduced-motion (verified useReducedMotion gate), AND
 *  - viewport is desktop-width (research: drop the WebGL layer on mobile), AND
 *  - WebGL is actually available (useWebGLSupported) and hasn't failed to mount
 *    this session (WebGLBoundary's onFail) — the Classic<->Gamified handoff above
 *    disposes one context and creates another in the same transition, which can
 *    fail transiently; mirrors build-graph.tsx's guard for the same failure class.
 * Otherwise renders a lightweight CSS fallback. Absolutely positioned behind the
 * hero text, so it can never block the static LCP.
 */
export function HeroGraph() {
  const reduced = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const webglOk = useWebGLSupported();
  const { view } = useView();
  const [webglFailed, setWebglFailed] = useState(false);
  const onFail = useCallback(() => setWebglFailed(true), []);

  // webglOk / webglFailed mirror build-graph.tsx's guard: the Classic<->Gamified
  // handoff disposes one WebGL context and creates another in the same transition
  // (by design, see the docblock above) — this is the mount attempt that needs to
  // survive a failed/contended context creation instead of throwing uncaught.
  const showWebGL = isDesktop && !reduced && webglOk && !webglFailed && view === "classic";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Always-present CSS glow fallback (mobile / reduced-motion / pre-hydration / WebGL failure). */}
      <div className="absolute right-[-10%] top-[-20%] h-[36rem] w-[36rem] rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute left-[10%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-violet/10 blur-3xl" />
      {showWebGL && (
        <>
          {/* Graph confined to the RIGHT side and dimmed, so nodes don't collide with
              the headline. Mask hotspot pushed to ~82% x; lower opacity = backdrop. */}
          <div className="absolute inset-0 opacity-45 [mask-image:radial-gradient(50%_55%_at_82%_42%,#000_30%,transparent_78%)]">
            <WebGLBoundary onFail={onFail}>
              <HeroGraphScene />
            </WebGLBoundary>
          </div>
          {/* Left-to-right scrim: keeps the text column (left ~55%) on a dark base for
              contrast, fading to transparent so the graph still shines on the right. */}
          <div className="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/85 via-45% to-transparent" />
        </>
      )}
    </div>
  );
}
