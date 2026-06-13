"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScrollMetric, ScrollMode, UseAutoScroll, UseAutoScrollOptions } from "./types";

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
 *
 * MODE: "bottom-pin" follows the bottom of the stream. "message-top" (ChatGPT/Claude
 * style) instead brings the NEWEST user message to the top of the viewport — the same
 * pin/guard machinery, only the snap TARGET differs. The chat marks its latest user
 * bubble via anchorRef; the answer streams below it. The intent flag still means
 * "keep following", so growth keeps the anchor parked at top until the user scrolls.
 */
const PROGRAMMATIC_WINDOW_MS = 150;
const MESSAGE_TOP_OFFSET_PX = 12; // small breathing room above the anchored message

export function useStickToBottomCustom(opts: UseAutoScrollOptions = {}): UseAutoScroll {
  const { threshold = 120, enabled = true, onMetric, surface, mode = "bottom-pin" } = opts;

  const [isAtBottom, setIsAtBottom] = useState(true);

  // Live config in a single ref so the event handlers + callback refs never need to
  // change identity (which would detach/reattach listeners every render). Synced in an
  // effect — never written during render (React 19 ref discipline).
  const cfg = useRef<{
    threshold: number;
    enabled: boolean;
    mode: ScrollMode;
    surface?: string;
    onMetric?: (m: ScrollMetric) => void;
  }>({ threshold, enabled, mode, surface, onMetric });
  useEffect(() => {
    cfg.current = { threshold, enabled, mode, surface, onMetric };
  }, [threshold, enabled, mode, surface, onMetric]);

  const scrollElRef = useRef<HTMLElement | null>(null);
  const anchorElRef = useRef<HTMLElement | null>(null); // newest user message (message-top)
  const pinnedRef = useRef(true); // follow INTENT — the load-bearing flag
  const programmaticScrollAtRef = useRef(0);
  const lastHeightRef = useRef(0);

  /** Instant snap. Stamps the time so the scroll listener can tell this apart from a
   *  user scroll. In "message-top" mode, parks the anchored user message near the top
   *  of the container; otherwise pins the bottom. Marks us at-bottom directly (the
   *  resulting scroll event is inside the guard window and won't update isAtBottom). */
  const snap = useCallback(() => {
    const el = scrollElRef.current;
    if (!el) return;
    const before = el.scrollTop;
    programmaticScrollAtRef.current =
      typeof performance !== "undefined" ? performance.now() : 0;

    const anchor = anchorElRef.current;
    if (cfg.current.mode === "message-top" && anchor && el.contains(anchor)) {
      // Position the anchor's top near the container's top. offsetTop is relative to
      // the offset parent; for a normally-positioned content wrapper inside the
      // scroller this equals the anchor's distance from the scrollable top.
      const target = anchor.offsetTop - MESSAGE_TOP_OFFSET_PX;
      el.scrollTop = Math.min(Math.max(0, target), el.scrollHeight - el.clientHeight);
    } else {
      el.scrollTop = el.scrollHeight;
    }
    // snap only runs while following (scrollToBottom, or a pinned resize), so we're
    // caught up — hide the jump button. (In message-top a long answer may extend below
    // the fold, but we're still following it, which is what the button reflects.)
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
    snap();
  }, [snap]);

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
    requestAnimationFrame(snap);
  }, [snap]);

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

  // Plain setter ref — the latest user message (message-top mode); no listeners.
  const anchorRef = useCallback((node: HTMLElement | null) => {
    anchorElRef.current = node;
  }, []);

  return { scrollRef, contentRef, isAtBottom, scrollToBottom, anchorRef };
}
