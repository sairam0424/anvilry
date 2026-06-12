"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useView } from "@/components/view-context";

/**
 * Swaps the top-level experience based on the active view.
 *
 * CLASSIC is passed as `children` (the server-rendered page) and is ALWAYS
 * mounted — it is the SSG/SSR output crawlers and no-JS visitors get, and the
 * recruiter-in-a-hurry default. We toggle its visibility with `hidden` rather
 * than unmounting, so switching back is instant and its scroll position survives.
 *
 * GAMIFIED and CHAT are client-only, lazily imported on first activation, and
 * UNMOUNTED when not active. Unmounting (not hiding) the gamified view is what
 * lets its R3F canvas dispose the WebGL GL context — a hidden-but-live context
 * leaks GPU memory on low-end mobile.
 */
const ChatView = dynamic(() => import("@/components/chat/chat-view").then((m) => m.ChatView), {
  ssr: false,
});
const GameView = dynamic(() => import("@/components/game/game-view").then((m) => m.GameView), {
  ssr: false,
});

export function ViewRouter({ children }: { children: ReactNode }) {
  const { view } = useView();

  return (
    <>
      {/* Classic — always mounted; the SSG default. Hidden (not unmounted) when inactive. */}
      <div hidden={view !== "classic"} aria-hidden={view !== "classic"}>
        {children}
      </div>

      {/* Chat — lazy, unmounts on exit. */}
      {view === "chat" && <ChatView />}

      {/* Gamified — lazy, unmounts on exit so the WebGL context disposes. */}
      {view === "gamified" && <GameView />}
    </>
  );
}
