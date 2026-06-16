"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { Volume2, X } from "lucide-react";
import {
  CURATED_VOICES,
  EXTENDED_VOICES,
  getVoiceById,
  type VoiceEntry,
} from "@/lib/voice-catalog";
import { VOICE_PICKER_MODE } from "@/lib/voice-picker-mode";
import { useSpeechSynthesis } from "@/components/chat/use-speech-synthesis";
import {
  applePremiumIsMissing,
  getVoicesRaceHardened,
} from "@/components/chat/voice-pitfalls";

/**
 * Shared voice-picker UI. Mounted in three surfaces (talk-mode header, Cmd+K
 * palette, settings dialog) — same component, same data, same preview lifecycle.
 *
 * Two layout modes, switchable via NEXT_PUBLIC_VOICE_PICKER_MODE:
 *   - descriptor (DEFAULT) — modern named cards with 2-word descriptors. Six
 *     curated voices in a responsive grid. The ChatGPT/Siri pattern.
 *   - gender — explicit Male / Female columns, cards stacked under each gender.
 *     The same six voices, regrouped.
 *
 * The two modes share data — only the rendered grouping differs — so adding a
 * new curated voice doesn't need code changes in both places.
 *
 * Tap-to-preview: each card has a play button that speaks the entry's
 * sampleText via the engine the voice belongs to. Only ONE preview plays at a
 * time — tapping a different card cancels the prior. cancel() runs on unmount
 * + on dialog close so a half-played preview never leaks into the chat session.
 *
 * "More voices…" overflow opens a nested Radix Dialog with the EXTENDED_VOICES
 * catalog (~12 entries grouped by engine). Same preview lifecycle, same picker
 * callback.
 *
 * a11y: aria-pressed reflects current voice; aria-live announces "Playing
 * preview: Stephen"; Esc closes (when mode='dialog'); outside-click closes;
 * keyboard navigation is handled by Radix Dialog's natural tab order.
 */

export type VoicePickerProps = {
  /** Catalog id of the currently-picked voice (highlights its card). */
  currentVoiceId?: string;
  /** Called with the catalog id when the user picks a voice. */
  onPick: (voiceId: string) => void;
  /** "inline" mounts the picker grid as a flat block (for embedding in settings).
   *  "dialog" wraps it in a Radix Dialog (for talk-mode header / palette entry). */
  mode?: "inline" | "dialog";
  /** Dialog mode only: external open/close control. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Dialog mode only: the element to return focus to on close (WCAG 2.4.3). */
  getOpener?: () => HTMLElement | null;
};

/* --------------------------------- Card UI -------------------------------- */

function VoiceCard({
  entry,
  isCurrent,
  isPreviewing,
  applePremiumMissing,
  onPick,
  onPreview,
}: {
  entry: VoiceEntry;
  isCurrent: boolean;
  isPreviewing: boolean;
  /** When true, the curated Apple Premium voice this card references is not on
   *  disk — show a "download in System Settings" hint (pitfall #6). Only set
   *  for `engine: "browser"` entries with an Apple Premium URI prefix. */
  applePremiumMissing: boolean;
  onPick: (id: string) => void;
  onPreview: (entry: VoiceEntry) => void;
}) {
  return (
    <div
      className={`group relative flex flex-col gap-2 rounded-xl border px-4 py-3 transition-colors ${
        isCurrent
          ? "border-accent bg-accent/5"
          : "border-border-strong/60 bg-bg-surface hover:border-border-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onPick(entry.id)}
          aria-pressed={isCurrent}
          aria-label={`Pick voice ${entry.displayName}`}
          className="flex flex-1 flex-col items-start gap-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface rounded-md"
        >
          <span className="text-sm font-medium text-fg">{entry.displayName}</span>
          <span className="text-xs text-fg-muted">{entry.descriptor}</span>
        </button>
        <button
          type="button"
          onClick={() => onPreview(entry)}
          aria-pressed={isPreviewing}
          aria-label={`Preview voice ${entry.displayName}`}
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface ${
            isPreviewing
              ? "border-accent bg-accent text-bg-base"
              : "border-border-strong/60 bg-bg-base text-fg-muted hover:border-border-strong hover:text-fg"
          }`}
        >
          <Volume2 size={14} aria-hidden="true" />
        </button>
      </div>
      {/* Accent badge: e.g. "US · Polly Generative" — small contextual cue
          that doesn't compete with name + descriptor for attention. */}
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-muted">
        <span>{accentLabel(entry)}</span>
        <span aria-hidden="true">·</span>
        <span>{engineLabel(entry)}</span>
      </div>
      {applePremiumMissing && (
        <p className="text-[10px] leading-snug text-fg-subtle">
          ⚠ Download this Apple Premium voice in macOS Settings → Accessibility →
          Spoken Content → Voices.
        </p>
      )}
    </div>
  );
}

