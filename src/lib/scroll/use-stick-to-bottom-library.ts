"use client";

import { useCallback, useState } from "react";
import type { UseAutoScroll, UseAutoScrollOptions } from "./types";

/**
 * STUB (Phase 1) — replaced with the use-stick-to-bottom adapter in Phase 4. Returns
 * inert refs so the dispatcher compiles before the dependency is added.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useStickToBottomLibrary(_opts: UseAutoScrollOptions = {}): UseAutoScroll {
  const [isAtBottom] = useState(true);
  const scrollRef = useCallback((_node: HTMLElement | null) => {}, []);
  const contentRef = useCallback((_node: HTMLElement | null) => {}, []);
  const scrollToBottom = useCallback(() => {}, []);
  return { scrollRef, contentRef, isAtBottom, scrollToBottom };
}
