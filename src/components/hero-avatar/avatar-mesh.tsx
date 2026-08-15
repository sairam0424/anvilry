"use client";

import React, { useRef, useEffect } from "react";
import { useFrame, useGLTF, THREE } from "@/lib/r3f";
import { useAvatarGaze } from "./use-avatar-gaze";
import { useAvatarIdle } from "./use-avatar-idle";
import { resolveRig, type AvatarRig } from "./rig";

// Preload so the GLB starts fetching immediately when the module is imported.
useGLTF.preload("/avatar/sairam.glb");

/**
 * Loads the ReadyPlayerMe GLB and runs a single useFrame loop that:
 *   1. Lerps head/neck bone toward cursor pitch/yaw (controlsRef)
 *   2. Writes eye gaze to morph targets (useAvatarGaze)
 *   3. Applies idle breathing to chest/spine bones (useAvatarIdle)
 *
 * ALL mutations are direct property writes — never setState.
 * frameloop="demand" on the parent Canvas means this only runs when
 * invalidate() is called (mousemove or touchmove from AvatarControls).
 */
export function AvatarMesh({
  controlsRef,
}: {
  controlsRef: React.MutableRefObject<{ pitch: number; yaw: number }>;
}): React.JSX.Element {
  const { scene } = useGLTF("/avatar/sairam.glb");

  // ONE ref, lazily initialised with exactly the `ref.current == null` pattern that
  // `react-hooks/refs` sanctions. Three designs were tried and only this one is legal:
  //   - five separate refs written during render -> rejected: writing SIBLING refs during
  //     render is flagged even behind a `== null` guard.
  //   - useMemo(() => resolveRig(scene)) -> rejected: useMemo output is treated as immutable
  //     render state, and the useFrame loop below mutates these objects every frame
  //     ("Cannot modify local variables after render completes").
  // A ref is the correct tool precisely because the animation loop MUST mutate its contents;
  // refs are React's mutable escape hatch. Resolution stays keyed to first render only,
  // matching the previous behaviour — useGLTF returns a stable scene for a fixed URL.
  const rigRef = useRef<AvatarRig | null>(null);
  if (rigRef.current == null) {
    rigRef.current = resolveRig(scene);
  }

  useEffect(() => {
    return () => {
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry?.dispose();
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      useGLTF.clear("/avatar/sairam.glb");
    };
  }, [scene]);

  const gazeRef = useAvatarGaze(controlsRef);
  const idleRef = useAvatarIdle();

  useFrame(() => {
    const rig = rigRef.current;
    if (!rig) return;
    const { pitch, yaw } = controlsRef.current;
    const gaze = gazeRef.current;
    const idle = idleRef.current;

    // ── Head rotation (smooth lerp, 8% per frame at 60fps) ──
    if (rig.head) {
      rig.head.rotation.x = THREE.MathUtils.lerp(
        rig.head.rotation.x,
        pitch * 0.45,
        0.08,
      );
      rig.head.rotation.y = THREE.MathUtils.lerp(
        rig.head.rotation.y,
        yaw * 0.45,
        0.08,
      );
    }
    if (rig.neck) {
      rig.neck.rotation.x = THREE.MathUtils.lerp(
        rig.neck.rotation.x,
        pitch * 0.2,
        0.06,
      );
      rig.neck.rotation.y = THREE.MathUtils.lerp(
        rig.neck.rotation.y,
        yaw * 0.2,
        0.06,
      );
    }

    // ── Eye morph targets (ARKit standard — ReadyPlayerMe exports these) ──
    const mesh = rig.morph;
    if (mesh?.morphTargetDictionary && mesh.morphTargetInfluences) {
      const setMorph = (key: string, val: number) => {
        const i = mesh.morphTargetDictionary![key];
        if (i !== undefined)
          mesh.morphTargetInfluences![i] = Math.max(0, Math.min(1, val));
      };
      setMorph("eyeLookInLeft", Math.max(0, gaze.eyeLX));
      setMorph("eyeLookOutLeft", Math.max(0, -gaze.eyeLX));
      setMorph("eyeLookInRight", Math.max(0, -gaze.eyeRX));
      setMorph("eyeLookOutRight", Math.max(0, gaze.eyeRX));
      setMorph("eyeLookUpLeft", Math.max(0, gaze.eyeLY));
      setMorph("eyeLookDownLeft", Math.max(0, -gaze.eyeLY));
      setMorph("eyeLookUpRight", Math.max(0, gaze.eyeRY));
      setMorph("eyeLookDownRight", Math.max(0, -gaze.eyeRY));
    }

    // ── Idle breathing ──
    if (rig.chest) rig.chest.rotation.y = idle.chestY;
    if (rig.spine) rig.spine.rotation.y = idle.spineY;
  });

  return <primitive object={scene} />;
}