function accentLabel(entry: VoiceEntry): string {
  switch (entry.accent) {
    case "us":
      return "US";
    case "gb":
      return "UK";
    case "au":
      return "AU";
    case "in":
      return "IN";
    default:
      return entry.accent;
  }
}

function engineLabel(entry: VoiceEntry): string {
  if (entry.engine === "polly") {
    return entry.pollyTier === "generative" ? "Polly Generative" : "Polly Neural";
  }
  if (entry.engine === "google") return "Google Chirp 3";
  return "Browser";
}

/* ---------------------------- Layout primitives ---------------------------- */

type GridProps = {
  voices: ReadonlyArray<VoiceEntry>;
  currentVoiceId?: string;
  previewingId: string | null;
  /** Voices in window.speechSynthesis.getVoices() — drives the Apple Premium
   *  download hint (pitfall #6). Empty array on SSR / before voices load. */
  browserVoices: ReadonlyArray<{ voiceURI: string }>;
  onPick: (id: string) => void;
  onPreview: (entry: VoiceEntry) => void;
};

function DescriptorGrid({
  voices,
  currentVoiceId,
  previewingId,
  browserVoices,
  onPick,
  onPreview,
}: GridProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {voices.map((v) => (
        <VoiceCard
          key={v.id}
          entry={v}
          isCurrent={v.id === currentVoiceId}
          isPreviewing={v.id === previewingId}
          applePremiumMissing={applePremiumIsMissing(v.browserVoiceURIPrefix, browserVoices)}
          onPick={onPick}
          onPreview={onPreview}
        />
      ))}
    </div>
  );
}

function GenderColumns({
  voices,
  currentVoiceId,
  previewingId,
  browserVoices,
  onPick,
  onPreview,
}: GridProps) {
  const female = voices.filter((v) => v.gender === "female");
  const male = voices.filter((v) => v.gender === "male");
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ColumnSection
        label="Female"
        voices={female}
        currentVoiceId={currentVoiceId}
        previewingId={previewingId}
        browserVoices={browserVoices}
        onPick={onPick}
        onPreview={onPreview}
      />
      <ColumnSection
        label="Male"
        voices={male}
        currentVoiceId={currentVoiceId}
        previewingId={previewingId}
        browserVoices={browserVoices}
        onPick={onPick}
        onPreview={onPreview}
      />
    </div>
  );
}

