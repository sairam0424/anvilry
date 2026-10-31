/**
 * Which request paths belong to the public API, for the proxy: those paths get the version and
 * rate-limit headers, count against the per-client budget and can answer 429. The module has no
 * imports because src/proxy.ts needs it on every proxied request and must not pull the content
 * layer into the proxy bundle.
 *
 * proxy.ts must wake up for every path this accepts, or the headers silently vanish for that
 * path; public-api-paths.test.ts checks the proxy matcher against every documented path.
 */

const EXACT_PATHS = new Set([
  "/api/v1",
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

export function isPublicApiPath(rawPathname: string): boolean {
  const pathname =
    rawPathname.length > 1
      ? rawPathname.replace(/\/+$/, "") || "/"
      : rawPathname;
  if (EXACT_PATHS.has(pathname)) return true;
  if (PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  return MARKDOWN_TWIN.test(pathname);
}
