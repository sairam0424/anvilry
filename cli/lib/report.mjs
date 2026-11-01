import { EXIT_CODES, MAX_BODY_BYTES } from "./constants.mjs";
import { escapeForTerminal } from "./escape.mjs";
import { prettyJson } from "./pretty.mjs";

const RATE_LIMIT_HEADERS = [
  "ratelimit-policy",
  "ratelimit",
  "ratelimit-limit",
  "ratelimit-remaining",
  "ratelimit-reset",
];
/** What --headers prints. */
const ECHOED_HEADERS = ["api-version", ...RATE_LIMIT_HEADERS];
/** What a 429 prints, with or without --headers. */
const RATE_LIMITED_HEADERS = ["retry-after", ...ECHOED_HEADERS];

const TOO_MANY_REQUESTS = 429;
const HTTP_ERROR_CODE = "http_error";
const BAD_RESPONSE_CODE = "bad_response";
const REDIRECT_CODE = "redirect";
const TOO_LARGE_CODE = "response_too_large";
const BYTES_PER_MIB = 1024 * 1024;

/**
 * @typedef {object} Report
 * @property {string | Uint8Array} stdout  Bytes only for --raw, which must not re-encode anything.
 * @property {string} stderr
 * @property {number} exitCode
 */

/**
 * Decides what to print and which exit code to return for one response. Pure: no I/O, so every
 * branch is tested without a network. Everything the server sent that reaches the terminal goes
 * through escape.mjs, except the --raw body, which is printed exactly as received.
 *
 * @param {import("./http.mjs").HttpResult} response
 * @param {{ command: import("./commands.mjs").Command, raw: boolean, showHeaders: boolean }} options
 * @returns {Report}
 */
export function interpretResponse(response, { command, raw, showHeaders }) {
  const echoed = showHeaders ? headerLines(response.headers, ECHOED_HEADERS) : [];
  if (response.tooLarge) {
    return failure([...echoed, tooLargeLine(response.status)]);
  }
  const parsed = parseJson(new TextDecoder().decode(response.body));
  if (response.status === TOO_MANY_REQUESTS) {
    return failure(rateLimitedLines(response, parsed));
  }
  if (response.status >= 300 && response.status <= 399) {
    return failure([...echoed, redirectLine(response)]);
  }
  if (response.status < 200 || response.status > 299) {
    return failure([...echoed, ...errorLines(response.status, parsed)]);
  }
  if (!raw && !parsed.ok) {
    return failure([...echoed, ...notJsonLines(response, parsed.tooDeep)]);
  }
  const rendered = render(parsed, raw, response.body);
  if ("reason" in rendered) {
    return failure([...echoed, unprintableLine(response.status, rendered.reason)]);
  }
  const { stdout } = rendered;
  const failed = parsed.ok && command.name === "batch" ? failedOperations(parsed.value) : null;
  if (failed !== null && failed.count > 0) {
    const summary = `anvilry: ${failed.count} of ${failed.total} batch operations failed. Their status and body are in the output.`;
    return { stdout, stderr: lines([...echoed, summary]), exitCode: EXIT_CODES.API };
  }
  return { stdout, stderr: lines(echoed), exitCode: EXIT_CODES.OK };
}

/**
 * What goes to stdout: the bytes themselves for --raw (also the only way to get here with a body
 * that is not JSON), otherwise the pretty-printed JSON, or the reason it cannot be printed.
 *
 * @param {{ ok: true, value: unknown } | { ok: false, tooDeep: boolean }} parsed
 * @param {boolean} raw
 * @param {Uint8Array} body
 * @returns {{ stdout: string | Uint8Array } | { reason: string }}
 */
function render(parsed, raw, body) {
  if (raw || !parsed.ok) return { stdout: body };
  const printed = prettyJson(parsed.value);
  return printed.ok ? { stdout: `${printed.text}\n` } : { reason: printed.reason };
}

/** @param {readonly string[]} stderrLines @returns {Report} */
function failure(stderrLines) {
  return { stdout: "", stderr: lines(stderrLines), exitCode: EXIT_CODES.API };
}

/** @param {readonly string[]} items */
function lines(items) {
  return items.length === 0 ? "" : `${items.join("\n")}\n`;
}

/**
 * @param {string} text
 * @returns {{ ok: true, value: unknown } | { ok: false, tooDeep: boolean }}
 *   tooDeep: the parser gave up on the nesting (older Node versions do; it is not bad syntax).
 */
function parseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, tooDeep: error instanceof RangeError };
  }
}

/**
 * @param {Headers} headers
 * @param {readonly string[]} names
 */
function headerLines(headers, names) {
  return names.flatMap((name) => {
    const value = headers.get(name);
    return value === null ? [] : [`${name}: ${escapeForTerminal(value)}`];
  });
}

