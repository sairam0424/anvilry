import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { personal } from "@/lib/personal";
import { EasterEggs } from "./easter-eggs";

/**
 * The global Konami egg: fires anywhere, reveals an accessible (focusable, Esc-
 * dismissible, non-trapping) dialog card, restores focus on close, and is SUPPRESSED
 * while a text input is focused so it never fights the terminal's ↑/↓ history.
 *
 * personal.ts is POPULATED in the repo, so the card renders a real owner fact + a
 * pointer to `secret` (asserted below). A separate suite mocks an EMPTY personal module
 * to pin the "Thanks for exploring" fallback (the empty-safe contract).
 */
const KONAMI = [
  "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
  "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
  "b", "a",
];

const fireKonami = () => {
  for (const key of KONAMI) {
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
  }
};

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

afterEach(() => {
  cleanup();
  vi.resetModules();
});

describe("EasterEggs — global Konami (populated personal.ts)", () => {
  it("reveals the dialog card after the Konami sequence", () => {
    render(<EasterEggs />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireKonami();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("reveals a REAL owner fact + a pointer to `secret` (reveal payload contract)", () => {
    render(<EasterEggs />);
    fireKonami();
    const card = screen.getByRole("dialog");
    const expectedFact =
      personal.funFacts[0] ?? personal.hobbies[0] ?? personal.currentlyLearning[0];
    expect(card.textContent).toContain(expectedFact);
    expect(card.textContent).toMatch(/secret/i);
  });

  it("is a labelled dialog (accessible name from its heading)", () => {
    render(<EasterEggs />);
    fireKonami();
    // getByRole with name resolves via aria-labelledby → the heading text.
    expect(screen.getByRole("dialog", { name: /you know the code/i })).toBeTruthy();
  });

  it("Esc dismisses the card and restores focus to the prior element (WCAG 2.4.3)", async () => {
    render(
      <>
        <button>prior focus</button>
        <EasterEggs />
      </>,
    );
    const prior = screen.getByRole("button", { name: "prior focus" });
    prior.focus();
    expect(document.activeElement).toBe(prior);

    fireKonami();
    expect(screen.getByRole("dialog")).toBeTruthy();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(prior));
  });

  it("does NOT fire while a text input is focused (no fighting terminal history)", () => {
    render(
      <>
        <input aria-label="Terminal command input" />
        <EasterEggs />
      </>,
    );
    const input = screen.getByLabelText("Terminal command input");
    input.focus();
    for (const key of KONAMI) {
      act(() => fireEvent.keyDown(input, { key, bubbles: true }));
    }
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the dismiss button is labelled (a11y) and present", () => {
    render(<EasterEggs />);
    fireKonami();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeTruthy();
  });
});

describe("EasterEggs — empty personal.ts (empty-safe fallback)", () => {
  it("shows the celebratory fallback (no fabricated fact) when personal is empty", async () => {
    vi.resetModules();
    vi.doMock("@/lib/personal", () => ({
      personal: { hobbies: [], funFacts: [], currentlyLearning: [], askMeAbout: [], uses: [] },
      now: { updated: "", focus: [] },
      hasPersonalContent: false,
      hasNow: false,
    }));
    const { EasterEggs: EmptyEggs } = await import("./easter-eggs");
    render(<EmptyEggs />);
    fireKonami();
    const card = screen.getByRole("dialog");
    expect(card.textContent).toMatch(/thanks for exploring/i);
    expect(card.textContent).not.toMatch(/secret/i); // no pointer when there's nothing to find
    vi.doUnmock("@/lib/personal");
  });
});
