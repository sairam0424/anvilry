"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ViewProvider } from "@/components/view-context";

/**
 * App-wide providers. MotionConfig reducedMotion="user" makes every Motion
 * component auto-disable transform/layout animations (preserving opacity) when the
 * visitor has OS "Reduce Motion" on — the verified WCAG mechanism. ViewProvider
 * lives INSIDE it so the Classic/Gamified/Chat views all inherit the same motion
 * governance, and any component can read the active view via useView().
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ViewProvider>{children}</ViewProvider>
    </MotionConfig>
  );
}
