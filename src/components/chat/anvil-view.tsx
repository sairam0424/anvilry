"use client";

import { profile } from "@/lib/profile";
import { TalkMode } from "@/components/chat/talk-mode";
import { ViewEscapeHatch } from "@/components/view-escape-hatch";

/**
 * The "Anvil" voice view — the first-class home for two-way voice (the 5th switcher
 * entry, ?view=voice). It is a LEAN voice-specific hero (deliberately NOT a second
 * concierge console like Chat): a brand line + example-prompt chips that solve "what do
 * I say?", wrapped AROUND the shared TalkMode (orb + live captions + controls). The
 * chips are passed into TalkMode so they drive its OWN useVoiceSession seam — one
 * transcript, one mic. Closing returns to Classic (the view-router unmounts this,
 * tearing the voice session + mic down).
 *
 * "Anvil" names the SURFACE, not a separate character: the assistant still answers in
 * the first person as Sairam, grounded in the real corpus.
 */

// Recruiter-oriented openers. Each is asked by voice on click (a user gesture). Where
// STT is unsupported, TalkMode renders its own "type instead" fallback and the chips are
// hidden (they'd have no session to drive).
const PROMPTS: readonly string[] = [
  "What are you looking for in your next role?",
  "Walk me through your strongest project",
  "Tell me about your GenAI and agent work",
  "What did you build at Ascendion?",
];

export function AnvilView({ onClose }: { onClose: () => void }) {
  const firstName = profile.name.split(" ")[0];
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-3xl flex-col px-6 py-6">
      <div className="mb-4">
        <ViewEscapeHatch />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <header className="max-w-xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-accent">{"// anvil"}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Talk to Anvil — the voice of {firstName}&apos;s work
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            Ask out loud and hear it answer back. Grounded in real projects and production
            systems; answers in the first person and never invents details. You can always
            type instead.
          </p>
        </header>

        {/* The shared voice surface — orb, live captions, controls — plus the Anvil
            example-prompt chips driven through its own session. */}
        <TalkMode onClose={onClose} prompts={PROMPTS} />

        <p className="max-w-md text-center text-[11px] text-fg-subtle">
          Open to new roles in GenAI &amp; backend engineering ·{" "}
          <a href={`mailto:${profile.email}`} className="text-fg-muted hover:text-accent">
            {profile.email}
          </a>
        </p>
      </div>
    </main>
  );
}
