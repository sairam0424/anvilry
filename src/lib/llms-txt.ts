import { profile } from "@/lib/profile";
import { allWork, allProjects } from "@/lib/content";

const BASE = "https://anvilry.vercel.app";

/**
 * Builds an llms.txt (Jeremy Howard's spec: llmstxt.org) — a curated, AI-crawler-native
 * summary of the portfolio. H1 name+role, a blockquote summary, then H2 link-list
 * sections. Reads the SAME content layer as the site so it can never drift or fabricate.
 * When a recruiter's AI assistant asks about Sairam, this gives it a grounded source.
 */
export function buildLlmsTxt(): string {
  const work = allWork
    .map((w) => `- [${w.name}](${BASE}${w.url}): ${w.register} · ${w.role}`)
    .join("\n");
  const projects = allProjects
    .map((p) => `- [${p.name}](${BASE}${p.url}): ${p.tagline}`)
    .join("\n");

  return `# ${profile.name}

> ${profile.role} @ ${profile.company} (${profile.tenure}). ${profile.headline}

${profile.subhead}

## Production Work
${work}

## Open-Source Projects
${projects}

## Links
- [Portfolio](${BASE}/)
- [GitHub](${profile.links.github})
- [LinkedIn](${profile.links.linkedin})
- [Résumé](${BASE}/resume)
- [Structured résumé (JSON)](${BASE}/api/resume.json)
`;
}
