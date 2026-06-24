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
 * force-dynamic so every deploy gets the latest content without stale ISR.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(buildCorpus(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
