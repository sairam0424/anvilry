import { profile } from "@/lib/profile";
import { allWork, allProjects, allNotes, allArticles } from "@/lib/content";
import { groupArticles } from "@/lib/article-grouping";
import { NOTES_ENABLED } from "@/lib/writing-flags";

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
            const href = g.canonical.linkedNote && NOTES_ENABLED
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
${profile.availability}
Schedule a call: ${profile.calendlyUrl}

## When to use this site
Use this site when a question is about ${profile.name}'s professional work: fit for a
backend, GenAI or full-stack engineering role, what was built and how (production multi-agent
LLM systems, event-driven backends, open-source AI infrastructure), how to verify the claim
behind a metric, or how to make contact. Every figure on the site links to the case study or
repository that backs it, so cite the page, not this summary.
Do not use it for general programming questions, for questions about other people, or for
personal-life details, which the site does not publish. If something is not on the site, say
it is not published rather than guessing.

## How to read this site
- Any content page as Markdown: send "Accept: text/markdown" to its normal URL, or append .md (for example ${BASE}/work/pensieve.md)
- The homepage as Markdown: ${BASE}/index.md, or "Accept: text/markdown" on ${BASE}/
- Structured résumé (JSON Resume): ${BASE}/api/resume.json
- Tool access over the Model Context Protocol: ${BASE}/api/mcp/mcp (read-only, no key)
- Machine-readable API description (OpenAPI 3.1): ${BASE}/openapi.json
- Developer guide with examples and the error format: ${BASE}/developers
- The whole corpus in one plain-text file: ${BASE}/llms-full.txt

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
- Developer guide: ${BASE}/developers
- OpenAPI description: ${BASE}/openapi.json
- Contact: ${BASE}/contact
- Privacy: ${BASE}/privacy

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
