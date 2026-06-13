import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStickToBottomCustom } from "./use-stick-to-bottom-custom";

/**
 * happy-dom has no real layout engine, so we drive geometry by hand: a fake scroll
 * container whose scrollHeight/clientHeight/scrollTop we set, a manually-fired
 * ResizeObserver, and synthetic scroll events. This lets us assert the STATE MACHINE
 * (intent flag, programmatic-scroll guard, growth-follows-only-when-pinned) precisely.
 */

// Capture the RO callback so tests can fire it deterministically.
let roCallback: ResizeObserverCallback | null = null;
class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    roCallback = cb;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

type Scroller = HTMLDivElement & { setGeometry: (sh: number, ch?: number) => void };

/** A scroll container with settable geometry. Default: 1000 tall, 300 visible. */
function makeScroller(scrollHeight = 1000, clientHeight = 300): Scroller {
  const el = document.createElement("div") as Scroller;
  let _scrollTop = 0;
  Object.defineProperty(el, "scrollHeight", { get: () => scrollHeight, configurable: true });
  Object.defineProperty(el, "clientHeight", { get: () => clientHeight, configurable: true });
  Object.defineProperty(el, "scrollTop", {
    get: () => _scrollTop,
    set: (v: number) => {
      // Clamp like a real element so scrollTop = scrollHeight lands at max.
      _scrollTop = Math.min(Math.max(0, v), scrollHeight - clientHeight);
    },
    configurable: true,
  });
  el.setGeometry = (sh: number, ch = clientHeight) => {
    scrollHeight = sh;
    clientHeight = ch;
  };
  return el;
}

// Deterministic clock for the programmatic-scroll guard, advanced by the tests.
let clock = 1000;
const advance = (ms: number) => {
  clock += ms;
};

const flushRAF = async () => {
  // requestAnimationFrame in happy-dom resolves on a timer; advance microtasks.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

beforeEach(() => {
  roCallback = null;
  clock = 1000;
  vi.stubGlobal("ResizeObserver", MockResizeObserver as unknown as typeof ResizeObserver);
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

describe("useStickToBottomCustom — state machine", () => {
  it("snaps to the bottom when content grows while pinned (kills stale-height)", async () => {
    const { result } = renderHook(() => useStickToBottomCustom({ threshold: 120, surface: "t" }));
    const scroller = makeScroller(1000, 300);
    const content = document.createElement("div");

    act(() => {
      result.current.scrollRef(scroller);
      result.current.contentRef(content);
    });

    // Content grows (late markdown paints): RO fires.
    act(() => {
      scroller.setGeometry(2000, 300);
      roCallback?.([], {} as ResizeObserver);
    });
    await flushRAF();

    // Pinned by default → followed to the true bottom (2000 - 300 = 1700).
    expect(scroller.scrollTop).toBe(1700);
    expect(result.current.isAtBottom).toBe(true);
  });

  it("a user scroll UP de-pins, and subsequent growth does NOT follow (de-pin trap fixed)", async () => {
    const { result } = renderHook(() => useStickToBottomCustom({ threshold: 120 }));
    const scroller = makeScroller(1000, 300);
    const content = document.createElement("div");
    act(() => {
      result.current.scrollRef(scroller);
      result.current.contentRef(content);
    });

    // User scrolls far up (well beyond threshold from bottom).
    act(() => {
      advance(500);
      scroller.scrollTop = 100; // dist = 1000-100-300 = 600 >> 120
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.isAtBottom).toBe(false);

    // Content grows — must STAY put because intent is de-pinned.
    act(() => {
      scroller.setGeometry(3000, 300);
      roCallback?.([], {} as ResizeObserver);
    });
    await flushRAF();
    expect(scroller.scrollTop).toBe(100); // not yanked
  });

  it("scrolling back near the bottom RE-pins, and growth follows again", async () => {
    const { result } = renderHook(() => useStickToBottomCustom({ threshold: 120 }));
    const scroller = makeScroller(1000, 300);
    const content = document.createElement("div");
    act(() => {
      result.current.scrollRef(scroller);
      result.current.contentRef(content);
    });
    // De-pin first.
    act(() => {
      advance(500);
      scroller.scrollTop = 100;
      scroller.dispatchEvent(new Event("scroll"));
    });
    // Then scroll back within threshold of the bottom (dist = 1000-650-300 = 50 <= 120).
    act(() => {
      advance(500);
      scroller.scrollTop = 650;
      scroller.dispatchEvent(new Event("scroll"));
    });

    act(() => {
      scroller.setGeometry(2000, 300);
      roCallback?.([], {} as ResizeObserver);
    });
    await flushRAF();
    expect(scroller.scrollTop).toBe(1700); // followed again
  });

  it("a programmatic snap does NOT de-pin itself (150ms guard)", async () => {
    const { result } = renderHook(() => useStickToBottomCustom({ threshold: 120 }));
    const scroller = makeScroller(2000, 300);
    const content = document.createElement("div");
    act(() => {
      result.current.scrollRef(scroller);
      result.current.contentRef(content);
    });

    // Imperative snap, then the browser fires the resulting scroll event immediately
    // (within the guard window). It must be IGNORED — pin must survive.
    act(() => {
      result.current.scrollToBottom();
      scroller.dispatchEvent(new Event("scroll")); // same tick, no time advance
    });
    // Now content grows; if the snap had self-de-pinned, this wouldn't follow.
    act(() => {
      scroller.setGeometry(4000, 300);
      roCallback?.([], {} as ResizeObserver);
    });
    await flushRAF();
    expect(scroller.scrollTop).toBe(3700);
    expect(result.current.isAtBottom).toBe(true);
  });

  it("scrollToBottom re-pins after a user de-pin", async () => {
    const { result } = renderHook(() => useStickToBottomCustom({ threshold: 120 }));
    const scroller = makeScroller(1000, 300);
    const content = document.createElement("div");
    act(() => {
      result.current.scrollRef(scroller);
      result.current.contentRef(content);
    });
    act(() => {
      advance(500);
      scroller.scrollTop = 0;
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.isAtBottom).toBe(false);

    act(() => {
      result.current.scrollToBottom();
    });
    expect(scroller.scrollTop).toBe(700); // 1000 - 300
    expect(result.current.isAtBottom).toBe(true);
  });

  it("does nothing when disabled", async () => {
    const { result } = renderHook(() => useStickToBottomCustom({ enabled: false }));
    const scroller = makeScroller(1000, 300);
    const content = document.createElement("div");
    act(() => {
      result.current.scrollRef(scroller);
      result.current.contentRef(content);
    });
    act(() => {
      scroller.setGeometry(2000, 300);
      roCallback?.([], {} as ResizeObserver);
    });
    await flushRAF();
    expect(scroller.scrollTop).toBe(0); // never followed
  });
});
