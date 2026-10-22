import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProjectCard } from "./project-card";
import { allProjects, type Project } from "@/lib/content";

afterEach(cleanup);

const base = allProjects[0];
const make = (over: Partial<Project>): Project => ({ ...base, ...over }) as Project;

describe("ProjectCard repo link", () => {
  it("links a public project's GitHub repo, named for the project", () => {
    render(<ProjectCard project={make({ name: "Alpha", visibility: "public", repo: "https://github.com/o/alpha" })} />);
    const link = screen.getByRole("link", { name: "Alpha on GitHub" });
    expect(link.getAttribute("href")).toBe("https://github.com/o/alpha");
  });

  it("shows a private project as private instead of linking a page that 404s", () => {
    render(<ProjectCard project={make({ name: "Beta", visibility: "private", repo: "https://github.com/o/beta" })} />);
    expect(screen.queryByRole("link", { name: /on GitHub/i })).toBeNull();
    expect(screen.getByText(/private repository/i)).toBeTruthy();
    // The dossier page stays reachable: the card still links to /projects/<slug>.
    expect(screen.getAllByRole("link", { name: /Beta|Details/ }).length).toBeGreaterThan(0);
  });
});
