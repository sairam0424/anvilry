"use client";

import { ArrowDown } from "lucide-react";

/**
 * "Jump to latest" pill — the visible resume control for the autoscroll state machine.
 * Shown only when the user has scrolled away from the follow position (`show`). This is
 * the WCAG 2.2.2 (Pause, Stop, Hide — Level A) mechanism for the auto-updating
 * transcript: de-pin-on-scroll-up lets the user pause the follow, and this control
 * resumes it.
 *
 * Presentational only — visibility and the snap are owned by the autoscroll hook. The
 * caller passes `onClick` (which calls scrollToBottom() and then moves focus back to
 * the transcript/input). Positioned by the parent (the parent is `relative`); this
 * renders centered above the composer with a target size >= 44px (2.5.8 AA) and a
 * visible focus ring (2.4.7). Reduced-motion is handled in the hook's snap (instant).
 */
export function JumpToLatest({
  show,
  onClick,
  label = "Jump to latest",
}: {
  show: boolean;
  onClick: () => void;
  label?: string;
}) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-1 z-10 flex -translate-y-full justify-center">
      <button
        type="button"
        onClick={onClick}
        className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong bg-bg-surface/95 px-4 text-xs font-medium text-fg shadow-lg backdrop-blur transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base"
      >
        <ArrowDown size={14} className="text-accent" aria-hidden="true" />
        {label}
      </button>
    </div>
  );
}
