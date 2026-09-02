"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { TerminalSquare } from "lucide-react";

// The palette's guts (cmdk, Radix dialog, voice picker/settings, and the
// content-corpus-backed action lists) are ~140KB and only ever needed after
// the first ⌘K / click — kept off the initial bundle the same way
// ask-portfolio.tsx keeps its markdown renderer off the initial bundle.
const CommandPaletteContent = dynamic(
  () =>
    import("@/components/command-palette-content").then(
      (m) => m.CommandPaletteContent,
    ),
  { ssr: false },
);

type CommandPaletteProps = {
  discoveryBadgesEnabled: boolean;
};

export function CommandPalette({
  discoveryBadgesEnabled,
}: CommandPaletteProps) {
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // This listener is the whole reason the shell stays mounted eagerly: most
  // ⌘K presses happen before the user has ever clicked the trigger pill.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setLoaded(true);
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Trigger pill — bottom-right, terminal-styled */}
      <button
        ref={triggerRef}
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
        aria-label="Open command palette"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-lg border border-border-strong bg-bg-surface/90 px-3 py-2 font-mono text-xs text-fg-muted shadow-lg backdrop-blur transition-colors hover:border-accent hover:text-fg"
      >
        <TerminalSquare size={14} className="text-accent" />
        <span className="hidden sm:inline">Command</span>
        <kbd className="rounded bg-bg-elevated px-1.5 py-0.5 text-[10px]">
          ⌘K
        </kbd>
      </button>

      {/* Mounted once loaded and left mounted (never unmounted again) so its
          own open/close state, recents, and dialogs behave exactly as if it
          had been here from the start. */}
      {loaded && (
        <CommandPaletteContent
          discoveryBadgesEnabled={discoveryBadgesEnabled}
          open={open}
          onOpenChange={setOpen}
          triggerRef={triggerRef}
        />
      )}
    </>
  );
}
