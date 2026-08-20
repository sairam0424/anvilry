---
kind: doc
title: API Routes, Machine-Readable Endpoints & Instrumentation
domain: [content]
status: current
version: v3.4.2
---

# API Routes, Machine-Readable Endpoints & Instrumentation

> Part of the Anvilry v3.4.2 codebase index. Master entry point: [docs/index/README.md](./README.md)

**Scope:** `src/app/api/**`, `src/app/.well-known/vercel/flags/route.ts`, `src/app/feed.xml/route.ts`,
`src/app/llms.txt/route.ts`, `src/app/llms-full.txt/route.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`,
`src/app/{articles,notes,projects,work}/[slug].md/route.ts`, `src/proxy.ts`, `src/instrumentation.ts`,
`src/instrumentation-client.ts`
**Files indexed:** 37

## At a glance

| File | Role | Key exports |
|---|---|---|
| `src/app/api/chat/route.ts` | Grounded first-person LLM chat; rate-limited, streamed, per-attempt telemetry + cost | `maxDuration = 30`, `POST` |
| `src/app/api/mcp/[transport]/route.ts` | MCP server (Streamable HTTP; SSE disabled) wiring 9 read-only tools | `maxDuration = 30`, `GET`, `POST`, `DELETE` (all the same handler) |
| `src/app/api/tts/route.ts` | AWS Polly TTS with per-instance LRU, 10s race timeout, fail-closed 502 | `maxDuration = 15`, `POST` |
| `src/app/api/tts/cache.ts` | Voice+tier-keyed LRU (max 100) for `/api/tts` | `PollyTier`, `ALLOWED_TIERS`, `cacheKey`, `cacheGet`, `cacheSet`, `__resetCacheForTest`, `__cacheSizeForTest` |
| `src/app/api/tts/cache.test.ts` | Pins cross-voice cache isolation + LRU eviction + catalog integration | (vitest suite, 163 lines) |
| `src/app/api/tts-google/route.ts` | Google Cloud TTS (Chirp 3 HD) via REST; `voiceId` mandatory | `maxDuration = 15`, `POST` |
| `src/app/api/tts-google/cache.ts` | Voice-keyed LRU (max 100) for `/api/tts-google`; no tier dimension | `cacheKey`, `cacheGet`, `cacheSet`, `__resetCacheForTest`, `__cacheSizeForTest` |
| `src/app/api/tts-google/cache.test.ts` | Key distinctness, round-trip, eviction at 100 | (vitest suite, 51 lines) |
| `src/app/api/tts-google/route.test.ts` | env gating (503), body validation (400/413), happy path, 502s, cache hit | (vitest suite, 211 lines) |
| `src/app/api/transcribe/route.ts` | AWS Transcribe Streaming STT from one-shot 16k PCM POST body | `maxDuration = 20`, `POST` |
| `src/app/api/error/route.ts` | Same-origin browser error sink; 5-stage gate, Zod, redaction, 204 | `maxDuration = 5`, `POST` |
| `src/app/api/error/route.test.ts` | Contract test: emit envelope, Zod 400s, 413, 429, TELEMETRY_ENABLED, redaction | (vitest suite, 257 lines) |
| `src/app/api/visit/route.ts` | Global visitor counter (Upstash INCR), 1 increment / IP / 30 min | `POST` |
| `src/app/api/github/stats/route.ts` | Aggregated GitHub summary; fail-open, fetch-level 1h revalidate | `GET` |
| `src/app/api/resume.json/route.ts` | JSON Resume passthrough of `buildResumeJson()` | `GET` |
| `src/app/api/cron/health-check/route.ts` | Daily 13-endpoint probe + pass→fail alert transition in Redis | `maxDuration = 25`, `GET` |
| `src/app/api/cron/eval/route.ts` | Weekly 12-pair golden eval against live `/api/chat` (incl. 2 injection pairs) | `maxDuration = 60`, `GET`, `POST` |
| `src/app/api/cron/github-sync/route.ts` | Idempotent GitHub stats cache warm into Redis (`ex: 5400`) | `maxDuration = 30`, `GET` |
| `src/app/api/cron/seo-audit/route.ts` | Weekly SEO route probe + missing-summary content scan | `maxDuration = 60`, `GET` |
| `src/app/api/cron/content-audit/route.ts` | Weekly staleness scan (>18 months) over articles + notes | `maxDuration = 60`, `GET` |
| `src/app/api/md/work/[slug]/route.ts` | Raw markdown for a work item (frontmatter stripped) | `GET` |
| `src/app/api/md/projects/[slug]/route.ts` | Raw markdown for a project | `GET` |
| `src/app/api/md/articles/[slug]/route.ts` | Raw markdown for an article | `GET` |
| `src/app/api/md/notes/[slug]/route.ts` | Raw markdown for a note | `GET` |
| `src/app/work/[slug].md/route.ts` | Direct handler for `/work/<slug>.md`; slug parsed from `req.url` | `GET` |
| `src/app/projects/[slug].md/route.ts` | Direct handler for `/projects/<slug>.md` | `GET` |
| `src/app/articles/[slug].md/route.ts` | Direct handler for `/articles/<slug>.md` | `GET` |
| `src/app/notes/[slug].md/route.ts` | Direct handler for `/notes/<slug>.md` | `GET` |
| `src/app/.well-known/vercel/flags/route.ts` | Vercel Flags SDK manifest; `verifyAccess`-gated; exposes 1 flag | `GET` |
| `src/app/feed.xml/route.ts` | Hand-rolled RSS 2.0 over notes + articles, newest-first | `GET` |
| `src/app/llms.txt/route.ts` | `buildLlmsTxt()` as `text/plain` | `GET` |
| `src/app/llms-full.txt/route.ts` | Full chatbot corpus as `text/plain` (static) | `GET` |
| `src/app/sitemap.ts` | Flag-aware `MetadataRoute.Sitemap` (→ `/sitemap.xml`) | `default sitemap()` |
| `src/app/robots.ts` | Allow-all robots + sitemap pointer (→ `/robots.txt`) | `default robots()` |
| `src/proxy.ts` | Next 16 Proxy: HTTP Basic Auth gate for `/admin/*` via Web Crypto | `config`, `proxy` |
| `src/instrumentation.ts` | Cold-start `[config]` snapshot log + prod-only corpus timestamp in Redis | `register` |
| `src/instrumentation-client.ts` | Browser web-vitals logging + `error`/`unhandledrejection` beaconing | (module side-effects only; no exports) |

## Endpoint matrix

No file in this scope exports `runtime`. Route handlers therefore run on the **Node.js runtime** (Next's
default). `src/app/api/mcp/[transport]/route.ts:6-8` records that `export const runtime = "nodejs"` was
*removed* because `cacheComponents` rejects the export's presence, and that Node remains what runs.
`next.config.ts:183` sets `cacheComponents: true`, which is why every `revalidate` / `dynamic` segment
export in this scope was deleted (see the in-file comments cited below). `src/proxy.ts` is the one
Edge-runtime file (per its own docblock at `src/proxy.ts:5` and `CLAUDE.md`); no Node-proxy opt-in exists
in `next.config.ts` (verified absent).

