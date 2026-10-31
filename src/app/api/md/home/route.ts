import { methodNotAllowed } from "@/lib/api-error";
import { buildHomeMarkdown } from "@/lib/home-markdown";
import { markdownResponse } from "@/lib/markdown-response";

/** Markdown twin of the homepage, reached through Accept negotiation on "/" and at /index.md. */
export function GET() {
  return markdownResponse(buildHomeMarkdown(), { canonicalPath: "/" });
}

// Methods this route does not implement answer a JSON 405 (with Allow) instead of Next's empty one.
const notAllowed = methodNotAllowed(["GET", "HEAD"]);
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
