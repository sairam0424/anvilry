"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DIRECTIONS,
  REACTIONS,
  aimSector,
  cellPosition,
  sectorDirection,
  type Direction,
  type Reaction,
} from "@/lib/mascot-geometry";

/**
 * Mascot — a character head that turns toward the pointer and reacts when clicked.
 *
 * Vendored from page-mascot 0.1.0 (https://github.com/nilbuild/page-mascot), MIT © 2026
 * Kamran Ahmed — see THIRD_PARTY_NOTICES.md. Local changes: the sector math lives in
 * src/lib/mascot-geometry.ts, `element.animate` is feature-detected, timers use the global
 * functions (fake-timer friendly), and sheet URLs come from src/lib/mascots.ts via SiteMascot.
 *
 * Two 3×3 sheets, swapped by moving `background-position`: no per-frame JS, no animation
 * library. Tracking attaches only on fine-pointer devices; a tap still plays a reaction. The
 * squash is one Web Animations API run, skipped under prefers-reduced-motion (a sheet swap is
 * not motion). Inline styles keep the component independent of the CSS pipeline; position it
 * with a wrapper element, not `className`, because the button's `position: relative` is inline.
 */

const PAYOFFS: Reaction[] = ["heart", "sparkle", "delighted"];
const BOOP_PAYOFF = 120;
const BOOP_END = 560;
const SQUASH_MS = 420;
const DIZZY_AFTER = 4;
const DIZZY_WINDOW = 1600;
const DIZZY_END = 1100;

const SQUASH: Keyframe[] = [
  { transform: "scale(1, 1)", easing: "ease-in" },
  { transform: "scale(1.10, 0.86)", offset: 0.18, easing: "ease-out" },
  { transform: "scale(0.95, 1.08)", offset: 0.45, easing: "ease-in-out" },
  { transform: "scale(1.03, 0.97)", offset: 0.72, easing: "ease-in-out" },
  { transform: "scale(1, 1)" },
];

const layer: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundSize: "300% 300%",
  backgroundRepeat: "no-repeat",
};

export type MascotProps = {
  /** Served URL of the 3×3 sheet of head directions. */
  directions: string;
  /** Served URL of the 3×3 sheet of expressions. */
  reactions: string;
  /** Pixel number or any CSS length; a wrapper can set `var(--mascot-size)` per breakpoint. */
  size?: number | string;
  className?: string;
  /** What a screen reader calls it: the button is named "Boop the {label}". */
  label?: string;
};

export function Mascot({ directions, reactions, size = 140, className, label = "mascot" }: MascotProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const squashRef = useRef<HTMLSpanElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const boopsRef = useRef({ count: 0, at: 0 });
  const [direction, setDirection] = useState<Direction>("center");
  const [reaction, setReaction] = useState<Reaction | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let sector = -1;
    let pointer: { x: number; y: number } | null = null;

    const aim = () => {
      const button = buttonRef.current;
      if (!button || !pointer) return;
      const box = button.getBoundingClientRect();
      const next = aimSector(
        pointer.x - (box.left + box.width / 2),
        pointer.y - (box.top + box.height / 2),
        sector,
      );
      if (next === sector) return;
      sector = next;
      setDirection(sectorDirection(sector));
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      aim();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", aim, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", aim);
    };
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const boop = () => {
    // Empty in place: the unmount cleanup captured this array once, so it must keep its identity.
    timersRef.current.splice(0).forEach(clearTimeout);
    const later = (ms: number, next: Reaction | null) => {
      timersRef.current.push(setTimeout(() => setReaction(next), ms));
    };

    const now = Date.now();
    const boops = boopsRef.current;
    boops.count = now - boops.at < DIZZY_WINDOW ? boops.count + 1 : 1;
    boops.at = now;

    if (boops.count >= DIZZY_AFTER) {
      boops.count = 0;
      setReaction("dizzy");
      later(DIZZY_END, null);
    } else {
      setReaction("blink");
      later(BOOP_PAYOFF, PAYOFFS[(boops.count - 1) % PAYOFFS.length]);
      later(BOOP_END, null);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = squashRef.current;
    if (!el || typeof el.animate !== "function") return;
    // Per-keyframe easing with the effect itself linear: an easing on the effect would
    // reinterpret every offset and front-load the whole bounce.
    el.animate(SQUASH, { duration: SQUASH_MS, easing: "linear" });
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={boop}
      aria-label={`Boop the ${label}`}
      className={className}
      style={{
        position: "relative",
        display: "block",
        flexShrink: 0,
        width: size,
        height: size,
        padding: 0,
        border: 0,
        background: "transparent",
        appearance: "none",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <span
        ref={squashRef}
        style={{ position: "relative", display: "block", width: "100%", height: "100%", transformOrigin: "50% 78%" }}
      >
        <span
          style={{
            ...layer,
            backgroundImage: `url(${directions})`,
            backgroundPosition: cellPosition(DIRECTIONS.indexOf(direction)),
            opacity: reaction ? 0 : 1,
          }}
        />
        {/* Always mounted so the sheet is fetched up front, never on the first click. */}
        <span
          style={{
            ...layer,
            backgroundImage: `url(${reactions})`,
            backgroundPosition: cellPosition(REACTIONS.indexOf(reaction ?? "blink")),
            opacity: reaction ? 1 : 0,
          }}
        />
      </span>
    </button>
  );
}
