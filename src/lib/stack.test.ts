import { describe, it, expect } from "vitest";
import { skills } from "./profile";
import {
  STACK_ENTRIES,
  stackBrandVars,
  stackGroups,
  stackItems,
} from "./stack";
import { STACK_ICON_PATHS } from "@/components/stack-icons";

// --bg-base values from src/app/globals.css (:root dark, [data-theme="light"] light).
const BG = { dark: "07080d", light: "f7f8fb" };
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
    expect(stackGroups.flatMap((g) => g.items)).toEqual(stackItems);
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

  it("hover colour clears 3:1 on both bg-base values or declares a theme override", () => {
    for (const i of stackItems) {
      if (i.kind !== "brand") continue;
      const hex = i.hex.slice(1);
      if (contrast(hex, BG.dark) < 3)
        expect(i.hoverDark, `${i.name} needs hoverDark`).toBeTruthy();
      if (contrast(hex, BG.light) < 3)
        expect(i.hoverLight, `${i.name} needs hoverLight`).toBeTruthy();
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
