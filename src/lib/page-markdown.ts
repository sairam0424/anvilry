import { markdownNotFound, markdownResponse } from "@/lib/markdown-response";
import {
  buildAboutMarkdown,
  buildArticlesMarkdown,
  buildDecisionsMarkdown,
  buildNotesMarkdown,
  buildProjectsMarkdown,
  buildWorkMarkdown,
} from "@/lib/page-markdown-lists";
import { renderProseMarkdown } from "@/lib/page-markdown-prose";
import { isPageTwin, type PageTwin } from "@/lib/page-twins";

/**
 * The Markdown twin of /<page> for the pages in PAGE_TWINS, served at /<page>.md and, through
 * `Accept: text/markdown`, at /<page> itself (rewrites in next.config.ts and src/proxy.ts).
 *
 * Lists (about, projects, work, decisions, articles, notes) are written from the same data the
 * page renders; prose pages (contact, developers, mcp, privacy) are the page's own elements
 * converted. Either way the twin has no copy of the page's text to fall out of date.
 */

/** The Markdown for a page, or null when the HTML page is a 404 (no articles, notes switched off). */
export async function buildPageMarkdown(
  page: PageTwin,
): Promise<string | null> {
  switch (page) {
    case "about":
      return buildAboutMarkdown();
    case "projects":
      return buildProjectsMarkdown();
    case "work":
      return buildWorkMarkdown();
    case "decisions":
      return buildDecisionsMarkdown();
    case "articles":
      return buildArticlesMarkdown();
    case "notes":
      return buildNotesMarkdown();
    default:
      return renderProseMarkdown(page);
  }
}

/** The response for /api/md/pages/<name>: the twin, or the Markdown 404 the HTML page would also be. */
export async function markdownForPage(name: string): Promise<Response> {
  if (!isPageTwin(name)) return markdownNotFound(`/${name}`);
  const body = await buildPageMarkdown(name);
  if (body === null) return markdownNotFound(`/${name}`);
  return markdownResponse(body, { canonicalPath: `/${name}` });
}
