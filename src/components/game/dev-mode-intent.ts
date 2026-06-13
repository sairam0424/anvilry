/**
 * One-shot "reveal the Developer Mode terminal" intent.
 *
 * The ⌘K "Developer mode" entry lives in the command palette — OUTSIDE the lazily
 * mounted GameView subtree — so it can't scroll to or focus the terminal directly.
 * It raises this intent and switches to the gamified view; GameView consumes it.
 *
 * Two cases, both handled: (1) the user wasn't in Play — GameView mounts fresh and
 * consumes the pending intent in its mount effect; (2) the user was already in Play —
 * switchTo is a no-op and GameView doesn't remount, so the emit() notifies its live
 * subscriber. Module-level signal, mirroring the store pattern in view-context.tsx.
 */
let pending = false;
const listeners = new Set<() => void>();

/** Raise the intent (called by the ⌘K entry) and notify any live GameView. */
export function requestDevMode(): void {
  pending = true;
  for (const l of listeners) l();
}

/** Consume the intent exactly once; returns true if one was pending. */
export function consumeDevMode(): boolean {
  if (!pending) return false;
  pending = false;
  return true;
}

/** Subscribe to future intents (for an already-mounted GameView). Returns an unsubscribe. */
export function subscribeDevMode(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
