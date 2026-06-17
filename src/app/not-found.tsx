"use client";

/**
 * not-found.tsx — Next.js 16 file convention for unmatched routes.
 *
 * The 404 IS the terminal: a fake kernel panic boot sequence plays out, then the shell
 * survives and the visitor can type real commands (ls, whoami, help, cd /, open …).
 * Recruiters landing here via a stale link discover the gamified terminal instead of
 * hitting a dead end — the error becomes a portfolio discovery moment.
 *
 * NEXT_PUBLIC_404_ORB=true upgrades the page with a distressed red/orange 3D orb above
 * the terminal — the errorMode VoiceOrb3D with static level (no audio coupling), wrapped
 * in WebGLBoundary so non-WebGL visitors still see the terminal cleanly.
 *
 * Architecture notes:
 * - Renders inside root layout.tsx, so all Providers are already mounted.
 * - Terminal receives `initialLines={bootBanner404()}` seeding the panic sequence.
 * - The `cd /` command navigates home; all other commands work normally.
 */

import { useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Terminal } from "@/components/game/terminal/terminal";
import { bootBanner404 } from "@/components/game/terminal/boot-banner";
import { WebGLBoundary } from "@/components/game/webgl-boundary";
import type { VoiceSessionState } from "@/components/chat/use-voice-session";

const VoiceOrb3D = dynamic(
  () => import("@/components/chat/voice-orb-3d").then((m) => m.VoiceOrb3D),
  { ssr: false },
);

const showOrb = process.env.NEXT_PUBLIC_404_ORB === "true";

export default function NotFound() {
  const levelRef = useRef(0);

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-bg-base px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Distressed 3D orb — only when NEXT_PUBLIC_404_ORB=true.
            WebGLBoundary falls back silently if WebGL is unavailable.
            aria-hidden: decorative; the sr-only heading below is the a11y anchor. */}
        {showOrb && (
          <div className="mb-6 flex justify-center" aria-hidden="true">
            <WebGLBoundary>
              <VoiceOrb3D
                level={levelRef as React.RefObject<number>}
                state={"idle" as VoiceSessionState}
                size={140}
                errorMode={true}
              />
            </WebGLBoundary>
          </div>
        )}

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
