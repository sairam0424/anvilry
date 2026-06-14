import { buildLlmsTxt } from "@/lib/llms-txt";

// Static text/plain — Next 16 GET handlers are dynamic by default, so force-static so
// it's prerendered like the rest of the SSG surface (the content is build-time fixed).
export const dynamic = "force-static";

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
