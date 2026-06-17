# TELEMETRY.md — Anvilry Observability Layer (v1.8)

End-to-end structured telemetry for the "Ask my portfolio" chatbot. Zero new vendors —
all sinks are same-origin (Vercel Runtime Logs) or already-provisioned infra (Upstash Redis).
Every event is PII-redacted at the call site before storage.

---

## 1. Architecture

```
Frontend                        Backend                        Sinks
───────────────────────         ────────────────────────────   ──────────────────
app/error.tsx (React boundary)  /api/chat  ──┐                 Vercel Runtime Logs
global-error.tsx (root boundary) /api/tts   ├── withTrace ──── (console.log, always)
instrumentation-client.ts       /api/tts-g  │   ↓
  window.error listener         /api/trans  │   emit()  ──────  Upstash Redis
  unhandledrejection listener               │   ↓               (ZADD per kind,
       │                                    │   llm.attempt      7-day retention,
       └── sendBeacon ─────────────────→  /api/error            best-effort)
                                                ↓
                                             emit()
                                                          Read:  /admin/telemetry
                                                                 scripts/replay-trace.mjs
```

**Two sinks, both fail-open:**
- `console.log('[trace]', JSON.stringify(event))` → Vercel Runtime Logs (free, 1h Hobby / 24h Pro retention). Always fires.
- `redis.zadd('anvilry:trace:<kind>', ...)` → Upstash (queryable, 7-day retention, per-kind sorted sets). Best-effort; Redis errors swallowed.

---

## 2. Event schema

Every event is a `TelemetryEvent` (Zod-validated, see `src/lib/telemetry/schema.ts`):

```typescript
{
  ts: number;              // Date.now() at emission
  traceId: string;         // crypto.randomUUID() per request
  spanId: string;          // crypto.randomUUID() per span
  parentSpanId?: string;   // set on child spans (llm.attempt → http.request)
  kind: KindLiteral;       // see below
  route?: string;          // "/api/chat" etc
  level: "info" | "warn" | "error";
  message?: string;        // redacted free text (optional)
  attrs: Record<string, unknown>;  // per-kind attributes
}
```

### Span kinds

