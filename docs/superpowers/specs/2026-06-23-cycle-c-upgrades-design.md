# Anvilry Cycle C Upgrades Design

**Date:** 2026-06-23
**Phases:** C-1 Directional View Transitions · C-2 motion/react Audit · C-3 R3F Twin-Chunk Dedup · C-4 R3F Physics
**Branch model:** Each phase is a separate feature branch → PR to `develop`

---

## Context

Four unblocked performance and polish upgrades derived from the v2.3–v2.5 deep-research audit and bundle analysis. All build on the existing architecture without breaking changes.

**Key constraints discovered during exploration:**
- View transitions already work (cross-fade via `document.startViewTransition` in `view-context.tsx`, `viewTransitionName: "view-body"` in `view-router.tsx`, CSS in `globals.css`). C-1 upgrades the animation from cross-fade to directional slide — pure CSS + one JS change.
- `motion/react` (140KB) is used in 22 files across the app — `MotionConfig` in `providers.tsx` wraps every page, and `motion.*` components are used in articles, resume, notes, chat, and UI primitives. The 140KB is largely unavoidable. C-2 is a targeted audit to confirm this.
- R3F chunks (2 × 876KB) are already correctly lazy-loaded — only activate when user enters Play/voice view. C-3 is a config investigation, not a behaviour change.
- The 3D graph (`src/components/hero-graph/`) uses `@react-three/fiber` + `three` with instanced meshes and `frameloop="demand"`. C-4 adds `@react-three/rapier` physics on top, feature-flagged.

**View order for directional transitions:**
`classic (0) → gamified (1) → chat (2) → developer (3) → voice (4) → resume (5)`
Navigating to a higher index = slide left (forward). Lower index = slide right (backward).

---

## Phase C-1: Directional View Transitions

### Goal

Upgrade the existing cross-fade view transition to a directional slide — forward in nav order slides the new view in from the right, backward slides from the left. Pure CSS + one JS signal.

### Architecture — 2 files modified

#### `src/components/view-context.tsx`

Before calling `document.startViewTransition`, compute the direction and stamp `data-view-dir` on `<html>`:

```ts
const VIEW_ORDER: Record<View, number> = {
  classic: 0, gamified: 1, chat: 2, developer: 3, voice: 4, resume: 5,
};

// In setViewInternal, before commitViewChange():
const dir = VIEW_ORDER[view] > VIEW_ORDER[current] ? "forward" : "backward";
if (typeof document !== "undefined") {
  document.documentElement.dataset.viewDir = dir;
}
```

The attribute is stamped BEFORE `startViewTransition` so the CSS can read it during the snapshot phase.

#### `src/app/globals.css`

Replace the existing `::view-transition-group(view-body)` block with directional keyframes:

```css
/* Directional slide keyframes */
@keyframes slide-in-from-right  { from { transform: translateX(6%);  opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes slide-in-from-left   { from { transform: translateX(-6%); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes slide-out-to-left    { from { transform: none; opacity: 1; } to { transform: translateX(-6%); opacity: 0; } }
@keyframes slide-out-to-right   { from { transform: none; opacity: 1; } to { transform: translateX(6%);  opacity: 0; } }

/* Forward (classic → chat etc): new slides in from right, old slides out to left */
[data-view-dir="forward"]::view-transition-new(view-body)  { animation: slide-in-from-right 0.28s cubic-bezier(0.21,0.47,0.32,0.98) both; }
[data-view-dir="forward"]::view-transition-old(view-body)  { animation: slide-out-to-left   0.28s cubic-bezier(0.21,0.47,0.32,0.98) both; }

/* Backward (chat → classic etc): new slides in from left, old slides out to right */
[data-view-dir="backward"]::view-transition-new(view-body) { animation: slide-in-from-left  0.28s cubic-bezier(0.21,0.47,0.32,0.98) both; }
[data-view-dir="backward"]::view-transition-old(view-body) { animation: slide-out-to-right  0.28s cubic-bezier(0.21,0.47,0.32,0.98) both; }
```

Keep the existing reduced-motion kill-switch and `site-header` pin — unchanged.

**Why 6% translateX (not 100%)?** A full-screen slide is jarring on a portfolio. 6% is subtle — enough to convey direction without feeling like a page navigation. Same approach used by iOS Settings and Linear.

### Testing

- Switch Classic → Chat: new view slides in from right, old slides out left ✓
- Switch Chat → Classic: new view slides in from left, old slides out right ✓
- `prefers-reduced-motion: reduce`: no animation (kill-switch already in place) ✓
- Rapid switching: no jank (View Transitions API queues correctly) ✓

---

## Phase C-2: motion/react Per-Route Audit

### Goal

Confirm whether the 140KB `motion/react` bundle can be reduced, or document why it's unavoidable. Investigation-first — code changes only if a real leak is found.

### Architecture — investigation only (0-2 files modified)

**Audit steps:**

1. `MotionConfig` in `providers.tsx` wraps every page — this is unavoidable. `MotionConfig` itself is a thin wrapper (~2KB) but it imports from `motion/react` which pulls the full bundle.

2. Check if `motion/react` has tree-shaking support — if `MotionConfig` can be imported from `motion/react/mini` or similar sub-path, the bundle may be smaller.

3. Check pages that use `motion.*` components: `resume/page.tsx`, `articles/page.tsx`, `note-card.tsx`, `article-card.tsx`, `article-group-card.tsx` — these are SSG pages that ship motion for scroll animations. These are legitimate uses.

