import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStickToBottomLibrary } from "./use-stick-to-bottom-library";

/**
 * Smoke test for the library adapter: it must mount under happy-dom, expose our
 * UseAutoScroll shape, and accept the scroll/content nodes without throwing. We do NOT
 * re-test the library's internal state machine (that's its own suite) — only that our
 * adapter wires it up and maps the surface correctly.
 */
beforeEach(() => {
  // The library constructs a ResizeObserver; happy-dom provides one, but stub a no-op
  // to keep the test deterministic and silent.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

describe("useStickToBottomLibrary adapter", () => {
  it("mounts and exposes the UseAutoScroll shape", () => {
    const { result } = renderHook(() => useStickToBottomLibrary({ surface: "test" }));
    expect(typeof result.current.scrollRef).toBe("function");
    expect(typeof result.current.contentRef).toBe("function");
    expect(typeof result.current.scrollToBottom).toBe("function");
    expect(typeof result.current.isAtBottom).toBe("boolean");
  });

  it("accepts scroll + content nodes without throwing", () => {
    const { result } = renderHook(() => useStickToBottomLibrary());
    const scroller = document.createElement("div");
    const content = document.createElement("div");
    scroller.appendChild(content);
    expect(() => {
      act(() => {
        result.current.scrollRef(scroller);
        result.current.contentRef(content);
      });
    }).not.toThrow();
  });

  it("attaches nothing to nodes when disabled", () => {
    const { result } = renderHook(() => useStickToBottomLibrary({ enabled: false }));
    const scroller = document.createElement("div");
    expect(() => {
      act(() => {
        result.current.scrollRef(scroller);
        result.current.contentRef(scroller);
      });
    }).not.toThrow();
  });

  it("scrollToBottom is callable without a mounted node", () => {
    const { result } = renderHook(() => useStickToBottomLibrary());
    expect(() => act(() => result.current.scrollToBottom())).not.toThrow();
  });
});
