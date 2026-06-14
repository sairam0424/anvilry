import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatA11y } from "./use-chat-a11y";
import type { ChatMessage } from "./use-chat";

/**
 * The announce-on-settle live region is what a screen reader speaks. Its no-double-speak
 * contract: while streaming -> "Answering…"; settled with TTS OFF -> the full answer
 * text (so AT conveys it); settled with TTS ON (disableLiveAnnounce) -> only a short
 * status, NEVER the full text, so the user doesn't hear the answer twice (synthetic
 * voice + their AT). Announcements are timer-deferred, so we drive fake timers.
 */

const answer = (text: string): ChatMessage[] => [
  { role: "user", content: "q" },
  { role: "assistant", content: text },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useChatA11y no-double-speak", () => {
  it("announces 'Answering…' while streaming", () => {
    const { result } = renderHook(() => useChatA11y(answer(""), true, false));
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.liveMessage).toBe("Answering…");
  });

  it("announces the FULL answer when settled and TTS is OFF", () => {
    const { result } = renderHook(() => useChatA11y(answer("I build agent backends."), false, false));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.liveMessage).toBe("I build agent backends.");
  });

  it("announces only a STATUS (not the full text) when TTS is reading aloud", () => {
    const { result } = renderHook(() => useChatA11y(answer("I build agent backends."), false, true));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.liveMessage).toBe("Speaking answer aloud.");
    expect(result.current.liveMessage).not.toContain("agent backends");
  });

  it("switches from full-text to status when TTS starts on the same answer", () => {
    const messages = answer("Long grounded answer about MindForge.");
    const { result, rerender } = renderHook(
      ({ off }) => useChatA11y(messages, false, off),
      { initialProps: { off: false } },
    );
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.liveMessage).toContain("MindForge");

    // User taps "read aloud" -> disableLiveAnnounce flips true -> status only.
    rerender({ off: true });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.liveMessage).toBe("Speaking answer aloud.");
  });
});
