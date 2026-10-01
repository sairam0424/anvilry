# TELEMETRY.md — Anvilry Observability Layer (v1.8)

End-to-end structured telemetry for the "Ask my portfolio" chatbot. Zero new vendors —
all sinks are same-origin (Vercel Runtime Logs) or already-provisioned infra (Upstash Redis).
Free text is redacted at the call site before storage (regex-only; §4 lists exactly what is and is not stored).

> **Scope:** describes Anvilry v3.11.0 (`package.json` 3.11.0), i.e. `main` @ `a929932` (v3.6.0) **plus five post-`a929932` behaviour changes** (v3.7.0) and two more in v3.8.0 (an IAM-denied model falls through to the next rung, so a 403 `llm.attempt` span can now be followed by a fallback attempt, with the same span shape; and the opt-in Sonnet 5.5 primary); v3.9.0 changes nothing here (the chat UI stopped showing the model and provider line, but the trace frame and `llm.attempt` still record `model` and `fell_back`). v3.10.0 replaces the three-entry price table with the verified per-model table in `src/lib/llm-pricing.ts` (so `cost_usd` is right for Sonnet 5 / 5.5 and absent, not approximated, for an unpriced model) and makes the dashboard's "saved by caching" tile price each attempt by its own model. Two of the five touch telemetry: `/api/error` now draws on its own `beacon` rate-limit bucket (`chat`, `voice` and `beacon` are independent), and `src/proxy.ts`, the dashboard page and `requireAdmin` share one `isAdminAuthorized` check. The `(v1.8)` in the title records where the design started. When this file and the code disagree, the code wins.

---

## 1. Architecture

```
Frontend                        Backend                        Sinks
───────────────────────         ────────────────────────────   ──────────────────
app/error.tsx (React boundary)  /api/chat  ──┐                 Vercel Runtime Logs
global-error.tsx (root boundary) /api/tts   ├── withTrace ──── (console.log, always)
instrumentation-client.ts       /api/tts-g  │   ↓
  window.error listener         /api/trans  │   emit()  ──────  Upstash Redis
  unhandledrejection listener   /api/error ─┘   ↓               (ZADD per kind,
       │                             ↑          llm.attempt      7-day window,
       └── sendBeacon ───────────────┘          chat.cache       best-effort)
                                                (child spans)
                                                          Read:  /admin/telemetry
                                                                 scripts/replay-trace.mjs
```

`withTrace` wraps exactly five routes: `/api/chat`, `/api/tts`, `/api/tts-google`, `/api/transcribe` and `/api/error`. No other route produces `http.request` spans (`/api/visit`, `/api/mcp/*`, `/api/github/stats`, the crons and `/api/admin/*` are untraced); the only other emitter is the FAQ cache layer's `server.error`.

**Two sinks, both fail-open:**
- `console.log('[trace]', JSON.stringify(event))` → Vercel Runtime Logs (free, 1h Hobby / 24h Pro retention). Always fires; this is the source of truth.
- `redis.zadd('anvilry:trace:<kind>', ...)` → Upstash (queryable, per-kind sorted sets scored by `ts`). Best-effort: Redis errors are swallowed with a `[telemetry] redis sink failed` warning. The 7-day window is trimmed on roughly 1-in-20 emits (§4).

`/api/error` additionally pushes `{ message (redacted), url, ts }` onto the capped list `anvilry:errors:recent` (last 50). Nothing in `src/` reads that list.

**Env knobs** (details: `docs/configuration.md` §3 and §5):
- `UPSTASH_REDIS_REST_URL` / `_TOKEN` enable the Redis sink and the dashboard; `ADMIN_PASSWORD` unlocks the dashboard.
- `TELEMETRY_IP_SALT` turns on IP / user-agent hashing; `TELEMETRY_ENABLED=false` only silences browser beacons.

---

## 2. Event schema

Every event is a `TelemetryEvent` (Zod-validated envelope, see `src/lib/telemetry/schema.ts`; `emit()` itself does not re-parse):

```typescript
{
  ts: number;              // Date.now() at emission (withTrace spans use request start)
  traceId: string;         // crypto.randomUUID() per request
  spanId: string;          // crypto.randomUUID() per span
  parentSpanId?: string;   // set on child spans (llm.attempt / chat.cache → http.request)
  kind: KindLiteral;       // see below
  route?: string;          // withTrace spans: short label ("chat", "tts", "tts-google", "transcribe", "error");
                           // child spans: the path ("/api/chat", "/api/error")
  level: "info" | "warn" | "error";
  message?: string;        // redacted free text (optional)
  attrs: Record<string, unknown>;  // per-kind attributes (convention, not validated)
}
```

