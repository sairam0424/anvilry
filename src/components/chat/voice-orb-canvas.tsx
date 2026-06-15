"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import type { VoiceSessionState } from "@/components/chat/use-voice-session";

/**
 * The universal voice orb — a 2D-canvas blob that pulses/glows from the smoothed
 * `level` ref (0..1). Ships on EVERY browser (no WebGL gate, no new CSP surface, cheap
 * on mobile). The R3F "Siri orb" is a desktop enhancement layered separately; this is
 * the always-available baseline + the reduced-motion fallback.
 *
 * Decorative: aria-hidden (the spoken caption + status live region carry the meaning).
 * Under prefers-reduced-motion it renders a calm static ring (no animation loop).
 * Reads `level` via a rAF loop directly from the ref — never through React state — so
 * 60fps amplitude never re-renders the tree.
 */

const ACCENT = "#38e1ff"; // matches the site accent (globals.css --accent)

export function VoiceOrbCanvas({
  level,
  state,
  size = 160,
}: {
  level: React.RefObject<number>;
  state: VoiceSessionState;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();
  const stateRef = useRef(state);
  // Keep the latest state in a ref for the long-lived rAF loop without restarting it,
  // updated in an effect (never during render — react-hooks/refs).
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const cx = size / 2;
    const cy = size / 2;
    const baseR = size * 0.26;

    // Reduced motion: draw one calm ring and stop — no loop.
    if (reduced) {
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }

    let raf = 0;
    let t = 0;
    let last = 0;

    const draw = (now: number) => {
      if (last === 0) last = now;
      t += Math.min(0.05, (now - last) / 1000);
      last = now;
      const lvl = level.current ?? 0;
      const active = stateRef.current !== "idle" && stateRef.current !== "paused";

      ctx.clearRect(0, 0, size, size);

      // Outer glow halo — scales with level.
      const haloR = baseR * (1.15 + lvl * 0.6);
      const glow = ctx.createRadialGradient(cx, cy, baseR * 0.4, cx, cy, haloR);
      glow.addColorStop(0, `rgba(56,225,255,${0.10 + lvl * 0.22})`);
      glow.addColorStop(1, "rgba(56,225,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // The blob: a circle whose radius wobbles with a few harmonics * level, so it
      // deforms organically while speaking and breathes gently while listening.
      const lobes = 5;
      const wobble = (active ? 0.06 + lvl * 0.18 : 0.02) * baseR;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.08) {
        const r =
          baseR * (1 + lvl * 0.12) +
          wobble * Math.sin(lobes * a + t * 2.4) +
          wobble * 0.5 * Math.sin(3 * a - t * 1.7);
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const fill = ctx.createRadialGradient(cx, cy, 2, cx, cy, baseR * 1.4);
      fill.addColorStop(0, `rgba(56,225,255,${0.20 + lvl * 0.25})`);
      fill.addColorStop(1, "rgba(56,225,255,0.04)");
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = 0.55 + lvl * 0.4;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [reduced, size, level]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="block"
    />
  );
}
