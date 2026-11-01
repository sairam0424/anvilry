import { z } from "zod";
import {
  allProjects,
  allWork,
  allArticles,
  allNotes,
  getProject,
  getWork,
  repoLink,
} from "@/lib/content";
import { profile, skills, achievements, resumeVariants } from "@/lib/profile";
import { allDecisions } from "@/lib/decisions";

/**
 * Pure, transport-agnostic logic for the portfolio MCP server (src/app/api/mcp). Reads
 * ONLY the existing content layer (content.ts + profile.ts) so every tool result traces
 * to a real source — zero fabrication, no LLM cost, no drift. Mirrors the single-source
 * pattern of llms-txt.ts / resume-json.ts; the route is thin wiring around these.
 *
 * Deliberately PROFESSIONAL-ONLY: personal.ts (hobbies/now/uses) is NOT exposed — those
 * stay reachable on-site via the eggs, not handed to every AI agent as structured data.
 */
const BASE = "https://anvilry.vercel.app";

export const RESUME_ROLES = ["master"] as const;
type ResumeRole = (typeof RESUME_ROLES)[number];

// Map the public role keyword -> the real resumeVariants label (single source).
const ROLE_TO_LABEL: Record<ResumeRole, string> = {
  master: "Sairam Resume",
  // Role-targeted variants were retired: only the canonical résumé is published. Re-adding a
  // role needs three edits or get_resume_variant returns notFound — the keyword in
  // RESUME_ROLES above, its exact resumeVariants[].label here, and the PDF in public/resume/.
  // Never publish more than one label for the same employer and dates.
};

export const PROFILE_SECTIONS = ["identity", "links", "skills", "achievements"] as const;
type ProfileSection = (typeof PROFILE_SECTIONS)[number];

const CONTENT_TYPES = ["work", "project", "article", "note"] as const;
type ContentType = (typeof CONTENT_TYPES)[number];

/** Upper bounds of the `limit` parameters: far above today's counts, below any payload worth capping. */
export const MAX_PROJECT_LIMIT = 100;
export const MAX_WORK_LIMIT = 50;
export const MAX_CONTENT_LIMIT = 200;
const MAX_GROUP_LENGTH = 80;
const MAX_TECH_LENGTH = 60;

/** Every tool only reads the content layer: hints for clients that gate or auto-approve calls. */
export const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

// Zod input schemas (raw-shape form for mcp-handler's registerTool).
const projectSlugSchema = {
  slug: z.string().describe("project slug, e.g. mindforge"),
};
const workSlugSchema = {
  slug: z.string().describe("work slug, e.g. pensieve"),
};
const searchSchema = {
  query: z
    .string()
    .min(1)
    .max(120)
    .describe(
      "Keywords, e.g. 'kafka' or 'multi-agent'. The rule is a case-insensitive substring match of the whole query as one phrase (not word by word) against work, project and skill text.",
    ),
};
const resumeRoleSchema = {
  role: z
    .enum(RESUME_ROLES)
    .describe("target role flavor for the résumé variant"),
};
const profileSectionsSchema = {
  sections: z
    .array(z.enum(PROFILE_SECTIONS))
    .min(1)
    .max(PROFILE_SECTIONS.length)
    .optional()
    .describe(
      "Which parts of the profile to return: identity (name, role, company, tenure, location, headline, summary), links, skills, achievements. Omit to get all four.",
    ),
};

const limitSchema = (max: number, what: string, detail = "") =>
  z
    .number()
    .int()
    .min(1)
    .max(max)
    .optional()
    .describe(
      `Maximum number of ${what} to return, from 1 to ${max}. ${detail}Omit for all of them.`,
    );

const projectListSchema = {
  group: z
    .string()
    .min(1)
    .max(MAX_GROUP_LENGTH)
    .optional()
    .describe(
      "Return only the projects in this group. The rule is an exact match on the whole group name, case-insensitive and ignoring surrounding spaces, e.g. 'Tooling & Lab'. An unknown name (text of only spaces included) returns an error that lists the valid groups; the empty string is rejected. Omit for every group.",
    ),
  limit: limitSchema(MAX_PROJECT_LIMIT, "projects"),
};
const workListSchema = {
  tech: z
    .string()
    .min(1)
    .max(MAX_TECH_LENGTH)
    .optional()
    .describe(
      "Return only the case studies whose tech list has an entry containing this text. The rule is a case-insensitive substring match against each entry, e.g. 'python' or 'sse'. Text of only spaces applies no filter; the empty string is rejected. Omit for all of them.",
    ),
  limit: limitSchema(MAX_WORK_LIMIT, "case studies"),
};
const contentListSchema = {
  type: z
    .enum(CONTENT_TYPES)
    .optional()
    .describe(
      "Return only this kind of content: work, project, article or note. The rule is an exact match on the item's type. Notes are listed only while the notes section is published. Omit for every kind.",
    ),
  limit: limitSchema(MAX_CONTENT_LIMIT, "items", "Applied after the type filter. "),
};

const projectSlugs = () => allProjects.map((p) => p.slug);
const workSlugs = () => allWork.map((w) => w.slug);

