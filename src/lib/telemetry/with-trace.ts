import { emit } from "@/lib/telemetry/emit";
import { hashIp, type KindLiteral, type TelemetryEvent } from "@/lib/telemetry/schema";

/**
 * withTrace — the universal /api/* observability wrapper.
 *
 * One request = one traceId. The wrapper mints a v4 UUID before the handler runs,
 * propagates it back to the client via `x-anvilry-trace-id`, and emits exactly ONE
 * span on completion: `http.request` on success, `server.error` on uncaught throw.
 * The error is RE-THROWN after emission so the route's own catch logic still runs —
 * withTrace is a side observer, never a swallow.
 *
 * Why a wrapper and not middleware: Next 16 middleware runs on the Edge runtime and
 * doesn't see the response body or the route's own errors. The cost-bearing routes
 * (chat / tts / transcribe) all run on `runtime: "nodejs"`, so the wrapper sits where
 * the work actually happens. It also lets the route enrich the auto event via
 * `ctx.attrs({ status, byteCount, ... })` — middleware can't do that without a
 * second roundtrip.
 *
 * Header-mutation strategy: a `Response` returned from the handler has IMMUTABLE
 * headers when constructed via `Response.json` / `new Response(body, init)`. The
 * spec allows `headers.set()` but throws on guarded responses in some runtimes —
 * we sidestep by reconstructing: `new Response(res.body, { status, statusText,
 * headers: { ...existing, "x-anvilry-trace-id": traceId } })`. Passing `res.body`
 * (a ReadableStream) preserves streaming semantics — the body is NOT consumed.
 *
 * Telemetry is fire-and-forget: emit() is called without await and wrapped in
 * try/catch so a broken sink can never break a paying route.
 */

export type TraceCtx = {
  traceId: string;
  spanId: string;
  startedAt: number;
  ipHash: string;
  uaHash: string;
  /** Add per-route attrs to the auto-emitted http.request event. */
  attrs(extra: Record<string, unknown>): void;
};

/**
 * Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). Inlined
 * verbatim from src/lib/rate-limit.ts:48-53 — duplicated rather than exported because
 * the rate-limit module's surface is intentionally tiny (one async checker), and
 * cross-importing a private helper across observability + cost-guard concerns would
 * couple two modules that should remain independently swappable.
 */
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}

/**
 * Pull an AWS request id off an arbitrary error object. The AWS SDK v3 hangs the
 * request id on `err.$metadata.requestId` for every Bedrock / Polly / Transcribe
 * failure — capturing it lets a single trace id correlate Vercel logs <-> CloudWatch
 * <-> the AWS support ticket. Returns undefined for non-AWS errors so the field
 * stays absent in the emitted event (vs. explicit null).
 */
function awsRequestIdOf(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const meta = (err as { $metadata?: { requestId?: unknown } }).$metadata;
  if (!meta || typeof meta !== "object") return undefined;
  const id = meta.requestId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/**
 * Telemetry emission MUST never throw into the request path. emit() is async-ish
 * (may return a Promise from the Redis pipeline); we don't await it so the route
 * isn't gated on Upstash latency, and we swallow any synchronous OR async error.
 */
function safeEmit(event: TelemetryEvent): void {
  try {
    const maybe = emit(event) as unknown;
    if (maybe && typeof (maybe as { catch?: unknown }).catch === "function") {
      (maybe as Promise<void>).catch(() => {
        /* swallow — telemetry must never break the route */
      });
    }
  } catch {
    /* swallow — telemetry must never break the route */
  }
}

/**
 * Wrap a route handler. Usage:
 *
 *   export async function POST(req: Request) {
 *     return withTrace(req, "chat", async (ctx) => {
 *       // ... existing route logic ...
 *       ctx.attrs({ status: 200, byteCount: bytes.length });
 *       return Response.json({ ok: true });
 *     });
 *   }
 *
 * The handler may throw — the throw escapes withTrace unchanged after a server.error
 * span has been recorded. The handler may also catch + return a 5xx Response
 * itself, in which case http.request fires with that status.
 */
export async function withTrace<T extends Response>(
  req: Request,
  route: string,
  handler: (ctx: TraceCtx) => Promise<T>,
): Promise<T> {
  const traceId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const spanId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const startedAt = Date.now();
  const salt = process.env.TELEMETRY_IP_SALT;
  const ipHash = hashIp(clientIp(req), salt);
  const uaHash = hashIp(req.headers.get("user-agent") ?? "", salt);

  // Closure-captured, append-only object the route enriches via ctx.attrs().
  // We merge per-call rather than mutating in place — keeps the surface immutable
  // from the route's POV (the route hands us a snapshot, we keep our own copy).
  let extraAttrs: Record<string, unknown> = {};
  const ctx: TraceCtx = {
    traceId,
    spanId,
    startedAt,
    ipHash,
    uaHash,
    attrs(extra: Record<string, unknown>) {
      extraAttrs = { ...extraAttrs, ...extra };
    },
  };

  // Build a fresh envelope per emit. The schema (Phase 1.1) puts per-kind fields
  // under `attrs` rather than flattening onto the envelope — so `status`, `byteCount`,
  // `err`, etc. all live under attrs, while `traceId/spanId/route/level/kind/ts`
  // stay on the envelope itself.
  const buildEvent = (
    kind: KindLiteral,
    level: TelemetryEvent["level"],
    attrs: Record<string, unknown>,
  ): TelemetryEvent => ({
    ts: startedAt,
    traceId,
    spanId,
    kind,
    route,
    level,
    attrs: { ipHash, uaHash, ...attrs },
  });

  try {
    const res = await handler(ctx);
    const latencyMs = Date.now() - startedAt;

    // Reconstruct so we can stamp the trace-id header. Passing res.body (a stream
    // OR null) preserves the original transport semantics: a streamed Response stays
    // streamed; a JSON Response keeps its already-encoded body. We do NOT clone the
    // body to a buffer — that would defeat streaming and double the memory cost.
    const traced = new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: new Headers(res.headers),
    });
    traced.headers.set("x-anvilry-trace-id", traceId);

    // 5xx upgrades level to "error" automatically — saves every route from passing
    // a level explicitly when the only signal is the status code itself.
    const level: TelemetryEvent["level"] = res.status >= 500 ? "error" : "info";
    safeEmit(
      buildEvent("http.request", level, {
        status: res.status,
        latency_ms: latencyMs,
        ...extraAttrs,
      }),
    );

    // Cast: the wrapper's contract is to preserve the handler's response type. We
    // reconstruct only to add a header — the body, status, and statusText are all
    // round-tripped, so the runtime shape matches T (which extends Response).
    return traced as T;
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const e = err as Error & { $metadata?: { requestId?: unknown } };
    const awsId = awsRequestIdOf(err);
    safeEmit(
      buildEvent("server.error", "error", {
        latency_ms: latencyMs,
        err: {
          name: e?.name ?? "Error",
          message: e?.message ?? String(err),
          stack: e?.stack,
          ...(awsId ? { awsRequestId: awsId } : {}),
        },
        ...extraAttrs,
      }),
    );
    // Re-throw so the route's own try/catch (or Next's framework default) runs.
    // withTrace is an OBSERVER; never a SWALLOWER.
    throw err;
  }
}
