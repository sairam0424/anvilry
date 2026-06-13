import { describe, it, expect } from "vitest";
import { nextHistoryIndex } from "./history";

/**
 * Boundary coverage for the ↑/↓ history index walk — the most off-by-one-prone code
 * in the terminal. `-1` = "not browsing" (live input). Newest entry is last.
 */
describe("nextHistoryIndex", () => {
  const H = ["ls", "whoami", "stack"]; // oldest -> newest

  it("empty history: both directions ignore the keypress (value null, idx unchanged)", () => {
    expect(nextHistoryIndex([], -1, "up")).toEqual({ idx: -1, value: null });
    expect(nextHistoryIndex([], -1, "down")).toEqual({ idx: -1, value: null });
  });

  it("up from the live input (-1) jumps to the newest entry", () => {
    expect(nextHistoryIndex(H, -1, "up")).toEqual({ idx: 2, value: "stack" });
  });

  it("repeated up walks toward the oldest and clamps at 0", () => {
    expect(nextHistoryIndex(H, 2, "up")).toEqual({ idx: 1, value: "whoami" });
    expect(nextHistoryIndex(H, 1, "up")).toEqual({ idx: 0, value: "ls" });
    expect(nextHistoryIndex(H, 0, "up")).toEqual({ idx: 0, value: "ls" }); // clamped
  });

  it("down from the live input (-1) is ignored (can't go newer than live)", () => {
    expect(nextHistoryIndex(H, -1, "down")).toEqual({ idx: -1, value: null });
  });

  it("down walks back toward the newest", () => {
    expect(nextHistoryIndex(H, 0, "down")).toEqual({ idx: 1, value: "whoami" });
    expect(nextHistoryIndex(H, 1, "down")).toEqual({ idx: 2, value: "stack" });
  });

  it("down past the newest resets to the live input and clears", () => {
    expect(nextHistoryIndex(H, 2, "down")).toEqual({ idx: -1, value: "" });
  });

  it("single-entry history: up selects it, up again stays, down past clears", () => {
    const one = ["only"];
    expect(nextHistoryIndex(one, -1, "up")).toEqual({ idx: 0, value: "only" });
    expect(nextHistoryIndex(one, 0, "up")).toEqual({ idx: 0, value: "only" });
    expect(nextHistoryIndex(one, 0, "down")).toEqual({ idx: -1, value: "" });
  });

  it("round-trip up→down→up lands consistently", () => {
    const a = nextHistoryIndex(H, -1, "up"); // idx 2
    const b = nextHistoryIndex(H, a.idx, "up"); // idx 1
    const c = nextHistoryIndex(H, b.idx, "down"); // idx 2
    expect(c).toEqual({ idx: 2, value: "stack" });
  });
});
