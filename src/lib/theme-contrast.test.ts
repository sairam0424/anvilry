import { describe, expect, it } from "vitest";

/**
 * WCAG 2.x relative-luminance contrast checker.
 *
 * Self-contained on purpose — no external contrast library exists in this repo's
 * dependencies, and this is pure hex-math with no DOM dependency, so it runs in
 * the fast "node" vitest project (this file is NOT named *.dom.test.*).
 *
 * Formula: sRGB -> linear -> relative luminance -> (L1 + 0.05) / (L2 + 0.05).
 * https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */

/** Converts a single 0-255 sRGB channel to its linearized [0,1] value. */
function srgbChannelToLinear(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Parses a `#rrggbb` hex color into its [r, g, b] 0-255 components. */
function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`Expected a 6-digit hex color, got "${hex}"`);
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

/** WCAG relative luminance of a `#rrggbb` hex color. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/** WCAG contrast ratio between two `#rrggbb` hex colors (order-independent). */
function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexA);
  const luminanceB = relativeLuminance(hexB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Every foreground/status CSS custom property verified against `--bg-base`,
 * in both themes.
 *
 * Hex values below are copied verbatim from `src/app/globals.css` (`:root` for
 * dark, `[data-theme="light"]` for light) — update this table whenever those
 * custom properties are retuned, do not let it silently drift out of sync.
 */
const AA_NORMAL_TEXT_MIN_RATIO = 4.5;
const NON_TEXT_MIN_RATIO = 3;

interface CssPropertyContrastCase {
  /** CSS custom property name (without the `--` prefix), for test labeling. */
  cssPropertyName: string;
  darkForegroundHex: string;
  lightForegroundHex: string;
  darkBackgroundHex: string;
  lightBackgroundHex: string;
  minRatio: number;
}

const DARK_BG_BASE = "#07080d";
const LIGHT_BG_BASE = "#f7f8fb";

const cssPropertyContrastCases: CssPropertyContrastCase[] = [
  // Body text — WCAG SC 1.4.3 (AA normal text), 4.5:1 floor.
  {
    cssPropertyName: "fg",
    darkForegroundHex: "#e9ecf5",
    lightForegroundHex: "#12141c",
    darkBackgroundHex: DARK_BG_BASE,
    lightBackgroundHex: LIGHT_BG_BASE,
    minRatio: AA_NORMAL_TEXT_MIN_RATIO,
  },
  {
    cssPropertyName: "fg-muted",
    darkForegroundHex: "#9aa3b8",
    lightForegroundHex: "#4b5164",
    darkBackgroundHex: DARK_BG_BASE,
    lightBackgroundHex: LIGHT_BG_BASE,
    minRatio: AA_NORMAL_TEXT_MIN_RATIO,
  },
  {
    cssPropertyName: "fg-subtle",
    darkForegroundHex: "#747e99",
    lightForegroundHex: "#6b7184",
    darkBackgroundHex: DARK_BG_BASE,
    lightBackgroundHex: LIGHT_BG_BASE,
    minRatio: AA_NORMAL_TEXT_MIN_RATIO,
  },

  // Accent + status colors — also used as text (e.g. text-accent links), 4.5:1 floor.
  {
    cssPropertyName: "accent",
    darkForegroundHex: "#38e1ff",
    lightForegroundHex: "#0e7490",
    darkBackgroundHex: DARK_BG_BASE,
    lightBackgroundHex: LIGHT_BG_BASE,
    minRatio: AA_NORMAL_TEXT_MIN_RATIO,
  },
  {
    cssPropertyName: "accent-strong",
    darkForegroundHex: "#0fb8db",
    lightForegroundHex: "#0b5b73",
    darkBackgroundHex: DARK_BG_BASE,
    lightBackgroundHex: LIGHT_BG_BASE,
    minRatio: AA_NORMAL_TEXT_MIN_RATIO,
  },
  {
    cssPropertyName: "violet",
    darkForegroundHex: "#a78bfa",
    lightForegroundHex: "#7c3aed",
    darkBackgroundHex: DARK_BG_BASE,
    lightBackgroundHex: LIGHT_BG_BASE,
    minRatio: AA_NORMAL_TEXT_MIN_RATIO,
  },
  {
    cssPropertyName: "green",
    darkForegroundHex: "#4ade80",
    lightForegroundHex: "#166534",
    darkBackgroundHex: DARK_BG_BASE,
    lightBackgroundHex: LIGHT_BG_BASE,
    minRatio: AA_NORMAL_TEXT_MIN_RATIO,
  },
  {
    cssPropertyName: "amber",
    darkForegroundHex: "#fbbf24",
    lightForegroundHex: "#92400e",
    darkBackgroundHex: DARK_BG_BASE,
    lightBackgroundHex: LIGHT_BG_BASE,
    minRatio: AA_NORMAL_TEXT_MIN_RATIO,
  },
  {
    cssPropertyName: "red",
    darkForegroundHex: "#f87171",
    lightForegroundHex: "#991b1b",
    darkBackgroundHex: DARK_BG_BASE,
    lightBackgroundHex: LIGHT_BG_BASE,
    minRatio: AA_NORMAL_TEXT_MIN_RATIO,
  },

  // Real form-control border — WCAG SC 1.4.11 (non-text contrast), 3:1 floor, not 4.5:1.
  {
    cssPropertyName: "border-interactive",
    darkForegroundHex: "#64748b",
    lightForegroundHex: "#64748b",
    darkBackgroundHex: DARK_BG_BASE,
    lightBackgroundHex: LIGHT_BG_BASE,
    minRatio: NON_TEXT_MIN_RATIO,
  },
];

describe("theme-contrast: CSS custom property ratios against bg-base clear their WCAG floor", () => {
  // This test's entire purpose is to catch a FUTURE regression below the WCAG
  // floor — it intentionally never asserts today's exact ratio, only that the
  // floor is met, so an intentional future retune within the floor never breaks it.
  for (const testCase of cssPropertyContrastCases) {
    it(`--${testCase.cssPropertyName} (dark theme) is at least ${testCase.minRatio}:1 against bg-base`, () => {
      const ratio = contrastRatio(
        testCase.darkForegroundHex,
        testCase.darkBackgroundHex,
      );
      expect(ratio).toBeGreaterThanOrEqual(testCase.minRatio);
    });

    it(`--${testCase.cssPropertyName} (light theme) is at least ${testCase.minRatio}:1 against bg-base`, () => {
      const ratio = contrastRatio(
        testCase.lightForegroundHex,
        testCase.lightBackgroundHex,
      );
      expect(ratio).toBeGreaterThanOrEqual(testCase.minRatio);
    });
  }
});
