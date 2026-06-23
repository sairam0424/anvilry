# C-1: Directional View Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the existing cross-fade view transition to a directional slide — forward in nav order slides in from the right, backward from the left.

**Architecture:** Stamp `data-view-dir="forward"|"backward"` on `<html>` before `startViewTransition` fires. CSS reads the attribute via `[data-view-dir="forward"]::view-transition-new(view-body)` selectors to pick the correct keyframe pair. Zero React component changes.

**Tech Stack:** CSS View Transitions API, Next.js 16, TypeScript.

## Global Constraints

- Branch: `feat/c1-directional-transitions` (cut from develop)
- 2 files only: `src/components/view-context.tsx` + `src/app/globals.css`
- Must NOT affect `prefers-reduced-motion` users (kill-switch already in globals.css — keep it)
- Must NOT affect the ink-transition WebGL path (`NEXT_PUBLIC_INK_TRANSITION=true`) — that path bypasses `startViewTransition`
- Commit style: `feat(ui): ...`
- No Co-Authored-By trailers

---

## File Map

| File | Change |
|---|---|
| `src/components/view-context.tsx` | Add `VIEW_ORDER` map + stamp `document.documentElement.dataset.viewDir` before transition |
| `src/app/globals.css` | Replace generic cross-fade with directional slide keyframes |

---

## Task 1: Add direction signal in view-context.tsx

**Files:**
- Modify: `src/components/view-context.tsx`

- [ ] **Step 1: Read the file**
```bash
cat src/components/view-context.tsx
```
Focus on `setViewInternal` function and the `VIEWS` constant.

- [ ] **Step 2: Add VIEW_ORDER map**

After the existing `const VIEWS` line (currently line 26), add:

```ts
/** Nav order used to compute slide direction. Must mirror the VIEWS array order. */
const VIEW_ORDER: Record<View, number> = {
  classic: 0,
  gamified: 1,
  chat: 2,
  developer: 3,
  voice: 4,
  resume: 5,
};
```

- [ ] **Step 3: Stamp data-view-dir before transition**

In `setViewInternal`, find the line `if (!isView(view) || view === current) return;`

After that line, before `current = view; commitViewChange();`, add:

```ts
// Stamp direction on <html> so CSS keyframes can pick the right slide direction.
// Must happen before startViewTransition snapshots the DOM.
if (typeof document !== "undefined" && transition) {
  document.documentElement.dataset.viewDir =
    VIEW_ORDER[view] > VIEW_ORDER[current] ? "forward" : "backward";
}
```

- [ ] **Step 4: Run typecheck**
```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
npx tsc --noEmit 2>&1 | head -10
```
Expected: 0 errors.

- [ ] **Step 5: Commit**
```bash
git add src/components/view-context.tsx
git commit -m "feat(ui): stamp data-view-dir on html before view transition fires"
```

---

## Task 2: Add directional slide CSS in globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Find the existing view transition block**
```bash
grep -n "view-transition" src/app/globals.css
```
Find the `::view-transition-group(view-body)` block (around line 263).

- [ ] **Step 2: Replace the block with directional keyframes**

Find and replace the entire block:
```css
::view-transition-group(view-body) {
  animation-duration: 0.28s;
  animation-timing-function: cubic-bezier(0.21, 0.47, 0.32, 0.98);
}
```

Replace with:
```css
/* Directional slide keyframes for view transitions */
@keyframes vt-slide-in-from-right  { from { transform: translateX(6%);  opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes vt-slide-in-from-left   { from { transform: translateX(-6%); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes vt-slide-out-to-left    { from { transform: none; opacity: 1; } to { transform: translateX(-6%); opacity: 0; } }
@keyframes vt-slide-out-to-right   { from { transform: none; opacity: 1; } to { transform: translateX(6%);  opacity: 0; } }

/* Forward (classic→chat etc): new view slides in from right, old slides out left */
[data-view-dir="forward"]::view-transition-new(view-body)  {
  animation: vt-slide-in-from-right 0.28s cubic-bezier(0.21, 0.47, 0.32, 0.98) both;
}
[data-view-dir="forward"]::view-transition-old(view-body)  {
  animation: vt-slide-out-to-left   0.28s cubic-bezier(0.21, 0.47, 0.32, 0.98) both;
}

/* Backward (chat→classic etc): new view slides in from left, old slides out right */
[data-view-dir="backward"]::view-transition-new(view-body) {
  animation: vt-slide-in-from-left  0.28s cubic-bezier(0.21, 0.47, 0.32, 0.98) both;
}
[data-view-dir="backward"]::view-transition-old(view-body) {
  animation: vt-slide-out-to-right  0.28s cubic-bezier(0.21, 0.47, 0.32, 0.98) both;
}
```

- [ ] **Step 3: Verify the site-header pin and reduced-motion kill-switch are still intact**
```bash
grep -A3 "site-header\|reduced-motion" src/app/globals.css | head -20
```
Both blocks must still be present unchanged.

- [ ] **Step 4: Run full quality gate**
```bash
pnpm lint 2>&1 | grep "problems"
npx tsc --noEmit 2>&1; echo "TSC:$?"
pnpm test 2>&1 | tail -5
pnpm build 2>&1 | grep -E "Compiled|error" | head -4
```

- [ ] **Step 5: Manual test**
```bash
pnpm dev
```
Open `http://localhost:3000`. Switch Classic → Chat → verify new view slides in from right. Switch Chat → Classic → verify new view slides in from left.

- [ ] **Step 6: Commit**
```bash
git add src/app/globals.css
git commit -m "feat(ui): directional slide view transitions — forward/backward based on nav order"
```

---

## Task 3: PR to develop

- [ ] **Step 1: Push** (user runs manually)
```bash
git push -u origin feat/c1-directional-transitions
```

- [ ] **Step 2: Open PR**
```bash
gh pr create --base develop \
  --title "feat(ui): C-1 directional view transitions — slide left/right by nav order" \
  --body "Upgrades the existing cross-fade to a directional slide. Forward in nav order (Classic→Chat) slides in from the right. Backward (Chat→Classic) slides in from the left. 2 files changed. Reduced-motion and ink-transition paths unchanged."
```
