import { useRef } from "react";
import { useFrame } from "@/lib/r3f";

export interface GazeOutput {
  eyeLX: number;
  eyeLY: number;
  eyeRX: number;
  eyeRY: number;
}

/**
 * Pure function extracted for testability.
 * Multi-frequency drift + hash-based saccades (verified 3-0 in deep-research).
 * Saccade: involuntary micro-jump every ~2.5s — makes eyes feel alive, not glassy.
 */
export function computeGaze(
  t: number,
  pitch: number,
  yaw: number,
): GazeOutput {
  // Slow float: two sine waves at different frequencies
  const driftX = Math.sin(t * 0.31) * Math.cos(t * 0.73) * 0.008;
  const driftY = Math.sin(t * 0.17) * Math.cos(t * 0.59) * 0.006;

  // Deterministic saccade: hash of 2.5s time bucket → float in [-0.015, 0.015]
  const bucket = Math.floor(t / 2.5);
  const saccade = ((Math.sin(bucket * 127.1 + 311.7) * 43758.5453) % 1) * 0.015;

  const rawX = yaw * 0.4 + driftX + saccade;
  const rawY = pitch * 0.4 + driftY;

  const eyeLX = Math.max(-0.15, Math.min(0.15, rawX));
  const eyeLY = Math.max(-0.1, Math.min(0.1, rawY));

  return { eyeLX, eyeLY, eyeRX: eyeLX, eyeRY: eyeLY };
}

/**
 * Returns a ref (not state) — safe to read inside useFrame without re-renders.
 * Updated every frame by the hook's own useFrame subscription.
 */
export function useAvatarGaze(
  controlsRef: React.RefObject<{ pitch: number; yaw: number }>,
): React.RefObject<GazeOutput> {
  const gazeRef = useRef<GazeOutput>({ eyeLX: 0, eyeLY: 0, eyeRX: 0, eyeRY: 0 });

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const { pitch, yaw } = controlsRef.current ?? { pitch: 0, yaw: 0 };
    gazeRef.current = computeGaze(t, pitch, yaw);
  });

  return gazeRef;
}
