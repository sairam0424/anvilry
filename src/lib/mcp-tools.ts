import { z } from "zod";
import { allProjects, allWork, allArticles, allNotes, getProject, getWork } from "@/lib/content";
import { profile, skills, achievements, resumeVariants } from "@/lib/profile";

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

export const RESUME_ROLES = ["master", "backend", "fullstack", "frontend", "genai"] as const;
export type ResumeRole = (typeof RESUME_ROLES)[number];

// Map the public role keyword -> the real resumeVariants label (single source).
const ROLE_TO_LABEL: Record<ResumeRole, string> = {
  master: "Master (All-purpose)",
  backend: "Backend",
  fullstack: "Full-Stack",
  frontend: "Frontend",
  genai: "GenAI",
};

// Zod input schemas (raw-shape form for mcp-handler's registerTool).
export const projectSlugSchema = { slug: z.string().describe("project slug, e.g. mindforge") };
export const workSlugSchema = { slug: z.string().describe("work slug, e.g. pensieve") };
export const searchSchema = {
  query: z.string().min(1).max(120).describe("keywords, e.g. 'kafka' or 'multi-agent'"),
};
export const resumeRoleSchema = {
  role: z.enum(RESUME_ROLES).describe("target role flavor for the résumé variant"),
};

export const projectSlugs = () => allProjects.map((p) => p.slug);
export const workSlugs = () => allWork.map((w) => w.slug);

/** A not-found result carrying the valid options (so the calling agent can self-correct). */
export type NotFound = { notFound: true; kind: string; given: string; valid: string[] };
const notFound = (kind: string, given: string, valid: string[]): NotFound => ({
  notFound: true,
  kind,
  given,
  valid,
});

export function getProfileData() {
  return {
    name: profile.name,
    role: profile.role,
    company: profile.company,
    tenure: profile.tenure,
    location: profile.location,
    headline: profile.headline,
    summary: profile.subhead,
    links: { github: profile.links.github, linkedin: profile.links.linkedin, site: BASE },
    skills: skills.map((s) => ({ group: s.group, items: s.items })),
    achievements: achievements.map((a) => ({ title: a.title, detail: a.detail })),
  };
}

export function listProjectsData() {
  return allProjects.map((p) => ({
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    group: p.group,
    repo: p.repo,
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
    repo: p.repo,
    commits: p.commits ?? null,
    tech: p.tech,
    excerpt: p.excerpt,
    url: `${BASE}${p.url}`,
  };
}

export function listWorkData() {
  return allWork.map((w) => ({
    slug: w.slug,
    name: w.name,
    role: w.role,
    register: w.register,
    metrics: w.metrics,
    tech: w.tech,
    url: `${BASE}${w.url}`,
  }));
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
      [w.name, w.role, w.register, w.summary, ...w.tech].join(" ").toLowerCase().includes(q),
    )
    .map((w) => ({ kind: "work" as const, slug: w.slug, name: w.name, url: `${BASE}${w.url}` }));
  const projectHits = allProjects
    .filter((p) => [p.name, p.tagline, p.group, ...p.tech].join(" ").toLowerCase().includes(q))
    .map((p) => ({ kind: "project" as const, slug: p.slug, name: p.name, url: `${BASE}${p.url}` }));
  const skillHits = skills
    .filter((s) => [s.group, ...s.items].join(" ").toLowerCase().includes(q))
    .map((s) => ({ kind: "skill" as const, group: s.group, items: s.items.filter((i) => i.toLowerCase().includes(q)) }));
  return { query, matches: [...workHits, ...projectHits], skills: skillHits };
}

export function getResumeVariantData(role: ResumeRole) {
  const label = ROLE_TO_LABEL[role];
  const variant = resumeVariants.find((r) => r.label === label);
  if (!variant) return notFound("resume_variant", role, [...RESUME_ROLES]);
  return { role, label: variant.label, tag: variant.tag, url: `${BASE}${variant.file}` };
}

export const contentTypeSchema = {
  type: z.enum(["work", "project", "article", "note"]).describe("content type"),
  slug: z.string().describe("content slug, e.g. 'pensieve' or 'mindforge'"),
};

/** Flat list of all content items (work, projects, articles, notes) — slug + title + type. */
export function listAllContentData() {
  return [
    ...allWork.map((w) => ({ type: "work" as const, slug: w.slug, name: w.name, summary: w.summary, url: `${BASE}${w.url}` })),
    ...allProjects.map((p) => ({ type: "project" as const, slug: p.slug, name: p.name, summary: p.tagline, url: `${BASE}${p.url}` })),
    ...allArticles.map((a) => ({ type: "article" as const, slug: a.slug, name: a.title, summary: a.summary, url: `${BASE}${a.url}` })),
    ...allNotes.map((n) => ({ type: "note" as const, slug: n.slug, name: n.title, summary: n.summary, url: `${BASE}${n.url}` })),
  ];
}

/** Get a single content item by type + slug. */
export function getContentItemData(type: "work" | "project" | "article" | "note", slug: string) {
  switch (type) {
    case "work":    return getWorkData(slug);
    case "project": return getProjectData(slug);
    case "article": {
      const a = allArticles.find((x) => x.slug === slug);
      if (!a) return notFound("article", slug, allArticles.map((x) => x.slug));
      return { slug: a.slug, name: a.title, summary: a.summary, date: a.date, tags: a.tags, url: `${BASE}${a.url}` };
    }
    case "note": {
      const n = allNotes.find((x) => x.slug === slug);
      if (!n) return notFound("note", slug, allNotes.map((x) => x.slug));
      return { slug: n.slug, name: n.title, summary: n.summary, date: n.date, url: `${BASE}${n.url}` };
    }
  }
}
