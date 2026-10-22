import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FeaturedProjects } from "./featured-projects";
import { allProjects, featuredProjects } from "@/lib/content";

afterEach(cleanup);

describe("FeaturedProjects", () => {
  it("counts the whole collection in its 'View all' link instead of a typed number", () => {
    render(<FeaturedProjects />);
    const link = screen.getByRole("link", { name: `View all ${allProjects.length} projects` });
    expect(link.getAttribute("href")).toBe("/projects");
  });

  it("renders one card per featured project, in featured order", () => {
    render(<FeaturedProjects />);
    const details = screen.getAllByRole("link", { name: /^Details/ });
    expect(details.map((a) => a.getAttribute("href"))).toEqual(featuredProjects.map((p) => p.url));
  });
});
