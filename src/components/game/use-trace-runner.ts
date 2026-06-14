"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Scenario } from "@/lib/agent-trace";

export type RunnerStatus = "idle" | "running" | "done";

/**
 * Deterministic state machine for the glass-box multi-agent demo: reveals a scenario's
 * steps one at a time on a typed schedule (coordination feel), or ALL at once when
 * `reduced` is true (prefers-reduced-motion / pre-hydration). Announces each revealed
 * step into a polite live region (announce-on-settle, like use-chat-a11y) and settles on
 * "Trace complete". No live LLM — pure timers over owner-authored data. All timers are
 * cleared on reset/unmount (no setState-after-unmount).
 */
export function useTraceRunner(scenario: Scenario, reduced: boolean) {
  const [status, setStatus] = useState<RunnerStatus>("idle");
  const [revealedCount, setRevealedCount] = useState(0);
  const [liveMessage, setLiveMessage] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setStatus("idle");
    setRevealedCount(0);
    setLiveMessage("");
  }, [clearTimers]);

  const run = useCallback(() => {
    clearTimers();
    setStatus("running");
    setRevealedCount(0);

    if (reduced) {
      // Reduced-motion / pre-hydration: reveal everything instantly, no timers.
      setRevealedCount(scenario.steps.length);
      setStatus("done");
      setLiveMessage("Trace complete.");
      return;
    }

    let elapsed = 0;
    scenario.steps.forEach((step, i) => {
      elapsed += step.ms;
      const isLast = i === scenario.steps.length - 1;
      timers.current.push(
        setTimeout(() => {
          setRevealedCount(i + 1);
          // On the last step, fold the settle into the SAME live message — two
          // setLiveMessage calls in one tick collapse to one commit, so a separate
          // "Trace complete." would silently overwrite the final step and AT would
          // never hear the last agent. One combined string announces both.
          if (isLast) {
            setStatus("done");
            setLiveMessage(`${step.agent}: ${step.action}. Trace complete.`);
          } else {
            setLiveMessage(`${step.agent}: ${step.action}`);
          }
        }, elapsed),
      );
    });
  }, [scenario, reduced, clearTimers]);

  // Reset when the scenario changes; clear timers on unmount.
  useEffect(() => reset, [reset]);

  return { status, revealedCount, liveMessage, run, reset };
}
