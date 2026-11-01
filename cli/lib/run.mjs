import { EXIT_CODES } from "./constants.mjs";
import { escapeForTerminal } from "./escape.mjs";
import { NetworkError, UsageError } from "./errors.mjs";
import { helpText, usageText } from "./help.mjs";
import { send } from "./http.mjs";
import { planInvocation } from "./plan.mjs";
import { interpretResponse } from "./report.mjs";
import { VERSION } from "./version.mjs";

/**
 * Runs one CLI invocation and returns its exit code. Everything the process touches is passed
 * in (the environment, both output streams and fetch), so tests run it in-process and the
 * binary is a few lines of wiring.
 *
 * @param {readonly string[]} argv  Arguments after the executable and script name.
 * @param {{
 *   env: Readonly<Record<string, string | undefined>>,
 *   stdout: (data: string | Uint8Array) => void,
 *   stderr: (text: string) => void,
 *   fetch: typeof fetch,
 * }} io
 * @returns {Promise<number>}
 */
export async function run(argv, { env, stdout, stderr, fetch }) {
  try {
    const plan = planInvocation(argv, env);
    if (plan.action === "help") {
      stdout(helpText());
      return EXIT_CODES.OK;
    }
    if (plan.action === "version") {
      stdout(`${VERSION}\n`);
      return EXIT_CODES.OK;
    }
    const response = await send(plan.request, { fetch, timeoutMs: plan.timeoutMs });
    const report = interpretResponse(response, plan);
    if (report.stdout.length > 0) stdout(report.stdout);
    if (report.stderr !== "") stderr(report.stderr);
    return report.exitCode;
  } catch (error) {
    // A usage error echoes what the user typed, and a network error what the system said; both are escaped like the rest.
    if (error instanceof UsageError) {
      stderr(`anvilry: ${escapeForTerminal(error.message)}\n\n${usageText()}\n`);
      return EXIT_CODES.USAGE;
    }
    if (error instanceof NetworkError) {
      stderr(`anvilry: ${escapeForTerminal(error.message)}\n`);
      return EXIT_CODES.NETWORK;
    }
    throw error;
  }
}
