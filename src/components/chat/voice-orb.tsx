"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { useMediaQuery, useWebGLSupported } from "@/lib/use-media-query";
import { WebGLBoundary } from "@/components/game/webgl-boundary";
import { VoiceOrbCanvas } from "@/components/chat/voice-orb-canvas";
import type { VoiceSessionState } from "@/components/chat/use-voice-session";

// Lazy: three/R3F stays OUT of the talk-mode bundle until the 3D orb is actually shown
// (desktop + WebGL + motion). Mobile/reduced-motion/no-WebGL never download it.
const VoiceOrb3D = dynamic(
  () => import("@/components/chat/voice-orb-3d").then((m) => m.VoiceOrb3D),
  { ssr: false, loading: () => null },
);

/**
 * Orb selector — one component, capability-tiered:
 *  - desktop + WebGL + motion  -> the R3F GLSL "Siri orb" (premium), wrapped in
 *    WebGLBoundary so a GPU/context failure silently falls back to the canvas.
 *  - everything else / SSR      -> the universal 2D-canvas orb (which itself draws a
 *    static ring under reduced-motion).
 * Both consume the same `level` ref, so the amplitude source is identical regardless of
 * which renderer wins.
 */
export function VoiceOrb({
  level,
  state,
  size = 160,
}: {
  level: React.RefObject<number>;
  state: VoiceSessionState;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const webgl = useWebGLSupported();
  // If the 3D orb's WebGL context throws at runtime, fall back to the canvas orb (the
  // boundary renders null on failure, so we flip to canvas via onFail).
  const [glFailed, setGlFailed] = useState(false);
  const use3D = isDesktop && webgl && !reduced && !glFailed;

  if (use3D) {
    return (
      <WebGLBoundary onFail={() => setGlFailed(true)}>
        <VoiceOrb3D level={level} state={state} size={size} />
      </WebGLBoundary>
    );
  }
  return <VoiceOrbCanvas level={level} state={state} size={size} />;
}