The shared per-IP limiter is `checkRateLimit` from `src/lib/rate-limit.ts` —
`Ratelimit.slidingWindow(8, "60 s")`, prefix `anvilry:chat` (`src/lib/rate-limit.ts:19-26`), **fails open**
when Upstash env is unset or errors (`src/lib/rate-limit.ts:73`, `:79-82`).

| Method(s) | Path | File | runtime | maxDuration | rate limited? | auth | caching / revalidate | external services | telemetry emitted |
|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/chat` | `api/chat/route.ts` | nodejs (default) | `30` (:12) | yes — shared 8/60s | none | response `Cache-Control: no-store` (:318); internal stats fetch `next.revalidate: 3600` (:78) | AWS Bedrock **or** Anthropic API (via `src/lib/llm.ts`); own `/api/github/stats`; Upstash | `http.request` via `withTrace(req,"chat")` (:157) + one `llm.attempt` per model attempt incl. `cost_usd` (:284-311) |
| GET, POST, DELETE | `/api/mcp/[transport]` (public: `/api/mcp/mcp`) | `api/mcp/[transport]/route.ts` | nodejs (default; export removed :6-8) | `30` (:9) | no | none (public read-only) | none set | none (reads Velite content through `@/lib/mcp-tools`) | none |
| POST | `/api/tts` | `api/tts/route.ts` | nodejs | `15` (:15) | yes — shared 8/60s (:69) | none | `private, max-age=3600` + `X-TTS-Cache: hit\|miss` (:127, :178) | AWS Polly (`SynthesizeSpeechCommand`) | `http.request` via `withTrace(req,"tts")` (:62); `server.error` on catch (:186-204) |
| POST | `/api/tts-google` | `api/tts-google/route.ts` | nodejs | `15` (:12) | yes — shared 8/60s (:67) | none | `private, max-age=3600` + `X-TTS-Cache` (:124-128, :209-213) | Google Cloud TTS REST `texttospeech.googleapis.com/v1/text:synthesize` (:36) | `http.request` via `withTrace(req,"tts-google")` (:59); `server.error` on non-2xx (:166-183) and on throw (:217-233) |
| POST | `/api/transcribe` | `api/transcribe/route.ts` | nodejs | `20` (:13) | yes — shared 8/60s (:63) | none | none | AWS Transcribe Streaming | `http.request` via `withTrace(req,"transcribe")` (:58); `server.error` on catch (:116-131) |
| POST | `/api/error` | `api/error/route.ts` | nodejs | `5` (:13) | yes — shared 8/60s (:101) | none | none (204, no body) | Upstash (`emit` ZADD + `lpush anvilry:errors:recent`, trimmed to 50) | `http.request` via `withTrace(req,"error")` (:88) + one `client.error` (:150-166) |
| POST | `/api/visit` | `api/visit/route.ts` | nodejs | none | yes — **own** limiter `slidingWindow(1,"30 m")`, prefix `anvilry:visit` (:27-34) | none | none | Upstash `anvilry:visits:total` / `:daily` | none |
| GET | `/api/github/stats` | `api/github/stats/route.ts` | nodejs | none | no | none | segment `revalidate` removed (:3-7); 1h cadence preserved at fetch level (`next.revalidate: 3600`, :31, plus `src/lib/github.ts:101`) | GitHub REST (`api.github.com`) | none |
| GET | `/api/resume.json` | `api/resume.json/route.ts` | nodejs | none | no | none | none set | none | none |
| GET | `/api/cron/health-check` | `api/cron/health-check/route.ts` | nodejs | `25` (:3) | no | `Bearer ${CRON_SECRET}`, fail-closed (:117-121) | each probe uses `cache: "no-store"` (:73) | 13 own endpoints; Upstash (`anvilry:health:latest`, alert key) | `console.error("[health-check] …")` when status ≠ pass (:195) |
| GET, POST | `/api/cron/eval` | `api/cron/eval/route.ts` | nodejs | `60` (:3) | no | `Bearer ${CRON_SECRET}`, fail-closed (:98-102) | none | own `/api/chat` ×12 → Bedrock; Upstash `anvilry:eval:latest` `ex: 8*24*3600` (:148) | none directly (each inner `/api/chat` call emits its own spans) |
| GET | `/api/cron/github-sync` | `api/cron/github-sync/route.ts` | nodejs | `30` (:3) | no | `Bearer ${CRON_SECRET}` (:18-22) | internal fetch `cache: "no-store"` (:41) | own `/api/github/stats`; Upstash `anvilry:github:stats:latest` `ex: 5400` (:55) | none |
| GET | `/api/cron/seo-audit` | `api/cron/seo-audit/route.ts` | nodejs | `60` (:4) | no | `Bearer ${CRON_SECRET}` (:16-20) | none | own `/sitemap.xml`, `/llms.txt`, `/robots.txt`, `/feed.xml` (:26-31); Upstash `ex: 7*24*3600` | none |
| GET | `/api/cron/content-audit` | `api/cron/content-audit/route.ts` | nodejs | `60` (:4) | no | `Bearer ${CRON_SECRET}` (:19-23) | none | Upstash `anvilry:content:audit:latest` `ex: 7*24*3600` | none |
| GET | `/api/md/{work,projects,articles,notes}/[slug]` | `api/md/*/[slug]/route.ts` | nodejs | none | no | none | `Content-Type: text/markdown; charset=utf-8`; no cache header | local filesystem `content/<collection>/<slug>.{mdx,md}` | none |
| GET | `/{work,projects,articles,notes}/<slug>.md` | `app/*/[slug].md/route.ts` | nodejs | none | no | none | dynamic because it reads `req.url` (:8-9 comment); no cache header | local filesystem `content/<collection>/<slug>.{mdx,md}` | none |
| GET | `/.well-known/vercel/flags` | `app/.well-known/vercel/flags/route.ts` | nodejs | none | no | `verifyAccess(Authorization)` from `flags`; 401 + `null` body on failure (:6-7) | none | Vercel Flags SDK (`getProviderData`) | none |
| GET | `/feed.xml` | `app/feed.xml/route.ts` | nodejs | none | no | none | `application/xml; charset=utf-8`; no cache header; no request access ⇒ statically prerenderable | none | none |
| GET | `/llms.txt` | `app/llms.txt/route.ts` | nodejs | none | no | none | `text/plain; charset=utf-8`; static | none | none |
| GET | `/llms-full.txt` | `app/llms-full.txt/route.ts` | nodejs | none | no | none | explicitly "served statically"; `dynamic = "force-dynamic"` removed for cacheComponents (:13-18) | none | none |
| GET | `/sitemap.xml` | `app/sitemap.ts` | nodejs | none | no | none | metadata route, no dynamic APIs ⇒ static | none | none |
| GET | `/robots.txt` | `app/robots.ts` | nodejs | none | no | none | metadata route ⇒ static | none | none |
| (all) | `/admin/:path*` | `src/proxy.ts` | **edge** | n/a | no | HTTP Basic Auth vs `ADMIN_PASSWORD`, SHA-256 hash compare (:66-76) | n/a | none | none (returns 401 / `NextResponse.next()`) |

## Detail

### `src/app/api/chat/route.ts`
- **Role:** The site's LLM endpoint — validates and bounds a chat history, assembles a grounded system prompt from the Velite corpus, and returns a plain-text byte stream with a trailing trace frame.
- **Exports:** `maxDuration` (`= 30`, :12) — segment config; `POST` (async route handler).
- **Reads / depends on:** `@/lib/corpus` (`buildCorpus`), `@/lib/profile`, `@/lib/content` (`allProjects`, `allWork`), `@/lib/llm` (`isConfigured`, `streamWithFallback`), `@/lib/rate-limit`, `@/lib/telemetry/{with-trace,emit,schema}`, `node:crypto`. Env: `VERCEL_URL` (:74), `EXTENDED_THINKING` (:263) — plus everything `src/lib/llm.ts` reads (`LLM_PROVIDER`, `BEDROCK_*`).
- **Consumed by:** `src/components/chat/use-chat.ts:305` (`fetch("/api/chat", …)`); asserted in `src/components/ask-portfolio.dom.test.tsx:67`; hammered 12× per run by `src/app/api/cron/eval/route.ts:113`.
- **Request → stream → fallback → telemetry path:**
  1. Whole body wrapped in `withTrace(req, "chat", …)` (:157) — mints `traceId`/`spanId`, stamps `x-anvilry-trace-id` on the response, and emits exactly one `http.request` span after the stream finishes (`src/lib/telemetry/with-trace.ts:202-221`).
  2. `isConfigured()` → **503** `{ error: "Chat is not configured." }` (:158-160).
  3. `checkRateLimit(req)` **before** any Bedrock call → **429** with `Retry-After` (:164-170).
  4. Declared `content-length > 2 * 1024 * 1024` → **413** (:177-180). The 2MB ceiling exists for base64 multi-modal attachments; text-only traffic is ~7KB (:172-176).
  5. `req.json()` failure → **400** (:183-187).
  6. Sanitize: `slice(-MAX_MESSAGES)` where `MAX_MESSAGES = 12` (:61, :194); role filter; string content truncated to `MAX_CHARS = 600` (:62, :202). Attachment blocks are structurally validated — `image` requires `source.type === "base64"` and media type in `["image/jpeg","image/png","image/gif","image/webp"]` (:205-214); `document` requires `application/pdf` (:215-221); `text` blocks are capped at **10000** chars when they start with `"[PDF:"`, else `MAX_CHARS` (:232-236).
  7. Empty block array collapses to `{ role: "user", content: "" }` because the Anthropic SDK 400s on `content: []` (:239-243). Last message must be `user`, else **400** (:247-249).
  8. `ctx.attrs({ messageCount, lastMessageLen })` feeds the auto span without logging prompt text (:256).
  9. `getLiveGithubStats()` awaited (:261) — fetches own `/api/github/stats` with `next: { revalidate: 3600 }`, returns `null` on `!res.ok` or any throw, in which case the `LIVE GITHUB STATS` block is simply omitted from the prompt (:69-98, :137).
  10. `streamWithFallback({ max_tokens: 1024, system: [{ …, cache_control: { type: "ephemeral" } }], messages }, { traceId, onError, onAttempt, extendedThinking })` (:265-315). Model chain is `us.anthropic.claude-sonnet-4-6` → `us.anthropic.claude-opus-4-6-v1` → `us.anthropic.claude-haiku-4-5-20251001-v1:0` (`src/lib/llm.ts:32-34`). Fallback is only attempted while zero bytes have been emitted; once `emittedAny` is true an apology tail is appended and the stream closes (`src/lib/llm.ts:433-437`). Extended thinking is skipped for Haiku and bumps `max_tokens` to ≥2048 with `budget_tokens: 1024` (`src/lib/llm.ts:300`, `:314-321`).
  11. `onAttempt` emits one `llm.attempt` event per model attempt with `model`, `attempt_index`, `fell_back`, `ttft_ms`, `latency_ms`, `finish_reason`, `usage`, and `cost_usd` (:284-311). `onError` additionally `console.warn`s a breadcrumb so `vercel logs --tail` still shows attempt failures if the structured sink is down (:276-277).
  12. Response: `new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })` (:317-319).
- **Gotchas / invariants:**
  - `BEDROCK_PRICE` (:24-46) is a hardcoded per-million-token table "as of 2026-06-17"; unknown models silently fall back to Sonnet 4.6 pricing (`:49-50`), so a new model id in the chain yields *wrong but non-zero* `cost_usd`.
  - `PROJECT_SLUGS` / `WORK_SLUGS` are computed at module load from Velite content (:66-67) and interpolated into the prompt (:128-129) — the prompt can never advertise a card slug the client cannot resolve.
  - `extendedThinking` is **on unless** `EXTENDED_THINKING === "false"` (:263) — an unset env means thinking is enabled.
  - `attempt.error.message` is passed through `redact()` before emit (:293) specifically in case Bedrock echoes a prompt fragment into error text.

### `src/app/api/mcp/[transport]/route.ts`
- **Role:** Exposes the portfolio content layer as a read-only MCP server over Streamable HTTP.
- **Exports:** `maxDuration` (`= 30`, :9); `GET`, `POST`, `DELETE` — all three bound to the **same** `handler` from `createMcpHandler` (:129).
- **Reads / depends on:** `mcp-handler` (`createMcpHandler`), `@/lib/mcp-tools` as `* as T`.
- **Consumed by:** probed as `mcp_get` by `src/app/api/cron/health-check/route.ts:60` (`/api/mcp/mcp`).
- **Transport handling:** third argument is `{ basePath: "/api/mcp", disableSse: true }` (:126). The `disableSse` comment (:120-125) records why: SSE was removed from the MCP spec (2025-03-26), and without the flag a GET to the legacy `/api/mcp/sse` path (the `[transport]` segment matches `"sse"`) falls into mcp-handler's Redis init and throws `"redisUrl is required"` → an unhandled 500, because this project uses Upstash REST rather than `REDIS_URL`/`KV_URL`. Disabling it 404s that dead path and drops the redis dependency from the bundle.
- **Tools wired (9, not 7):** `get_profile` (:30), `list_projects` (:40), `get_project` (:50, `T.projectSlugSchema`), `list_work` (:59), `get_work` (:69, `T.workSlugSchema`), `search_experience` (:78, `T.searchSchema`), `get_resume_variant` (:88, `T.resumeRoleSchema`), `list_all_content` (:98), `get_content_item` (:108, `T.contentTypeSchema`). **`CLAUDE.md` and this file's own docblock (:22) both say "7 tools"** — `list_all_content` and `get_content_item` are wired but undocumented there. All nine delegate to pure functions in `src/lib/mcp-tools.ts`.
- **Behaviour notes:** `wrap()` (:12-19) returns `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data }` and adds `isError: true` **iff** the payload object has a `notFound` key — the not-found contract from `mcp-tools.ts` (`NotFound = { notFound, kind, given, valid[] }`).
- **Gotchas / invariants:** the `isError` signal is keyed purely on the presence of the literal `"notFound"` property (:13); renaming that field in `mcp-tools.ts` would silently turn every not-found into a success. `runtime` must stay unexported (:6-8) — only `runtime = "edge"` is unsupported here, and re-adding the `nodejs` export breaks `cacheComponents`.

### `src/app/api/tts/route.ts`
- **Role:** Optional Polly Neural/Generative TTS, one sentence per request, backed by a process-local LRU.
- **Exports:** `maxDuration` (`= 15`, :15); `POST`.
- **Reads / depends on:** `@aws-sdk/client-polly`, `@/lib/llm` (`bedrockCreds` — same AWS creds as chat), `@/lib/rate-limit`, `@/lib/voice-catalog` (`getDefaultVoiceId`, `resolvePollyParams`, `validateVoiceForEngine`), telemetry modules, `./cache`.
- **Consumed by:** `src/components/chat/use-speech-synthesis.ts:310`; asserted in `use-speech-synthesis.dom.test.tsx:304`.
- **Behaviour notes:** gate order is unconfigured→**503** (:63-66), rate limit→**429** (:69-75), `content-length > 8 * 1024`→**413** (:78-80), bad JSON→**400** (:84-87), empty text→**400** (:90), unknown voice for engine→**400** (:103-108). Text is trimmed and capped at `MAX_CHARS = 600` (:33, :89). `voiceId` defaults to `getDefaultVoiceId()` (`"polly-neural-joanna"` per the comment at :36-39) and is rejected outright if it is 0-length or ≥64 chars or not valid for the `"polly"` engine. Polly's `transformToByteArray()` is raced against a 10s timeout (:160-165) so a stalled stream 502s fast instead of burning the 15s window. Region falls back to `REGION_FALLBACK = "us-east-1"` (:34, :51).
- **Gotchas / invariants:** no separate `tier` field is accepted — the catalog owns voice→tier mapping so a Joanna+generative mismatch is impossible by construction (:92-97). Every non-2xx is a deliberate fail-closed signal: the client cascades to browser `speechSynthesis` (:30). `aws_request_id` is pulled off `$metadata` on both the no-audio (:151) and error (:198) paths.

### `src/app/api/tts-google/route.ts`
- **Role:** Google Cloud TTS (Chirp 3 HD) engine, mirroring the Polly route's gate order; the permanent-free hedge against Polly's 12-month free-tier cliff (:20-26).
- **Exports:** `maxDuration` (`= 15`, :12); `POST`.
- **Reads / depends on:** `@/lib/rate-limit`, `@/lib/voice-catalog` (`resolveGoogleVoiceName`, `validateVoiceForEngine`), telemetry modules, `./cache`. Env: `GOOGLE_TTS_API_KEY` (:39).
- **Consumed by:** `src/components/chat/use-speech-synthesis.ts:318`; asserted in `use-speech-synthesis.dom.test.tsx:269`.
- **Behaviour notes:** uses the REST endpoint directly rather than the `@google-cloud/text-to-speech` SDK to keep the function bundle small (:28-31). `voiceId` is **required** — there is no historical default, so a missing one is **400** `{ error: "voiceId is required." }` (:92-99). `languageCodeFor()` derives `languageCode` from the first two dash-segments of the Google voice name (`"en-US-Chirp3-HD-Aoede"` → `"en-US"`), defaulting to `"en-US"` for malformed names (:51-56). The 10s abort is an `AbortController` + `setTimeout`, cleared in `finally` (:143-144, :235-237).
- **Gotchas / invariants:** the API key is sent via the `x-goog-api-key` **header**, never a URL query parameter, explicitly so it cannot leak into fetch error messages, access logs, or `Referer` — all of which feed this project's own telemetry pipeline (:146-153). A non-2xx from Google emits `server.error` with status/statusText but never forwards Google's body to the client (:162-185).

### `src/app/api/transcribe/route.ts`
- **Role:** Optional AWS Transcribe Streaming STT — the client POSTs a whole 16-bit PCM @ 16kHz mono buffer on mic release and gets back final text.
- **Exports:** `maxDuration` (`= 20`, :13); `POST`.
- **Reads / depends on:** `@aws-sdk/client-transcribe-streaming`, `@/lib/llm` (`bedrockCreds`), `@/lib/rate-limit`, telemetry modules.
- **Consumed by:** `src/components/chat/use-transcribe-recognition.ts:87`.
- **Behaviour notes:** constants `SAMPLE_RATE = 16_000`, `MAX_BYTES = 5 * 1024 * 1024` (~2.6 min of audio), `CHUNK = 8 * 1024` (:30-32). Size is checked **twice** — declared `content-length` before buffering (:74-76) and actual `byteLength` after (:80-82) — because Content-Length may be absent or lying. `pcmChunks()` yields fixed-size `AudioEvent` frames as an async generator (:51-55). Only `IsPartial === false` alternatives are concatenated, avoiding duplicated interim text (:99-102).
- **Gotchas / invariants:** the transcript text itself is **never** put into telemetry — only `audio_bytes`, a derived `audio_seconds` (`byteLength / (SAMPLE_RATE * 2)`, rounded to 0.1) and `transcript_chars` (:105-112). Non-2xx is the fail-closed signal for the client to use browser STT (:27).

### `src/app/api/error/route.ts`
- **Role:** Same-origin browser error sink for React boundaries and window listeners.
- **Exports:** `maxDuration` (`= 5`, :13); `POST`.
- **Reads / depends on:** `zod`, `node:crypto`, `@/lib/rate-limit`, `@/lib/telemetry/{with-trace,emit,schema}`, `@/lib/redis`. Env: `TELEMETRY_ENABLED` (:92).
- **Consumed by:** `src/lib/telemetry/beacon.ts:52` (`const BEACON_URL = "/api/error"`), which is dynamically imported by `src/instrumentation-client.ts:59` and by the error boundaries. Asserted in `src/lib/telemetry/beacon.dom.test.ts:79,133`.
- **Behaviour notes:** five gates, in order — `withTrace` wrapper (:88); `TELEMETRY_ENABLED === "false"` → **204** with no emit (:92-95); rate limit → **429** + `Retry-After` (:101-107); declared `content-length > MAX_BODY_BYTES` (8KB, :65) → **413** (:112-114); `req.json()` failure → **400** (:121-125); post-read `JSON.stringify(raw).length > MAX_BODY_BYTES` → **413** (:131-133); `ErrorBeaconSchema.safeParse` failure → **400** (:139-142). Success emits one `client.error` event and returns **204 with no body** (:183).
- **Gotchas / invariants:**
  - The `source` enum `["boundary","global-boundary","window","unhandledrejection","react19"]` (:83) is declared the source of truth — it must be kept in sync with `ErrorBeaconPayload` in `beacon.ts` or a legitimate beacon 400s silently.
  - Field caps: `message` 1–2000, `stack` ≤8000, `url` ≤500, `userAgent` ≤500, `componentStack` ≤4000 (:78-84).
  - `message` and `stack` are `redact()`-ed before emit; `componentStack` is **not** (React-internal, not visitor-supplied) (:145-166).
  - Opt-**out** semantics are deliberate: only the exact string `"false"` disables telemetry; unset/typo keeps it on (:89-92).
  - The post-read 413 exists because `sendBeacon` and the fetch fallback do not always send `Content-Length`, so gate 4 alone is bypassable (:127-130).
  - The `anvilry:errors:recent` Redis write is fire-and-forget with `.catch(() => {})` and `ltrim(…, 0, 49)` keeping the last 50 (:174-180).

### `src/app/api/visit/route.ts`
- **Role:** Global visitor counter for the footer badge.
- **Exports:** `POST`.
- **Reads / depends on:** `next/server` (`NextResponse`), `@/lib/redis`, `@upstash/ratelimit`.
- **Consumed by:** `src/components/site-footer.tsx:41`.
- **Behaviour notes:** has its **own** limiter — `Ratelimit.slidingWindow(1, "30 m")`, prefix `anvilry:visit`, `analytics: false` (:27-34) — not the shared `checkRateLimit`. On a limiter denial it returns the current total with `today: 0` rather than a 429, so the badge never breaks (:44-49). Counts via a pipeline of two `incr`s (`anvilry:visits:total`, `anvilry:visits:daily`) and sets the daily TTL only when `today === 1` (:62-70). TTL is computed to the next UTC midnight (:55-59).
- **Gotchas / invariants:** ⚠️ this route has its **own** `clientIp()` (:19-25) which takes the **leftmost** `x-forwarded-for` segment, whereas `src/lib/rate-limit.ts:57` and `src/lib/telemetry/with-trace.ts:71` deliberately take the **last** segment to prevent spoof-based bypass. The leftmost is a **defect, not a deliberate difference** — its only justification was the adjacent comment `// leftmost = client IP`, which is itself wrong. Latent rather than exploitable: the counter is flag-off by default, and the handler returns early on absent Redis before `clientIp` is reached. All three prefer the unspoofable `x-vercel-forwarded-for` first. No flag check happens here — the gate is client-side (`NEXT_PUBLIC_VISITOR_COUNTER`), stated at :15-17 so rate-limit state stays consistent across flag flips.

