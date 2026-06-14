import { profile, skills, achievements } from "@/lib/profile";
import { allWork, allProjects } from "@/lib/content";

const BASE = "https://anvilry.vercel.app";

/**
 * Builds a JSON Resume (jsonresume.org schema) export from the SAME content layer the
 * site uses — an LLM/agent-readable structured résumé that can't drift from the site.
 * EDUCATION is deliberately OMITTED (no education data exists in profile.ts; we don't
 * invent it). Framed as machine-readable structured data, not an ATS-parsing claim.
 */
export function buildResumeJson() {
  return {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: profile.name,
      label: profile.role,
      email: profile.email,
      summary: `${profile.headline} ${profile.subhead}`,
      location: { city: profile.locationCity, countryCode: profile.locationCountry },
      profiles: [
        { network: "GitHub", username: profile.githubUser, url: profile.links.github },
        { network: "LinkedIn", username: profile.githubUser, url: profile.links.linkedin },
      ],
      url: BASE,
    },
    work: allWork.map((w) => ({
      name: profile.company,
      position: w.role,
      summary: `${w.register}. ${w.summary}`,
      highlights: w.metrics.map((m) => `${m.value} ${m.label}`),
      url: `${BASE}${w.url}`,
    })),
    projects: allProjects.map((p) => ({
      name: p.name,
      description: p.tagline,
      keywords: p.tech,
      url: p.repo,
      // The portfolio dossier page (distinct from the source repo).
      entity: `${BASE}${p.url}`,
    })),
    skills: skills.map((s) => ({ name: s.group, keywords: s.items })),
    awards: achievements.map((a) => ({ title: a.title, summary: a.detail })),
    // education: omitted — no data; we don't fabricate it.
    meta: { canonical: `${BASE}/api/resume.json`, version: "v1" },
  };
}
