// Type-only import: erased at compile time, so this file adds NOTHING to the runtime graph
// and cannot affect the src/lib/r3f.ts barrel's single-module-node property (which the R3F
// chunk dedup depends on). Do not turn this into a value import.
import type * as THREE from "three";

/** The bones and morph-target mesh the animation loop drives. Any field may be null —
 *  a custom GLB export is not guaranteed to contain every rig node. */
export type AvatarRig = {
  head: THREE.Bone | null;
  neck: THREE.Bone | null;
  chest: THREE.Bone | null;
  spine: THREE.Bone | null;
  morph: THREE.SkinnedMesh | null;
};

/**
 * Walk a loaded GLB scene once and pick out the rig nodes by name.
 *
 * Lives in its own module, separate from avatar-mesh.tsx, for two reasons:
 *   1. avatar-mesh.tsx calls `useGLTF.preload()` at MODULE SCOPE, which fires a real network
 *      fetch on import — so importing that file from a unit test fails with ECONNREFUSED.
 *      Keeping this logic here makes it testable without mocking the whole R3F barrel.
 *   2. It is pure. It only needs `scene.traverse`, so a synthetic scene graph is enough to
 *      cover the name-matching rules — no WebGL context, no GLB fixture.
 *
 * Previously this ran inline during render and wrote into five separate refs, which
 * `react-hooks/refs` rejects (writing sibling refs during render is flagged even behind the
 * sanctioned `== null` guard), and which silently re-traversed the entire graph on every
 * render for any GLB lacking a "head" bone — the ref the guard keyed on never became non-null.
 */
export function resolveRig(scene: THREE.Object3D): AvatarRig {
  const rig: AvatarRig = {
    head: null,
    neck: null,
    chest: null,
    spine: null,
    morph: null,
  };

  scene.traverse((obj) => {
    // @ts-expect-error — THREE.Bone.isBone is a runtime flag not in the type stubs
    if (!obj.isBone && obj.type !== "SkinnedMesh") return;
    const name = obj.name.toLowerCase();

    if (name.includes("head")) rig.head = obj as THREE.Bone;
    if (name.includes("neck")) rig.neck = obj as THREE.Bone;
    // "spine1" is the chest in the ReadyPlayerMe/Mixamo naming convention, so it is claimed
    // as chest and explicitly excluded from spine below — otherwise one node would be both.
    if (name.includes("chest") || name.includes("spine1"))
      rig.chest = obj as THREE.Bone;
    if (name.includes("spine") && !name.includes("spine1"))
      rig.spine = obj as THREE.Bone;

    // ReadyPlayerMe morph targets live on the head mesh (Wolf3D_Head or similar).
    // Restrict to meshes whose name includes "head" so that secondary morph-enabled
    // meshes (teeth, body) in custom RPM exports don't silently win.
    if (
      obj.type === "SkinnedMesh" &&
      (obj as THREE.SkinnedMesh).morphTargetDictionary &&
      name.includes("head")
    ) {
      rig.morph = obj as THREE.SkinnedMesh;
    }
  });

  return rig;
}
