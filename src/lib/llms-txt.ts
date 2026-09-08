import { profile } from "@/lib/profile";
import { allWork, allProjects, allNotes, allArticles } from "@/lib/content";
import { groupArticles } from "@/lib/article-grouping";

const BASE = "https://anvilry.vercel.app";

/**
 * Builds an llms.txt (Jeremy Howard's spec: llmstxt.org) — a curated, AI-crawler-native
 * summary of the portfolio. Reads the SAME content layer as the site so it never drifts.
 * When a recruiter's AI assistant asks about Sairam, this gives it a grounded source.
 */
export function buildLlmsTxt(): string {
  const work = allWork
    .map((w) => `- [${w.name}](${BASE}${w.url}): ${w.register} · ${w.role}`)
    .join("\n");

  const projects = allProjects
    .map((p) => `- [${p.name}](${BASE}${p.url}): ${p.tagline}`)
    .join("\n");

  // Deduplicated articles — one entry per unique article (grouped by linkedNote/canonicalUrl)
  const articleGroups = groupArticles(allArticles);
  const articles =
    articleGroups.length > 0
      ? articleGroups
          .map((g) => {
            const platforms = g.platforms.map((p) => p.source).join(", ");
            const href = g.canonical.linkedNote
              ? `${BASE}/notes/${g.canonical.linkedNote}`
              : (g.canonical.externalUrl ?? `${BASE}${g.canonical.url}`);
            return `- [${g.canonical.title}](${href}): ${g.canonical.summary.slice(0, 100)}... [${platforms}]`;
          })
          .join("\n")
      : "";

  // Native notes (engineering deep-dives)
  const notes =
    allNotes.length > 0
      ? allNotes
          .map(
            (n) =>
              `- [${n.title}](${BASE}${n.url}): ${n.summary.slice(0, 80)}...`,
          )
          .join("\n")
      : "";

  return `# ${profile.name}

> ${profile.role} @ ${profile.company} (${profile.tenure}). ${profile.headline}

${profile.subhead}

## Availability
Open to Backend, GenAI & Full-Stack engineering roles. Remote or Hyderabad, India.
Schedule a call: ${profile.calendlyUrl}

## Production Work
${work}

## Open-Source Projects
${projects}
${articles ? `\n## Articles & Writing\n${articles}` : ""}${notes ? `\n\n## Engineering Notes\n${notes}` : ""}

## Links
- Portfolio: ${BASE}/
- GitHub: ${profile.links.github}
- LinkedIn: ${profile.links.linkedin}
- npm: ${profile.links.npm}
- PyPI: ${profile.links.pypi}
- Dev.to: ${profile.links.devto}
- Substack: ${profile.links.substack}
- Résumé: ${BASE}/resume
- Structured résumé (JSON): ${BASE}/api/resume.json
- MCP server (for AI agents): ${BASE}/api/mcp/mcp
- RSS feed: ${BASE}/feed.xml

## AI Usage Policy
This site publishes a Content-Signal preference in robots.txt (search=yes,
ai-input=yes, ai-train=no) — a stated preference under Cloudflare's Content
Signals convention, not a technical enforcement mechanism. AI assistants and
agents are welcome to read and cite this content when answering questions
about ${profile.name} (that is the whole point of this file and the MCP
server above). Bulk absorption into model training data is not authorized,
consistent with the content-exclusion terms already in this repository's
LICENSE file.

## Markdown Versions
Every content page is available as clean markdown by appending .md to the URL.
${allWork.map((w) => `- ${BASE}${w.url}.md`).join("\n")}

### Projects
${allProjects.map((p) => `- ${BASE}${p.url}.md`).join("\n")}

### Notes
${allNotes.length > 0 ? allNotes.map((n) => `- ${BASE}${n.url}.md`).join("\n") : "(none yet)"}

### Articles (native only)
${allArticles
  .filter((a) => !a.externalUrl)
  .map((a) => `- ${BASE}${a.url}.md`)
  .join("\n")}
`;
}
