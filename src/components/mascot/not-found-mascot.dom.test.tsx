import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { NotFoundMascot, NOT_FOUND_MASCOT_STORAGE_KEY } from "./not-found-mascot";

const TRIO_NAME = /^Boop the (CRT monitor|television|radio)$/;

beforeEach(() => sessionStorage.clear());
afterEach(() => cleanup());

describe("NotFoundMascot", () => {
  it("reserves the box on the server and renders no mascot there (the pick happens in the browser)", () => {
    const html = renderToStaticMarkup(<NotFoundMascot size={120} />);
    expect(html).not.toContain("Boop the");
    expect(html).toMatch(/min-height:\s*120px/);
  });

  it("renders exactly one of the three 404 receivers in the browser", () => {
    render(<NotFoundMascot size={120} />);
    const buttons = screen.getAllByRole("button", { name: TRIO_NAME });
    expect(buttons).toHaveLength(1);
  });

  it("remembers what it showed so the next 404 can avoid it", () => {
    render(<NotFoundMascot />);
    const name = screen.getByRole("button", { name: TRIO_NAME }).getAttribute("aria-label");
    const stored = sessionStorage.getItem(NOT_FOUND_MASCOT_STORAGE_KEY);
    expect(["crt", "tv", "radio"]).toContain(stored);
    const labelFor = { crt: "CRT monitor", tv: "television", radio: "radio" } as const;
    expect(name).toBe(`Boop the ${labelFor[stored as keyof typeof labelFor]}`);
  });

  it("never shows the character shown last, across many fresh 404 views", () => {
    for (let i = 0; i < 15; i++) {
      sessionStorage.setItem(NOT_FOUND_MASCOT_STORAGE_KEY, "tv");
      render(<NotFoundMascot />);
      expect(screen.queryByRole("button", { name: "Boop the television" })).toBeNull();
      expect(screen.getByRole("button", { name: TRIO_NAME })).toBeTruthy();
      cleanup();
    }
  });
});