4. Check if `ui/skeleton.tsx` and `ui/reveal.tsx` (used everywhere) can replace `useReducedMotion` from motion with the native `window.matchMedia` hook to break the motion dependency in shared primitives.

**Decision tree:**
- If `motion/react/mini` exists and covers all usage → migrate, save ~60-80KB
- If `useReducedMotion` in shared primitives can be replaced with a native hook → break the dependency for those files
- If all usage is legitimate → document and close

**Files that may change:** `src/components/ui/skeleton.tsx`, `src/components/ui/reveal.tsx`, `src/components/providers.tsx`

**Success criterion:** Either a measurable bundle reduction OR a documented confirmation that the 140KB is fully justified.

---

## Phase C-3: R3F Twin-Chunk Dedup

### Goal

Collapse the turbopack twin-chunk split (2 × 876KB = 1.75MB) for `@react-three/fiber` + `three` into a single ~900KB lazy chunk. No behaviour change.

### Architecture — 1-2 files modified

**Root cause:** Turbopack creates two separate chunk groups for the same R3F + THREE code because `HeroGraph`, `BuildGraph`, and `VoiceOrb3D` are three separate `next/dynamic` entry points that all import the same large libraries. Without a shared chunk hint, turbopack deduplicates at the module level but creates separate chunk files.

**Fix approach (try in order, stop at first success):**

**Option A — `experimental.optimizePackageImports`** in `next.config.ts`:
```ts
experimental: {
  optimizePackageImports: ["three", "@react-three/fiber", "@react-three/drei"],
}
```
This tells turbopack to treat these as shared and emit a single chunk.

**Option B — Shared re-export barrel** if Option A doesn't work:
Create `src/lib/r3f.ts` that re-exports everything from `@react-three/fiber` and `three`. All three dynamic components import from this barrel. Turbopack sees one entry point → one chunk.

**Verification:** `ANALYZE=true pnpm build` + check `.next/static/chunks/` for the chunk count and total size. Pass: 1 chunk ≤ 950KB (vs current 2 × 876KB = 1.75MB).

**Risk:** Low. Both options are additive config/barrel changes. Easy to revert.

---

## Phase C-4: R3F Physics (Rapier)

### Goal

Add `@react-three/rapier` physics to the 3D graph view. Nodes become rigid bodies — hovering a node applies a small impulse that makes it "spring" slightly. The graph feels alive rather than static. Feature-flagged via `NEXT_PUBLIC_GRAPH_PHYSICS`.

### Architecture — 3 files modified, 1 new file

**Why rapier?** `@react-three/rapier` wraps the Rapier physics engine (WASM-based, extremely fast) with a React Three Fiber-friendly API. Nodes use `RigidBody` type `"kinematicPositionBased"` — the force-directed layout drives position, physics adds micro-impulses on hover and a gentle drift on idle. This avoids fighting the force simulation.

#### `src/components/hero-graph/scene.tsx`

- Wrap the scene in `<Physics gravity={[0, 0, 0]}>` (zero gravity — space aesthetic)
- Each node gets `<RigidBody type="kinematicPositionBased" restitution={0.8}>` wrapping its instanced mesh
- On hover: `rigidBody.applyImpulse({ x: 0, y: 0.02, z: 0 }, true)` — gentle upward nudge
- The existing force-directed position is applied via `rigidBody.setNextKinematicTranslation()`

#### `src/components/hero-graph/index.tsx`

- Add `GRAPH_PHYSICS = process.env.NEXT_PUBLIC_GRAPH_PHYSICS === "true"` guard
- When flag is off: render existing scene unchanged (no rapier imported, zero bundle impact)
- When flag is on: dynamic-import rapier-enhanced scene variant

#### `src/components/hero-graph/scene-physics.tsx` (new file)

Physics-enhanced scene variant — extends `scene.tsx` with Rapier. Keeps the base scene clean (no physics imports leak in when flag is off).

### Feature Flag

| Var | Default | Effect |
|---|---|---|
| `NEXT_PUBLIC_GRAPH_PHYSICS` | `false` | Enables Rapier physics in 3D graph view |

### Bundle impact

`@react-three/rapier` + Rapier WASM: ~400KB additional. This joins the existing lazy R3F chunk (only loads when user activates Play view). Zero impact on any other route.

### Testing

- `NEXT_PUBLIC_GRAPH_PHYSICS=false`: graph renders exactly as before, rapier not in bundle ✓
- `NEXT_PUBLIC_GRAPH_PHYSICS=true`: hover a node → gentle spring impulse ✓
- Mobile / low-end: physics runs at 60fps (Rapier WASM is extremely fast) ✓
- `prefers-reduced-motion`: impulses suppressed (check `useReducedMotion` from motion) ✓

---

## Branch Naming

```
feat/c1-directional-transitions   → PR to develop
feat/c2-motion-audit              → PR to develop
feat/c3-r3f-chunk-dedup           → PR to develop
feat/c4-r3f-physics               → PR to develop
```

## File Change Summary

| Phase | Files Modified | New Files | Risk |
|---|---|---|---|
| C-1 | `view-context.tsx`, `globals.css` | 0 | Low |
| C-2 | 0-3 (audit-dependent) | 0 | Low |
| C-3 | `next.config.ts` OR new barrel | 0-1 | Low |
| C-4 | `scene.tsx`, `index.tsx` | `scene-physics.tsx` | Low-Medium |
