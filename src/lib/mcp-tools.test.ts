import { afterEach, describe, it, expect, vi } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  MAX_CONTENT_LIMIT,
  MAX_PROJECT_LIMIT,
  MAX_WORK_LIMIT,
  PROFILE_SECTIONS,
  READ_ONLY_TOOL_ANNOTATIONS,
  RESUME_ROLES,
  TOOL_INPUT_SHAPES,
  getProfileData,
  listProjectsData,
  getProjectData,
  listWorkData,
  getWorkData,
  searchExperienceData,
  getResumeVariantData,
  listDecisionsData,
  projectGroups,
  wrapToolResult,
} from "./mcp-tools";
import { allDecisions } from "@/lib/decisions";
import { allProjects, allWork, repoLink } from "@/lib/content";
import { profile, skills, achievements } from "@/lib/profile";

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
    expect(d.links.npm).toContain("npmjs.com");
    expect(d.links.pypi).toContain("pypi.org");
    expect(d.links.devto).toContain("dev.to");
    expect(d.links.substack).toContain("substack.com");
    expect(d.skills.length).toBeGreaterThan(0);
    expect(d.achievements.length).toBeGreaterThan(0);
    // Professional-only: no personal fields exposed.
    const json = JSON.stringify(d).toLowerCase();
    for (const leak of [
      "hobbies",
      "funfacts",
      "currentlylearning",
      "askmeabout",
      "now",
    ]) {
      expect(json.includes(`"${leak}"`)).toBe(false);
    }
  });

  it("list_projects / list_work cover the whole content layer (zero drift)", () => {
    expect(listProjectsData().length).toBe(allProjects.length);
    expect(listWorkData().length).toBe(allWork.length);
  });

  it("list_projects and get_project give no repo URL for a private project", () => {
    for (const p of allProjects) {
      const expected = p.visibility === "private" ? null : p.repo;
      expect(listProjectsData().find((x) => x.slug === p.slug)?.repo, `list_projects ${p.slug}`).toBe(expected);
      expect((getProjectData(p.slug) as { repo: string | null }).repo, `get_project ${p.slug}`).toBe(expected);
    }
  });

  it("get_project / get_work resolve a real slug and fail closed on a fake one", () => {
    const realP = allProjects[0].slug;
    expect((getProjectData(realP) as { slug: string }).slug).toBe(realP);
    const badP = getProjectData("totally-fake") as {
      notFound?: true;
      valid?: string[];
    };
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
      const exists =
        allWork.some((w) => w.slug === m.slug) ||
        allProjects.some((p) => p.slug === m.slug);
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
      expect(
        existsSync(join(process.cwd(), "public", path.replace(/^\//, ""))),
      ).toBe(true);
    }
  });

  it("list_decisions returns real ledger entries and supports an optional tag filter", () => {
    const all = listDecisionsData();
    expect(all.length).toBeGreaterThan(0);
    for (const e of all) {
      expect(e.title).toBeTruthy();
      expect(e.body).toBeTruthy();
      expect(e.url).toContain("https://anvilry.vercel.app/");
    }
    // A tag nothing carries yet returns empty, not an error (tags are still unpopulated
    // per the spec's YAGNI deferral — this proves the filter path is safe either way).
    const filtered = listDecisionsData("nonexistent-tag");
    expect(filtered).toEqual([]);
  });

  it("wrapToolResult's structuredContent is always an object, even for array-returning tools", () => {
    // Regression: an `as Record<string, unknown>` cast let a bare array through at the
    // type level, but the MCP SDK's runtime validation rejects a non-object
    // structuredContent — every list_*/search_experience tool failed on every real
    // call until this wrapped arrays in { items }.
    const arrayResult = wrapToolResult(listProjectsData());
    expect(Array.isArray(arrayResult.structuredContent)).toBe(false);
    expect(typeof arrayResult.structuredContent).toBe("object");
    expect(arrayResult.structuredContent).toHaveProperty("items");
    expect(
      Array.isArray(
        (arrayResult.structuredContent as { items: unknown }).items,
      ),
    ).toBe(true);

    const objectResult = wrapToolResult(getProfileData());
    expect(objectResult.structuredContent).toEqual(getProfileData());

    const notFoundResult = wrapToolResult(getProjectData("totally-fake"));
    expect(notFoundResult.isError).toBe(true);
  });
});

const BASE = "https://anvilry.vercel.app";

