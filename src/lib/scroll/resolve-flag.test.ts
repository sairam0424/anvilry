import { describe, it, expect } from "vitest";
import { resolveFlag } from "./resolve-flag";

const ENGINES = ["custom", "library"] as const;

/** Precedence: param > stored > fallback, with invalid values skipped at each layer. */
describe("resolveFlag", () => {
  it("uses the URL param when valid (highest precedence)", () => {
    expect(resolveFlag(ENGINES, { param: "library", stored: "custom", fallback: "custom" })).toBe(
      "library",
    );
  });

  it("falls through to the stored value when no/invalid param", () => {
    expect(resolveFlag(ENGINES, { param: null, stored: "library", fallback: "custom" })).toBe(
      "library",
    );
    expect(resolveFlag(ENGINES, { param: "bogus", stored: "library", fallback: "custom" })).toBe(
      "library",
    );
  });

  it("falls through to the fallback when param and stored are absent/invalid", () => {
    expect(resolveFlag(ENGINES, { param: null, stored: null, fallback: "custom" })).toBe("custom");
    expect(resolveFlag(ENGINES, { param: "x", stored: "y", fallback: "custom" })).toBe("custom");
  });

  it("never returns a value outside the allowed set", () => {
    const r = resolveFlag(ENGINES, { param: "evil", stored: "evil", fallback: "custom" });
    expect(ENGINES).toContain(r);
  });
});
