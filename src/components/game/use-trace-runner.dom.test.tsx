import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTraceRunner } from "./use-trace-runner";
import type { Scenario } from "@/lib/agent-trace";

/**
 * The runner is a deterministic timer state machine — drive it with fake timers and
 * assert: steps reveal sequentially as the clock crosses each step.ms; reduced=true
 * reveals everything with zero advance; reset clears pending timers (no orphan reveals).
 */
const SCENARIO: Scenario = {
  id: "t",
  question: "test?",
  steps: [
    { agent: "Researcher", action: "a1", output: "o1", ms: 500 },
    { agent: "Synthesizer", action: "a2", output: "o2", ms: 500 },
    { agent: "Presenter", action: "a3", output: "o3", ms: 500 },
  ],
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useTraceRunner", () => {
  it("reveals steps sequentially as the clock crosses each step.ms", () => {
    const { result } = renderHook(() => useTraceRunner(SCENARIO, false));
    expect(result.current.status).toBe("idle");
    act(() => result.current.run());
    expect(result.current.status).toBe("running");
    expect(result.current.revealedCount).toBe(0);

    act(() => vi.advanceTimersByTime(500));
    expect(result.current.revealedCount).toBe(1);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.revealedCount).toBe(2);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.revealedCount).toBe(3);
    expect(result.current.status).toBe("done");
    // The final live message folds the last step AND the settle into ONE string. Two
    // setLiveMessage calls in the same tick collapse to one commit, so a separate
    // "Trace complete." would silently overwrite the last agent — a screen reader would
    // never hear it. Assert BOTH the final agent's content and the completion survive.
    expect(result.current.liveMessage).toBe("Presenter: a3. Trace complete.");
  });

  it("reduced=true still announces completion in the live region", () => {
    const { result } = renderHook(() => useTraceRunner(SCENARIO, true));
    act(() => result.current.run());
    expect(result.current.liveMessage).toBe("Trace complete.");
  });

  it("reduced=true reveals ALL steps instantly with zero advance", () => {
    const { result } = renderHook(() => useTraceRunner(SCENARIO, true));
    act(() => result.current.run());
    expect(result.current.revealedCount).toBe(3);
    expect(result.current.status).toBe("done");
  });

  it("reset clears pending timers — advancing after reset reveals nothing", () => {
    const { result } = renderHook(() => useTraceRunner(SCENARIO, false));
    act(() => result.current.run());
    act(() => vi.advanceTimersByTime(500)); // 1 revealed
    expect(result.current.revealedCount).toBe(1);
    act(() => result.current.reset());
    expect(result.current.status).toBe("idle");
    expect(result.current.revealedCount).toBe(0);
    act(() => vi.advanceTimersByTime(2000)); // orphan timers must NOT fire
    expect(result.current.revealedCount).toBe(0);
  });
});
