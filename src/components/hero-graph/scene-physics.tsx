"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { HeroGraphInner } from "./scene";

/**
 * Physics-enhanced hero graph scene — single Canvas with Rapier Physics world inside.
 * The graph group gets a subtle sinusoidal drift impulse each frame.
 * Only imported when NEXT_PUBLIC_GRAPH_PHYSICS=true.
 */
export function HeroGraphScenePhysics() {
  return (
    <Canvas
      frameloop="demand"
      resize={{ offsetSize: true }}
      camera={{ position: [0, 0, 7], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none", width: "100%", height: "100%" }}
    >
      <Physics gravity={[0, 0, 0]} timeStep="vary">
        <PhysicsInner />
      </Physics>
    </Canvas>
  );
}

function PhysicsInner() {
  const prefersReducedMotion = useReducedMotion();
  const bodyRef = useRef<RapierRigidBody>(null);

  useFrame(({ clock }: RootState) => {
    if (prefersReducedMotion || !bodyRef.current) return;
    const t = clock.elapsedTime;
    bodyRef.current.applyImpulse(
      {
        x: Math.sin(t * 0.4) * 0.00008,
        y: Math.cos(t * 0.25) * 0.00008,
        z: Math.sin(t * 0.3 + 1) * 0.00005,
      },
      true,
    );
  });

  return (
    <RigidBody ref={bodyRef} type="dynamic" colliders={false}>
      <HeroGraphInner />
    </RigidBody>
  );
}
