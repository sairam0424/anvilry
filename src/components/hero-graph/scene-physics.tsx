"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@/lib/r3f";
import { Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Graph } from "./scene";

/**
 * Physics-enhanced hero graph scene — zero-gravity world with gentle idle drift.
 *
 * Wraps the inner Graph in a Rapier Physics world. The entire graph group gets a
 * subtle sinusoidal impulse each frame to make it feel alive and floating in space.
 * Reduced-motion preference is respected: impulses are suppressed when active.
 *
 * Architecture: this file is only ever imported when NEXT_PUBLIC_GRAPH_PHYSICS=true.
 * It is never referenced by the base scene — zero bundle impact when the flag is off.
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

  useFrame(({ clock }) => {
    if (prefersReducedMotion || !bodyRef.current) return;
    const t = clock.elapsedTime;
    // Gentle sinusoidal drift — makes the graph feel alive without distracting
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
      <Graph />
    </RigidBody>
  );
}