/**
 * The shared error body is { error, code, status, hint, docs }; only string fields are used.
 *
 * @param {{ ok: true, value: unknown } | { ok: false, tooDeep: boolean }} parsed
 * @returns {{ code: string, message: string, hint: string | null } | null}
 */
function readErrorBody(parsed) {
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) return null;
  const body = /** @type {Record<string, unknown>} */ (parsed.value);
  if (typeof body.error !== "string") return null;
  return {
    code: typeof body.code === "string" ? body.code : HTTP_ERROR_CODE,
    message: body.error,
    hint: typeof body.hint === "string" ? body.hint : null,
  };
}

/**
 * @param {number} status
 * @param {{ ok: true, value: unknown } | { ok: false, tooDeep: boolean }} parsed
 */
function errorLines(status, parsed) {
  const body = readErrorBody(parsed);
  if (body === null) {
    return [`anvilry: ${HTTP_ERROR_CODE} (HTTP ${status}): The server answered with an error that is not in the API's JSON error format.`];
  }
  const head = `anvilry: ${escapeForTerminal(body.code)} (HTTP ${status}): ${escapeForTerminal(body.message)}`;
  return body.hint === null ? [head] : [head, `hint: ${escapeForTerminal(body.hint)}`];
}

/**
 * A 429 prints the Retry-After seconds and every rate-limit field the server sent.
 *
 * @param {import("./http.mjs").HttpResult} response
 * @param {{ ok: true, value: unknown } | { ok: false, tooDeep: boolean }} parsed
 */
function rateLimitedLines(response, parsed) {
  const body = readErrorBody(parsed);
  const wait = retryAdvice(response.headers.get("retry-after"));
  const head = `anvilry: ${escapeForTerminal(body?.code ?? "rate_limited")} (HTTP ${response.status}): ${escapeForTerminal(body?.message ?? "Too many requests.")}${wait}`;
  const fields = headerLines(response.headers, RATE_LIMITED_HEADERS);
  return body?.hint ? [head, ...fields, `hint: ${escapeForTerminal(body.hint)}`] : [head, ...fields];
}

/**
 * Retry-After is a number of seconds or an HTTP date (RFC 9110); the API sends seconds.
 *
 * @param {string | null} retryAfter
 */
function retryAdvice(retryAfter) {
  if (retryAfter === null) return "";
  const clean = escapeForTerminal(retryAfter);
  return /^\d+$/.test(clean) ? ` Retry after ${clean} seconds.` : ` Retry after ${clean}.`;
}

/**
 * Any 3xx. The CLI does not follow it, so the user decides whether to trust the new address.
 *
 * @param {import("./http.mjs").HttpResult} response
 */
function redirectLine(response) {
  const location = response.headers.get("location");
  const head = `anvilry: ${REDIRECT_CODE} (HTTP ${response.status}):`;
  if (location === null) {
    return `${head} The server answered with a redirect status and no Location. The CLI does not follow redirects.`;
  }
  return `${head} The server redirected the request to ${escapeForTerminal(location)}. The CLI does not follow redirects; if you trust that address, pass its origin as --base-url.`;
}

/** @param {number} status */
function tooLargeLine(status) {
  return `anvilry: ${TOO_LARGE_CODE} (HTTP ${status}): The response body is larger than ${MAX_BODY_BYTES / BYTES_PER_MIB} MiB (${MAX_BODY_BYTES} bytes), so nothing was printed.`;
}

/**
 * @param {number} status
 * @param {string} reason
 */
function unprintableLine(status, reason) {
  return `anvilry: ${BAD_RESPONSE_CODE} (HTTP ${status}): Could not print the response (${reason}). Use --raw to print the body unchanged.`;
}

/**
 * @param {import("./http.mjs").HttpResult} response
 * @param {boolean} tooDeep
 */
function notJsonLines(response, tooDeep) {
  if (tooDeep) {
    return [unprintableLine(response.status, "it is nested too deeply to read")];
  }
  const type = escapeForTerminal(response.headers.get("content-type") ?? "no content type");
  return [
    `anvilry: ${BAD_RESPONSE_CODE} (HTTP ${response.status}): Expected a JSON body but received ${type}. Use --raw to print the body unchanged.`,
  ];
}

/**
 * @param {unknown} value  A parsed POST /api/v1/batch response.
 * @returns {{ count: number, total: number } | null} null when the body has no responses array.
 */
function failedOperations(value) {
  const responses = /** @type {{ responses?: unknown } | null} */ (value)?.responses;
  if (!Array.isArray(responses)) return null;
  const count = responses.filter(
    (entry) => typeof entry?.status === "number" && entry.status >= 400,
  ).length;
  return { count, total: responses.length };
}