/** Every property of every tool schema must be something an LLM can act on. */
describe("mcp tool input schemas", () => {
  const tools = Object.entries(TOOL_INPUT_SHAPES);

  it("declares an input schema for all ten tools, none of them empty", () => {
    expect(tools.map(([name]) => name).sort()).toEqual(
      [
        "get_content_item",
        "get_profile",
        "get_project",
        "get_resume_variant",
        "get_work",
        "list_all_content",
        "list_decisions",
        "list_projects",
        "list_work",
        "search_experience",
      ].sort(),
    );
    for (const [name, shape] of tools) {
      expect(Object.keys(shape).length, `${name} has no parameters`).toBeGreaterThan(0);
    }
  });

  it("describes every property with a sentence", () => {
    for (const [name, shape] of tools) {
      for (const [prop, schema] of Object.entries(shape)) {
        const description = (schema as z.ZodTypeAny).description ?? "";
        expect(description.length, `${name}.${prop} needs a description`).toBeGreaterThan(20);
      }
    }
  });

  it("makes every parameter of the four list/profile tools optional", () => {
    for (const name of ["get_profile", "list_projects", "list_work", "list_all_content"] as const) {
      expect(z.object(TOOL_INPUT_SHAPES[name]).safeParse({}).success, name).toBe(true);
    }
  });

  it("bounds the limits and rejects what is out of range", () => {
    const cases = [
      ["list_projects", MAX_PROJECT_LIMIT],
      ["list_work", MAX_WORK_LIMIT],
      ["list_all_content", MAX_CONTENT_LIMIT],
    ] as const;
    for (const [name, max] of cases) {
      const schema = z.object(TOOL_INPUT_SHAPES[name]);
      expect(schema.safeParse({ limit: 1 }).success, `${name} limit 1`).toBe(true);
      expect(schema.safeParse({ limit: max }).success, `${name} limit ${max}`).toBe(true);
      for (const bad of [0, -1, max + 1, 1.5, "5", null]) {
        expect(schema.safeParse({ limit: bad }).success, `${name} limit ${String(bad)}`).toBe(false);
      }
    }
  });

  it("restricts sections and type to their enums", () => {
    const profileSchema = z.object(TOOL_INPUT_SHAPES.get_profile);
    expect(profileSchema.safeParse({ sections: ["links", "skills"] }).success).toBe(true);
    expect(profileSchema.safeParse({ sections: [] }).success).toBe(false);
    expect(profileSchema.safeParse({ sections: ["hobbies"] }).success).toBe(false);
    expect(profileSchema.safeParse({ sections: "links" }).success).toBe(false);
    const contentSchema = z.object(TOOL_INPUT_SHAPES.list_all_content);
    for (const type of ["work", "project", "article", "note"]) {
      expect(contentSchema.safeParse({ type }).success, type).toBe(true);
    }
    expect(contentSchema.safeParse({ type: "personal" }).success).toBe(false);
  });

  it("exposes one shared annotation set that marks the server read-only", () => {
    expect(READ_ONLY_TOOL_ANNOTATIONS).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
  });
});

describe("get_profile sections", () => {
  const IDENTITY = ["name", "role", "company", "tenure", "location", "headline", "summary"];

  it("with no argument returns exactly what it returned before the parameter existed", () => {
    expect(getProfileData()).toEqual({
      name: profile.name,
      role: profile.role,
      company: profile.company,
      tenure: profile.tenure,
      location: profile.location,
      headline: profile.headline,
      summary: profile.subhead,
      links: {
        github: profile.links.github,
        linkedin: profile.links.linkedin,
        npm: profile.links.npm,
        pypi: profile.links.pypi,
        devto: profile.links.devto,
        substack: profile.links.substack,
        site: BASE,
      },
      skills: skills.map((s) => ({ group: s.group, items: s.items })),
      achievements: achievements.map((a) => ({ title: a.title, detail: a.detail })),
    });
    expect(getProfileData(undefined)).toEqual(getProfileData());
    expect(getProfileData([...PROFILE_SECTIONS])).toEqual(getProfileData());
  });

  it.each([
    ["identity", IDENTITY],
    ["links", ["links"]],
    ["skills", ["skills"]],
    ["achievements", ["achievements"]],
  ])("returns only the %s section", (section, keys) => {
    const data = getProfileData([section as (typeof PROFILE_SECTIONS)[number]]);
    expect(Object.keys(data).sort()).toEqual([...keys].sort());
    const full = getProfileData() as Record<string, unknown>;
    for (const key of keys) expect((data as Record<string, unknown>)[key]).toEqual(full[key]);
  });

  it("combines sections, ignores their order and repeats", () => {
    const data = getProfileData(["skills", "links", "skills"]);
    expect(Object.keys(data)).toEqual(Object.keys(getProfileData(["links", "skills"])));
    expect(Object.keys(data).sort()).toEqual(["links", "skills"]);
  });
});

