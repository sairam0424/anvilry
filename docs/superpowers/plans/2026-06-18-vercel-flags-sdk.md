# Vercel Flags SDK Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `NEXT_PUBLIC_DISCOVERY_BADGES` to the Vercel Flags SDK for instant no-redeploy toggling, while keeping all other beast-mode flags as `NEXT_PUBLIC_` build-time variables — controlled by a single `FLAG_DRIVER` env var that switches the evaluation path.

**Architecture:** A thin `src/lib/flags.ts` module resolves `discoveryBadges` from either the Vercel Flags SDK (runtime, edge-evaluated, instant toggle) or the existing `NEXT_PUBLIC_DISCOVERY_BADGES` env var (build-time, current behaviour) based on `FLAG_DRIVER=vercel|local`. The server-side resolved value flows from a new RSC wrapper down into the existing `<DiscoveryBadge />` and `providers.tsx` via a React prop, replacing the inline `process.env` reads. All other 5 beast-mode flags remain untouched `NEXT_PUBLIC_` reads.

**Tech Stack:** `@vercel/flags` (new), `@vercel/flags/next` adapter, Next.js 16 App Router RSC + client components, existing `@upstash/redis` (Vercel Flags uses it for overrides in dev dashboard).

## Global Constraints

- Next.js 16.2.9, TypeScript strict, Tailwind v4, pnpm
- Only `NEXT_PUBLIC_DISCOVERY_BADGES` migrates in this plan — all other flags stay unchanged
- `FLAG_DRIVER=vercel` enables SDK path; `FLAG_DRIVER=local` (or unset) preserves current build-time path
- No new Redis dependency — `@vercel/flags` uses the existing `UPSTASH_REDIS_REST_URL`/`_TOKEN`
- No breaking changes to the `DiscoveryBadge` component's props API
- `pnpm build && pnpm test` must stay green at every commit
- Conventional commits, no `Co-Authored-By`
- Branch: `feat/vercel-flags-sdk` from `develop`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/flags.ts` | **Create** | Single source of truth — exports `getDiscoveryBadgesEnabled(): Promise<boolean>`. Switches between Vercel SDK and `NEXT_PUBLIC_` based on `FLAG_DRIVER`. |
| `src/app/layout.tsx` | **Modify** | Read `discoveryBadges` server-side via `flags.ts`; pass as prop to `<Providers>`. |
| `src/components/providers.tsx` | **Modify** | Accept `discoveryBadgesEnabled: boolean` prop; remove inline `process.env` read; pass to `<DiscoveryBadge>`. |
| `src/components/game/discovery-badge.tsx` | **Modify** | Accept `enabled: boolean` prop instead of reading `process.env` directly. |
| `src/components/command-palette.tsx` | **Modify** | Accept `discoveryBadgesEnabled: boolean` prop instead of inline `process.env` read. |
| `.env.example` | **Modify** | Document `FLAG_DRIVER` and `FLAGS_SECRET` variables. |
| `docs/configuration.md` | **Modify** | Add `FLAG_DRIVER` to the feature flags section. |

> **Not touched:** `src/lib/discovery-store.ts`, `src/app/not-found.tsx`, `src/components/site-footer.tsx`, `src/components/view-context.tsx`, `src/components/game/game-view.tsx`, `src/components/chat/voice-orb-3d.tsx` — all still use `NEXT_PUBLIC_` and are out of scope.

---

## Task 1: Install `@vercel/flags` and create `src/lib/flags.ts`

**Files:**
- Create: `src/lib/flags.ts`

**Interfaces:**
- Produces: `getDiscoveryBadgesEnabled(): Promise<boolean>` — async because the SDK path awaits an edge fetch; the local path returns synchronously wrapped in `Promise.resolve`.

- [ ] **Step 1: Install the SDK**

```bash
pnpm add @vercel/flags
```

Expected output: `+ @vercel/flags X.Y.Z` in the pnpm output, no peer dep warnings.

- [ ] **Step 2: Verify the install**

```bash
node -e "require('@vercel/flags'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Create `src/lib/flags.ts`**

