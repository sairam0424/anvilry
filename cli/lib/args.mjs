import { parseArgs } from "node:util";
import { COMMAND_FLAGS, FLAGS } from "./commands.mjs";
import { UsageError } from "./errors.mjs";

const PARSE_OPTIONS = Object.freeze(
  Object.fromEntries(
    [...FLAGS, ...COMMAND_FLAGS].map(({ name, type }) => [name, { type }]),
  ),
);

/**
 * @typedef {object} ParsedCommandLine
 * @property {string | undefined} commandName  First positional argument.
 * @property {readonly string[]} args          The remaining positional arguments.
 * @property {Readonly<Record<string, string | boolean | undefined>>} flags
 */

/**
 * Splits argv into the command, its positional arguments and the flags. Unknown flags and flags
 * without their value are usage errors, so a typo never silently changes what is requested.
 *
 * @param {readonly string[]} argv  Arguments after the executable and script name.
 * @returns {ParsedCommandLine}
 */
export function parseCommandLine(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: PARSE_OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    if (isParseArgsError(error)) throw new UsageError(firstLine(error.message));
    throw error;
  }
  const [commandName, ...args] = parsed.positionals;
  return Object.freeze({
    commandName,
    args: Object.freeze(args),
    flags: Object.freeze({ ...parsed.values }),
  });
}

/** @param {unknown} error @returns {error is Error & { code: string }} */
function isParseArgsError(error) {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("ERR_PARSE_ARGS")
  );
}

/** Node appends advice about "--" to some messages; the first sentence is the useful part. @param {string} message */
function firstLine(message) {
  return message.split("\n")[0];
}
