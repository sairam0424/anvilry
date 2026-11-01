/**
 * Numbers and names the CLI shares with the Anvilry public API. The CLI is a standalone package
 * and cannot import from the site, so tests/cli/drift.test.ts pins each value that has a twin in
 * src/ (API version, slug rule, batch limit, canonical origin) to its source.
 */

/** Canonical origin of the hosted API; overridden by --base-url or ANVILRY_BASE_URL. */
export const DEFAULT_BASE_URL = "https://anvilry.vercel.app";

/** The one environment variable the CLI reads. */
export const BASE_URL_ENV = "ANVILRY_BASE_URL";

/** The API version this client speaks, sent on every request as the API-Version header. */
export const API_VERSION = "1";
export const API_VERSION_HEADER = "API-Version";

/** Milliseconds before a request is abandoned, and the largest value --timeout accepts. */
export const DEFAULT_TIMEOUT_MS = 15_000;
export const MAX_TIMEOUT_MS = 600_000;

/** The largest response body the CLI reads (10 MiB); a longer one is refused with exit code 2. */
export const MAX_BODY_BYTES = 10 * 1024 * 1024;

/**
 * Limits on pretty-printing a response that is within the size limit above. JSON.stringify
 * recurses, so a body nested a few thousand levels deep overflows the stack, and indentation
 * multiplies the size of a deep one (a few MB of nested arrays can ask for gigabytes). A body past
 * either limit is refused with exit code 2; --raw still prints it.
 */
export const MAX_PRETTY_NESTING = 1000;
export const MAX_PRETTY_CHARS = 64 * 1024 * 1024;

/** A slug is 1 to 120 letters, digits, underscores or hyphens. Checked before any request. */
export const SLUG_PATTERN = "^[A-Za-z0-9_-]{1,120}$";

/** Most operations one batch may carry; the API refuses more. */
export const BATCH_MAX_OPERATIONS = 25;

export const DOCS_URL = `${DEFAULT_BASE_URL}/developers`;

/** Process exit codes. 0 success, 1 usage error, 2 the API refused or sent something unusable, 3 no answer. */
export const EXIT_CODES = Object.freeze({
  OK: 0,
  USAGE: 1,
  API: 2,
  NETWORK: 3,
});
