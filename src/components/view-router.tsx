"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useView } from "@/components/view-context";
import { isViewEnabled } from "@/lib/enabled-views";

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
 * The cross-fade between views is owned by the View Transitions API (driven from
 * setViewInternal in view-context). The swapped subtree carries
 * `view-transition-name: view-body` so the API animates ONLY the body content;
 * the sticky header is pinned to its own `site-header` group (see site-nav) and
 * stays put. We deliberately do NOT wrap these in motion.div fades anymore — two
 * competing crossfades double-animated opacity and could snapshot-tear the R3F
 * canvas mid-transition. Reduced-motion users get an instant swap (the API call
 * is skipped in commitViewChange).
 */
const ChatView = dynamic(() => import("@/components/chat/chat-view").then((m) => m.ChatView), {
  ssr: false,
});
const GameView = dynamic(() => import("@/components/game/game-view").then((m) => m.GameView), {
  ssr: false,
});
const DeveloperView = dynamic(
  () => import("@/components/game/developer-view").then((m) => m.DeveloperView),
  { ssr: false },
);
const AnvilView = dynamic(() => import("@/components/chat/anvil-view").then((m) => m.AnvilView), {
  ssr: false,
});
const ResumeView = dynamic(
  () => import("@/components/home/resume-view").then((m) => m.ResumeView),
  { ssr: false },
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
