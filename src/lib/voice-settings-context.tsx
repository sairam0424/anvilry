"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Persisted voice preferences for the optional voice layer (mic input, read-aloud
 * TTS, two-way talk mode, wake word). Everything is OFF / browser-default until the
 * visitor explicitly opts in — voice is strictly additive, never required, and the
 * text composer is always the primary channel.
 *
 * Implemented as a module-level external store (mirroring view-context.tsx and
 * use-media-query.ts) rather than Context+useState, for three reasons:
 *  1. the persisted value is read SYNCHRONOUSLY on the first client render, so a
 *     returning visitor's choices apply without a flash of defaults;
 *  2. a stable server/first-client snapshot (DEFAULTS) avoids a hydration mismatch;
 *  3. any component (composer, message list, palette, talk mode) subscribes without
 *     prop-drilling or setState-in-effect.
 *
 * NOTE: the toggles only RECORD intent. Feature availability is still gated at the
 * point of use by runtime capability detection (e.g. SpeechRecognition support) — a
 * pref being "on" never overrides "this browser can't do it".
 */

/** Which engine powers speech-to-text. `browser` = free Web Speech (default). */
export type SttEngine = "browser" | "transcribe";
/** Which engine powers text-to-speech. `browser` = free speechSynthesis (default). */
export type TtsEngine = "browser" | "polly";
/** Where two-way talk mode mounts. `modal` overlay (default) or a 5th `view`. */
export type TalkSurface = "modal" | "view";

export type VoiceSettings = {
  /** Show the push-to-talk mic button in the composer. */
  micEnabled: boolean;
  /** Allow per-answer "read aloud" + spoken talk-mode output. */
  ttsEnabled: boolean;
  /** Always-listening wake word ("Hey portfolio"). Off by default — highest trust cost. */
  wakeWord: boolean;
  sttEngine: SttEngine;
  ttsEngine: TtsEngine;
  talkSurface: TalkSurface;
};

const DEFAULTS: VoiceSettings = {
  micEnabled: false,
  ttsEnabled: false,
  wakeWord: false,
  sttEngine: "browser",
  ttsEngine: "browser",
  talkSurface: "modal",
};

const STORAGE_KEY = "anvilry:voice:settings";

const isSttEngine = (v: unknown): v is SttEngine => v === "browser" || v === "transcribe";
const isTtsEngine = (v: unknown): v is TtsEngine => v === "browser" || v === "polly";
const isTalkSurface = (v: unknown): v is TalkSurface => v === "modal" || v === "view";

/**
 * Parse the persisted blob into a fully-valid settings object. Unknown/missing keys
 * fall back to DEFAULTS field-by-field, so a partial or older payload (e.g. before a
 * new toggle existed) upgrades cleanly instead of throwing.
 */
function parse(raw: string | null): VoiceSettings {
  if (!raw) return DEFAULTS;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof VoiceSettings, unknown>>;
    return {
      micEnabled: typeof o.micEnabled === "boolean" ? o.micEnabled : DEFAULTS.micEnabled,
      ttsEnabled: typeof o.ttsEnabled === "boolean" ? o.ttsEnabled : DEFAULTS.ttsEnabled,
      wakeWord: typeof o.wakeWord === "boolean" ? o.wakeWord : DEFAULTS.wakeWord,
      sttEngine: isSttEngine(o.sttEngine) ? o.sttEngine : DEFAULTS.sttEngine,
      ttsEngine: isTtsEngine(o.ttsEngine) ? o.ttsEngine : DEFAULTS.ttsEngine,
      talkSurface: isTalkSurface(o.talkSurface) ? o.talkSurface : DEFAULTS.talkSurface,
    };
  } catch {
    return DEFAULTS;
  }
}

// Module-level store. `current` is the live client value; listeners re-render
// subscribers on change. Immutable updates only (new object every write) so
// useSyncExternalStore's referential-equality check fires correctly.
let current: VoiceSettings = DEFAULTS;
let hydrated = false;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

/** Read from localStorage exactly once, lazily, on the first client snapshot. */
function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  current = parse(window.localStorage.getItem(STORAGE_KEY));
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

const getClientSnapshot = (): VoiceSettings => {
  ensureHydrated();
  return current;
};

// Server + first-client snapshot must agree to avoid a hydration mismatch: both
// return DEFAULTS. The persisted value is applied after mount via the store, so the
// SSR HTML always matches the "all off" default.
const getServerSnapshot = (): VoiceSettings => DEFAULTS;

/** Persist + broadcast a partial update (immutably). Best-effort write. */
function update(patch: Partial<VoiceSettings>): void {
  ensureHydrated();
  const next = { ...current, ...patch };
  current = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode / quota — prefs are best-effort, never block the feature */
    }
  }
  emit();
}

/**
 * Read the current voice settings + a setter. No provider component needed — the
 * store is module-level — but exported as a hook so call sites read like the rest of
 * the app's context hooks (useView, etc.).
 */
export function useVoiceSettings(): {
  settings: VoiceSettings;
  set: (patch: Partial<VoiceSettings>) => void;
  toggle: (key: "micEnabled" | "ttsEnabled" | "wakeWord") => void;
} {
  const settings = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const set = useCallback((patch: Partial<VoiceSettings>) => update(patch), []);
  const toggle = useCallback(
    (key: "micEnabled" | "ttsEnabled" | "wakeWord") => update({ [key]: !current[key] }),
    [],
  );
  return { settings, set, toggle };
}

// Exported for tests + non-React callers (and to reset state between test cases).
export { DEFAULTS, STORAGE_KEY, parse };
export function __resetVoiceSettingsForTest(): void {
  current = DEFAULTS;
  hydrated = false;
  listeners.clear();
}
