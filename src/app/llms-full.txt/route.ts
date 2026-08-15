import { buildCorpus } from "@/lib/corpus";

/**
 * GET /llms-full.txt
 *
 * Full-context companion to /llms.txt — returns the complete chatbot grounding
 * corpus (~4-8KB) as plain text. Intended for LLM clients with large context
 * windows that can ingest the full portfolio content in one request.
 *
 * /llms.txt  — curated index (links + metadata, lightweight, ~1-2KB)
 * /llms-full.txt — full corpus (all work/project/skill details, ~4-8KB)
 *
 * Served statically. The previous `export const dynamic = "force-dynamic"` was removed for
 * cacheComponents (which rejects it), and its stated rationale — "so every deploy gets the
 * latest content without stale ISR" — did not hold: buildCorpus() reads build-time Velite
 * content, so a STATIC route is regenerated on every deploy too. force-dynamic only forced a
 * re-render per request for content that cannot change between deploys. Static is both correct
 * and faster for the agent/crawler clients this endpoint exists to serve.
 */

export function GET() {
  return new Response(buildCorpus(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
