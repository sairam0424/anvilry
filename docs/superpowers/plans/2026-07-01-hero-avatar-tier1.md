# Hero Avatar Tier 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cursor-reactive 3D avatar (head tracking + procedural eye gaze + idle breathing) to the Anvilry hero section, behind two feature flags (`NEXT_PUBLIC_HERO_MODE` and `NEXT_PUBLIC_AVATAR_POSITION`), with zero bundle impact when disabled.

**Architecture:** Six new files in `src/components/hero-avatar/` are lazy-loaded behind a `dynamic()` boundary. `hero.tsx` gets a 3-line conditional that swaps `<HeroGraph />` for `<HeroAvatar />` when `NEXT_PUBLIC_HERO_MODE=avatar`. All animation runs inside a single `useFrame` loop via direct ref mutation (no `setState`) using `frameloop="demand"` so the canvas renders only when something changes. The avatar model is a ReadyPlayerMe GLB placed at `/public/avatar/sairam.glb`.

**Tech Stack:** Next.js 16, React Three Fiber 9.x (`@react-three/fiber`), Three.js r184, `@react-three/drei` (`useGLTF` already in barrel), Vitest, Playwright. Zero new npm dependencies.

## Global Constraints

- Branch from `develop` — PR targets `develop`, never `main`
- No `Co-Authored-By` in any commit message
- No new npm dependencies — `useGLTF` is already in `src/lib/r3f.ts`; `useAnimations` must be added to the barrel in Task 1
- `NEXT_PUBLIC_*` constants read **inside function/component bodies only** — never at module scope (breaks `vi.stubEnv` in tests)
- `frameloop="demand"` on every R3F Canvas — never perpetual render loop
- Never call `setState` inside `useFrame` — mutate refs and `mesh.current.*` directly
- All animation hooks return **refs** (not state) — safe to read inside `useFrame`
- Files must stay under 500 lines
- `pnpm build` must be green after every task (484 tests currently passing)
- DOM tests named `*.dom.test.tsx`; node tests named `*.test.ts`
- Avatar canvas is `aria-hidden="true"` and `pointer-events-none` — purely decorative
- The existing `src/components/hero-graph/` is **never modified**
- `NEXT_PUBLIC_HERO_MODE` default (unset) = `"graph"` — zero behaviour change

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/r3f.ts` | Modify | Add `useAnimations` export from `@react-three/drei` |
| `src/components/hero-avatar/use-avatar-gaze.ts` | Create | Procedural eye gaze: drift + saccades, returns ref |
| `src/components/hero-avatar/use-avatar-idle.ts` | Create | Idle breathing: chest/spine oscillation, returns ref |
| `src/components/hero-avatar/avatar-controls.tsx` | Create | Mouse/touch → pitch/yaw → controlsRef (no setState) |
| `src/components/hero-avatar/avatar-mesh.tsx` | Create | useGLTF loader + single useFrame animation loop |
| `src/components/hero-avatar/avatar-scene.tsx` | Create | R3F Canvas wrapper, frameloop="demand" |
| `src/components/hero-avatar/index.tsx` | Create | Gate: reads flags, picks layout, lazy-loads scene |
| `src/components/home/hero.tsx` | Modify | 3-line conditional: HeroAvatar vs HeroGraph |
| `docs/configuration.md` | Modify | Two new flag rows in Beast Mode table |
| `src/components/hero-avatar/use-avatar-gaze.test.ts` | Create | Unit: clamp bounds + directional tracking |
| `src/components/hero-avatar/use-avatar-idle.test.ts` | Create | Unit: breath amplitude + spine ratio |
| `src/components/hero-avatar/index.dom.test.tsx` | Create | DOM: flag routing + layout variants + fallback |

---

## Task 1: Add `useAnimations` to the R3F barrel

**Files:**
- Modify: `src/lib/r3f.ts`

**Interfaces:**
- Produces: `useAnimations` available via `import { useAnimations } from "@/lib/r3f"` for Task 4

---

- [ ] **Step 1: Read the current barrel**

```bash
cat /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/src/lib/r3f.ts
```

Confirm the drei line currently exports: `OrbitControls, Billboard, Text, Html, useTexture, useGLTF, Float, MeshDistortMaterial, GradientTexture`

- [ ] **Step 2: Add `useAnimations` to the drei export line**

In `src/lib/r3f.ts`, change the drei export line from:

```typescript
export { OrbitControls, Billboard, Text, Html, useTexture, useGLTF, Float, MeshDistortMaterial, GradientTexture } from "@react-three/drei";
```

To:

```typescript
export { OrbitControls, Billboard, Text, Html, useTexture, useGLTF, useAnimations, Float, MeshDistortMaterial, GradientTexture } from "@react-three/drei";
```

- [ ] **Step 3: Verify build passes**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev && pnpm build
```

