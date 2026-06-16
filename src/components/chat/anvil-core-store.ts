"use client";

import { useSyncExternalStore } from "react";
import { registerVoiceSurface, claimVoiceSurface } from "@/components/chat/voice-surface-mutex";

/**
 * Module store for the CORE Siri voice surface — the minimal orb-only mode that shows
 * just the enlarged orb + a frosted result card (no panel chrome). Mirrors the inline
 * and modal stores in shape. Registers with the voice-surface-mutex so the one-mic
 * invariant extends to this 4th surface ({modal, inline, core, voice-view}).
 *
 * Server snapshot = false (never open on first paint / SSR).
 */

let open = false;
let opener: HTMLElement | null = null;
const listeners = new Set<() => void>();

const emit = () => { for (const l of listeners) l(); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };

export function openCoreVoice(triggerEl?: HTMLElement | null): void {
  claimVoiceSurface("core");
  opener = triggerEl ?? null;
  if (open) return;
  open = true;
  emit();
}

export function setCoreVoiceOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  emit();
}

export function getCoreVoiceOpener(): HTMLElement | null {
  return opener;
}

export function useCoreVoiceOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false);
}

registerVoiceSurface("core", () => setCoreVoiceOpen(false));
