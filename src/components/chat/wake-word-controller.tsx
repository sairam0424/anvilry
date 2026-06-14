"use client";

import { useEffect, useState } from "react";
import { Ear, X } from "lucide-react";
import { useWakeWord } from "@/components/chat/use-wake-word";
import { useVoiceSettings } from "@/lib/voice-settings-context";
import { useView } from "@/components/view-context";
import { openTalkMode } from "@/components/chat/talk-overlay-store";

/**
 * Drives the opt-in wake word and renders its REQUIRED trust surface: a persistent,
 * unmistakable "Listening" banner with a one-tap kill whenever it's active. Mounted
 * once globally but SCOPED to the Chat/voice views — the mic is never live on Classic.
 *
 * Trust guarantees (non-negotiable for a recruiter-facing site):
 *  - off by default (the wakeWord pref starts false);
 *  - the banner is ALWAYS visible while listening (never a hidden hot mic);
 *  - one tap on the banner's Stop disarms the engine AND releases the mic;
 *  - leaving the Chat/voice view (or disabling the pref) disarms immediately.
 * On detection it opens the two-way talk mode.
 */

const ACTIVE_VIEWS = new Set(["chat", "voice"]);

export function WakeWordController() {
  const { settings, toggle, set } = useVoiceSettings();
  const { view } = useView();
  const { supported, listening, arm, disarm } = useWakeWord();
  // First-enable disclosure gate: the pref flips on (via the palette), but we don't
  // arm the mic until the visitor accepts the cloud-audio notice. `accepted` is local
  // (session) — re-enabling in a later session discloses again, which is the safe
  // default for an always-listening feature.
  const [accepted, setAccepted] = useState(false);

  // `accepted` only gates arming while the pref is on; when the pref is off we treat
  // acceptance as false regardless of the stored flag (so re-enabling discloses again)
  // — derived here rather than reset in an effect.
  const effectiveAccepted = settings.wakeWord && accepted;
  const wantsOn = settings.wakeWord && supported && ACTIVE_VIEWS.has(view);
  const shouldListen = wantsOn && effectiveAccepted;
  const showDisclosure = wantsOn && !effectiveAccepted;

  useEffect(() => {
    // openTalkMode is a stable module fn — no ref needed.
    if (shouldListen) arm(() => openTalkMode());
    else disarm();
    return () => disarm();
  }, [shouldListen, arm, disarm]);

  const cancel = () => {
    setAccepted(false);
    set({ wakeWord: false });
  };

  const stopListening = () => {
    setAccepted(false);
    toggle("wakeWord");
  };

  if (showDisclosure) {
    return (
      <div
        role="dialog"
        aria-label="Enable wake word"
        className="fixed bottom-5 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2 rounded-2xl border border-border-strong bg-bg-surface p-4 shadow-2xl backdrop-blur"
      >
        <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
          <Ear size={15} className="text-accent" aria-hidden="true" />
          Always-listen for &ldquo;Hey portfolio&rdquo;?
        </p>
        <p className="mt-2 text-xs leading-relaxed text-fg-muted">
          While on, your microphone stays active on this view and your browser
          (Chrome/Safari) streams the audio to its speech service to detect the phrase.
          Nothing is recorded or stored here. A &ldquo;Listening&rdquo; bar stays
          visible the whole time, and you can stop with one tap.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            className="rounded-lg px-3 py-1.5 text-xs text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setAccepted(true)}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-bg-base transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Enable listening
          </button>
        </div>
      </div>
    );
  }

  if (!listening) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-accent/50 bg-bg-surface/95 px-4 py-2.5 shadow-2xl backdrop-blur"
    >
      {/* Non-color-only live indicator: a pulsing dot + an ear icon + text. */}
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
      </span>
      <Ear size={15} className="text-accent" aria-hidden="true" />
      <span className="text-xs text-fg">
        Listening for &ldquo;Hey portfolio&rdquo;
      </span>
      <button
        type="button"
        onClick={stopListening}
        aria-label="Stop listening for the wake word"
        className="ml-1 inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X size={12} aria-hidden="true" />
        Stop
      </button>
    </div>
  );
}
