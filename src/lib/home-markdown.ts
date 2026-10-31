import { groupArticles } from "@/lib/article-grouping";
import { allArticles, allProjects, allWork, featuredProjects, publicProjects } from "@/lib/content";
import { achievements, impactMetrics, profile, skills } from "@/lib/profile";
import { SITE_URL } from "@/lib/site-url";
import { ARTICLES_ENABLED } from "@/lib/writing-flags";

/**
 * The Markdown twin of the homepage, served when a client sends `Accept: text/markdown` to "/"
 * (and at /index.md). It is built from the same data the Classic homepage renders, so it
 * cannot drift from the page: identity, impact, work, featured projects, stack, achievements,
 * writing and contact, followed by the machine-readable surfaces an agent can use directly.
 */

const abs = (path: string) => `${SITE_URL}${path}`;

function section(title: string, lines: string[]): string {
  return lines.length > 0 ? `## ${title}\n\n${lines.join("\n")}\n` : "";
}

export function buildHomeMarkdown(): string {
  const impact = impactMetrics.map((m) => `- **${m.value}** ${m.label} (${m.sub}): [details](${abs(m.href)})`);

  const work = allWork.map(
    (w) => `- [${w.name}](${abs(w.url)}) ([Markdown](${abs(w.url)}.md)): ${w.register} · ${w.role}`,
  );

  const projects = featuredProjects.map(
    (p) => `- [${p.name}](${abs(p.url)}) ([Markdown](${abs(p.url)}.md)): ${p.tagline}`,
  );

  const stack = skills.map((group) => `- **${group.group}:** ${group.items.join(", ")}`);

  const wins = achievements.map((a) => `- **${a.title}:** ${a.detail}`);

  const preview = ARTICLES_ENABLED ? groupArticles(allArticles).slice(0, 2) : [];
  const writing = preview.map((g) => {
    const href = g.canonical.externalUrl ?? abs(g.canonical.url);
    return `- [${g.canonical.title}](${href}): ${g.canonical.summary}`;
  });
  if (writing.length > 0) writing.push(`- [All articles](${abs("/articles")})`);

  const contact = [
    `- Email: ${profile.email}`,
    `- Schedule a call: [${profile.calendlyUrl}](${profile.calendlyUrl})`,
    `- GitHub: [${profile.links.github}](${profile.links.github})`,
    `- LinkedIn: [${profile.links.linkedin}](${profile.links.linkedin})`,
    `- npm: [${profile.links.npm}](${profile.links.npm})`,
    `- PyPI: [${profile.links.pypi}](${profile.links.pypi})`,
    `- Dev.to: [${profile.links.devto}](${profile.links.devto})`,
    `- Substack: [${profile.links.substack}](${profile.links.substack})`,
  ];

  const agents = [
    `- [llms.txt](${abs("/llms.txt")}): curated index of this site`,
    `- [llms-full.txt](${abs("/llms-full.txt")}): the full grounding corpus (profile, work, projects, skills and more) in one file`,
    `- [MCP server](${abs("/api/mcp/mcp")}): read-only tools over Streamable HTTP, see [${abs("/mcp")}](${abs("/mcp")})`,
    `- [Résumé JSON](${abs("/api/resume.json")}): the profile as JSON Resume`,
    `- [OpenAPI description](${abs("/openapi.json")}): the public HTTP API`,
    `- [Developer docs](${abs("/developers")}): quickstart, endpoints, errors and limits`,
    `- [RSS feed](${abs("/feed.xml")}) and [sitemap](${abs("/sitemap.xml")})`,
    `- Markdown: send \`Accept: text/markdown\` to this page or to any project, work, article or note page, or add \`.md\` to its URL.`,
  ];

  const header = `# ${profile.name}

> ${profile.role} @ ${profile.company} (${profile.tenure}), ${profile.location}. ${profile.headline}

${profile.subhead}

${profile.availability}
`;

  const footer = `---

This is the Markdown version of [${SITE_URL}/](${SITE_URL}/). Browsers get the HTML page from the same URL.
`;

  return [
    header,
    section("Impact", impact),
    section("Production work", work),
    section(
      `Featured open-source projects (${featuredProjects.length} of ${allProjects.length} projects; ${publicProjects.length} have public repositories)`,
      projects,
    ),
    section("Stack", stack),
    section("Achievements", wins),
    section("Writing", writing),
    section("Contact", contact),
    section("For agents", agents),
    footer,
  ]
    .filter((part) => part !== "")
    .join("\n");
}
