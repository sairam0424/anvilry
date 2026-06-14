import { describe, it, expect } from "vitest";
import { VIEWS, DEFAULT_VIEW, isView, getServerSnapshot } from "./view-context";

/**
 * SSG-safety + view-model contract. The load-bearing invariant: no matter what VIEWS
 * holds, the SERVER snapshot stays "classic" so SSR HTML and the first client render
 * agree (no hydration mismatch) and crawlers/no-JS visitors get the indexed Classic
 * page. Adding "developer" must only WIDEN what ?view= accepts — never change the
 * default. This runs in the node project, inside `vitest run` in the build chain.
 */
describe("view-context view model", () => {
  it("includes the five views (the four first-class + optional voice)", () => {
    expect(VIEWS).toContain("classic");
    expect(VIEWS).toContain("gamified");
    expect(VIEWS).toContain("chat");
    expect(VIEWS).toContain("developer");
    expect(VIEWS).toContain("voice");
  });

  it("isView accepts every real view and rejects anything else", () => {
    for (const v of VIEWS) expect(isView(v)).toBe(true);
    expect(isView("developer")).toBe(true);
    expect(isView("voice")).toBe(true);
    expect(isView("bogus")).toBe(false);
    expect(isView(null)).toBe(false);
    expect(isView(undefined)).toBe(false);
    expect(isView("")).toBe(false);
  });

  it("default + server snapshot stay 'classic' (the SSG/hydration guard)", () => {
    expect(DEFAULT_VIEW).toBe("classic");
    // This is the regression guard: widening VIEWS must NOT change the server snapshot,
    // or SSR would emit a non-Classic view and break SSG + hydration.
    expect(getServerSnapshot()).toBe("classic");
  });
});
