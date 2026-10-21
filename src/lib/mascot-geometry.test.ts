import { describe, it, expect } from "vitest";
import {
  DIRECTIONS,
  REACTIONS,
  CLOCKWISE,
  DEAD_ZONE,
  aimSector,
  sectorDirection,
  cellPosition,
} from "./mascot-geometry";

/** Pointer offset at a given angle (degrees, clockwise from the right, y down) and radius. */
const at = (deg: number, r = 250) => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)] as const;
};

describe("mascot sheet layout", () => {
  it("names the nine direction cells in sheet (row-major) order", () => {
    expect(DIRECTIONS).toEqual([
      "up-left", "up", "up-right",
      "left", "center", "right",
      "down-left", "down", "down-right",
    ]);
  });

  it("names the nine reaction cells in sheet (row-major) order", () => {
    expect(REACTIONS).toEqual([
      "blink", "heart", "sparkle",
      "surprised", "wink", "bashful",
      "sleepy", "dizzy", "delighted",
    ]);
  });

  it("maps a cell index to a 0/50/100 percent background-position", () => {
    expect(cellPosition(0)).toBe("0% 0%");
    expect(cellPosition(1)).toBe("50% 0%");
    expect(cellPosition(4)).toBe("50% 50%");
    expect(cellPosition(8)).toBe("100% 100%");
  });
});

describe("aimSector", () => {
  it("reports the dead zone (-1) while the pointer is within DEAD_ZONE of the centre", () => {
    expect(DEAD_ZONE).toBe(70);
    expect(aimSector(40, 0, -1)).toBe(-1);
    expect(aimSector(0, -69.9, 3)).toBe(-1);
    expect(aimSector(70, 0, -1)).toBe(0);
  });

  it("splits the circle into eight sectors clockwise from the right", () => {
    const cases: Array<[number, number, string]> = [
      [250, 0, "right"],
      [180, 180, "down-right"],
      [0, 250, "down"],
      [-180, 180, "down-left"],
      [-250, 0, "left"],
      [-180, -180, "up-left"],
      [0, -250, "up"],
      [180, -180, "up-right"],
    ];
    for (const [dx, dy, dir] of cases) {
      expect(CLOCKWISE[aimSector(dx, dy, -1)]).toBe(dir);
    }
  });

  it("holds the current sector until the pointer is well past its edge (hysteresis)", () => {
    const right = aimSector(...at(10), -1);
    expect(CLOCKWISE[right]).toBe("right");
    // 22.5deg is the boundary; 25deg is inside the hold band, 31deg is past it.
    expect(aimSector(...at(25), right)).toBe(right);
    expect(CLOCKWISE[aimSector(...at(31), right)]).toBe("down-right");
  });

  it("does not hold when coming from the dead zone", () => {
    expect(CLOCKWISE[aimSector(...at(25), -1)]).toBe("down-right");
  });

  it("holds across the wrap-around at the right sector (359deg stays right from 10deg)", () => {
    const right = aimSector(...at(10), -1);
    expect(aimSector(...at(359), right)).toBe(right);
    expect(CLOCKWISE[aimSector(...at(330), right)]).toBe("up-right");
  });
});

describe("sectorDirection", () => {
  it("maps sectors to direction names and the dead zone to center", () => {
    expect(sectorDirection(-1)).toBe("center");
    expect(sectorDirection(0)).toBe("right");
    expect(sectorDirection(6)).toBe("up");
  });
});
