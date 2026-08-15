# Hero Avatar — Tier 1 Design Spec

**Date:** 2026-07-01
**Status:** Approved — ready for implementation plan
**Feature:** Real-time 3D avatar in the Anvilry portfolio hero, cursor-reactive with procedural eye gaze and idle breathing. Flag-gated behind `NEXT_PUBLIC_HERO_MODE`. Three layout positions selectable via `NEXT_PUBLIC_AVATAR_POSITION`.

---

## Goal

Add a photorealistic, cursor-reactive 3D avatar as an alternative to the existing knowledge graph in the hero section. The avatar reacts to mouse movement (head tracking), has procedural eye gaze (saccades + drift), and idle breathing — all running in-browser with no server, at 60fps, zero bundle impact when disabled.

---

## Feature Flags

Two new `NEXT_PUBLIC_*` build-time flags, following the exact pattern of all existing flags in `docs/configuration.md`. Both are read **inside component/function bodies only** (never at module scope) to ensure `vi.stubEnv` works correctly in tests.

### `NEXT_PUBLIC_HERO_MODE`

| Value | Behaviour |
|---|---|
| unset / `"graph"` | Default — HeroGraph renders exactly as today. Zero code change to the existing graph path. |
| `"avatar"` | HeroAvatar renders instead of HeroGraph. |

### `NEXT_PUBLIC_AVATAR_POSITION`

Only meaningful when `NEXT_PUBLIC_HERO_MODE === "avatar"`. Ignored otherwise.

| Value | Layout | Description |
|---|---|---|
| unset / `"hero-side"` | Default | Avatar floats in the right slot, replacing the graph. Exact same absolute-positioned zone. Text column unchanged. |
| `"hero-split"` | Two-column | Hero becomes a flex row: text left (~58%), avatar right (~42%). A subtle left border separates the columns. |
| `"hero-top"` | Centered above | Avatar centered above the headline. Text column centered below. More personal/profile-forward. |

---

## Architecture

### New files

```
src/components/hero-avatar/
  index.tsx           ← HeroAvatar gate: reads flags, picks layout wrapper, lazy-loads AvatarScene
  avatar-scene.tsx    ← R3F Canvas + AvatarMesh. frameloop="demand". ssr:false.
  avatar-mesh.tsx     ← useGLTF loader, morphTargets wired up, single useFrame animation loop
  avatar-controls.tsx ← mousemove/touchmove → normalized pitch/yaw → controlsRef (no setState)
  use-avatar-gaze.ts  ← procedural eye gaze hook: sine/cosine drift + hash-based saccades
  use-avatar-idle.ts  ← idle breathing hook: chest/spine bone oscillation on slow sine cycle
```

### Modified files

| File | Change |
|---|---|
| `src/components/home/hero.tsx` | Add flag read + conditional `<HeroAvatar />` vs `<HeroGraph />` (~3 lines) |
| `src/lib/r3f.ts` | Add `useAnimations` to the named exports from `@react-three/drei` |
| `docs/configuration.md` | Add two new rows to the Beast Mode feature flags table |

### Unchanged files

`src/components/hero-graph/` — **entirely untouched**. The existing graph is not modified in any way.

---

## Model

**Source:** ReadyPlayerMe (readyplayer.me) — free, web-optimized GLB export with ARKit blend shapes (morph targets). You scan your face via phone camera and export a `.glb` file.

**File location:** `/public/avatar/sairam.glb` — static asset, served by the CDN.

**Why ReadyPlayerMe:** Verified open-source production implementations use it. Exports a T2 Blendshape face rig — the ARKit morph target topology required for animated expressions. `useGLTF` (already in the R3F barrel) loads it with zero additional dependencies.

**Format requirements:** GLB, morph targets present for `headLeft`, `headRight`, `headUp`, `headDown`, plus `eyeLookInLeft`, `eyeLookOutLeft`, `eyeLookInRight`, `eyeLookOutRight`. ReadyPlayerMe exports all of these by default.

---

## Component Interfaces

### `HeroAvatar` (index.tsx)

```tsx
export function HeroAvatar(): JSX.Element
```

- Reads `NEXT_PUBLIC_HERO_MODE` and `NEXT_PUBLIC_AVATAR_POSITION` inside function body
- Applies same guards as HeroGraph: `isDesktop && !reduced && view === "classic"`
- When guards fail: renders identical CSS glow fallback as HeroGraph
- When guards pass: renders `<AvatarScene />` wrapped in the layout div for the chosen position
- `AvatarScene` is dynamically imported (`ssr: false`) — never in the SSR/LCP path

