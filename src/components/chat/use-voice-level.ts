"use client";

import { useEffect, useRef } from "react";
import type { VoiceSessionState } from "@/components/chat/use-voice-session";

/**
 * Drives a single smoothed 0..1 amplitude `level` for the voice orb — a REF, not React
 * state, so the rAF render loop in the orb reads it every frame without re-rendering
 * the React tree (60fps state updates would thrash).
 *
 * WHY SYNTHETIC (not a real audio analyser): browser speechSynthesis exposes no
 * MediaStream/AudioNode in any shipping browser, so the SPEAKING orb cannot react to
 * real TTS amplitude (verified). And opening a second getUserMedia analyser during
 * LISTENING would duplicate/conflict with the mic the STT hook already holds. So we
 * synthesize a lifelike envelope per state — universal, zero-permission, zero-teardown,
 * and visually convincing since the speaking half is synthetic on every browser anyway.
 * (A future enhancement could tap the mic for true listening-reactivity, or the Polly
 * <audio> for true speaking-reactivity on non-WebKit — both are additive.)
 *
 * Envelope per state (all eased toward via a smoothing factor so it never snaps):
 *  - listening: a gentle breathing base + a faster shimmer (the orb feels "open").
 *  - thinking : a slow low pulse (calm, working).
 *  - speaking : a livelier syllabic flutter layered on a breath — reads as "talking".
 *  - idle/paused: settles to ~0.
 *
 * Time is advanced from rAF deltas (no Date.now()/performance.now() dependency in the
 * value itself); the loop self-stops when nothing is animating to spare battery.
 */

const SMOOTH = 0.18; // ease factor toward the target each frame (higher = snappier)

function targetFor(state: VoiceSessionState, t: number): number {
  // t is elapsed seconds; combine sinusoids for an organic, non-repetitive feel.
  switch (state) {
    case "listening": {
      // Lower, serene floor so the contrast with speaking reads clearly in the orb.
      const breath = 0.26 + 0.12 * Math.sin(t * 1.6);
      const shimmer = 0.1 * Math.sin(t * 7.3 + 1.1);
      return Math.max(0, breath + shimmer);
    }
    case "thinking":
      return 0.18 + 0.08 * Math.sin(t * 2.2);
    case "speaking": {
      // Punchier syllabic transient so the HDR heat/halo/scale coupling visibly blooms.
      const breath = 0.45 + 0.14 * Math.sin(t * 2.1);
      const syllable = 0.34 * Math.abs(Math.sin(t * 9.5)) + 0.14 * Math.sin(t * 14.2 + 0.7);
      return Math.min(1, Math.max(0.18, breath + syllable));
    }
    default:
      return 0; // idle / paused
  }
}

/** Returns a ref holding the current smoothed level (0..1); read it in a draw loop. */
export function useVoiceLevel(state: VoiceSessionState): React.RefObject<number> {
  const levelRef = useRef(0);
  const stateRef = useRef(state);
  // Latest state for the rAF loop, set in an effect (not during render — react-hooks/refs).
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    let running = true;

    const tick = (now: number) => {
      if (!running) return;
      if (last === 0) last = now;
      const dt = Math.min(0.05, (now - last) / 1000); // clamp to avoid jumps on tab refocus
      last = now;
      elapsed += dt;

      const target = targetFor(stateRef.current, elapsed);
      levelRef.current += (target - levelRef.current) * SMOOTH;

      // Self-stop when fully settled at rest (idle/paused and level ~0) to save battery;
      // any state change re-mounts this effect and restarts the loop.
      const atRest =
        (stateRef.current === "idle" || stateRef.current === "paused") &&
        levelRef.current < 0.01;
      if (atRest) {
        levelRef.current = 0;
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [state]);

  return levelRef;
}
