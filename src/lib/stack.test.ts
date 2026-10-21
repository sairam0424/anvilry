import { describe, it, expect } from "vitest";
import { skills } from "./profile";
import { STACK_ENTRIES, stackBrandVars, stackItems } from "./stack";
import { STACK_ICON_PATHS } from "@/components/stack-icons";

// Theme tokens from src/app/globals.css (:root dark, [data-theme="light"] light). Tiles sit on
// bg-surface and take a 5% --fg tint on hover (hover:bg-fg/5), so that composite, not --bg-base,
// is the surface the brand colour must clear.
const THEME = {
  dark: { surface: "0d0f17", fg: "e9ecf5", accent: "38e1ff", green: "4ade80" },
  light: { surface: "ffffff", fg: "12141c", accent: "0e7490", green: "166534" },
};
type ThemeName = keyof typeof THEME;

const channel = (v: number) =>
  v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const luminance = (hex: string) => {
  const [r, g, b] = [0, 2, 4].map((i) =>
    channel(parseInt(hex.slice(i, i + 2), 16) / 255),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG 2.x contrast ratio between two "RRGGBB" colours. */
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Composite `top` over `bottom` at `alpha` (sRGB, good enough for a contrast check). */
const mix = (top: string, bottom: string, alpha: number) =>
  [0, 2, 4]
    .map((i) =>
      Math.round(
        parseInt(top.slice(i, i + 2), 16) * alpha +
          parseInt(bottom.slice(i, i + 2), 16) * (1 - alpha),
      ),
    )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
const hoveredSurface = (t: ThemeName) =>
  mix(THEME[t].fg, THEME[t].surface, 0.05);
/** Resolve a `var(--token)` override to the theme's hex, or fall back to the brand hex. */
const resolve = (value: string | undefined, hex: string, t: ThemeName) => {
  if (!value) return hex;
  const name = value.replace(/^var\(--|\)$/g, "") as "fg" | "accent" | "green";
  return THEME[t][name];
};

describe("stack data", () => {
  const flat = skills.flatMap((g) => g.items);

  it("every stack entry is an exact profile.skills item (no drift)", () => {
    for (const name of Object.keys(STACK_ENTRIES)) {
      expect(flat, `${name} is not in profile.skills`).toContain(name);
    }
  });

  it("derives one tile per entry, in profile order, with no duplicates", () => {
    expect(stackItems.map((i) => i.name)).toEqual(
      flat.filter((n) => n in STACK_ENTRIES),
    );
    expect(stackItems).toHaveLength(Object.keys(STACK_ENTRIES).length);
    expect(new Set(stackItems.map((i) => i.name)).size).toBe(stackItems.length);
  });

  it("links are https; brand entries have #RRGGBB hex and a non-empty icon path", () => {
    for (const i of stackItems) {
      expect(i.href, i.name).toMatch(/^https:\/\//);
      if (i.kind === "brand") {
        expect(i.hex, i.name).toMatch(/^#[0-9A-F]{6}$/);
        expect(i.icon in STACK_ICON_PATHS, `${i.name}: icon ${i.icon}`).toBe(
          true,
        );
        expect(
          STACK_ICON_PATHS[i.icon].length,
          `${i.name}: empty path`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("the effective hover colour clears 3:1 on each theme's hovered panel surface", () => {
    for (const i of stackItems) {
      if (i.kind !== "brand") continue;
      const hex = i.hex.slice(1);
      for (const t of ["dark", "light"] as const) {
        const override = t === "dark" ? i.hoverDark : i.hoverLight;
        const ratio = contrast(resolve(override, hex, t), hoveredSurface(t));
        expect(
          ratio,
          `${i.name} on ${t} hovered surface: ${ratio.toFixed(2)} (override: ${override ?? "none"})`,
        ).toBeGreaterThanOrEqual(3);
        // An override must be doing work: the raw brand hex alone must have failed there.
        if (override) {
          expect(
            contrast(hex, hoveredSurface(t)),
            `${i.name}: needless ${t} override`,
          ).toBeLessThan(3);
        }
      }
    }
  });

  it("exposes the per-theme brand variables only for brand tiles", () => {
    const brand = stackItems.find((i) => i.kind === "brand");
    const glyph = stackItems.find((i) => i.kind === "glyph");
    expect(brand && stackBrandVars(brand)).toEqual({
      "--brand-dark": expect.any(String),
      "--brand-light": expect.any(String),
    });
    expect(glyph && stackBrandVars(glyph)).toEqual({});
  });
});
