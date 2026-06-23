"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { ReactNode } from "react";
import { useMounted } from "@/lib/use-mounted";

/**
 * Scroll-into-view reveal with a no-JS / pre-hydration safety net.
 *
 * The animation only engages AFTER mount (mounted=true confirms JS is alive). Before
 * that — and for crawlers, JS-disabled visitors, or a hydration failure — content
 * renders fully visible (static div), so it is never stuck at opacity:0. Reduced-motion
 * users also get the static path (verified useReducedMotion gate).
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const mounted = useMounted();

  if (reduced || !mounted) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}
