"use client";

import dynamic from "next/dynamic";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ViewProvider } from "@/components/view-context";
import { ScrollFlagsSync } from "@/lib/scroll/scroll-flags";

// InkTransition renders a hidden <canvas> that fires the ink-burn WebGL shader on
// view switches. Lazy-loaded so the WebGL2 init never blocks the critical path.
// Skipped on SSR (ssr:false) — the canvas is interactive-only and uses window APIs.
const InkTransition = dynamic(
  () => import("@/components/ui/ink-transition").then((m) => m.InkTransition),
  { ssr: false },
);

// DiscoveryBadge shows "★ N/5 discovered" once the visitor unlocks exploration moments.
// Gate: NEXT_PUBLIC_DISCOVERY_BADGES=true. Client-only (reads localStorage).
const DiscoveryBadge = process.env.NEXT_PUBLIC_DISCOVERY_BADGES === "true"
  ? dynamic(
      () => import("@/components/game/discovery-badge").then((m) => m.DiscoveryBadge),
      { ssr: false },
    )
  : null;

/**
 * App-wide providers. MotionConfig reducedMotion="user" makes every Motion
 * component auto-disable transform/layout animations (preserving opacity) when the
 * visitor has OS "Reduce Motion" on — the verified WCAG mechanism. ViewProvider
 * lives INSIDE it so the Classic/Gamified/Chat views all inherit the same motion
 * governance, and any component can read the active view via useView().
 *
 * ScrollFlagsSync activates the ?scroll= / ?scrollmode= autoscroll bake-off flags
 * (URL > localStorage > default). Like ViewProvider's query sync, it isolates
 * useSearchParams behind its own Suspense boundary so the tree still prerenders.
 *
 * InkTransition mounts a fixed <canvas> (pointer-events:none, display:none until
 * firing) for the ink-bleed WebGL nav transition. Exposes itself via the global
 * `inkTransitionRef` for commitViewChange() in view-context.tsx.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ViewProvider>
        <ScrollFlagsSync>{children}</ScrollFlagsSync>
        {/* Ink canvas — fixed overlay, hidden until a view switch fires */}
        <InkTransition />
        {/* Discovery badge — shows "★ N/5 discovered" when exploration milestones are unlocked */}
        {DiscoveryBadge && <DiscoveryBadge />}
      </ViewProvider>
    </MotionConfig>
  );
}