### `src/app/api/github/stats/route.ts`
- **Role:** Aggregates the GitHub repo feed plus the user profile into one compact JSON summary.
- **Exports:** `GET`.
- **Reads / depends on:** `@/lib/github` (`getRepoFeed`). Env: `GITHUB_TOKEN` (:19).
- **Consumed by:** `src/components/github-stats-strip.tsx:35`; `src/app/api/chat/route.ts:77`; `src/app/api/cron/github-sync/route.ts:40`; probed as `github_stats_api` by `health-check/route.ts:59`.
- **Behaviour notes:** the user fetch hardcodes `https://api.github.com/users/sairam0424` (:29) with `next: { revalidate: 3600 }` (:31) and swallows failures to `null` (:33-34). Fully fail-open: `totalStars`/`totalForks` reduce over whatever repos came back, `mostRecentPush` is `null` on an empty feed (:49-55), `followers` defaults to `0`, `publicRepos` falls back to `repos.length` (:63-66).
- **Gotchas / invariants:** `export const revalidate = 3600` was **removed** for `cacheComponents`; the 1-hour cadence now lives only in the two fetch-level `next: { revalidate: 3600 }` options (`:31` and `src/lib/github.ts:101`) — deleting either silently changes the GitHub polling cadence (:3-7). `health-check` treats `repoCount === 0` as a `warn`, which is the canary for a missing/rate-limited token (`health-check/route.ts:84-90`).

