import { describe, it, expect } from "vitest";
import { nextTheme, THEMES } from "./theme";

/** The cosmetic prompt theme cycles cyan -> green -> amber -> cyan. */
describe("nextTheme", () => {
  it("advances through the cycle in order", () => {
    expect(nextTheme("cyan")).toBe("green");
    expect(nextTheme("green")).toBe("amber");
  });

  it("wraps from the last theme back to the first", () => {
    expect(nextTheme("amber")).toBe("cyan");
  });

  it("a full cycle returns to the start", () => {
    let t = THEMES[0];
    for (let i = 0; i < THEMES.length; i++) t = nextTheme(t);
    expect(t).toBe(THEMES[0]);
  });
});
