import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The personal-reveal commands must be EMPTY-SAFE: when src/lib/personal.ts is
 * unpopulated, secret/uses/now print an honest "coming soon" (never a fabricated fact),
 * and the whoami breadcrumb is suppressed. The real module IS populated, so we mock an
 * empty one here to exercise the empty branch that the populated repo can't reach.
 */
vi.mock("@/lib/personal", () => ({
  personal: { hobbies: [], funFacts: [], currentlyLearning: [], askMeAbout: [], uses: [] },
  now: { updated: "", focus: [] },
  hasPersonalContent: false,
  hasNow: false,
}));

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("personal commands — empty-safe (mocked empty personal.ts)", () => {
  it("secret/uses/now print honest 'coming soon', never a fabricated fact", async () => {
    const { runCommand } = await import("./commands");
    expect(runCommand("secret").lines.map((l) => l.text).join("\n")).toMatch(/coming soon/i);
    expect(runCommand("uses").lines.map((l) => l.text).join("\n")).toMatch(/coming soon/i);
    expect(runCommand("now").lines.map((l) => l.text).join("\n")).toMatch(/nothing pinned/i);
    // None of them error.
    for (const cmd of ["secret", "uses", "now"]) {
      expect(runCommand(cmd).lines.some((l) => l.kind === "err")).toBe(false);
    }
  });

  it("the whoami/about breadcrumb is suppressed when there's nothing to find", async () => {
    const { runCommand } = await import("./commands");
    expect(runCommand("whoami").lines.map((l) => l.text).join("\n")).not.toMatch(/try 'secret'/);
    expect(runCommand("about").lines.map((l) => l.text).join("\n")).not.toMatch(/personal side/i);
  });
});
