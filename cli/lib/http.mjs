import { MAX_BODY_BYTES } from "./constants.mjs";
import { NetworkError } from "./errors.mjs";

/**
 * @typedef {object} HttpResult
 * @property {number} status
 * @property {Headers} headers
 * @property {Uint8Array} body  The body exactly as received; empty when tooLarge.
 * @property {boolean} tooLarge  The body went past the size limit and was not read to its end.
 */

/**
 * Sends one request and reads the whole body, both inside the same deadline. A deadline that
 * passes, an unreachable host or a connection that drops raises a NetworkError whose message
 * says which. Redirects are NOT followed (a 3xx comes back as an ordinary result, so a batch
 * body is never re-sent to another address) and no credentials are ever attached.
 *
 * @param {import("./request.mjs").PlannedRequest} request
 * @param {{ fetch: typeof fetch, timeoutMs: number, maxBodyBytes?: number }} options
 * @returns {Promise<HttpResult>}
 */
export async function send(
  request,
  { fetch: fetchImpl, timeoutMs, maxBodyBytes = MAX_BODY_BYTES },
) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetchImpl(request.url, {
      method: request.method,
      headers: { ...request.headers },
      body: request.body,
      redirect: "manual",
      signal: controller.signal,
    });
    const { body, tooLarge } = await readBody(response, maxBodyBytes);
    return { status: response.status, headers: response.headers, body, tooLarge };
  } catch (cause) {
    throw new NetworkError(describeFailure(request.url, cause, timedOut, timeoutMs), cause);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads the body as bytes, at most `limit` of them. A longer body is abandoned (the stream is
 * cancelled, so even an endless one ends) instead of being held in memory.
 *
 * @param {Response} response
 * @param {number} limit
 * @returns {Promise<{ body: Uint8Array, tooLarge: boolean }>}
 */
async function readBody(response, limit) {
  const empty = new Uint8Array(0);
  if (response.body === null) return { body: empty, tooLarge: false };
  const reader = response.body.getReader();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return { body: empty, tooLarge: true };
    }
    chunks.push(value);
  }
  return { body: Buffer.concat(chunks), tooLarge: false };
}

/**
 * @param {string} url
 * @param {unknown} cause
 * @param {boolean} timedOut
 * @param {number} timeoutMs
 */
function describeFailure(url, cause, timedOut, timeoutMs) {
  if (timedOut) return `The request to ${url} timed out after ${timeoutMs} ms.`;
  return `Could not get an answer from ${url}: ${reasonOf(cause)}`;
}

/**
 * fetch reports every failure as "TypeError: fetch failed" and keeps the useful part (for
 * example ECONNREFUSED or ENOTFOUND) in the cause.
 *
 * @param {unknown} error
 * @returns {string}
 */
function reasonOf(error) {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof Error) {
    const code = "code" in cause && typeof cause.code === "string" ? cause.code : "";
    return code === "" ? cause.message : `${code} ${cause.message}`.trim();
  }
  return error instanceof Error ? error.message : String(error);
}
