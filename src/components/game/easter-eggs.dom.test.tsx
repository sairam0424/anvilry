import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import { EasterEggs } from "./easter-eggs";

/**
 * The global Konami egg: fires anywhere, reveals an accessible (Esc-dismissible,
 * non-trapping) card, and is SUPPRESSED while a text input is focused so it never
 * fights the terminal's ↑/↓ history. (personal.ts is empty in tests → the card shows
 * the celebratory fallback, not fabricated content.)
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
  cleanup(); // unmount between tests so cards don't accumulate in the shared body
});

describe("EasterEggs — global Konami", () => {
  it("reveals the card after the Konami sequence", () => {
    render(<EasterEggs />);
    expect(screen.queryByRole("status")).toBeNull();
    fireKonami();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("Esc dismisses the card (disclosure, not a trap)", () => {
    render(<EasterEggs />);
    fireKonami();
    expect(screen.getByRole("status")).toBeTruthy();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(screen.queryByRole("status")).toBeNull();
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
    expect(document.activeElement).toBe(input);
    // Fire the sequence as if typed into the focused input.
    for (const key of KONAMI) {
      act(() => {
        fireEvent.keyDown(input, { key, bubbles: true });
      });
    }
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("a dismiss button is present and labelled", () => {
    render(<EasterEggs />);
    fireKonami();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeTruthy();
  });
});
