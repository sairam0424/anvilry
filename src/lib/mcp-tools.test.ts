import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  RESUME_ROLES,
  getProfileData,
  listProjectsData,
  getProjectData,
  listWorkData,
  getWorkData,
  searchExperienceData,
  getResumeVariantData,
} from "./mcp-tools";
import { allProjects, allWork } from "@/lib/content";

/**
 * The MCP tools must return ONLY real content-layer data (zero fabrication), fail closed
 * on bad input (never throw / never invent), stay professional-only (no personal.ts
 * leak), and every résumé variant must map to a real PDF on disk.
 */
describe("mcp tools", () => {
  it("get_profile returns identity + skills + achievements and does NOT leak personal.ts", () => {
    const d = getProfileData();
    expect(d.name).toBeTruthy();
    expect(d.role).toBeTruthy();
    expect(d.links.github).toContain("github.com");
    expect(d.skills.length).toBeGreaterThan(0);
    expect(d.achievements.length).toBeGreaterThan(0);
    // Professional-only: no personal fields exposed.
    const json = JSON.stringify(d).toLowerCase();
    for (const leak of ["hobbies", "funfacts", "currentlylearning", "askmeabout", "now"]) {
      expect(json.includes(`"${leak}"`)).toBe(false);
    }
  });

  it("list_projects / list_work cover the whole content layer (zero drift)", () => {
    expect(listProjectsData().length).toBe(allProjects.length);
    expect(listWorkData().length).toBe(allWork.length);
  });

  it("get_project / get_work resolve a real slug and fail closed on a fake one", () => {
    const realP = allProjects[0].slug;
    expect((getProjectData(realP) as { slug: string }).slug).toBe(realP);
    const badP = getProjectData("totally-fake") as { notFound?: true; valid?: string[] };
    expect(badP.notFound).toBe(true);
    expect(badP.valid).toContain(realP);

    const realW = allWork[0].slug;
    expect((getWorkData(realW) as { slug: string }).slug).toBe(realW);
    expect((getWorkData("nope") as { notFound?: true }).notFound).toBe(true);
  });

  it("search_experience matches only real content; a no-match query returns empty arrays", () => {
    const hit = searchExperienceData("python");
    expect(hit.matches.length + hit.skills.length).toBeGreaterThan(0);
    for (const m of hit.matches) {
      const exists = allWork.some((w) => w.slug === m.slug) || allProjects.some((p) => p.slug === m.slug);
      expect(exists).toBe(true);
    }
    const none = searchExperienceData("zzzznotarealtermzzzz");
    expect(none.matches).toEqual([]);
    expect(none.skills).toEqual([]);
  });

  it("every résumé role maps to a real variant whose PDF exists on disk", () => {
    for (const role of RESUME_ROLES) {
      const v = getResumeVariantData(role) as { url?: string; notFound?: true };
      expect(v.notFound, `role ${role} should resolve`).toBeUndefined();
      const path = (v.url ?? "").replace("https://anvilry.vercel.app", "");
      expect(existsSync(join(process.cwd(), "public", path.replace(/^\//, "")))).toBe(true);
    }
  });
});