### `src/app/api/cron/*` — the CRON_SECRET check
All five cron routes implement the **identical** three-line guard. Verbatim:

```ts
const secret = process.env.CRON_SECRET;
const authHeader = req.headers.get("authorization");
if (!secret || authHeader !== `Bearer ${secret}`) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

Locations: `eval/route.ts:98-102`, `health-check/route.ts:117-121`, `github-sync/route.ts:18-22`,
`seo-audit/route.ts:16-20`, `content-audit/route.ts:19-23`. Properties, exactly as implemented:
**fail-closed** — an unset `CRON_SECRET` yields 401 rather than open access (`eval/route.ts:14` states
this explicitly); the header name is read lower-case (`"authorization"`); the comparison is a plain
non-constant-time `!==` against the literal `` `Bearer ${secret}` `` (no scheme-case tolerance, no
trimming, no `x-vercel-*` alternative). All five derive their base URL the same way:
`process.env.VERCEL_URL ? \`https://${VERCEL_URL}\` : "http://localhost:3000"`.

Schedules come from `vercel.json` (Vercel Cron issues **GET**):
`/api/cron/health-check` `0 5 * * *`; `/api/cron/eval` `0 9 * * 1`; `/api/cron/github-sync` `0 8 * * *`;
`/api/cron/seo-audit` `0 6 * * 1`; `/api/cron/content-audit` `0 7 * * 1`.

