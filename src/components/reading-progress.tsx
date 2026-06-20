"use client";

import { useScroll, motion, useReducedMotion } from "motion/react";

/**
 * Thin fixed progress bar at the top of the viewport.
 * Scales from 0 → 1 on the X axis as the page scrolls from top to bottom.
 * Runs entirely on the compositor — zero JS re-renders.
 * Hidden for users with prefers-reduced-motion.
 */
export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();

  if (reduced) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="fixed left-0 top-0 z-50 h-[2px] w-full origin-left bg-accent"
      style={{ scaleX: scrollYProgress }}
    />
  );
}
