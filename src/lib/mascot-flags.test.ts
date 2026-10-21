import { describe, it, expect, afterEach, vi } from "vitest";
import { isAboutMascotEnabled, isNotFoundMascotEnabled } from "./mascot-flags";

afterEach(() => vi.unstubAllEnvs());

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
