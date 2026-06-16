"use client";

import { useId } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { VoicePicker } from "@/components/chat/voice-picker";
import {
  DEFAULTS,
  DEFAULT_VOICE_CHARACTER,
  useVoiceSettings,
  type TtsEngine,
  type VoiceCharacter,
  type VoiceCharacterPause,
  type VoiceCharacterSpeed,
  type VoiceCharacterTone,
} from "@/lib/voice-settings-context";
import { getDefaultVoiceId, getVoiceById } from "@/lib/voice-catalog";

/**
 * The CANONICAL voice settings surface — one dialog with every voice-related
 * preference in one place. The third picker surface (after talk-mode header label
 * + Cmd+K palette), and the only one that exposes the full character knobs
 * (speed/tone/pause) since the other two surfaces stay focused on the voice itself.
 *
 * Sections:
 *   - Voice — embeds <VoicePicker mode="inline"> (the same component talk-mode +
 *     palette use, just sans the surrounding Dialog chrome).
 *   - Engine — radio group: Browser (free), Polly Neural (free 12mo), Polly
 *     Generative (premium), Google Chirp 3 HD (permanent free 1M/mo).
 *   - Character — three segmented controls: Speed, Tone, Pause. Drops to defaults
 *     on engines that ignore them (Polly Generative, Google Chirp 3 HD).
 *   - Toggles — read-aloud, captions, mic-enabled, wake-word. Mirrors the palette
 *     toggles but as visible UI rather than an action you have to remember.
 *   - Reset — restore DEFAULTS button (one click, no confirmation — the toggles
 *     are all visible, so accidental resets are recoverable by retoggling).
 *
 * Opened from: a "Voice settings…" command in the Cmd+K palette (added in this
 * commit), and any future "settings cog" affordance.
 */

export type VoiceSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element to return focus to on close (WCAG 2.4.3). */
  getOpener?: () => HTMLElement | null;
};

const ENGINE_LABEL: Record<TtsEngine, string> = {
  browser: "Browser (free)",
  polly: "AWS Polly",
  google: "Google Chirp 3 HD",
};

const ENGINE_HINT: Record<TtsEngine, string> = {
  browser: "Native speechSynthesis. Quality varies by OS.",
  polly: "Polly Neural / Generative — picked per voice. Free tier: 1M chars/mo for 12 months.",
  google: "Permanent free tier: 1M chars/mo. Hedges Polly's 12-month cliff.",
};

const SPEED_OPTIONS: ReadonlyArray<{ value: VoiceCharacterSpeed; label: string }> = [
  { value: "slow", label: "Slow" },
  { value: "natural", label: "Natural" },
  { value: "fast", label: "Fast" },
];

const TONE_OPTIONS: ReadonlyArray<{ value: VoiceCharacterTone; label: string }> = [
  { value: "warm", label: "Warm" },
  { value: "neutral", label: "Neutral" },
  { value: "crisp", label: "Crisp" },
];

const PAUSE_OPTIONS: ReadonlyArray<{ value: VoiceCharacterPause; label: string }> = [
  { value: "spacious", label: "Spacious" },
  { value: "normal", label: "Normal" },
  { value: "tight", label: "Tight" },
];

function SegmentedControl<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  const groupId = useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend
        id={groupId}
        className="text-xs font-medium text-fg"
      >
        {label}
      </legend>
      {description && (
        <p className="text-[11px] text-fg-muted">{description}</p>
      )}
      <div
        role="radiogroup"
        aria-labelledby={groupId}
        className="inline-flex rounded-lg border border-border-strong/60 bg-bg-base p-0.5"
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ${
                active
                  ? "bg-accent text-bg-base"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border border-border-strong/40 bg-bg-base px-3 py-2.5 cursor-pointer hover:border-border-strong">
      <span className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-fg">{label}</span>
        {description && (
          <span className="text-[11px] text-fg-muted">{description}</span>
        )}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-accent"
      />
    </label>
  );
}

