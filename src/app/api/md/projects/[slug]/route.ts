import { methodNotAllowed, optionsFor } from "@/lib/api-error";
import { markdownForContent } from "@/lib/markdown-content";

/** Markdown twin of /projects/<slug>, reached through the .md rewrite and Accept negotiation. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return markdownForContent("projects", slug);
}

// Methods this route does not implement answer a JSON 405 (with Allow) instead of Next's empty one.
const notAllowed = methodNotAllowed(["GET", "HEAD"]);
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS = optionsFor(["GET", "HEAD"]);
