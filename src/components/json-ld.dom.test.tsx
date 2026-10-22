import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SoftwareSourceCodeJsonLd } from "./json-ld";

afterEach(cleanup);

const read = (container: HTMLElement) =>
  JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}");

describe("SoftwareSourceCodeJsonLd", () => {
  const props = { name: "Alpha", description: "d", url: "https://anvilry.vercel.app/projects/alpha", tech: ["Go", "Redis"] };

  it("declares the code repository when there is a public one", () => {
    const { container } = render(<SoftwareSourceCodeJsonLd {...props} codeRepository="https://github.com/o/alpha" />);
    expect(read(container).codeRepository).toBe("https://github.com/o/alpha");
  });

  it("leaves codeRepository out for a private repository instead of advertising a 404", () => {
    const { container } = render(<SoftwareSourceCodeJsonLd {...props} />);
    const data = read(container);
    expect(data["@type"]).toBe("SoftwareSourceCode");
    expect("codeRepository" in data).toBe(false);
  });
});
