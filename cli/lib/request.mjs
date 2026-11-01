import { API_VERSION, API_VERSION_HEADER } from "./constants.mjs";
import { USER_AGENT } from "./version.mjs";

const TEMPLATE_VARIABLE = /\{([/?])([a-z]+)\}/g;

/**
 * Fills the "{/name}" and "{?name}" variables of a path template. A variable with no value
 * disappears, so "/api/v1/work{/slug}" is the list route until a slug is given. Every value is
 * percent-encoded, so a query or slug can never add a path segment or another parameter.
 *
 * @param {string} template
 * @param {Readonly<Record<string, string | undefined>>} values
 * @returns {string}
 */
export function expandPath(template, values) {
  return template.replace(TEMPLATE_VARIABLE, (_match, operator, name) => {
    const value = values[name];
    if (value === undefined) return "";
    const encoded = encodeURIComponent(value);
    return operator === "/" ? `/${encoded}` : `?${name}=${encoded}`;
  });
}

/**
 * The body of POST /api/v1/batch: one GET operation per path, numbered from 1 so each response
 * can be matched to the path that produced it.
 *
 * @param {readonly string[]} paths
 */
export function batchBody(paths) {
  return {
    requests: paths.map((path, index) => ({
      id: String(index + 1),
      method: "GET",
      path,
    })),
  };
}

/**
 * @typedef {object} PlannedRequest
 * @property {"GET" | "POST"} method
 * @property {string} url
 * @property {Readonly<Record<string, string>>} headers
 * @property {string | undefined} body
 */

/**
 * @param {import("./commands.mjs").Command} command  A command that makes a request.
 * @param {Readonly<Record<string, string | undefined>>} templateValues
 * @param {readonly string[]} batchPaths  Only read by the batch command.
 * @param {string} baseUrl  Validated, without a trailing slash.
 * @returns {PlannedRequest}
 */
export function buildRequest(command, templateValues, batchPaths, baseUrl) {
  const method = /** @type {"GET" | "POST"} */ (command.method);
  const path = expandPath(/** @type {string} */ (command.path), templateValues);
  const baseHeaders = {
    Accept: "application/json",
    [API_VERSION_HEADER]: API_VERSION,
    "User-Agent": USER_AGENT,
  };
  if (method === "GET") {
    return { method, url: `${baseUrl}${path}`, headers: baseHeaders, body: undefined };
  }
  return {
    method,
    url: `${baseUrl}${path}`,
    headers: { ...baseHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(batchBody(batchPaths)),
  };
}
