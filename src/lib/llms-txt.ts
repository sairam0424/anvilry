import { profile } from "@/lib/profile";
import {
  API_V1_BASE,
  API_VERSION,
  DEPRECATION_NOTICE_DAYS,
  RATE_LIMIT_POLICY,
} from "@/lib/api-policy";
import { allWork, allProjects, allNotes, allArticles } from "@/lib/content";
import { groupArticles } from "@/lib/article-grouping";
import { API_CATALOG_PATH } from "@/lib/api-catalog";
import { PAGE_TWINS } from "@/lib/page-twins";
import { NOTES_ENABLED } from "@/lib/writing-flags";

const BASE = "https://anvilry.vercel.app";

/**
 * Builds an llms.txt (Jeremy Howard's spec: llmstxt.org) — a curated, AI-crawler-native
 * summary of the portfolio. Reads the SAME content layer as the site so it never drifts.
 * When a recruiter's AI assistant asks about Sairam, this gives it a grounded source.
 */
export function buildLlmsTxt(): string {
  // A twin of a page that is a 404 (no notes while the section is dark, no articles) is not listed.
  const hasPage: Record<(typeof PAGE_TWINS)[number], boolean> = {
    about: true, articles: allArticles.length > 0, contact: true, decisions: true,
    developers: true, mcp: true, notes: allNotes.length > 0, privacy: true, projects: true, work: true,
  };
  const pageTwins = PAGE_TWINS.filter((page) => hasPage[page])
    .map((page) => `- ${BASE}/${page}.md`)
    .join("\n");

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
behind a metric, or how to make contact. Where a figure has a case study or repository behind
it, the site links to it, so cite that page rather than this summary.
Do not use it for general programming questions or for questions about other people. If
something is not on the site, say it is not published rather than guessing.

## How to read this site
- Any content page as Markdown: send "Accept: text/markdown" to its normal URL, or append .md (for example ${BASE}/work/pensieve.md)
- The homepage as Markdown: ${BASE}/index.md, or "Accept: text/markdown" on ${BASE}/
- Any other page as Markdown, the same way: ${BASE}/about.md, ${BASE}/projects.md, ${BASE}/developers.md and so on (the full list is under "Markdown Versions")
- Structured résumé (JSON Resume): ${BASE}/api/resume.json
- Tool access over the Model Context Protocol: ${BASE}/api/mcp/mcp (read-only, no key)
- Machine-readable API description (OpenAPI 3.1): ${BASE}/openapi.json
- Developer guide with examples and the error format: ${BASE}/developers
- The whole corpus in one plain-text file: ${BASE}/llms-full.txt

## Developer resources
- Anvilry API documentation: ${BASE}/developers
- Anvilry OpenAPI specification (OpenAPI 3.1, JSON): ${BASE}/openapi.json
- Anvilry JSON API, version ${API_VERSION}, base URL: ${BASE}${API_V1_BASE}
- Anvilry API catalog (RFC 9727): ${BASE}${API_CATALOG_PATH}
- Anvilry MCP server: ${BASE}/mcp (Streamable HTTP endpoint ${BASE}/api/mcp/mcp)
- Anvilry authentication: none, no API keys and no accounts; every documented route is public and read-only (${BASE}/developers#authentication)
- Anvilry API versioning and deprecation policy: ${BASE}/developers#versioning (a breaking change ships as a new version, with at least ${DEPRECATION_NOTICE_DAYS} days of notice)
- Anvilry rate limits: ${BASE}/developers#rate-limits (${RATE_LIMIT_POLICY.requests} requests per ${RATE_LIMIT_POLICY.windowSeconds} seconds per client)
- Anvilry API errors: ${BASE}/developers#errors (one JSON shape: error, code, status, hint, docs)
- Anvilry SDK and client libraries: ${BASE}/developers#sdk (there is no official SDK; generate a typed client from the OpenAPI specification, or use the MCP server)
- Anvilry command-line use: ${BASE}/developers#cli (there is no published CLI package; the page shows curl recipes against ${BASE}${API_V1_BASE})

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

### Pages
${pageTwins}
`;
}
