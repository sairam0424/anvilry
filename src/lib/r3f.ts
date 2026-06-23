/**
 * Shared re-export barrel for @react-three/fiber, three, @react-three/drei,
 * and @react-three/postprocessing.
 *
 * All R3F-consuming dynamic components import from this barrel so that
 * webpack/turbopack sees a single module-graph node for the R3F universe —
 * allowing it to hoist a shared chunk above the multiple async import()
 * boundaries instead of emitting duplicate 873KB chunks per boundary.
 *
 * C-3 Option B: fixes the twin-chunk split identified in the bundle audit.
 *
 * Named exports only (no wildcard re-exports) to avoid name collisions between
 * @react-three/fiber, @react-three/drei, and @react-three/postprocessing.
 */

// ---- @react-three/fiber ----
export { Canvas, useFrame, useThree, useLoader, useGraph, extend } from "@react-three/fiber";
export type { ThreeEvent, RootState, RenderCallback } from "@react-three/fiber";

// ---- three (namespace re-export) ----
export * as THREE from "three";

// ---- @react-three/drei ----
export { OrbitControls, Billboard, Text, Html, useTexture, useGLTF, Float, MeshDistortMaterial, GradientTexture } from "@react-three/drei";

// ---- @react-three/postprocessing ----
export { EffectComposer, Bloom, Vignette, Noise, ChromaticAberration } from "@react-three/postprocessing";
