"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Persisted light/dark theme preference for the whole site. Implemented as a
 * module-level external store (mirroring voice-settings-context.tsx) rather than
 * Context+useState, for the same reasons that pattern documents there:
 *  1. the persisted value is read SYNCHRONOUSLY on the first client render, so a
 *     returning visitor's choice applies without waiting on an effect;
 *  2. a stable server/first-client snapshot ("dark") avoids a hydration mismatch;
 *  3. any component (nav, drawer, future settings surface) subscribes without
 *     prop-drilling or setState-in-effect.
 *
 * Theme deliberately PERSISTS in localStorage — unlike view-context.tsx's view
 * state, which the owner intentionally keeps memory-only. A theme choice should
 * survive across visits (see plan decision).
 *
 * The no-flash inline script mounted in layout.tsx's <head> applies the persisted
 * value to `document.documentElement.dataset.theme` BEFORE React hydrates, so
 * there's never a flash of the wrong theme on load. Because `<html>` never carries
 * `data-theme` as a React-rendered prop, that imperative write can never cause a
 * hydration diff — the same reasoning view-context.tsx already relies on for
 * `document.documentElement.dataset.viewDir`.
 */

export type Theme = "dark" | "light";

const STORAGE_KEY = "anvilry:theme";

const isTheme = (v: unknown): v is Theme => v === "dark" || v === "light";

/** Parse a raw localStorage value into a valid Theme, defaulting to "dark". */
function parse(raw: string | null): Theme {
  return isTheme(raw) ? raw : "dark";
}

// Module-level store. `current` is the live client value; listeners re-render
// subscribers on change. Immutable updates only (new primitive every write) so
// useSyncExternalStore's referential-equality check fires correctly.
let current: Theme = "dark";
let hydrated = false;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

/** Read from localStorage exactly once, lazily, on the first client snapshot. */
function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  current = parse(window.localStorage.getItem(STORAGE_KEY));
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

const getClientSnapshot = (): Theme => {
  ensureHydrated();
  return current;
};

// Server + first-client snapshot must agree to avoid a hydration mismatch: both
// return "dark" (today's default palette). The persisted value is applied after
// mount via the store — the no-flash script has already painted the real value
// onto document.documentElement before hydration even starts, so this never causes
// a visible flash, only a (invisible) store re-render once React catches up.
const getServerSnapshot = (): Theme => "dark";

/** Persist + broadcast a theme change, and reflect it onto the document. Best-effort. */
function apply(next: Theme): void {
  current = next;
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = next;
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode / quota — theme is best-effort, never blocks the feature */
    }
  }
  emit();
}

/**
 * Read the current theme + setters. No provider component needed — the store is
 * module-level — but exported as a hook so call sites read like the rest of the
 * app's context hooks (useView, useVoiceSettings, etc.).
 */
export function useTheme(): {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
} {
  const theme = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const setTheme = useCallback((next: Theme) => apply(next), []);
  const toggleTheme = useCallback(() => apply(current === "dark" ? "light" : "dark"), []);
  return { theme, setTheme, toggleTheme };
}

// Exported for tests + non-React callers (and to reset state between test cases).
export { STORAGE_KEY, parse };
export function __resetThemeForTest(): void {
  current = "dark";
  hydrated = false;
  listeners.clear();
}
