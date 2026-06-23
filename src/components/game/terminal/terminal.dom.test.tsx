import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/view-context", () => ({ useView: () => ({ view: "developer", setView: vi.fn() }) }));
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

import { Terminal } from "./terminal";

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
});

afterEach(() => {
  cleanup();
});

describe("Terminal combobox ARIA pattern (WCAG 4.1.2)", () => {
  it("input has role=combobox so aria-expanded is a valid attribute", () => {
    render(<Terminal />);
    const input = screen.getByRole("combobox", { name: /terminal command input/i });
    expect(input).toBeTruthy();
  });

  it("input has aria-controls pointing to the listbox", () => {
    render(<Terminal />);
    const input = screen.getByRole("combobox", { name: /terminal command input/i });
    const listboxId = input.getAttribute("aria-controls");
    expect(listboxId).toBeTruthy();
    const listbox = document.getElementById(listboxId!);
    expect(listbox).toBeTruthy();
    expect(listbox?.getAttribute("role")).toBe("listbox");
  });

  it("listbox is always in the DOM (not conditionally rendered)", () => {
    render(<Terminal />);
    const listbox = document.getElementById("terminal-cmd-listbox");
    expect(listbox).toBeTruthy();
  });

  it("aria-expanded is false when no suggestions are showing", () => {
    render(<Terminal />);
    const input = screen.getByRole("combobox", { name: /terminal command input/i });
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });
});
