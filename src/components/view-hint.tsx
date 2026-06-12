"use client";

import { useSyncExternalStore } from "react";
import { X, Sparkles } from "lucide-react";
import { useView } from "@/components/view-context";

const SEEN_KEY = "anvilry-hint-seen";

// Tiny external store for the "hint dismissed" flag — avoids setState-in-effect by
// reading localStorage synchronously (server snapshot = dismissed, so SSR/no-JS
// never flashes the hint). Dismiss notifies subscribers to re-read.
const listeners = new Set<() => void>();
function dismissHint() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
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
        return localStorage.getItem(SEEN_KEY) === "1";
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
 */
export function ViewHint() {
  const { view } = useView();
  const dismissed = useHintDismissed();

  if (dismissed || view !== "classic") return null;

  return (
    <div className="fixed bottom-20 right-3 z-30 max-w-[16rem] rounded-xl border border-accent/40 bg-bg-surface/95 p-3 text-sm shadow-lg shadow-accent/10 backdrop-blur sm:bottom-5 sm:right-44">
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
        Explore my work as a playable graph, or just ask the AI concierge — use the
        Classic · Play · Chat switcher up top.
      </p>
    </div>
  );
}