/** A not-found result carrying the valid options (so the calling agent can self-correct). */
export type NotFound = {
  notFound: true;
  kind: string;
  given: string;
  valid: string[];
};
const notFound = (kind: string, given: string, valid: string[]): NotFound => ({
  notFound: true,
  kind,
  given,
  valid,
});

function buildFullProfile() {
  return {
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
    achievements: achievements.map((a) => ({
      title: a.title,
      detail: a.detail,
    })),
  };
}
type ProfileData = ReturnType<typeof buildFullProfile>;

// Which `sections` value each top-level key of the profile belongs to (typed, so a new key must pick one).
const PROFILE_KEY_SECTION: Record<keyof ProfileData, ProfileSection> = {
  name: "identity",
  role: "identity",
  company: "identity",
  tenure: "identity",
  location: "identity",
  headline: "identity",
  summary: "identity",
  links: "links",
  skills: "skills",
  achievements: "achievements",
};

/** The whole profile, or only the requested `sections` (keys keep their canonical order). */
export function getProfileData(): ProfileData;
export function getProfileData(
  sections: readonly ProfileSection[] | undefined,
): Partial<ProfileData>;
export function getProfileData(
  sections?: readonly ProfileSection[],
): Partial<ProfileData> {
  const full = buildFullProfile();
  if (!sections) return full;
  const wanted = new Set(sections);
  return Object.fromEntries(
    Object.entries(full).filter(([key]) =>
      wanted.has(PROFILE_KEY_SECTION[key as keyof ProfileData]),
    ),
  );
}

export const projectGroups = () => [...new Set(allProjects.map((p) => p.group))];

type ProjectListOptions = {
  readonly group?: string;
  readonly limit?: number;
};
/** Unknown group: an empty `items` plus the valid groups, so the calling agent can self-correct. */
type GroupNotFound = NotFound & { items: [] };

const normalizeText = (text: string) => text.trim().toLowerCase();

/** Every project, or those in one `group` (case-insensitive), capped to `limit`. */
export function listProjectsData(): ReturnType<typeof projectRows>;
export function listProjectsData(
  options: ProjectListOptions,
): ReturnType<typeof projectRows> | GroupNotFound;
export function listProjectsData(options: ProjectListOptions = {}) {
  const { group, limit } = options;
  const wanted = group === undefined ? undefined : normalizeText(group);
  const groups = projectGroups();
  if (group !== undefined && !groups.some((g) => normalizeText(g) === wanted)) {
    return { ...notFound("project_group", group, groups), items: [] as [] };
  }
  const rows = projectRows().filter(
    (row) => wanted === undefined || normalizeText(row.group) === wanted,
  );
  return limit === undefined ? rows : rows.slice(0, limit);
}

function projectRows() {
  return allProjects.map((p) => ({
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    group: p.group,
    repo: repoLink(p),
    tech: p.tech,
    url: `${BASE}${p.url}`,
  }));
}

export function getProjectData(slug: string) {
  const p = getProject(slug);
  if (!p) return notFound("project", slug, projectSlugs());
  return {
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    group: p.group,
    repo: repoLink(p),
    commits: p.commits ?? null,
    tech: p.tech,
    excerpt: p.excerpt,
    url: `${BASE}${p.url}`,
  };
}

/** Every case study, or those whose tech has an entry containing `tech` (case-insensitive), capped to `limit`. */
export function listWorkData(
  options: { readonly tech?: string; readonly limit?: number } = {},
) {
  const needle = options.tech === undefined ? "" : normalizeText(options.tech);
  const rows = allWork
    .filter(
      (w) =>
        needle === "" || w.tech.some((t) => t.toLowerCase().includes(needle)),
    )
    .map((w) => ({
      slug: w.slug,
      name: w.name,
      role: w.role,
      register: w.register,
      metrics: w.metrics,
      tech: w.tech,
      url: `${BASE}${w.url}`,
    }));
  return options.limit === undefined ? rows : rows.slice(0, options.limit);
}

export function getWorkData(slug: string) {
  const w = getWork(slug);
  if (!w) return notFound("work", slug, workSlugs());
  return {
    slug: w.slug,
    name: w.name,
    role: w.role,
    register: w.register,
    summary: w.summary,
    metrics: w.metrics,
    tech: w.tech,
    url: `${BASE}${w.url}`,
  };
}

