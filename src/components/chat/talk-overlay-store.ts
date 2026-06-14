"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny module-level store for "is the talk-mode modal open?" — mirrors the view store
 * pattern (useSyncExternalStore). It exists so MULTIPLE entry points (the Chat-view
 * "Talk" button AND the ⌘K "Start voice conversation" command) can open the SAME
 * single overlay instance mounted once in the layout, instead of each owning its own.
 *
 * It also remembers the element that opened it, so focus is restored there on close
 * (WCAG 2.4.3) regardless of which entry point was used. Server snapshot is always
 * false (the modal is never open on first paint / SSR).
 */

let open = false;
let opener: HTMLElement | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

/** Open the modal, remembering `triggerEl` to restore focus to on close. */
export function openTalkMode(triggerEl?: HTMLElement | null): void {
  opener = triggerEl ?? null;
  if (open) return;
  open = true;
  emit();
}

export function setTalkModeOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  emit();
}

/** The element to return focus to when the modal closes (or null). */
export function getTalkOpener(): HTMLElement | null {
  return opener;
}

/** Subscribe to the open state (false on server + first client paint). */
export function useTalkModeOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