describe("list_projects group and limit", () => {
  const rows = () =>
    allProjects.map((p) => ({
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      group: p.group,
      repo: repoLink(p),
      tech: p.tech,
      url: `${BASE}${p.url}`,
    }));
  const groups = [...new Set(allProjects.map((p) => p.group))];

  it("with no argument returns exactly what it returned before the parameters existed", () => {
    expect(listProjectsData()).toEqual(rows());
    expect(listProjectsData({})).toEqual(rows());
  });

  it("filters by group, case-insensitively, and keeps the content-layer order", () => {
    for (const group of groups) {
      const expected = rows().filter((r) => r.group === group);
      expect(expected.length).toBeGreaterThan(0);
      expect(listProjectsData({ group })).toEqual(expected);
      expect(listProjectsData({ group: group.toUpperCase() })).toEqual(expected);
      expect(listProjectsData({ group: `  ${group.toLowerCase()} ` })).toEqual(expected);
    }
  });

  it("caps the list with limit, after the group filter", () => {
    expect(listProjectsData({ limit: 3 })).toEqual(rows().slice(0, 3));
    expect(listProjectsData({ limit: MAX_PROJECT_LIMIT })).toEqual(rows());
    const [group] = groups;
    const inGroup = rows().filter((r) => r.group === group);
    expect(listProjectsData({ group, limit: 1 })).toEqual(inGroup.slice(0, 1));
  });

  it("answers an unknown group with an empty list plus the valid groups, not a throw", () => {
    const result = listProjectsData({ group: "Not A Group" });
    expect(result).toEqual({
      items: [],
      notFound: true,
      kind: "project_group",
      given: "Not A Group",
      valid: groups,
    });
    const wrapped = wrapToolResult(result);
    expect(wrapped.isError).toBe(true);
    expect(wrapped.structuredContent).toHaveProperty("valid", groups);
  });
});

describe("list_work limit and tech", () => {
  const rows = () =>
    allWork.map((w) => ({
      slug: w.slug,
      name: w.name,
      role: w.role,
      register: w.register,
      metrics: w.metrics,
      tech: w.tech,
      url: `${BASE}${w.url}`,
    }));

  it("with no argument returns exactly what it returned before the parameters existed", () => {
    expect(listWorkData()).toEqual(rows());
    expect(listWorkData({})).toEqual(rows());
  });

  it("filters by a case-insensitive substring of a tech entry", () => {
    const tech = allWork[0].tech[0];
    const expected = rows().filter((r) => r.tech.some((t) => t.toLowerCase().includes(tech.toLowerCase())));
    expect(expected.length).toBeGreaterThan(0);
    expect(listWorkData({ tech })).toEqual(expected);
    expect(listWorkData({ tech: tech.toUpperCase() })).toEqual(expected);
    expect(listWorkData({ tech: tech.slice(0, 3).toLowerCase() })).toEqual(
      rows().filter((r) => r.tech.some((t) => t.toLowerCase().includes(tech.slice(0, 3).toLowerCase()))),
    );
  });

  it("returns an empty list when no case study uses the technology", () => {
    expect(listWorkData({ tech: "zzzznotatechzzzz" })).toEqual([]);
  });

  it("treats a blank tech as no filter", () => {
    expect(listWorkData({ tech: "   " })).toEqual(rows());
  });

  it("caps the list with limit, after the tech filter", () => {
    expect(listWorkData({ limit: 2 })).toEqual(rows().slice(0, 2));
    expect(listWorkData({ limit: MAX_WORK_LIMIT })).toEqual(rows());
    expect(listWorkData({ tech: "python", limit: 1 })).toHaveLength(1);
  });
});

/**
 * list_all_content depends on notes (NEXT_PUBLIC_NOTES_ENABLED is read at module load, and the
 * Vercel build sets it where GitHub CI does not), so each case pins the flag and re-imports.
 */
