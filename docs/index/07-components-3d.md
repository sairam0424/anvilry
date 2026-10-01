---
kind: doc
title: Components — 3D / WebGL (R3F hero graph & avatar)
domain: [content]
status: current
version: v3.10.0
---

# Components — 3D / WebGL (R3F hero graph & avatar)

> Part of the Anvilry v3.10.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
>
> Describes Anvilry v3.10.0 (`package.json` 3.10.0), i.e. `main` at a929932 plus five later fixes (notes hidden at the data layer when `NOTES_ENABLED` is off, per-class rate-limit buckets, shared admin auth, voice-view-aware command palette, `MIN_ROUTES=17` and dead-component removal). None of those touch this subsystem, so every line citation below is against the current tree.

**Scope:**
- `src/components/hero-avatar/**` (non-test files)
- `src/components/hero-graph/**` (non-test files; `index.dom.test.tsx` is described under `hero-graph/index.tsx`)
- `src/components/game/webgl-boundary.tsx` (cross-referenced; also consumed by the game/chat/404 surfaces)
- `src/lib/r3f.ts` (cross-reference — the shared R3F barrel; the lib section owns its entry)
- `public/avatar/**` (asset side of the avatar subsystem)
- `patches/@react-three__fiber@9.7.0.patch` (pnpm patch on the R3F dependency every scene here mounts)

**Files indexed:** 14

Excluded from this section (co-located tests, out of scope by assignment): `src/components/hero-avatar/index.dom.test.tsx`, `rig.test.ts`, `use-avatar-gaze.test.ts`, `use-avatar-idle.test.ts`. `src/lib/avatar-glb.test.ts` is the asset-validation guard and is described in the `public/avatar/sairam.glb` block below because the assignment requires documenting avatar-GLB validation. `src/components/hero-graph/` has exactly one test file, `index.dom.test.tsx` (3 tests; see the `hero-graph/index.tsx` block); nothing tests `scene.tsx` or `scene-physics.tsx`.

## At a glance