export function VoiceSettingsDialog({
  open,
  onOpenChange,
  getOpener,
}: VoiceSettingsDialogProps) {
  const { settings, set } = useVoiceSettings();
  const currentVoiceId = settings.voiceId ?? getDefaultVoiceId();
  const currentVoiceEntry = getVoiceById(currentVoiceId);
  const character = settings.voiceCharacter;

  const characterIgnored =
    settings.ttsEngine === "google" ||
    (settings.ttsEngine === "polly" && currentVoiceEntry?.pollyTier === "generative");

  const reset = () => {
    set({
      micEnabled: DEFAULTS.micEnabled,
      ttsEnabled: DEFAULTS.ttsEnabled,
      wakeWord: DEFAULTS.wakeWord,
      captions: DEFAULTS.captions,
      sttEngine: DEFAULTS.sttEngine,
      ttsEngine: DEFAULTS.ttsEngine,
      voiceId: undefined,
      voiceCharacter: DEFAULT_VOICE_CHARACTER,
    });
  };

  const setCharacter = (patch: Partial<VoiceCharacter>) => {
    set({ voiceCharacter: { ...character, ...patch } });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg-base/85 backdrop-blur-sm" />
        <Dialog.Content
          onCloseAutoFocus={(e) => {
            const opener = getOpener?.();
            if (opener) {
              e.preventDefault();
              opener.focus();
            }
          }}
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,40rem)] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-strong bg-bg-surface p-5 shadow-2xl focus:outline-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 460, damping: 36, mass: 0.7 }}
            className="flex flex-col gap-5"
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-base font-medium text-fg">
                  Voice settings
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-fg-muted">
                  Pick a voice, choose an engine, and tune speed / tone / pause.
                  Defaults are free.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close voice settings"
              >
                <X size={16} aria-hidden="true" />
              </Dialog.Close>
            </header>

            {/* Voice section — picker grid embedded inline. */}
            <section className="flex flex-col gap-2">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
                Voice
              </h3>
              <VoicePicker
                mode="inline"
                currentVoiceId={currentVoiceId}
                onPick={(id) => set({ voiceId: id })}
              />
            </section>

            {/* Engine section — radio buttons. The picker may auto-route by voice
                (Stephen → polly), but this gives explicit control + cost transparency. */}
            <section className="flex flex-col gap-2">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
                Engine
              </h3>
              <div className="flex flex-col gap-1.5">
                {(Object.keys(ENGINE_LABEL) as TtsEngine[]).map((engine) => (
                  <label
                    key={engine}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                      settings.ttsEngine === engine
                        ? "border-accent bg-accent/5"
                        : "border-border-strong/40 bg-bg-base hover:border-border-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tts-engine"
                      value={engine}
                      checked={settings.ttsEngine === engine}
                      onChange={() => set({ ttsEngine: engine })}
                      className="mt-1 cursor-pointer accent-accent"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-fg">{ENGINE_LABEL[engine]}</span>
                      <span className="text-[11px] text-fg-muted">{ENGINE_HINT[engine]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* Character section — segmented controls. Disabled-style hint when the
                active engine ignores prosody. */}
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
                  Character
                </h3>
                {characterIgnored && (
                  <p className="text-[10px] text-fg-subtle">
                    The active engine ignores these knobs.
                  </p>
                )}
              </div>
              <div
                className={`flex flex-col gap-3 ${characterIgnored ? "opacity-50" : ""}`}
                aria-disabled={characterIgnored}
              >
                <SegmentedControl
                  label="Speed"
                  description="How fast the voice reads."
                  options={SPEED_OPTIONS}
                  value={character.speed}
                  onChange={(next) => setCharacter({ speed: next })}
                />
                <SegmentedControl
                  label="Tone"
                  description="Pitch bias — warmer (lower) or crisper (higher)."
                  options={TONE_OPTIONS}
                  value={character.tone}
                  onChange={(next) => setCharacter({ tone: next })}
                />
                <SegmentedControl
                  label="Pause"
                  description="How much breathing room between sentences."
                  options={PAUSE_OPTIONS}
                  value={character.pause}
                  onChange={(next) => setCharacter({ pause: next })}
                />
              </div>
            </section>

            {/* Toggles section — mirrors the palette commands as persistent UI. */}
            <section className="flex flex-col gap-2">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-fg-muted">
                Toggles
              </h3>
              <div className="flex flex-col gap-1.5">
                <ToggleRow
                  label="Read answers aloud"
                  description="Show a Listen button under each answer; speak in talk mode."
                  checked={settings.ttsEnabled}
                  onChange={(next) => set({ ttsEnabled: next })}
                />
                <ToggleRow
                  label="Show captions in talk mode"
                  description="Live transcript of the spoken answer (a11y default ON)."
                  checked={settings.captions}
                  onChange={(next) => set({ captions: next })}
                />
                <ToggleRow
                  label="Show push-to-talk mic"
                  description="Mic button in the chat composer."
                  checked={settings.micEnabled}
                  onChange={(next) => set({ micEnabled: next })}
                />
                <ToggleRow
                  label="Wake word — Hey portfolio"
                  description="Hands-free activation. Highest trust cost (always-listening)."
                  checked={settings.wakeWord}
                  onChange={(next) => set({ wakeWord: next })}
                />
              </div>
            </section>

            <footer className="flex items-center justify-between border-t border-border-strong/40 pt-4">
              <button
                type="button"
                onClick={reset}
                className="text-xs text-fg-muted underline decoration-dotted underline-offset-4 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
              >
                Reset to defaults
              </button>
              <Dialog.Close className="rounded-md border border-border-strong/60 bg-bg-base px-3 py-1.5 text-xs text-fg hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                Done
              </Dialog.Close>
            </footer>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
