"use client";

import { useEffect } from "react";
import { useThree } from "@/lib/r3f";

interface ControlsRef {
  pitch: number;
  yaw: number;
}

/**
 * Attaches window-level mousemove + touchmove listeners.
 * The Canvas has pointer-events:none so R3F's built-in pointer tracking
 * never fires — we track it at the window level instead, exactly as
 * privacypuppet does (verified 3-0 in deep-research).
 *
 * Writes normalized [-1, 1] pitch/yaw into controlsRef.
 * Calls invalidate() so frameloop="demand" knows to render a new frame.
 * Never calls setState — zero React re-renders.
 */
export function AvatarControls({
  controlsRef,
}: {
  controlsRef: React.MutableRefObject<ControlsRef>;
}): null {
  const { invalidate } = useThree();

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      // Normalize to [-1, 1]: 0 = center, -1 = left/top, 1 = right/bottom
      controlsRef.current.yaw   =  (e.clientX / window.innerWidth  - 0.5) * 2;
      controlsRef.current.pitch = -(e.clientY / window.innerHeight - 0.5) * 2;
      invalidate();
    }

    function onTouchMove(e: TouchEvent) {
      if (!e.touches[0]) return;
      controlsRef.current.yaw   =  (e.touches[0].clientX / window.innerWidth  - 0.5) * 2;
      controlsRef.current.pitch = -(e.touches[0].clientY / window.innerHeight - 0.5) * 2;
      invalidate();
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [controlsRef, invalidate]);

  return null;
}