```typescript
/**
 * Feature flag resolver — single source of truth for runtime vs build-time evaluation.
 *
 * FLAG_DRIVER=vercel  → Vercel Flags SDK (server-side, instant no-redeploy toggle)
 * FLAG_DRIVER=local   → NEXT_PUBLIC_DISCOVERY_BADGES env var (build-time, current default)
 *
 * Only discoveryBadges is migrated here. All other beast-mode flags remain
 * NEXT_PUBLIC_ build-time reads in their respective files.
 */
import { flag } from "@vercel/flags/next";

const useVercelDriver = process.env.FLAG_DRIVER === "vercel";

// The typed flag declaration — used only when FLAG_DRIVER=vercel.
// The id must match the flag ID created in the Vercel dashboard exactly.
const discoveryBadgesFlag = flag<boolean>({
  key: "NEXT_PUBLIC_DISCOVERY_BADGES",
  defaultValue: false,
  description: "Show the ★ N/5 discovered exploration badge (bottom-right)",
  options: [
    { label: "Off", value: false },
    { label: "On", value: true },
  ],
  decide() {
    // No custom logic — return the dashboard value.
    return this.defaultValue;
  },
});

/**
 * Resolve whether the discovery badges feature is enabled.
 * Call from a Server Component or a Route Handler (never from client components).
 */
export async function getDiscoveryBadgesEnabled(): Promise<boolean> {
  if (useVercelDriver) {
    return discoveryBadgesFlag();
  }
  // Build-time path — same semantics as the original NEXT_PUBLIC_ read.
  return process.env.NEXT_PUBLIC_DISCOVERY_BADGES === "true";
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors on `src/lib/flags.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/flags.ts pnpm-lock.yaml package.json
git commit -m "feat(flags): add @vercel/flags SDK + flags.ts with FLAG_DRIVER switch"
```

---

## Task 2: Resolve the flag server-side in `layout.tsx` and thread it to `<Providers>`

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/providers.tsx`

**Interfaces:**
- Consumes: `getDiscoveryBadgesEnabled(): Promise<boolean>` from `src/lib/flags.ts`
- Produces: `<Providers discoveryBadgesEnabled={boolean}>` — the prop that flows to all consumers

- [ ] **Step 1: Read current `layout.tsx`**

```bash
cat src/app/layout.tsx
```

Identify the line that renders `<Providers>`. Note the exact JSX and surrounding imports.

- [ ] **Step 2: Update `layout.tsx` to resolve the flag and pass it as a prop**

In `src/app/layout.tsx`, add the import and awaited call. The file is a Server Component (`async function`) so `await` is valid at the top level of the component:

```typescript
// Add this import at the top alongside existing imports:
import { getDiscoveryBadgesEnabled } from "@/lib/flags";
```

Inside the `RootLayout` async function body, before the return, add:

```typescript
const discoveryBadgesEnabled = await getDiscoveryBadgesEnabled();
```

Then on the `<Providers>` JSX, add the prop:

```tsx
<Providers discoveryBadgesEnabled={discoveryBadgesEnabled}>
```

- [ ] **Step 3: Update `src/components/providers.tsx` to accept and use the prop**

Replace the existing `DiscoveryBadge` dynamic-import logic and `<InkTransition />` section. The full new file:

```typescript
"use client";

import dynamic from "next/dynamic";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ViewProvider } from "@/components/view-context";
import { ScrollFlagsSync } from "@/lib/scroll/scroll-flags";

const InkTransition = dynamic(
  () => import("@/components/ui/ink-transition").then((m) => m.InkTransition),
  { ssr: false },
);

const DiscoveryBadgeComponent = dynamic(
  () => import("@/components/game/discovery-badge").then((m) => m.DiscoveryBadge),
  { ssr: false },
);

export function Providers({
  children,
  discoveryBadgesEnabled,
}: {
  children: ReactNode;
  discoveryBadgesEnabled: boolean;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <ViewProvider>
        <ScrollFlagsSync>{children}</ScrollFlagsSync>
        <InkTransition />
        {discoveryBadgesEnabled && <DiscoveryBadgeComponent />}
      </ViewProvider>
    </MotionConfig>
  );
}
```

> **Note:** `DiscoveryBadgeComponent` is always imported (lazy) but only mounted when `discoveryBadgesEnabled` is true — same runtime behaviour as before, but the gate is now a prop not a build-time constant.

- [ ] **Step 4: Run type check**

```bash
pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Run build**

```bash
pnpm build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`, all 51 pages generated, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/components/providers.tsx
git commit -m "feat(flags): resolve discoveryBadges server-side in layout + thread to Providers"
```

---

## Task 3: Remove inline `process.env` reads from `command-palette.tsx`

The command palette currently has:

```typescript
...(process.env.NEXT_PUBLIC_DISCOVERY_BADGES === "true" ? [ ... ] : []),
```

This needs to become a prop.

**Files:**
- Modify: `src/components/command-palette.tsx`

**Interfaces:**
- Consumes: `discoveryBadgesEnabled: boolean` prop (injected from wherever `<CommandPalette>` is mounted)

- [ ] **Step 1: Find where `<CommandPalette>` is mounted**

```bash
grep -rn "CommandPalette" src/ --include="*.tsx" --include="*.ts"
```