Expected: green, 484 tests pass. If TypeScript complains about `useAnimations` not being in `@react-three/drei`, run:
```bash
grep -r "useAnimations" node_modules/@react-three/drei/dist/drei.cjs.d.ts | head -3
```
It is exported — `@react-three/drei ^10.7.7` includes it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/r3f.ts
git commit -m "chore(r3f): add useAnimations to the shared R3F barrel"
```

---

## Task 2: Procedural animation hooks — gaze + idle

**Files:**
- Create: `src/components/hero-avatar/use-avatar-gaze.ts`
- Create: `src/components/hero-avatar/use-avatar-idle.ts`
- Create: `src/components/hero-avatar/use-avatar-gaze.test.ts`
- Create: `src/components/hero-avatar/use-avatar-idle.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  // use-avatar-gaze.ts
  interface GazeOutput { eyeLX: number; eyeLY: number; eyeRX: number; eyeRY: number }
  export function useAvatarGaze(
    controlsRef: React.RefObject<{ pitch: number; yaw: number }>
  ): React.RefObject<GazeOutput>

  // use-avatar-idle.ts
  interface IdleOutput { chestY: number; spineY: number }
  export function useAvatarIdle(): React.RefObject<IdleOutput>
  ```
- Both consumed by `AvatarMesh` in Task 4

---

- [ ] **Step 1: Write failing tests for `use-avatar-gaze`**

Create `src/components/hero-avatar/use-avatar-gaze.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeGaze } from "./use-avatar-gaze";

/**
 * computeGaze is a pure function extracted from the hook for testability.
 * It takes elapsed time t and current pitch/yaw and returns GazeOutput.
 */
