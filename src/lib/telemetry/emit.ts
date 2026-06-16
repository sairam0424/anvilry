import { redis } from "@/lib/redis";
import type { TelemetryEvent } from "./schema";

/**
 * Dual-sink telemetry emitter.
 *
 * Every TelemetryEvent goes to TWO sinks:
 *
 *   1. Vercel Runtime Logs (always, never throws) — `console.log("[trace]", json)`.
 *      The `[trace]` prefix is the grep handle: any operator can `vercel logs |
 *      grep '\[trace\]'` and pipe to jq. This sink is the SOURCE OF TRUTH; the
 *      Redis sink is best-effort decoration for the dashboard.
 *
 *   2. Upstash Redis sorted set (best-effort, swallows errors) — `ZADD
 *      anvilry:trace:<kind>` keyed by event.ts as the score, with a parallel
 *      ZREMRANGEBYSCORE that trims anything older than 7 days. The 7-day window
 *      is deliberate: long enough to debug a stale prod incident, short enough
 *      that the free-tier Upstash quota stays comfortable. Per-kind keys (one
 *      sorted set per `kind`) keep individual reads cheap — the dashboard only
 *      pulls the `llm.attempt` set, not the firehose.
 *
 * fire-and-forget contract: emit() is `void`, NOT `Promise<void>`, even though
 * Redis ZADD is async. Callers are routes/handlers in hot paths; making them
 * `await emit(...)` would couple request latency to Upstash availability — and
 * the whole point of the dual-sink design is that Redis going sideways must
 * never block (or worse, fail) a real request. The `.catch(...)` swallows ALL
 * Redis errors and logs a warn so the deploy logs still surface the failure
 * without escalating it past the request boundary.
 *
 * What emit() does NOT do: redaction. The caller is responsible for redacting
 * PII (IPs, full prompts, names) BEFORE calling emit() — different `kind`s have
 * different PII shapes (an `llm.attempt` event has tokens but no message text,
 * a `chat.request` event has a redacted message preview), and only the call
 * site knows what's safe for that kind. emit() is mechanical: it serializes
 * whatever it's given and pushes to both sinks. Garbage in -> garbage stored.
 *
 * Test convention: see emit.test.ts for the vi.hoisted + vi.mock pattern that
 * stubs the @/lib/redis singleton — the redis module is mocked at the import
 * boundary so this code path runs against an in-memory fake.
 */

const SEVEN_DAYS_MS = 7 * 86_400_000;

export function emit(event: TelemetryEvent): void {
  // Sink 1 — Vercel Runtime Logs. Never throws. Wrap in try/catch defensively
  // anyway: a custom global console.log replacement that throws would otherwise
  // take down the request, which violates the fail-open contract.
  try {
    console.log("[trace]", JSON.stringify(event));
  } catch {
    // Console is broken / serializer choked. Nothing we can do — the second
    // sink may still succeed, so don't return.
  }

  // Sink 2 — Upstash Redis sorted set. Best-effort, swallows errors.
  if (!redis) return;

  const key = `anvilry:trace:${event.kind}`;
  const member = JSON.stringify(event);
  const cutoff = event.ts - SEVEN_DAYS_MS;

  // Promise rejections caught explicitly; we never await, so an unhandled
  // rejection would otherwise bubble to the runtime as a "process warning".
  redis
    .zadd(key, { score: event.ts, member })
    .catch((err: unknown) =>
      console.warn(
        "[telemetry] redis sink failed: %s",
        err instanceof Error ? err.name : "unknown",
      ),
    );

  redis
    .zremrangebyscore(key, 0, cutoff)
    .catch((err: unknown) =>
      console.warn(
        "[telemetry] redis sink failed: %s",
        err instanceof Error ? err.name : "unknown",
      ),
    );
}
