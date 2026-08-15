"use client";

import React, { useRef } from "react";
import { Canvas } from "@/lib/r3f";
import { AvatarMesh } from "./avatar-mesh";
import { AvatarControls } from "./avatar-controls";

/**
 * R3F Canvas for the avatar. Key decisions:
 *   - frameloop="demand": renders only when invalidate() is called
 *     (from AvatarControls on mousemove, or gaze/breathing via useFrame hooks).
 *   - alpha: true so the canvas background is transparent — the hero gradient shows through.
 *   - camera fov 40 at z=2.5 gives a portrait-friendly crop for a head+shoulders view.
 *   - dpr [1, 1.75]: cap at 1.75× to save fill-rate on hi-DPI displays.
 *   - WebGLBoundary is applied by the parent HeroAvatar (index.tsx), not here.
 */
export function AvatarScene(): React.JSX.Element {
  const controlsRef = useRef<{ pitch: number; yaw: number }>({ pitch: 0, yaw: 0 });

  return (
    <Canvas
      frameloop="demand"
      resize={{ offsetSize: true }}
      camera={{ position: [0, 0.1, 2.5], fov: 40 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 3]} intensity={0.8} />
      <AvatarControls controlsRef={controlsRef} />
      <AvatarMesh controlsRef={controlsRef} />
    </Canvas>
  );
}
