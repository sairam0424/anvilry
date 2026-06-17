import { useSyncExternalStore } from "react";

/**
 * Discovery badge store — tracks which of 5 exploration moments a visitor has
 * unlocked. Nothing is ever gated (the badge is celebratory, not a paywall).
 * Backed by localStorage for persistence across refreshes; resets on browser clear.
 *
 * Pattern: module-level external store (same shape as view-context.tsx and
 * highlight-store.ts) so unlock() can be called from anywhere — no Provider needed.
 */

export type DiscoveryKey =
  | "view-switch"
  | "chat-question"
  | "terminal-command"
  | "konami"
  | "dossier-open";

const STORAGE_KEY = "anvilry:discoveries";
const ALL_KEYS: DiscoveryKey[] = [
  "view-switch",
  "chat-question",
  "terminal-command",
  "konami",
  "dossier-open",
];

function readStorage(): Set<DiscoveryKey> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((k): k is DiscoveryKey => ALL_KEYS.includes(k as DiscoveryKey)));
  } catch {
    return new Set();
  }
}

function writeStorage(s: Set<DiscoveryKey>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  } catch {
    // storage quota exceeded — degrade silently
  }
}

let discovered: Set<DiscoveryKey> = readStorage();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const getSnapshot = () => discovered;
const getServerSnapshot = (): Set<DiscoveryKey> => new Set();

/** Mark a discovery key as unlocked. Idempotent — calling twice is safe. */
export function unlock(key: DiscoveryKey) {
  if (discovered.has(key)) return;
  discovered = new Set(discovered).add(key);
  writeStorage(discovered);
  emit();
}

/** Unlock all 5 keys at once (escape hatch via Cmd+K). */
export function unlockAll() {
  discovered = new Set(ALL_KEYS);
  writeStorage(discovered);
  emit();
}

/** React hook — returns the live Set of unlocked keys. */
export function useDiscoveries(): Set<DiscoveryKey> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Synchronous count — for badge display without subscribing to the full set. */
export function getDiscoveryCount(): number {
  return discovered.size;
}

export const DISCOVERY_TOTAL = ALL_KEYS.length;
