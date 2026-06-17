"use client";

/**
 * SVG RPG Skill Tree — beast-mode redesign.
 *
 * Layout:
 *   - Six category "boss" hexagons in a top row, evenly spaced.
 *   - Each category fans its skills downward in a COLUMN whose width is determined
 *     by the longest label — nodes are pill-shaped (rounded-rect), not circles.
 *   - Skills in each column are staggered left/right around the column centre
 *     (alternating ±STAGGER_X) so the tree has visual "branches" rather than a
 *     single vertical pipe.
 *   - Connections are cubic bezier S-curves: control points push outward to give
 *     the branching feel; a second faint glow copy runs underneath.
 *   - Animated dashed dash-stroke on connections (skipped under reduced-motion).
 *   - Per-category SVG filter: feGaussianBlur + feColorMatrix glow.
 *   - Click category to focus: active columns fully lit, inactive dimmed to 15%.
 *   - Hover on any node: solid fill + halo glow.
 *   - Full keyboard support; WCAG AA focus rings.
 *
 * Zero new npm deps — pure React 19 + SVG + CSS.
 * Respects prefers-reduced-motion throughout.
 */

import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { skills } from "@/lib/profile";

// ─── Color palette ────────────────────────────────────────────────────────────
const GROUP_COLORS: Record<string, string> = {
  Languages:               "#38e1ff",
  GenAI:                   "#a78bfa",
  "Backend & Distributed": "#4ade80",
  "Data & Messaging":      "#fbbf24",
  "Cloud & Ops":           "#f87171",
  Frontend:                "#38bdf8",
};
const DEFAULT_COLOR = "#94a3b8";

// ─── Layout constants ─────────────────────────────────────────────────────────
// Each skill pill: the text is measured virtually via a fixed char-width estimate.
const PILL_H        = 30;   // pill height px
const PILL_PADDING  = 22;   // horizontal padding inside pill (each side)
const MONO_CW       = 7.6;  // estimated width of one monospace character at 11px
const MIN_PILL_W    = 80;
const CAT_W         = 68;   // category hexagon bounding width
const CAT_H         = 44;   // category hexagon bounding height
const CAT_Y         = 30;   // top of category row
const ROW_GAP       = 20;   // vertical gap between skill rows
const TRUNK_GAP     = 40;   // vertical gap from category bottom to first skill centre
const STAGGER_X     = 18;   // left/right alternating offset (gives branch feel)
const COL_PAD       = 24;   // extra horizontal padding around each column

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pillWidth(label: string): number {
  const measured = label.length * MONO_CW + PILL_PADDING * 2;
  return Math.max(MIN_PILL_W, Math.round(measured));
}

function hexPath(cx: number, cy: number, w: number, h: number): string {
  // Flat-top hexagon fitted into a w×h bounding box.
  const rx = w / 2;
  const ry = h / 2;
  const pts: [number, number][] = [
    [cx,      cy - ry],
    [cx + rx, cy - ry * 0.5],
    [cx + rx, cy + ry * 0.5],
    [cx,      cy + ry],
    [cx - rx, cy + ry * 0.5],
    [cx - rx, cy - ry * 0.5],
  ];
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z";
}

