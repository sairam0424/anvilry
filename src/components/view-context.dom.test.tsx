import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";

/**
 * Phase 3 cross-route navigation regression (setViewInternal in ./view-context.tsx).
 *
 * Root cause being guarded here: setViewInternal used to do `history.replaceState`
 * on the CURRENT url, never navigating — a view switch triggered from any route other
 * than "/" silently did nothing visible. The fix routes through a module-level
 * `routerBridge` (populated by <ViewRouterBridge>, mirroring the `inkTransitionRef`
 * pattern in ui/ink-transition.tsx) and pushes to `/` or `/?view=<view>` when the
 * bridge reports a non-home pathname.
 *
 * The load-bearing ordering bug this also guards: the off-home navigate check MUST
 * run before the `view === current` early return. `current` is a persistent module
 * singleton that survives client-side navigation (it isn't reset just because the
 * user followed a normal <Link>). So: set view to "chat" while on "/", navigate to
 * a work page, then pick "Chat view" again — with the naive ordering, `view ===
 * current` would already be true and the function would return before ever
 * navigating home. The second test below reproduces exactly that sequence.
 */

const mockPush = vi.fn();
const mockPathname = vi.fn<() => string>(() => "/");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname(),
  // ViewQuerySync (mounted inside <ViewProvider>) reads `view` off this — returning an
  // empty ReadonlyURLSearchParams-shaped object keeps it a no-op for these tests.
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockPathname.mockReturnValue("/");
});

afterEach(() => {
  cleanup();
});

/** Renders the real <ViewProvider> + useView() so setViewInternal runs unmocked. */
function Harness() {
  return (
    <ViewProviderUnderTest>
      <Consumer />
    </ViewProviderUnderTest>
  );
}

// Re-exported indirection so both tests import a fresh module instance per-test via
// vi.resetModules() + dynamic import (the view store + routerBridge are module-level
// singletons, so tests must not leak state into one another).
let ViewProviderUnderTest: ComponentType<{ children: ReactNode }>;
let useViewUnderTest: () => { view: string; setView: (v: string) => void };

function Consumer() {
  const { view, setView } = useViewUnderTest();
  return (
    <div>
      <span data-testid="view">{view}</span>
      <button onClick={() => setView("chat")}>switch-chat</button>
      <button onClick={() => setView("resume")}>switch-resume</button>
    </div>
  );
}

describe("view-context cross-route navigation (setViewInternal)", () => {
  it("navigates to /?view=<view> when switching views from a non-home route", async () => {
    vi.resetModules();
    const mod = await import("./view-context");
    ViewProviderUnderTest = mod.ViewProvider;
    useViewUnderTest = mod.useView as unknown as typeof useViewUnderTest;

    mockPathname.mockReturnValue("/work/aava-code");
    render(<Harness />);

    fireEvent.click(screen.getByText("switch-resume"));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/?view=resume");
    // The navigate branch returns before mutating the store, so the local view
    // state must NOT have flipped to "resume" — the swap only happens after the
    // actual navigation lands on "/" and ViewQuerySync applies the deep link.
    expect(screen.getByTestId("view").textContent).toBe("classic");
  });

  it("still navigates home even when `current` already equals the requested view (the exact repro this fix closes)", async () => {
    vi.resetModules();
    const mod = await import("./view-context");
    ViewProviderUnderTest = mod.ViewProvider;
    useViewUnderTest = mod.useView as unknown as typeof useViewUnderTest;

    // 1. Start on "/" and switch to chat. On-home, this just flips the local store
    //    (history.replaceState on the current URL) — no navigation, `current` becomes "chat".
    mockPathname.mockReturnValue("/");
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByText("switch-chat"));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByTestId("view").textContent).toBe("chat");

    // 2. Simulate a normal client-side <Link> navigation to a work page. The module
    //    singleton `current` is untouched by routing — it stays "chat".
    mockPathname.mockReturnValue("/work/aava-code");
    rerender(<Harness />);

    // 3. Re-open the command palette and pick "Chat view" again. Naive ordering
    //    (`view === current` checked first) would see current === "chat" and return
    //    immediately, never navigating home — that's the bug. The fix must navigate
    //    home regardless of whether `current` already matches.
    fireEvent.click(screen.getByText("switch-chat"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/?view=chat");
  });
});
