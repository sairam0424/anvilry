import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Invariant guard for the hero avatar GLB (`public/avatar/sairam.glb`).
 *
 * A binary asset regresses SILENTLY: swap in a different export and nothing type-checks or
 * fails — the avatar just loads wrong, or balloons the hero payload. These tests pin the
 * properties the runtime actually depends on, plus a size budget.
 *
 * Parses the GLB container directly (no three.js, no WebGL) so it runs in the plain node
 * project. Container layout: 12-byte header, then length-prefixed JSON and BIN chunks.
 */

const GLB_PATH = join(process.cwd(), "public", "avatar", "sairam.glb");

/** Max on-disk size. The asset is on the hero path when NEXT_PUBLIC_HERO_MODE=avatar, so a
 *  regression here is a user-visible download cost. Current: ~1.055 MB after WebP compression
 *  (down from 2.549 MB). Budget leaves headroom without allowing a return to uncompressed. */
const MAX_BYTES = 1.5 * 1024 * 1024;

type Gltf = {
  asset: { version: string };
  extensionsUsed?: string[];
  nodes?: { name?: string }[];
  meshes?: {
    name?: string;
    primitives: { targets?: unknown[]; attributes: Record<string, number> }[];
  }[];
  skins?: unknown[];
  images?: { mimeType?: string; bufferView?: number }[];
  bufferViews?: { byteOffset?: number; byteLength: number }[];
  accessors?: { count: number }[];
};

function readGlb(): { json: Gltf; bytes: Buffer; binOffset: number } {
  const bytes = readFileSync(GLB_PATH);
  expect(bytes.subarray(0, 4).toString()).toBe("glTF");
  expect(bytes.readUInt32LE(4)).toBe(2); // glTF 2.0
  const jsonLen = bytes.readUInt32LE(12);
  const json = JSON.parse(
    bytes.subarray(20, 20 + jsonLen).toString("utf8"),
  ) as Gltf;
  const pad = jsonLen % 4 ? 4 - (jsonLen % 4) : 0;
  return { json, bytes, binOffset: 20 + jsonLen + pad + 8 };
}

const nodeNames = (json: Gltf) =>
  (json.nodes ?? []).map((n) => n.name ?? "").filter(Boolean);

describe("avatar GLB — presence and budget", () => {
  it("exists at the path the loader requests", () => {
    // avatar-mesh.tsx hardcodes "/avatar/sairam.glb" in both useGLTF() and useGLTF.preload().
    expect(existsSync(GLB_PATH)).toBe(true);
  });

  it("stays within the hero-path size budget", () => {
    const bytes = readFileSync(GLB_PATH).byteLength;
    expect(bytes).toBeLessThan(MAX_BYTES);
  });

  it("is a valid glTF 2.0 binary container", () => {
    const { json } = readGlb();
    expect(json.asset.version).toBe("2.0");
  });
});

describe("avatar GLB — compression must not be undone", () => {
  it("keeps geometry compressed (meshopt + quantization)", () => {
    const { json } = readGlb();
    expect(json.extensionsUsed).toContain("EXT_meshopt_compression");
    expect(json.extensionsUsed).toContain("KHR_mesh_quantization");
  });

  it("stores every texture as WebP", () => {
    // EXT_texture_webp is natively supported by three.js GLTFLoader (verified in r184), so no
    // loader wiring is needed. Textures were ~90% of the original payload; a single 925 KB PNG
    // was the largest item. Re-introducing PNG/JPEG here would undo most of the savings.
    const { json } = readGlb();
    expect(json.extensionsUsed).toContain("EXT_texture_webp");
    const mimes = new Set((json.images ?? []).map((i) => i.mimeType));
    expect([...mimes]).toEqual(["image/webp"]);
  });

  it("has WebP payloads that are actually well-formed RIFF/WEBP", () => {
    const { json, bytes, binOffset } = readGlb();
    for (const img of json.images ?? []) {
      const bv = json.bufferViews![img.bufferView!];
      const start = binOffset + (bv.byteOffset ?? 0);
      const blob = bytes.subarray(start, start + bv.byteLength);
      expect(blob.subarray(0, 4).toString()).toBe("RIFF");
      expect(blob.subarray(8, 12).toString()).toBe("WEBP");
    }
  });
});

describe("avatar GLB — rig nodes the animation loop resolves by NAME", () => {
  // resolveRig() in src/components/hero-avatar/rig.ts matches on lowercased substrings.
  // If an export renames these, the avatar loads but never moves — no error anywhere.
  it("contains a head bone", () => {
    expect(
      nodeNames(readGlb().json).some((n) => n.toLowerCase().includes("head")),
    ).toBe(true);
  });

  it("contains a neck bone", () => {
    expect(
      nodeNames(readGlb().json).some((n) => n.toLowerCase().includes("neck")),
    ).toBe(true);
  });

  it("contains a chest bone (chest or spine1)", () => {
    const names = nodeNames(readGlb().json).map((n) => n.toLowerCase());
    expect(names.some((n) => n.includes("chest") || n.includes("spine1"))).toBe(
      true,
    );
  });

  it("contains a spine bone distinct from spine1", () => {
    const names = nodeNames(readGlb().json).map((n) => n.toLowerCase());
    expect(
      names.some((n) => n.includes("spine") && !n.includes("spine1")),
    ).toBe(true);
  });

  it("retains its skins (skinned meshes, not baked geometry)", () => {
    expect((readGlb().json.skins ?? []).length).toBeGreaterThan(0);
  });
});

describe("avatar GLB — documented gap: eye-gaze morph targets are ABSENT", () => {
  it("has zero morph targets, so the eye-gaze code path is currently inert", () => {
    // This is a REAL, pre-existing gap, asserted here so it is visible rather than mysterious.
    // avatar-mesh.tsx drives 8 ARKit eye morphs (eyeLookInLeft, eyeLookUpRight, …) via
    // rig.morph, but this asset is an AVATURN export with no blendshapes at all — meshes are
    // avaturn_body / avaturn_hair_0 / avaturn_hair_1 / avaturn_shoes_0 / avaturn_look_0.
    // The code comments and docs describe a ReadyPlayerMe export with `Wolf3D_Head`, which this
    // is not: no mesh name contains "head", so rig.morph resolves to null and every setMorph()
    // call is skipped. Head/neck rotation and idle breathing DO work (those are bone-driven).
    //
    // Flip this expectation to `toBeGreaterThan(0)` if a blendshape-enabled avatar is exported —
    // that is the signal eye gaze has become live.
    const { json } = readGlb();
    const targets = (json.meshes ?? [])
      .flatMap((m) => m.primitives)
      .flatMap((p) => p.targets ?? []);
    expect(targets.length).toBe(0);
  });

  it("has no mesh whose name matches the morph-target lookup", () => {
    const { json } = readGlb();
    const meshNames = (json.meshes ?? []).map((m) =>
      (m.name ?? "").toLowerCase(),
    );
    expect(meshNames.some((n) => n.includes("head"))).toBe(false);
  });
});
