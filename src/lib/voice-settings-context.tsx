"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getVoiceById } from "@/lib/voice-catalog";

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
/** Which engine powers text-to-speech. `browser` = free speechSynthesis (default).
 *  `google` is the permanent-free hedge against Polly's 12-month free-tier cliff. */
export type TtsEngine = "browser" | "polly" | "google";
/** Where two-way talk mode mounts. `modal` overlay (default) or a 5th `view`. */
export type TalkSurface = "modal" | "view";

/** Cross-engine voice character knobs. Mapped to engine-native parameters by the
 *  TTS hook: `speed`→ rate / Polly Neural <prosody rate>; `tone` → pitch / Polly
 *  Neural <prosody pitch>; `pause` → sentence padding / Polly Neural <break time>.
 *  Polly Generative + Google Chirp 3 HD reject most prosody tags, so the hook
 *  drops these knobs on those engines (the catalog still resolves the voice). */
export type VoiceCharacterSpeed = "slow" | "natural" | "fast";
export type VoiceCharacterTone = "warm" | "neutral" | "crisp";
export type VoiceCharacterPause = "spacious" | "normal" | "tight";

export type VoiceCharacter = {
  speed: VoiceCharacterSpeed;
  tone: VoiceCharacterTone;
  pause: VoiceCharacterPause;
};

export type VoiceSettings = {
  /** Show the push-to-talk mic button in the composer. */
  micEnabled: boolean;
  /** Allow per-answer "read aloud" + spoken talk-mode output. */
  ttsEnabled: boolean;
  /** Always-listening wake word ("Hey portfolio"). Off by default — highest trust cost. */
  wakeWord: boolean;
  /** Show the live caption (spoken-text transcript) in talk mode. Default ON (a11y). */
  captions: boolean;
  sttEngine: SttEngine;
  ttsEngine: TtsEngine;
  talkSurface: TalkSurface;
  /** Catalog id of the user-picked voice (e.g. "polly-neural-joanna"). When undefined
   *  the runtime resolves to getDefaultVoiceId() in the catalog — this lets a stored
   *  payload from v1.6 (which lacked the field) upgrade cleanly without migration,
   *  AND lets a never-picked visitor stay on the engine default forever. The picker
   *  UI writes this field; nothing else does. */
  voiceId?: string;
  /** Cross-engine voice character. Defaults to {natural, neutral, normal} — the
   *  baseline that matches v1.6 hardcoded rate=1, pitch=1, no padding. */
  voiceCharacter: VoiceCharacter;
};

export const DEFAULT_VOICE_CHARACTER: VoiceCharacter = {
  speed: "natural",
  tone: "neutral",
  pause: "normal",
};

const DEFAULTS: VoiceSettings = {
  micEnabled: false,
  ttsEnabled: false,
  wakeWord: false,
  captions: true,
  sttEngine: "browser",
  ttsEngine: "browser",
  talkSurface: "modal",
  // voiceId intentionally omitted — undefined means "use catalog default at point
  // of use", which preserves v1.6 behavior for legacy localStorage payloads.
  voiceCharacter: DEFAULT_VOICE_CHARACTER,
};

const STORAGE_KEY = "anvilry:voice:settings";

const isSttEngine = (v: unknown): v is SttEngine => v === "browser" || v === "transcribe";
const isTtsEngine = (v: unknown): v is TtsEngine =>
  v === "browser" || v === "polly" || v === "google";
const isTalkSurface = (v: unknown): v is TalkSurface => v === "modal" || v === "view";
const isSpeed = (v: unknown): v is VoiceCharacterSpeed =>
  v === "slow" || v === "natural" || v === "fast";
const isTone = (v: unknown): v is VoiceCharacterTone =>
  v === "warm" || v === "neutral" || v === "crisp";
const isPause = (v: unknown): v is VoiceCharacterPause =>
  v === "spacious" || v === "normal" || v === "tight";

function parseVoiceCharacter(o: unknown): VoiceCharacter {
  if (!o || typeof o !== "object") return DEFAULT_VOICE_CHARACTER;
  const c = o as Partial<Record<keyof VoiceCharacter, unknown>>;
  return {
    speed: isSpeed(c.speed) ? c.speed : DEFAULT_VOICE_CHARACTER.speed,
    tone: isTone(c.tone) ? c.tone : DEFAULT_VOICE_CHARACTER.tone,
    pause: isPause(c.pause) ? c.pause : DEFAULT_VOICE_CHARACTER.pause,
  };
}

/** Reasonable safety bounds: catalog ids are kebab-case alphanumeric of the form
 *  `{engine}-{tier}-{name}`, none longer than ~40 chars; bound at 64 to leave headroom
 *  while rejecting any pathologically-long localStorage payload (defense-in-depth —
 *  the picker writes catalog ids, never user-typed strings). */
const isVoiceId = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length < 64;

/**
 * Parse the persisted blob into a fully-valid settings object. Unknown/missing keys
 * fall back to DEFAULTS field-by-field, so a partial or older payload (e.g. before a
 * new toggle existed) upgrades cleanly instead of throwing.
 *
 * v1.6 payloads (no voiceId, no voiceCharacter) upgrade to: voiceId stays undefined
 * (point-of-use resolves to catalog default), voiceCharacter falls back to
 * DEFAULT_VOICE_CHARACTER (matches v1.6 hardcoded rate=1, pitch=1, no padding).
 */
function parse(raw: string | null): VoiceSettings {
  if (!raw) return DEFAULTS;
  try {
    const o = JSON.parse(raw) as Partial<Record<keyof VoiceSettings, unknown>>;
    return {
      micEnabled: typeof o.micEnabled === "boolean" ? o.micEnabled : DEFAULTS.micEnabled,
      ttsEnabled: typeof o.ttsEnabled === "boolean" ? o.ttsEnabled : DEFAULTS.ttsEnabled,
      wakeWord: typeof o.wakeWord === "boolean" ? o.wakeWord : DEFAULTS.wakeWord,
      captions: typeof o.captions === "boolean" ? o.captions : DEFAULTS.captions,
      sttEngine: isSttEngine(o.sttEngine) ? o.sttEngine : DEFAULTS.sttEngine,
      // If a voiceId is stored, reconcile ttsEngine with it: a mismatch means the
      // user previously selected a voice via the picker before the picker synced
      // the engine (the bug existed in talk-mode.tsx v1.7). Reconcile silently so
      // returning visitors get a working engine without having to re-pick.
      ttsEngine: (() => {
        const rawEngine = isTtsEngine(o.ttsEngine) ? o.ttsEngine : DEFAULTS.ttsEngine;
        if (!isVoiceId(o.voiceId)) return rawEngine;
        const entry = getVoiceById(o.voiceId as string);
        return entry ? entry.engine : rawEngine;
      })(),
      talkSurface: isTalkSurface(o.talkSurface) ? o.talkSurface : DEFAULTS.talkSurface,
      // voiceId is optional. Invalid/missing → undefined (NOT a catalog default —
      // that resolves at point of use, so a future picker pick takes over cleanly).
      ...(isVoiceId(o.voiceId) ? { voiceId: o.voiceId } : {}),
      voiceCharacter: parseVoiceCharacter(o.voiceCharacter),
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
  toggle: (key: "micEnabled" | "ttsEnabled" | "wakeWord" | "captions") => void;
} {
  const settings = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const set = useCallback((patch: Partial<VoiceSettings>) => update(patch), []);
  const toggle = useCallback(
    (key: "micEnabled" | "ttsEnabled" | "wakeWord" | "captions") =>
      update({ [key]: !current[key] }),
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
