"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScrollMetric, UseAutoScroll, UseAutoScrollOptions } from "./types";

/**
 * In-repo "stick to bottom" engine for streaming chat + terminal output. Fixes the
 * two verified failure modes of the old per-frame distance check:
 *
 *  1. DE-PIN TRAP — follow is gated on a persisted INTENT flag (pinnedRef), set only
 *     by genuine USER scrolls in the scroll listener. Content growth NEVER re-evaluates
 *     the threshold, so a tall bubble / late paint can't silently stop the follow.
 *  2. STALE HEIGHT — a ResizeObserver on the inner CONTENT wrapper drives the snap, so
 *     it fires when the dynamic(ssr:false) markdown finally paints (which a
 *     [messages]-dep effect cannot see) and pins to the true post-layout height.
 *
 * The snap is instant (bare scrollTop = scrollHeight). Programmatic snaps are stamped
 * and the scroll listener ignores events within PROGRAMMATIC_WINDOW_MS of one, so the
 * observer's own write is never misread as a "user scrolled away" (the #1 hand-roll
 * regression). React 19 callback refs with cleanup; handlers read live config from
 * refs so the refs stay stable (no re-attach churn, StrictMode-safe).
 */
const PROGRAMMATIC_WINDOW_MS = 150;

export function useStickToBottomCustom(opts: UseAutoScrollOptions = {}): UseAutoScroll {
  const { threshold = 120, enabled = true, onMetric, surface } = opts;

  const [isAtBottom, setIsAtBottom] = useState(true);

  // Live config in a single ref so the event handlers + callback refs never need to
  // change identity (which would detach/reattach listeners every render). Synced in an
  // effect — never written during render (React 19 ref discipline).
  const cfg = useRef<{
    threshold: number;
    enabled: boolean;
    surface?: string;
    onMetric?: (m: ScrollMetric) => void;
  }>({ threshold, enabled, surface, onMetric });
  useEffect(() => {
    cfg.current = { threshold, enabled, surface, onMetric };
  }, [threshold, enabled, surface, onMetric]);

  const scrollElRef = useRef<HTMLElement | null>(null);
  const pinnedRef = useRef(true); // follow INTENT — the load-bearing flag
  const programmaticScrollAtRef = useRef(0);
  const lastHeightRef = useRef(0);

  /** Instant snap to the true bottom. Stamps the time so the scroll listener can tell
   *  this apart from a user scroll. Marks us at-bottom directly (the resulting scroll
   *  event is inside the guard window and won't update isAtBottom). */
  const snapToBottom = useCallback(() => {
    const el = scrollElRef.current;
    if (!el) return;
    const before = el.scrollTop;
    programmaticScrollAtRef.current =
      typeof performance !== "undefined" ? performance.now() : 0;
    el.scrollTop = el.scrollHeight;
    setIsAtBottom(true);
    const { onMetric: metric, surface } = cfg.current;
    if (metric && before !== el.scrollTop) {
      metric({
        surface: surface ?? "unknown",
        engine: "custom",
        missedBottomPx: el.scrollHeight - el.scrollTop - el.clientHeight,
        falseDepin: false,
        snapLatencyMs: 0,
      });
    }
  }, []);

  /** Imperative re-pin (button / terminal keydown): restore intent, then snap. */
  const scrollToBottom = useCallback(() => {
    pinnedRef.current = true;
    snapToBottom();
  }, [snapToBottom]);

  /** USER scroll listener — the ONLY place intent changes. Position-based: after a
   *  user scroll, we're pinned iff they're within `threshold` of the bottom. */
  const handleScroll = useCallback(() => {
    const el = scrollElRef.current;
    if (!el || !cfg.current.enabled) return;
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    // Ignore the scroll event our own programmatic snap just fired.
    if (now - programmaticScrollAtRef.current < PROGRAMMATIC_WINDOW_MS) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = dist <= cfg.current.threshold;
    setIsAtBottom(dist <= 1);
  }, []);

  /** Content-growth handler (ResizeObserver) — follows ONLY if intent says pinned.
   *  Never re-checks the threshold, so growth can't de-pin. */
  const handleResize = useCallback(() => {
    const el = scrollElRef.current;
    if (!el || !cfg.current.enabled) return;
    const height = el.scrollHeight;
    const grew = height >= lastHeightRef.current;
    lastHeightRef.current = height;
    if (!grew || !pinnedRef.current) return;
    // Defer the write past the observation frame: dodges the "ResizeObserver loop"
    // warning and reads true post-layout height after the late child painted.
    requestAnimationFrame(snapToBottom);
  }, [snapToBottom]);

  // --- Callback refs (stable: empty dep arrays; handlers read refs) ---

  const scrollCleanup = useRef<(() => void) | null>(null);
  const scrollRef = useCallback(
    (node: HTMLElement | null) => {
      scrollCleanup.current?.();
      scrollCleanup.current = null;
      scrollElRef.current = node;
      if (!node) return;
      node.addEventListener("scroll", handleScroll, { passive: true });
      scrollCleanup.current = () => node.removeEventListener("scroll", handleScroll);
    },
    [handleScroll],
  );

  const contentCleanup = useRef<(() => void) | null>(null);
  const contentRef = useCallback(
    (node: HTMLElement | null) => {
      contentCleanup.current?.();
      contentCleanup.current = null;
      if (!node || typeof ResizeObserver === "undefined") return;
      lastHeightRef.current = 0; // re-arm so the first observe-snap fires
      const ro = new ResizeObserver(handleResize);
      ro.observe(node);
      contentCleanup.current = () => ro.disconnect();
    },
    [handleResize],
  );

  return { scrollRef, contentRef, isAtBottom, scrollToBottom };
}
