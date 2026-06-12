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
import { useSearchParams } from "next/navigation";

/**
 * The three top-level experiences a visitor can switch between. CLASSIC is the
 * SSG-indexed default rendered on first paint; GAMIFIED and CHAT are additive
 * client-only views selected without a navigation (so the WebGL context and the
 * chat transcript survive a switch).
 */
export type View = "classic" | "gamified" | "chat";

const VIEWS: readonly View[] = ["classic", "gamified", "chat"] as const;
const DEFAULT_VIEW: View = "classic";
const COOKIE = "anvilry-view";
const STORAGE = "anvilry-view";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

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
// return DEFAULT_VIEW. The saved cookie/localStorage value is applied AFTER mount
// via setView (see ViewQuerySync), so SSR HTML always matches the Classic default.
const getClientSnapshot = () => current;
const getServerSnapshot = (): View => DEFAULT_VIEW;

function readPersisted(): View | null {
  if (typeof document !== "undefined") {
    const m = document.cookie.match(/(?:^|;\s*)anvilry-view=([^;]+)/);
    if (m && isView(m[1])) return m[1];
  }
  try {
    const ls = localStorage.getItem(STORAGE);
    if (isView(ls)) return ls;
  } catch {
    // localStorage can throw in private mode / sandboxed iframes — ignore.
  }
  return null;
}

function persist(view: View) {
  try {
    localStorage.setItem(STORAGE, view);
  } catch {
    // ignore — cookie below is the durable fallback
  }
  // Non-httpOnly so the client owns it; the SERVER layout never reads cookies()
  // (that would de-opt `/` to dynamic and regress SSG/SEO).
  document.cookie = `${COOKIE}=${view}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/** Set the active view, persist it, and reflect it in the URL (?view=) without a navigation. */
function setViewInternal(view: View, { updateUrl = true }: { updateUrl?: boolean } = {}) {
  if (!isView(view) || view === current) return;
  current = view;
  persist(view);
  if (updateUrl && typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (view === DEFAULT_VIEW) url.searchParams.delete("view");
    else url.searchParams.set("view", view);
    window.history.replaceState(window.history.state, "", url);
  }
  emit();
}

type ViewContextValue = { view: View; setView: (v: View) => void };
const ViewContext = createContext<ViewContextValue | null>(null);

/**
 * Reads the `?view=` deep-link and the persisted cookie/localStorage on mount, then
 * resolves the active view by precedence: ?view= > cookie/localStorage > classic.
 * Isolated here (and only here) because useSearchParams forces client-rendering up
 * to the nearest <Suspense> on a prerendered route — keeping it in this leaf lets
 * the entire provider tree above prerender. Renders nothing.
 */
function ViewQuerySync() {
  const params = useSearchParams();

  useEffect(() => {
    const fromUrl = params.get("view");
    if (isView(fromUrl)) {
      // Deep-link wins; persist it but don't rewrite the URL we just read.
      setViewInternal(fromUrl, { updateUrl: false });
      return;
    }
    const saved = readPersisted();
    if (saved && saved !== current) setViewInternal(saved, { updateUrl: false });
    // Only the `view` query param matters here.
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

export { VIEWS, DEFAULT_VIEW };
