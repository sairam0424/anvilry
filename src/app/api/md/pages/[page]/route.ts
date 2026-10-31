import { methodNotAllowed, optionsFor, withJsonErrors } from "@/lib/api-error";
import { markdownForPage } from "@/lib/page-markdown";

/**
 * Markdown twin of /<page> (about, articles, contact, decisions, developers, mcp, notes, privacy,
 * projects, work), reached through the /<page>.md rewrite and Accept negotiation. A name outside
 * that list is answered with the Markdown 404 inside markdownForPage.
 *
 * The prose pages are built by converting the page's own elements (src/lib/element-markdown.ts).
 * If that ever throws, the shared JSON error is returned instead of Next's empty 500, and the
 * cause is logged by name only (withJsonErrors).
 */
export const GET = withJsonErrors(
  async (_req: Request, { params }: { params: Promise<{ page: string }> }) => {
    const { page } = await params;
    return markdownForPage(page);
  },
);

// Methods this route does not implement answer a JSON 405 (with Allow) instead of Next's empty one.
const notAllowed = methodNotAllowed(["GET", "HEAD"]);
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = optionsFor(["GET", "HEAD"]);
