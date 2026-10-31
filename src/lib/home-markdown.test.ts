import { describe, expect, it } from "vitest";
import { allProjects, allWork, featuredProjects, publicProjects } from "@/lib/content";
import { buildHomeMarkdown } from "./home-markdown";
import { buildLlmsTxt } from "./llms-txt";
import { profile } from "./profile";

/**
 * The homepage's Markdown twin is served to an agent that sends Accept: text/markdown to "/".
 * It must carry what the HTML homepage shows (identity, work, featured projects, contact) and
 * point at the machine-readable surfaces, and it must be derived from the same data so it can
 * never drift from the page.
 */

const md = buildHomeMarkdown();

describe("buildHomeMarkdown", () => {
  it("opens with one H1 carrying the owner's name and no HTML", () => {
    const h1s = md.split("\n").filter((line) => line.startsWith("# "));
    expect(h1s).toEqual([`# ${profile.name}`]);
    expect(md).not.toMatch(/<\/?(div|span|script|style|a|p)\b/i);
  });

  it("states role, company, location and the headline", () => {
    expect(md).toContain(profile.role);
    expect(md).toContain(profile.company);
    expect(md).toContain(profile.location);
    expect(md).toContain(profile.headline);
  });

  it("lists every work item and every featured project with an absolute link and a Markdown twin", () => {
    for (const w of allWork) {
      expect(md).toContain(`(https://anvilry.vercel.app${w.url})`);
      expect(md).toContain(`(https://anvilry.vercel.app${w.url}.md)`);
    }
    expect(featuredProjects.length).toBeGreaterThan(0);
    for (const p of featuredProjects) {
      expect(md).toContain(`[${p.name}](https://anvilry.vercel.app${p.url})`);
    }
  });

  it("counts private repositories honestly in the featured-projects heading", () => {
    expect(publicProjects.length).toBeLessThan(allProjects.length);
    expect(md).toContain(
      `(${featuredProjects.length} of ${allProjects.length} projects; ${publicProjects.length} have public repositories)`,
    );
  });

  it("describes llms-full.txt as the grounding corpus, not as a list of every article", () => {
    expect(md).not.toMatch(/llms-full\.txt[^\n]*article/);
  });

  it("gives the same contact channels the Contact section shows", () => {
    expect(md).toContain(profile.email);
    expect(md).toContain(profile.calendlyUrl);
    expect(md).toContain(profile.links.github);
    expect(md).toContain(profile.links.linkedin);
  });

  it("points an agent at the machine-readable surfaces", () => {
    for (const path of ["/llms.txt", "/llms-full.txt", "/api/mcp/mcp", "/api/resume.json", "/openapi.json", "/developers", "/feed.xml", "/sitemap.xml"]) {
      expect(md).toContain(`https://anvilry.vercel.app${path}`);
    }
    expect(md).toContain("Accept: text/markdown");
  });

  it("uses only absolute http(s) links, so an agent can follow them from anywhere", () => {
    const links = [...md.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(20);
    for (const href of links) expect(href).toMatch(/^https?:\/\//);
  });

  it("shares the availability sentence with llms.txt", () => {
    expect(md).toContain(profile.availability);
    expect(buildLlmsTxt()).toContain(profile.availability);
  });
});