| File | Role | Key exports |
|---|---|---|
| `src/components/hero-graph/index.tsx` | Client gate for the hero knowledge-graph WebGL slot; picks physics vs. plain scene from a build-time flag, lazy-loads it with `ssr: false`, and wraps it in `WebGLBoundary` behind a `useWebGLSupported()` probe. | `HeroGraph` (component) |
| `src/components/hero-graph/scene.tsx` | The R3F `<Canvas frameloop="demand">` + instanced-node / single-LineSegments graph and pointer-eased rig. | `default` = `HeroGraphScene` (component), `Graph` (component), `HeroGraphInner` (component) |
| `src/components/hero-graph/scene-physics.tsx` | Alternate Canvas used only when `NEXT_PUBLIC_GRAPH_PHYSICS=true`; `frameloop="always"` + sinusoidal position drift. Contains **no** Rapier. | `HeroGraphScenePhysics` (component) |
| `src/components/hero-avatar/index.tsx` | Client gate for the 3D avatar hero slot; three layout positions; returns `null` unless `NEXT_PUBLIC_HERO_MODE=avatar`. | `HeroAvatar` (component) |
| `src/components/hero-avatar/avatar-scene.tsx` | The avatar `<Canvas frameloop="demand">` with two lights, and the shared `controlsRef` mutable pitch/yaw carrier. | `AvatarScene` (component) |
| `src/components/hero-avatar/avatar-mesh.tsx` | Loads `/avatar/sairam.glb` via `useGLTF` (module-scope preload) and runs the single `useFrame` loop that drives head/neck bones, eye morphs, and breathing. | `AvatarMesh` (component) |
| `src/components/hero-avatar/avatar-controls.tsx` | Window-level `mousemove`/`touchmove` listeners → normalized `[-1,1]` pitch/yaw into a ref + `invalidate()`. Renders `null`. | `AvatarControls` (component) |
| `src/components/hero-avatar/rig.ts` | Pure, type-only-importing bone/morph resolver: walks a GLB scene once and name-matches head/neck/chest/spine/morph mesh. | `resolveRig` (function), `AvatarRig` (type) |
| `src/components/hero-avatar/use-avatar-gaze.ts` | Procedural eye-gaze: multi-frequency drift + deterministic 2.5 s-bucket saccade, clamped; returns a ref. | `computeGaze` (function), `useAvatarGaze` (hook), `GazeOutput` (interface) |
| `src/components/hero-avatar/use-avatar-idle.ts` | Procedural idle breathing (`sin(t*0.42)*0.003`); returns a ref and calls `invalidate()` every frame. | `computeIdle` (function), `useAvatarIdle` (hook), `IdleOutput` (interface) |
| `src/components/game/webgl-boundary.tsx` | Class error boundary that renders `null` when a descendant R3F scene throws (GL context failure). | `WebGLBoundary` (class component) |
| `src/lib/r3f.ts` | Named-export-only re-export barrel for `@react-three/fiber` + `three` + `@react-three/drei` + `@react-three/postprocessing`; the single module-graph node that keeps three.js to one chunk. | `Canvas`, `useFrame`, `useThree`, `useLoader`, `useGraph`, `extend`, `THREE`, `OrbitControls`, `Billboard`, `Text`, `Html`, `useTexture`, `useGLTF`, `useAnimations`, `Float`, `MeshDistortMaterial`, `GradientTexture`, `EffectComposer`, `Bloom`, `Vignette`, `Noise`, `ChromaticAberration`; types `ThreeEvent`, `RootState`, `RenderCallback` |
| `public/avatar/sairam.glb` | The only file under `public/avatar/`. glTF 2.0 binary, 1,105,768 bytes, meshopt+quantized geometry, all-WebP textures. | — (binary asset) |
| `patches/@react-three__fiber@9.7.0.patch` | pnpm patch adding a null-target guard to `createPointerEvents().connect()` in the fiber dist bundles (pmndrs/react-three-fiber#3754). Registered under `patchedDependencies` in `pnpm-workspace.yaml`. | — (patch) |

## Render-performance decisions (concrete)

| Decision | Where | Value / note |
|---|---|---|
| Frameloop — hero graph | `src/components/hero-graph/scene.tsx:136` | `frameloop="demand"` |
| Frameloop — physics variant | `src/components/hero-graph/scene-physics.tsx:20` | `frameloop="always"` (the only always-on hero canvas) |
| Frameloop — avatar | `src/components/hero-avatar/avatar-scene.tsx:22` | `frameloop="demand"` |
| DPR clamp | `scene.tsx:141`, `scene-physics.tsx:23`, `avatar-scene.tsx:25` | `dpr={[1, 1.75]}` in all three |
| GL context opts | `scene.tsx:142`, `scene-physics.tsx:24`, `avatar-scene.tsx:26` | `{ antialias: true, alpha: true, powerPreference: "high-performance" }` — identical in all three |
| Resize measurement fix | `scene.tsx:139`, `scene-physics.tsx:21`, `avatar-scene.tsx:23` | `resize={{ offsetSize: true }}` — comment at `scene.tsx:137-138` states this fixes the "canvas stuck at 300x150" race when the `ResizeObserver` reports 0 on first measure inside an absolutely-positioned parent |
| Camera | `scene.tsx:140` / `scene-physics.tsx:22` vs `avatar-scene.tsx:24` | graph: `position: [0,0,7], fov: 45`; avatar: `position: [0,0.1,2.5], fov: 40` |
| Instanced meshes | `scene.tsx:58` | one `<instancedMesh args={[geo, mat, graphNodes.length]} />` for every node — single draw call |
| Batched line geometry | `scene.tsx:64-75` | all edges flattened into one `THREE.BufferGeometry` rendered as one `<lineSegments>` |
| Lazy import boundary — graph | `src/components/hero-graph/index.tsx:18-23` | `dynamic(() => import("./scene"), { ssr: false })` (or `./scene-physics` under the flag) |
| Lazy import boundary — avatar | `src/components/hero-avatar/index.tsx:10-13` | `dynamic(() => import("./avatar-scene").then(m => ({ default: m.AvatarScene })), { ssr: false })` |
| Mobile drop | `hero-graph/index.tsx:53,64`; `hero-avatar/index.tsx:46,56` | `useMediaQuery("(min-width: 768px)")` must be true; the whole WebGL layer is skipped below 768 px |
| Reduced motion | `hero-graph/index.tsx:52,64`; `hero-avatar/index.tsx:45,56`; `scene-physics.tsx:35,38` | `useReducedMotion()` blocks mounting at both entry points; the physics variant additionally early-returns inside `useFrame` (so under reduced motion it still renders every frame, it just does not move) |
| View-scoped mount | `hero-graph/index.tsx:64`; `hero-avatar/index.tsx:56` | `view === "classic"` — the hidden Classic page must not hold a live WebGL context while the gamified view uses one |
| Chunk dedup barrel | `src/lib/r3f.ts:1-27`, `next.config.ts:147-169` | all R3F consumers import from the barrel so the bundler sees one module-graph node |
| Error containment | `hero-graph/index.tsx:54,79-81`; `hero-avatar/index.tsx:59-61` | Both hero scenes are wrapped in `<WebGLBoundary>`. Only the graph adds a `useWebGLSupported()` probe (`index.tsx:54`) and an `onFail` state (`index.tsx:56-57`) that unmounts the canvas after a synchronous failure; the avatar has neither (see gotchas). |

**Offscreen / worker offload — never present in source; dependency removed in v3.5.0.** `@react-three/offscreen` was declared as a dependency at v3.4.2 but no file under `src/` ever imported it, and `CLAUDE.md` claimed "`@react-three/offscreen` for worker offload" as a 3D-graph decision on the strength of that declaration alone. The package was **removed from `package.json` in v3.5.0** (`CHANGELOG.md:503-508`), so there is no declaration left to cite; a grep for `offscreen`/`Offscreen` across `src/` returns no matches. The load-bearing leftover: CSP still allows `worker-src 'self' blob:` (`next.config.ts:68`) for a worker the hero subsystem never created — the directive outlived the dependency. The `### 3D Graph` section of `CLAUDE.md` ("Two dependencies were declared but never imported — both removed in v3.5.0") now records both removals correctly.

**Post-processing / effects — none in this subsystem.** `EffectComposer`, `Bloom`, `Vignette`, `Noise`, `ChromaticAberration` are re-exported by the barrel (`src/lib/r3f.ts:27`) but the only consumer is `src/components/chat/voice-orb-3d.tsx:4`. There the pass stack is opt-in: it renders only when `NEXT_PUBLIC_ORB_POSTPROCESSING === "true"` **and** `getDeviceTier() === "high"` (`voice-orb-3d.tsx:300-301,327`; tier is `deviceMemory >= 4 && hardwareConcurrency >= 4`, both defaulting to 4 when the browser does not report them, `voice-orb-3d.tsx:39-44`). The stack starts with a `<Fluid>` cursor-distortion pass imported **directly** from `@whatisjery/react-fluid-distortion` (`voice-orb-3d.tsx:6`, ahead of Bloom, `:324-326`), and `BlendFunction` comes straight from `postprocessing` (`:5`); the barrel re-exports neither package, so these are extra direct dependencies of the orb rather than a bypass of a barrel export (contrast `scene-physics.tsx`, which does bypass one). Neither hero-graph nor hero-avatar mounts any effect pass.

**Flags that gate this subsystem (exact names):**

| Flag | Read at | Effect |
|---|---|---|
| `NEXT_PUBLIC_HERO_MODE` | `src/components/home/hero.tsx:25` and `src/components/hero-avatar/index.tsx:50` | `"avatar"` → `<HeroAvatar />`; anything else (default) → `<HeroGraph />` (`hero.tsx:30`). `HeroAvatar` independently re-checks and returns `null` when `!== "avatar"` (`index.tsx:54`). |
| `NEXT_PUBLIC_AVATAR_POSITION` | `src/components/hero-avatar/index.tsx:51` | `"hero-side"` (default via `?? "hero-side"`), `"hero-split"`, `"hero-top"` — three different wrapper layouts (lines 65, 85, 102). |
| `NEXT_PUBLIC_GRAPH_PHYSICS` | `src/components/hero-graph/index.tsx:10` (**module scope**) | `"true"` → import `./scene-physics`; otherwise `./scene`. No physics engine is involved either way — the comment at `index.tsx:14-17` states that outright and records that `@react-three/rapier` was declared but imported nowhere and was **removed in v3.5.0** (`CHANGELOG.md:503-508`); the flag and filename are historical residue. |

There is no flag gating physics-vs-effects beyond the above; `NEXT_PUBLIC_GRAPH_PHYSICS` is the only "physics" switch, and no effects flag applies here (`NEXT_PUBLIC_ORB_POSTPROCESSING` and `NEXT_PUBLIC_404_ORB` belong to the voice/404 orb, which reuses this subsystem's `WebGLBoundary` and the barrel — and, via `voice-orb.tsx`, the `useMediaQuery`/`useWebGLSupported()` gate primitives — but none of its flags).

## Detail

### `src/components/hero-graph/index.tsx`
- **Role:** Client-only gate that decides whether the hero knowledge-graph WebGL layer mounts at all, and renders a CSS glow fallback either way.
- **Exports:** `HeroGraph` (component) — no props.
- **Reads / depends on:** `next/dynamic`; `@/lib/use-reduced-motion` (`useReducedMotion`); `@/lib/use-media-query` (`useMediaQuery`, `useWebGLSupported`); `@/components/view-context` (`useView`); `@/components/game/webgl-boundary` (`WebGLBoundary`); env `NEXT_PUBLIC_GRAPH_PHYSICS`.
- **Consumed by:** `src/components/home/hero.tsx:12,30` — the only importer.
- **Tests:** `src/components/hero-graph/index.dom.test.tsx` (3 tests; `next/dynamic` is mocked to import the scene module in an effect and render it once resolved, and `use-media-query`/`use-reduced-motion`/`view-context` are mocked): no canvas and both `.blur-3xl` glow divs when WebGL is unsupported (`:42-49`); same when the view is not `classic` (`:51-58`); and when the scene throws during mount, `WebGLBoundary` contains it, `onFail` flips `webglFailed`, and only the glow divs remain (`:60-77`).
- **Behaviour notes:** `GRAPH_PHYSICS` is evaluated at **module scope** (`index.tsx:10`), so the dynamic-import target is fixed at module-evaluation time (`index.tsx:18-23`). The gate is `showWebGL = isDesktop && !reduced && webglOk && !webglFailed && view === "classic"` (`index.tsx:63-64`): `webglOk` is the memoised `useWebGLSupported()` probe (`index.tsx:54`) and `webglFailed` is local state set by `WebGLBoundary`'s `onFail` (`index.tsx:56-57,79`). The wrapper is `aria-hidden="true"`, `pointer-events-none`, `absolute inset-0 -z-10 overflow-hidden` (`index.tsx:67-70`) so it can never block the static LCP (`index.tsx:35-36`). Two blurred CSS circles are always rendered (`index.tsx:72-73`) as the pre-hydration / mobile / reduced-motion / WebGL-failure visual. When WebGL is on, the scene sits inside an `opacity-45` radial mask centred at 82% x / 42% y (`index.tsx:78`) plus a left-to-right scrim gradient (`index.tsx:85`) so the headline keeps contrast.
- **Gotchas / invariants:** The Classic-view condition is documented at `index.tsx:26-29` as avoiding a second/leaked WebGL context on low-end mobile and freeing the single context in software-GL environments — dropping it would let two hero canvases coexist. The docblock at `index.tsx:38-49` records a **KNOWN GAP**: the Classic<->Gamified handoff disposes one context and creates another in the same transition; a *synchronous* creation failure is caught by `WebGLBoundary` (and `onFail` runs), but an *asynchronous* one (R3F surfaces context failure as an unhandled rejection) never reaches `componentDidCatch`, so the canvas is left mounted broken. The proposed fix (teaching `WebGLBoundary` about `window.onunhandledrejection`) was deliberately deferred because it risks false positives on unrelated rejections such as chat streaming. `onFail` only ever sets `webglFailed` to `true` (`index.tsx:57`); nothing in the component resets it, so after a failure the glow fallback stays until `HeroGraph` remounts.

### `src/components/hero-graph/scene.tsx`
- **Role:** The default hero graph Canvas: instanced spheres for nodes, one `lineSegments` for edges, and a pointer-eased group rotation, all on an on-demand frameloop.
- **Exports:** `default` = `HeroGraphScene` (component, the Canvas), `Graph` (component, the inner group), `HeroGraphInner` (component, `Graph` with no Canvas).
- **Reads / depends on:** `@/lib/r3f` (`Canvas`, `useThree`, `useFrame`, `THREE`) at `scene.tsx:4`; also imports `graphNodes`/`graphEdges`/`resolveKindColor` from `@/lib/graph-data`, and `useThemeColors` from `@/lib/use-theme-colors` (`scene.tsx:6`) — the latter resolves `--accent`/`--violet`/`--green`/`--amber`/`--graph-edge` into plain hex for both `Nodes` and `Edges`, since three.js's `Color` constructor can't consume `var(--x)`.
- **Consumed by:** `src/components/hero-graph/index.tsx:23` (default export, via `dynamic`); `src/components/hero-graph/scene-physics.tsx:8` imports `HeroGraphInner`. `Graph` is exported (`scene.tsx:112`) with the comment "exported for the physics variant to embed inside its own Canvas" but no file imports `Graph` directly — the physics variant uses `HeroGraphInner` instead.
- **Behaviour notes:**
  - `SCALE = 1.6` (`scene.tsx:8`) multiplies every node/edge coordinate. `graph-data.ts:77` documents the frustum budget this scale implies (camera z=7, fov=45 → visible half-height ≈ 2.9 / 1.6 ≈ 1.8 units).
  - `idx` (`scene.tsx:9`) is a module-level `id → array index` map built once from `graphNodes`, used by `Edges` to resolve endpoints.
  - `ptr` (`scene.tsx:16`) is a **module-level mutable singleton** `{x, y}`, not React state. `Graph`'s effect (`scene.tsx:115-123`) attaches a `window` `pointermove` listener that writes `ptr` in NDC-ish `[-1,1]` (`y` inverted) and calls `invalidate()`. The comment at `scene.tsx:11-15` explains why: the canvas has `pointer-events: none` (`scene.tsx:143`) so R3F's own pointer tracking never fires.
  - `Nodes` (`scene.tsx:20-59`): calls `useThemeColors()` (`scene.tsx:23`) and memoizes `themedKindColor = resolveKindColor(themeColors)` (`scene.tsx:31-34`) — the live-theme replacement for the old static `kindColor` import. Geometry `SphereGeometry(0.13, 24, 24)`, material `MeshBasicMaterial({ toneMapped: false })`, both `useMemo`'d. A one-shot effect writes per-instance matrices and colors (`color.set(themedKindColor[n.kind])`), flags `instanceMatrix.needsUpdate` / `instanceColor.needsUpdate`, then `invalidate()` (`scene.tsx:36-47`) — `themedKindColor` is in the effect's dependency array, so a theme toggle re-runs the imperative color assignment on the instanced mesh (a plain prop change would NOT do this; `setColorAt` is imperative, not reactive). A second effect disposes `geo` and `mat` on unmount (`scene.tsx:50-56`).
  - `Edges` (`scene.tsx:62-88`): calls `useThemeColors()` (`scene.tsx:63`); flattens all `graphEdges` into a `Float32BufferAttribute("position", …, 3)`; material `lineBasicMaterial color={colors.graphEdge} transparent opacity={0.7} toneMapped={false}` (`scene.tsx:79-85`) — `colors.graphEdge` is a plain JSX prop here (unlike `Nodes`' imperative path), so R3F re-renders the material reactively on theme change with no extra wiring; geometry disposed on unmount (`scene.tsx:77`).
  - `Rig` (`scene.tsx:91-108`): eases `group.rotation` toward `ptr.y * 0.22` (x) and `ptr.x * 0.4` (y) at 5% per frame, and only re-`invalidate()`s while `|delta| > 0.0006` (`scene.tsx:106`) — that threshold is what lets the demand loop actually come to rest.
  - Initial group rotation is `[0.15, -0.3, 0]` (`scene.tsx:125`).
- **Gotchas / invariants:**
  - The `invalidate()` threshold at `scene.tsx:106` is the settle condition for `frameloop="demand"`; removing it turns the demand loop into a perpetual loop.
  - The in-render mutation of `g.rotation` is wrapped in an explicit `/* eslint-disable react-hooks/immutability */` … `enable` pair (`scene.tsx:102-105`) with the rationale that `g` is a live scene-graph node, not React state. Deleting the disable comment fails lint.
  - The `Nodes` doc comment used to hard-code a node count ("All 10 nodes as ONE InstancedMesh") while `graphNodes` had grown to 16 — **fixed in the comment sweep**: `scene.tsx:18-19` now reads "Every node as ONE InstancedMesh … Count is taken from `graphNodes.length`, so adding content never adds a draw call", which matches the count-agnostic `graphNodes.length` at `scene.tsx:58`. `src/lib/graph-data.ts:18-81` defines the **16** nodes, and that file's own docblock was de-numbered the same way (`graph-data.ts:3-4` now says "every flagship work system + every OSS repo (see `graphNodes` below for the count)" instead of "the 5 flagship work systems + 8 OSS repos"). Adding a node no longer makes either comment lie.
  - `ptr` being module-level means two simultaneously mounted `Graph` instances would share pointer state (in practice only one hero canvas mounts at a time).
  - `kindColor` (the static hex map exported by `graph-data.ts`) is no longer imported by this file — `resolveKindColor(themeColors)` is the live-theme replacement, computed fresh in `Nodes`/`Edges`' consumers. `kindColor` itself still exists, unchanged, as the SSR/build-time default for any consumer that can't call hooks.

### `src/components/hero-graph/scene-physics.tsx`
- **Role:** The `NEXT_PUBLIC_GRAPH_PHYSICS=true` variant of the hero graph — same inner graph, wrapped in a group that drifts sinusoidally on an always-on frameloop.
- **Exports:** `HeroGraphScenePhysics` (component). `DriftWrapper` is module-private (`scene-physics.tsx:33`).
- **Reads / depends on:** `@react-three/fiber` (`Canvas`, `useFrame`, type `RootState`) and `three` (`* as THREE`) **imported directly, not through the barrel** (`scene-physics.tsx:4-6`); `@/lib/use-reduced-motion`; `./scene` (`HeroGraphInner`).
- **Consumed by:** `src/components/hero-graph/index.tsx:20` only (the `GRAPH_PHYSICS` branch of the `dynamic` import, `:18-23`).
- **Behaviour notes:** `frameloop="always"` (`scene-physics.tsx:20`) — no `invalidate()` calls anywhere in this file, because none are needed. `DriftWrapper` sets (never accumulates) `position.x = sin(t*0.4)*0.08`, `position.y = cos(t*0.25)*0.06`, `position.z = sin(t*0.3+1)*0.04` from `clock.elapsedTime` (`scene-physics.tsx:42-44`); the comment at lines 40-41 states position is SET so it stays bounded. Under reduced motion the `useFrame` callback returns early (`scene-physics.tsx:38`) leaving the group at the origin.
- **Gotchas / invariants:**
  - **Despite the filename and the flag name, there is no physics engine here.** The header comment (`scene-physics.tsx:10-16`) states "No RigidBody / Rapier needed for this effect". `@react-three/rapier` was a declared dependency at v3.4.2 but was imported by **no** file in `src/`; it was **removed from `package.json` in v3.5.0** (`CHANGELOG.md:503-508`). The only `rapier`/`Rapier` matches left under `src/` are prose comments (`scene-physics.tsx:12`, `hero-graph/index.tsx:15`).
  - This is the **only** file in the 3D subsystem that bypasses `@/lib/r3f` (`scene-physics.tsx:4-6`). The barrel's whole purpose (`src/lib/r3f.ts:5-8`) is that every R3F consumer route through one module-graph node; a direct `@react-three/fiber` + `three` import here is exactly the pattern the barrel exists to prevent. Because this variant is flag-off by default it is not in the default production graph.
  - Reduced motion is handled *inside* the frame callback, not at the Canvas level — so with the flag on and reduced-motion set, the canvas still renders continuously (`frameloop="always"`), it just renders a static scene. The upstream gate in `hero-graph/index.tsx:63-64` normally prevents this from ever mounting under reduced motion.

### `src/components/hero-avatar/index.tsx`
- **Role:** Gate + layout host for the 3D avatar hero slot; returns `null` entirely unless the avatar hero mode is selected.
- **Exports:** `HeroAvatar` (component) — return type `React.JSX.Element | null`. `GlowFallback` is module-private (`index.tsx:19`).
- **Reads / depends on:** `next/dynamic`; `@/lib/use-reduced-motion`; `@/lib/use-media-query`; `@/components/view-context`; `@/components/game/webgl-boundary`; env `NEXT_PUBLIC_HERO_MODE`, `NEXT_PUBLIC_AVATAR_POSITION`.
- **Consumed by:** `src/components/home/hero.tsx:13,30`.
- **Behaviour notes:** Both flags are read **inside the function body** (`index.tsx:50-51`) — the comment at `index.tsx:31-32` and `index.tsx:49` states this is required so `vi.stubEnv` works in tests (and `src/components/hero-avatar/index.dom.test.tsx:44-84` depends on it). Early return `null` when `heroMode !== "avatar"` (`index.tsx:54`) happens **after** the three hooks, so hook order stays stable. Gate is only the triple `isDesktop && !reduced && view === "classic"` (`index.tsx:56`) — unlike `HeroGraph` (five-way gate, `hero-graph/index.tsx:63-64`) it has **no** `useWebGLSupported()` probe and passes no `onFail` to its boundary. The lazy scene is always wrapped in `<WebGLBoundary>` (`index.tsx:58-62`). Three layouts:
  - `"hero-side"` (default): full-bleed `-z-10` wrapper, `opacity-60` radial mask at 82% x / 45% y, plus the left-to-right scrim (`index.tsx:65-82`).
  - `"hero-split"`: `absolute inset-y-0 right-0 w-[42%] border-l border-border` (`index.tsx:85-99`).
  - `"hero-top"` (the fall-through default for any other value): `left-1/2 top-8 h-36 w-36 -translate-x-1/2` (`index.tsx:102-110`).
- **Gotchas / invariants:** `GlowFallback` (`index.tsx:19-26`) intentionally duplicates the two blurred circles from `hero-graph/index.tsx:72-73`; the comment at `index.tsx:16-18` states this is so switching hero modes produces no fallback-path layout shift — the two must be kept in sync manually. Every branch sets `aria-hidden="true"` and `pointer-events-none`, so the avatar is decorative-only. Unknown `NEXT_PUBLIC_AVATAR_POSITION` values silently render the `hero-top` layout rather than erroring.

### `src/components/hero-avatar/avatar-scene.tsx`
- **Role:** The avatar `<Canvas>` — owns the `controlsRef` that the controls hook writes and the mesh hook reads, plus the two lights.
- **Exports:** `AvatarScene` (component).
- **Reads / depends on:** `@/lib/r3f` (`Canvas`) at line 4; `./avatar-mesh`; `./avatar-controls`.
- **Consumed by:** `src/components/hero-avatar/index.tsx:10-13` (via `dynamic`). Mocked in `index.dom.test.tsx:21-23`.
- **Behaviour notes:** `controlsRef` is a plain `useRef<{pitch, yaw}>({pitch: 0, yaw: 0})` created here (`avatar-scene.tsx:18`) and passed to both children — it is the only channel between input and animation, and it is never React state. Lights: `ambientLight intensity={0.6}` and `directionalLight position={[2,4,3]} intensity={0.8}` (`avatar-scene.tsx:28-29`). `alpha: true` is documented (`avatar-scene.tsx:12`) as letting the hero gradient show through. The header comment (`avatar-scene.tsx:15`) records that `WebGLBoundary` is applied by the parent, not here.
- **Gotchas / invariants:** `frameloop="demand"` (`avatar-scene.tsx:22`) means nothing renders unless something calls `invalidate()`. Two sources do: `AvatarControls` on pointer/touch move, and `useAvatarIdle` every frame. Removing the idle hook's `invalidate()` would make the avatar freeze between mouse moves.

### `src/components/hero-avatar/avatar-mesh.tsx`
- **Role:** GLB load + the single per-frame animation loop for the avatar (bones, eye morphs, breathing).
- **Exports:** `AvatarMesh` (component) — prop `controlsRef: React.MutableRefObject<{pitch: number; yaw: number}>`.
- **Reads / depends on:** `@/lib/r3f` (`useFrame`, `useGLTF`, `THREE`) at line 4; `./use-avatar-gaze`; `./use-avatar-idle`; `./rig` (`resolveRig`, type `AvatarRig`); the asset URL `"/avatar/sairam.glb"` hardcoded at lines 10 and 27.
- **Consumed by:** `src/components/hero-avatar/avatar-scene.tsx:31` only.
- **Behaviour notes (GLB loading path):**
  1. `useGLTF.preload("/avatar/sairam.glb")` runs at **module scope** (`avatar-mesh.tsx:10`) — importing this module fires a real network fetch immediately.
  2. `const { scene } = useGLTF("/avatar/sairam.glb")` (`avatar-mesh.tsx:27`) suspends until loaded; there is no local `<Suspense>` in this subsystem, so the `next/dynamic` boundary in `hero-avatar/index.tsx:10` is what absorbs it.
  3. The rig is resolved into **one** ref, lazily, with the `ref.current == null` pattern (`avatar-mesh.tsx:39-42`). The comment block at lines 29-38 documents the two rejected alternatives: five sibling refs written during render (rejected by `react-hooks/refs`) and `useMemo(() => resolveRig(scene))` (rejected because `useMemo` output is treated as immutable render state while the frame loop mutates it).
  4. Unmount cleanup (`avatar-mesh.tsx:44-56`) traverses the scene, disposes every mesh geometry and material (array-aware), then calls `useGLTF.clear("/avatar/sairam.glb")`.
  5. Renders `<primitive object={scene} />` (`avatar-mesh.tsx:117`) — the GLB scene graph is attached directly.
- **Behaviour notes (frame loop, `avatar-mesh.tsx:61-115`):** reads `controlsRef.current`, `gazeRef.current`, `idleRef.current`; head lerps to `pitch*0.45` / `yaw*0.45` at factor `0.08`; neck to `pitch*0.2` / `yaw*0.2` at factor `0.06`; the 8 ARKit eye morphs (`eyeLookInLeft`, `eyeLookOutLeft`, `eyeLookInRight`, `eyeLookOutRight`, `eyeLookUpLeft`, `eyeLookDownLeft`, `eyeLookUpRight`, `eyeLookDownRight`) are written via a local `setMorph` that clamps to `[0,1]` and skips unknown keys (`avatar-mesh.tsx:97-109`); chest/spine take `idle.chestY` / `idle.spineY` on `rotation.y` (`avatar-mesh.tsx:113-114`). All writes are direct property mutations — no `setState` anywhere (stated at `avatar-mesh.tsx:18`).
- **Gotchas / invariants:**
  - The module-scope `useGLTF.preload` is why `resolveRig` was moved to `rig.ts` — importing `avatar-mesh.tsx` from a node-environment unit test fails with `ECONNREFUSED` (`rig.ts:19-22`).
  - The GLB URL appears **twice** (lines 10, 27) plus once more in the cleanup (`line 54`) and is asserted by `src/lib/avatar-glb.test.ts:53-56`; changing the filename requires all four.
  - The eye-morph block is a no-op with the currently shipped asset: `rig.morph` resolves to `null` because no mesh in `sairam.glb` has a name containing "head" and the file has zero morph targets. See the `public/avatar/sairam.glb` block.
  - The `useFrame` loop does not call `invalidate()` itself; it relies on `useAvatarIdle` (which does) and `AvatarControls`.

### `src/components/hero-avatar/avatar-controls.tsx`
- **Role:** Input adapter — window-level pointer tracking into the shared `controlsRef`, with `invalidate()` to wake the demand loop.
- **Exports:** `AvatarControls` (component) — prop `controlsRef: React.MutableRefObject<{pitch: number; yaw: number}>`; return type `null`.
- **Reads / depends on:** `@/lib/r3f` (`useThree`) at line 4. Declares a local `ControlsRef` interface (`avatar-controls.tsx:6-9`) that is not exported.
- **Consumed by:** `src/components/hero-avatar/avatar-scene.tsx:30` only.
- **Behaviour notes:** One effect keyed on `[controlsRef, invalidate]` registers `mousemove` and `touchmove` on `window` with `{ passive: true }` and removes both on cleanup (`avatar-controls.tsx:43-48`). Normalization: `yaw = (clientX/innerWidth - 0.5) * 2`, `pitch = -(clientY/innerHeight - 0.5) * 2` (`avatar-controls.tsx:31-32`, `38-39`) — so pitch is inverted (screen-up is positive). `onTouchMove` guards `!e.touches[0]` (`avatar-controls.tsx:37`).
- **Gotchas / invariants:** Listeners are on `window`, not the canvas, because the canvas has `pointer-events: none` via the wrapper — stated at `avatar-controls.tsx:12-19`. Never calls `setState`, so it triggers zero React re-renders (`avatar-controls.tsx:19`). Note these listeners are registered even when the resulting motion is invisible, but the parent gate (`hero-avatar/index.tsx:56`) means the component only mounts on desktop, non-reduced-motion, classic view.

### `src/components/hero-avatar/rig.ts`
- **Role:** Pure name-matching resolver that extracts the four animated bones and the morph-target mesh from a loaded GLB scene in a single traversal.
- **Exports:** `AvatarRig` (type — `{ head, neck, chest, spine: THREE.Bone | null; morph: THREE.SkinnedMesh | null }`), `resolveRig(scene: THREE.Object3D): AvatarRig` (function).
- **Reads / depends on:** `import type * as THREE from "three"` **only** (`rig.ts:4`) — nothing at runtime.
- **Consumed by:** `src/components/hero-avatar/avatar-mesh.tsx:7,41`; `src/components/hero-avatar/rig.test.ts:3`.
- **Behaviour notes:** Skips any node that is neither `isBone` nor `type === "SkinnedMesh"` (`rig.ts:41-42`, with an `@ts-expect-error` because `isBone` is a runtime flag absent from the type stubs). Matching is on `obj.name.toLowerCase()` substrings (`rig.ts:43`): `"head"` → head, `"neck"` → neck, `"chest" || "spine1"` → chest, `"spine" && !"spine1"` → spine (`rig.ts:45-52`). `morph` requires all three of: `type === "SkinnedMesh"`, a truthy `morphTargetDictionary`, and a name containing `"head"` (`rig.ts:57-63`). Last match wins for every field (no early exit).
- **Gotchas / invariants:**
  - The `!name.includes("spine1")` exclusion (`rig.ts:51`) is what stops one node from being assigned to both `chest` and `spine`; documented at `rig.ts:47-48` and regression-tested at `rig.test.ts:55-60`.
  - The header comment (`rig.ts:1-3`) explicitly forbids converting the type-only `three` import into a value import, because that would add a second runtime edge into `three` outside the `src/lib/r3f.ts` barrel and could break the single-chunk property.
  - Every field is nullable by design (`rig.ts:6-7`); a partial or empty GLB yields an all-null rig rather than throwing (`rig.test.ts:108-130`).
  - The `"head"` name filter on `morph` (`rig.ts:60`) is the reason the shipped Avaturn GLB gets `morph: null`.

### `src/components/hero-avatar/use-avatar-gaze.ts`
- **Role:** Procedural eye-gaze signal generator — pure math split from a thin `useFrame` hook.
- **Exports:** `GazeOutput` (interface — `eyeLX`, `eyeLY`, `eyeRX`, `eyeRY`), `computeGaze(t, pitch, yaw): GazeOutput` (function), `useAvatarGaze(controlsRef): React.RefObject<GazeOutput>` (hook).
- **Reads / depends on:** `@/lib/r3f` (`useFrame`) at line 2; `react` (`useRef`).
- **Consumed by:** `src/components/hero-avatar/avatar-mesh.tsx:5,58`; `src/components/hero-avatar/use-avatar-gaze.test.ts:2` (tests `computeGaze` only).
- **Behaviour notes:** Drift is two products of sines at different frequencies: `driftX = sin(t*0.31)*cos(t*0.73)*0.008`, `driftY = sin(t*0.17)*cos(t*0.59)*0.006` (`use-avatar-gaze.ts:22-23`). Saccade is deterministic, bucketed at 2.5 s: `bucket = floor(t/2.5)`, `saccade = ((sin(bucket*127.1 + 311.7) * 43758.5453) % 1) * 0.015` (`use-avatar-gaze.ts:26-27`). Cursor contribution is `yaw*0.4` / `pitch*0.4` (`use-avatar-gaze.ts:29-30`). Output is clamped to `[-0.15, 0.15]` for X and `[-0.1, 0.1]` for Y (`use-avatar-gaze.ts:32-33`); the right eye is set equal to the left (`use-avatar-gaze.ts:35`). The hook replaces `gazeRef.current` with a fresh object each frame (`use-avatar-gaze.ts:50`) and defaults missing controls to `{pitch: 0, yaw: 0}` (`use-avatar-gaze.ts:49`).
- **Gotchas / invariants:** The hook returns a **ref, not state** (`use-avatar-gaze.ts:38-39`) — reading it inside `useFrame` costs no re-render. It does **not** call `invalidate()`; on the demand frameloop the gaze only advances on frames triggered by something else. The clamp bounds are the property the tests pin across 1000 ticks (`use-avatar-gaze.test.ts:9-25`).

### `src/components/hero-avatar/use-avatar-idle.ts`
- **Role:** Procedural idle-breathing signal, and the component that keeps the demand frameloop alive.
- **Exports:** `IdleOutput` (interface — `chestY`, `spineY`), `computeIdle(t): IdleOutput` (function), `useAvatarIdle(): React.RefObject<IdleOutput>` (hook).
- **Reads / depends on:** `@/lib/r3f` (`useFrame`, `useThree`) at line 2; `react` (`useRef`).
- **Consumed by:** `src/components/hero-avatar/avatar-mesh.tsx:6,59`; `src/components/hero-avatar/use-avatar-idle.test.ts:2` (tests `computeIdle` only).
- **Behaviour notes:** `breathe = sin(t*0.42) * 0.003`; `chestY = breathe`, `spineY = breathe * 0.5` (`use-avatar-idle.ts:14-15`). Amplitude is 0.003 radians; the doc comment says "~15 s per full breath cycle (0.42 rad/s)" (`use-avatar-idle.ts:11`) — note `2π/0.42 ≈ 15.0 s`. The hook calls `invalidate()` on **every** frame (`use-avatar-idle.ts:27`).
- **Gotchas / invariants:** This unconditional `invalidate()` is the single reason the avatar canvas animates continuously despite `frameloop="demand"` — i.e. the avatar's demand loop never actually settles while `AvatarMesh` is mounted. `spineY === chestY * 0.5` exactly is a pinned invariant (`use-avatar-idle.test.ts:18-24`). There is no reduced-motion check inside this hook; reduced motion is handled only at the `HeroAvatar` gate (`hero-avatar/index.tsx:56`).

### `src/components/game/webgl-boundary.tsx`
- **Role:** Class error boundary that swallows render/runtime errors from a descendant R3F scene and renders nothing.
- **Exports:** `WebGLBoundary` (class component) — props `{ children: ReactNode; onFail?: () => void }`, state `{ failed: boolean }`.
- **Reads / depends on:** `react` only (`Component`, type `ReactNode`).
- **Consumed by:** `src/components/hero-graph/index.tsx:8,79`; `src/components/hero-avatar/index.tsx:8,59`; `src/components/game/build-graph.tsx:10,60`; `src/components/chat/voice-orb.tsx:7,46`; `src/app/not-found.tsx:26`. Mocked as a pass-through in `src/components/hero-avatar/index.dom.test.tsx:31-33`.
- **Behaviour notes:** `getDerivedStateFromError()` sets `failed: true` (`webgl-boundary.tsx:19-21`); `componentDidCatch` logs `console.warn("[build-graph] WebGL scene unavailable — falling back to the index.", error)` and invokes the optional `onFail` (`webgl-boundary.tsx:23-27`); `render()` returns `null` when failed (`webgl-boundary.tsx:30`). The comment at lines 5-12 states a class component is required because only class error boundaries catch descendant errors in React.
- **Gotchas / invariants:** The warning message is hardcoded with a `[build-graph]` prefix (`webgl-boundary.tsx:25`) even though the component is shared by both hero scenes, the voice orb, and the 404 orb — a failure in the hero graph or avatar logs as `[build-graph]`. There is no reset path: once `failed` is true the subtree stays blank for the component's lifetime. `HeroAvatar` passes no `onFail`, so an avatar GL failure is silent apart from the console warning (`HeroGraph`, `build-graph.tsx` and `voice-orb.tsx` do pass one, and use it to stop remounting the canvas). Critically, an R3F **context-creation** failure surfaces as an async unhandled rejection that error boundaries cannot catch — which is why `src/lib/use-media-query.ts:28-47` exposes `useWebGLSupported()` as a proactive probe; that probe is used by `hero-graph/index.tsx:54`, `build-graph.tsx:29` and `voice-orb.tsx:38` but **not** by `hero-avatar/index.tsx` (nor by the 404 orb mount in `src/app/not-found.tsx`). It only prevents the async failure for *unsupported* WebGL; a transient re-creation failure is the KNOWN GAP recorded in the `hero-graph/index.tsx` block.

### `src/lib/r3f.ts`
- **Role:** The single import surface for the whole R3F universe, existing purely so the bundler emits one three.js chunk instead of one per async boundary. (Entry owned by the lib section; described here because it is load-bearing for this subsystem.)
- **Exports (all named, no wildcards except the `three` namespace):**
  - from `@react-three/fiber` (`r3f.ts:17`): `Canvas`, `useFrame`, `useThree`, `useLoader`, `useGraph`, `extend`; types (`r3f.ts:18`): `ThreeEvent`, `RootState`, `RenderCallback`.
  - from `three` (`r3f.ts:21`): `export * as THREE`.
  - from `@react-three/drei` (`r3f.ts:24`): `OrbitControls`, `Billboard`, `Text`, `Html`, `useTexture`, `useGLTF`, `useAnimations`, `Float`, `MeshDistortMaterial`, `GradientTexture`.
  - from `@react-three/postprocessing` (`r3f.ts:27`): `EffectComposer`, `Bloom`, `Vignette`, `Noise`, `ChromaticAberration`.
- **Consumed by (every importer, verified by grep):** `src/components/hero-graph/scene.tsx:4`; `src/components/hero-avatar/avatar-scene.tsx:4`, `avatar-mesh.tsx:4`, `avatar-controls.tsx:4`, `use-avatar-gaze.ts:2`, `use-avatar-idle.ts:2`; `src/components/game/build-graph-scene.tsx:4,6`; `src/components/chat/voice-orb-3d.tsx:4`. Direct imports outside the barrel: `scene-physics.tsx:4-6` (fiber + `three`, both of which the barrel re-exports — a true bypass) and `voice-orb-3d.tsx:5-6` (`BlendFunction` from `postprocessing`, `Fluid` from `@whatisjery/react-fluid-distortion` — the barrel re-exports neither, and no other file under `src/` imports them).
- **Behaviour notes / chunk-dedup role:** The header (`r3f.ts:1-14`) states the barrel makes webpack/turbopack see "a single module-graph node for the R3F universe", letting it hoist a shared chunk above multiple async `import()` boundaries "instead of emitting duplicate 873KB chunks per boundary", labelled "C-3 Option B". Named exports only, explicitly to avoid collisions between fiber/drei/postprocessing (`r3f.ts:12-13`). `next.config.ts:147-169` records the measured outcome: `three`, `@react-three/fiber`, `@react-three/drei` are deliberately **excluded** from `experimental.optimizePackageImports` (which is `["lucide-react", "motion"]`, `next.config.ts:170`) because that flag did not collapse the twin chunk; the Next 16.3.0 upgrade did. Measured chunk totals in that comment: 16.2.9 → `876 + 876 + 256 + 20 + 8 = 2036 KB` across 5 chunks (two 876 KB copies); 16.3.0 → `876 + 256 + 20 + 8 = 1160 KB` across 4 chunks (one copy); delta −876 KB (−43%), confirmed by `WebGLRenderer` appearing in exactly one chunk (37 occurrences).
- **Gotchas / invariants:**
  - `next.config.ts:169` states outright: "The `src/lib/r3f.ts` barrel stays — it is load-bearing for the single-copy outcome." Adding `three`/`@react-three/*` back to `optimizePackageImports`, or adopting `experimental.turbopackChunking` / `turbopackSharedRuntime`, is explicitly ruled out (`next.config.ts:166-168`).
  - Any new R3F consumer must import from this barrel. `src/components/hero-graph/scene-physics.tsx:4-6` currently does not (see its block); `src/components/chat/voice-orb-3d.tsx:5-6` imports `postprocessing` and `@whatisjery/react-fluid-distortion` directly, and the barrel has no export for either. CI (`scripts/bundle-budget.mjs:84`, marker `WebGLRenderer`) only asserts three.js stays off the first-load path; nothing enforces the single-copy property beyond this barrel convention.
  - `src/components/hero-avatar/rig.ts:1-4` deliberately uses a type-only `three` import to stay off the runtime graph for the same reason.

### `public/avatar/sairam.glb`
- **Role:** The one and only asset under `public/avatar/`; the avatar model loaded by `avatar-mesh.tsx`.
- **Verified properties** (parsed directly from the GLB container):
  - Size on disk: **1,105,768 bytes** (~1.055 MB). Container magic `glTF`, version field `2`, declared total length `1105768`.
  - `asset.generator`: `glTF-Transform v4.4.2`.
  - `extensionsUsed`: `EXT_meshopt_compression`, `EXT_texture_webp`, `KHR_mesh_quantization`.
  - 13 images, **all** `image/webp`. 5 skins. 57 nodes.
  - Mesh names: `avaturn_body`, `avaturn_hair_0`, `avaturn_hair_1`, `avaturn_shoes_0`, `avaturn_look_0` — an **Avaturn** export, not the ReadyPlayerMe export the code comments describe.
  - Rig-relevant node names present: `Head`, `Neck`, `Spine2`, `Spine1`, `Spine`. Under `resolveRig` these map to head=`Head`, neck=`Neck`, chest=`Spine1`, spine=`Spine2` (the hierarchy is `Hips` > `Spine` > `Spine1` > `Spine2` > `Neck` > `Head`, so traversal reaches plain `Spine` first and `Spine2` overwrites it — last match wins, and plain `Spine` is never driven), morph=`null`.
- **Validation (`src/lib/avatar-glb.test.ts`, node vitest project):** asserts the file exists at the loader's hardcoded path (`:53-56`); size `< MAX_BYTES = 1.5 * 1024 * 1024` (`:21`, `:58-61`); valid glTF 2.0 container (`:63-66`); `extensionsUsed` contains `EXT_meshopt_compression` + `KHR_mesh_quantization` (`:70-74`); `EXT_texture_webp` present and every image mimeType is exactly `image/webp` (`:76-84`); every image bufferView payload starts with `RIFF`…`WEBP` (`:86-95`); head / neck / chest-or-spine1 / spine-not-spine1 bones exist by name (`:101-125`); `skins.length > 0` (`:127-129`).
- **Documented gap asserted as a test:** `avatar-glb.test.ts:132-157` asserts the file has **zero** morph targets and **no** mesh whose name contains `"head"`. The comment at `:135-143` records that this makes the entire eye-gaze code path in `avatar-mesh.tsx` inert (`rig.morph` is `null`, so every `setMorph()` is skipped), while head/neck rotation and idle breathing still work because they are bone-driven. The stated flip condition: change that expectation to `toBeGreaterThan(0)` when a blendshape-enabled avatar is exported.
- **Gotchas / invariants:** The size budget exists because the asset is on the hero download path whenever `NEXT_PUBLIC_HERO_MODE=avatar` (`avatar-glb.test.ts:18-20`). Re-exporting without meshopt/quantization or with PNG/JPEG textures fails the suite — and since `pnpm test` runs inside `pnpm build`, it blocks the deploy. `EXT_texture_webp` needs no loader wiring; the test comment (`:77-79`) records it as natively supported by three.js `GLTFLoader` (verified in r184). There is no `public/avatar/` fallback image, poster, or `.gltf` sidecar — a missing/corrupt GLB means the avatar canvas mounts and shows nothing.

## Cross-references outside this section

- `src/components/home/hero.tsx:25,30` is the sole mount point for both hero WebGL slots and the place `NEXT_PUBLIC_HERO_MODE` is branched.
- `src/lib/graph-data.ts` supplies `graphNodes` (16 entries: work 5, engine 4, tool 4, agent 3), `graphEdges` (19 pairs), `resolveKindColor` (the live-theme mapping `scene.tsx` uses) and `kindColor` (`work: #38e1ff`, `agent: #a78bfa`, `engine: #4ade80`, `tool: #fbbf24`); positions are deliberately deterministic — "Positions are deterministic (no Math.random) so SSR/build stays stable" (`graph-data.ts:6`).
- `src/lib/use-reduced-motion.ts` and `src/lib/use-media-query.ts` (`useMediaQuery`, `useWebGLSupported`) are the gate primitives; both return `false` on the server.
- `patches/@react-three__fiber@9.7.0.patch` (registered at `pnpm-workspace.yaml:54`, rationale at `:50-53`) guards `createPointerEvents().connect()` against a null target (pmndrs/react-three-fiber#3754), which otherwise crashes a canvas on unmount/remount races. Drop the patch when a fiber release contains the upstream fix; upgrading `@react-three/fiber` past 9.7.0 without doing so breaks `pnpm install` (the patch key is the exact version `@react-three/fiber@9.7.0`, `package.json` allows `^9.7.0`, and `allowUnusedPatches` is unset, so pnpm's default of failing on an unapplied patch applies).
- `src/components/game/build-graph.tsx` / `build-graph-scene.tsx` are the Play-view R3F surface (game section) and share `WebGLBoundary`, the barrel, `frameloop="demand"` and `dpr={[1,1.75]}`.
- `src/components/chat/voice-orb-3d.tsx` is the only post-processing consumer of the barrel and the only canvas that toggles `frameloop` at runtime (`errorMode ? "demand" : "always"`, `voice-orb-3d.tsx:306`). It is mounted by `src/components/chat/voice-orb.tsx` (talk mode; `useWebGLSupported()` probe at `voice-orb.tsx:38`, `onFail` at `:46`, falls back to the 2D `VoiceOrbCanvas`) and by `src/app/not-found.tsx` under `NEXT_PUBLIC_404_ORB=true` (`errorMode`, plain `WebGLBoundary`, no probe). Owned by the chat/game sections, not this one.
- `e2e/views.spec.ts:214-237` asserts a canvas appears for `?view=gamified` — but only above 768px (matching `build-graph.tsx`'s own gate); below that it asserts on `GraphIndex`'s accessible region instead, since `BuildGraph` renders nothing there by design. The canvas assertion itself is scoped to `#main-content` because a bare `canvas` locator matches two canvases (the graph plus an aria-hidden decorative one).

## Coverage

- `src/components/hero-avatar/index.tsx`
- `src/components/hero-avatar/avatar-scene.tsx`
- `src/components/hero-avatar/avatar-mesh.tsx`
- `src/components/hero-avatar/avatar-controls.tsx`
- `src/components/hero-avatar/rig.ts`
- `src/components/hero-avatar/use-avatar-gaze.ts`
- `src/components/hero-avatar/use-avatar-idle.ts`
- `src/components/hero-graph/index.tsx`
- `src/components/hero-graph/scene.tsx`
- `src/components/hero-graph/scene-physics.tsx`
- `src/components/game/webgl-boundary.tsx`
- `src/lib/r3f.ts`
- `public/avatar/sairam.glb`
- `patches/@react-three__fiber@9.7.0.patch`

Present in scope directories but excluded as tests (see Scope note): `src/components/hero-graph/index.dom.test.tsx` (described in the `hero-graph/index.tsx` block), `src/components/hero-avatar/index.dom.test.tsx`, `src/components/hero-avatar/rig.test.ts`, `src/components/hero-avatar/use-avatar-gaze.test.ts`, `src/components/hero-avatar/use-avatar-idle.test.ts`.

## Resolved since v3.4.2

Both of the unused-dependency questions this section raised at v3.4.2 are now answered: the dependencies were not being kept for a future variant, they were dead, and they are gone.

- **`@react-three/offscreen` — was declared but imported nowhere; removed in v3.5.0** (`CHANGELOG.md:503-508`). At v3.4.2, `CLAUDE.md` listed "`@react-three/offscreen` for worker offload" as a hero-graph decision, but no worker, `OffscreenCanvas`, or `<Canvas worker=…>` usage ever existed in this subsystem and a grep for `offscreen`/`Offscreen` across `src/` still returns no matches. The observation that outlived the package: the CSP `worker-src 'self' blob:` directive (`next.config.ts:68`) is still in place for a worker that was never there.
- **`@react-three/rapier` — was declared but imported nowhere; removed in v3.5.0** (`CHANGELOG.md:503-508`). The only textual matches were and remain prose comments (`scene-physics.tsx:12`, `hero-graph/index.tsx:15`). Removal also dropped `@dimforge/rapier3d-compat` from 0.19.2 to 0.12.0 only, leaving `@types/three` as its sole consumer (`CHANGELOG.md:506-508`). The `hero-graph/index.tsx` comment has since been rewritten (`:14-17`) to say the package was declared, unused, and removed in v3.5.0, so it no longer misstates the dependency.
- **The `NEXT_PUBLIC_GRAPH_PHYSICS` flag and `scene-physics.tsx` are unchanged**, so the "despite the name, no physics engine" observation above stands on its own merits; only the dependency status changed.

## UNVERIFIED

- No LOD (level-of-detail) mechanism exists in this subsystem — no `<Detailed>`, `THREE.LOD`, or distance-based swap. The only quality knobs are the `dpr` clamp and the 768 px mobile cutoff. (Stated as an absence, verified by grep; the assignment asked about LOD.)
- I did not run `pnpm build`, so the chunk sizes quoted in `next.config.ts:153-164` are reported as the code's own recorded measurements, not independently reproduced here.
- `NEXT_PUBLIC_GRAPH_PHYSICS` is not present in `.env.example`; `docs/configuration.md` lists it (a flag row and a read-site row for `src/components/hero-graph/index.tsx` — find both with `grep -n GRAPH_PHYSICS docs/configuration.md`). In `src/` it appears only in `src/components/hero-graph/index.tsx` (the read at `:10`, a comment at `:13`) and a comment at `src/components/hero-graph/scene-physics.tsx:15`, and `CLAUDE.md` mentions it in its `### 3D Graph` section and in its "Other variables the code reads" table (`.env.local` is deliberately not read). `NEXT_PUBLIC_HERO_MODE` and `NEXT_PUBLIC_AVATAR_POSITION` ARE documented at `docs/configuration.md:167-168`.