describe("computeGaze", () => {
  it("eyeLX stays within clamp bounds [-0.15, 0.15] across 1000 ticks", () => {
    for (let i = 0; i < 1000; i++) {
      const t = i * 0.016;
      const result = computeGaze(t, 0, 0);
      expect(result.eyeLX).toBeGreaterThanOrEqual(-0.15);
      expect(result.eyeLX).toBeLessThanOrEqual(0.15);
    }
  });

  it("eyeLY stays within clamp bounds [-0.1, 0.1] across 1000 ticks", () => {
    for (let i = 0; i < 1000; i++) {
      const t = i * 0.016;
      const result = computeGaze(t, 0, 0);
      expect(result.eyeLY).toBeGreaterThanOrEqual(-0.1);
      expect(result.eyeLY).toBeLessThanOrEqual(0.1);
    }
  });

  it("positive yaw produces positive eyeLX component (eyes track cursor right)", () => {
    const result = computeGaze(0, 0, 1.0); // yaw = 1.0 (full right)
    expect(result.eyeLX).toBeGreaterThan(0);
  });

  it("negative yaw produces negative eyeLX component (eyes track cursor left)", () => {
    const result = computeGaze(0, 0, -1.0); // yaw = -1.0 (full left)
    expect(result.eyeLX).toBeLessThan(0);
  });

  it("left and right eye values are symmetric (eyeRX mirrors eyeLX)", () => {
    const result = computeGaze(10, 0.3, 0.5);
    expect(result.eyeRX).toBeCloseTo(result.eyeLX, 10);
    expect(result.eyeRY).toBeCloseTo(result.eyeLY, 10);
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
npx vitest run src/components/hero-avatar/use-avatar-gaze.test.ts
```

Expected: FAIL — `computeGaze` not found.

- [ ] **Step 3: Write failing tests for `use-avatar-idle`**

Create `src/components/hero-avatar/use-avatar-idle.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeIdle } from "./use-avatar-idle";

/**
 * computeIdle is a pure function extracted from the hook for testability.
 * It takes elapsed time t and returns IdleOutput.
 */
describe("computeIdle", () => {
  it("chestY stays within breath amplitude [-0.003, 0.003]", () => {
    for (let i = 0; i < 1000; i++) {
      const t = i * 0.016;
      const result = computeIdle(t);
      expect(result.chestY).toBeGreaterThanOrEqual(-0.003);
      expect(result.chestY).toBeLessThanOrEqual(0.003);
    }
  });

  it("spineY is always exactly chestY * 0.5", () => {
    for (let i = 0; i < 100; i++) {
      const t = i * 0.1;
      const result = computeIdle(t);
      expect(result.spineY).toBeCloseTo(result.chestY * 0.5, 10);
    }
  });

  it("chestY changes over time (not static)", () => {
    const a = computeIdle(0);
    const b = computeIdle(1.5);
    expect(a.chestY).not.toBe(b.chestY);
  });
});
```

- [ ] **Step 4: Run test — confirm it fails**

```bash
npx vitest run src/components/hero-avatar/use-avatar-idle.test.ts
```

Expected: FAIL — `computeIdle` not found.

- [ ] **Step 5: Implement `use-avatar-gaze.ts`**

Create `src/components/hero-avatar/use-avatar-gaze.ts`:

```typescript
import { useRef } from "react";
import { useFrame } from "@/lib/r3f";

export interface GazeOutput {
  eyeLX: number;
  eyeLY: number;
  eyeRX: number;
  eyeRY: number;
}

/**
 * Pure function extracted for testability.
 * Multi-frequency drift + hash-based saccades (verified 3-0 in deep-research).
 * Saccade: involuntary micro-jump every ~2.5s — makes eyes feel alive, not glassy.
 */
export function computeGaze(
  t: number,
  pitch: number,
  yaw: number,
): GazeOutput {
  // Slow float: two sine waves at different frequencies
  const driftX = Math.sin(t * 0.31) * Math.cos(t * 0.73) * 0.008;
  const driftY = Math.sin(t * 0.17) * Math.cos(t * 0.59) * 0.006;

  // Deterministic saccade: hash of 2.5s time bucket → float in [-0.015, 0.015]
  const bucket = Math.floor(t / 2.5);
  const saccade = ((Math.sin(bucket * 127.1 + 311.7) * 43758.5453) % 1) * 0.015;

  const rawX = yaw * 0.4 + driftX + saccade;
  const rawY = pitch * 0.4 + driftY;

  const eyeLX = Math.max(-0.15, Math.min(0.15, rawX));
  const eyeLY = Math.max(-0.1, Math.min(0.1, rawY));

  return { eyeLX, eyeLY, eyeRX: eyeLX, eyeRY: eyeLY };
}

/**
 * Returns a ref (not state) — safe to read inside useFrame without re-renders.
 * Updated every frame by the hook's own useFrame subscription.
 */
export function useAvatarGaze(
  controlsRef: React.RefObject<{ pitch: number; yaw: number }>,
): React.RefObject<GazeOutput> {
  const gazeRef = useRef<GazeOutput>({ eyeLX: 0, eyeLY: 0, eyeRX: 0, eyeRY: 0 });

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const { pitch, yaw } = controlsRef.current ?? { pitch: 0, yaw: 0 };
    gazeRef.current = computeGaze(t, pitch, yaw);
  });

  return gazeRef;
}
```

- [ ] **Step 6: Implement `use-avatar-idle.ts`**

Create `src/components/hero-avatar/use-avatar-idle.ts`:

```typescript
import { useRef } from "react";
import { useFrame } from "@/lib/r3f";

export interface IdleOutput {
  chestY: number;
  spineY: number;
}

/**
 * Pure function extracted for testability.
 * ~15s per full breath cycle (0.42 rad/s), amplitude 0.003 radians — subtle.
 */
export function computeIdle(t: number): IdleOutput {
  const breathe = Math.sin(t * 0.42) * 0.003;
  return { chestY: breathe, spineY: breathe * 0.5 };
}

/**
 * Returns a ref (not state) — safe to read inside useFrame without re-renders.
 */
export function useAvatarIdle(): React.RefObject<IdleOutput> {
  const idleRef = useRef<IdleOutput>({ chestY: 0, spineY: 0 });

  useFrame(({ clock }) => {
    idleRef.current = computeIdle(clock.getElapsedTime());
  });

  return idleRef;
}
```

- [ ] **Step 7: Run both tests — confirm they pass**

```bash
npx vitest run src/components/hero-avatar/use-avatar-gaze.test.ts src/components/hero-avatar/use-avatar-idle.test.ts
```

Expected: 8 tests pass (5 gaze + 3 idle).

- [ ] **Step 8: Run full suite**

```bash
pnpm test
```

Expected: green, ≥484 tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/hero-avatar/use-avatar-gaze.ts \
        src/components/hero-avatar/use-avatar-idle.ts \
        src/components/hero-avatar/use-avatar-gaze.test.ts \
        src/components/hero-avatar/use-avatar-idle.test.ts
git commit -m "feat(avatar): procedural gaze (drift+saccades) + idle breathing hooks with tests"
```

---

## Task 3: `AvatarControls` — mouse/touch → pitch/yaw ref

**Files:**
- Create: `src/components/hero-avatar/avatar-controls.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks
- Produces:
  ```typescript
  interface ControlsRef { pitch: number; yaw: number }
  // AvatarControls is rendered inside the R3F Canvas.
  // It writes to controlsRef and calls invalidate() — no return value.
  export function AvatarControls(props: {
    controlsRef: React.MutableRefObject<ControlsRef>
  }): null
  ```
- Consumed by Task 4 (`AvatarMesh`) and Task 5 (`AvatarScene`)

---

- [ ] **Step 1: Create `avatar-controls.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useThree } from "@/lib/r3f";