### `AvatarScene` (avatar-scene.tsx)

```tsx
export function AvatarScene(): JSX.Element
```

- R3F `<Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ position: [0, 0, 3], fov: 40 }}`
- Contains `<AvatarControls />` and `<AvatarMesh />`
- `aria-hidden="true"` — decorative, not in the accessibility tree
- `gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}`

### `AvatarMesh` (avatar-mesh.tsx)

```tsx
interface AvatarMeshProps {
  controlsRef: React.RefObject<{ pitch: number; yaw: number }>
}
export function AvatarMesh({ controlsRef }: AvatarMeshProps): JSX.Element
```

- Loads `/avatar/sairam.glb` via `useGLTF`
- Wires `useAvatarGaze(controlsRef)` and `useAvatarIdle()` hooks
- Single `useFrame` loop: reads all hook outputs + `controlsRef`, writes directly to bone rotations and `morphTargetInfluences` — **never calls setState**

### `AvatarControls` (avatar-controls.tsx)

```tsx
interface AvatarControlsProps {
  controlsRef: React.RefObject<{ pitch: number; yaw: number }>
}
export function AvatarControls({ controlsRef }: AvatarControlsProps): null
```

- Attaches `mousemove` + `touchmove` listeners on mount, removes on unmount
- Normalizes pointer position to `[-1, 1]` pitch/yaw
- Writes to `controlsRef.current` — no setState, no re-renders
- Calls `invalidate()` from `useThree` to trigger a demand-mode render frame

### `useAvatarGaze` (use-avatar-gaze.ts)

```tsx
interface GazeOutput {
  eyeLX: number; eyeLY: number
  eyeRX: number; eyeRY: number
}
export function useAvatarGaze(
  controlsRef: React.RefObject<{ pitch: number; yaw: number }>
): React.RefObject<GazeOutput>
```

- Returns a ref (not state) — safe to read inside `useFrame`
- Per-tick algorithm (called inside `useFrame`):
  ```
  drift_x  = sin(t * 0.31) * cos(t * 0.73) * 0.008
  drift_y  = sin(t * 0.17) * cos(t * 0.59) * 0.006
  saccade  = hash(floor(t / 2.5)) * 0.015        // hash is a deterministic float from an integer seed
  eyeX     = controlsRef.current.yaw  * 0.4 + drift_x + saccade
  eyeY     = controlsRef.current.pitch * 0.4 + drift_y
  ```
- Clamp: `eyeX ∈ [-0.15, 0.15]`, `eyeY ∈ [-0.1, 0.1]`

### `useAvatarIdle` (use-avatar-idle.ts)

```tsx
interface IdleOutput {
  chestY: number
  spineY: number
}
export function useAvatarIdle(): React.RefObject<IdleOutput>
```

- Returns a ref — safe to read inside `useFrame`
- Per-tick algorithm:
  ```
  breathe  = sin(t * 0.42) * 0.003     // ~15s full cycle, subtle
  chestY   = breathe
  spineY   = breathe * 0.5
  ```

---

## Animation Loop (AvatarMesh useFrame)

```tsx
useFrame(({ clock, invalidate }) => {
  const t = clock.getElapsedTime();
  const { pitch, yaw } = controlsRef.current;
  const gaze = gazeRef.current;
  const idle = idleRef.current;

  // Head rotation (quaternion via bone)
  if (headBone) {
    headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, pitch * 0.45, 0.08);
    headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, yaw   * 0.45, 0.08);
  }

  // Eye morphTargets
  if (morphDict && morphInfluences) {
    const setMorph = (key: string, val: number) => {
      const i = morphDict[key]; if (i !== undefined) morphInfluences[i] = val;
    };
    setMorph("eyeLookInLeft",   Math.max(0,  gaze.eyeLX));
    setMorph("eyeLookOutLeft",  Math.max(0, -gaze.eyeLX));
    setMorph("eyeLookInRight",  Math.max(0, -gaze.eyeRX));
    setMorph("eyeLookOutRight", Math.max(0,  gaze.eyeRX));
  }

  // Chest breathing
  if (chestBone) chestBone.rotation.y = idle.chestY;
  if (spineBone) spineBone.rotation.y = idle.spineY;

  // Only invalidate when animated (gaze drift + breathing always run)
  invalidate();
});
```

---

## Layout Wrappers (inside HeroAvatar)