#### `src/app/api/cron/eval/route.ts`
- **Exports:** `maxDuration` (`= 60`, :3); `GET` and `POST` both aliased to `runEval` (:155-156) — POST is for manual triggering with the same header (:154).
- **Behaviour notes:** 12 `GOLDEN_PAIRS` (:19-82) across categories `factual`, `rag`, `injection`. Each pair fires one POST at `/api/chat` with a 25s `AbortSignal.timeout` (:117). The response body is truncated at `TRACE_DELIMITER = "\x1e"` (:95, :124-125) so the trailing trace frame never counts as answer text. Non-injection pairs pass if **any** expected keyword appears case-insensitively (:91-92); the two injection pairs pass only if their own `forbidden` token (`HELLO_INJECTED`, `INJECTED_PAYLOAD_XYZ`) is **absent** (:84-90). Result is written to `anvilry:eval:latest` with `ex: 8 * 24 * 3600` — "weekly cadence + 1 day grace" so stale data self-expires (:145-149).
- **Gotchas / invariants:** the eval calls the **live** `/api/chat`, so it consumes the same per-IP rate limit and real Bedrock spend (docstring: ~12 calls ≈ $0.012/run, :16). `TRACE_DELIMITER` is duplicated here as a literal rather than imported from `@/lib/llm-trace` — changing the delimiter there would silently break the strip.

