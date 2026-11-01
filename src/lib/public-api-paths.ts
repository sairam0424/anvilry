import { BATCH_PATH } from "./api-policy";

/**
 * Which request paths belong to the public API, for the proxy: those paths get the version and
 * rate-limit headers, count against the per-client budget and can answer 429. The module imports
 * only the constants of api-policy.ts (which imports nothing) because src/proxy.ts needs it on
 * every proxied request and must not pull the content layer into the proxy bundle.
 *
 * proxy.ts must wake up for every path this accepts, or the headers silently vanish for that
 * path; public-api-paths.test.ts checks the proxy matcher against every documented path.
 */

const EXACT_PATHS = new Set([
  "/api/v1",
  "/.well-known/api-catalog",
  "/api/resume.json",
  "/api/github/stats",
  "/llms.txt",
  "/llms-full.txt",
  "/openapi.json",
  "/feed.xml",
  "/sitemap.xml",
  "/robots.txt",
]);

/** Prefixes whose whole subtree is public API. */
const PREFIXES = ["/api/v1/", "/api/mcp/"] as const;

/** /<kind>/<slug>.md and /<page>.md, the Markdown twins of content items and of pages. */
const MARKDOWN_TWIN =
  /^\/(?:(?:projects|work|articles|notes)\/)?[A-Za-z0-9_-]+\.md$/;

/** A trailing slash never makes a different route, so every lookup below ignores it. */
function withoutTrailingSlash(rawPathname: string): string {
  return rawPathname.length > 1
    ? rawPathname.replace(/\/+$/, "") || "/"
    : rawPathname;
}

/** What a public path accepts unless METHOD_EXCEPTIONS says otherwise: reading, and the preflight. */
const READ_ONLY_METHODS = ["GET", "HEAD", "OPTIONS"] as const;

/**
 * The paths that take other methods. The batch endpoint is a POST that only ever reads: its body
 * lists GET operations. Nothing else in the public API accepts a write; the MCP endpoint is not
 * in this table because the proxy hands its methods to the route untouched.
 */
const METHOD_EXCEPTIONS: ReadonlyMap<string, readonly string[]> = new Map([
  [BATCH_PATH, ["POST", "OPTIONS"]],
]);

/** The methods the proxy lets through for a public path; it answers any other with a JSON 405. */
export function allowedMethods(rawPathname: string): readonly string[] {
  return METHOD_EXCEPTIONS.get(withoutTrailingSlash(rawPathname)) ?? READ_ONLY_METHODS;
}

export function isPublicApiPath(rawPathname: string): boolean {
  const pathname = withoutTrailingSlash(rawPathname);
  if (EXACT_PATHS.has(pathname)) return true;
  if (PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return MARKDOWN_TWIN.test(pathname);
}
