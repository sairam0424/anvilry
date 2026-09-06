import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { ViewHint } from "./view-hint";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/view-context", () => ({
  useView: () => ({ view: "classic" }),
}));

let mediaQueryMatches = true;
vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: () => mediaQueryMatches,
}));

// Node's own built-in `localStorage` global (stable since Node 22) shadows
// happy-dom's window.localStorage in this environment, so the real
// implementation is unreachable here regardless of environment config. Stub
// a minimal in-memory version scoped to this file only.
function createLocalStorageStub() {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", createLocalStorageStub());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ViewHint responsive copy", () => {
  it("points at the top switcher on desktop/tablet (sm and up)", () => {
    mediaQueryMatches = true; // matches "(min-width: 640px)"

    render(<ViewHint />);
    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(
      screen.getByText(/use the Classic · Play · Chat switcher up top/),
    ).toBeTruthy();
  });

  it("points at the mobile menu below the sm breakpoint, not a switcher that isn't there", () => {
    mediaQueryMatches = false; // below "(min-width: 640px)"

    render(<ViewHint />);
    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(screen.queryByText(/switcher up top/)).toBeNull();
    expect(screen.getByText(/menu/i)).toBeTruthy();
  });
});
