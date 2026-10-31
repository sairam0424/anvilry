/**
 * The pages whose HTML at /<page> has a Markdown twin at /<page>.md (and answers
 * `Accept: text/markdown`). The list lives in a module with no imports because src/proxy.ts
 * reaches it through markdown-routing.ts on every proxied request and must not pull the content
 * layer or node:fs into the proxy bundle.
 *
 * Deliberately without a twin, so they stay HTML-only (HTML_ONLY_PAGES in markdown-routing.ts):
 *  - /resume  a PDF viewer, there is no text of its own to convert;
 *  - /search  an interactive Pagefind search, it has no content until a visitor types;
 *  - /stats   live GitHub numbers, which a cached twin would make stale.
 *
 * next.config.ts repeats this list in its rewrite pattern (the config is loaded outside the app's
 * `@/` alias and, like its other content-kind lists, imports nothing from src/), and
 * next-config.test.ts fails if the two disagree.
 */
export const PAGE_TWINS = [
  "about",
  "articles",
  "contact",
  "decisions",
  "developers",
  "mcp",
  "notes",
  "privacy",
  "projects",
  "work",
] as const;

export type PageTwin = (typeof PAGE_TWINS)[number];

const PAGE_TWIN_SET: ReadonlySet<string> = new Set(PAGE_TWINS);

export function isPageTwin(value: string): value is PageTwin {
  return PAGE_TWIN_SET.has(value);
}
