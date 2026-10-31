import { markdownNotFound } from "@/lib/markdown-response";

const OWN_PATH = "/api/md/not-found";

/**
 * A real 404 with a Markdown body, for clients that asked for Markdown (see src/proxy.ts).
 * The proxy rewrites to this handler and passes the requested path in `p`. Next keeps the original
 * URL on a rewrite while some runtimes expose the rewritten one, so both are read: `p` first,
 * then the URL's own path. The path is sanitised before it is echoed (markdown-response.ts).
 */
export function GET(req: Request) {
  const url = new URL(req.url);
  const requested = url.searchParams.get("p") ?? (url.pathname === OWN_PATH ? "/" : url.pathname);
  return markdownNotFound(requested);
}
