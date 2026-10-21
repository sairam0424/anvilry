import { describe, it, expect, afterEach, vi } from "vitest";
import {
  MASCOT_CHARACTERS,
  NOT_FOUND_MASCOTS,
  mascotSheets,
  pickNotFoundMascot,
  isAboutMascotEnabled,
  isNotFoundMascotEnabled,
} from "./mascots";

afterEach(() => vi.unstubAllEnvs());

describe("mascot character registry", () => {
  it("ships gearbot (hero + about) and the 404 trio crt, tv, radio", () => {
    expect(Object.keys(MASCOT_CHARACTERS).sort()).toEqual(["crt", "gearbot", "radio", "tv"]);
  });

  it("names every character for the screen reader ('Boop the {label}')", () => {
    expect(MASCOT_CHARACTERS.gearbot.label).toBe("mascot");
    expect(MASCOT_CHARACTERS.crt.label).toBe("CRT monitor");
    expect(MASCOT_CHARACTERS.tv.label).toBe("television");
    expect(MASCOT_CHARACTERS.radio.label).toBe("radio");
  });

  it("resolves each character to two served .webp sheet URLs", () => {
    for (const name of Object.keys(MASCOT_CHARACTERS) as Array<keyof typeof MASCOT_CHARACTERS>) {
      const { directions, reactions } = mascotSheets(name);
      expect(directions).toMatch(new RegExp(`${name}-directions.*\\.webp$`));
      expect(reactions).toMatch(new RegExp(`${name}-reactions.*\\.webp$`));
    }
  });
});

describe("mascot flags", () => {
  it("keeps the About portrait OFF until NEXT_PUBLIC_ABOUT_MASCOT is exactly 'true'", () => {
    expect(isAboutMascotEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_ABOUT_MASCOT", "1");
    expect(isAboutMascotEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_ABOUT_MASCOT", "true");
    expect(isAboutMascotEnabled()).toBe(true);
  });

  it("shows the 404 mascot by default and hides it only on an explicit 'false'", () => {
    expect(isNotFoundMascotEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_404_MASCOT", "0");
    expect(isNotFoundMascotEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_404_MASCOT", "false");
    expect(isNotFoundMascotEnabled()).toBe(false);
  });
});

describe("pickNotFoundMascot", () => {
  it("rotates through the three 404 receivers", () => {
    expect([...NOT_FOUND_MASCOTS]).toEqual(["crt", "tv", "radio"]);
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

  it("draws from all three when nothing was shown before or the stored value is junk", () => {
    expect(pickNotFoundMascot(null, () => 0)).toBe("crt");
    expect(pickNotFoundMascot(null, () => 0.5)).toBe("tv");
    expect(pickNotFoundMascot(null, () => 0.99)).toBe("radio");
    expect(pickNotFoundMascot("gearbot", () => 0.99)).toBe("radio");
    expect(pickNotFoundMascot("not-a-character", () => 0)).toBe("crt");
  });

  it("maps the random draw evenly over the remaining two", () => {
    expect(pickNotFoundMascot("crt", () => 0)).toBe("tv");
    expect(pickNotFoundMascot("crt", () => 0.49)).toBe("tv");
    expect(pickNotFoundMascot("crt", () => 0.5)).toBe("radio");
    expect(pickNotFoundMascot("tv", () => 0.99)).toBe("radio");
    expect(pickNotFoundMascot("radio", () => 0.99)).toBe("tv");
  });
});