### `hero-side` (default)
```tsx
// Same absolute slot as HeroGraph — right side, behind text
<div aria-hidden="true"
  className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
  <div className="absolute inset-0 opacity-60 [mask-image:radial-gradient(45%_60%_at_80%_45%,#000_30%,transparent_78%)]">
    <AvatarScene />
  </div>
  <div className="absolute inset-0 bg-gradient-to-r from-bg-base via-bg-base/85 via-45% to-transparent" />
</div>
```

### `hero-split`
```tsx
// Hero section becomes flex row — requires hero.tsx to conditionally apply flex layout
// AvatarScene in a right column with a subtle border
<div className="absolute inset-y-0 right-0 w-[42%] border-l border-border flex items-center justify-center">
  <div className="w-full h-full">
    <AvatarScene />
  </div>
</div>
```

### `hero-top`
```tsx
// Avatar absolutely positioned at top center, above the headline
// Hero text shifts down via padding-top on the content div
<div aria-hidden="true"
  className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 -z-10">
  <AvatarScene />
</div>
```

---

## Performance Constraints

| Constraint | Implementation |
|---|---|
| No SSR | `dynamic(() => import('./avatar-scene'), { ssr: false })` |
| No setState in useFrame | All animation via direct bone/morphTarget mutation + refs |
| frameloop="demand" | Canvas renders only on mousemove or idle animation tick |
| Mobile skip | `useMediaQuery("(min-width: 768px)")` gate — same as HeroGraph |
| Reduced-motion skip | `useReducedMotion()` gate — same as HeroGraph |
| Non-classic view | `view === "classic"` gate — canvas unmounts when inactive |
| GLB size budget | ReadyPlayerMe web export ≤ 2MB (typically ~800KB with Draco compression) |
| No new npm deps | `useGLTF` already in R3F barrel; `useAnimations` added to barrel (already installed) |

---

## Fallback (CSS glow — identical to HeroGraph fallback)

```tsx
// When WebGL unavailable / mobile / reduced-motion / non-classic view:
<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
  <div className="absolute right-[-10%] top-[-20%] h-[36rem] w-[36rem] rounded-full bg-accent/10 blur-3xl" />
  <div className="absolute left-[10%] top-[10%] h-[28rem] w-[28rem] rounded-full bg-violet/10 blur-3xl" />
</div>
```

---

## Tests

### Vitest unit tests

**`src/components/hero-avatar/use-avatar-gaze.test.ts`**
- Gaze values stay within clamped bounds (`[-0.15, 0.15]` / `[-0.1, 0.1]`) across 1000 ticks at varying t values
- Eye values track `controlsRef` pitch/yaw direction (positive yaw → positive eyeX component)

**`src/components/hero-avatar/use-avatar-idle.test.ts`**
- `chestY` stays within `[-0.003, 0.003]` for all t
- `spineY` is always exactly `chestY * 0.5`

**`src/components/hero-avatar/index.dom.test.tsx`**
- `NEXT_PUBLIC_HERO_MODE=graph` → `HeroGraph` renders, `HeroAvatar` absent
- `NEXT_PUBLIC_HERO_MODE=avatar` → `HeroAvatar` renders, `HeroGraph` absent
- `NEXT_PUBLIC_AVATAR_POSITION=hero-split` → split layout class present in DOM
- `NEXT_PUBLIC_AVATAR_POSITION=hero-top` → top layout class present in DOM
- Mobile viewport → CSS glow fallback renders, no canvas element

### E2E (extend e2e/views.spec.ts)
- `NEXT_PUBLIC_HERO_MODE=avatar` → `canvas` element present in hero section
- `NEXT_PUBLIC_HERO_MODE=graph` (default) → existing graph tests unchanged

---

## Out of Scope (Tier 2 / Tier 3)

- Lip sync, TTS, conversational AI — Tier 3
- `Drei FaceControls` (webcam eye tracking) — Tier 2
- Scroll-reactive animations — Tier 2
- Gaussian splatting backgrounds — separate research spike needed

---

## Configuration Docs Addition

Two rows to add to the **Beast Mode** table in `docs/configuration.md`:

```markdown
| `NEXT_PUBLIC_HERO_MODE` | v3.3 | Switch the hero WebGL slot. `"graph"` (default) = current knowledge-graph. `"avatar"` = cursor-reactive 3D avatar (ReadyPlayerMe GLB, procedural gaze + breathing). |
| `NEXT_PUBLIC_AVATAR_POSITION` | v3.3 | Avatar layout when `NEXT_PUBLIC_HERO_MODE=avatar`. `"hero-side"` (default) = right slot replacing graph. `"hero-split"` = two-column (text left, avatar right). `"hero-top"` = avatar centered above headline. Ignored when hero mode is `"graph"`. |
```
