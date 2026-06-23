# C-2: motion/react Per-Route Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Audit the 140KB `motion/react` shared bundle — confirm whether it can be reduced by replacing `useReducedMotion` in shared primitives with a native hook, or document that the cost is fully justified.

**Architecture:** Investigation-first. Read all 22 import sites, check if `motion/react/mini` sub-path exists, check if shared primitives (`ui/skeleton.tsx`, `ui/reveal.tsx`) can drop the motion dependency. Code changes only if a real saving is found.

**Tech Stack:** Next.js 16, motion/react (Framer Motion v11+), TypeScript.

## Global Constraints

- Branch: `feat/c2-motion-audit` (cut from develop)
- Commit style: `fix(perf): ...` or `docs(perf): ...`
- No Co-Authored-By trailers
- YAGNI: only change code if a measurable bundle saving is confirmed

---

## File Map (audit targets)

| File | Usage | Changeable? |
|---|---|---|
| `src/components/providers.tsx` | `MotionConfig` — wraps every page | No — intentional global |
| `src/components/ui/skeleton.tsx` | `useReducedMotion` only | YES — replaceable with native |
| `src/components/ui/reveal.tsx` | `motion`, `useReducedMotion` | Partial — motion needed, useReducedMotion replaceable |
| `src/app/resume/page.tsx` | `motion`, `AnimatePresence` | No — legitimate page animation |
| `src/app/articles/page.tsx` | `motion`, `AnimatePresence` | No — legitimate |
| All others (17 files) | `motion.*` components | No — legitimate uses |

---

## Task 1: Check motion/react mini sub-path

**Files:** None modified

- [ ] **Step 1: Check if motion/react/mini exists**
```bash
ls node_modules/motion/react/mini* 2>/dev/null && echo "mini exists" || echo "no mini path"
cat node_modules/motion/package.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.get('exports',{}).keys())[:20])"
```

- [ ] **Step 2: Check MotionConfig size in mini vs full**
```bash
grep -l "MotionConfig" node_modules/motion/dist/*.js 2>/dev/null | head -3
```

- [ ] **Step 3: Record finding**
If `motion/react/mini` exists and covers `MotionConfig` + `motion.*` — file a follow-up ticket. If not — document and move on.

---

## Task 2: Replace useReducedMotion in shared primitives

**Files:**
- Modify: `src/components/ui/skeleton.tsx`
- Modify: `src/components/ui/reveal.tsx` (useReducedMotion only)

- [ ] **Step 1: Read both files**
```bash
cat src/components/ui/skeleton.tsx
cat src/components/ui/reveal.tsx
```

- [ ] **Step 2: Create a native useReducedMotion hook**

In `src/lib/use-reduced-motion.ts` (new tiny file):
```ts
import { useEffect, useState } from "react";

/** Native replacement for motion/react's useReducedMotion — no 140KB bundle cost. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}
```

- [ ] **Step 3: Update skeleton.tsx**

Replace:
```ts
import { useReducedMotion } from "motion/react";
```
With:
```ts
import { useReducedMotion } from "@/lib/use-reduced-motion";
```

- [ ] **Step 4: Update reveal.tsx — useReducedMotion only**

Replace:
```ts
import { motion, useReducedMotion } from "motion/react";
```
With:
```ts
import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
```

- [ ] **Step 5: Run quality gate**
```bash
npx tsc --noEmit 2>&1; echo "TSC:$?"
pnpm test 2>&1 | tail -5
pnpm build 2>&1 | grep -E "Compiled|error" | head -4
```

- [ ] **Step 6: Commit**
```bash
git add src/lib/use-reduced-motion.ts src/components/ui/skeleton.tsx src/components/ui/reveal.tsx
git commit -m "fix(perf): replace motion/react useReducedMotion with native hook in shared primitives"
```

---

## Task 3: Verify bundle impact + document findings

- [ ] **Step 1: Run bundle analysis**
```bash
ANALYZE=true pnpm build 2>&1 | tail -10
ls -lh .next/static/chunks/ | sort -rh | head -10
```

- [ ] **Step 2: Write findings to scratch-pad**

Create `scratch-pad/daily-logs/motion-audit-2026-06-23.md`:

```markdown
# motion/react Audit — 2026-06-23

## Import sites (22 total)
- providers.tsx: MotionConfig — unavoidable (wraps every page)
- skeleton.tsx, reveal.tsx: useReducedMotion — REPLACED with native hook
- resume, articles, notes, chat: motion.* — legitimate animations, keep

## Bundle change
[before/after chunk sizes]

## Conclusion
[either: X KB saved by native useReducedMotion | or: 140KB fully justified, close]
```

- [ ] **Step 3: PR**
```bash
git push -u origin feat/c2-motion-audit
gh pr create --base develop \
  --title "fix(perf): C-2 motion/react audit — native useReducedMotion in shared primitives" \
  --body "Replaces motion/react's useReducedMotion with a 10-line native hook in skeleton.tsx and reveal.tsx. The 140KB motion bundle is otherwise fully justified (22 import sites, all legitimate animations). Bundle findings in scratch-pad."
```
