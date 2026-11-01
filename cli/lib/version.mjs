import { readFileSync } from "node:fs";

/**
 * The package version, read from the package.json that ships next to lib/ so the version, the
 * User-Agent and `anvilry --version` cannot disagree with what npm published.
 */
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

/** @type {string} */
export const VERSION = manifest.version;

export const USER_AGENT = `anvilry-cli/${VERSION}`;