### Span kinds

`KIND_LITERALS` has eight kinds. Only five have emitters; three are declared and read by the dashboard but nothing in `src/` ever writes them.

| Kind | Source | Key attrs |
|---|---|---|
| `http.request` | `withTrace` on the five wrapped routes | status, latency_ms, session_id, ipHash, uaHash, plus per-route extras (chat: messageCount, lastMessageLen, cache_hit, cache_tier; voice routes: voiceId, char_count, cache_hit, aws_request_id; transcribe: audio_bytes, audio_seconds, transcript_chars) |
| `llm.attempt` | `onAttempt` callback in `streamWithFallback` (chat route) | model, attempt_index, fell_back, ttft_ms, latency_ms, finish_reason, usage, cost_usd, and on error error_name / status |
| `chat.cache` | FAQ cache lookup in `/api/chat`, first-turn eligible requests only | outcome (`hit` / `miss`), tier (`exact` / `semantic` / `none`), and on a hit saved_usd, model (+ similarity for the semantic tier) |
| `client.error` | `/api/error` sink (browser ErrorBoundary + window listeners) | source, url, stack (redacted), componentStack, userAgent |
| `server.error` | `withTrace` on uncaught throw; explicit emits in the tts, tts-google and transcribe catch blocks; the FAQ cache layer (its own trace id, `route: "/api/chat"`) | route, error_name, error_message, aws_request_id; cache layer: `source: "chat-cache"`, `op` (`get` / `semantic-get` / `set` / `purge`), error_name |
| `tts.request` | **never emitted** (declared; the dashboard's TTS latency tiles read it and therefore always show "—") | TTS data lives on `http.request` with route `tts` / `tts-google` |
| `transcribe.request` | **never emitted** (same story) | Transcribe data lives on `http.request` with route `transcribe` |
| `budget.tick` | **never emitted** (reserved for a cost-cap follow-up) | — |

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
    },
    "cost_usd": 0.0294
  }
}
```

`cache_read_input_tokens > 0` on turns 2+ of the same session means caching is working.
If it stays 0 after 7 days, the cached prefix is expiring or changing between requests (see Notes, §9).
`cost_usd` is only present when `usage` is and the model has a verified price (`src/lib/llm-pricing.ts`: AWS's own list prices for the five Bedrock ids the chain can use); a direct-Anthropic model id has no row, so those events carry no `cost_usd` and the dashboard's cost tiles read $0.0000 (unknown, not free).

---

## 3. Trace ID correlation

The five `withTrace` routes (`/api/chat`, `/api/tts`, `/api/tts-google`, `/api/transcribe`, `/api/error`) carry `x-anvilry-trace-id` in their response headers. The chat stream additionally appends the trace frame after the U+001E delimiter (FAQ cache hits carry it too, with `cacheHit: true`). This means:

- A visitor can find their traceId in the browser's Network tab
- You can replay their full session: `node scripts/replay-trace.mjs <traceId>`
- You can filter Vercel Logs: `vercel logs --tail | jq 'select(.traceId=="<id>")'`

---

## 4. PII policy

| Data | Handling |
|---|---|
| IP addresses (telemetry) | SHA-256 hashed with `TELEMETRY_IP_SALT` → stored as a 16-hex-char digest (`ipHash`). Without the salt, stored as literal "anonymous". |
| IP addresses (rate limiter, visitor counter) | The Upstash limiters key on the **raw** client IP (short-lived, window-length keys). `TELEMETRY_IP_SALT` does not apply there. |
| User agents (server spans) | SHA-256 hashed (same salt, `uaHash`). `session_id` is the first 12 hex chars of SHA-256(`ipHash:uaHash:YYYY-MM-DD`), or "anonymous" without the salt. |
| User agents (`client.error`) | The browser beacon's own `userAgent` string is stored **as sent** (schema-capped at 500 chars, not hashed or redacted), alongside its `url` (also 500 chars). |
| Error messages | Run through `redact()` (strips emails, long alphanumeric tokens, long digit runs) before emitting. Regex-only: false positives are accepted, false negatives are the risk. |
| Chat prompts | **Never stored.** Only `messageCount` + `lastMessageLen` (character count for a string, block count for a multimodal array) are on the http.request span. The FAQ cache stores answers under a hash of the normalized question, never the question text; with `FAQ_CACHE_SEMANTIC_MATCH` on, the question text is sent to Bedrock for embedding and the vector is kept with the entry for 24 h. |
| Transcript text | **Never stored.** Only `transcript_chars` (length) is on the http.request span. |
| TTS text | **Never stored.** Only `char_count` (length) is on the http.request span. |
| Visitor browser errors | Stored with redacted message + stack. componentStack is stored as-is (React internal, no PII). |

Retention: a 7-day window on each `anvilry:trace:<kind>` sorted set, enforced by `ZREMRANGEBYSCORE` on roughly 1-in-20 emits (`TRIM_SAMPLE_EVERY`, sampled deterministically off `event.ts % 20`). Entries older than 7 days can therefore linger between trims, and the key itself has no TTL, so readers (dashboard, replay CLI) always filter by score.

`TELEMETRY_ENABLED=false` is a browser-beacon kill switch only: `/api/error` then answers 204 without emitting `client.error`. It does not silence `withTrace`, `llm.attempt`, `chat.cache` or the Redis sink.

---

## 5. Admin dashboard

Visit `/admin/telemetry` — gated by HTTP Basic Auth (`ADMIN_PASSWORD` env). Three call sites share one `isAdminAuthorized` check (`src/lib/admin-auth.ts`, SHA-256 digests compared with `timingSafeEqual`): `src/proxy.ts` is the first filter (matcher `/admin/:path*`, answers 401 with `WWW-Authenticate`), the page re-checks and calls `notFound()` so it stays protected if the matcher is ever bypassed, and `requireAdmin` guards `POST /api/admin/faq-cache/purge`. The password is the whole credential (any username works). With `ADMIN_PASSWORD` unset everything is locked out with a bare 401; there is no setup-instructions page.

```bash
# From terminal
curl -u :YOUR_ADMIN_PASSWORD https://anvilry.vercel.app/admin/telemetry

