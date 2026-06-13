"use client";

import { useStickToBottom } from "use-stick-to-bottom";
import type { UseAutoScroll, UseAutoScrollOptions } from "./types";

/**
 * Adapter over the use-stick-to-bottom library (the de-facto React solution; powers
 * bolt.new / Vercel AI Elements). Maps its instance onto our engine-agnostic
 * UseAutoScroll shape so call sites are identical to the custom engine.
 *
 * Configured INSTANT (resize + initial) to match the verified requirement that
 * streaming follow not animate — the library's velocity-spring smooth follow is its
 * headline feature, but a per-token chase animation lags behind the stream, so we opt
 * out of it. The library owns user-vs-programmatic discrimination, ResizeObserver, and
 * scroll-anchoring internally, which is exactly what we A/B against the custom hook.
 *
 * message-top mode is NOT supported here (the library pins the bottom); the adapter
 * falls back to bottom-pin and exposes no anchorRef. The bake-off compares engines on
 * bottom-pin; message-top is a custom-engine-only enhancement.
 */
export function useStickToBottomLibrary(opts: UseAutoScrollOptions = {}): UseAutoScroll {
  const { enabled = true } = opts;
  const instance = useStickToBottom({ resize: "instant", initial: "instant" });

  return {
    // The library's refs are ref-callbacks (with a .current) — assignable to our
    // (node) => void callback-ref type. Wrap so a disabled engine attaches nothing.
    scrollRef: (node) => {
      if (enabled) instance.scrollRef(node);
    },
    contentRef: (node) => {
      if (enabled) instance.contentRef(node);
    },
    isAtBottom: instance.isAtBottom,
    scrollToBottom: () => {
      instance.scrollToBottom();
    },
  };
}
