"use client";

/**
 * SVG RPG Skill Tree — beast-mode, 2-row layout.
 *
 * Layout fix summary (v2):
 *   - 2 ROWS × 3 COLUMNS replaces the single 6-column row that overflowed at
 *     ~1100px (wider than the max-w-5xl 976px container). Each row fits ~540px,
 *     both rows centred within SVG_W=976 with no horizontal scroll.
 *   - TRUNK_GAP raised from 40→60 for 41px clearance between hex bottom and
 *     first pill top (was 18px, causing visual overlap).
 *   - connectionPath rewritten with diagonal control points (0.25 factor) so
 *     the bezier arrives at the staggered pill top from directly above — not
 *     cutting through the pill body.
 *   - SVG uses width="100%" + maxWidth cap instead of a fixed pixel width,
 *     so it scales to the container naturally.
 *
 * Row 1: Languages | GenAI | Backend & Distributed
 * Row 2: Data & Messaging | Cloud & Ops | Frontend
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
const FONT_SIZE    = 10;
const MONO_CW      = 6.2;   // estimated mono char width at 10px
const PILL_PADDING = 16;    // horizontal padding inside pill (each side)
const PILL_H       = 28;    // pill height px
const MIN_PILL_W   = 72;
const CAT_W        = 60;    // hexagon bounding width
const CAT_H        = 38;    // hexagon bounding height
const ROW_GAP      = 16;    // vertical gap between skill rows
const TRUNK_GAP    = 60;    // hex_centre_y + TRUNK_GAP + PILL_H/2 = first pill centre
const STAGGER_X    = 12;    // ±px alternating pill offset
const COL_PAD      = 12;    // horizontal padding each side of column
const GAP_BETWEEN  = 14;    // gap between columns in same row
const ROW_VERT_GAP = 48;    // gap between last pill of row 1 and top of row 2 hexes

const SVG_W        = 976;   // max-w-5xl (1024) minus 2×24px section padding

// Row 1 starts at top
const CAT_Y_ROW1   = 20;

// Row 2 Y is computed after row 1 geometry is known (see buildColumns).

// Groups assigned to each row (preserves profile.ts insertion order within each row).
const ROW1_GROUPS = ["Languages", "GenAI", "Backend & Distributed"];
const ROW2_GROUPS = ["Data & Messaging", "Cloud & Ops", "Frontend"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pillWidth(label: string): number {
  const measured = label.length * MONO_CW + PILL_PADDING * 2;
  return Math.max(MIN_PILL_W, Math.round(measured));
}

function hexPath(cx: number, cy: number, w: number, h: number): string {
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

/**
 * Cubic bezier with DIAGONAL control points so the curve transitions both
 * horizontally and vertically simultaneously — no more line-through-pill-body
 * artefact when the pill is staggered left/right of the column centre.
 *
 * The 0.25 factor distributes 50% of the horizontal shift into each control
 * point, spreading it across 75% of the vertical distance rather than cramming
 * it into the final stretch.
 */
function connectionPath(x0: number, y0: number, x1: number, y1: number): string {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const cp1x = x0 + dx * 0.25;
  const cp1y = y0 + dy * 0.40;
  const cp2x = x1 - dx * 0.25;
  const cp2y = y1 - dy * 0.40;
  return (
    `M ${x0.toFixed(1)} ${y0.toFixed(1)} ` +
    `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ` +
    `${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ` +
    `${x1.toFixed(1)} ${y1.toFixed(1)}`
  );
}

// ─── Stable per-node animation offsets ───────────────────────────────────────
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function stableRandom(seed: number, min: number, max: number): number {
  const t = ((seed * 1664525 + 1013904223) >>> 0) / 0xffffffff;
  return min + t * (max - min);
}

// Abbreviated category label for the hexagon (keeps text inside the hex).
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

// ─── Column geometry ──────────────────────────────────────────────────────────
interface SkillNode {
  label: string;
  x: number;
  y: number;
  w: number;
}

interface Column {
  group: string;
  color: string;
  catX: number;
  catY: number;
  nodes: SkillNode[];
  colW: number;
  height: number;
}

