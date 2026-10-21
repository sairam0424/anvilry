import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { NotFoundMascot, NOT_FOUND_MASCOT_STORAGE_KEY } from "./not-found-mascot";
import { MASCOT_CHARACTERS, NOT_FOUND_MASCOTS } from "@/lib/mascots";

type Rotating = (typeof NOT_FOUND_MASCOTS)[number];
const labelOf = (c: Rotating) => MASCOT_CHARACTERS[c].label;
const ROTATION_NAME = new RegExp(`^Boop the (${NOT_FOUND_MASCOTS.map(labelOf).join("|")})$`);

beforeEach(() => sessionStorage.clear());
afterEach(() => cleanup());

describe("NotFoundMascot", () => {
  it("reserves the box on the server and renders no mascot there (the pick happens in the browser)", () => {
    const html = renderToStaticMarkup(<NotFoundMascot size={120} />);
    expect(html).not.toContain("Boop the");
    expect(html).toMatch(/min-height:\s*120px/);
  });

  it("renders exactly one of the 404 characters in the browser", () => {
    render(<NotFoundMascot size={120} />);
    expect(screen.getAllByRole("button", { name: ROTATION_NAME })).toHaveLength(1);
  });

  it("remembers what it showed so the next 404 can avoid it", () => {
    render(<NotFoundMascot />);
    const name = screen.getByRole("button", { name: ROTATION_NAME }).getAttribute("aria-label");
    const stored = sessionStorage.getItem(NOT_FOUND_MASCOT_STORAGE_KEY);
    expect(NOT_FOUND_MASCOTS as readonly string[]).toContain(stored);
    expect(name).toBe(`Boop the ${labelOf(stored as Rotating)}`);
  });

  it("never shows the character shown last, across many fresh 404 views", () => {
    for (let i = 0; i < 15; i++) {
      sessionStorage.setItem(NOT_FOUND_MASCOT_STORAGE_KEY, "tv");
      render(<NotFoundMascot />);
      expect(screen.queryByRole("button", { name: "Boop the television" })).toBeNull();
      expect(screen.getByRole("button", { name: ROTATION_NAME })).toBeTruthy();
      cleanup();
    }
  });
});
