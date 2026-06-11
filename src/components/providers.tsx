"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * App-wide motion governance. reducedMotion="user" makes every Motion component
 * auto-disable transform/layout animations (preserving opacity) when the visitor
 * has OS "Reduce Motion" on — the verified WCAG mechanism.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