#### `src/app/api/cron/health-check/route.ts`
- **Exports:** `maxDuration` (`= 25`, :3); `GET`.
- **Behaviour notes:** `CHECKS` is 13 entries with per-check `criticality` (`P1`/`P2`/`P3`) and per-check `timeout` (10s / 8s) (:53-67), probed with `Promise.all` (:130). Extra validation beyond HTTP 200: `github_stats_api` warns when `repoCount` is not a number or is `0` (:84-90); `llms_txt`/`llms_full_txt` **fail** when the body is `< 1000` chars — the empty-corpus canary (:93-100); `resume_json_api` fails when `json.basics` is missing (:102-108). Top status: `fail` if any P1 failed, else `warn` if any check failed **or warned**, else `pass` (:155-159). Alerting: on a `pass → fail` transition it sets `anvilry:health:alert:active` with `{ nx: true, ex: 90_000 }` — `nx` suppresses alert storms — and `del`s it on recovery (:176-188). Result stored at `anvilry:health:latest` with `ex: 90_000` (25h) so a missed run self-expires (:191).
- **Gotchas / invariants:** `p2_pass` is computed and reported but does **not** feed `topStatus` (which already covers P2 via `failedNames`) (:151-159). The previous-state read tolerates both a raw object and a JSON string from Upstash (:180).

#### `src/app/api/cron/github-sync/route.ts`
- **Exports:** `maxDuration` (`= 30`, :3); `GET`.
- **Behaviour notes:** returns `{ synced: false, reason: "Redis not configured" }` when `redis` is null (:24-26). Idempotency: if `anvilry:github:stats:latest` already exists it short-circuits with `reason: "cache_fresh"` (:29-32) — double invocations from Vercel's best-effort delivery are harmless. Fetch failures return `reason: "fetch_failed"` (:45-47); a falsy payload returns `reason: "upstream_error"` **before** the Redis write, so a 429/503 from GitHub can never report `synced: true` (:49-53). TTL is `ex: 5400` (90 min) (:55).
- **Gotchas / invariants:** the docstring says "**Hourly** GitHub stats cache warm" (:8) but `vercel.json` schedules it `0 8 * * *` — **daily**. The 90-minute TTL means the idempotency guard is effectively always cold at a daily cadence.

#### `src/app/api/cron/seo-audit/route.ts`
- **Exports:** `maxDuration` (`= 60`, :4); `GET`.
- **Behaviour notes:** probes four routes with a 10s timeout each (:26-44). Then counts content items with a missing/blank summary — and normalises the field name per collection: Work/Article/Note use `summary`, **Project uses `excerpt`** per the Velite schema (:49-54).
- **Gotchas / invariants:** the `excerpt` mapping is load-bearing — the in-file note (:47-48) records that using `summary` for projects false-positives every project. Result stored at `anvilry:seo:audit:latest`, `ex: 7 * 24 * 3600`.

#### `src/app/api/cron/content-audit/route.ts`
- **Exports:** `maxDuration` (`= 60`, :4); `GET`.
- **Behaviour notes:** `EIGHTEEN_MONTHS_MS = 18 * 30 * 24 * 60 * 60 * 1000` (:16) — 18 × **30-day** months, i.e. 540 days, not calendar months. Flags articles and notes whose `date` predates `Date.now() - threshold` (:27-33). Zero network calls. Stored at `anvilry:content:audit:latest`, `ex: 7 * 24 * 3600`.

### `src/app/api/md/{work,projects,articles,notes}/[slug]/route.ts` and `src/app/{work,projects,articles,notes}/[slug].md/route.ts`
- **Role:** Serve raw MDX/MD bodies (frontmatter removed) as `text/markdown` so AI crawlers can read canonical content.
- **Exports:** `GET` in all eight files.
- **Reads / depends on:** the matching `@/lib/content` collection (`allWork` / `allProjects` / `allArticles` / `allNotes`), `fs.readFileSync`, `path.join`, `next/server` type import only.
- **Consumed by:** `src/lib/llms-txt.ts:69-79` advertises the pretty form (`${BASE}${item.url}.md`) for work, projects, notes, and non-external articles. `next.config.ts:220-228` rewrites `/work/:slug.md`, `/projects/:slug.md`, `/articles/:slug.md`, `/notes/:slug.md` → `/api/md/<collection>/:slug`. **UNVERIFIED:** which of the two implementations actually serves a live request — the `next.config.ts` `rewrites()` return is the bare-array (`afterFiles`) form and there is also a filesystem route at `app/<collection>/[slug].md/route.ts`; resolution order was not exercised. Both produce byte-identical output.
- **Behaviour notes:** two-stage 404 — first the slug must exist in the Velite collection, then the file must be readable (`api/md/work/[slug]/route.ts:28-32`). `readRawContent` tries `.mdx` then `.md` under `process.cwd()/content/<collection>/` (:11-21). `stripFrontmatter` is `raw.replace(/^---[\s\S]*?---\s*\n?/, "").trimStart()` (:7-9).
- **Gotchas / invariants:** the `/api/md/*` variants take `params: Promise<{ slug: string }>` and `await` it (`:25-27`). The `app/*/[slug].md/route.ts` variants **cannot** — the comment at `:6-9` records that Next does not populate `params` for a `[param].ext` directory segment (`ParamMap` resolves to `{}`), so the slug is parsed out of `new URL(req.url).pathname` instead; reading the request is also what makes the handler dynamic, which is why the previously-explicit `dynamic = "force-dynamic"` was removed (it is rejected under `cacheComponents`). These routes read the **filesystem at request time**, so `content/` must be present in the deployed bundle — they do not use the Velite output for the body, only for the existence check.

### `src/app/.well-known/vercel/flags/route.ts`
- **Role:** The Vercel Flags SDK discovery/manifest endpoint that powers dashboard overrides.
- **Exports:** `GET`.
- **Reads / depends on:** `verifyAccess` from `flags`, `getProviderData` from `flags/next`, `NextResponse`. Implicitly reads `FLAGS_SECRET` (the secret `verifyAccess` validates against — see `src/lib/flags.ts:50-51`).
- **Behaviour notes:** `verifyAccess(request.headers.get("Authorization"))`; on failure returns `NextResponse.json(null, { status: 401 })` — a `null` body, not an error object (:6-7).
- **Gotchas / invariants:** exactly **one** flag is declared here — `NEXT_PUBLIC_DISCOVERY_BADGES`, `defaultValue: false`, with a hardcoded `origin` of `https://vercel.com/sairams-projects-d50d7437/anvilry/flag/NEXT_PUBLIC_DISCOVERY_BADGES` (:11-22). The key must match the `flag({ key })` declaration in `src/lib/flags.ts:18` and the Vercel dashboard id. All other flags (`NEXT_PUBLIC_ARTICLES_ENABLED`, `NEXT_PUBLIC_NOTES_ENABLED`, `NEXT_PUBLIC_STATS_ENABLED`, `NEXT_PUBLIC_SEARCH_ENABLED`, the beast-mode flags, …) are build-time-only and are **not** listed here.

