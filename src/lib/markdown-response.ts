import { SITE_URL } from "@/lib/site-url";

/**
 * One response shape for every Markdown representation (see accept-negotiation.ts): the media
 * type, `Vary: Accept` because the same URL serves HTML to browsers, and a revalidating cache
 * policy so a shared cache can never pin an outdated twin.
 */

const MAX_ECHOED_PATH = 120;

type MarkdownOptions = {
  status?: number;
  /** Site path of the HTML page this is the twin of, advertised as rel="canonical". */
  canonicalPath?: string;
  noindex?: boolean;
};

export function markdownResponse(body: string, options: MarkdownOptions = {}): Response {
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    Vary: "Accept",
    "Cache-Control": "public, max-age=0, must-revalidate",
  });
  if (options.canonicalPath) {
    headers.set("Link", `<${SITE_URL}${options.canonicalPath}>; rel="canonical"`);
  }
  if (options.noindex) headers.set("X-Robots-Tag", "noindex");
  return new Response(body, { status: options.status ?? 200, headers });
}

/**
 * The requested path is attacker-controlled text that an AI agent will read as context, so the
 * 404 body echoes only a strict allow-list of characters and replaces everything else.
 */
export function sanitizeRequestedPath(raw: string): string {
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const safe = withSlash.replace(/[^A-Za-z0-9/._~%-]/g, "?");
  return safe.length > MAX_ECHOED_PATH ? `${safe.slice(0, MAX_ECHOED_PATH)}…` : safe;
}

export function markdownNotFoundBody(requestedPath: string): string {
  const path = sanitizeRequestedPath(requestedPath);
  return `# 404: page not found

There is no page at \`${path}\` on anvilry.vercel.app, so this request returned HTTP 404. The path may be mistyped, or the page may have been removed.

Start from one of these instead:

- [llms.txt](${SITE_URL}/llms.txt): a curated index of this site for AI agents
- [llms-full.txt](${SITE_URL}/llms-full.txt): every project, work item and article in one file
- [Sitemap](${SITE_URL}/sitemap.xml): every public URL
- [Home](${SITE_URL}/): the portfolio of Sairam Ugge
`;
}

export function markdownNotFound(requestedPath: string): Response {
  return markdownResponse(markdownNotFoundBody(requestedPath), { status: 404, noindex: true });
}
