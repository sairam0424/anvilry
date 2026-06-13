"use client";

import { useSyncExternalStore, useEffect, Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { resolveFlag } from "./resolve-flag";
import type { ScrollEngine, ScrollMode } from "./types";

/**
 * Runtime feature flags for the autoscroll A/B bake-off, mirroring the module-store +
 * useSyncExternalStore pattern in view-context.tsx. Two independent flags (engine,
 * mode). Precedence: ?scroll= / ?scrollmode= URL param > localStorage > default.
 *
 * Server + first-client snapshot MUST be the DEFAULT so SSR HTML matches and there's
 * no hydration mismatch; the persisted/URL value is applied AFTER mount by
 * <ScrollFlagsSync>. These are dev/bake-off conveniences, not user-facing settings.
 */
const ENGINES: readonly ScrollEngine[] = ["custom", "library"] as const;
const MODES: readonly ScrollMode[] = ["bottom-pin", "message-top"] as const;

// The shipped defaults. The bake-off (Phase 5) flips these to the measured winner.
const DEFAULT_ENGINE: ScrollEngine = "custom";
const DEFAULT_MODE: ScrollMode = "bottom-pin";

const ENGINE_KEY = "anvilry.scroll.engine";
const MODE_KEY = "anvilry.scroll.mode";

type Flags = { engine: ScrollEngine; mode: ScrollMode };

let current: Flags = { engine: DEFAULT_ENGINE, mode: DEFAULT_MODE };
const listeners = new Set<() => void>();
// Cached snapshots so getClientSnapshot/getServerSnapshot each return a STABLE
// reference between changes — useSyncExternalStore compares snapshots by identity and
// warns ("should be cached to avoid an infinite loop") / re-renders forever if a fresh
// object is returned on every call.
let snapshot: Flags = current;
const SERVER_SNAPSHOT: Flags = { engine: DEFAULT_ENGINE, mode: DEFAULT_MODE };

const emit = () => {
  snapshot = { ...current };
  for (const l of listeners) l();
};

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

const getClientSnapshot = (): Flags => snapshot;
const getServerSnapshot = (): Flags => SERVER_SNAPSHOT;

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // private mode / disabled storage — fall through to default
  }
}

function writeStored(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function setScrollEngine(engine: ScrollEngine) {
  if (engine === current.engine) return;
  current = { ...current, engine };
  writeStored(ENGINE_KEY, engine);
  emit();
}

export function setScrollMode(mode: ScrollMode) {
  if (mode === current.mode) return;
  current = { ...current, mode };
  writeStored(MODE_KEY, mode);
  emit();
}

/** Apply persisted + URL values once on mount and whenever the params change. */
function applyFromSources(params: URLSearchParams) {
  const engine = resolveFlag(ENGINES, {
    param: params.get("scroll"),
    stored: readStored(ENGINE_KEY),
    fallback: DEFAULT_ENGINE,
  });
  const mode = resolveFlag(MODES, {
    param: params.get("scrollmode"),
    stored: readStored(MODE_KEY),
    fallback: DEFAULT_MODE,
  });
  if (engine !== current.engine || mode !== current.mode) {
    current = { engine, mode };
    emit();
  }
}

/**
 * Reads ?scroll= / ?scrollmode= on mount/param-change and applies them. Isolated and
 * Suspense-wrapped because useSearchParams forces client rendering up to the nearest
 * boundary on a prerendered route — keeping it in this leaf lets the rest prerender.
 * Renders nothing.
 */
function ScrollFlagsReader() {
  const params = useSearchParams();
  useEffect(() => {
    applyFromSources(new URLSearchParams(params.toString()));
  }, [params]);
  return null;
}

/** Mount once (e.g. in providers) to activate URL/localStorage flag resolution. */
export function ScrollFlagsSync({ children }: { children?: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <ScrollFlagsReader />
      </Suspense>
      {children}
    </>
  );
}

export function useScrollEngine(): ScrollEngine {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot).engine;
}

export function useScrollMode(): ScrollMode {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot).mode;
}

export { ENGINES, MODES, DEFAULT_ENGINE, DEFAULT_MODE };
