"use client";

/**
 * not-found.tsx — Next.js 16 file convention for unmatched routes.
 *
 * The 404 IS the terminal: a fake kernel panic boot sequence plays out, then the shell
 * survives and the visitor can type real commands (ls, whoami, help, cd /, open …).
 * Recruiters landing here via a stale link discover the gamified terminal instead of
 * hitting a dead end — the error becomes a portfolio discovery moment.
 *
 * Architecture notes:
 * - Renders inside root layout.tsx, so all Providers (voice, settings, orb store) are
 *   already mounted — no extra context wiring needed.
 * - Terminal receives `initialLines={bootBanner404()}` which seeds the scrollback with
 *   the panic sequence instead of the normal whoami boot banner.
 * - The `cd /` command (added in commands.ts) navigates home; all other commands work
 *   normally — ls, open, whoami, stack, help, etc.
 * - WebGLBoundary is NOT needed here (no WebGL scene). The import is intentionally
 *   omitted to keep the 404 bundle slim.
 */

import Link from "next/link";
import { Terminal } from "@/components/game/terminal/terminal";
import { bootBanner404 } from "@/components/game/terminal/boot-banner";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-bg-base px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Glitch eyebrow — decorative, aria-hidden so screen readers skip the animation */}
        <p
          className="mono-label glitch-eyebrow mb-4 text-amber"
          aria-hidden="true"
        >
          {"// 404 :: route-not-found"}
        </p>

        {/* Screen-reader accessible heading — separate from the glitch label */}
        <h1 className="sr-only">Page not found</h1>

        {/* The real terminal — panic sequence pre-seeded, all commands functional */}
        <Terminal
          initialLines={bootBanner404()}
          maxHeightClass="max-h-96"
        />

        {/* Always-visible fallback for visitors who don't want to type */}
        <p className="mt-4 text-center text-xs text-fg-subtle">
          lost?{" "}
          <Link
            href="/"
            className="text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:rounded"
          >
            back to homepage
          </Link>
          {" "}or type{" "}
          <code className="rounded bg-bg-elevated px-1 py-0.5 text-fg-muted">cd /</code>
        </p>
      </div>
    </main>
  );
}
