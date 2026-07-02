"use client";

import React, { useRef } from "react";
import { useFrame, useGLTF, THREE } from "@/lib/r3f";
import { useAvatarGaze } from "./use-avatar-gaze";
import { useAvatarIdle } from "./use-avatar-idle";

// Preload so the GLB starts fetching immediately when the module is imported.
useGLTF.preload("/avatar/sairam.glb");

/**
 * Loads the ReadyPlayerMe GLB and runs a single useFrame loop that:
 *   1. Lerps head/neck bone toward cursor pitch/yaw (controlsRef)
 *   2. Writes eye gaze to morph targets (useAvatarGaze)
 *   3. Applies idle breathing to chest/spine bones (useAvatarIdle)
 *
 * ALL mutations are direct ref/property writes — never setState.
 * frameloop="demand" on the parent Canvas means this only runs when
 * invalidate() is called (mousemove or touchmove from AvatarControls).
 */
export function AvatarMesh({
  controlsRef,
}: {
  controlsRef: React.MutableRefObject<{ pitch: number; yaw: number }>;
}): React.JSX.Element {
  const { scene } = useGLTF("/avatar/sairam.glb");

  // Resolve bones and mesh with morph targets once after load.
  const headBoneRef  = useRef<THREE.Bone | null>(null);
  const neckBoneRef  = useRef<THREE.Bone | null>(null);
  const chestBoneRef = useRef<THREE.Bone | null>(null);
  const spineBoneRef = useRef<THREE.Bone | null>(null);
  const morphMeshRef = useRef<THREE.SkinnedMesh | null>(null);

  // Resolve on first render (scene is stable after useGLTF).
  if (!headBoneRef.current) {
    scene.traverse((obj) => {
      // @ts-expect-error — THREE.Bone.isBone is a runtime flag not in the type stubs
      if (!obj.isBone && obj.type !== "SkinnedMesh") return;
      const name = obj.name.toLowerCase();
      if (name.includes("head"))  headBoneRef.current  = obj as THREE.Bone;
      if (name.includes("neck"))  neckBoneRef.current  = obj as THREE.Bone;
      if (name.includes("chest") || name.includes("spine1")) chestBoneRef.current = obj as THREE.Bone;
      if (name.includes("spine") && !name.includes("spine1")) spineBoneRef.current = obj as THREE.Bone;
      // ReadyPlayerMe morph targets live on the head mesh (Wolf3D_Head or similar).
      // Restrict to meshes whose name includes "head" or "wolf3d" so that secondary
      // morph-enabled meshes (teeth, body) in custom RPM exports don't silently win.
      if (
        obj.type === "SkinnedMesh" &&
        (obj as THREE.SkinnedMesh).morphTargetDictionary &&
        (name.includes("head") || name.includes("wolf3d"))
      ) {
        morphMeshRef.current = obj as THREE.SkinnedMesh;
      }
    });
  }

  const gazeRef = useAvatarGaze(controlsRef);
  const idleRef = useAvatarIdle();

  useFrame(() => {
    const { pitch, yaw } = controlsRef.current;
    const gaze = gazeRef.current;
    const idle = idleRef.current;

    // ── Head rotation (smooth lerp, 8% per frame at 60fps) ──
    if (headBoneRef.current) {
      headBoneRef.current.rotation.x = THREE.MathUtils.lerp(
        headBoneRef.current.rotation.x, pitch * 0.45, 0.08,
      );
      headBoneRef.current.rotation.y = THREE.MathUtils.lerp(
        headBoneRef.current.rotation.y, yaw * 0.45, 0.08,
      );
    }
    if (neckBoneRef.current) {
      neckBoneRef.current.rotation.x = THREE.MathUtils.lerp(
        neckBoneRef.current.rotation.x, pitch * 0.2, 0.06,
      );
      neckBoneRef.current.rotation.y = THREE.MathUtils.lerp(
        neckBoneRef.current.rotation.y, yaw * 0.2, 0.06,
      );
    }

    // ── Eye morph targets (ARKit standard — ReadyPlayerMe exports these) ──
    const mesh = morphMeshRef.current;
    if (mesh?.morphTargetDictionary && mesh.morphTargetInfluences) {
      const setMorph = (key: string, val: number) => {
        const i = mesh.morphTargetDictionary![key];
        if (i !== undefined) mesh.morphTargetInfluences![i] = Math.max(0, Math.min(1, val));
      };
      setMorph("eyeLookInLeft",   Math.max(0,  gaze.eyeLX));
      setMorph("eyeLookOutLeft",  Math.max(0, -gaze.eyeLX));
      setMorph("eyeLookInRight",  Math.max(0, -gaze.eyeRX));
      setMorph("eyeLookOutRight", Math.max(0,  gaze.eyeRX));
      setMorph("eyeLookUpLeft",   Math.max(0,  gaze.eyeLY));
      setMorph("eyeLookDownLeft", Math.max(0, -gaze.eyeLY));
      setMorph("eyeLookUpRight",  Math.max(0,  gaze.eyeRY));
      setMorph("eyeLookDownRight",Math.max(0, -gaze.eyeRY));
    }

    // ── Idle breathing ──
    if (chestBoneRef.current) chestBoneRef.current.rotation.y = idle.chestY;
    if (spineBoneRef.current) spineBoneRef.current.rotation.y = idle.spineY;
  });

  return <primitive object={scene} />;
}