function buildRowColumns(
  groupNames: string[],
  catYTop: number,
): { columns: Column[]; rowBottom: number; totalW: number } {
  // Pass 1: compute per-column widths (relative coords).
  const rawCols = groupNames.map((groupName) => {
    const cat = skills.find((s) => s.group === groupName)!;
    const color = GROUP_COLORS[cat.group] ?? DEFAULT_COLOR;
    const catCY = catYTop + CAT_H / 2;

    const nodes: SkillNode[] = cat.items.map((label, i) => {
      const w = pillWidth(label);
      const staggered = i % 2 === 0 ? STAGGER_X : -STAGGER_X;
      const y = catCY + TRUNK_GAP + PILL_H / 2 + i * (PILL_H + ROW_GAP);
      return { label, x: staggered, y, w };
    });

    const maxPillRight = nodes.length > 0
      ? Math.max(...nodes.map((n) => Math.abs(n.x) + n.w / 2))
      : CAT_W / 2;
    const colW = Math.max(CAT_W, maxPillRight * 2) + COL_PAD * 2;

    const height = nodes.length > 0
      ? nodes[nodes.length - 1].y + PILL_H / 2
      : catYTop + CAT_H;

    return { group: cat.group, color, catCY, nodes, colW, height };
  });

  // Total row width (to center in SVG_W).
  const totalW = rawCols.reduce((sum, c) => sum + c.colW, 0) + GAP_BETWEEN * (rawCols.length - 1);
  const startX = Math.floor((SVG_W - totalW) / 2);

  // Pass 2: assign absolute X positions.
  let cursor = startX;
  const columns: Column[] = rawCols.map((col) => {
    const catX = cursor + col.colW / 2;
    cursor += col.colW + GAP_BETWEEN;
    return {
      group: col.group,
      color: col.color,
      catX,
      catY: col.catCY,
      nodes: col.nodes.map((n) => ({ ...n, x: catX + n.x })),
      colW: col.colW,
      height: col.height,
    };
  });

  const rowBottom = Math.max(...columns.map((c) => c.height));
  return { columns, rowBottom, totalW };
}

function buildColumns(): { columns: Column[]; svgWidth: number; svgHeight: number } {
  const { columns: row1, rowBottom: row1Bottom } =
    buildRowColumns(ROW1_GROUPS, CAT_Y_ROW1);

  const catYRow2 = row1Bottom + ROW_VERT_GAP;
  const { columns: row2, rowBottom: row2Bottom } =
    buildRowColumns(ROW2_GROUPS, catYRow2);

  const svgHeight = row2Bottom + 32;
  return {
    columns: [...row1, ...row2],
    svgWidth: SVG_W,
    svgHeight,
  };
}

// ─── SVG Filters ──────────────────────────────────────────────────────────────
function colorToMatrix(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return `0 0 0 0 ${r.toFixed(3)}  0 0 0 0 ${g.toFixed(3)}  0 0 0 0 ${b.toFixed(3)}  0 0 0 1 0`;
}

function Filters({ columns }: { columns: Column[] }) {
  return (
    <defs>
      {columns.map((col) => {
        const id = col.group.replace(/[^a-z0-9]/gi, "-");
        return (
          <filter
            key={`glow-${col.group}`}
            id={`glow-${id}`}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix in="blur" type="matrix" values={colorToMatrix(col.color)} result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        );
      })}
      {columns.map((col) => {
        const id = col.group.replace(/[^a-z0-9]/gi, "-");
        return (
          <filter
            key={`hex-glow-${col.group}`}
            id={`hex-glow-${id}`}
            x="-80%"
            y="-80%"
            width="260%"
            height="260%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
            <feColorMatrix in="blur" type="matrix" values={colorToMatrix(col.color)} result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        );
      })}
    </defs>
  );
}

