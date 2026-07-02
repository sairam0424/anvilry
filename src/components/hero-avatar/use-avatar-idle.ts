import { useRef } from "react";
import { useFrame } from "@/lib/r3f";

export interface IdleOutput {
  chestY: number;
  spineY: number;
}

/**
 * Pure function extracted for testability.
 * ~15s per full breath cycle (0.42 rad/s), amplitude 0.003 radians — subtle.
 */
export function computeIdle(t: number): IdleOutput {
  const breathe = Math.sin(t * 0.42) * 0.003;
  return { chestY: breathe, spineY: breathe * 0.5 };
}

/**
 * Returns a ref (not state) — safe to read inside useFrame without re-renders.
 */
export function useAvatarIdle(): React.RefObject<IdleOutput> {
  const idleRef = useRef<IdleOutput>({ chestY: 0, spineY: 0 });

  useFrame(({ clock }) => {
    idleRef.current = computeIdle(clock.getElapsedTime());
  });

  return idleRef;
}
