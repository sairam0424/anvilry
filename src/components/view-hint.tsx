"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X, Sparkles } from "lucide-react";
import { useView } from "@/components/view-context";

const SEEN_KEY = "anvilry-hint-seen";
// How long a dismissal sticks before the hint is eligible to show again for the
// same visitor (localStorage persists across page loads, so without a TTL a
// single dismissal would silence it forever).
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h
// Dwell delay before the hint is allowed to render at all. Previously it rendered
// the instant this component mounted, which on mobile could land directly on top
// of the hero's primary "See my work" CTA before the visitor had done anything.
// Waiting gives the visitor time to scroll/interact first.
const SHOW_DELAY_MS = 7000; // 7s

// Tiny external store for the "hint dismissed" flag — avoids setState-in-effect by
// reading localStorage synchronously (server snapshot = dismissed, so SSR/no-JS
// never flashes the hint). Dismiss notifies subscribers to re-read.
const listeners = new Set<() => void>();
function dismissHint() {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    // private mode — ignore
  }
  for (const l of listeners) l();
}
function useHintDismissed(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      try {
        const raw = localStorage.getItem(SEEN_KEY);
        if (!raw) return false;
        // Back-compat: the previous version stored the literal "1" with no TTL —
        // honor that as a permanent dismissal rather than surprising returning
        // visitors who already closed it under the old scheme.
        if (raw === "1") return true;
        const seenAt = Number(raw);
        if (!Number.isFinite(seenAt)) return true;
        return Date.now() - seenAt < DISMISS_TTL_MS;
      } catch {
        return true; // can't persist -> treat as dismissed (don't nag)
      }
    },
    () => true, // server: never render the hint during SSR
  );
}

/**
 * One-time, non-blocking hint nudging first-time visitors toward the Play / Chat
 * views. Dismissible, never covers content, and shown ONLY in the classic view
 * (don't nag someone who already switched). The seen-flag is a UI flag in
 * localStorage, not the view state (which is intentionally never persisted).
 *
 * Timing: gated behind a dwell timer (SHOW_DELAY_MS) so it never appears the
 * instant the page loads. Positioning: anchored to the TOP of the viewport on
 * mobile (<640px, right under the sticky nav) instead of the bottom, so it can
 * never overlap the hero's primary CTA further down the page; desktop keeps its
 * original bottom-right placement, which never had the overlap problem.
 */
export function ViewHint() {
  const { view } = useView();
  const dismissed = useHintDismissed();
  const [dwelled, setDwelled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDwelled(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (dismissed || !dwelled || view !== "classic") return null;

  return (
    <div className="fixed top-16 inset-x-3 z-30 rounded-xl border border-accent/40 bg-bg-surface/95 p-3 text-sm shadow-lg shadow-accent/10 backdrop-blur sm:inset-x-auto sm:top-auto sm:bottom-5 sm:right-44 sm:max-w-[16rem]">
      <button
        type="button"
        onClick={dismissHint}
        aria-label="Dismiss hint"
        className="absolute right-1.5 top-1.5 text-fg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X size={14} />
      </button>
      <p className="flex items-center gap-1.5 pr-4 font-medium text-fg">
        <Sparkles size={14} className="text-accent" /> Try a different view
      </p>
      <p className="mt-1 text-xs text-fg-muted">
        Explore my work as a playable graph, or just ask the AI concierge — use
        the Classic · Play · Chat switcher up top.
      </p>
    </div>
  );
}
