import {
  BASE_URL_ENV,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
} from "./constants.mjs";

/**
 * The command table: the one place that says what the CLI can do. The help text, the argument
 * parser and the request builder read it, and the Anvilry site pins its documentation to it, so
 * the shape below is a stable contract (tests/cli/commands.test.ts fails when it changes).
 *
 * @typedef {object} CommandInput
 * @property {string} name        Template variable the value fills: "slug", "q", "tag" or "paths".
 * @property {"argument" | "flag"} source  Positional argument, or the --<name> flag.
 * @property {boolean} required
 * @property {boolean} repeatable More than one positional value is accepted (batch).
 *
 * @typedef {object} Command
 * @property {string} name
 * @property {string} summary     One sentence, ends with a full stop.
 * @property {string} usage       The synopsis, starting with "anvilry <name>".
 * @property {"GET" | "POST" | null} method   null for the commands that make no request (help, version).
 * @property {string | null} path  API path template, or null when no request is made.
 *   Written as an RFC 6570 URI template: "{/slug}" adds "/<slug>" when a value is given and
 *   nothing otherwise, "{?q}" adds "?q=<value>" the same way.
 * @property {CommandInput | null} input
 */

/** @param {Command} spec @returns {Command} */
function defineCommand(spec) {
  return Object.freeze({
    ...spec,
    input: spec.input === null ? null : Object.freeze({ ...spec.input }),
  });
}

/** @type {CommandInput} */
const OPTIONAL_SLUG = {
  name: "slug",
  source: "argument",
  required: false,
  repeatable: false,
};

/**
 * @param {string} name   Command and collection name.
 * @param {string} plural What the list holds, for the summary.
 * @param {string} noun   What one item is called.
 */
function collectionCommand(name, plural, noun) {
  return defineCommand({
    name,
    summary: `List the ${plural}, or show one ${noun} by slug.`,
    usage: `anvilry ${name} [slug]`,
    method: "GET",
    path: `/api/v1/${name}{/slug}`,
    input: OPTIONAL_SLUG,
  });
}

/** @param {string} name @param {string} summary @param {string} path */
function plainCommand(name, summary, path) {
  return defineCommand({
    name,
    summary,
    usage: `anvilry ${name}`,
    method: "GET",
    path,
    input: null,
  });
}

/** @param {string} name @param {string} summary */
function localCommand(name, summary) {
  return defineCommand({
    name,
    summary,
    usage: `anvilry ${name}`,
    method: null,
    path: null,
    input: null,
  });
}

/** @type {readonly Command[]} */
export const COMMANDS = Object.freeze([
  plainCommand(
    "profile",
    "Show the owner's profile, links, skills and achievements.",
    "/api/v1/profile",
  ),
  collectionCommand("work", "production case studies", "case study"),
  collectionCommand("projects", "projects", "project"),
  collectionCommand("articles", "published articles", "article"),
  collectionCommand("notes", "published engineering notes", "note"),
  defineCommand({
    name: "decisions",
    summary: "List architecture decisions, optionally only those with one tag.",
    usage: "anvilry decisions [--tag <tag>]",
    method: "GET",
    path: "/api/v1/decisions{?tag}",
    input: { name: "tag", source: "flag", required: false, repeatable: false },
  }),
  defineCommand({
    name: "search",
    summary: "Search case studies, projects and skills by keyword.",
    usage: "anvilry search <query>",
    method: "GET",
    path: "/api/v1/search{?q}",
    input: { name: "q", source: "argument", required: true, repeatable: false },
  }),
  plainCommand("resume", "Show the résumé as JSON Resume.", "/api/v1/resume"),
  plainCommand(
    "stats",
    "Show aggregate GitHub statistics.",
    "/api/v1/github/stats",
  ),
  plainCommand("openapi", "Print the OpenAPI 3.1 description of the API.", "/openapi.json"),
  defineCommand({
    name: "batch",
    summary:
      "Fetch several API paths in one request (at most 25), for example /api/v1/projects/trelix.",
    usage: "anvilry batch <path> [<path>...]",
    method: "POST",
    path: "/api/v1/batch",
    input: {
      name: "paths",
      source: "argument",
      required: true,
      repeatable: true,
    },
  }),
  plainCommand(
    "status",
    "Show the API index: version, rate limit, deprecations and resource links.",
    "/api/v1",
  ),
  localCommand("help", "Show this help."),
  localCommand("version", "Print the CLI version."),
]);

/**
 * @typedef {object} Flag
 * @property {string} name        Used as --<name>.
 * @property {"boolean" | "string"} type
 * @property {string | null} value  Placeholder shown in the help for a string flag.
 * @property {string | null} env    Environment variable that supplies the default, if any.
 * @property {string} summary
 */

/** The flags every command accepts. @type {readonly Flag[]} */
export const FLAGS = Object.freeze(
  [
    {
      name: "base-url",
      type: "string",
      value: "<url>",
      env: BASE_URL_ENV,
      summary: `API origin to talk to; http or https only. Default ${DEFAULT_BASE_URL}.`,
    },
    {
      name: "raw",
      type: "boolean",
      value: null,
      env: null,
      summary: "Print the response body exactly as received.",
    },
    {
      name: "headers",
      type: "boolean",
      value: null,
      env: null,
      summary: "Also print the API-Version and RateLimit response headers to stderr.",
    },
    {
      name: "timeout",
      type: "string",
      value: "<ms>",
      env: null,
      summary: `Give up after this many milliseconds. Default ${DEFAULT_TIMEOUT_MS}.`,
    },
    {
      name: "help",
      type: "boolean",
      value: null,
      env: null,
      summary: "Show this help.",
    },
    {
      name: "version",
      type: "boolean",
      value: null,
      env: null,
      summary: "Print the CLI version.",
    },
  ].map((flag) => Object.freeze(flag)),
);

/** The flags that belong to one command (today only decisions --tag), taken from the table above. */
export const COMMAND_FLAGS = Object.freeze(
  COMMANDS.filter((command) => command.input?.source === "flag").map(
    (command) =>
      Object.freeze({
        name: /** @type {CommandInput} */ (command.input).name,
        type: /** @type {const} */ ("string"),
        command: command.name,
      }),
  ),
);
