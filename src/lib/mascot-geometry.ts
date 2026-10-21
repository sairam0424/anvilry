/**
 * Pure geometry for the page mascot (src/components/mascot/mascot.tsx): which of the nine
 * sheet cells to show for a pointer offset. Extracted from page-mascot 0.1.0
 * (https://github.com/nilbuild/page-mascot, MIT © 2026 Kamran Ahmed) so the sector logic is
 * unit-testable without a DOM. Both sprite sheets are 3×3 grids read row by row.
 */

export const DIRECTIONS = [
  "up-left",
  "up",
  "up-right",
  "left",
  "center",
  "right",
  "down-left",
  "down",
  "down-right",
] as const;

export const REACTIONS = [
  "blink",
  "heart",
  "sparkle",
  "surprised",
  "wink",
  "bashful",
  "sleepy",
  "dizzy",
  "delighted",
] as const;

export type Direction = (typeof DIRECTIONS)[number];
export type Reaction = (typeof REACTIONS)[number];

/** Sector order, clockwise from the right — matches atan2 with y pointing down. */
export const CLOCKWISE: readonly Direction[] = [
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
];

export const SECTOR = (Math.PI * 2) / CLOCKWISE.length;
/** Radians past a sector edge before the head turns — stops flicker on the boundary. */
export const HYSTERESIS = 0.12;
/** Pointer distance (CSS px) from the head's centre within which it looks straight ahead. */
export const DEAD_ZONE = 70;

/** `background-size: 300% 300%` makes each cell a clean 0/50/100% step on both axes. */
export function cellPosition(index: number): string {
  return `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`;
}

function wrap(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Sector (0–7, clockwise from the right) for a pointer offset from the head's centre, or -1
 * inside the dead zone. `current` is the sector shown now (-1 for none): it is held until the
 * pointer is HYSTERESIS past the sector edge, so a pointer resting on a boundary never jitters.
 */
export function aimSector(dx: number, dy: number, current: number): number {
  if (Math.hypot(dx, dy) < DEAD_ZONE) return -1;
  const angle = Math.atan2(dy, dx);
  if (current !== -1 && Math.abs(wrap(angle - current * SECTOR)) < SECTOR / 2 + HYSTERESIS) {
    return current;
  }
  return (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length;
}

export function sectorDirection(sector: number): Direction {
  return sector === -1 ? "center" : CLOCKWISE[sector];
}
