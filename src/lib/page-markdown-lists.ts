import { groupArticles } from "@/lib/article-grouping";
import {
  allArticles,
  allNotes,
  allProjects,
  allWork,
  inkforgeArticles,
  projectsByGroup,
  publicProjects,
  repoLink,
  type Article,
} from "@/lib/content";
import { allDecisions } from "@/lib/decisions";
import { personal, hasNow, hasPersonalContent, now } from "@/lib/personal";
import { achievements, impactMetrics, profile, skills } from "@/lib/profile";
import { INKFORGE_ARTICLES_ENABLED, NOTES_ENABLED } from "@/lib/writing-flags";
import {
  abs,
  joinParts,
  linkText,
  pageAndTwinLinks,
  section,
  twinFooter,
} from "@/lib/page-markdown-shared";

/**
 * The Markdown twins of the pages that are lists of cards: about, projects, work, decisions,
 * articles and notes. Each reads the same content layer its page reads (src/lib/content.ts,
 * decisions.ts, profile.ts, personal.ts), so a page and its twin cannot list different things.
 *
 * A builder returns null when its HTML page is a 404 (articles with no articles, notes while the
 * section ships dark): the twin of a missing page is a missing page, not an empty document that
 * advertises a page the browser cannot open.
 */

const ARTICLE_SOURCE_LABELS: Record<Article["source"], string> = {
  medium: "Medium",
  substack: "Substack",
  linkedin: "LinkedIn",
  devto: "Dev.to",
  hashnode: "Hashnode",
  native: "Essay",
};

const isoDay = (iso: string) => iso.slice(0, 10);

export function buildAboutMarkdown(): string {
  const impact = impactMetrics.map(
    (m) => `- **${m.value}** ${m.label} (${m.sub}): [details](${abs(m.href)})`,
  );
  const focus = hasNow
    ? [
        ...now.focus.map((item) => `- ${item}`),
        "",
        `Last updated ${now.updated}.`,
      ]
    : [];
  const uses =
    hasPersonalContent && personal.uses.length > 0
      ? personal.uses.map((g) => `- **${g.group}:** ${g.items.join(", ")}`)
      : [];
  const stack = skills.map((g) => `- **${g.group}:** ${g.items.join(", ")}`);
  const wins = achievements.map((a) => `- **${a.title}:** ${a.detail}`);
  const openSource = [
    `- ${publicProjects.length} public repositories of AI infrastructure: ${pageAndTwinLinks("Projects", "/projects")}`,
    `- Reasoning behind the architecture: ${pageAndTwinLinks("Decisions", "/decisions")}`,
    `- How to reach me: ${pageAndTwinLinks("Contact", "/contact")}`,
  ];

  const header = `# About ${profile.name}

> ${profile.role} @ ${profile.company} (${profile.tenure}), ${profile.location}. ${profile.headline}

${profile.subhead}

${profile.availability}
`;

  return joinParts([
    header,
    section("Impact", impact),
    section("What I'm focused on", focus),
    section("My toolkit", uses),
    section("What I work with", stack),
    section("Achievements", wins),
    section("Elsewhere on this site", openSource),
    twinFooter("/about"),
  ]);
}

function projectLine(project: (typeof allProjects)[number]): string {
  const repo = repoLink(project);
  const where = repo === null ? "Private repository." : `Repository: ${repo}`;
  const tagline = project.tagline.replace(/\.$/, "");
  return `- ${pageAndTwinLinks(project.name, project.url)}: ${tagline}. ${where}`;
}

export function buildProjectsMarkdown(): string {
  const groups = projectsByGroup().map((g) =>
    section(g.group, g.items.map(projectLine)),
  );
  const header = `# Projects I build in the open

> Open-source AI infrastructure by ${profile.name}: agent frameworks, code-intelligence engines, LLM gateways and MCP guardrails, and AI-native tooling. ${allProjects.length} projects in ${groups.filter((g) => g !== "").length} groups; ${publicProjects.length} have public repositories, the rest are private and listed without a link.
`;
  const reasoning = `See the reasoning behind these choices in ${pageAndTwinLinks("Decisions", "/decisions")}.\n`;
  return joinParts([header, ...groups, reasoning, twinFooter("/projects")]);
}

