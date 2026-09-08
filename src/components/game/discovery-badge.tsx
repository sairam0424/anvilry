"use client";

import { useDiscoveries, DISCOVERY_TOTAL } from "@/lib/discovery-store";

/**
 * Floating discovery progress badge — shows "★ N/5 discovered" in the bottom-right
 * when the visitor has unlocked at least 1 of the 5 exploration moments.
 *
 * Design choices:
 * - Hidden until the first discovery (no badge on first visit = no clutter).
 * - Pure text — no lock icons or gamification language that could feel pressuring.
 * - z-30 sits below the command palette trigger (z-40); the AskPortfolio widget
 *   lives on the opposite corner (left-5) so it never competes for this spot.
 * - Positioned directly above the command-palette trigger button instead of
 *   sharing its exact spot. The trigger's rendered height is ~34px: 1rem (16px)
 *   line-height from its text-xs/kbd content + 1rem (16px) of py-2 vertical
 *   padding + 2px border. Stacks 46px above the trigger (its height + a 12px
 *   clearance gap) at whatever offset the trigger itself uses — matches
 *   command-palette.tsx's own responsive offset (`bottom-20` below `sm`, to
 *   clear the chat composer's Send button; `sm:bottom-5` above it). Drifting
 *   out of sync with that offset is exactly the bug this fixes: the trigger
 *   moved to bottom-20 on mobile in #210 and this badge didn't move with it,
 *   so it started rendering *below* the trigger instead of above it.
 * - Gate: NEXT_PUBLIC_DISCOVERY_BADGES=true (default OFF).
 *
 * The 5 discovery keys are wired in their respective source files:
 *   view-switch     → view-context.tsx setViewInternal()
 *   chat-question   → chat-messages.tsx first user message
 *   terminal-command→ use-terminal.ts first run()
 *   konami          → easter-eggs.tsx Konami sequence
 *   dossier-open    → dossier-card.tsx Link click
 */
export function DiscoveryBadge() {
  const discovered = useDiscoveries();
  const count = discovered.size;

  if (count === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${count} of ${DISCOVERY_TOTAL} site areas discovered`}
      className="fixed bottom-[calc(5rem+46px)] right-5 z-30 rounded-full border border-accent/30 bg-bg-surface/90 px-3 py-1.5 font-mono text-xs text-accent backdrop-blur sm:bottom-[calc(1.25rem+46px)]"
    >
      ★ {count}/{DISCOVERY_TOTAL} discovered
    </div>
  );
}
