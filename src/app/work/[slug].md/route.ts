import { methodNotAllowed } from "@/lib/api-error";
import { markdownForContent } from "@/lib/markdown-content";

// Next.js does not populate params for directory segments of the form `[param].ext`, so the slug
// is read from the URL. The same factory answers the /api/md/work/<slug> rewrite target, so
// both paths behave identically (Markdown, Vary: Accept, Markdown 404).
export function GET(req: Request) {
  const slug = new URL(req.url).pathname.split("/").pop()?.replace(/\.md$/, "") ?? "";
  return markdownForContent("work", slug);
}

// Methods this route does not implement answer a JSON 405 (with Allow) instead of Next's empty one.
const notAllowed = methodNotAllowed(["GET", "HEAD"]);
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
