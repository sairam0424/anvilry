import { CONTENT_KINDS } from "@/lib/markdown-content";

/**
 * What src/proxy.ts does with a request whose Accept header asks for Markdown:
 *  - rewrite: the path has a Markdown twin, serve it;
 *  - pass: leave the request alone (the page is HTML-only, or the path is an API, an asset, a
 *    metadata image or an explicit file URL, where negotiation does not apply);
 *  - not-found: no such page, so answer with a real 404 whose body is Markdown.
 *
 * "not-found" is only safe if every real route is recognised, so markdown-routing.test.ts
 * compares this classification with the actual src/app tree and fails when a page is added
 * without being listed here.
 */

export type MarkdownRoute =
  | { action: "rewrite"; destination: string }
  | { action: "pass" }
  | { action: "not-found" };

/** Extension-less pages that exist only as HTML. A new page must be added here. */
export const HTML_ONLY_PAGES = [
  "/about",
  "/articles",
  "/contact",
  "/decisions",
  "/developers",
  "/mcp",
  "/notes",
  "/privacy",
  "/projects",
  "/resume",
  "/search",
  "/stats",
  "/work",
] as const;

const PASS_PREFIXES = ["/api/", "/_next/", "/_vercel/", "/.well-known/", "/admin/"] as const;
const METADATA_IMAGES = new Set(["opengraph-image", "twitter-image", "icon", "apple-icon"]);
const FILE_EXTENSION = /\.[A-Za-z0-9]{1,8}$/;
const CONTENT_TWIN = new RegExp(`^/(${CONTENT_KINDS.join("|")})/([A-Za-z0-9_-]+)$`);

export function classifyPath(rawPathname: string): MarkdownRoute {
  const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/+$/, "") || "/" : rawPathname;
  if (pathname === "/") return { action: "rewrite", destination: "/api/md/home" };

  if (pathname === "/admin" || PASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return { action: "pass" };
  }
  const last = pathname.split("/").pop() ?? "";
  if (FILE_EXTENSION.test(last) || METADATA_IMAGES.has(last)) return { action: "pass" };

  const twin = CONTENT_TWIN.exec(pathname);
  if (twin) return { action: "rewrite", destination: `/api/md/${twin[1]}/${twin[2]}` };

  if ((HTML_ONLY_PAGES as readonly string[]).includes(pathname)) return { action: "pass" };
  return { action: "not-found" };
}