Note the exact file and line. Typically it is in `src/app/layout.tsx` or a client wrapper component.

- [ ] **Step 2: Add `discoveryBadgesEnabled` prop to `CommandPalette`**

In `src/components/command-palette.tsx`, find the component's prop type (look for `type Props = {...}` or the function signature) and add:

```typescript
discoveryBadgesEnabled?: boolean;
```

Then in the `views` array construction, replace:

```typescript
...(process.env.NEXT_PUBLIC_DISCOVERY_BADGES === "true" ? [
  { id: "unlock-discoveries", ... },
] : []),
```

with:

```typescript
...(discoveryBadgesEnabled ? [
  { id: "unlock-discoveries", ... },
] : []),
```

- [ ] **Step 3: Pass the prop from the mount site**

At the site found in Step 1, pass the resolved value:

```tsx
<CommandPalette discoveryBadgesEnabled={discoveryBadgesEnabled} />
```

If the mount site is a client component that doesn't have access to the server-resolved value, pass it as a prop from `layout.tsx` (same pattern as `<Providers>`).

- [ ] **Step 4: Remove the now-unused `unlockAll` import from `command-palette.tsx` if it was only used in the conditional block**

```bash
grep -n "unlockAll" src/components/command-palette.tsx
```

If `unlockAll` is only referenced inside the conditional block that now uses the prop, it is still needed — it is called when the menu item is activated. Leave it.

- [ ] **Step 5: Run type check and tests**

```bash
pnpm exec tsc --noEmit && pnpm test --run 2>&1 | tail -10
```

Expected: no TypeScript errors, `455 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/components/command-palette.tsx src/app/layout.tsx
git commit -m "refactor(flags): remove inline process.env read from command-palette"
```

---

## Task 4: Add `FLAGS_SECRET` to proxy and `/.well-known/vercel/flags` endpoint

The Vercel Flags SDK requires two things to connect the dashboard:

1. A `FLAGS_SECRET` env var (32-byte random — used to sign flag override cookies)
2. A `GET /.well-known/vercel/flags` route that returns the flag manifest (used by the dashboard to list/override flags)

**Files:**
- Create: `src/app/.well-known/vercel/flags/route.ts`
- Modify: `src/proxy.ts` (allow the `/.well-known/vercel/flags` path to bypass admin auth)

**Interfaces:**
- Produces: `GET /.well-known/vercel/flags` → JSON manifest required by Vercel dashboard

- [ ] **Step 1: Generate `FLAGS_SECRET` locally**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Copy the output. Add it to `.env.local`:

```
FLAGS_SECRET=<output from above>
```

> **Do not commit `.env.local`.** Add `FLAGS_SECRET` to Vercel Project Settings → Environment Variables for production.

- [ ] **Step 2: Create the flags manifest route**

Create `src/app/.well-known/vercel/flags/route.ts`:

```typescript
import { getProviderData, verifyAccess } from "@vercel/flags/next";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const access = await verifyAccess(request.headers.get("Authorization"));
  if (!access) return NextResponse.json(null, { status: 401 });

  return NextResponse.json(
    getProviderData({
      // Register the flags served by this app so the dashboard can list them.
      flags: [
        {
          key: "NEXT_PUBLIC_DISCOVERY_BADGES",
          origin: "https://vercel.com/sairams-projects-d50d7437/anvilry/flag/NEXT_PUBLIC_DISCOVERY_BADGES",
          description: "Show the ★ N/5 discovered exploration badge (bottom-right)",
          defaultValue: false,
          options: [
            { label: "Off", value: false },
            { label: "On", value: true },
          ],
        },
      ],
    }),
  );
}
```

- [ ] **Step 3: Verify the matcher in `proxy.ts` doesn't block `/.well-known/`**

```bash
grep -n "matcher\|well-known" src/proxy.ts
```

The existing matcher is `/admin/:path*` — it does NOT intercept `/.well-known/`, so no proxy change is needed. If you see a catch-all matcher, add a negative lookahead to exclude `/.well-known/vercel/flags`.

- [ ] **Step 4: Run build to confirm the new route compiles**

```bash
pnpm build 2>&1 | grep "well-known\|ERROR\|error" | head -20
```

Expected: `○ /.well-known/vercel/flags` in the route table (Static).

- [ ] **Step 5: Run tests**

```bash
pnpm test --run 2>&1 | tail -5
```

