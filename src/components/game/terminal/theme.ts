import type { Theme } from "./types";

/** The cosmetic prompt themes, in cycle order. */
export const THEMES: Theme[] = ["cyan", "green", "amber"];

/** Next theme in the cyan -> green -> amber -> cyan cycle. Pure + wrap-safe. */
export function nextTheme(current: Theme): Theme {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
}