interface ControlsRef {
  pitch: number;
  yaw: number;
}

/**
 * Attaches window-level mousemove + touchmove listeners.
 * The Canvas has pointer-events:none so R3F's built-in pointer tracking
 * never fires — we track it at the window level instead, exactly as
 * privacypuppet does (verified 3-0 in deep-research).
 *
 * Writes normalized [-1, 1] pitch/yaw into controlsRef.
 * Calls invalidate() so frameloop="demand" knows to render a new frame.
 * Never calls setState — zero React re-renders.
 */
export function AvatarControls({
  controlsRef,
}: {
  controlsRef: React.MutableRefObject<ControlsRef>;
}): null {
  const { invalidate } = useThree();

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      // Normalize to [-1, 1]: 0 = center, -1 = left/top, 1 = right/bottom
      controlsRef.current.yaw   =  (e.clientX / window.innerWidth  - 0.5) * 2;
      controlsRef.current.pitch = -(e.clientY / window.innerHeight - 0.5) * 2;
      invalidate();
    }

    function onTouchMove(e: TouchEvent) {
      if (!e.touches[0]) return;
      controlsRef.current.yaw   =  (e.touches[0].clientX / window.innerWidth  - 0.5) * 2;
      controlsRef.current.pitch = -(e.touches[0].clientY / window.innerHeight - 0.5) * 2;
      invalidate();
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [controlsRef, invalidate]);

  return null;
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add src/components/hero-avatar/avatar-controls.tsx
git commit -m "feat(avatar): AvatarControls — window mousemove/touchmove to pitch/yaw ref"
```

---

## Task 4: `AvatarMesh` — GLB loader + single useFrame animation loop

**Files:**
- Create: `src/components/hero-avatar/avatar-mesh.tsx`

**Interfaces:**
- Consumes:
  ```typescript
  import { useAvatarGaze, GazeOutput } from "./use-avatar-gaze"
  import { useAvatarIdle, IdleOutput } from "./use-avatar-idle"
  import { useGLTF, useFrame, THREE } from "@/lib/r3f"
  ```
- Produces:
  ```typescript
  export function AvatarMesh(props: {
    controlsRef: React.MutableRefObject<{ pitch: number; yaw: number }>
  }): JSX.Element
  ```
- Consumed by Task 5 (`AvatarScene`)

---

- [ ] **Step 1: Create `avatar-mesh.tsx`**

```tsx
"use client";

import { useRef } from "react";
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
 * invalidate() is called (mousemove or the gaze/breathing tick).
 */
