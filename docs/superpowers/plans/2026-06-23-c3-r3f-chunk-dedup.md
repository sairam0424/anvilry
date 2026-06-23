# C-3: R3F Twin-Chunk Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Collapse the turbopack twin-chunk split (2 × 876KB = 1.75MB lazy) for `@react-three/fiber` + `three` into a single ~900KB lazy chunk. No behaviour change.

**Architecture:** Try `experimental.optimizePackageImports` in `next.config.ts` first (Option A). If that doesn't collapse the chunks, create a shared re-export barrel `src/lib/r3f.ts` (Option B). Verify with chunk size comparison.

**Tech Stack:** Next.js 16, Turbopack, `@react-three/fiber`, `three`.

## Global Constraints

- Branch: `feat/c3-r3f-chunk-dedup` (cut from develop)
- Zero behaviour changes — only bundle shape changes
- Commit style: `fix(perf): ...`
- No Co-Authored-By trailers
- Revert immediately if build breaks

---

## Task 1: Baseline measurement

- [ ] **Step 1: Record current chunk sizes**
```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm build 2>&1 | tail -5
ls -lh .next/static/chunks/*.js | sort -rh | head -5
```
Record the two 876KB chunk filenames and sizes. This is the baseline to beat.

---

## Task 2: Option A — optimizePackageImports

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Read next.config.ts**
```bash
cat next.config.ts | head -30
```

- [ ] **Step 2: Add optimizePackageImports to experimental block**

In the `experimental` object, add:
```ts
experimental: {
  inlineCss: true,
  viewTransition: true,
  optimizePackageImports: ["three", "@react-three/fiber", "@react-three/drei", "@react-three/postprocessing"],
},
```

- [ ] **Step 3: Build and measure**
```bash
pnpm build 2>&1 | grep -E "Compiled|error" | head -5
ls -lh .next/static/chunks/*.js | sort -rh | head -8
```

Expected success: The two 876KB chunks are replaced by a single chunk ≤ 950KB.

- [ ] **Step 4a: If chunks collapsed — commit Option A**
```bash
git add next.config.ts
git commit -m "fix(perf): add optimizePackageImports for R3F/THREE — collapses twin 876KB chunks"
```

- [ ] **Step 4b: If chunks did NOT collapse — revert and try Option B**
```bash
git checkout next.config.ts
```
Then proceed to Task 3.

---

## Task 3: Option B — shared re-export barrel (only if Option A failed)

**Files:**
- Create: `src/lib/r3f.ts`
- Modify: `src/components/hero-graph/scene.tsx`
- Modify: `src/components/hero-graph/index.tsx`
- Modify: `src/components/game/build-graph.tsx` (or wherever BuildGraphScene imports R3F)
- Modify: `src/components/chat/voice-orb-3d.tsx`

- [ ] **Step 1: Create the barrel**
```ts
// src/lib/r3f.ts
// Shared re-export barrel for @react-three/fiber and three.
// All dynamic R3F entry points import from here so turbopack
// emits a single shared chunk instead of twin splits.
export * from "@react-three/fiber";
export * as THREE from "three";
```

- [ ] **Step 2: Update all 4 dynamic R3F components**

In each file, replace:
```ts
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
```
With:
```ts
import { Canvas, useFrame, useThree, THREE } from "@/lib/r3f";
```

Note: only replace the R3F and THREE imports — keep `@react-three/drei` and `@react-three/postprocessing` imports as-is.

- [ ] **Step 3: Build and measure**
```bash
npx tsc --noEmit 2>&1; echo "TSC:$?"
pnpm build 2>&1 | grep -E "Compiled|error" | head -5
ls -lh .next/static/chunks/*.js | sort -rh | head -8
```

- [ ] **Step 4: Run tests**
```bash
pnpm test 2>&1 | tail -5
```

- [ ] **Step 5: Commit Option B**
```bash
git add src/lib/r3f.ts src/components/hero-graph/scene.tsx src/components/hero-graph/index.tsx src/components/chat/voice-orb-3d.tsx
git commit -m "fix(perf): shared R3F barrel to collapse turbopack twin-chunk split"
```

---

## Task 4: Document findings + PR

- [ ] **Step 1: Record result in scratch-pad**
```bash
echo "## R3F Chunk Dedup — $(date +%Y-%m-%d)
Option used: [A or B]
Before: 2 x 876KB = 1.75MB lazy
After: [new chunk size]
Delta: [saving]" >> scratch-pad/daily-logs/r3f-dedup-$(date +%Y-%m-%d).md
```

- [ ] **Step 2: Push and PR** (user pushes manually)
```bash
gh pr create --base develop \
  --title "fix(perf): C-3 R3F twin-chunk dedup — collapse 1.75MB lazy into single chunk" \
  --body "Collapses turbopack's twin 876KB R3F/THREE chunks into a single lazy chunk. Zero behaviour change — chunks only load when user activates Play/Voice view."
```
