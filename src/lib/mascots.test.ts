import { describe, it, expect } from "vitest";
import {
  MASCOT_CHARACTERS,
  NOT_FOUND_MASCOTS,
  mascotSheets,
  pickNotFoundMascot,
} from "./mascots";

/** The 404 rotation: the three receivers first, then the rest of the "things", then the penguin. */
const ROTATION = [
  "crt", "tv", "radio", "toaster", "clockwork", "cube", "drone",
  "knight", "lantern", "postbot", "rocket", "scout", "penguin",
];

const LABELS: Record<string, string> = {
  gearbot: "mascot",
  crt: "CRT monitor",
  tv: "television",
  radio: "radio",
  toaster: "toaster",
  clockwork: "clockwork robot",
  cube: "cube robot",
  drone: "drone",
  knight: "knight",
  lantern: "lantern robot",
  postbot: "mail robot",
  rocket: "rocket",
  scout: "scout robot",
  penguin: "penguin",
};

describe("mascot character registry", () => {
  it("ships the site head (gearbot) plus the thirteen 404 characters", () => {
    expect(Object.keys(MASCOT_CHARACTERS).sort()).toEqual(["gearbot", ...ROTATION].sort());
  });

  it("names every character for the screen reader ('Boop the {label}'), no two alike", () => {
    for (const [name, label] of Object.entries(LABELS)) {
      expect(MASCOT_CHARACTERS[name as keyof typeof MASCOT_CHARACTERS].label).toBe(label);
    }
    const labels = Object.values(MASCOT_CHARACTERS).map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("resolves each character to two served .webp sheet URLs", () => {
    for (const name of Object.keys(MASCOT_CHARACTERS) as Array<keyof typeof MASCOT_CHARACTERS>) {
      const { directions, reactions } = mascotSheets(name);
      expect(directions).toMatch(new RegExp(`${name}-directions.*\\.webp$`));
      expect(reactions).toMatch(new RegExp(`${name}-reactions.*\\.webp$`));
    }
  });
});

describe("pickNotFoundMascot", () => {
  it("rotates through the thirteen 404 characters and never the site's own head", () => {
    expect([...NOT_FOUND_MASCOTS]).toEqual(ROTATION);
    expect(NOT_FOUND_MASCOTS as readonly string[]).not.toContain("gearbot");
  });

  it("never repeats the character shown last, for any random draw", () => {
    for (const last of NOT_FOUND_MASCOTS) {
      for (let i = 0; i < 100; i++) {
        const pick = pickNotFoundMascot(last, () => i / 100);
        expect(pick).not.toBe(last);
        expect(NOT_FOUND_MASCOTS).toContain(pick);
      }
    }
  });

  it("can reach every character when nothing was shown before or the stored value is junk", () => {
    const n = NOT_FOUND_MASCOTS.length;
    const reached = new Set(NOT_FOUND_MASCOTS.map((_, i) => pickNotFoundMascot(null, () => i / n)));
    expect(reached.size).toBe(n);
    expect(pickNotFoundMascot("gearbot", () => 0)).toBe("crt");
    expect(pickNotFoundMascot("not-a-character", () => 0.999)).toBe("penguin");
  });

  it("maps the draw evenly over the remaining characters, in rotation order", () => {
    expect(pickNotFoundMascot("crt", () => 0)).toBe("tv");
    expect(pickNotFoundMascot("crt", () => 0.999)).toBe("penguin");
    expect(pickNotFoundMascot("penguin", () => 0.999)).toBe("scout");
    const n = NOT_FOUND_MASCOTS.length - 1;
    const reached = new Set(Array.from({ length: n }, (_, i) => pickNotFoundMascot("tv", () => i / n)));
    expect(reached.size).toBe(n);
    expect(reached.has("tv")).toBe(false);
  });
});
