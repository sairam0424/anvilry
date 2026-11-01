import { COMMANDS, FLAGS } from "./commands.mjs";
import { DOCS_URL, EXIT_CODES } from "./constants.mjs";
import { VERSION } from "./version.mjs";

const SYNOPSIS = "Usage: anvilry <command> [arguments] [flags]";

/** @typedef {readonly (readonly [string, string])[]} Rows  [left column, right column] */

/** @type {Rows} */
const COMMAND_ROWS = COMMANDS.map((command) => [command.usage, command.summary]);

/** @type {Rows} */
const FLAG_ROWS = FLAGS.map((flag) => [
  flag.value === null ? `--${flag.name}` : `--${flag.name} ${flag.value}`,
  flag.summary,
]);

/** @type {Rows} */
const EXIT_CODE_ROWS = [
  [String(EXIT_CODES.OK), "Success."],
  [String(EXIT_CODES.USAGE), "Usage error; nothing was requested."],
  [
    String(EXIT_CODES.API),
    "The API answered with an error or an unusable body (a 429 prints Retry-After).",
  ],
  [
    String(EXIT_CODES.NETWORK),
    "No answer: unreachable host, dropped connection or timeout.",
  ],
];

/**
 * @param {string} title
 * @param {Rows} rows
 */
function section(title, rows) {
  const width = Math.max(...rows.map(([left]) => left.length));
  const body = rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`);
  return [title, ...body].join("\n");
}

/**
 * The synopsis and the command list, printed after every usage error. Built from the command
 * table so it cannot list a command that does not exist or miss one that does.
 *
 * @returns {string}
 */
export function usageText() {
  return [
    SYNOPSIS,
    section("Commands:", COMMAND_ROWS),
    'Run "anvilry help" for the flags and exit codes.',
  ].join("\n\n");
}

/**
 * The text of `anvilry help`: the command list, every flag and the exit codes.
 *
 * @returns {string}
 */
export function helpText() {
  return `${[
    `anvilry ${VERSION} - command line client for the Anvilry public API`,
    SYNOPSIS,
    section("Commands:", COMMAND_ROWS),
    section("Flags:", FLAG_ROWS),
    section("Exit codes:", EXIT_CODE_ROWS),
    `Documentation: ${DOCS_URL}`,
  ].join("\n\n")}\n`;
}