/** Keyword search across work + projects + skills (substring, case-insensitive). */
export function searchExperienceData(query: string) {
  const q = query.toLowerCase();
  const workHits = allWork
    .filter((w) =>
      [w.name, w.role, w.register, w.summary, ...w.tech]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
    .map((w) => ({
      kind: "work" as const,
      slug: w.slug,
      name: w.name,
      url: `${BASE}${w.url}`,
    }));
  const projectHits = allProjects
    .filter((p) =>
      [p.name, p.tagline, p.group, ...p.tech]
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
    .map((p) => ({
      kind: "project" as const,
      slug: p.slug,
      name: p.name,
      url: `${BASE}${p.url}`,
    }));
  const skillHits = skills
    .filter((s) => [s.group, ...s.items].join(" ").toLowerCase().includes(q))
    .map((s) => ({
      kind: "skill" as const,
      group: s.group,
      items: s.items.filter((i) => i.toLowerCase().includes(q)),
    }));
  return { query, matches: [...workHits, ...projectHits], skills: skillHits };
}

export function getResumeVariantData(role: ResumeRole) {
  const label = ROLE_TO_LABEL[role];
  const variant = resumeVariants.find((r) => r.label === label);
  if (!variant) return notFound("resume_variant", role, [...RESUME_ROLES]);
  return {
    role,
    label: variant.label,
    tag: variant.tag,
    url: `${BASE}${variant.file}`,
  };
}

const decisionsTagSchema = {
  tag: z
    .string()
    .optional()
    .describe(
      "Return only the decisions carrying this tag. The rule is an exact, case-sensitive match against each tag ('Performance' is not 'performance'); a tag nothing carries returns an empty list, not an error, and the empty string applies no filter. Omit for all of them.",
    ),
};

/** All architecture-decision entries (project Key Decisions + work constraints/tradeoffs),
 *  optionally filtered by tag. */
export function listDecisionsData(tag?: string) {
  const entries = tag
    ? allDecisions.filter((e) => e.tags.includes(tag))
    : allDecisions;
  return entries.map((e) => ({
    sourceKind: e.sourceKind,
    sourceName: e.sourceName,
    title: e.title,
    body: e.body,
    tags: e.tags,
    url: `${BASE}${e.href}`,
  }));
}

const contentTypeSchema = {
  type: z
    .enum(CONTENT_TYPES)
    .describe("Kind of content item to fetch: work, project, article or note."),
  slug: z.string().describe("content slug, e.g. 'pensieve' or 'mindforge'"),
};

/** Wrap a tool result as MCP content + structuredContent; mark not-found as an error.
 *  structuredContent must be an object per the MCP spec — the list_* / search_* tools
 *  above return a bare array, which the SDK's runtime validation rejects ("expected
 *  record") even though TypeScript will happily let an `as Record<string, unknown>`
 *  cast through. Every array-returning tool failed on every real call until this
 *  wrapped arrays in { items }; `content` (the JSON text) is left as the raw array,
 *  unaffected by this. */
export function wrapToolResult(data: unknown) {
  const isNotFound = !!data && typeof data === "object" && "notFound" in data;
  const structuredContent = Array.isArray(data)
    ? { items: data }
    : (data as Record<string, unknown>);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent,
    ...(isNotFound && { isError: true }),
  };
}

/** Every content item, or only one `type`, capped to `limit` (work, projects, articles, notes, in that order). */
export function listAllContentData(
  options: { readonly type?: ContentType; readonly limit?: number } = {},
) {
  const items = [
    ...allWork.map((w) => ({
      type: "work" as const,
      slug: w.slug,
      name: w.name,
      summary: w.summary,
      url: `${BASE}${w.url}`,
    })),
    ...allProjects.map((p) => ({
      type: "project" as const,
      slug: p.slug,
      name: p.name,
      summary: p.tagline,
      url: `${BASE}${p.url}`,
    })),
    ...allArticles.map((a) => ({
      type: "article" as const,
      slug: a.slug,
      name: a.title,
      summary: a.summary,
      url: `${BASE}${a.url}`,
    })),
    ...allNotes.map((n) => ({
      type: "note" as const,
      slug: n.slug,
      name: n.title,
      summary: n.summary,
      url: `${BASE}${n.url}`,
    })),
  ].filter((item) => options.type === undefined || item.type === options.type);
  return options.limit === undefined ? items : items.slice(0, options.limit);
}

/** Get a single content item by type + slug. */
export function getContentItemData(type: ContentType, slug: string) {
  switch (type) {
    case "work":
      return getWorkData(slug);
    case "project":
      return getProjectData(slug);
    case "article": {
      const a = allArticles.find((x) => x.slug === slug);
      if (!a)
        return notFound(
          "article",
          slug,
          allArticles.map((x) => x.slug),
        );
      return {
        slug: a.slug,
        name: a.title,
        summary: a.summary,
        date: a.date,
        tags: a.tags,
        url: `${BASE}${a.url}`,
      };
    }
    case "note": {
      const n = allNotes.find((x) => x.slug === slug);
      if (!n)
        return notFound(
          "note",
          slug,
          allNotes.map((x) => x.slug),
        );
      return {
        slug: n.slug,
        name: n.title,
        summary: n.summary,
        date: n.date,
        url: `${BASE}${n.url}`,
      };
    }
  }
}

/** The input shape of every tool, by tool name: the route registers from it, /mcp documents from it. */
export const TOOL_INPUT_SHAPES = {
  get_profile: profileSectionsSchema,
  list_projects: projectListSchema,
  get_project: projectSlugSchema,
  list_work: workListSchema,
  get_work: workSlugSchema,
  search_experience: searchSchema,
  get_resume_variant: resumeRoleSchema,
  list_all_content: contentListSchema,
  get_content_item: contentTypeSchema,
  list_decisions: decisionsTagSchema,
} as const;
