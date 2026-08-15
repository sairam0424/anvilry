import { describe, it, expect } from "vitest";
import type * as THREE from "three";
import { resolveRig } from "./rig";

/**
 * resolveRig only ever calls `scene.traverse`, so a synthetic scene graph is sufficient —
 * no WebGL context, no GLB fixture, no R3F import. (This is why the function lives in
 * ./rig rather than in avatar-mesh.tsx, which fires a real network fetch on import via
 * module-scope `useGLTF.preload()`.)
 */

type FakeNode = {
  name: string;
  type: string;
  isBone?: boolean;
  morphTargetDictionary?: Record<string, number>;
};

function sceneOf(nodes: FakeNode[]): THREE.Object3D {
  return {
    traverse(cb: (obj: FakeNode) => void) {
      nodes.forEach(cb);
    },
  } as unknown as THREE.Object3D;
}

const bone = (name: string): FakeNode => ({ name, type: "Bone", isBone: true });
const skinnedMesh = (
  name: string,
  morphs?: Record<string, number>,
): FakeNode => ({
  name,
  type: "SkinnedMesh",
  morphTargetDictionary: morphs,
});

describe("resolveRig — bone matching", () => {
  it("resolves head, neck, chest and spine from ReadyPlayerMe-style names", () => {
    const rig = resolveRig(
      sceneOf([bone("Head"), bone("Neck"), bone("Spine2"), bone("Spine1")]),
    );
    expect(rig.head?.name).toBe("Head");
    expect(rig.neck?.name).toBe("Neck");
    // Spine1 is the chest in the RPM/Mixamo convention.
    expect(rig.chest?.name).toBe("Spine1");
    expect(rig.spine?.name).toBe("Spine2");
  });

  it("treats an explicit 'Chest' bone as chest", () => {
    const rig = resolveRig(sceneOf([bone("Chest"), bone("Spine")]));
    expect(rig.chest?.name).toBe("Chest");
    expect(rig.spine?.name).toBe("Spine");
  });

  it("never assigns one node to BOTH chest and spine (the spine1 exclusion)", () => {
    const rig = resolveRig(sceneOf([bone("Spine1")]));
    expect(rig.chest?.name).toBe("Spine1");
    // Without the !includes("spine1") guard this node would also land in spine.
    expect(rig.spine).toBeNull();
  });

  it("ignores nodes that are neither bones nor skinned meshes", () => {
    const rig = resolveRig(
      sceneOf([
        { name: "HeadLight", type: "PointLight" },
        { name: "NeckHelper", type: "Object3D" },
      ]),
    );
    expect(rig.head).toBeNull();
    expect(rig.neck).toBeNull();
  });

  it("is case-insensitive", () => {
    const rig = resolveRig(sceneOf([bone("mixamorig:HEAD"), bone("LeftNECK")]));
    expect(rig.head?.name).toBe("mixamorig:HEAD");
    expect(rig.neck?.name).toBe("LeftNECK");
  });
});

describe("resolveRig — morph-target mesh selection", () => {
  it("picks the head mesh that has morph targets", () => {
    const rig = resolveRig(
      sceneOf([
        skinnedMesh("Wolf3D_Head", { eyeLookInLeft: 0, eyeLookUpRight: 1 }),
      ]),
    );
    expect(rig.morph?.name).toBe("Wolf3D_Head");
  });

  it("does NOT let teeth/body meshes win even when they also expose morph targets", () => {
    // The name filter exists precisely so a secondary morph-enabled mesh cannot be selected.
    const rig = resolveRig(
      sceneOf([
        skinnedMesh("Wolf3D_Teeth", { mouthOpen: 0 }),
        skinnedMesh("Wolf3D_Body", { someShape: 0 }),
        skinnedMesh("Wolf3D_Head", { eyeLookInLeft: 0 }),
      ]),
    );
    expect(rig.morph?.name).toBe("Wolf3D_Head");
  });

  it("ignores a head mesh with no morph targets", () => {
    const rig = resolveRig(sceneOf([skinnedMesh("Wolf3D_Head", undefined)]));
    expect(rig.morph).toBeNull();
  });
});

describe("resolveRig — degenerate scenes", () => {
  it("returns an all-null rig for an empty scene instead of throwing", () => {
    // This is the case the previous implementation handled badly: because the render-time
    // guard keyed on the head ref, a GLB with no head bone re-traversed the ENTIRE scene
    // graph on every single render. Resolution now happens exactly once regardless.
    const rig = resolveRig(sceneOf([]));
    expect(rig).toEqual({
      head: null,
      neck: null,
      chest: null,
      spine: null,
      morph: null,
    });
  });

  it("returns a partial rig when the GLB is missing some nodes", () => {
    const rig = resolveRig(sceneOf([bone("Neck")]));
    expect(rig.neck?.name).toBe("Neck");
    expect(rig.head).toBeNull();
    expect(rig.chest).toBeNull();
    expect(rig.spine).toBeNull();
    expect(rig.morph).toBeNull();
  });
});