describe.each([
  ["off", false],
  ["on", true],
])("list_all_content type and limit with notes %s", (_label, notesEnabled) => {
  afterEach(() => vi.unstubAllEnvs());

  async function load() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", notesEnabled ? "true" : "false");
    const [tools, content] = await Promise.all([import("./mcp-tools"), import("@/lib/content")]);
    const expected = [
      ...content.allWork.map((w) => ({ type: "work", slug: w.slug, name: w.name, summary: w.summary, url: `${BASE}${w.url}` })),
      ...content.allProjects.map((p) => ({ type: "project", slug: p.slug, name: p.name, summary: p.tagline, url: `${BASE}${p.url}` })),
      ...content.allArticles.map((a) => ({ type: "article", slug: a.slug, name: a.title, summary: a.summary, url: `${BASE}${a.url}` })),
      ...content.allNotes.map((n) => ({ type: "note", slug: n.slug, name: n.title, summary: n.summary, url: `${BASE}${n.url}` })),
    ];
    return { tools, content, expected };
  }

  it("with no argument returns exactly what it returned before the parameters existed", async () => {
    const { tools, expected } = await load();
    expect(tools.listAllContentData()).toEqual(expected);
    expect(tools.listAllContentData({})).toEqual(expected);
  });

  it("filters by type", async () => {
    const { tools, expected } = await load();
    for (const type of ["work", "project", "article", "note"] as const) {
      expect(tools.listAllContentData({ type }), type).toEqual(expected.filter((i) => i.type === type));
    }
  });

  it("lists notes only while they are published", async () => {
    const { tools, content } = await load();
    const notes = tools.listAllContentData({ type: "note" });
    expect(notes.length).toBe(notesEnabled ? content.publishedNotes.length : 0);
  });

  it("caps the list with limit, after the type filter", async () => {
    const { tools, expected } = await load();
    expect(tools.listAllContentData({ limit: 4 })).toEqual(expected.slice(0, 4));
    expect(tools.listAllContentData({ limit: MAX_CONTENT_LIMIT })).toEqual(expected);
    expect(tools.listAllContentData({ type: "project", limit: 2 })).toEqual(
      expected.filter((i) => i.type === "project").slice(0, 2),
    );
  });
});

/**
 * The filter parameters do not all match the same way (list_decisions.tag is exact and case-sensitive,
 * the project group and tech filters are case-insensitive), so each description must say which rule it
 * applies, and the rule it states must be the one the code applies.
 */
describe("filter parameters state their matching rule", () => {
  const description = (tool: keyof typeof TOOL_INPUT_SHAPES, param: string) =>
    ((TOOL_INPUT_SHAPES[tool] as Record<string, z.ZodTypeAny>)[param].description ?? "").toLowerCase();

  // [tool, parameter, words the description must contain]
  const FILTERS = [
    ["list_projects", "group", ["exact", "case-insensitive"]],
    ["list_work", "tech", ["substring", "case-insensitive"]],
    ["list_all_content", "type", ["exact"]],
    ["list_decisions", "tag", ["exact", "case-sensitive"]],
    ["search_experience", "query", ["substring", "case-insensitive"]],
  ] as const;
  // Parameters that select, cap or look something up rather than match text.
  const NOT_FILTERS = new Set(["get_profile.sections", "get_resume_variant.role", "get_content_item.type"]);
  const isNotFilter = (tool: string, param: string) =>
    NOT_FILTERS.has(`${tool}.${param}`) || param === "limit" || param === "slug";

  it.each(FILTERS)("%s.%s states its rule", (tool, param, words) => {
    for (const word of words) expect(description(tool, param), `${tool}.${param}`).toContain(word);
  });

  it("classifies every parameter of every tool as a filter or not, so a new one cannot skip the rule", () => {
    const filters = new Set(FILTERS.map(([tool, param]) => `${tool}.${param}`));
    for (const [tool, shape] of Object.entries(TOOL_INPUT_SHAPES)) {
      for (const param of Object.keys(shape)) {
        expect(filters.has(`${tool}.${param}`) || isNotFilter(tool, param), `${tool}.${param} is unclassified`).toBe(true);
      }
    }
  });

  it("applies the case rule it states: group, tech and query ignore case, tag does not", () => {
    const [group] = projectGroups();
    expect(listProjectsData({ group: group.toUpperCase() })).toEqual(listProjectsData({ group }));
    expect(listWorkData({ tech: "PYTHON" })).toEqual(listWorkData({ tech: "python" }));
    expect(searchExperienceData("PYTHON")).toEqual({ ...searchExperienceData("python"), query: "PYTHON" });
    const tag = allDecisions.flatMap((entry) => entry.tags).find((t) => t !== t.toLowerCase() || t !== t.toUpperCase());
    expect(tag, "decisions carry a tag with letters").toBeDefined();
    expect(listDecisionsData(tag).length).toBeGreaterThan(0);
    expect(listDecisionsData((tag as string).toUpperCase() === tag ? (tag as string).toLowerCase() : (tag as string).toUpperCase())).toEqual([]);
  });

  it("applies the substring and exact rules it states", () => {
    const tech = allWork[0].tech[0];
    expect(listWorkData({ tech: tech.slice(1, 4) }).map((w) => w.slug)).toContain(allWork[0].slug);
    expect(searchExperienceData("pyth").matches.length).toBeGreaterThan(0);
    const [group] = projectGroups();
    expect(listProjectsData({ group: group.slice(0, 5) })).toHaveProperty("notFound", true);
  });
});
