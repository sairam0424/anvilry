"use client";

import { useSyncExternalStore } from "react";
import { AudioLines } from "lucide-react";
import { openTalkMode } from "@/components/chat/talk-overlay-store";
import { useVoiceSettings } from "@/lib/voice-settings-context";

// SSR-safe STT support flag (no setState-in-effect; matches use-mounted idiom). The
// talk loop needs recognition; TTS alone isn't enough, so we gate on SpeechRecognition.
const noopSubscribe = () => () => {};
const getSttClient = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
const getSttServer = () => false;

/**
 * "Talk" entry point for the Chat view. Opens the shared modal talk-mode overlay (a
 * single instance mounted in the layout via TalkModeMount) through the module store,
 * passing itself as the focus-restore target. Renders only when (a) the browser
 * supports speech recognition AND (b) talkSurface is "modal" (the default) — when the
 * 5th-view surface is selected, the ViewSwitcher handles entry instead, so this button
 * steps aside to avoid two doors to one mode.
 */
export function TalkLaunchButton() {
  const { settings } = useVoiceSettings();
  const supported = useSyncExternalStore(noopSubscribe, getSttClient, getSttServer);

  if (!supported || settings.talkSurface !== "modal") return null;

  return (
    <button
      type="button"
      onClick={(e) => openTalkMode(e.currentTarget)}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <AudioLines size={14} aria-hidden="true" />
      Talk
    </button>
  );
}
