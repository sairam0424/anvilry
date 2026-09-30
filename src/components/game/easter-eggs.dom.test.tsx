import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
} from "vitest";
import { StrictMode } from "react";
import { render, act, cleanup } from "@testing-library/react";
import { profile } from "@/lib/profile";

/**
 * What is left of the old easter-egg component: the DevTools console greeting. The
 * Konami code (its card, its hint in the Developer view and its discovery badge) was
 * removed at the owner's request; the greeting stays.
 *
 * `consoleGreeted` is MODULE state (it is what makes the greeting fire once per page
 * load), so every test loads a fresh copy of the module (vi.resetModules + a dynamic
 * import) instead of sharing the one a top-level import would give all of them.
 */
const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

let logSpy: MockInstance<typeof console.log>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  logSpy.mockRestore();
  vi.doUnmock("@/lib/personal");
  vi.resetModules();
});

async function loadEasterEggs(
  opts: { personal: boolean } = { personal: true },
) {
  vi.resetModules();
  if (!opts.personal) {
    vi.doMock("@/lib/personal", () => ({
      personal: {
        hobbies: [],
        funFacts: [],
        currentlyLearning: [],
        askMeAbout: [],
        uses: [],
      },
      now: { updated: "", focus: [] },
      hasPersonalContent: false,
      hasNow: false,
    }));
  }
  const mod = await import("./easter-eggs");
  return mod.EasterEggs;
}

/** Everything the greeting printed, as one string (format string plus %c styles). */
const printed = () =>
  logSpy.mock.calls.map((args) => args.join(" ")).join("\n");

describe("EasterEggs — the DevTools console greeting", () => {
  it("logs exactly once per page load, across StrictMode double effects and re-mounts", async () => {
    const EasterEggs = await loadEasterEggs();
    const first = render(
      <StrictMode>
        <EasterEggs />
      </StrictMode>,
    );
    first.unmount();
    render(<EasterEggs />);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("names the owner and every contact link", async () => {
    const EasterEggs = await loadEasterEggs();
    render(<EasterEggs />);
    const text = printed();
    expect(text).toContain(profile.name);
    expect(text).toContain("you found the console");
    for (const value of [
      profile.email,
      profile.links.github,
      profile.links.npm,
      profile.links.pypi,
      profile.links.devto,
      profile.links.substack,
    ]) {
      expect(text).toContain(value);
    }
  });

  it("points at the hidden `secret` command when personal content exists, and never at the Konami code", async () => {
    const EasterEggs = await loadEasterEggs();
    render(<EasterEggs />);
    expect(printed()).toContain("type `secret` in Developer mode");
    expect(printed()).not.toMatch(/konami/i);
  });

  it("prints no hint at all when there is no personal content (empty-safe)", async () => {
    const EasterEggs = await loadEasterEggs({ personal: false });
    render(<EasterEggs />);
    const text = printed();
    expect(text).toContain("you found the console");
    expect(text).not.toMatch(/psst|secret|konami/i);
  });
});

describe("EasterEggs — the Konami code is gone", () => {
  it("renders nothing and ignores the old key sequence (no dialog, no card)", async () => {
    const EasterEggs = await loadEasterEggs();
    const { container } = render(<EasterEggs />);
    for (const key of KONAMI) {
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true }),
        );
      });
    }
    expect(container.innerHTML).toBe("");
    expect(document.body.querySelector("[role='dialog']")).toBeNull();
    expect(document.body.textContent).not.toMatch(/you know the code/i);
  });
});
