"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { HeroGraphInner } from "./scene";

/**
 * Physics-enhanced hero graph scene — gentle sinusoidal drift applied directly
 * to a group position in useFrame. No RigidBody / Rapier needed for this effect;
 * a simple oscillation is more predictable and avoids velocity accumulation bugs.
 *
 * Only imported when NEXT_PUBLIC_GRAPH_PHYSICS=true.
 */
export function HeroGraphScenePhysics() {
  return (
    <Canvas
      frameloop="always"
      resize={{ offsetSize: true }}
      camera={{ position: [0, 0, 7], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none", width: "100%", height: "100%" }}
    >
      <DriftWrapper />
    </Canvas>
  );
}

/** Wraps the graph in a group and applies sinusoidal drift each frame. */
function DriftWrapper() {
  const groupRef = useRef<THREE.Group>(null);
  const prefersReducedMotion = useReducedMotion();

  useFrame(({ clock }: RootState) => {
    if (prefersReducedMotion || !groupRef.current) return;
    const t = clock.elapsedTime;
    // Sinusoidal drift — oscillates around origin, never drifts away.
    // Position is SET (not accumulated) each frame so it stays bounded.
    groupRef.current.position.x = Math.sin(t * 0.4) * 0.08;
    groupRef.current.position.y = Math.cos(t * 0.25) * 0.06;
    groupRef.current.position.z = Math.sin(t * 0.3 + 1) * 0.04;
  });

  return (
    <group ref={groupRef}>
      <HeroGraphInner />
    </group>
  );
}