| Kind | Source | Key attrs |
|---|---|---|
| `http.request` | withTrace on every /api/* call | status, latency_ms, ipHash, uaHash, route-specific |
| `llm.attempt` | onAttempt callback in streamWithFallback | model, attempt_index, fell_back, ttft_ms, latency_ms, finish_reason, usage |
| `tts.request` | /api/tts + /api/tts-google | voiceId, char_count, cache_hit, aws_request_id |
| `transcribe.request` | /api/transcribe | audio_bytes, audio_seconds, transcript_chars, aws_request_id |
| `client.error` | /api/error sink (browser ErrorBoundary + window listeners) | source, url, stack (redacted) |
| `server.error` | withTrace on uncaught throw + explicit emit in catch blocks | route, error_name, error_message, aws_request_id |
| `budget.tick` | reserved for v1.8.x cost-cap follow-up | — |

### The headline span: `llm.attempt`

The `usage` block on `llm.attempt` is the first place Anvilry has ever measured prompt caching:

```json
{
  "kind": "llm.attempt",
  "attrs": {
    "model": "us.anthropic.claude-sonnet-4-6",
    "attempt_index": 0,
    "fell_back": false,
    "ttft_ms": 312,
    "latency_ms": 1847,
    "finish_reason": "end_turn",
    "usage": {
      "input_tokens": 12,
      "output_tokens": 143,
      "cache_creation_input_tokens": 4096,
      "cache_read_input_tokens": 0
    }
  }
}
```

`cache_read_input_tokens > 0` on turns 2+ of the same session means caching is working.
If it stays 0 after 7 days, the 5-min TTL is expiring between visits (see Notes below).

---

## 3. Trace ID correlation

Every `/api/*` response carries `x-anvilry-trace-id` in the response headers. The chat
stream additionally appends the trace frame after the U+001E delimiter. This means:

- A visitor can find their traceId in the browser's Network tab
- You can replay their full session: `node scripts/replay-trace.mjs <traceId>`
- You can filter Vercel Logs: `vercel logs --tail | jq 'select(.traceId=="<id>")'`

---

## 4. PII policy

| Data | Handling |
|---|---|
| IP addresses | SHA-256 hashed with `TELEMETRY_IP_SALT` env → stored as 16-hex-char digest. Without the salt env, stored as literal "anonymous". |
| User agents | SHA-256 hashed (same salt). Never stored raw. |
| Error messages | Run through `redact()` (strips emails, long alphanumeric tokens, long digit runs) before emitting. |
| Chat prompts | **Never stored.** Only `messageCount` + `lastMessageLen` (byte lengths) are on the http.request span. |
| Transcript text | **Never stored.** Only `transcript_chars` (length) is on the transcribe.request span. |
| TTS text | **Never stored.** Only `char_count` (length) is on the tts.request span. |
| Visitor browser errors | Stored with redacted message + stack. componentStack is stored as-is (React internal, no PII). |

Retention: 7-day rolling window (ZREMRANGEBYSCORE on every emit, keyed by ts).

---

## 5. Admin dashboard

Visit `/admin/telemetry` — password-gated via HTTP Basic Auth (`ADMIN_PASSWORD` env).

```bash
# From terminal
curl -u :YOUR_ADMIN_PASSWORD https://anvilry.vercel.app/admin/telemetry

# From browser: just visit the URL, the browser will pop a Basic Auth dialog
```

Six tiles (last 24h):
1. **Events today** — total span count
2. **Cache hit rate** — `cache_read_input_tokens / total_input_tokens` from llm.attempt spans
3. **Fallback rate** — % of llm.attempt spans with `fell_back: true`
4. **Error rate** — level=error events / total events
5. **Client errors** — frontend boundary + window catches
6. **Server errors** — route-level exceptions with AWS request IDs

Route breakdown bar chart + chronological events table (last 50 spans, errors red-tinted).

---

## 6. Replay CLI

```bash
# Install deps first (already in package.json)
# node scripts/replay-trace.mjs <traceId>

UPSTASH_REDIS_REST_URL=... \
UPSTASH_REDIS_REST_TOKEN=... \
node scripts/replay-trace.mjs a1b2c3d4-...

# Output:
# ── Trace a1b2c3d4-... ── 3 events ──
#
#    +0s 000ms  INFO   http.request          /api/chat
#    +0s 312ms  INFO   llm.attempt           /api/chat
#              attrs: {"model":"us.anthropic.claude-sonnet-4-6","ttft_ms":312,...}
#    +1s 847ms  INFO   http.request          /api/tts
```

---

## 7. Debugging cookbook

| Symptom | Query |
|---|---|
| "Anvil gave me a wrong answer" | Get traceId from visitor's x-anvilry-trace-id header → `node scripts/replay-trace.mjs <id>` |
| 502 errors on /api/chat | `vercel logs --tail \| jq 'select(.kind=="server.error" and .route=="/api/chat")'` |
| Cache hit rate < 30% | Check llm.attempt spans for fell_back=true (cache breaks across models). May need 4-min warmer ping — see Notes. |
| Frontend errors spiking | `vercel logs --tail \| jq 'select(.kind=="client.error")'` → source field tells you which boundary fired |
| Polly failures with no error details | Look for aws_request_id in server.error attrs → paste into AWS Polly console for the CloudTrail entry |

---

## 8. File map

| File | Purpose |
|---|---|
| `src/lib/telemetry/schema.ts` | Zod schema + `redact()` + `hashIp()` |
| `src/lib/telemetry/emit.ts` | Dual-sink emitter (console.log + ZADD) |
| `src/lib/telemetry/with-trace.ts` | Route handler wrapper — mints traceId, emits http.request |
| `src/lib/telemetry/beacon.ts` | Browser sendBeacon helper (with fetch fallback) |
| `src/lib/redis.ts` | Shared Upstash Redis singleton |
| `src/lib/admin-auth.ts` | HTTP Basic Auth (crypto.timingSafeEqual) |
| `src/app/api/error/route.ts` | Same-origin sink for browser-sent errors |
| `src/app/error.tsx` | Route-segment React error boundary |
| `src/app/global-error.tsx` | Root React error boundary |
| `src/instrumentation-client.ts` | window.error + unhandledrejection listeners |
| `src/app/admin/telemetry/page.tsx` | Owner dashboard (server component) |
| `scripts/replay-trace.mjs` | CLI for traceId replay |

---

## 9. Notes

**Prompt caching + 5-min TTL on Sonnet 4.6:** Bedrock only supports a 5-minute ephemeral
TTL for Sonnet 4.6 (the 1h TTL seen on the AWS Marketplace page appears to be a copy-paste
error from sibling SKUs). At sparse portfolio traffic (< 1 visitor per 5 min), the cache
expires between sessions — `cache_creation_input_tokens` will be > 0 on every turn and
`cache_read_input_tokens` will stay 0. This means caching is net-negative at sparse traffic
(the 1.25x write surcharge costs more than the read savings). After 7 days of telemetry data:

- If hit rate > 30%: caching is working. Keep it.
- If hit rate < 10%: caching is net-negative. Disable with `cache_control` removal, or ship a
  4-min synthetic warmer cron.

**Upstash command budget:** Rate-limit + emit together use ~5 commands/request on the
chat route. The Upstash free tier is 10,000 commands/day — fine at < 2K chat turns/day.
At higher traffic, move `zremrangebyscore` from per-emit to a daily Vercel cron (see plan
for the v1.8.x follow-up).