function ColumnSection({
  label,
  voices,
  currentVoiceId,
  previewingId,
  browserVoices,
  onPick,
  onPreview,
}: GridProps & { label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-mono uppercase tracking-widest text-fg-muted">
        {label}
      </div>
      <div className="flex flex-col gap-2">
        {voices.map((v) => (
          <VoiceCard
            key={v.id}
            entry={v}
            isCurrent={v.id === currentVoiceId}
            isPreviewing={v.id === previewingId}
            applePremiumMissing={applePremiumIsMissing(v.browserVoiceURIPrefix, browserVoices)}
            onPick={onPick}
            onPreview={onPreview}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- Picker body ------------------------------- */

function PickerBody({
  currentVoiceId,
  onPick,
  showOverflowButton,
}: {
  currentVoiceId?: string;
  onPick: (id: string) => void;
  showOverflowButton: boolean;
}) {
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // Browser voice list — race-hardened load (sync read + voiceschanged + 2s
  // timeout). Used to flip the Apple Premium "download in System Settings"
  // hint per card. Empty until loaded; the hint then resolves correctly.
  const [browserVoices, setBrowserVoices] = useState<ReadonlyArray<SpeechSynthesisVoice>>([]);
  useEffect(() => {
    let cancelled = false;
    void getVoicesRaceHardened().then((list) => {
      if (!cancelled) setBrowserVoices(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Two preview hooks so the curated grid + the overflow dialog can each have
  // their own engine binding (the catalog tells us which engine to use per
  // voice). Engine-string is updated per click via the `engine` arg below.
  // Single hook + dynamic engine: useSpeechSynthesis already accepts the engine
  // at render-time, so we re-render the hook with the new engine when a preview
  // starts. Implemented via a state-tracked "active preview engine" so the same
  // hook instance flips engines (the hook handles cancel-on-rerender via its
  // visibilitychange + cancel cleanup).
  const [previewEngine, setPreviewEngine] = useState<VoiceEntry["engine"]>("browser");
  const [previewVoiceId, setPreviewVoiceId] = useState<string | undefined>(undefined);
  const tts = useSpeechSynthesis({ engine: previewEngine, voiceId: previewVoiceId });
  const ttsRef = useRef(tts);
  useEffect(() => {
    ttsRef.current = tts;
  }, [tts]);

  // Clear the "now previewing" indicator once playback ends naturally. The
  // hook's isSpeaking falls back to false when the engine drains.
  useEffect(() => {
    if (!tts.isSpeaking && previewingId !== null) {
      // Tiny defer so the indicator doesn't flicker between sentences.
      const t = setTimeout(() => setPreviewingId(null), 250);
      return () => clearTimeout(t);
    }
  }, [tts.isSpeaking, previewingId]);

  // Cancel any in-flight preview on unmount (route change, dialog close, etc.).
  useEffect(() => {
    const localTts = ttsRef.current;
    return () => {
      localTts.cancel();
    };
  }, []);

  const handlePreview = useCallback((entry: VoiceEntry) => {
    // If this card is already previewing, treat the second tap as Stop.
    setPreviewingId((curr) => {
      if (curr === entry.id) {
        ttsRef.current.cancel();
        setAnnouncement(`Stopped preview: ${entry.displayName}`);
        return null;
      }
      // Switch engine + voice, then speak. The hook re-renders on the new options.
      ttsRef.current.cancel();
      setPreviewEngine(entry.engine);
      setPreviewVoiceId(entry.id);
      setAnnouncement(`Playing preview: ${entry.displayName}`);
      // Defer speak() so the hook has a chance to re-render with the new engine.
      // (The new TTS instance from the next render will be the one that speaks.)
      queueMicrotask(() => {
        ttsRef.current.speak(entry.sampleText);
      });
      return entry.id;
    });
  }, []);

  const Layout = VOICE_PICKER_MODE === "gender" ? GenderColumns : DescriptorGrid;

  return (
    <div className="flex flex-col gap-3">
      {/* sr-only live region for AT (WCAG 4.1.3): announces preview start/stop. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <Layout
        voices={CURATED_VOICES}
        currentVoiceId={currentVoiceId}
        previewingId={previewingId}
        browserVoices={browserVoices}
        onPick={onPick}
        onPreview={handlePreview}
      />

      {showOverflowButton && (
        <Dialog.Root open={overflowOpen} onOpenChange={setOverflowOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="self-start text-xs text-accent underline decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface rounded-sm"
            >
              More voices…
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[60] bg-bg-base/85 backdrop-blur-sm" />
            <Dialog.Content
              aria-describedby={undefined}
              className="fixed left-1/2 top-1/2 z-[60] w-[min(92vw,40rem)] max-h-[80vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-strong bg-bg-surface p-5 shadow-2xl focus:outline-none"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <Dialog.Title className="text-base font-medium text-fg">
                    More voices
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-xs text-fg-muted">
                    Extended catalog including UK + Australian accents and
                    browser-native premium voices.
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Close more voices"
                >
                  <X size={16} aria-hidden="true" />
                </Dialog.Close>
              </div>
              <DescriptorGrid
                voices={EXTENDED_VOICES}
                currentVoiceId={currentVoiceId}
                previewingId={previewingId}
                browserVoices={browserVoices}
                onPick={(id) => {
                  onPick(id);
                  setOverflowOpen(false);
                }}
                onPreview={handlePreview}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}

/* --------------------------------- Surface --------------------------------- */

export function VoicePicker(props: VoicePickerProps) {
  const { mode = "inline", open, onOpenChange, getOpener, currentVoiceId, onPick } = props;

  if (mode === "inline") {
    return (
      <PickerBody currentVoiceId={currentVoiceId} onPick={onPick} showOverflowButton />
    );
  }

  // Dialog mode: wrap the body in Radix Dialog with focus restore + Esc + outside-click.
  return (
    <Dialog.Root open={open ?? false} onOpenChange={onOpenChange}>
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
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,32rem)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border-strong bg-bg-surface p-5 shadow-2xl focus:outline-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 460, damping: 36, mass: 0.7 }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-base font-medium text-fg">
                  Pick a voice
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-fg-muted">
                  {currentVoiceId
                    ? `Current: ${getVoiceById(currentVoiceId)?.displayName ?? "default"}.`
                    : "Pick a voice for read-aloud and talk mode."}
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-bg-elevated hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close voice picker"
              >
                <X size={16} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <PickerBody
              currentVoiceId={currentVoiceId}
              onPick={(id) => {
                onPick(id);
                onOpenChange?.(false);
              }}
              showOverflowButton
            />
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
