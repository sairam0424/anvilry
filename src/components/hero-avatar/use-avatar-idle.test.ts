import { describe, it, expect } from "vitest";
import { computeIdle } from "./use-avatar-idle";

/**
 * computeIdle is a pure function extracted from the hook for testability.
 * It takes elapsed time t and returns IdleOutput.
 */
describe("computeIdle", () => {
  it("chestY stays within breath amplitude [-0.003, 0.003]", () => {
    for (let i = 0; i < 1000; i++) {
      const t = i * 0.016;
      const result = computeIdle(t);
      expect(result.chestY).toBeGreaterThanOrEqual(-0.003);
      expect(result.chestY).toBeLessThanOrEqual(0.003);
    }
  });

  it("spineY is always exactly chestY * 0.5", () => {
    for (let i = 0; i < 100; i++) {
      const t = i * 0.1;
      const result = computeIdle(t);
      expect(result.spineY).toBeCloseTo(result.chestY * 0.5, 10);
    }
  });

  it("chestY changes over time (not static)", () => {
    const a = computeIdle(0);
    const b = computeIdle(1.5);
    expect(a.chestY).not.toBe(b.chestY);
  });
});