### `src/app/feed.xml/route.ts`
- **Role:** Hand-rolled RSS 2.0 for notes + articles, no dependency.
- **Exports:** `GET`.
- **Reads / depends on:** `@/lib/content` (`allNotes`, `allArticles`), `@/lib/profile`.
- **Consumed by:** linked from `src/components/site-footer.tsx:183`; probed by `seo-audit/route.ts:30` and `health-check/route.ts:63`.
- **Behaviour notes:** `BASE` is the hardcoded `"https://anvilry.vercel.app"` (:6). `xml()` escapes all five XML predefined entities (:9-16). Articles use `externalUrl` for both `<link>` and `<guid>` when present, so readers open the original publication rather than a stub on this domain (:32-38). Items are merged and sorted newest-first by parsed `pubDate` (:40-42). Empty-safe: with no content the feed is still valid but item-less (:5).
- **Gotchas / invariants:** `BASE` is one of the hardcoded base URLs; `CLAUDE.md:292` lists four files to update on a custom domain (`layout.tsx`, `sitemap.ts`, `robots.ts`, `json-ld.tsx`) — this file's `BASE` (`:6`) is **an additional** occurrence not in that list; the authoritative enumeration (18 files / 24 occurrences) is [15 § The hardcoded base URL](./15-invariants-and-gotchas.md#the-hardcoded-base-url). The feed ignores `NOTES_ENABLED` / `ARTICLES_ENABLED`, unlike `sitemap.ts`.

### `src/app/sitemap.ts`
- **Role:** Flag-aware sitemap generator (`/sitemap.xml`).
- **Exports:** `default sitemap(): MetadataRoute.Sitemap`.
- **Reads / depends on:** `@/lib/content` (all four collections), `@/lib/writing-flags` (`ARTICLES_ENABLED`, `NOTES_ENABLED`, `STATS_ENABLED`, `SEARCH_ENABLED`).
- **Consumed by:** `robots.ts:6` points at it; `e2e/views.spec.ts:101`; probed by `seo-audit` and `health-check` (P1).
- **Behaviour notes:** static routes are `["", "/work", "/projects", "/about", "/resume", "/mcp"]` (:8) with `priority` 1 for `""` and 0.8 otherwise. Priorities: work 0.7, projects 0.6, listing pages 0.6, note/article detail 0.5, `/stats` 0.6, `/search` 0.5. `changeFrequency` is `"monthly"` everywhere except the `/notes` and `/articles` listing pages (`"weekly"`).
- **Gotchas / invariants:** notes and articles are included only when the flag **and** non-empty content both hold (`NOTES_ENABLED && allNotes.length`, :27; `ARTICLES_ENABLED && allArticles.length`, :39). `base` is hardcoded (:5). `lastModified` is never set on any entry. `.md` passthrough URLs are not listed.

### `src/app/robots.ts`
- **Role:** `/robots.txt`.
- **Exports:** `default robots(): MetadataRoute.Robots`.
- **Behaviour notes:** allow-all — `{ userAgent: "*", allow: "/" }` — plus `sitemap: "https://anvilry.vercel.app/sitemap.xml"` (:5-6). No `disallow` entries at all: `/admin/*` is not excluded from crawling here (it is protected by `src/proxy.ts` instead).

### `src/app/llms.txt/route.ts` and `src/app/llms-full.txt/route.ts`
- **Roles:** `/llms.txt` returns `buildLlmsTxt()` — the curated index (~1-2KB); `/llms-full.txt` returns `buildCorpus()` — the full chatbot grounding corpus (~4-8KB).
- **Exports:** `GET` in both; both set `Content-Type: text/plain; charset=utf-8`.
- **Consumed by:** `/llms.txt` linked from `src/components/site-footer.tsx:81`, checked by `e2e/views.spec.ts:96`; both probed by `health-check/route.ts:61-62` with a **`< 1000` chars ⇒ fail** body-length assertion.
- **Gotchas / invariants:** `llms-full.txt`'s docblock (:13-18) records that `dynamic = "force-dynamic"` was removed both because `cacheComponents` rejects it and because the original rationale was wrong — `buildCorpus()` reads build-time Velite content, so a static route already regenerates on every deploy.

### `src/proxy.ts`
- **Role:** The Next 16 Proxy (formerly Middleware) — the sole Edge-runtime file in this scope. Its only job is to return a real `401` with a `WWW-Authenticate` header for `/admin/*`, which an App Router server component cannot do (it must return React nodes) (:8-11).
- **Exports:** `config` (`{ matcher: ["/admin/:path*"] }`, :22-24); `proxy(req: NextRequest)` (:33).
- **Matcher:** exactly `["/admin/:path*"]` — nothing else in the app is intercepted. In practice that is `/admin/telemetry` (`src/app/admin/telemetry/page.tsx`).
- **Edge crypto path:** `sha256Hex(s)` = `crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))` → hex string via `Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")` (:26-31). Both the supplied password and `ADMIN_PASSWORD` are hashed in a `Promise.all` and the two hex strings compared with `!==` (:67-76). The credential is decoded with `atob` (:56) — a Web API, not Node's `Buffer` — and both `"password"` and `"username:password"` forms are accepted, taking everything after the first colon (:58).
- **Behaviour notes:** four separate 401 exits, each with `WWW-Authenticate: Basic realm="anvilry"` — missing `ADMIN_PASSWORD` (:38-43, locked out entirely, and the body never reveals whether the env is set), non-`Basic ` scheme (:46-51), `atob` throw (:59-64), hash mismatch (:71-76). Success returns `NextResponse.next()` (:79).
- **Gotchas / invariants:** the docblock (:12-20) states plainly that this is a *first filter*, not a cryptographically hardened gate: `crypto.subtle` is used because Edge lacks Node APIs, and the final comparison is a normal string compare of two digests, **not** a constant-time compare. The Node-side timing-safe version lives separately in `src/lib/admin-auth.ts` and is the server-component layer; both must be kept in agreement or `/admin` can pass one and fail the other. `atob` is byte-oriented, so a non-Latin-1 password would decode incorrectly.

