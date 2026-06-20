"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useView } from "@/components/view-context";
import { isViewEnabled } from "@/lib/enabled-views";
import { SkeletonViewTransition } from "@/components/ui/skeleton";

/**
 * Swaps the top-level experience based on the active view.
 *
 * CLASSIC is passed as `children` (the server-rendered page) and is ALWAYS
 * mounted — it is the SSG/SSR output crawlers and no-JS visitors get, and the
 * recruiter-in-a-hurry default. We toggle its visibility with `hidden` rather
 * than unmounting, so switching back is instant and its scroll position survives.
 *
 * GAMIFIED, CHAT, and DEVELOPER are client-only, lazily imported on first
 * activation, and UNMOUNTED when not active. Unmounting (not hiding) the gamified
 * view is what lets its R3F canvas dispose the WebGL GL context — a hidden-but-live
 * context leaks GPU memory on low-end mobile.
 *
 * Each dynamic import now has a SkeletonViewTransition fallback — the orb-aesthetic
 * loading state shows while the JS bundle downloads on first activation.
 */
const ChatView = dynamic(() => import("@/components/chat/chat-view").then((m) => m.ChatView), {
  ssr: false,
  loading: () => <SkeletonViewTransition label="Loading Chat..." />,
});
const GameView = dynamic(() => import("@/components/game/game-view").then((m) => m.GameView), {
  ssr: false,
  loading: () => <SkeletonViewTransition label="Loading Play..." />,
});
const DeveloperView = dynamic(
  () => import("@/components/game/developer-view").then((m) => m.DeveloperView),
  {
    ssr: false,
    loading: () => <SkeletonViewTransition label="Loading Dev..." />,
  },
);
const AnvilView = dynamic(() => import("@/components/chat/anvil-view").then((m) => m.AnvilView), {
  ssr: false,
  loading: () => <SkeletonViewTransition label="Loading Voice..." />,
});
const ResumeView = dynamic(
  () => import("@/components/home/resume-view").then((m) => m.ResumeView),
  {
    ssr: false,
    loading: () => <SkeletonViewTransition label="Loading Résumé..." />,
  },
);

export function ViewRouter({ children }: { children: ReactNode }) {
  const { view, setView } = useView();

  return (
    <div style={{ viewTransitionName: "view-body" }}>
      {/* Classic — always mounted; the SSG default. Hidden (not unmounted) when inactive. */}
      <div hidden={view !== "classic"} aria-hidden={view !== "classic"}>
        {children}
      </div>

      {/* Each optional view is gated by the build-time NEXT_PUBLIC_ENABLED_VIEWS flag.
          If disabled, navigating to ?view=X stays on Classic (hidden=false above). */}
      {view === "chat" && isViewEnabled("chat") && <ChatView />}
      {view === "gamified" && isViewEnabled("gamified") && <GameView />}
      {view === "developer" && isViewEnabled("developer") && <DeveloperView />}
      {view === "voice" && isViewEnabled("voice") && <AnvilView onClose={() => setView("classic")} />}
      {/* Resume view — always enabled; no WebGL, no animations, print-optimized. */}
      {view === "resume" && isViewEnabled("resume") && <ResumeView />}
    </div>
  );
}
