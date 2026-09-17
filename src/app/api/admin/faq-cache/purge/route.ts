import { requireAdmin } from "@/lib/admin-auth";
import { faqCachePurge } from "@/lib/chat-cache";

export const maxDuration = 10;

/**
 * POST /api/admin/faq-cache/purge
 *
 * Removes a single FAQ-cache entry by its question text — the operator
 * remediation path for a discovered-bad cached answer (e.g. a jailbreak that
 * slipped past the content-safety gate in chat-cache.ts) without needing a
 * deploy or direct Upstash console access.
 *
 * Auth: same HTTP Basic scheme as /admin/telemetry (ADMIN_PASSWORD via
 * requireAdmin() — src/lib/admin-auth.ts). Deliberately NOT rate-limited like
 * /api/chat: this is an authenticated admin action, not a public cost-bearing
 * endpoint.
 *
 * Example: curl -u admin:$ADMIN_PASSWORD -X POST .../api/admin/faq-cache/purge
 *   -H "Content-Type: application/json" -d '{"question":"What is Pensieve?"}'
 */
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof Response) return auth;

  let body: { question?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // 2000 chars is generous for a question to purge (the live chat path caps
  // input at 600) — this bound exists purely so an authenticated admin
  // request can't hand an unbounded string to normalizeQuestion/hashing.
  if (
    typeof body.question !== "string" ||
    body.question.trim().length === 0 ||
    body.question.length > 2000
  ) {
    return Response.json(
      { error: "question (non-empty string, max 2000 chars) is required." },
      { status: 400 },
    );
  }

  const result = await faqCachePurge(body.question);
  return Response.json(result);
}
