import { z } from "zod";
import { randomUUID } from "node:crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { withTrace } from "@/lib/telemetry/with-trace";
import { emit } from "@/lib/telemetry/emit";
import { redact } from "@/lib/telemetry/schema";

export const runtime = "nodejs";
// Tighter than /api/tts (15s): the route does no I/O — Zod parse + emit() and out.
// 5s gives generous slack for cold starts but caps a misbehaving payload at a fraction
// of a paid Polly call's blast radius. If this ever exceeds 5s something is structurally
// wrong (e.g. emit() blocking on a sync sink), and a fast timeout surfaces it.
export const maxDuration = 5;

/**
 * Same-origin browser error sink — Phase 3.1 of the v1.8 telemetry upgrade.
 *
 * Browser ErrorBoundary components (app/error.tsx, app/global-error.tsx) and window
 * listeners (instrumentation-client.ts) post to this route via navigator.sendBeacon.
 * One client.error TelemetryEvent per request, after redaction. Same-origin means the
 * existing strict CSP (`connect-src 'self'`) covers us — no third-party vendor (no
 * Sentry, no PostHog, no Datadog), no CSP changes, no client-side secret to leak.
 *
 * Why a Node runtime: the schema/emit modules import `node:crypto` (randomUUID) and
 * `@upstash/redis`. Edge-compat is achievable but pointless — this route never runs on
 * a hot user path; co-locating with /api/tts and /api/chat on Node keeps deploy targets
 * uniform and lets withTrace's UUID minting use the same code path as everything else.
 *
 * Mirrors the 5-stage gate pattern from /api/tts/route.ts:
 *   1) withTrace wrapper           — yes, errors get traced too. The http.request span
 *                                    on /api/error is a meta-event but valuable: it
 *                                    surfaces 429 storms (a misbehaving page beaconing
 *                                    in a tight loop) and 4xx abuse (someone spraying
 *                                    invalid payloads to bloat the Redis sink).
 *   2) telemetry-on-by-default     — TELEMETRY_ENABLED=false short-circuits to 204.
 *                                    Default ON because the whole point of v1.8 is to
 *                                    fail noisily — an opt-out env, not an opt-in.
 *   3) checkRateLimit              — 8/min per IP (shared limiter from /api/chat). A
 *                                    page stuck in an error loop could fire dozens of
 *                                    beacons per second; rate-limited.
 *   4) content-length 8KB cap      — error payloads are tiny (message + stack); 8KB
 *                                    leaves room for a long stack but rejects abuse.
 *   5) JSON parse + Zod validate   — strict shape; unknown sources / oversized fields
 *                                    rejected before any string hits emit().
 *
 * Client contract (load-bearing): src/lib/telemetry/beacon.ts wraps the JSON body in
 * `new Blob([body], { type: "application/json" })` BEFORE handing it to sendBeacon.
 * This is critical because sendBeacon defaults to `Content-Type: text/plain;
 * charset=UTF-8` for raw strings and refuses application/* types unless given a Blob.
 * The Blob route lets THIS handler call `req.json()` symmetrically with /api/chat,
 * /api/tts, and /api/transcribe — no special text-body parsing branch. If you
 * change the client to fetch() with explicit headers, this contract still works
 * because the route just calls req.json().
 *
 * Redaction: every visitor-supplied free-text field (message, stack) runs through
 * redact() from schema.ts before it lands in emit(). Visitors regularly paste API
 * keys / emails / phone numbers into chat, and a thrown error ("Failed to parse
 * sk-abc123...def") would otherwise carry the secret straight into the trace log.
 * componentStack is React-internal and not visitor-supplied, so it's stored as-is.
 *
 * Returns 204 with NO body on success — sendBeacon ignores the response anyway and
 * a body would just waste egress + parse time on the browser side.
 */

const MAX_BODY_BYTES = 8 * 1024;

