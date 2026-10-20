import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SkillChip } from "./skill-chip";

afterEach(cleanup);

describe("SkillChip", () => {
  it("renders a brand skill as glyph + label, with the glyph decorative and brand-coloured on hover", () => {
    const { container } = render(<SkillChip name="Python" />);
    expect(screen.getByText("Python")).toBeTruthy();
    const glyph = container.querySelector(".skill-chip-glyph");
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
    expect(glyph?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(glyph?.getAttribute("style")).toContain("--brand-dark");
    expect(glyph?.getAttribute("style")).toContain("--brand-light");
  });

  it("renders a licence-free tool (AWS) with the neutral lucide glyph and no brand variables", () => {
    const { container } = render(<SkillChip name="AWS" />);
    expect(screen.getByText("AWS")).toBeTruthy();
    const glyph = container.querySelector(".skill-chip-glyph");
    expect(glyph?.querySelector("svg")).toBeTruthy();
    expect(glyph?.getAttribute("style") ?? "").not.toContain("--brand");
  });

  it("renders a concept skill as text only", () => {
    const { container } = render(<SkillChip name="Microservices" />);
    expect(screen.getByText("Microservices")).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector(".skill-chip-glyph")).toBeNull();
  });

  it("keeps the label as the only text content so the accessible name is unchanged", () => {
    const { container } = render(<SkillChip name="Apache Kafka" />);
    expect(container.textContent?.trim()).toBe("Apache Kafka");
  });
});