# From browser: just visit the URL, the browser will pop a Basic Auth dialog (any username)
```

Everything is read from Redis over a rolling 24 h window (about 16 commands per load: one `ZRANGE` per kind, two repeated for the voice tiles, plus six cron / corpus keys). With Redis unconfigured the header reads "not configured (log-only mode)"; a Redis error just yields empty tiles, with no message.

| Group | Tiles |
|---|---|
| Volume, cache, cost | **Events (24h)**; **Cache hit rate** (`cache_read_input_tokens` / total input incl. cache read and creation, from `llm.attempt`); **FAQ cache hit rate** (`chat.cache` hits / total, plus dollars saved); **Total tokens**; **Fallback rate** (% of `llm.attempt` with `fell_back`); **Est. cost (24h)** (sum of `cost_usd`; "saved" is the input cost the cache reads avoided, per model: cache-read tokens × (input price − cache-read price), before the cache-write premium) |
| Latency, errors, visitors | **Avg LLM latency** (+ TTFT); **Error rate** ((`client.error` + `server.error`) / all events — error-level `llm.attempt` spans do not count); **Client errors**; **Server errors**; **Visitors (24h)** (distinct `session_id`; shows "—" until `TELEMETRY_IP_SALT` is set) |
| Voice | **TTS P50 / P95** and **Transcribe P50 / P95** — read the never-emitted `tts.request` / `transcribe.request` kinds, so they always show "—" today |
| Cron-fed | **Eval pass rate**, **GitHub stars**, **SEO health**, **Stale content**, **Corpus age**, **Site health** — each reads a Redis key written by a cron (see `docs/configuration.md`), except **Corpus age**, which reads the `anvilry:corpus:built_at` timestamp that `src/instrumentation.ts` stamps on a production cold start |

Also: a route breakdown bar chart (`http.request` count and mean latency per route label), a per-model cost table, and a recent-events table (newest 100 spans of the window, error-level rows red-tinted).

---

## 6. Replay CLI

```bash
# Install deps first (already in package.json)
# node scripts/replay-trace.mjs <traceId>      (or: make trace TRACE_ID=<traceId>)

UPSTASH_REDIS_REST_URL=... \
UPSTASH_REDIS_REST_TOKEN=... \
node scripts/replay-trace.mjs a1b2c3d4-...

