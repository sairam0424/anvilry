"use client";

import { useSyncExternalStore } from "react";

/**
 * Module store for the IN-PLACE Anvil voice panel (the Siri-style "expand from the
 * header orb" surface) — mirrors talk-overlay-store, but drives the NON-MODAL inline
 * panel instead of the centered modal. Kept separate from the modal store so the two
 * surfaces never both think they're open; the one-mic mutex (P2) arbitrates between
 * them, the inline panel, and the ?view=voice view.
 *
 * Like the modal store it remembers the element that opened it, so focus is restored
 * there on close (WCAG 2.4.3) — here that's always the header orb. Server snapshot is
 * always false (the panel is never open on first paint / SSR).
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

/** Open the inline panel, remembering `triggerEl` (the orb) to restore focus to on close. */
export function openInlineVoice(triggerEl?: HTMLElement | null): void {
  opener = triggerEl ?? null;
  if (open) return;
  open = true;
  emit();
}

export function setInlineVoiceOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  emit();
}

/** The element to return focus to when the panel closes (the orb), or null. */
export function getInlineVoiceOpener(): HTMLElement | null {
  return opener;
}

/** Subscribe to the open state (false on server + first client paint). */
export function useInlineVoiceOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
