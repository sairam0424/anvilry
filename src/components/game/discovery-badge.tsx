"use client";

import { useDiscoveries, DISCOVERY_TOTAL } from "@/lib/discovery-store";

/**
 * Floating discovery progress badge — shows "★ N/5 discovered" in the bottom-right
 * when the visitor has unlocked at least 1 of the 5 exploration moments.
 *
 * Design choices:
 * - Hidden until the first discovery (no badge on first visit = no clutter).
 * - Pure text — no lock icons or gamification language that could feel pressuring.
 * - z-30 sits below the command palette (z-50) and the AskPortfolio widget (z-40).
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
      className="fixed bottom-5 right-5 z-30 rounded-full border border-accent/30 bg-bg-surface/90 px-3 py-1.5 font-mono text-xs text-accent backdrop-blur"
    >
      ★ {count}/{DISCOVERY_TOTAL} discovered
    </div>
  );
}