# Output (attrs are pretty-printed multi-line JSON under each event):
# ── Trace a1b2c3d4-... ── 3 events ──
#
#   +  0s 000ms  INFO   http.request          chat
#   +  0s 312ms  INFO   llm.attempt           /api/chat
#               attrs: { "model": "us.anthropic.claude-sonnet-4-6", "ttft_ms": 312, ... }
#   +  1s 847ms  INFO   http.request          tts
```

The script reads a hard-coded list of seven kinds; `chat.cache` is not in it, so FAQ cache events never appear in a replay (use the dashboard or the `[trace]` log lines for those).

---

## 7. Debugging cookbook

| Symptom | Query |
|---|---|
| "Anvil gave me a wrong answer" | Get traceId from visitor's x-anvilry-trace-id header → `node scripts/replay-trace.mjs <id>` |
| 502 errors on /api/chat | `vercel logs --tail \| jq 'select(.kind=="server.error" and .route=="/api/chat")'` |
| Prompt-cache hit rate low | Check llm.attempt spans for fell_back=true (a cache is per model, so a fallback re-pays the corpus), then check that the static system block is byte-stable — see Notes (§9). |
| A bad answer keeps being served | Look for `chat.cache` events with `outcome: "hit"`, then purge it: `POST /api/admin/faq-cache/purge` (see `docs/configuration.md`, "FAQ response cache"). |
| Frontend errors spiking | `vercel logs --tail \| jq 'select(.kind=="client.error")'` → source field tells you which boundary fired |
| Polly failures with no error details | Look for aws_request_id in server.error attrs → paste into AWS Polly console for the CloudTrail entry |
| Dashboard empty | Upstash env missing or malformed (`[redis] Invalid Upstash configuration` in the logs), or the free-tier command quota is exhausted — every Redis-backed feature then fails open silently. |
| No `[vitals]` lines in Vercel logs | Expected: `instrumentation-client.ts` logs LCP / INP / CLS with `console.info` in the visitor's browser; nothing ships them to the server. |

---

## 8. File map

| File | Purpose |
|---|---|
| `src/lib/telemetry/schema.ts` | Zod schema + `redact()` + `hashIp()` + `KIND_LITERALS` |
| `src/lib/telemetry/emit.ts` | Dual-sink emitter (console.log + ZADD, sampled trim) |
| `src/lib/telemetry/with-trace.ts` | Route handler wrapper — mints traceId, emits http.request / server.error |
| `src/lib/telemetry/beacon.ts` | Browser sendBeacon helper (with fetch fallback) |
| `src/lib/redis.ts` | Shared Upstash Redis singleton (null when unconfigured) |
| `src/lib/admin-auth.ts` | `isAdminAuthorized` + `requireAdmin` (HTTP Basic, `timingSafeEqual`) |
| `src/proxy.ts` | First-filter Basic Auth gate for `/admin/*` (Next 16 Proxy, Node runtime) |
| `src/lib/chat-cache.ts` | FAQ cache; emits cache-layer `server.error` |
| `src/app/api/chat/route.ts` | Emits `llm.attempt` and `chat.cache` |
| `src/app/api/error/route.ts` | Same-origin sink for browser-sent errors |
| `src/app/error.tsx` | Route-segment React error boundary |
| `src/app/global-error.tsx` | Root React error boundary |
| `src/instrumentation-client.ts` | window.error + unhandledrejection listeners; `[vitals]` console logging |
| `src/app/admin/telemetry/page.tsx` | Owner dashboard (server component) |
| `scripts/replay-trace.mjs` | CLI for traceId replay |

---

## 9. Notes

**Prompt caching.** `/api/chat` sends two system blocks: the static prompt built from the corpus, marked `cache_control: { type: "ephemeral", ttl: "1h" }`, followed by the hourly GitHub stats block, which sits after the cache breakpoint and is left uncached so a stats refresh cannot invalidate the cached prefix. (The v1.8 write-up of this section assumed a 5-minute TTL; the route now requests one hour, at the 2x write premium its comment notes.) The `usage` block is the arbiter: `cache_read_input_tokens > 0` on turns 2+ means the prefix is being reused, while `cache_creation_input_tokens > 0` on every turn means it is expiring or changing between requests — for example if live data leaks into the static block. Cache entries are per model, so a fallback re-pays the corpus. After 7 days of telemetry data:

- If the hit rate is above 30%: caching is working. Keep it.
- If it is below 10%: caching is net-negative at this traffic (writes cost more than reads save). Remove `cache_control`, or add a synthetic warmer cron.

**Upstash command budget.** Every `emit()` is one `ZADD`; the retention trim is sampled 1-in-20 (`TRIM_SAMPLE_EVERY` in `emit.ts`, and the same trick in `chat-cache.ts`) precisely because the free-tier monthly command quota has been exhausted before. A rate-limited request adds the limiter's commands, an FAQ-eligible chat adds a lookup (one `MGET` for the exact tier; `ZRANGE` + `MGET` more when the semantic tier is on) and a write-through on a miss, and each dashboard load costs about 16 commands. When the quota runs out, the limiter, FAQ cache, telemetry sink, visitor counter and dashboard all fail open together, so a blank dashboard means check the quota first.
