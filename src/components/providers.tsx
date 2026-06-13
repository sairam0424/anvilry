"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ViewProvider } from "@/components/view-context";
import { ScrollFlagsSync } from "@/lib/scroll/scroll-flags";

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
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ViewProvider>
        <ScrollFlagsSync>{children}</ScrollFlagsSync>
      </ViewProvider>
    </MotionConfig>
  );
}