// ─── Stable per-node animation offsets ───────────────────────────────────────
// Pre-computed once so React re-renders don't re-randomise the durations and
// cause layout thrashing or visible animation resets.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function stableRandom(seed: number, min: number, max: number): number {
  const t = ((seed * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  return min + t * (max - min);
}

// ─── Column geometry ─────────────────────────────────────────────────────────
interface SkillNode {
  label: string;
  x: number;       // centre x of the pill, relative to column centre
  y: number;       // centre y of the pill, in absolute SVG coords
  w: number;       // pill width
}

interface Column {
  group: string;
  color: string;
  catX: number;    // centre x of category hexagon
  catY: number;    // centre y of category hexagon
  nodes: SkillNode[];
  colW: number;    // total column bounding width (for layout)
  height: number;  // total column height (for SVG height calc)
}

function buildColumns(): { columns: Column[]; svgWidth: number; svgHeight: number } {
  // First pass: compute per-column node geometries (relative x within column).
  const rawCols = skills.map((cat) => {
    const color = GROUP_COLORS[cat.group] ?? DEFAULT_COLOR;

    const nodes: SkillNode[] = cat.items.map((label, i) => {
      const w = pillWidth(label);
      // Stagger: even index → shift right, odd → shift left.
      const staggered = i % 2 === 0 ? STAGGER_X : -STAGGER_X;
      const y = CAT_Y + CAT_H / 2 + TRUNK_GAP + PILL_H / 2 + i * (PILL_H + ROW_GAP);
      return { label, x: staggered, y, w };
    });

    // Column width = max(pill_right_edge, cat_w, plus padding).
    const maxPillRight = Math.max(...nodes.map((n) => Math.abs(n.x) + n.w / 2));
    const colW = Math.max(CAT_W, maxPillRight * 2) + COL_PAD * 2;

    const height =
      nodes.length > 0
        ? nodes[nodes.length - 1].y + PILL_H / 2
        : CAT_Y + CAT_H;

    return { group: cat.group, color, nodes, colW, height };
  });

  // Second pass: assign absolute X positions to column centres.
  const GAP_BETWEEN_COLS = 20;
  let cursor = 0;
  const columns: Column[] = rawCols.map((col) => {
    const catX = cursor + col.colW / 2;
    cursor += col.colW + GAP_BETWEEN_COLS;
    return {
      ...col,
      catX,
      catY: CAT_Y + CAT_H / 2,
      nodes: col.nodes.map((n) => ({ ...n, x: catX + n.x })),
    };
  });

  const svgWidth = cursor - GAP_BETWEEN_COLS;
  const svgHeight = Math.max(...columns.map((c) => c.height)) + 32;

  return { columns, svgWidth, svgHeight };
}

// ─── SVG Filters ─────────────────────────────────────────────────────────────
function Filters({ columns }: { columns: Column[] }) {
  return (
    <defs>
      {/* Per-category glow filter */}
      {columns.map((col) => (
        <filter
          key={`glow-${col.group}`}
          id={`glow-${col.group.replace(/[^a-z0-9]/gi, "-")}`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values={colorToMatrix(col.color)}
            result="coloredBlur"
          />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      ))}

      {/* Soft inner-glow for active category hexagons */}
      {columns.map((col) => (
        <filter
          key={`hex-glow-${col.group}`}
          id={`hex-glow-${col.group.replace(/[^a-z0-9]/gi, "-")}`}
          x="-80%"
          y="-80%"
          width="260%"
          height="260%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values={colorToMatrix(col.color)}
            result="coloredBlur"
          />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      ))}

      {/* Animated dash-flow gradient — re-used by all connection paths */}
      <linearGradient id="dash-flow" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0" />
        <stop offset="40%" stopColor="white" stopOpacity="0.6" />
        <stop offset="60%" stopColor="white" stopOpacity="0.6" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

/** Convert a #rrggbb hex to an feColorMatrix saturate-tint row string. */
function colorToMatrix(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // Tint: multiply the blurred alpha channel into the target colour.
  return [
    `${r.toFixed(3)} 0 0 0 ${(r * 0.4).toFixed(3)}`,
    `0 ${g.toFixed(3)} 0 0 ${(g * 0.4).toFixed(3)}`,
    `0 0 ${b.toFixed(3)} 0 ${(b * 0.4).toFixed(3)}`,
    "0 0 0 1 0",
  ].join("  ");
}

// ─── Connection path ─────────────────────────────────────────────────────────
/**
 * Cubic bezier from (x0,y0) to (x1,y1).
 * Control points: cp1 hangs straight down from the source at 40% of the
 * vertical distance; cp2 hangs straight up from the target at 40%.
 * This gives a clean S-trunk-branch shape.
 */
function connectionPath(x0: number, y0: number, x1: number, y1: number): string {
  const dy = y1 - y0;
  const cpY = dy * 0.45;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} C ${x0.toFixed(1)} ${(y0 + cpY).toFixed(1)}, ${x1.toFixed(1)} ${(y1 - cpY).toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

// ─── Pill (rounded-rect skill node) ──────────────────────────────────────────
interface PillProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
  active: boolean;
  filterId: string;
  reducedMotion: boolean | null;
}

function SkillPill({ x, y, w, h, label, color, active, filterId, reducedMotion }: PillProps) {
  const [hovered, setHovered] = useState(false);
  const rx = h / 2;
  const lit = active && hovered;

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity: active ? 1 : 0.15,
        transition: reducedMotion ? undefined : "opacity 0.25s ease",
        filter: lit && !reducedMotion ? `url(#${filterId})` : undefined,
      }}
      aria-label={label}
    >
      {/* Halo when hovered */}
      {lit && !reducedMotion && (
        <rect
          x={x - w / 2 - 4}
          y={y - h / 2 - 4}
          width={w + 8}
          height={h + 8}
          rx={rx + 4}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.35}
        />
      )}

      {/* Pill body */}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={rx}
        fill={color}
        fillOpacity={lit ? 0.22 : 0.08}
        stroke={color}
        strokeWidth={lit ? 1.5 : 1}
        strokeOpacity={lit ? 1 : 0.6}
        style={{ transition: reducedMotion ? undefined : "fill-opacity 0.15s, stroke-width 0.15s" }}
      />

      {/* Label */}
      <text
        x={x}
        y={y}
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={11}
        fontWeight={500}
        letterSpacing="0.02em"
        fill={color}
        fillOpacity={active ? 1 : 0.7}
        style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", pointerEvents: "none" }}
      >
        {label}
      </text>
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function SkillTree() {
  const [active, setActive] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  const { columns, svgWidth, svgHeight } = buildColumns();

  const toggle = (group: string) =>
    setActive((prev) => (prev === group ? null : group));

  return (
    <div className="overflow-x-auto" role="region" aria-label="Skill tree">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width={svgWidth}
        style={{ minWidth: svgWidth, display: "block" }}
        role="img"
        aria-label="Interactive skill tree — click a category to highlight its skills"
      >
        <Filters columns={columns} />

        {/*
         * LAYER 1 — Connection paths (rendered first / below everything else).
         * Each path: a faint glow copy (wider, low opacity) + the main stroke.
         * Under full motion: a dashed overlay with strokeDashoffset animation
         * simulates energy flowing down from the category node into the skill.
         */}
        {columns.map((col) => {
          const isActiveGroup = active === null || active === col.group;
          const filterId = `glow-${col.group.replace(/[^a-z0-9]/gi, "-")}`;
          const srcY = col.catY + CAT_H / 2;

          return col.nodes.map((node) => {
            const d = connectionPath(col.catX, srcY, node.x, node.y - PILL_H / 2);
            const dashLen = 6;
            const gapLen = 10;
            // Deterministic per-connection timing — stable across re-renders.
            const seed = hashStr(`${col.group}:${node.label}`);
            const dur = stableRandom(seed, 1.4, 2.2).toFixed(2);
            const delay = stableRandom(seed ^ 0x5f3759df, 0, 1.2).toFixed(2);

            return (
              <g
                key={`conn-${col.group}-${node.label}`}
                style={{
                  opacity: isActiveGroup ? 1 : 0.08,
                  transition: reducedMotion ? undefined : "opacity 0.3s ease",
                }}
              >
                {/* Glow underlay */}
                <path
                  d={d}
                  stroke={col.color}
                  strokeWidth={6}
                  strokeOpacity={0.12}
                  fill="none"
                  filter={isActiveGroup && !reducedMotion ? `url(#${filterId})` : undefined}
                />

                {/* Main line */}
                <path
                  d={d}
                  stroke={col.color}
                  strokeWidth={1.5}
                  strokeOpacity={0.55}
                  fill="none"
                />

                {/* Animated energy-flow dashes (motion only) */}
                {!reducedMotion && isActiveGroup && (
                  <path
                    d={d}
                    stroke={col.color}
                    strokeWidth={1.5}
                    strokeOpacity={0.9}
                    fill="none"
                    strokeDasharray={`${dashLen} ${gapLen}`}
                    style={{
                      animation: `skillDash ${dur}s linear infinite`,
                      animationDelay: `${delay}s`,
                    }}
                  />
                )}
              </g>
            );
          });
        })}

        {/*
         * LAYER 2 — Skill pill nodes.
         */}
        {columns.map((col) => {
          const isActiveGroup = active === null || active === col.group;
          const filterId = `glow-${col.group.replace(/[^a-z0-9]/gi, "-")}`;

          return col.nodes.map((node) => (
            <SkillPill
              key={`pill-${col.group}-${node.label}`}
              x={node.x}
              y={node.y}
              w={node.w}
              h={PILL_H}
              label={node.label}
              color={col.color}
              active={isActiveGroup}
              filterId={filterId}
              reducedMotion={reducedMotion}
            />
          ));
        })}

        {/*
         * LAYER 3 — Category hexagons (topmost so they sit over connection trunks).
         */}
        {columns.map((col) => {
          const isActive = active === col.group;
          const isRelated = active === null || active === col.group;
          const hexGlowId = `hex-glow-${col.group.replace(/[^a-z0-9]/gi, "-")}`;

          return (
            <g
              key={`cat-${col.group}`}
              onClick={() => toggle(col.group)}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={`${col.group}: ${skills.find((s) => s.group === col.group)?.items.join(", ")}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(col.group);
                }
              }}
              style={{
                cursor: "pointer",
                opacity: isRelated ? 1 : 0.25,
                transition: reducedMotion ? undefined : "opacity 0.25s ease",
                filter:
                  isActive && !reducedMotion
                    ? `url(#${hexGlowId})`
                    : undefined,
              }}
            >
              {/* Outer glow ring (active state) */}
              {isActive && !reducedMotion && (
                <path
                  d={hexPath(col.catX, col.catY, CAT_W + 14, CAT_H + 12)}
                  fill="none"
                  stroke={col.color}
                  strokeWidth={1}
                  strokeOpacity={0.3}
                />
              )}

              {/* Hexagon fill */}
              <path
                d={hexPath(col.catX, col.catY, CAT_W, CAT_H)}
                fill={col.color}
                fillOpacity={isActive ? 0.22 : 0.08}
                stroke={col.color}
                strokeWidth={isActive ? 2 : 1.2}
                strokeOpacity={isActive ? 1 : 0.6}
                style={{
                  transition: reducedMotion
                    ? undefined
                    : "fill-opacity 0.2s ease, stroke-width 0.2s ease",
                }}
              />

              {/* Corner tick marks (give the hexagon a "circuit board" feel) */}
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const angle = (Math.PI / 3) * i - Math.PI / 6;
                const innerR = CAT_W / 2 - 6;
                const outerR = CAT_W / 2 + 2;
                const bx = col.catX + Math.cos(angle) * innerR;
                const by = col.catY + Math.sin(angle) * innerR * (CAT_H / CAT_W);
                const tx = col.catX + Math.cos(angle) * outerR;
                const ty = col.catY + Math.sin(angle) * outerR * (CAT_H / CAT_W);
                return (
                  <line
                    key={i}
                    x1={bx.toFixed(1)}
                    y1={by.toFixed(1)}
                    x2={tx.toFixed(1)}
                    y2={ty.toFixed(1)}
                    stroke={col.color}
                    strokeWidth={1}
                    strokeOpacity={isActive ? 0.8 : 0.4}
                  />
                );
              })}

              {/* Label — short group name (first word or abbreviation) */}
              <text
                x={col.catX}
                y={col.catY - 4}
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize={9}
                fontWeight={700}
                letterSpacing="0.06em"
                fill={col.color}
                style={{
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  pointerEvents: "none",
                  textTransform: "uppercase",
                }}
              >
                {catAbbrev(col.group)}
              </text>

              {/* Item count badge */}
              <text
                x={col.catX}
                y={col.catY + 8}
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize={8}
                fontWeight={400}
                fill={col.color}
                fillOpacity={0.6}
                style={{
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  pointerEvents: "none",
                }}
              >
                {`×${skills.find((s) => s.group === col.group)?.items.length ?? 0}`}
              </text>
            </g>
          );
        })}

        {/* Inline keyframes for dash animation — injected once into SVG */}
        <style>{`
          @keyframes skillDash {
            from { stroke-dashoffset: 0; }
            to   { stroke-dashoffset: -32; }
          }
          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; transition: none !important; }
          }
        `}</style>
      </svg>

      {/* Active-group label strip */}
      <p
        className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-fg-subtle"
        aria-live="polite"
        aria-atomic="true"
      >
        {active
          ? `${active} — ${skills.find((s) => s.group === active)?.items.join(" · ")}`
          : "click a category node to focus its skills"}
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Short display label for a category hexagon (fits in ~CAT_W pixels at 9px mono). */
function catAbbrev(group: string): string {
  const map: Record<string, string> = {
    Languages:               "LANG",
    GenAI:                   "GENAI",
    "Backend & Distributed": "BACK",
    "Data & Messaging":      "DATA",
    "Cloud & Ops":           "OPS",
    Frontend:                "FRONT",
  };
  return map[group] ?? group.slice(0, 5).toUpperCase();
}
