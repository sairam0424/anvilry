"use client";

import { useSyncExternalStore } from "react";

/**
 * Transient highlight store — allows the AI chat to glow-highlight a project card
 * when the model emits a [[cmd:highlight:<slug>]] token. The highlight auto-clears
 * after 3 seconds. Uses the same module-level external-store pattern as
 * anvil-inline-store.ts so project-card.tsx can subscribe with useSyncExternalStore.
 */

let highlightedSlug: string | null = null;
const listeners = new Set<() => void>();
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function getSnapshot(): string | null {
  return highlightedSlug;
}

export function highlightProject(slug: string) {
  if (clearTimer !== null) clearTimeout(clearTimer);
  highlightedSlug = slug;
  emit();
  clearTimer = setTimeout(() => {
    highlightedSlug = null;
    clearTimer = null;
    emit();
  }, 3000);
}

export function clearHighlight() {
  if (clearTimer !== null) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  highlightedSlug = null;
  emit();
}

export function useHighlightedSlug(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
