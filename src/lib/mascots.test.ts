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