// ─── Skill pill sub-component ─────────────────────────────────────────────────
function SkillPill({
  x, y, w, label, color, active, filterId, reducedMotion,
}: {
  x: number; y: number; w: number; label: string; color: string;
  active: boolean; filterId: string; reducedMotion: boolean | null;
}) {
  const [hovered, setHovered] = useState(false);
  const rx = PILL_H / 2;

  return (
    <g
      style={{
        opacity: active ? 1 : 0.15,
        transition: reducedMotion ? undefined : "opacity 0.3s ease",
        filter: hovered && !reducedMotion ? `url(#${filterId})` : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-hidden="true"
    >
      {/* Halo ring */}
      {hovered && !reducedMotion && (
        <rect
          x={x - w / 2 - 3}
          y={y - PILL_H / 2 - 3}
          width={w + 6}
          height={PILL_H + 6}
          rx={rx + 3}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.3}
        />
      )}
      {/* Pill body */}
      <rect
        x={x - w / 2}
        y={y - PILL_H / 2}
        width={w}
        height={PILL_H}
        rx={rx}
        fill={color}
        fillOpacity={hovered ? 0.22 : 0.08}
        stroke={color}
        strokeWidth={1.2}
        strokeOpacity={hovered ? 1 : 0.55}
        style={{ transition: reducedMotion ? undefined : "fill-opacity 0.15s, stroke-opacity 0.15s" }}
      />
      {/* Label */}
      <text
        x={x}
        y={y}
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={FONT_SIZE}
        fontWeight={500}
        letterSpacing="0.04em"
        fill={color}
        style={{
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          pointerEvents: "none",
        }}
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
    <div className="w-full" role="region" aria-label="Skill tree">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        style={{ maxWidth: svgWidth, display: "block" }}
        role="img"
        aria-label="Interactive skill tree — click a category to highlight its skills"
      >
        <Filters columns={columns} />

        {/* LAYER 1 — Connection paths */}
        {columns.map((col) => {
          const isActiveGroup = active === null || active === col.group;
          const filterId = `glow-${col.group.replace(/[^a-z0-9]/gi, "-")}`;
          const srcY = col.catY + CAT_H / 2;

          return col.nodes.map((node) => {
            const d = connectionPath(col.catX, srcY, node.x, node.y - PILL_H / 2);
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
                {/* Animated energy-flow dashes */}
                {!reducedMotion && isActiveGroup && (
                  <path
                    d={d}
                    stroke={col.color}
                    strokeWidth={1.5}
                    strokeOpacity={0.9}
                    fill="none"
                    strokeDasharray="6 10"
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

        {/* LAYER 2 — Skill pill nodes */}
        {columns.map((col) => {
          const isActiveGroup = active === null || active === col.group;
          const filterId = `glow-${col.group.replace(/[^a-z0-9]/gi, "-")}`;
          return col.nodes.map((node) => (
            <SkillPill
              key={`pill-${col.group}-${node.label}`}
              x={node.x}
              y={node.y}
              w={node.w}
              label={node.label}
              color={col.color}
              active={isActiveGroup}
              filterId={filterId}
              reducedMotion={reducedMotion}
            />
          ));
        })}

        {/* LAYER 3 — Category hexagons (rendered last, sit on top) */}
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
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(col.group); }
              }}
              style={{
                cursor: "pointer",
                opacity: isRelated ? 1 : 0.25,
                transition: reducedMotion ? undefined : "opacity 0.25s ease",
                filter: isActive && !reducedMotion ? `url(#${hexGlowId})` : undefined,
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
              {/* Hex fill */}
              <path
                d={hexPath(col.catX, col.catY, CAT_W, CAT_H)}
                fill={col.color}
                fillOpacity={isActive ? 0.22 : 0.08}
                stroke={col.color}
                strokeWidth={isActive ? 2 : 1.2}
                strokeOpacity={isActive ? 1 : 0.6}
                style={{ transition: reducedMotion ? undefined : "fill-opacity 0.2s, stroke-width 0.2s" }}
              />
              {/* Circuit-board tick marks at each vertex */}
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
                    x1={bx.toFixed(1)} y1={by.toFixed(1)}
                    x2={tx.toFixed(1)} y2={ty.toFixed(1)}
                    stroke={col.color}
                    strokeWidth={1}
                    strokeOpacity={isActive ? 0.8 : 0.4}
                  />
                );
              })}
              {/* Abbrev label */}
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
              {/* Item count */}
              <text
                x={col.catX}
                y={col.catY + 8}
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize={8}
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

        {/* Row separator — subtle horizontal line between the two rows */}
        {(() => {
          const row1Bottom = Math.max(
            ...columns.filter((c) => ROW1_GROUPS.includes(c.group)).map((c) => c.height)
          );
          const row2Top = Math.min(
            ...columns.filter((c) => ROW2_GROUPS.includes(c.group)).map((c) => c.catY - CAT_H / 2)
          );
          const midY = (row1Bottom + row2Top) / 2;
          return (
            <line
              x1={SVG_W * 0.1}
              y1={midY}
              x2={SVG_W * 0.9}
              y2={midY}
              stroke="#ffffff"
              strokeOpacity={0.04}
              strokeWidth={1}
              strokeDasharray="4 8"
            />
          );
        })()}

        {/* Inline keyframes */}
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

      {/* Active group label strip */}
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
