"use client";

import { useMemo } from "react";
import { useTheme } from "@/lib/theme-context";

/**
 * Plain-hex resolution of the app's themed CSS custom properties, for use as React
 * Three Fiber material `color` props — three.js's `Color` constructor can't consume
 * `var(--x)` the way a CSS `color` declaration can, so these must be resolved to
 * concrete hex strings on the client before being handed to <meshBasicMaterial>,
 * <lineBasicMaterial>, etc.
 */
export type ThemeColors = {
  accent: string;
  violet: string;
  green: string;
  amber: string;
  graphEdge: string;
};

// Dark-mode defaults (today's :root values in globals.css) — used for the SSR/build
// render (no `document`) and as a safety net if a lookup ever comes back empty (e.g.
// the token is momentarily missing). Never returns "" — that would crash a three.js
// `Color` constructor.
const DEFAULT_COLORS: ThemeColors = {
  accent: "#38e1ff",
  violet: "#a78bfa",
  green: "#4ade80",
  amber: "#fbbf24",
  graphEdge: "#3a4258",
};

function readThemeColors(): ThemeColors {
  if (typeof document === "undefined") return DEFAULT_COLORS;

  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string => {
    const value = style.getPropertyValue(name).trim();
    return value.length > 0 ? value : fallback;
  };

  return {
    accent: read("--accent", DEFAULT_COLORS.accent),
    violet: read("--violet", DEFAULT_COLORS.violet),
    green: read("--green", DEFAULT_COLORS.green),
    amber: read("--amber", DEFAULT_COLORS.amber),
    graphEdge: read("--graph-edge", DEFAULT_COLORS.graphEdge),
  };
}

/**
 * Resolves `--accent` / `--violet` / `--green` / `--amber` / `--graph-edge` into
 * plain hex strings, re-resolving whenever the site theme (dark/light, see
 * `useTheme()` in theme-context.tsx) changes — that's the only time these custom
 * properties' resolved values actually change, since `[data-theme="light"]`
 * re-declares them all in globals.css.
 *
 * Builds on top of `useTheme()`'s existing module-level external store rather than
 * inventing a separate subscription mechanism (no MutationObserver, no new store):
 * `theme` re-rendering this component (via `useSyncExternalStore` inside
 * `useTheme()`) is what triggers the re-read, keyed via `useMemo`'s dependency array
 * rather than a `useEffect` + `setState` (avoids an extra cascading render, and
 * `getComputedStyle` is a synchronous read that's always safe to call during render
 * — by the time `theme` has changed, `theme-context.tsx`'s `apply()` has already
 * synchronously written the new `data-theme` attribute that these custom properties
 * resolve against).
 *
 * First render is handled synchronously too — `useMemo`'s callback runs during
 * render, so the very first client render already has resolved colors (no flash of
 * stale/undefined values). During SSR (no `document`) it falls back to
 * `DEFAULT_COLORS`, matching the dark-mode default theme everywhere else in the app
 * (see theme-context.tsx's `getServerSnapshot`).
 */
export function useThemeColors(): ThemeColors {
  const { theme } = useTheme();
  // `theme` isn't read inside the callback — it's a deliberate memo key: the
  // callback reads `document.documentElement`'s COMPUTED style (an external,
  // mutable value theme-context.tsx's `apply()` just changed), and `theme` is the
  // one React-visible signal that tells us that external value is now stale.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => readThemeColors(), [theme]);
}
