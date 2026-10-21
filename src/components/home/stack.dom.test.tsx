import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { stackItems } from "@/lib/stack";
import { Stack } from "./stack";

// Reveal switches to a motion whileInView wrapper after mount (IntersectionObserver).
// This test is about the list, so render the children directly — same stubbing style as
// site-footer.dom.test.tsx.
vi.mock("@/components/ui/reveal", () => ({
  Reveal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

afterEach(cleanup);

const renderStack = () =>
  render(
    <TooltipProvider>
      <Stack />
    </TooltipProvider>,
  );

describe("Stack section", () => {
  it("renders the heading and one external link per stack item", () => {
    renderStack();
    expect(
      screen.getByRole("heading", { level: 2, name: "Stack" }),
    ).toBeTruthy();
    const list = screen.getByRole("list", { name: "Tools and technologies" });
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(stackItems.length);
    expect(links.length).toBeGreaterThanOrEqual(19);
  });

  it("each link has exactly one accessible-name source, an https href and a safe rel", () => {
    renderStack();
    const list = screen.getByRole("list", { name: "Tools and technologies" });
    const links = within(list).getAllByRole("link");
    links.forEach((a, idx) => {
      const { name } = stackItems[idx];
      expect(a.getAttribute("aria-label")).toBe(name);
      // The only text inside the link is the mobile caption, which repeats the name and is
      // aria-hidden, so the accessible name has a single source (WCAG 2.5.3 holds either way).
      expect(a.textContent?.trim()).toBe(name);
      expect(a.querySelector("span")?.getAttribute("aria-hidden")).toBe("true");
      expect(a.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      expect(a.getAttribute("href")).toMatch(/^https:\/\//);
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toMatch(/\bnoopener\b/);
      expect(a.getAttribute("rel")).toMatch(/\bnoreferrer\b/);
    });
  });

  it("brand tiles carry per-theme brand colour variables; glyph tiles do not", () => {
    renderStack();
    const list = screen.getByRole("list", { name: "Tools and technologies" });
    const links = within(list).getAllByRole("link");
    links.forEach((a, idx) => {
      const item = stackItems[idx];
      const style = a.getAttribute("style") ?? "";
      if (item.kind === "brand") {
        expect(style, item.name).toContain("--brand-dark");
        expect(style, item.name).toContain("--brand-light");
      } else {
        expect(style, item.name).not.toContain("--brand");
      }
    });
  });
});
