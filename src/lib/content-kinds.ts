/**
 * The content kinds whose HTML page at /<kind>/<slug> has a Markdown twin. Kept in a module of
 * its own, with no imports, because src/proxy.ts needs the list on every proxied request and
 * must not drag the content layer (src/lib/content.ts) or node:fs into the proxy bundle.
 */
export const CONTENT_KINDS = ["projects", "work", "articles", "notes"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
