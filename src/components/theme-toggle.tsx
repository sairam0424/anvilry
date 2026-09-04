"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * Light/dark theme toggle. Sun/Moon icon button wrapped in the Tooltip primitive
 * (Phase 2); `aria-pressed` reflects whether light mode (the non-default state) is
 * active, and `aria-label` names the action the click will perform — matching the
 * pattern used by mic-button.tsx / read-aloud-button.tsx for state-dependent labels.
 *
 * `size` mirrors how site-nav.tsx (18px) and mobile-nav.tsx's drawer (20px) size
 * the adjacent GitHub/LinkedIn icons, so the toggle matches whichever row it's in.
 */
export function ThemeToggle({ size = 18 }: { size?: number }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const label = isLight ? "Switch to dark theme" : "Switch to light theme";

  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-pressed={isLight}
        aria-label={label}
        className="rounded text-fg-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {isLight ? <Moon size={size} /> : <Sun size={size} />}
      </button>
    </Tooltip>
  );
}
