import { describe, it, expect } from "vitest";
import { computeGaze } from "./use-avatar-gaze";

/**
 * computeGaze is a pure function extracted from the hook for testability.
 * It takes elapsed time t and current pitch/yaw and returns GazeOutput.
 */
describe("computeGaze", () => {
  it("eyeLX stays within clamp bounds [-0.15, 0.15] across 1000 ticks", () => {
    for (let i = 0; i < 1000; i++) {
      const t = i * 0.016;
      const result = computeGaze(t, 0, 0);
      expect(result.eyeLX).toBeGreaterThanOrEqual(-0.15);
      expect(result.eyeLX).toBeLessThanOrEqual(0.15);
    }
  });

  it("eyeLY stays within clamp bounds [-0.1, 0.1] across 1000 ticks", () => {
    for (let i = 0; i < 1000; i++) {
      const t = i * 0.016;
      const result = computeGaze(t, 0, 0);
      expect(result.eyeLY).toBeGreaterThanOrEqual(-0.1);
      expect(result.eyeLY).toBeLessThanOrEqual(0.1);
    }
  });

  it("positive yaw produces positive eyeLX component (eyes track cursor right)", () => {
    const result = computeGaze(0, 0, 1.0); // yaw = 1.0 (full right)
    expect(result.eyeLX).toBeGreaterThan(0);
  });

  it("negative yaw produces negative eyeLX component (eyes track cursor left)", () => {
    const result = computeGaze(0, 0, -1.0); // yaw = -1.0 (full left)
    expect(result.eyeLX).toBeLessThan(0);
  });

  it("left and right eye values are symmetric (eyeRX mirrors eyeLX)", () => {
    const result = computeGaze(10, 0.3, 0.5);
    expect(result.eyeRX).toBeCloseTo(result.eyeLX, 10);
    expect(result.eyeRY).toBeCloseTo(result.eyeLY, 10);
  });
});
