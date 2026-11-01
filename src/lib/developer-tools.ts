import { API_V1_BASE, BATCH_MAX_REQUESTS } from "@/lib/api-policy";

/**
 * The one place the site learns about the Anvilry command-line tool.
 *
 * The package lives in cli/ (npm name `anvilry`) and the owner publishes it with their own npm
 * credentials, so the site has to tell the truth at every moment: it must not say that
 * `npx anvilry` works before it does. Every sentence about the CLI on /developers, in llms.txt and
 * in the Markdown twin of /developers is built from the descriptor below, and the single switch is
 * `CLI.published`. Publish, then set it to true (nothing else needs editing).
 *
 * `CLI_COMMANDS` is a copy of the command table the package exports from cli/lib/commands.mjs;
 * developer-tools.test.ts fails when the two differ, so a command cannot be added to the package
 * without the site listing it.
 */

export interface CliInfo {
  readonly name: string;
  readonly registry: "npm";
  /** True only once the package is on the registry: the one flag that switches the site's wording. */
  readonly published: boolean;
  readonly runCommand: string;
  readonly installCommand: string;
  readonly packageUrl: string;
  /** Directory of the package inside the repository. */
  readonly sourcePath: string;
}

export interface CliCommand {
  readonly name: string;
  readonly summary: string;
  readonly usage: string;
}

export const CLI: CliInfo = {
  name: "anvilry",
  registry: "npm",
  published: false,
  runCommand: "npx anvilry",
  installCommand: "npm install --global anvilry",
  packageUrl: "https://www.npmjs.com/package/anvilry",
  sourcePath: "cli",
};

/**
 * Mirror of the command table in cli/lib/commands.mjs (pinned by developer-tools.test.ts, which
 * compares name, summary and usage in order). Shown on /developers once `CLI.published` is true.
 */
export const CLI_COMMANDS: readonly CliCommand[] = [
  {
    name: "profile",
    summary: "Show the owner's profile, links, skills and achievements.",
    usage: "anvilry profile",
  },
  {
    name: "work",
    summary: "List the production case studies, or show one case study by slug.",
    usage: "anvilry work [slug]",
  },
  {
    name: "projects",
    summary: "List the projects, or show one project by slug.",
    usage: "anvilry projects [slug]",
  },
  {
    name: "articles",
    summary: "List the published articles, or show one article by slug.",
    usage: "anvilry articles [slug]",
  },
  {
    name: "notes",
    summary: "List the published engineering notes, or show one note by slug.",
    usage: "anvilry notes [slug]",
  },
  {
    name: "decisions",
    summary: "List architecture decisions, optionally only those with one tag.",
    usage: "anvilry decisions [--tag <tag>]",
  },
  {
    name: "search",
    summary: "Search case studies, projects and skills by keyword.",
    usage: "anvilry search <query>",
  },
  {
    name: "resume",
    summary: "Show the résumé as JSON Resume.",
    usage: "anvilry resume",
  },
  {
    name: "stats",
    summary: "Show aggregate GitHub statistics.",
    usage: "anvilry stats",
  },
  {
    name: "openapi",
    summary: "Print the OpenAPI 3.1 description of the API.",
    usage: "anvilry openapi",
  },
  {
    name: "batch",
    summary: `Fetch several API paths in one request (at most ${BATCH_MAX_REQUESTS}), for example ${API_V1_BASE}/projects/trelix.`,
    usage: "anvilry batch <path> [<path>...]",
  },
  {
    name: "status",
    summary: "Show the API index: version, rate limit, deprecations and resource links.",
    usage: "anvilry status",
  },
  { name: "help", summary: "Show this help.", usage: "anvilry help" },
  { name: "version", summary: "Print the CLI version.", usage: "anvilry version" },
];

/** Heading of the #cli section of /developers, and the label of its llms.txt line. */
export function cliHeading(cli: CliInfo): string {
  return cli.published ? "Anvilry CLI" : "Anvilry command-line use";
}

/** The first sentence of the section: whether there is a CLI to install. */
export function cliStatus(cli: CliInfo): string {
  return cli.published
    ? `Anvilry has an official command-line tool, the ${cli.registry} package ${cli.name}.`
    : "There is no published CLI package for Anvilry.";
}

/** While the package is not on the registry: where its source is. Null once it is published. */
export function cliSourceNote(cli: CliInfo): string | null {
  return cli.published
    ? null
    : `The CLI source is in the ${cli.sourcePath}/ directory of the Anvilry repository and is not on ${cli.registry} yet.`;
}

/** The commands to show in a code block: how to run it and how to install it. Empty until published. */
export function cliInstallLines(cli: CliInfo): string[] {
  return cli.published ? [cli.runCommand, cli.installCommand] : [];
}

/** The line of the llms.txt "Developer resources" block that covers the CLI. */
export function cliLlmsLine(
  cli: CliInfo,
  commands: readonly CliCommand[],
  site: string,
): string {
  if (!cli.published) {
    return `- ${cliHeading(cli)}: ${site}/developers#cli (there is no published CLI package; the page shows curl recipes against ${site}${API_V1_BASE}; the CLI source is in the repository's ${cli.sourcePath}/ directory and is not yet on ${cli.registry})`;
  }
  const names = commands.map((c) => c.name).join(", ");
  const listed = names === "" ? "" : `; commands: ${names}`;
  return `- ${cliHeading(cli)}: ${site}/developers#cli (official ${cli.registry} package ${cli.name}: run ${cli.runCommand} or install with ${cli.installCommand}${listed}; ${cli.packageUrl})`;
}