export function AvatarMesh({
  controlsRef,
}: {
  controlsRef: React.MutableRefObject<{ pitch: number; yaw: number }>;
}): JSX.Element {
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
      if (!(obj as THREE.Bone).isBone && obj.type !== "SkinnedMesh") return;
      const name = obj.name.toLowerCase();
      if (name.includes("head"))  headBoneRef.current  = obj as THREE.Bone;
      if (name.includes("neck"))  neckBoneRef.current  = obj as THREE.Bone;
      if (name.includes("chest") || name.includes("spine1")) chestBoneRef.current = obj as THREE.Bone;
      if (name.includes("spine") && !name.includes("spine1")) spineBoneRef.current = obj as THREE.Bone;
      // ReadyPlayerMe morph targets live on the head mesh (Wolf3D_Head or similar)
      if (
        obj.type === "SkinnedMesh" &&
        (obj as THREE.SkinnedMesh).morphTargetDictionary
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm build
```

Expected: green. If you see `Property 'isBone' does not exist on type 'Object3D'`, add `// @ts-expect-error — THREE.Bone.isBone is a runtime flag not in the type stubs` above that line.

- [ ] **Step 3: Commit**

```bash
git add src/components/hero-avatar/avatar-mesh.tsx
git commit -m "feat(avatar): AvatarMesh — GLB loader with head tracking + gaze + breathing in one useFrame loop"
```

---

## Task 5: `AvatarScene` — R3F Canvas wrapper

**Files:**
- Create: `src/components/hero-avatar/avatar-scene.tsx`

**Interfaces:**
- Consumes:
  ```typescript
  import { AvatarMesh } from "./avatar-mesh"
  import { AvatarControls } from "./avatar-controls"
  import { Canvas } from "@/lib/r3f"
  ```
- Produces:
  ```typescript
  export function AvatarScene(): JSX.Element
  ```
- Consumed by Task 6 (`HeroAvatar` index)

---

- [ ] **Step 1: Create `avatar-scene.tsx`**

```tsx
"use client";

import { useRef } from "react";
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
export function AvatarScene(): JSX.Element {
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
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add src/components/hero-avatar/avatar-scene.tsx
git commit -m "feat(avatar): AvatarScene — R3F Canvas, frameloop=demand, transparent bg"
```

---

## Task 6: `HeroAvatar` gate — flag routing + layout variants + DOM tests

**Files:**
- Create: `src/components/hero-avatar/index.tsx`
- Create: `src/components/hero-avatar/index.dom.test.tsx`

**Interfaces:**
- Consumes:
  ```typescript
  import { AvatarScene } from "./avatar-scene"       // lazy via dynamic()
  import { useReducedMotion } from "@/lib/use-reduced-motion"
  import { useMediaQuery } from "@/lib/use-media-query"
  import { useView } from "@/components/view-context"
  import { WebGLBoundary } from "@/components/game/webgl-boundary"
  import dynamic from "next/dynamic"
  ```
- Produces:
  ```typescript
  export function HeroAvatar(): JSX.Element
  ```
- Consumed by Task 7 (`hero.tsx`)

---

- [ ] **Step 1: Write failing DOM tests**

Create `src/components/hero-avatar/index.dom.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock next/dynamic so the lazy AvatarScene renders synchronously in tests.
vi.mock("next/dynamic", () => ({
  default: (fn: () => Promise<{ AvatarScene: React.FC }>) => {
    // Return a component that renders its target synchronously.
    const Comp = (props: object) => {
      const [C, setC] = React.useState<React.FC | null>(null);
      React.useEffect(() => {
        fn().then((m) => setC(() => m.AvatarScene));
      }, []);
      return C ? <C {...props} /> : null;
    };
    return Comp;
  },
}));

// AvatarScene itself renders a canvas — mock it to keep tests fast.
vi.mock("./avatar-scene", () => ({
  AvatarScene: () => <canvas data-testid="avatar-canvas" />,
}));

// Mock view context.
vi.mock("@/components/view-context", () => ({
  useView: () => ({ view: "classic", setView: vi.fn() }),
}));

// Mock WebGLBoundary to pass through children.
vi.mock("@/components/game/webgl-boundary", () => ({
  WebGLBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("HeroAvatar", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders CSS glow fallback on mobile (< 768px)", async () => {
    vi.stubEnv("NEXT_PUBLIC_HERO_MODE", "avatar");
    // jsdom: matchMedia returns false by default — simulates mobile
    const { HeroAvatar } = await import("./index");
    render(<HeroAvatar />);
    expect(screen.queryByTestId("avatar-canvas")).toBeNull();
    // glow div is always present
    expect(document.querySelector(".blur-3xl")).toBeTruthy();
  });

  it("hero-side position applies correct mask class", async () => {
    vi.stubEnv("NEXT_PUBLIC_HERO_MODE", "avatar");
    vi.stubEnv("NEXT_PUBLIC_AVATAR_POSITION", "hero-side");
    const { HeroAvatar } = await import("./index");
    const { container } = render(<HeroAvatar />);
    // The mask wrapper has a specific mask-image class
    expect(container.innerHTML).toContain("mask-image");
  });

  it("hero-split position applies border-l class", async () => {
    vi.stubEnv("NEXT_PUBLIC_HERO_MODE", "avatar");
    vi.stubEnv("NEXT_PUBLIC_AVATAR_POSITION", "hero-split");
    const { HeroAvatar } = await import("./index");
    const { container } = render(<HeroAvatar />);
    expect(container.innerHTML).toContain("border-l");
  });

  it("hero-top position applies translate-x-1/2 centering class", async () => {
    vi.stubEnv("NEXT_PUBLIC_HERO_MODE", "avatar");
    vi.stubEnv("NEXT_PUBLIC_AVATAR_POSITION", "hero-top");
    const { HeroAvatar } = await import("./index");
    const { container } = render(<HeroAvatar />);
    expect(container.innerHTML).toContain("-translate-x-1/2");
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npx vitest run src/components/hero-avatar/index.dom.test.tsx
```

Expected: FAIL — `./index` module not found.

- [ ] **Step 3: Implement `src/components/hero-avatar/index.tsx`**

```tsx
"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useMediaQuery } from "@/lib/use-media-query";
import { useView } from "@/components/view-context";
import { WebGLBoundary } from "@/components/game/webgl-boundary";

const AvatarSceneLazy = dynamic(
  () => import("./avatar-scene").then((m) => ({ default: m.AvatarScene })),
  { ssr: false },
);

/**
 * CSS glow fallback — identical to HeroGraph fallback so switching between
 * hero modes produces no visible layout shift on the fallback path.
 */
function GlowFallback() {
  return (
    <>
      <div className="absolute right-[-10%] top-[-20%] h-[36rem] w-[36rem] rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute left-[10%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-violet/10 blur-3xl" />
    </>
  );
}

/**
 * Hero avatar gate.
 *
 * Reads both feature flags inside the function body (never module scope)
 * so vi.stubEnv works in tests.
 *
 * Guards (same as HeroGraph):
 *   - Desktop only (≥768px) — canvas too heavy for mobile
 *   - prefers-reduced-motion: off — animation would be distracting
 *   - Classic view only — unmount when gamified/chat/dev are active
 *
 * Three layout positions controlled by NEXT_PUBLIC_AVATAR_POSITION:
 *   "hero-side"  (default) — right slot, behind text (same zone as knowledge graph)
 *   "hero-split"           — right column with border separator
 *   "hero-top"             — centered above headline
 */
export function HeroAvatar(): JSX.Element {
  const reduced   = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { view }  = useView();

  // Read flags inside function body — NOT module scope.
  const position = process.env.NEXT_PUBLIC_AVATAR_POSITION ?? "hero-side";

  const showWebGL = isDesktop && !reduced && view === "classic";

  const scene = showWebGL ? (
    <WebGLBoundary>
      <AvatarSceneLazy />
    </WebGLBoundary>
  ) : null;

  // ── hero-side: right zone, behind text, same slot as knowledge graph ──
  if (position === "hero-side") {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <GlowFallback />
        {showWebGL && (
          <>
            <div className="absolute inset-0 opacity-60 [mask-image:radial-gradient(45%_60%_at_82%_45%,#000_30%,transparent_78%)]">
              {scene}
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/85 via-45% to-transparent" />
          </>
        )}
      </div>
    );
  }

  // ── hero-split: right column with left border ──
  if (position === "hero-split") {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-[42%] overflow-hidden border-l border-border"
      >
        <GlowFallback />
        {showWebGL && (
          <div className="h-full w-full">
            {scene}
          </div>
        )}
      </div>
    );
  }

  // ── hero-top: centered above headline ──
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-8 -z-10 h-36 w-36 -translate-x-1/2 overflow-hidden"
    >
      {showWebGL ? scene : <GlowFallback />}
    </div>
  );
}
```

- [ ] **Step 4: Run DOM tests — confirm they pass**

```bash
npx vitest run src/components/hero-avatar/index.dom.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: green, ≥488 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/hero-avatar/index.tsx \
        src/components/hero-avatar/index.dom.test.tsx
git commit -m "feat(avatar): HeroAvatar gate — flag routing, 3 layout variants, mobile/motion fallback"
```

---

## Task 7: Wire into `hero.tsx` + document flags

**Files:**
- Modify: `src/components/home/hero.tsx`
- Modify: `docs/configuration.md`

**Interfaces:**
- Consumes: `HeroAvatar` from `@/components/hero-avatar` (Task 6)
- Produces: final feature — `NEXT_PUBLIC_HERO_MODE=avatar` replaces the knowledge graph

---

- [ ] **Step 1: Read `hero.tsx` in full before editing**

```bash
cat /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/src/components/home/hero.tsx
```

Verify line 5: `import { HeroGraph } from "@/components/hero-graph";`

- [ ] **Step 2: Edit `hero.tsx`**

Add the import and replace the `<HeroGraph />` call. The full file after change:

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile, impactMetrics } from "@/lib/profile";
import { HeroGraph } from "@/components/hero-graph";
import { HeroAvatar } from "@/components/hero-avatar";

/**
 * Above-the-fold hero. Renders VISIBLE at first paint via a pure-CSS entrance
 * (.hero-rise) — no JS/hydration gate, so it never flashes invisible-then-in and
 * doesn't delay LCP. (Below-the-fold sections use the JS-gated <Reveal>.) The WebGL
 * graph mounts behind this via a dynamic, client-only slot — never blocking paint.
 */
export function Hero() {
  // Read flag inside function body — NOT module scope (required for vi.stubEnv in tests).
  const heroMode = process.env.NEXT_PUBLIC_HERO_MODE;

  return (
    <section className="relative overflow-hidden">
      {/* WebGL slot: avatar when NEXT_PUBLIC_HERO_MODE=avatar, otherwise knowledge-graph (default). */}
      {heroMode === "avatar" ? <HeroAvatar /> : <HeroGraph />}
      <div className="relative mx-auto w-full max-w-5xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <p className="hero-rise mono-label">{`> ${profile.role} @ ${profile.company}`}</p>

        <h1
          className="hero-rise mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl"
          style={{ animationDelay: "0.05s" }}
        >
          I build production{" "}
          <span className="text-accent">multi-agent LLM systems</span> and the{" "}
          <span className="text-violet">event-driven backends</span> behind them.
        </h1>

        <p className="hero-rise mt-6 max-w-2xl text-lg text-fg-muted" style={{ animationDelay: "0.1s" }}>
          {profile.subhead}
        </p>

        <div className="hero-rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.15s" }}>
          <Link
            href="/work"
            className="group inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-strong"
          >
            See my work
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/resume"
            className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-5 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-bg-elevated"
          >
            Résumé
          </Link>
          <div className="flex items-center gap-3 pl-1">
            <a href={profile.links.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="text-fg-muted hover:text-accent">
              <Github size={20} />
            </a>
            <a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-fg-muted hover:text-accent">
              <Linkedin size={20} />
            </a>
          </div>
        </div>

        <dl
          className="hero-rise mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3"
          style={{ animationDelay: "0.2s" }}
        >
          {impactMetrics.map((m) => (
            <div key={m.sub} className="bg-bg-surface p-4">
              <dt className="text-2xl font-semibold text-fg sm:text-3xl">{m.value}</dt>
              <dd className="mt-1 text-xs text-fg-muted">
                {m.label}
                <span className="block text-fg-subtle">{m.sub}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Read `docs/configuration.md` Beast Mode section before editing**

```bash
grep -n "Beast Mode\|NEXT_PUBLIC_RESUME_VARIANTS\|NEXT_PUBLIC_DISCOVERY" \
  /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/docs/configuration.md | head -10
```

Note the line number of the `NEXT_PUBLIC_RESUME_VARIANTS` row to insert the new rows after it.

- [ ] **Step 4: Add two rows to the Beast Mode table in `docs/configuration.md`**

After the `NEXT_PUBLIC_RESUME_VARIANTS` row, insert:

```markdown
| `NEXT_PUBLIC_HERO_MODE` | v3.3 | Switch the hero WebGL slot. `"graph"` (default) = knowledge-graph (current). `"avatar"` = cursor-reactive 3D avatar with procedural gaze and idle breathing (requires `/public/avatar/sairam.glb`). Redeploy required. |
| `NEXT_PUBLIC_AVATAR_POSITION` | v3.3 | Avatar layout position when `NEXT_PUBLIC_HERO_MODE=avatar`. `"hero-side"` (default) = right slot replacing graph. `"hero-split"` = two-column layout (text left, avatar right). `"hero-top"` = avatar centered above headline. Ignored when hero mode is `"graph"`. Redeploy required. |
```

- [ ] **Step 5: Run full build**

```bash
pnpm build
```

Expected: green, ≥488 tests pass. If you see a TypeScript error about `heroMode` being unused or shadowed, check the `process.env.NEXT_PUBLIC_HERO_MODE` read is inside the `Hero()` function body.

- [ ] **Step 6: Smoke-test locally with avatar mode**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
# Temporarily add the flag to .env.local
echo "NEXT_PUBLIC_HERO_MODE=avatar" >> .env.local
echo "NEXT_PUBLIC_AVATAR_POSITION=hero-side" >> .env.local
pnpm dev
```

Open `http://localhost:3000`. Verify:
- Hero renders (no crash, no blank page)
- CSS glow fallback visible (avatar GLB is not present yet at `/public/avatar/sairam.glb` — this is expected; fallback = glow)
- Move mouse across the hero area — no errors in console
- Switch to Play/Chat view — no console errors about leaked WebGL contexts

Remove the test flags from `.env.local` after smoke-test:

```bash
grep -v "NEXT_PUBLIC_HERO_MODE\|NEXT_PUBLIC_AVATAR_POSITION" .env.local > /tmp/env_tmp \
  && mv /tmp/env_tmp .env.local
```

- [ ] **Step 7: Commit**

```bash
git add src/components/home/hero.tsx docs/configuration.md
git commit -m "feat(avatar): wire HeroAvatar into hero.tsx, document NEXT_PUBLIC_HERO_MODE + NEXT_PUBLIC_AVATAR_POSITION flags"
```

---

## Task 8: Avatar GLB asset + production smoke-test

**Files:**
- Create: `/public/avatar/sairam.glb` (binary asset — you export this from ReadyPlayerMe)
- Create: `/public/avatar/.gitkeep` (marks the directory in git before the GLB exists)

**This task has no code to write** — it's about getting the model file in place and verifying the full feature end-to-end.

---

- [ ] **Step 1: Export your avatar from ReadyPlayerMe**

1. Go to `https://readyplayer.me/avatar`
2. Use your phone camera or upload a selfie to generate your avatar
3. On the export screen, select:
   - Format: **GLB**
   - Quality: **Medium** (targets ~800KB)
   - Morph targets: **ARKit Face Blendshapes** — this is mandatory for eye/expression animation
   - Texture atlas: **1024×1024**
4. Download the `.glb` file

- [ ] **Step 2: Place the file**

```bash
mkdir -p /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/public/avatar
cp ~/Downloads/<your-avatar>.glb \
   /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/public/avatar/sairam.glb

# Verify size is reasonable (should be 400KB–2MB)
ls -lh /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/public/avatar/sairam.glb
```

- [ ] **Step 3: Verify morph targets are present in the GLB**

```bash
node -e "
const { NodeIO } = require('@gltf-transform/core');
const io = new NodeIO();
io.read('public/avatar/sairam.glb').then(doc => {
  doc.getRoot().listMeshes().forEach(m => {
    m.listPrimitives().forEach(p => {
      const targets = p.listTargets().map(t => t.getName());
      if (targets.length) console.log('Mesh:', m.getName(), '| Targets:', targets.slice(0,8).join(', '));
    });
  });
});
" 2>/dev/null || echo "gltf-transform not installed — check visually in https://gltf.pmnd.rs instead"
```

If the node script fails, drag the `.glb` into `https://gltf.pmnd.rs` and look for `eyeLookInLeft`, `eyeLookOutLeft` etc. in the Morph panel. These must be present.

- [ ] **Step 4: Smoke-test with the real GLB**

```bash
echo "NEXT_PUBLIC_HERO_MODE=avatar" >> .env.local
pnpm dev
```

Open `http://localhost:3000`. Verify:
- Avatar renders in the hero section (head + shoulders visible)
- Moving the mouse left/right → avatar head follows
- Moving the mouse up/down → avatar head tilts
- Eyes have subtle drift (saccades) even when mouse is still
- Subtle breathing movement visible on chest
- No console errors
- Switch to Play/Chat/Dev views → avatar canvas unmounts (check DevTools → no second WebGL context)

Test all three positions:

```bash
# Test hero-split
NEXT_PUBLIC_AVATAR_POSITION=hero-split pnpm dev
# Test hero-top
NEXT_PUBLIC_AVATAR_POSITION=hero-top pnpm dev
```

- [ ] **Step 5: Add `.gitkeep` and commit the asset**

```bash
touch /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/public/avatar/.gitkeep

# Commit directory marker only — GLB is a binary asset, commit separately
git add public/avatar/.gitkeep
git commit -m "chore(avatar): add public/avatar/ directory"

# Commit the GLB (binary)
git add public/avatar/sairam.glb
git commit -m "feat(avatar): add ReadyPlayerMe GLB avatar asset (ARKit blendshapes)"
```

**Note:** If the GLB is >5MB, add `public/avatar/*.glb` to `.gitignore` and serve it from a CDN (Vercel Blob or `/public/` Vercel asset CDN). For files ≤5MB, git is fine.

- [ ] **Step 6: Final build verification**

```bash
pnpm build
```

Expected: green. Remove test flags from `.env.local`:

```bash
grep -v "NEXT_PUBLIC_HERO_MODE\|NEXT_PUBLIC_AVATAR_POSITION" .env.local > /tmp/env_tmp \
  && mv /tmp/env_tmp .env.local
```

- [ ] **Step 7: Commit**

```bash
git add .env.local 2>/dev/null || true
git commit -m "chore(avatar): final build verification — flag defaults restored to graph mode"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ `NEXT_PUBLIC_HERO_MODE = "graph" | "avatar"` — Task 7
- ✅ `NEXT_PUBLIC_AVATAR_POSITION = "hero-side" | "hero-split" | "hero-top"` — Tasks 6 + 7
- ✅ Head tracking (cursor → pitch/yaw → bone lerp) — Task 4
- ✅ Procedural eye gaze (drift + saccades) — Task 2
- ✅ Idle breathing (chest/spine) — Task 2
- ✅ `frameloop="demand"` + direct ref mutation — Tasks 3, 4, 5
- ✅ Mobile skip + reduced-motion skip + non-classic view skip — Task 6
- ✅ CSS glow fallback — Task 6
- ✅ Zero new npm deps — Task 1 (`useAnimations` added to existing barrel)
- ✅ `WebGLBoundary` error boundary — Task 6
- ✅ `useGLTF.preload()` — Task 4
- ✅ Unit tests for gaze + idle pure functions — Task 2
- ✅ DOM tests for flag routing + layout variants — Task 6
- ✅ `docs/configuration.md` documentation — Task 7
- ✅ ReadyPlayerMe GLB at `/public/avatar/sairam.glb` — Task 8

**2. Placeholder scan:** None found. All code blocks are complete.

**3. Type consistency:**
- `controlsRef: React.MutableRefObject<{ pitch: number; yaw: number }>` — consistent across Tasks 3, 4, 5 ✅
- `GazeOutput` interface defined in Task 2, imported in Task 4 ✅
- `IdleOutput` interface defined in Task 2, imported in Task 4 ✅
- `computeGaze(t, pitch, yaw)` signature — defined Task 2, tested Task 2 ✅
- `computeIdle(t)` signature — defined Task 2, tested Task 2 ✅
- `HeroAvatar` export from `@/components/hero-avatar` — defined Task 6, imported Task 7 ✅
