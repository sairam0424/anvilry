import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * use-terminal run() DISPATCH behavior — the side-effects a pure command test can't
 * reach: clear empties the scrollback, a view command calls setView (not router.push),
 * a route command calls router.push, an external command calls window.open, and the
 * theme cycle advances. Needs a DOM (happy-dom project) for renderHook + window.open.
 *
 * next/navigation, view-context, and @vercel/analytics are mocked so the hook runs in
 * isolation. Route/slug values are read from the REAL content layer (zero fabrication).
 */
const push = vi.fn();
const setView = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/view-context", () => ({ useView: () => ({ view: "developer", setView }) }));
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

import { useTerminal } from "./use-terminal";
import { allWork } from "@/lib/content";

beforeEach(() => {
  push.mockClear();
  setView.mockClear();
});

describe("useTerminal run() dispatch", () => {
  it("clear empties the scrollback", () => {
    const { result } = renderHook(() => useTerminal());
    expect(result.current.lines.length).toBeGreaterThan(0); // boot banner
    act(() => result.current.run("clear"));
    expect(result.current.lines).toEqual([]);
  });

  it("a view command calls setView, not router.push", () => {
    const { result } = renderHook(() => useTerminal());
    act(() => result.current.run("classic"));
    expect(setView).toHaveBeenCalledWith("classic");
    expect(push).not.toHaveBeenCalled();
  });

  it("the developer command routes to the developer view", () => {
    const { result } = renderHook(() => useTerminal());
    act(() => result.current.run("developer"));
    expect(setView).toHaveBeenCalledWith("developer");
  });

  it("open <real-slug> calls router.push to the resolved route", () => {
    const slug = allWork[0].slug; // real slug from the content layer, not hardcoded
    const { result } = renderHook(() => useTerminal());
    act(() => result.current.run(`open ${slug}`));
    expect(push).toHaveBeenCalledWith(`/work/${slug}`);
  });

  it("resume <variant> opens externally via window.open", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const { result } = renderHook(() => useTerminal());
    act(() => result.current.run("resume master"));
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining(".pdf"),
      "_blank",
      "noopener,noreferrer",
    );
    vi.unstubAllGlobals();
  });

  it("theme cycles cyan -> green -> amber -> cyan and echoes the change", () => {
    const { result } = renderHook(() => useTerminal());
    expect(result.current.theme).toBe("cyan");
    act(() => result.current.run("theme"));
    expect(result.current.theme).toBe("green");
    act(() => result.current.run("theme"));
    expect(result.current.theme).toBe("amber");
    act(() => result.current.run("theme"));
    expect(result.current.theme).toBe("cyan");
    // The change is echoed into the scrollback ("theme → <next>").
    expect(result.current.lines.some((l) => /theme → /.test(l.text))).toBe(true);
  });
});
