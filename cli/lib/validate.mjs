import {
  BASE_URL_ENV,
  BATCH_MAX_OPERATIONS,
  MAX_TIMEOUT_MS,
  SLUG_PATTERN,
} from "./constants.mjs";
import { UsageError } from "./errors.mjs";

const SLUG_REGEX = new RegExp(SLUG_PATTERN);
const DECIMAL_INTEGER = /^\d+$/;

/**
 * Validates an API origin and returns it without a trailing slash. Only http and https are
 * accepted; credentials, a query string and a fragment are refused because the request URL is
 * built by appending an API path.
 *
 * @param {string} raw
 * @param {string} source  Where the value came from, for the error message ("--base-url" or the variable name).
 * @returns {string}
 */
export function parseBaseUrl(raw, source) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new UsageError(`${source} is not a valid URL. Use an http or https address such as https://anvilry.vercel.app.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UsageError(`${source} must be an http or https URL, not ${url.protocol.slice(0, -1)}.`);
  }
  if (url.username !== "" || url.password !== "") {
    throw new UsageError(`${source} must not contain a user name or password.`);
  }
  // The raw text is checked, not url.search / url.hash: a lone "?" or "#" parses to an empty
  // query or fragment, yet would still swallow the API path appended to it.
  if (/[?#]/.test(raw)) {
    throw new UsageError(`${source} must not contain a query string or a fragment.`);
  }
  return url.href.replace(/\/+$/, "");
}

/**
 * The base URL for this run: the flag, else ANVILRY_BASE_URL, else the default.
 *
 * @param {string | undefined} flagValue
 * @param {Readonly<Record<string, string | undefined>>} env  Only ANVILRY_BASE_URL is read.
 * @param {string} fallback
 * @returns {string}
 */
export function resolveBaseUrl(flagValue, env, fallback) {
  if (flagValue !== undefined) return parseBaseUrl(flagValue, "--base-url");
  const fromEnv = env[BASE_URL_ENV];
  if (fromEnv !== undefined && fromEnv !== "") {
    return parseBaseUrl(fromEnv, BASE_URL_ENV);
  }
  return parseBaseUrl(fallback, "the default base URL");
}

/**
 * @param {string} slug
 * @returns {string} the same slug
 */
export function assertSlug(slug) {
  if (!SLUG_REGEX.test(slug)) {
    throw new UsageError(
      `A slug is 1 to 120 letters, digits, underscores or hyphens (${SLUG_PATTERN}).`,
    );
  }
  return slug;
}

/**
 * @param {string | undefined} raw  The --timeout value, if given.
 * @param {number} fallback
 * @returns {number} milliseconds
 */
export function parseTimeout(raw, fallback) {
  if (raw === undefined) return fallback;
  const milliseconds = DECIMAL_INTEGER.test(raw) ? Number(raw) : 0;
  if (milliseconds < 1 || milliseconds > MAX_TIMEOUT_MS) {
    throw new UsageError(
      `--timeout takes a whole number of milliseconds from 1 to ${MAX_TIMEOUT_MS}.`,
    );
  }
  return milliseconds;
}

/**
 * The paths a batch will fetch. Each must be an absolute path on the API host; the API itself
 * decides which paths a batch may reach.
 *
 * @param {readonly string[]} paths
 * @returns {readonly string[]} the same paths
 */
export function assertBatchPaths(paths) {
  if (paths.length > BATCH_MAX_OPERATIONS) {
    throw new UsageError(
      `A batch carries at most ${BATCH_MAX_OPERATIONS} paths; ${paths.length} were given.`,
    );
  }
  const relative = paths.find((path) => !path.startsWith("/"));
  if (relative !== undefined) {
    throw new UsageError(
      `Batch paths start with a slash, like /api/v1/projects/trelix. Got "${relative}".`,
    );
  }
  return paths;
}
