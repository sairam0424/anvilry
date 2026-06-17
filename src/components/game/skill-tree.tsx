"use client";

/**
 * SVG RPG Skill Tree — renders the skills from profile.ts as an interactive
 * radial tree with category nodes and bezier connections to skill children.
 *
 * Layout:
 *   - Category nodes arranged in a horizontal row
 *   - Skill nodes fan below each category
 *   - Quadratic bezier SVG paths connect category → skill nodes
 *   - Click a category to filter: show only its connections
 *   - Hover glow via CSS filter drop-shadow
 *
 * Respects prefers-reduced-motion: pulse/glow animations are skipped;
 * static layout still renders.
 *
 * Zero new npm deps — pure React + SVG + CSS.
 */

import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { skills } from "@/lib/profile";

// Color palette — mirrors kindColor from graph-data.ts for visual consistency.
const GROUP_COLORS: Record<string, string> = {
  Languages:              "#38e1ff", // accent cyan
  GenAI:                  "#a78bfa", // violet
  "Backend & Distributed": "#4ade80", // green
  "Data & Messaging":     "#fbbf24", // amber
  "Cloud & Ops":          "#f87171", // red
  Frontend:               "#38bdf8", // sky
};

const DEFAULT_COLOR = "#94a3b8";

// Layout constants
const SVG_WIDTH = 760;
const CAT_Y = 60;
const SKILL_START_Y = 140;
const SKILL_ROW_H = 34;
const CAT_R = 22;
const SKILL_R = 14;

export function SkillTree() {
  const [active, setActive] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();

  // Compute category X positions evenly spaced across the SVG width.
  const catCount = skills.length;
  const catXs = skills.map((_, i) => Math.round(((i + 0.5) / catCount) * SVG_WIDTH));

  // Compute total SVG height from the tallest column.
  const maxItems = Math.max(...skills.map((s) => s.items.length));
  const svgHeight = SKILL_START_Y + maxItems * SKILL_ROW_H + 30;

  const toggleActive = (group: string) => {
    setActive((prev) => (prev === group ? null : group));
  };

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
        width="100%"
        role="img"
        aria-label="Skill tree showing technical competencies grouped by area"
        style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
      >
        {/* Bezier connections */}
        {skills.map((cat, ci) => {
          const cx = catXs[ci];
          const color = GROUP_COLORS[cat.group] ?? DEFAULT_COLOR;
          const isActiveGroup = active === null || active === cat.group;

          return cat.items.map((item, ii) => {
            const skillX = cx;
            const skillY = SKILL_START_Y + ii * SKILL_ROW_H;
            const mid = (CAT_Y + SKILL_START_Y) / 2;

            return (
              <path
                key={`${cat.group}-${item}-path`}
                d={`M ${cx} ${CAT_Y + CAT_R} Q ${cx} ${mid} ${skillX} ${skillY - SKILL_R}`}
                stroke={color}
                strokeWidth={isActiveGroup ? 1.5 : 0.4}
                strokeOpacity={isActiveGroup ? 0.6 : 0.15}
                fill="none"
                style={{ transition: reducedMotion ? undefined : "stroke-opacity 0.2s, stroke-width 0.2s" }}
              />
            );
          });
        })}

        {/* Skill nodes */}
        {skills.map((cat, ci) => {
          const cx = catXs[ci];
          const color = GROUP_COLORS[cat.group] ?? DEFAULT_COLOR;
          const isActiveGroup = active === null || active === cat.group;

          return cat.items.map((item, ii) => {
            const skillY = SKILL_START_Y + ii * SKILL_ROW_H;
            const opacity = isActiveGroup ? 1 : 0.25;

            return (
              <g key={`${cat.group}-${item}`} style={{ transition: reducedMotion ? undefined : "opacity 0.2s" }} opacity={opacity}>
                <circle
                  cx={cx}
                  cy={skillY}
                  r={SKILL_R}
                  fill={color}
                  fillOpacity={0.12}
                  stroke={color}
                  strokeWidth={1}
                />
                <text
                  x={cx}
                  y={skillY}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontSize={8}
                  fill={color}
                  aria-label={item}
                >
                  {item.length > 9 ? item.slice(0, 8) + "…" : item}
                </text>
              </g>
            );
          });
        })}

        {/* Category nodes — rendered last so they sit on top of connections */}
        {skills.map((cat, ci) => {
          const cx = catXs[ci];
          const color = GROUP_COLORS[cat.group] ?? DEFAULT_COLOR;
          const isActive = active === cat.group;

          return (
            <g
              key={cat.group}
              onClick={() => toggleActive(cat.group)}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={`${cat.group}: ${cat.items.join(", ")}`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleActive(cat.group); }}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={cx}
                cy={CAT_Y}
                r={CAT_R}
                fill={color}
                fillOpacity={isActive ? 0.25 : 0.1}
                stroke={color}
                strokeWidth={isActive ? 2 : 1.2}
                style={
                  reducedMotion
                    ? undefined
                    : {
                        filter: isActive ? `drop-shadow(0 0 6px ${color})` : undefined,
                        transition: "fill-opacity 0.2s, stroke-width 0.2s",
                      }
                }
              />
              <text
                x={cx}
                y={CAT_Y}
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                fill={color}
              >
                {cat.group.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Active category label */}
      <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-fg-subtle">
        {active
          ? `${active} — ${skills.find((s) => s.group === active)?.items.join(", ")}`
          : "click a node to filter"}
      </p>
    </div>
  );
}
