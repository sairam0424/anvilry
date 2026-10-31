import { buildHomeMarkdown } from "@/lib/home-markdown";
import { markdownResponse } from "@/lib/markdown-response";

/** Markdown twin of the homepage, reached through Accept negotiation on "/" and at /index.md. */
export function GET() {
  return markdownResponse(buildHomeMarkdown(), { canonicalPath: "/" });
}