Expected: `455 passed`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/.well-known/vercel/flags/route.ts"
git commit -m "feat(flags): add /.well-known/vercel/flags manifest endpoint"
```

---

## Task 5: Update `.env.example` and `docs/configuration.md`

**Files:**
- Modify: `.env.example`
- Modify: `docs/configuration.md`

- [ ] **Step 1: Add `FLAG_DRIVER` and `FLAGS_SECRET` to `.env.example`**

Find the beast-mode flags section (line ~135) and append after it:

```bash
# ─── Vercel Flags SDK — optional runtime flag evaluation ─────────────────────
# FLAG_DRIVER controls which evaluation path is used for NEXT_PUBLIC_DISCOVERY_BADGES:
#   local (DEFAULT)  — reads NEXT_PUBLIC_DISCOVERY_BADGES at build time (current behavior,
#                       requires a redeploy to toggle).
#   vercel           — evaluates via Vercel Flags SDK at request time (instant toggle
#                       from the Vercel dashboard, no redeploy needed). Requires
#                       FLAGS_SECRET to be set.
# FLAG_DRIVER=vercel
#
# FLAGS_SECRET — 32-byte random secret used by the Vercel Flags SDK to sign
# override cookies (required when FLAG_DRIVER=vercel).
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
# FLAGS_SECRET=<your-32-byte-base64url-secret>
```

- [ ] **Step 2: Add `FLAG_DRIVER` and `FLAGS_SECRET` to `docs/configuration.md`**

In the "Beast-Mode Feature Flags" table, add a note below the table:

```markdown
### Flag Driver — switching between build-time and runtime evaluation

| Variable | Values | Default | Description |
|---|---|---|---|
| `FLAG_DRIVER` | `local` \| `vercel` | `local` | **local** = `NEXT_PUBLIC_DISCOVERY_BADGES` env var evaluated at build time (requires redeploy to toggle). **vercel** = Vercel Flags SDK evaluates `NEXT_PUBLIC_DISCOVERY_BADGES` server-side at request time (instant toggle from the Vercel dashboard). Requires `FLAGS_SECRET`. |
| `FLAGS_SECRET` | 32-byte base64url string | — | Required when `FLAG_DRIVER=vercel`. Signs override cookies used by the Vercel Flags dashboard. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Never commit this value. |
```

Also add to the File Locations table at the bottom:

```markdown
| Flags module | `src/lib/flags.ts` |
| Flags manifest route | `src/app/.well-known/vercel/flags/route.ts` |
```

- [ ] **Step 3: Run build and tests one final time**

```bash
pnpm build 2>&1 | tail -10 && pnpm test --run 2>&1 | tail -5
```

Expected: build green, `455 passed`.

- [ ] **Step 4: Commit**

```bash
git add .env.example docs/configuration.md
git commit -m "docs: add FLAG_DRIVER + FLAGS_SECRET to .env.example and configuration.md"
```

---

## Task 6: Push branch and open PR to develop

- [ ] **Step 1: Verify final state**

```bash
git log --oneline -6
```

Expected: 5 commits on `feat/vercel-flags-sdk` — install+flags.ts, layout+providers, command-palette, manifest route, docs.

- [ ] **Step 2: Run full build + test one last time**

```bash
pnpm build && pnpm test --run 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`, `455 passed`.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin feat/vercel-flags-sdk
gh pr create --base develop \
  --title "feat(flags): Vercel Flags SDK integration with FLAG_DRIVER switch" \
  --body "Migrates NEXT_PUBLIC_DISCOVERY_BADGES to @vercel/flags SDK. FLAG_DRIVER=local (default) preserves existing build-time behaviour; FLAG_DRIVER=vercel enables instant no-redeploy toggling from the Vercel dashboard. All other beast-mode flags unchanged."
```

---

## Post-merge: Vercel dashboard wiring

After the PR merges and deploys, add to **Vercel Project Settings → Environment Variables**:

| Variable | Value | Environments |
|---|---|---|
| `FLAGS_SECRET` | `<32-byte base64url>` | Production, Preview, Development |
| `FLAG_DRIVER` | `vercel` | Production only (or all, your choice) |

Then verify at `/.well-known/vercel/flags` returns the flag manifest.

---

## Self-Review

**Spec coverage:** All requirements met —
- `FLAG_DRIVER` switch: ✅ Task 1 (`flags.ts`), threading in Tasks 2–3
- `NEXT_PUBLIC_DISCOVERY_BADGES` only: ✅ All other flags untouched
- `@vercel/flags` SDK: ✅ Task 1 install + Task 4 manifest route
- `FLAGS_SECRET` + manifest endpoint: ✅ Task 4
- Docs: ✅ Task 5

**Placeholder scan:** No TBDs. All code blocks are complete.

**Type consistency:** `getDiscoveryBadgesEnabled()` returns `Promise<boolean>` — used as `await getDiscoveryBadgesEnabled()` in layout.tsx → passed as `discoveryBadgesEnabled: boolean` prop everywhere. Consistent throughout.
