/**
 * Terminal output formatting utilities — MindForge-inspired rich output.
 *
 * All functions return Line[] using the existing kind system:
 *   "art"  → text-fg-subtle  (dim borders, box-drawing, dividers)
 *   "out"  → text-fg-muted   (content text)
 *
 * Width target: 56 chars (terminal card is ~64ch wide; 56 gives padding room).
 * All box-drawing uses Unicode box chars — renders in all modern monospace fonts.
 */
import type { Line } from "./types";

const W = 56; // content width inside a box (box outer width = W + 4 for │ + spaces)

const art = (text: string): Line => ({ kind: "art", text });
const out = (text: string): Line => ({ kind: "out", text });

// ─── Primitives ───────────────────────────────────────────────────────────────

/** A dim horizontal divider line */
export function divider(): Line {
  return art(`  ${"─".repeat(W)}`);
}

/** Blank spacer line */
export function blank(): Line {
  return out("");
}

/** Section label: "// LABEL" in dim style */
export function section(label: string): Line {
  return art(`  // ${label.toUpperCase()}`);
}

/** Icon + key + value row: "  ● Key          Value" */
export function row(icon: string, key: string, val: string): Line {
  const keyPad = key.padEnd(14);
  return out(`  ${icon} ${keyPad}  ${val}`);
}

/** Simple indented bullet: "  ▸ text" */
export function bullet(text: string): Line {
  return out(`  ▸ ${text}`);
}

// ─── Composite builders ───────────────────────────────────────────────────────

/**
 * Boxed card with a title and content lines.
 *
 * ┌─ // TITLE ─────────────────────────────────────────┐
 * │  content line 1                                    │
 * │  content line 2                                    │
 * └────────────────────────────────────────────────────┘
 */
export function box(title: string, content: Line[]): Line[] {
  const label = ` ${title} `;
  const fillLen = Math.max(0, W + 2 - label.length - 2);
  const top = `┌─${label}${"─".repeat(fillLen)}┐`;
  const bottom = `└${"─".repeat(W + 2)}┘`;

  return [
    art(top),
    ...content.map((l) => {
      // Pad each content line to W chars inside the box
      const text = l.text;
      const padded = text.length < W ? text + " ".repeat(W - text.length) : text.slice(0, W);
      return { kind: l.kind, text: `│ ${padded} │` } as Line;
    }),
    art(bottom),
  ];
}

/**
 * Column-aligned table. Each row is [icon, col1, col2?].
 * Columns auto-pad to the longest value in each column.
 *
 *   ● pensieve              AI Process-Orchestration Engine
 *   ● aava-code             AI Coding Plugin for VS Code
 */
export function table(rows: [string, string, string?][], indent = "  "): Line[] {
  const col1Max = Math.max(...rows.map((r) => r[1].length), 0);
  return rows.map(([icon, col1, col2]) => {
    const padded = col1.padEnd(col1Max);
    const val = col2 ? `  ${col2}` : "";
    return out(`${indent}${icon} ${padded}${val}`);
  });
}

/**
 * Grouped section: "// LABEL" header + indented bullet list.
 *
 * // FRONTEND
 *   ▸ React, Next.js, TypeScript
 */
export function grouped(label: string, items: string[]): Line[] {
  return [
    blank(),
    section(label),
    ...items.map((item) => bullet(item)),
  ];
}

/**
 * Stats display: large value + label pairs in a compact card.
 *
 * ┌─ // PORTFOLIO STATS ─────────────────────────────────┐
 * │  ● production systems   5                           │
 * │  ● open-source repos    8                           │
 * └──────────────────────────────────────────────────────┘
 */
export function statsBox(title: string, stats: { label: string; value: string | number }[]): Line[] {
  return box(
    title,
    stats.map((s) => row("●", s.label, String(s.value))),
  );
}
