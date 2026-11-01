import { parseCommandLine } from "./args.mjs";
import { COMMAND_FLAGS, COMMANDS } from "./commands.mjs";
import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS } from "./constants.mjs";
import { UsageError } from "./errors.mjs";
import { buildRequest } from "./request.mjs";
import {
  assertBatchPaths,
  assertSlug,
  parseTimeout,
  resolveBaseUrl,
} from "./validate.mjs";

/**
 * What one invocation will do, decided entirely from argv and the environment before any
 * network call. Every usage error is raised here, so a malformed command line never reaches the
 * network.
 *
 * @typedef {{ action: "help" } | { action: "version" } | {
 *   action: "request",
 *   command: import("./commands.mjs").Command,
 *   request: import("./request.mjs").PlannedRequest,
 *   timeoutMs: number,
 *   raw: boolean,
 *   showHeaders: boolean,
 * }} Plan
 */

/**
 * @param {readonly string[]} argv
 * @param {Readonly<Record<string, string | undefined>>} env  Only ANVILRY_BASE_URL is read.
 * @returns {Plan}
 */
export function planInvocation(argv, env) {
  const { commandName, args, flags } = parseCommandLine(argv);
  if (flags.help === true) return { action: "help" };
  if (flags.version === true) return { action: "version" };

  const command = findCommand(commandName);
  rejectForeignFlags(command, flags);

  if (command.method === null) {
    assertNoArguments(command, args);
    return command.name === "help" ? { action: "help" } : { action: "version" };
  }

  const { templateValues, batchPaths } = readInput(command, args, flags);
  const baseUrl = resolveBaseUrl(stringFlag(flags, "base-url"), env, DEFAULT_BASE_URL);
  const timeoutMs = parseTimeout(stringFlag(flags, "timeout"), DEFAULT_TIMEOUT_MS);
  return {
    action: "request",
    command,
    request: buildRequest(command, templateValues, batchPaths, baseUrl),
    timeoutMs,
    raw: flags.raw === true,
    showHeaders: flags.headers === true,
  };
}

/** @param {string | undefined} name */
function findCommand(name) {
  if (name === undefined) throw new UsageError("Missing command.");
  const command = COMMANDS.find((candidate) => candidate.name === name);
  if (!command) throw new UsageError(`Unknown command "${name}".`);
  return command;
}

/**
 * @param {import("./commands.mjs").Command} command
 * @param {Readonly<Record<string, string | boolean | undefined>>} flags
 */
function rejectForeignFlags(command, flags) {
  const foreign = COMMAND_FLAGS.find(
    (flag) => flags[flag.name] !== undefined && flag.command !== command.name,
  );
  if (foreign) {
    throw new UsageError(
      `--${foreign.name} is only valid with the ${foreign.command} command.`,
    );
  }
}

/**
 * @param {import("./commands.mjs").Command} command
 * @param {readonly string[]} args
 */
function assertNoArguments(command, args) {
  if (args.length > 0) {
    throw new UsageError(`${command.name} takes no arguments. Usage: ${command.usage}`);
  }
}

/**
 * @param {Readonly<Record<string, string | boolean | undefined>>} flags
 * @param {string} name
 * @returns {string | undefined}
 */
function stringFlag(flags, name) {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
}

/**
 * Turns the command's positional arguments and flags into the values its path template needs
 * (or, for batch, the list of paths). A slug is checked here, before any request.
 *
 * @param {import("./commands.mjs").Command} command
 * @param {readonly string[]} args
 * @param {Readonly<Record<string, string | boolean | undefined>>} flags
 * @returns {{ templateValues: Record<string, string | undefined>, batchPaths: readonly string[] }}
 */
function readInput(command, args, flags) {
  const { input } = command;
  if (input === null) {
    assertNoArguments(command, args);
    return { templateValues: {}, batchPaths: [] };
  }
  if (input.source === "flag") {
    assertNoArguments(command, args);
    return {
      templateValues: { [input.name]: stringFlag(flags, input.name) },
      batchPaths: [],
    };
  }
  if (input.repeatable) {
    if (args.length === 0) throw missingArgument(command);
    return { templateValues: {}, batchPaths: assertBatchPaths(args) };
  }
  if (args.length > 1) {
    throw new UsageError(
      `${command.name} takes one argument; quote a value that contains spaces. Usage: ${command.usage}`,
    );
  }
  const [value] = args;
  if (value === undefined) {
    if (input.required) throw missingArgument(command);
    return { templateValues: {}, batchPaths: [] };
  }
  return {
    templateValues: { [input.name]: input.name === "slug" ? assertSlug(value) : value },
    batchPaths: [],
  };
}

/** @param {import("./commands.mjs").Command} command */
function missingArgument(command) {
  return new UsageError(`${command.name} needs an argument. Usage: ${command.usage}`);
}
