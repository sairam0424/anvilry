"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useSyncExternalStore,
  Suspense,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "next/navigation";

/**
 * The four top-level experiences a visitor can switch between. CLASSIC is the
 * SSG-indexed default rendered on first paint; GAMIFIED, CHAT, and DEVELOPER are
 * additive client-only views selected without a navigation (so the WebGL context and
 * the chat transcript survive a switch). DEVELOPER is a focused full-page terminal
 * destination (the keyboard-native CLI over the same content).
 */
export type View = "classic" | "gamified" | "chat" | "developer";

const VIEWS: readonly View[] = ["classic", "gamified", "chat", "developer"] as const;
const DEFAULT_VIEW: View = "classic";

const isView = (v: string | null | undefined): v is View =>
  v != null && (VIEWS as readonly string[]).includes(v);

/**
 * Module-level external store for the active view. Living outside React (mirroring
 * the useSyncExternalStore pattern in src/lib/use-media-query.ts) lets every
 * consumer subscribe without prop-drilling or setState-in-effect, and lets the
 * persisted value be read synchronously on the client's first render — avoiding a
 * flash of Classic before a deep-linked/saved view applies.
 */
let current: View = DEFAULT_VIEW;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

// Server + first-client snapshot must agree to avoid a hydration mismatch: both
// return DEFAULT_VIEW. A deep-linked ?view= is applied AFTER mount via ViewQuerySync,
// so SSR HTML always matches the Classic default and crawlers/no-JS get Classic.
const getClientSnapshot = () => current;
const getServerSnapshot = (): View => DEFAULT_VIEW;

/**
 * Commit a view change, cross-fading via the View Transitions API when available.
 *
 * The swap is a useSyncExternalStore emit() → React commits it ASYNCHRONOUSLY
 * (batched). startViewTransition snapshots the DOM before/after its callback, so
 * we must flushSync the emit INSIDE the callback — otherwise the "after" snapshot
 * is still the old view and nothing animates. flushSync forces the new view to
 * paint synchronously within the transition.
 *
 * Skipped (plain emit) when: the API is missing (older browsers) OR the user
 * prefers reduced motion — the kill-switch keeps the swap instant and jank-free.
 */
function commitViewChange() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const doc = typeof document !== "undefined" ? document : undefined;
  if (!doc || typeof doc.startViewTransition !== "function" || prefersReducedMotion) {
    emit();
    return;
  }
  doc.startViewTransition(() => flushSync(emit));
}

/**
 * Set the active view and reflect it in the URL (?view=) without a navigation.
 *
 * Deliberately NO cookie/localStorage persistence: the owner's decision is
 * "Classic always" on first paint — a returning visitor is never auto-switched.
 * The ?view= query param (shareable + survives in-session history) is the only
 * persistence, so a fresh load of bare `/` is always Classic.
 */
function setViewInternal(
  view: View,
  { updateUrl = true, transition = true }: { updateUrl?: boolean; transition?: boolean } = {},
) {
  if (!isView(view) || view === current) return;
  current = view;
  if (updateUrl && typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (view === DEFAULT_VIEW) url.searchParams.delete("view");
    else url.searchParams.set("view", view);
    window.history.replaceState(window.history.state, "", url);
  }
  // Deep-link sync on mount commits instantly (no cross-fade on first paint);
  // user-initiated switches cross-fade via the View Transitions API.
  if (transition) commitViewChange();
  else emit();
}

type ViewContextValue = { view: View; setView: (v: View) => void };
const ViewContext = createContext<ViewContextValue | null>(null);

/**
 * Reads the `?view=` deep-link on mount/param-change and applies it. Isolated here
 * (and only here) because useSearchParams forces client-rendering up to the nearest
 * <Suspense> on a prerendered route — keeping it in this leaf lets the entire
 * provider tree above prerender. A bare `/` with no ?view= leaves the Classic
 * default untouched (owner decision: never auto-switch). Renders nothing.
 */
function ViewQuerySync() {
  const params = useSearchParams();

  useEffect(() => {
    const fromUrl = params.get("view");
    // Don't rewrite the URL we just read from, and don't cross-fade on first
    // paint — the deep-linked view should appear immediately, not animate in.
    if (isView(fromUrl)) setViewInternal(fromUrl, { updateUrl: false, transition: false });
  }, [params]);

  return null;
}

export function ViewProvider({ children }: { children: ReactNode }) {
  const view = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const setView = useCallback((v: View) => setViewInternal(v), []);

  return (
    <ViewContext.Provider value={{ view, setView }}>
      <Suspense fallback={null}>
        <ViewQuerySync />
      </Suspense>
      {children}
    </ViewContext.Provider>
  );
}

/** Read the active view + a setter. Must be used inside <ViewProvider>. */
export function useView(): ViewContextValue {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useView must be used within <ViewProvider>");
  return ctx;
}

// getServerSnapshot + isView are exported for the SSG-safety regression test
// (assert the server/first-client snapshot stays "classic" no matter what VIEWS holds).
export { VIEWS, DEFAULT_VIEW, isView, getServerSnapshot };