### `src/instrumentation.ts`
- **Role:** Next 16 server instrumentation hook — one structured config-snapshot log per server process start, plus a production-only corpus build timestamp.
- **Exports:** `register()` (async).
- **Reads / depends on:** `process.env` only for the snapshot; dynamically `import("@/lib/redis")` at :95.
- **Behaviour notes:** returns immediately when `process.env.NEXT_RUNTIME === "edge"` (:35). Builds a `config` object with: `vercel_env` (enum of `production|preview|development`, fallback `"local"`), `node_env`, `region` (`VERCEL_REGION ?? AWS_REGION ?? "unknown"`), `flag_driver` (`vercel|local`, fallback `local`), `flags_sdk_configured` (`FLAGS` present), `flags_secret_configured` (`FLAGS_SECRET` present), a `beast_flags` block (`NEXT_PUBLIC_ORB_POSTPROCESSING`, `NEXT_PUBLIC_INK_TRANSITION`, `NEXT_PUBLIC_SKILL_TREE`, `NEXT_PUBLIC_404_ORB`, `NEXT_PUBLIC_VISITOR_COUNTER`, each `=== "true"`), an `integrations` presence-only block (`BEDROCK_ACCESS_KEY_ID`, `UPSTASH_REDIS_REST_URL`, `GOOGLE_TTS_API_KEY`, `GITHUB_TOKEN`, `ADMIN_PASSWORD`, `TELEMETRY_IP_SALT`), `llm_provider` (`bedrock|anthropic`, fallback `bedrock`) and `llm_sdk` (`anthropic-bedrock|aws-sdk-bedrock`) (:39-80). Emitted as a single `console.log("[config]", JSON.stringify(config))` (:84).
- **Gotchas / invariants:** only booleans and safe enum values are logged — never a secret value (:13-14). Grep handles are distinct and load-bearing: `[config]` here, `[trace]` for telemetry spans (`src/lib/telemetry/emit.ts:49`), `[vitals]` for RUM (`src/instrumentation-client.ts:52`), `[flags]` for flag resolution (`src/lib/flags.ts:45`). `discovery_badges` is deliberately omitted from `beast_flags` because it is runtime-resolved and logged by `getDiscoveryBadgesEnabled()` (:59-60). The corpus timestamp write (`anvilry:corpus:built_at`, `ex: 7 * 24 * 3600`) is gated on `VERCEL_ENV === "production"` — **not** `NODE_ENV`, because Vercel preview deploys also run with `NODE_ENV=production` and would pollute the value; it falls back to `NODE_ENV` only when `VERCEL_ENV` is absent (:86-104). The docblock (:16-18) warns `register()` is best-effort startup logging, not a hard init gate — Next makes no guarantee it blocks before the first request.

### `src/instrumentation-client.ts`
- **Role:** Next 16 client instrumentation hook — registers web-vitals reporting and the two window-level error listeners that sit under the React boundaries.
- **Exports:** none. The whole file is a module-load side effect guarded by `if (typeof window !== "undefined")` (:46); the framework contract is "side-effects at module load are run" (:5-7).
- **Reads / depends on:** lazy `import("web-vitals")` (:50) and lazy `import("@/lib/telemetry/beacon")` (:59).
- **Behaviour notes:** `onLCP`/`onINP`/`onCLS` all report via `console.info("[vitals]", name, Math.round(value), rating)` — no Redis, no API route (:50-56); the whole vitals block is `.catch()`-swallowed so observability can never break the page. Two listeners are registered: `"error"` (:74) and `"unhandledrejection"` (:86), each calling `sendErrorBeacon` with `source: "window"` / `"unhandledrejection"`, `url: window.location.href`, `userAgent: navigator.userAgent`, `level: "error"`. Rejection reasons are narrowed four ways — `Error` instance, object with a string `.message` (and optional `.stack`), non-null primitive via `String()`, else the literal `"unhandled rejection"` (:93-106).
- **Gotchas / invariants:** the **dedupe contract** is the subtle part (:26-39, :65-72): React boundaries set `window.__anvilry_error_recently__ = Date.now()` *before* they beacon, and both window listeners suppress if that timestamp is within `DEDUPE_MS = 100`. It is a timestamp rather than a boolean specifically to avoid a `setTimeout` cleanup that would add an event-loop turn and re-create the race. Two genuinely distinct errors 200ms apart still both report. If a boundary stops setting that global, every render error double-reports to `/api/error`. Both `import()`s are dynamic to keep `web-vitals` (~4KB) and the beacon module out of the SSR bundle and off the critical path.

### Test files in scope
- **`src/app/api/error/route.test.ts`** — mocks `@/lib/telemetry/emit`, `@/lib/rate-limit`, and `@/lib/telemetry/with-trace` (passthrough with a synthetic ctx) via `vi.hoisted` + `vi.mock`, then re-imports the route with `vi.resetModules()` per test. Asserts the exact `client.error` envelope (`kind`, `route`, `traceId`, `parentSpanId`, fresh `spanId`), Zod 400s (missing `message`/`source`, bad enum, malformed JSON), the 413 declared-content-length short-circuit, the `TELEMETRY_ENABLED=false` 204-no-emit path, the 429 + `Retry-After: 17`, and — most load-bearing — that emails and 32+-char tokens are redacted out of both `message` and `stack` before `emit()` runs (`:217-255`). The fixture builds its fake token with `.repeat()` deliberately: a hand-typed literal would trip the project's secret-scan hook, and a JWT-shaped fixture splits on `.` into sub-32-char segments the redactor correctly ignores (`:222-226`).
- **`src/app/api/tts/cache.test.ts`** — pins the v1.7 cross-voice isolation invariant: distinct keys per voice and per tier, determinism, "text encoded last so a malicious text containing a pipe cannot forge another voice", LRU bump-on-hit, eviction past `CACHE_MAX`, `ALLOWED_TIERS` exactly `{neural, generative}`, and end-to-end validate→resolve→key flows including rejection of a Google catalog id on the Polly engine (cross-engine attack).
- **`src/app/api/tts-google/cache.test.ts`** — key distinctness per voice, identical-input determinism, set/get round-trip, no cross-voice collision, eviction beyond 100.
- **`src/app/api/tts-google/route.test.ts`** — 503 when `GOOGLE_TTS_API_KEY` is unset or empty; 400 for invalid JSON, missing/empty text, missing `voiceId`, unknown `voiceId`, and a **Polly** catalog id submitted to the Google route (cross-engine attack); 413 over 8KB; base64→bytes happy path with `fetch` mocked; 502 on non-2xx and on missing `audioContent`; and a second identical request served from cache.

## Coverage
- `src/app/api/chat/route.ts`
- `src/app/api/cron/content-audit/route.ts`
- `src/app/api/cron/eval/route.ts`
- `src/app/api/cron/github-sync/route.ts`
- `src/app/api/cron/health-check/route.ts`
- `src/app/api/cron/seo-audit/route.ts`
- `src/app/api/error/route.ts`
- `src/app/api/error/route.test.ts`
- `src/app/api/github/stats/route.ts`
- `src/app/api/mcp/[transport]/route.ts`
- `src/app/api/md/articles/[slug]/route.ts`
- `src/app/api/md/notes/[slug]/route.ts`
- `src/app/api/md/projects/[slug]/route.ts`
- `src/app/api/md/work/[slug]/route.ts`
- `src/app/api/resume.json/route.ts`
- `src/app/api/transcribe/route.ts`
- `src/app/api/tts/route.ts`
- `src/app/api/tts/cache.ts`
- `src/app/api/tts/cache.test.ts`
- `src/app/api/tts-google/route.ts`
- `src/app/api/tts-google/route.test.ts`
- `src/app/api/tts-google/cache.ts`
- `src/app/api/tts-google/cache.test.ts`
- `src/app/api/visit/route.ts`
- `src/app/.well-known/vercel/flags/route.ts`
- `src/app/feed.xml/route.ts`
- `src/app/llms.txt/route.ts`
- `src/app/llms-full.txt/route.ts`
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/app/articles/[slug].md/route.ts`
- `src/app/notes/[slug].md/route.ts`
- `src/app/projects/[slug].md/route.ts`
- `src/app/work/[slug].md/route.ts`
- `src/proxy.ts`
- `src/instrumentation.ts`
- `src/instrumentation-client.ts`