export function buildWorkMarkdown(): string {
  const items = allWork.map((w) => {
    const lines = [
      `- Contribution: ${w.register}`,
      `- Role: ${w.role}`,
      `- ${w.summary}`,
      ...(w.metrics.length > 0
        ? [
            `- Impact: ${w.metrics.map((m) => `**${m.value}** ${m.label}`).join(", ")}`,
          ]
        : []),
      `- Read it: ${pageAndTwinLinks(w.name, w.url)}`,
    ];
    return `## ${linkText(w.name)}\n\n${lines.join("\n")}\n`;
  });
  const header = `# Systems I helped build

> Production systems built by ${profile.name} at ${profile.company}: multi-agent LLM orchestration, AI coding tools and GenAI platforms with real metrics. Every metric is real and defensible; the register is honest, and "co-built" means exactly that.
`;
  const reasoning = `See the reasoning behind these systems in ${pageAndTwinLinks("Decisions", "/decisions")}.\n`;
  return joinParts([header, ...items, reasoning, twinFooter("/work")]);
}

export function buildDecisionsMarkdown(): string {
  const entries = (kind: "project" | "work") =>
    allDecisions
      .filter((d) => d.sourceKind === kind)
      .map((d) =>
        [
          `### ${d.sourceName}: ${d.title}`,
          "",
          d.body.trim(),
          "",
          ...(d.tags.length > 0 ? [`Tags: ${d.tags.join(", ")}`, ""] : []),
          `Source: [${linkText(d.sourceName)}](${abs(d.href)}) ([Markdown](${abs(d.href)}.md))`,
          "",
        ].join("\n"),
      );
  const header = `# Decisions

> ${allDecisions.length} decisions: real architecture and engineering tradeoffs from ${profile.name}'s production work and open-source projects. Each one gives the choice made, the alternative considered and the cost actually paid, and links back to the project or case study it came from.
`;
  const project = entries("project");
  const work = entries("work");
  return joinParts([
    header,
    project.length > 0
      ? `## Open-source projects\n\n${project.join("\n")}`
      : "",
    work.length > 0 ? `## Professional work\n\n${work.join("\n")}` : "",
    twinFooter("/decisions"),
  ]);
}

/** The place an article group is read: its linked note while notes are on, else its outside URL. */
function articleHref(group: ReturnType<typeof groupArticles>[number]): string {
  const { canonical } = group;
  if (canonical.linkedNote && NOTES_ENABLED)
    return abs(`/notes/${canonical.linkedNote}`);
  return canonical.externalUrl ?? abs(canonical.url);
}

export function buildArticlesMarkdown(): string | null {
  if (allArticles.length === 0) return null;
  const groups = groupArticles(allArticles);
  const published = groups.map((g) => {
    const platforms = [
      ...new Set(g.platforms.map((p) => ARTICLE_SOURCE_LABELS[p.source])),
    ].join(", ");
    return `- [${linkText(g.canonical.title)}](${articleHref(g)}): ${g.canonical.summary} (${isoDay(g.canonical.date)}; ${platforms})`;
  });
  const generated = (INKFORGE_ARTICLES_ENABLED ? inkforgeArticles : []).map(
    (n) => `- ${pageAndTwinLinks(n.title, n.url)}: ${n.summary}`,
  );
  const total = groups.length + generated.length;
  const header = `# Articles

> ${total} article${total === 1 ? "" : "s"} by ${profile.name} on backend systems, GenAI and distributed infrastructure, as published on Medium, Substack, Dev.to, Hashnode and LinkedIn.
`;
  return joinParts([
    header,
    section("Generated", generated),
    section("Published", published),
    twinFooter("/articles"),
  ]);
}

export function buildNotesMarkdown(): string | null {
  // allNotes is empty while NOTES_ENABLED is off, the same two conditions /notes tests before notFound().
  if (allNotes.length === 0) return null;
  const notes = allNotes.map(
    (n) => `- ${pageAndTwinLinks(n.title, n.url)}: ${n.summary}`,
  );
  const header = `# Writing

> ${allNotes.length} piece${allNotes.length === 1 ? "" : "s"} of long-form engineering writing by ${profile.name}.
`;
  return joinParts([header, section("Notes", notes), twinFooter("/notes")]);
}
