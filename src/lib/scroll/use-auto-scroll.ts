"use client";

import { useScrollEngine } from "./scroll-flags";
import { useStickToBottomCustom } from "./use-stick-to-bottom-custom";
import { useStickToBottomLibrary } from "./use-stick-to-bottom-library";
import type { UseAutoScroll, UseAutoScrollOptions } from "./types";

/**
 * Engine-agnostic autoscroll entry point. Reads the active engine flag and delegates
 * to the in-repo custom hook or the use-stick-to-bottom library adapter. Both return
 * the identical UseAutoScroll shape, so every call site (chat view, widget, terminal)
 * stays unaware of which engine is live — flipping ?scroll= swaps the implementation
 * with no call-site change.
 *
 * Both hooks are called unconditionally every render (one of them no-ops internally);
 * the engine value is stable within a session, so this respects the rules of hooks
 * without a conditional-hook violation. Each hook is a thin wrapper that bails early
 * when it isn't the active engine, so the inactive one attaches no observers.
 */
export function useAutoScroll(opts: UseAutoScrollOptions = {}): UseAutoScroll {
  const engine = useScrollEngine();
  // `enabled` defaults to true; AND it with "is this the active engine" so the
  // inactive engine attaches no observers even if it were handed a node.
  const callerEnabled = opts.enabled ?? true;
  const custom = useStickToBottomCustom({ ...opts, enabled: callerEnabled && engine === "custom" });
  const library = useStickToBottomLibrary({
    ...opts,
    enabled: callerEnabled && engine === "library",
  });
  return engine === "library" ? library : custom;
}
