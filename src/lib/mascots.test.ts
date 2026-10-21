import { describe, it, expect, afterEach, vi } from "vitest";
import {
  MASCOT_CHARACTERS,
  mascotSheets,
  isAboutMascotEnabled,
  isNotFoundMascotEnabled,
} from "./mascots";

afterEach(() => vi.unstubAllEnvs());

describe("mascot character registry", () => {
  it("ships gearbot (hero + about) and crt (404)", () => {
    expect(Object.keys(MASCOT_CHARACTERS).sort()).toEqual(["crt", "gearbot"]);
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
  it("shows the About portrait and the 404 mascot by default", () => {
    expect(isAboutMascotEnabled()).toBe(true);
    expect(isNotFoundMascotEnabled()).toBe(true);
  });

  it("hides each one only on an explicit 'false'", () => {
    vi.stubEnv("NEXT_PUBLIC_ABOUT_MASCOT", "false");
    vi.stubEnv("NEXT_PUBLIC_404_MASCOT", "false");
    expect(isAboutMascotEnabled()).toBe(false);
    expect(isNotFoundMascotEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_ABOUT_MASCOT", "0");
    expect(isAboutMascotEnabled()).toBe(true);
  });
});
