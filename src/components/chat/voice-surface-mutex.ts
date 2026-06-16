"use client";

/**
 * The one-mic mutex across voice surfaces.
 *
 * Anvil exposes the same grounded voice engine through more than one surface — the
 * centered modal (talk-overlay-store), the in-place inline panel (anvil-inline-store),
 * and the full-page ?view=voice view. Each surface mounts its OWN <TalkMode> →
 * useVoiceSession → useChat + mic + TTS (useChat is per-instance state, not a shared
 * context), so two open surfaces = two concurrent mics talking over each other — the
 * exact silent-audio failure class we fixed once.
 *
 * This module is the single arbiter. Each store REGISTERS a force-close callback here,
 * and calls `claimVoiceSurface(id)` just before it opens — which fires every OTHER
 * registered surface's close. Stores depend on this leaf module (never on each other),
 * so there is no import cycle.
 *
 * The ?view=voice view is handled separately (the header orb is disabled on that view —
 * see header-orb-trigger), because a view isn't a "close-able overlay"; it's mutually
 * exclusive by routing. This mutex governs the two OVERLAY surfaces (modal + inline).
 */

export type VoiceSurfaceId = "modal" | "inline" | "core";

const closers = new Map<VoiceSurfaceId, () => void>();

/** A surface registers how to force itself closed. Returns an unregister fn. */
export function registerVoiceSurface(id: VoiceSurfaceId, close: () => void): () => void {
  closers.set(id, close);
  return () => {
    if (closers.get(id) === close) closers.delete(id);
  };
}

/**
 * Claim the single voice session for `id`: close every OTHER registered surface first.
 * Call this at the start of an open(). Idempotent and safe if a surface isn't open
 * (its close() short-circuits on unchanged state).
 */
export function claimVoiceSurface(id: VoiceSurfaceId): void {
  for (const [otherId, close] of closers) {
    if (otherId !== id) close();
  }
}
