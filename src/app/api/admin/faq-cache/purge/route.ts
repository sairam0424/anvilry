import { requireAdmin } from "@/lib/admin-auth";
import { faqCachePurge } from "@/lib/chat-cache";

export const maxDuration = 10;

/**
 * POST /api/admin/faq-cache/purge
 *
 * Removes a single FAQ-cache entry by its question text — the operator
 * remediation path for a discovered-bad cached answer (e.g. a jailbreak that
 * finished cleanly and so passed chat-cache.ts's completion-integrity gate,
 * which checks finish_reason, not content safety) without needing a deploy
 * or direct Upstash console access.
 *
 * Auth: same HTTP Basic scheme as /admin/telemetry (ADMIN_PASSWORD via
 * requireAdmin() — src/lib/admin-auth.ts). Deliberately NOT rate-limited like
 * /api/chat: this is an authenticated admin action, not a public cost-bearing
 * endpoint.
 *
 * Example: curl -u admin:$ADMIN_PASSWORD -X POST .../api/admin/faq-cache/purge
 *   -H "Content-Type: application/json" -d '{"question":"What is Pensieve?"}'
 */
// Rejects a declared body over this before ever calling req.json() — mirrors
// the same declared-Content-Length-before-parse guard /api/chat/route.ts
// uses. {"question": "<=2000 chars>"} plus JSON overhead fits comfortably
// under 4KB; this exists purely so an authenticated admin request can't hand
// an unbounded body to req.json()'s buffering before the question-length
// check below ever runs.
const MAX_BODY_BYTES = 4 * 1024;

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (auth instanceof Response) return auth;

  const declaredLen = Number(req.headers.get("content-length") ?? 0);
  if (declaredLen > MAX_BODY_BYTES) {
    return Response.json({ error: "Request too large." }, { status: 413 });
  }

  let body: { question?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Content-Length bypass backstop: a missing/false header skips the
  // declared-length check above entirely (it defaults to 0), so req.json()
  // would otherwise buffer an unbounded body before this point. Mirrors the
  // same post-read guard used in /api/transcribe/route.ts and /api/error/route.ts.
  if (JSON.stringify(body).length > MAX_BODY_BYTES) {
    return Response.json({ error: "Request too large." }, { status: 413 });
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
  if (result.status === "error") {
    return Response.json(result, { status: 503 });
  }
  return Response.json(result);
}
