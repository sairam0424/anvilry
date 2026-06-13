"use client";

import { useCallback, useRef, useState } from "react";
import type { UseAutoScroll, UseAutoScrollOptions } from "./types";

/**
 * STUB (Phase 1) — replaced with the real intent-flag + ResizeObserver implementation
 * in Phase 2. Returns inert refs so the dispatcher compiles and call sites can wire up.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useStickToBottomCustom(_opts: UseAutoScrollOptions = {}): UseAutoScroll {
  const [isAtBottom] = useState(true);
  const scrollRef = useCallback((_node: HTMLElement | null) => {}, []);
  const contentRef = useCallback((_node: HTMLElement | null) => {}, []);
  const scrollToBottom = useCallback(() => {}, []);
  // Keep refs around so eslint doesn't trim the imports before Phase 2 lands.
  useRef(null);
  return { scrollRef, contentRef, isAtBottom, scrollToBottom };
}