/**
 * The accepted shape for an error beacon payload. Mirrors ErrorBeaconPayload in
 * src/lib/telemetry/beacon.ts; the source enum here is the source of truth — if you
 * add a new beacon origin, add it here AND in beacon.ts so the type and the runtime
 * validator can't drift apart silently.
 *
 * Field caps (max length) are deliberately generous but bounded: a 2KB message + 8KB
 * stack + 4KB componentStack is far more than any real error needs, but tight enough
 * that an attacker can't use this sink as a 1MB log smuggler.
 */
const ErrorBeaconSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  level: z.enum(["error", "warn"]).default("error"),
  source: z.enum(["boundary", "global-boundary", "window", "unhandledrejection", "react19"]),
  componentStack: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  return withTrace(req, "error", async (ctx) => {
    // Stage 2 — opt-out env. The "false" string check is deliberate: any other
    // value (unset, "true", "1", typo) keeps telemetry ON. Default-ON means a
    // forgotten env still gets us errors; an explicit kill-switch turns it off.
    if (process.env.TELEMETRY_ENABLED === "false") {
      ctx.attrs({ telemetry_enabled: false });
      return new Response(null, { status: 204 });
    }

    // Stage 3 — per-IP rate limit (8/min, sliding window from /api/chat).
    // A misbehaving page in an error loop is the threat model here; same limiter
    // as the cost-bearing routes because a beacon storm on a free route still
    // bloats the Redis sink (Phase 1.2's ZADD into anvilry:trace:client.error).
    const rl = await checkRateLimit(req);
    if (!rl.ok) {
      return new Response(null, {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfter) },
      });
    }

    // Stage 4 — declared content length up front. A real error payload is well
    // under 1KB; 8KB is a hard wall. Reject by header before reading the body so
    // we don't burn memory on a hostile 10MB blob the client claims is JSON.
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }

    // Stage 5a — parse. The client wraps the body in a Blob with
    // type "application/json" (see src/lib/telemetry/beacon.ts:71-72), so
    // req.json() works without a text/plain fallback. A malformed payload is a
    // 400, not a 5xx — the client's beacon loop must not retry-storm us.
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return new Response(null, { status: 400 });
    }

    // Content-Length bypass backstop: sendBeacon and the fetch fallback in
    // beacon.ts do not always send a Content-Length header, so the header-only
    // check at Stage 4 can be silently bypassed. A post-read size guard mirrors
    // the defence-in-depth pattern used in /api/transcribe/route.ts.
    if (JSON.stringify(raw).length > MAX_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }

    // Stage 5b — Zod validate. Unknown source / oversized field / wrong type all
    // resolve to a 400 here; we never call emit() with a payload the schema didn't
    // bless. .safeParse keeps the failure path branch-free (no try/catch around
    // the Zod throw form).
    const parsed = ErrorBeaconSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(null, { status: 400 });
    }
    const { message, stack, url, userAgent, level, source, componentStack } = parsed.data;

    // Emit. message + stack are redacted (visitor-supplied free-text — high PII risk
    // since the chat UI accepts pasted keys/emails which surface in thrown errors).
    // componentStack is React-internal (file paths + component names); not visitor
    // input, so we don't touch it. url and userAgent are short and structured —
    // the cap on the schema bounds them; not redacted.
    emit({
      ts: Date.now(),
      traceId: ctx.traceId,
      spanId: randomUUID(),
      parentSpanId: ctx.spanId,
      kind: "client.error",
      route: "/api/error",
      level,
      message: redact(message),
      attrs: {
        source,
        url,
        stack: stack ? redact(stack) : undefined,
        componentStack,
        userAgent,
      },
    });

    // Stamp the auto http.request span with the kind + source for triage. Lets the
    // dashboard slice meta-events (e.g. "all 4xx /api/error from window source") without
    // pulling the client.error sink.
    ctx.attrs({ source, level, has_stack: !!stack, has_component_stack: !!componentStack });

    // 204 — no body. sendBeacon ignores response bodies; we save the bytes.
    return new Response(null, { status: 204 });
  });
}
