"use client";

import { motion } from "motion/react";
import { LayoutGrid, Gamepad2, MessagesSquare, TerminalSquare, AudioLines } from "lucide-react";
import { useView, type View } from "@/components/view-context";
import { useMounted } from "@/lib/use-mounted";
import { isViewEnabled } from "@/lib/enabled-views";
import { cn } from "@/lib/utils";

/**
 * Segmented control to switch the top-level experience. Text-labelled (not
 * icon-only) and aria-pressed per WCAG; the active pill slides via a shared
 * layoutId, which MotionConfig reducedMotion='user' auto-disables for users with
 * OS reduce-motion on. Used in the nav (full) and as a compact pill on mobile.
 */
const OPTIONS: { view: View; label: string; short: string; icon: typeof LayoutGrid }[] = [
  { view: "classic", label: "Classic", short: "Classic", icon: LayoutGrid },
  { view: "gamified", label: "Play", short: "Play", icon: Gamepad2 },
  { view: "chat", label: "Chat", short: "Chat", icon: MessagesSquare },
  { view: "developer", label: "Dev", short: "Dev", icon: TerminalSquare },
];

// "Voice" is a first-class entry (the Anvil voice surface). It is appended only after
// mount — the View store's server + first-client snapshot is "classic" and the switcher
// must render the 4-way control on the server, then upgrade to 5-way post-hydration, so
// the SSR markup always matches (no mismatch). The `useMounted` gate is the hydration
// contract; it is NOT a feature flag.
const VOICE_OPTION = { view: "voice" as View, label: "Voice", short: "Voice", icon: AudioLines };

export function ViewSwitcher({ compact = false }: { compact?: boolean }) {
  const { view, setView } = useView();
  // Compact (mobile) drops the 5th "Voice" pill to protect the tight h-14 header row —
  // the Anvil header orb is the mobile voice door; the full view stays reachable on
  // desktop + via the ?view=voice deep link.
  const mounted = useMounted();
  // Filter views by the build-time NEXT_PUBLIC_ENABLED_VIEWS flag (Classic is always on).
  const base = OPTIONS.filter((o) => isViewEnabled(o.view));
  const options = mounted && !compact && isViewEnabled("voice") ? [...base, VOICE_OPTION] : base;
  // Unique per instance: the switcher is rendered TWICE (desktop + compact mobile),
  // both in the DOM at once. A shared layoutId would make Motion animate ONE pill
  // between the two instances, breaking which button shows active. Scope it.
  const layoutId = `view-switcher-active-${compact ? "compact" : "full"}`;

  return (
    <div
      role="group"
      aria-label="Choose how to explore this portfolio"
      className={cn(
        "relative inline-flex items-center rounded-full border border-border bg-bg-surface/80 p-0.5 backdrop-blur",
        compact ? "gap-0.5" : "gap-0.5",
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = view === opt.view;
        return (
          <button
            key={opt.view}
            type="button"
            onClick={() => setView(opt.view)}
            aria-pressed={active}
            aria-label={`${opt.label} view`}
            className={cn(
              "relative inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base",
              active ? "text-bg-base" : "text-fg-muted hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                aria-hidden="true"
                className="absolute inset-0 z-0 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            {/* Content sits ABOVE the pill via a positive z-index wrapper — never a
                negative one (which could sink the pill behind the container bg and
                render the active dark text dark-on-dark). */}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <Icon size={14} aria-hidden="true" />
              {!compact && <span>{opt.label}</span>}
              {compact && <span className="sr-only">{opt.label}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
