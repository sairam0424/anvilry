---
kind: doc
title: API Routes, Machine-Readable Endpoints & Instrumentation
domain: [content]
status: current
version: v3.12.0
---

# API Routes, Machine-Readable Endpoints & Instrumentation

> Part of the Anvilry v3.12.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
>
> Describes Anvilry v3.12.0 (`package.json` 3.12.0), i.e. main `a929932` plus five post-`a929932` fixes: notes hidden at the data layer while `NOTES_ENABLED` is off; per-class rate-limit buckets (`chat` / `voice` / `beacon`) with a `CRON_SECRET` bypass for the eval cron and a shared `src/lib/cron-auth.ts`; one admin check (`isAdminAuthorized`) shared by `src/proxy.ts`, `requireAdmin` and the telemetry page; command-palette talk mode gated on `isVoiceViewActive`; `MIN_ROUTES = 17` in the bundle budget plus removal of dead components. Line citations are against that tree.

**Scope:** `src/app/api/**`, `src/app/.well-known/vercel/flags/route.ts`, `src/app/feed.xml/route.ts`,
`src/app/llms.txt/route.ts`, `src/app/llms-full.txt/route.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`,
`src/app/{articles,notes,projects,work}/[slug].md/route.ts`, `src/proxy.ts`, `src/proxy.test.ts`,
`src/instrumentation.ts`, `src/instrumentation-client.ts`
**Files indexed:** 44

## At a glance

| File | Role | Key exports |
|---|---|---|
| `src/app/api/chat/route.ts` | Grounded first-person LLM chat; `chat` rate-limit bucket, FAQ response cache (exact + optional semantic; an exact hit replays the reasoning summary stored with the answer), streamed, per-attempt telemetry + cost | `maxDuration = 60`, `POST` |
| `src/app/api/chat/route.test.ts` | Rate-limit class, cache eligibility, hit short-circuit, write-through glue, `llm.attempt` cost telemetry, exact-hit reasoning replay (mocked cache, then the real `chat-cache` over an in-memory Redis) | (vitest suite, 1,080 lines) |
| `src/app/api/admin/faq-cache/purge/route.ts` | Basic-auth admin action: delete one FAQ-cache entry by question text; unthrottled by design | `maxDuration = 10`, `POST` |
| `src/app/api/admin/faq-cache/purge/route.test.ts` | 401 paths never touch Redis; purge / not_found / 503 / 400 / 413 | (vitest suite, 122 lines) |
| `src/app/api/mcp/[transport]/route.ts` | MCP server (Streamable HTTP; SSE disabled) wiring 10 read-only tools | `maxDuration = 30`, `GET`, `POST`, `DELETE` (all the same handler) |
| `src/app/api/tts/route.ts` | AWS Polly TTS with per-instance LRU, 10s race timeout, fail-closed 502; `voice` bucket | `maxDuration = 15`, `POST` |
| `src/app/api/tts/cache.ts` | Voice+tier-keyed LRU (max 100) for `/api/tts` | `PollyTier`, `ALLOWED_TIERS`, `cacheKey`, `cacheGet`, `cacheSet`, `__resetCacheForTest`, `__cacheSizeForTest` |
| `src/app/api/tts/cache.test.ts` | Pins cross-voice cache isolation + LRU eviction + catalog integration | (vitest suite, 163 lines) |
| `src/app/api/tts-google/route.ts` | Google Cloud TTS (Chirp 3 HD) via REST; `voiceId` mandatory | `maxDuration = 15`, `POST` |
| `src/app/api/tts-google/cache.ts` | Voice-keyed LRU (max 100) for `/api/tts-google`; no tier dimension | `cacheKey`, `cacheGet`, `cacheSet`, `__resetCacheForTest`, `__cacheSizeForTest` |
| `src/app/api/tts-google/cache.test.ts` | Key distinctness, round-trip, eviction at 100 | (vitest suite, 51 lines) |
| `src/app/api/tts-google/route.test.ts` | env gating (503), body validation (400/413), happy path, 502s, cache hit | (vitest suite, 211 lines) |
| `src/app/api/transcribe/route.ts` | AWS Transcribe Streaming STT from one-shot 16k PCM POST body | `maxDuration = 20`, `POST` |
| `src/app/api/error/route.ts` | Same-origin browser error sink; 5-stage gate (own `beacon` bucket), Zod, redaction, 204 | `maxDuration = 5`, `POST` |
| `src/app/api/error/route.test.ts` | Contract test: emit envelope, Zod 400s, 413, 429, TELEMETRY_ENABLED, redaction | (vitest suite, 264 lines) |
| `src/app/api/voice-rate-limit-class.test.ts` | Pins tts / tts-google / transcribe to the `voice` bucket | (vitest suite, 47 lines) |
| `src/app/api/visit/route.ts` | Global visitor counter (Upstash INCR), 1 increment / IP / 30 min | `POST` |
| `src/app/api/github/stats/route.ts` | Aggregated GitHub summary; fail-open, fetch-level 1h revalidate | `GET` |
| `src/app/api/resume.json/route.ts` | JSON Resume passthrough of `buildResumeJson()` | `GET` |
| `src/app/api/cron/health-check/route.ts` | Daily 13-endpoint probe + pass→fail alert transition in Redis | `maxDuration = 25`, `GET` |
| `src/app/api/cron/eval/route.ts` | Weekly 12-pair golden eval against live `/api/chat` (incl. 2 injection pairs); sends the cron bearer + `X-Chat-Skip-Cache` | `maxDuration = 60`, `GET`, `POST` |
| `src/app/api/cron/eval/route.test.ts` | Every outgoing `/api/chat` call carries the cron secret as a bearer and `X-Chat-Skip-Cache: 1`; the eval scores the answer behind the thinking sentinel (with and without reasoning text) | (vitest suite, 138 lines) |
| `src/app/api/cron/cron-auth.routes.test.ts` | All five cron routes 401 on unset secret, missing header, wrong value; proceed on the correct bearer | (vitest suite, 90 lines) |
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
| `src/app/sitemap.ts` | Flag-aware `MetadataRoute.Sitemap` (→ `/sitemap.xml`); real `lastModified` on note/article entries | `default sitemap()` |
| `src/app/robots.ts` | Allow-all robots + sitemap pointer (→ `/robots.txt`) | `default robots()` |
| `src/proxy.ts` | Next 16 Proxy (Node runtime): HTTP Basic Auth first filter for `/admin/*` via shared `isAdminAuthorized` | `config`, `proxy` |
| `src/proxy.test.ts` | Contract for the `/admin/*` gate (401 + challenge unset/wrong, pass-through header on success) | (vitest suite, 56 lines) |
| `src/instrumentation.ts` | Cold-start `[config]` snapshot log + prod-only corpus timestamp in Redis | `register` |
| `src/instrumentation-client.ts` | Browser web-vitals logging + `error`/`unhandledrejection` beaconing | (module side-effects only; no exports) |

## Endpoint matrix

No file in this scope exports `runtime`. Route handlers therefore run on the **Node.js runtime** (Next's
default). `src/app/api/mcp/[transport]/route.ts:6-8` records that `export const runtime = "nodejs"` was
*removed* because `cacheComponents` rejects the export's presence, and that Node remains what runs.
`next.config.ts:203` sets `cacheComponents: true`, which is why every `revalidate` / `dynamic` segment
export in this scope was deleted (see the in-file comments cited below). `src/proxy.ts` also runs on the
Node.js runtime (Next 16's Proxy default, per its own docblock at `src/proxy.ts:7-9`), which is why it can
share `isAdminAuthorized` from `src/lib/admin-auth.ts` (`node:crypto`) instead of carrying its own Web
Crypto copy.

The per-IP limiter is `checkRateLimit(req, cls)` from `src/lib/rate-limit.ts` with a **required** class
argument (`RateLimitClass = "chat" | "voice" | "beacon"`, `:19`). Each class is its own
`Ratelimit.slidingWindow(8, "60 s")` (`REQUESTS_PER_WINDOW`, `WINDOW`, `:22-23`; built in `buildLimiters`,
`:33-46`) under its own prefix (`anvilry:chat`, `anvilry:voice`, `anvilry:beacon`, `:25-29`), keyed by client
IP only. It **fails open** when Upstash env is unset (`:99`) or errors (`:106-108`), and a request carrying a
valid `Authorization: Bearer ${CRON_SECRET}` bypasses it (`hasValidCronSecret`, `:100`) so the eval cron's 12
sequential chats do not self-throttle. Class assignment: `chat` = `/api/chat`; `voice` = `/api/tts`,
`/api/tts-google`, `/api/transcribe`; `beacon` = `/api/error`.

| Method(s) | Path | File | runtime | maxDuration | rate limited? | auth | caching / revalidate | external services | telemetry emitted |
|---|---|---|---|---|---|---|---|---|---|
| POST | `/api/chat` | `api/chat/route.ts` | nodejs (default) | `60` (:24) | yes — `chat` bucket, 8/60s (:147) | none | response `Cache-Control: no-store` (:485); `X-Chat-Cache: hit` on an FAQ-cache hit (:359); an exact-tier hit with stored reasoning and `EXTENDED_THINKING` on opens with the thinking sentinel + the reasoning (:352-354); internal stats fetch `next.revalidate: 3600` (:43) | AWS Bedrock **or** Anthropic API (via `src/lib/llm.ts`); own `/api/github/stats`; Upstash (FAQ cache via `src/lib/chat-cache.ts`; Titan embeddings only when the semantic tier is on) | `http.request` via `withTrace(req,"chat")` (:137) + one `chat.cache` per cache-eligible request (:317-342; a hit carries the boolean `reasoning_replayed`, :337) + one `llm.attempt` per model attempt incl. `cost_usd` (:408-450) |
| GET, POST, DELETE | `/api/mcp/[transport]` (public: `/api/mcp/mcp`) | `api/mcp/[transport]/route.ts` | nodejs (default; export removed :6-8) | `30` (:9) | no | none (public read-only) | none set | none (reads Velite content through `@/lib/mcp-tools`) | none |
| POST | `/api/tts` | `api/tts/route.ts` | nodejs | `15` (:15) | yes — `voice` bucket (:69) | none | `private, max-age=3600` + `X-TTS-Cache: hit\|miss` (:127, :178) | AWS Polly (`SynthesizeSpeechCommand`) | `http.request` via `withTrace(req,"tts")` (:62); `server.error` on catch (:186-204) |
| POST | `/api/tts-google` | `api/tts-google/route.ts` | nodejs | `15` (:12) | yes — `voice` bucket (:67) | none | `private, max-age=3600` + `X-TTS-Cache` (:124-128, :209-213) | Google Cloud TTS REST `texttospeech.googleapis.com/v1/text:synthesize` (:36) | `http.request` via `withTrace(req,"tts-google")` (:59); `server.error` on non-2xx (:166-183) and on throw (:217-233) |
| POST | `/api/transcribe` | `api/transcribe/route.ts` | nodejs | `20` (:13) | yes — `voice` bucket (:63) | none | none | AWS Transcribe Streaming | `http.request` via `withTrace(req,"transcribe")` (:58); `server.error` on catch (:116-131) |
| POST | `/api/error` | `api/error/route.ts` | nodejs | `5` (:13) | yes — own `beacon` bucket (:101) | none | none (204, no body) | Upstash (`emit` ZADD + `lpush anvilry:errors:recent`, trimmed to 50) | `http.request` via `withTrace(req,"error")` (:88) + one `client.error` (:150-166) |
| POST | `/api/visit` | `api/visit/route.ts` | nodejs | none | yes — **own** limiter `slidingWindow(1,"30 m")`, prefix `anvilry:visit` (:38-45) | none | none | Upstash `anvilry:visits:total` / `:daily` | none |
| GET | `/api/github/stats` | `api/github/stats/route.ts` | nodejs | none | no | none | segment `revalidate` removed (:3-7); 1h cadence preserved at fetch level (`next.revalidate: 3600`, :31, plus `src/lib/github.ts:114`) | GitHub REST (`api.github.com`) | none |
| GET | `/api/resume.json` | `api/resume.json/route.ts` | nodejs | none | no | none | none set | none | none |
| POST | `/api/admin/faq-cache/purge` | `api/admin/faq-cache/purge/route.ts` | nodejs | `10` (:4) | **no** (deliberate; docblock :15-18) | HTTP Basic vs `ADMIN_PASSWORD` via `requireAdmin` (:32-33); **outside** the `src/proxy.ts` matcher | response is JSON, no cache header | Upstash (`del` entry + `zrem` from the FAQ-cache index) | none |
| GET | `/api/cron/health-check` | `api/cron/health-check/route.ts` | nodejs | `25` (:5) | no | `Bearer ${CRON_SECRET}` via `unauthorizedUnlessCron`, fail-closed (first statements of `GET`, :151-153) | each probe uses `cache: "no-store"` + `redirect: "manual"` (:75, :79) | 13 own endpoints; Upstash (`anvilry:health:latest`, alert key) | `console.error("[health-check] …")` when status ≠ pass (:225) |
| GET, POST | `/api/cron/eval` | `api/cron/eval/route.ts` | nodejs | `60` (:5) | no (its own outgoing chat calls bypass the `chat` bucket via the bearer, :126) | `Bearer ${CRON_SECRET}` via `unauthorizedUnlessCron`, fail-closed (:102-103) | none | own `/api/chat` ×12 → Bedrock; Upstash `anvilry:eval:latest` `ex: 8*24*3600` (:176-178) | none directly (each inner `/api/chat` call emits its own spans) |
| GET | `/api/cron/github-sync` | `api/cron/github-sync/route.ts` | nodejs | `30` (:4) | no | `Bearer ${CRON_SECRET}` via `unauthorizedUnlessCron` (:19-20) | internal fetch `cache: "no-store"` (:39) | own `/api/github/stats`; Upstash `anvilry:github:stats:latest` `ex: 5400` (:53) | none |
| GET | `/api/cron/seo-audit` | `api/cron/seo-audit/route.ts` | nodejs | `60` (:5) | no | `Bearer ${CRON_SECRET}` via `unauthorizedUnlessCron` (:17-18) | none | own `/sitemap.xml`, `/llms.txt`, `/robots.txt`, `/feed.xml` (:24-29); Upstash `ex: 7*24*3600` | none |
| GET | `/api/cron/content-audit` | `api/cron/content-audit/route.ts` | nodejs | `60` (:5) | no | `Bearer ${CRON_SECRET}` via `unauthorizedUnlessCron` (:20-21) | none | Upstash `anvilry:content:audit:latest` `ex: 7*24*3600` | none |
| GET | `/api/md/{work,projects,articles,notes}/[slug]` | `api/md/*/[slug]/route.ts` | nodejs | none | no | none | `Content-Type: text/markdown; charset=utf-8`; no cache header; `notes` 404s every slug while `NOTES_ENABLED` is off | local filesystem `content/<collection>/<slug>.{mdx,md}` | none |
| GET | `/{work,projects,articles,notes}/<slug>.md` | `app/*/[slug].md/route.ts` | nodejs | none | no | none | dynamic because it reads `req.url` (:6-9 comment); no cache header | local filesystem `content/<collection>/<slug>.{mdx,md}` | none |
| GET | `/.well-known/vercel/flags` | `app/.well-known/vercel/flags/route.ts` | nodejs | none | no | `verifyAccess(Authorization)` from `flags`; 401 + `null` body on failure (:6-7) | none | Vercel Flags SDK (`getProviderData`) | none |
| GET | `/feed.xml` | `app/feed.xml/route.ts` | nodejs | none | no | none | `application/xml; charset=utf-8`; no cache header; no request access ⇒ statically prerenderable | none | none |
| GET | `/llms.txt` | `app/llms.txt/route.ts` | nodejs | none | no | none | `text/plain; charset=utf-8`; static | none | none |
| GET | `/llms-full.txt` | `app/llms-full.txt/route.ts` | nodejs | none | no | none | explicitly "served statically"; `dynamic = "force-dynamic"` removed for cacheComponents (:13-18) | none | none |
| GET | `/sitemap.xml` | `app/sitemap.ts` | nodejs | none | no | none | metadata route, no dynamic APIs ⇒ static | none | none |
| GET | `/robots.txt` | `app/robots.ts` | nodejs | none | no | none | metadata route ⇒ static | none | none |
| (all) | `/admin/:path*` | `src/proxy.ts` | nodejs (Proxy default) | n/a | no | HTTP Basic Auth vs `ADMIN_PASSWORD` via `isAdminAuthorized(req.headers.get("Authorization"))` (:26) | n/a | none | none (returns 401 / `NextResponse.next()`) |

## Detail

### `src/app/api/chat/route.ts`
- **Role:** The site's LLM endpoint — validates and bounds a chat history, serves repeat first-turn questions from the FAQ response cache, otherwise assembles a grounded system prompt from the Velite corpus, and returns a plain-text byte stream with a trailing trace frame.
- **Exports:** `maxDuration` (`= 60`, :24) — segment config; `POST` (async route handler).
- **Reads / depends on:** `@/lib/corpus` (`buildCorpus`), `@/lib/profile`, `@/lib/content` (`allProjects`, `allWork`), `@/lib/llm` (`isConfigured`, `streamWithFallback`, `TRACE_DELIMITER`), `@/lib/rate-limit`, `@/lib/chat-cache` (`faqCacheGet`, `faqCacheSemanticGet`, `faqCacheSet`, `isSemanticMatchEnabled`), `@/lib/telemetry/{with-trace,emit,schema}`, `@/lib/llm-trace` (`THINKING_SENTINEL`, `THINKING_END`, `stripControlBytes`), `node:crypto`. Env: `VERCEL_URL` (:39), `EXTENDED_THINKING` (:283) — plus everything `src/lib/llm.ts` reads (`LLM_PROVIDER`, `LLM_USE_SONNET_5`, `LLM_USE_SONNET_5_5`, `LLM_USE_OPUS_FALLBACK`, `LLM_THINKING_EFFORT`, `BEDROCK_*`) and the cache switches `FAQ_CACHE_ENABLED` / `FAQ_CACHE_SEMANTIC_MATCH` read inside `chat-cache.ts`.
- **Consumed by:** `src/components/chat/use-chat.ts:305` (`fetch("/api/chat", …)`); asserted in `src/components/ask-portfolio.dom.test.tsx:83`; hammered 12× per run by `src/app/api/cron/eval/route.ts:115`.
- **Request → cache → stream → fallback → telemetry path:**
  1. Whole body wrapped in `withTrace(req, "chat", …)` (:137) — mints `traceId`/`spanId`, stamps `x-anvilry-trace-id` on the response, and emits exactly one `http.request` span after the stream finishes (`src/lib/telemetry/with-trace.ts`, `withTrace` / `afterSafeEmit`).
  2. `isConfigured()` → **503** `{ error: "Chat is not configured." }` (:138-143).
  3. `checkRateLimit(req, "chat")` **before** any Bedrock call → **429** with `Retry-After` (:147-153). A valid `CRON_SECRET` bearer skips the limiter (the eval cron).
  4. Declared `content-length > 2 * 1024 * 1024` → **413** (:160-163). The 2MB ceiling exists for base64 multi-modal attachments; text-only traffic is ~7KB (:155-159).
  5. `req.json()` failure → **400** (:165-170).
  6. Sanitize: `slice(-MAX_MESSAGES)` where `MAX_MESSAGES = 12` (:26, :177); role filter; string content truncated to `MAX_CHARS = 600` (:27, :187). Attachment blocks are structurally validated — `image` requires `source.type === "base64"` and media type in `["image/jpeg","image/png","image/gif","image/webp"]` (:191-208); `document` requires `application/pdf` (:209-215); `text` blocks are capped at **10000** chars when they start with `"[PDF:"`, else `MAX_CHARS` (:227-235).
  7. Empty block array collapses to `{ role: "user", content: "" }` because the Anthropic SDK 400s on `content: []` (:238-242). Last message must be `user`, else **400** (:249-257).
  8. `ctx.attrs({ messageCount, lastMessageLen })` feeds the auto span without logging prompt text (:267).
  9. **FAQ cache lookup (:269-363).** `skipCache` = header `x-chat-skip-cache` present (any value, :284); `cacheEligible` = not skipped, exactly one message, string content, non-blank (:286-290). Eligible requests try `faqCacheGet(question)` then, only if `isSemanticMatchEnabled()`, `faqCacheSemanticGet` (:297-299), record `cache_hit` / `cache_tier` on the span (:316) and emit one `chat.cache` event (`outcome` hit|miss, `tier`, and on a hit `saved_usd` + `model` + the boolean `reasoning_replayed` (never the text), plus `similarity` for the semantic tier; no key hash, :317-342). On a hit the route returns immediately (see "FAQ response cache" below): no GitHub fetch, no Bedrock, no `llm.attempt`. An exact-tier hit with `extendedThinking` on and a stored `reasoning` string returns `THINKING_SENTINEL` + reasoning (control bytes stripped again, trimmed; empty means the plain body) + `THINKING_END` + answer + U+001E + frame, the framing a live stream has (:309-314, :352-354); a semantic-tier hit never carries reasoning.
  10. `getLiveGithubStats()` awaited (:368) — fetches own `/api/github/stats` with `next: { revalidate: 3600 }`, returns `null` on `!res.ok` or any throw, in which case the `LIVE GITHUB STATS` block is simply omitted from the prompt (:34-66).
  11. `streamWithFallback({ max_tokens: 1024, system: [...], messages }, { traceId, onError, onAttempt, extendedThinking })` (:370-480). The `system` array is **two blocks in a fixed order** (:373-396): (a) `staticSystemPrompt(buildCorpus())` with `cache_control: { type: "ephemeral", ttl: "1h" }` — byte-stable per deploy, this is where the Bedrock prompt-cache value lives; (b) an **uncached** `ADDITIONAL LIVE CONTEXT (updated hourly):` block carrying the GitHub stats, appended after the cache breakpoint. `staticSystemPrompt` deliberately takes only `corpus` (:68-85) so an hourly stats refresh cannot invalidate the cached prefix; folding stats back into block (a) would regress prompt caching. Model chain is `us.anthropic.claude-sonnet-4-6` → `us.anthropic.claude-haiku-4-5-20251001-v1:0` by default; `LLM_USE_SONNET_5=true` puts `us.anthropic.claude-sonnet-5` in front and `LLM_USE_SONNET_5_5=true` puts `global.anthropic.claude-sonnet-5-5` in front, each with Sonnet 4.6 behind it, and `LLM_USE_OPUS_FALLBACK=true` adds `us.anthropic.claude-opus-4-6-v1` right behind the primary (`bedrockChain()` → `buildChain()`, `src/lib/llm.ts:118-126`, `:102-110`). Fallback is only attempted before any `text_delta` event has been received — `emittedAny` is set unconditionally the moment one arrives, even if the text strips to empty; once true, an apology tail is appended and the stream closes (`src/lib/llm.ts:759-786`, which also closes any open thinking phase with `THINKING_END` first). Extended thinking (migrated 2026-09-18 to adaptive thinking) is skipped entirely for Haiku and bumps `max_tokens` to ≥2048 (≥4096 on Sonnet 5.x; 8192, 16000 or 32000 at effort `high`, `xhigh` or `max`) with `adaptiveThinking(model)` + `output_config:{effort: thinkingEffort(model)}` — `{type:"adaptive", display:"summarized"}` + `medium` on Sonnet 5.x, `{type:"adaptive"}` + `low` on everything else, `LLM_THINKING_EFFORT` overriding (any of `low`/`medium`/`high`/`xhigh`/`max`; `xhigh` goes out as `max` to a model that is not Sonnet 5.x) — no more `budget_tokens` (`src/lib/llm.ts:536-537`, `:547-590`, `:158-222`).
  12. `onAttempt` emits one `llm.attempt` event per model attempt with `model`, `attempt_index`, `fell_back`, `ttft_ms`, `latency_ms`, `finish_reason`, `usage`, and `cost_usd` (:408-450), priced per model by `costUsd()` in `src/lib/llm-pricing.ts` (:411-413, :440; left out when the model has no verified price). `onError` additionally `console.warn`s a breadcrumb so `vercel logs --tail` still shows attempt failures if the structured sink is down (:404-407). Still inside `onAttempt`, when `question != null && attempt.answerText != null && !attempt.fell_back` it fires `void faqCacheSet(question, answerText, model, cost, finish_reason, reasoningText)` (:463-476) — the write-through. `attempt.reasoningText` is exactly the `thinking_delta` bytes `llm.ts` sent to the client (accumulated at `src/lib/llm.ts:669-672`; `:723-725` attaches it beside `answerText` when it is non-empty); it goes only to `faqCacheSet`, never into the `llm.attempt` event.
  13. Response: `new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })` (:482-487).
- **Gotchas / invariants:**
  - Cost comes from `costUsd()` in `src/lib/llm-pricing.ts` (imported at :6), not from a table in this file. `cost_usd` is computed once per attempt (:409-413) and, when the model has no verified price, is left out of the `llm.attempt` event (:440) and recorded as a zero saving for the FAQ cache (:472) instead of being priced as Sonnet 4.6. The cache-write TTL the request asks for and the price assumes is one constant, `CACHE_WRITE_TTL` (:386).
  - `PROJECT_SLUGS` / `WORK_SLUGS` are computed at module load from Velite content (:31-32) and interpolated into the prompt (:104-105) — the prompt can never advertise a card slug the client cannot resolve.
  - `extendedThinking` is **on unless** `EXTENDED_THINKING === "false"` (:283) — an unset env means thinking is enabled. It is read once, above `skipCache`, and feeds both paths: the live call (`extendedThinking,` :478) and the hit path, where it gates the reasoning replay (:311).
  - `attempt.error.message` is passed through `redact()` before emit (:428) specifically in case Bedrock echoes a prompt fragment into error text.
  - `X-Chat-Skip-Cache` is unauthenticated on purpose: skipping the cache only forfeits a saving for that one request and grants no privilege; the limiter still applies (:275-280). The eval cron depends on it — if the header name checked at :284 and the one sent at `cron/eval/route.ts:123` ever diverge, the eval silently degrades into a cache test that never exercises the live model.
  - Size guards are header-only in chat (absent `Content-Length` = 0, no post-read backstop) and base64 image/PDF blocks have no per-block cap.

### FAQ response cache (`src/lib/chat-cache.ts`) and its purge route
- **Role:** Full-response cache for `/api/chat`, backed by the shared Upstash singleton (never a per-lambda `Map`), fail-open on every Redis error. Serves repeat first-turn questions with zero Bedrock spend.
- **Tiers:** exact (default on) — `normalizeQuestion` (trim, lowercase, collapse whitespace, strip trailing punctuation) → SHA-256 → key `anvilry:chat:cache:<hash>` (`faqCacheKey`, `:146-148`), and a stored `reasoning` is re-normalized on read because Redis is a trust boundary (`replayableReasoning` / `withReplayableReasoning`, `:172-185`, applied at `:265`); semantic (default **off**, `FAQ_CACHE_SEMANTIC_MATCH === "true"`, `:150-152`) — Titan embedding (`amazon.titan-embed-text-v2:0`, 512 dims, 5s timeout, `src/lib/faq-embeddings.ts:20-28`) compared against the capped index `anvilry:chat:cache:index`, hit when similarity ≥ `SIMILARITY_THRESHOLD = 0.92` (`:282`); the entry's `reasoning` field is deleted (`:310-313`) and the hit type is `Omit<FaqCacheEntry, "reasoning">` (`:123`), so a semantic hit never carries it. Whole cache kill switch: `FAQ_CACHE_ENABLED !== "false"` (`isFaqCacheEnabled`, `:158-160`).
- **Constants:** `FAQ_CACHE_TTL_SECONDS = 24 * 60 * 60` (`:67`, applied to the exact entry and, when the semantic tier is on, to its embedding re-write, `:378`, `:419`; the index sorted set has no TTL of its own); `FAQ_CACHE_INDEX_CAP = 500` (`:70`); index trims sampled 1-in-`TRIM_SAMPLE_EVERY = 20` writes (`:76`, `:386-392`); `MAX_CACHEABLE_ANSWER_CHARS = 4000` (`:83`); `MAX_CACHEABLE_REASONING_CHARS = 4000` (`:89`); `MAX_REASONING_QUESTION_CHARS = 200` (`:95`). Entries are tagged with `anvilry:corpus:built_at` (written by `src/instrumentation.ts`) so a content-correcting deploy does not replay an old answer.
- **Write gate:** `faqCacheSet` only stores when `finish_reason === "end_turn"` (`:345`), the sanitized answer is non-empty and ≤ 4000 chars (`:348`), and — upstream — `llm.ts` set `answerText` (clean, complete success only; every error path leaves it undefined; `reasoningText` rides along under the same condition, when non-empty) and the route saw `!attempt.fell_back` (`route.ts:466`): an answer served by a fallback rung is streamed but not cached, so a transient primary outage is not replayed for 24 h. It checks completion cleanliness, **not** content safety: a jailbreak that finishes cleanly is cached, which is what the purge route is for. The sixth parameter, `reasoning`, is stored beside the answer only when `replayableReasoning` accepts it (a string, control bytes stripped, trimmed, 1 to 4000 characters) and the normalized question is at most 200 characters, because the summary of a long question is the likeliest to carry what the visitor typed (`:355-358`); otherwise the answer is still cached without it, and an over-long summary logs only its length (`:359-367`).
- **Hit wire format:** one buffered body, not a stream: `answer + U+001E + JSON {model, fellBack:false, cacheHit:true, traceId}` with `X-Chat-Cache: hit` (:344-362). An exact-tier hit whose entry stored reasoning, with `EXTENDED_THINKING` not `false`, is prefixed `THINKING_SENTINEL` + reasoning + `THINKING_END` (:309-314, :352-354): the framing a live stream has, so `answerFromBody` and the chat client's parser read it unchanged, and the Chat view shows a collapsed "Thought for a moment" toggle. A semantic hit, an entry without reasoning and `EXTENDED_THINKING=false` get the plain body above. Clients must handle a non-streamed delimiter-format body in either shape; the frame never carries `usage`.
- **Purge — `POST /api/admin/faq-cache/purge`** (`src/app/api/admin/faq-cache/purge/route.ts`): `requireAdmin` (401 with `WWW-Authenticate: Basic realm="anvilry"`, :32-33) → declared `content-length > 4KB` → **413** (:35-38) → `req.json()` failure → **400** (:40-45) → post-read `JSON.stringify(body).length > 4KB` → **413** (:51-53) → `question` must be a non-empty string ≤ 2000 chars else **400** (:58-67) → `faqCachePurge` (`chat-cache.ts:449-469`: `del` the entry key + `zrem` from the index; not gated on `isFaqCacheEnabled()`) → **503** when the result status is `error`, else **200** with `{status: "purged" | "not_found", key}` (:69-73). It is deliberately unthrottled and sits **outside** the `src/proxy.ts` matcher (`/admin/:path*` does not match `/api/admin/*`), so `requireAdmin` is its only protection; an unset `ADMIN_PASSWORD` denies everything.

### `src/app/api/mcp/[transport]/route.ts`
- **Role:** Exposes the portfolio content layer as a read-only MCP server over Streamable HTTP.
- **Exports:** `maxDuration` (`= 30`, :9); `GET`, `POST`, `DELETE` — all three bound to the **same** `handler` from `createMcpHandler` (:130).
- **Reads / depends on:** `mcp-handler` (`createMcpHandler`), `@/lib/mcp-tools` as `* as T`.
- **Consumed by:** probed as `mcp_get` by `src/app/api/cron/health-check/route.ts:62` (`/api/mcp/mcp`).
- **Transport handling:** third argument is `{ basePath: "/api/mcp", disableSse: true }` (:127). The `disableSse` comment (:121-126) records why: SSE was removed from the MCP spec (2025-03-26), and without the flag a GET to the legacy `/api/mcp/sse` path (the `[transport]` segment matches `"sse"`) falls into mcp-handler's Redis init and throws `"redisUrl is required"` → an unhandled 500, because this project uses Upstash REST rather than `REDIS_URL`/`KV_URL`. Disabling it 404s that dead path and drops the redis dependency from the bundle.
- **Tools wired (10):** `get_profile` (:20), `list_projects` (:30), `get_project` (:40, `T.projectSlugSchema`), `list_work` (:49), `get_work` (:59, `T.workSlugSchema`), `search_experience` (:68, `T.searchSchema`), `get_resume_variant` (:78, `T.resumeRoleSchema`), `list_all_content` (:88), `get_content_item` (:98, `T.contentTypeSchema`), `list_decisions` (:109, `T.decisionsTagSchema`). All ten delegate to pure functions in `src/lib/mcp-tools.ts`. With `NOTES_ENABLED` off, `list_all_content` / `get_content_item` see no notes (`allNotes` is empty at the data layer, `src/lib/content.ts`), so the `note` type returns an empty list / notFound with `valid: []`.
- **Doc-count drift — was a live defect, fixed twice (7→9, then 9→10 when `list_decisions` shipped).** This route's own docblock and the public `/mcp` page both used to say "7 tools", omitting `list_all_content` and `get_content_item`; a second gap later omitted `list_decisions` from the same tally. Current state: the docblock says "10 read-only tools" (:12), `src/app/mcp/page.tsx:40-60` lists all ten in its `TOOLS` table, and `CLAUDE.md:244` / `CLAUDE.md:344` both say 10. **Guard:** `src/app/mcp/tools-documented.test.ts` reads both files from source — the page's `TOOLS` rows and the route's `server.registerTool(` calls (`:32`) — and fails with the missing names when the two sets disagree (`:85`). Because `vitest run` is chained into `pnpm build`, the drift cannot silently return.
- **Behaviour notes:** `T.wrapToolResult()` — moved to `src/lib/mcp-tools.ts:241-251` from this route file, which is exactly why it had no test coverage — returns `{ content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent }` and adds `isError: true` **iff** the payload object has a `notFound` key. `structuredContent` wraps a bare array as `{ items: data }`: the MCP SDK's runtime validation rejects a top-level array ("expected record") even though `data as Record<string, unknown>` type-checks fine — every `list_*`/`search_experience` tool failed on every real call until this fix.
- **Gotchas / invariants:** the `isError` signal is keyed purely on the presence of the literal `"notFound"` property (`mcp-tools.ts:242`); renaming that field in `mcp-tools.ts` would silently turn every not-found into a success. `runtime` must stay unexported (:6-8) — only `runtime = "edge"` is unsupported here, and re-adding the `nodejs` export breaks `cacheComponents`.

### `src/app/api/tts/route.ts`
- **Role:** Optional Polly Neural/Generative TTS, one sentence per request, backed by a process-local LRU.
- **Exports:** `maxDuration` (`= 15`, :15); `POST`.
- **Reads / depends on:** `@aws-sdk/client-polly`, `@/lib/llm` (`bedrockCreds` — same AWS creds as chat), `@/lib/rate-limit`, `@/lib/voice-catalog` (`getDefaultVoiceId`, `resolvePollyParams`, `validateVoiceForEngine`), telemetry modules, `./cache`.
- **Consumed by:** `src/components/chat/use-speech-synthesis.ts:358`; asserted in `use-speech-synthesis.dom.test.tsx:301`.
- **Behaviour notes:** gate order is unconfigured→**503** (:63-66), `voice`-bucket rate limit→**429** (:69-75), `content-length > 8 * 1024`→**413** (:78-80), bad JSON→**400** (:84-87), empty text→**400** (:90), unknown voice for engine→**400** (:103-108). Text is trimmed and capped at `MAX_CHARS = 600` (:33, :89). `voiceId` defaults to `getDefaultVoiceId()` (`"polly-neural-joanna"` per the comment at :36-39) and is rejected outright if it is 0-length or ≥64 chars or not valid for the `"polly"` engine. Polly's `transformToByteArray()` is raced against a 10s timeout (:160-165) so a stalled stream 502s fast instead of burning the 15s window. Region falls back to `REGION_FALLBACK = "us-east-1"` (:34, :51).
- **Gotchas / invariants:** no separate `tier` field is accepted — the catalog owns voice→tier mapping so a Joanna+generative mismatch is impossible by construction (:92-97). Every non-2xx is a deliberate fail-closed signal: the client cascades to browser `speechSynthesis` (:30). `aws_request_id` is pulled off `$metadata` on both the no-audio (:151) and error (:198) paths.

### `src/app/api/tts-google/route.ts`
- **Role:** Google Cloud TTS (Chirp 3 HD) engine, mirroring the Polly route's gate order; the permanent-free hedge against Polly's 12-month free-tier cliff (:20-26).
- **Exports:** `maxDuration` (`= 15`, :12); `POST`.
- **Reads / depends on:** `@/lib/rate-limit`, `@/lib/voice-catalog` (`resolveGoogleVoiceName`, `validateVoiceForEngine`), telemetry modules, `./cache`. Env: `GOOGLE_TTS_API_KEY` (:39).
- **Consumed by:** `src/components/chat/use-speech-synthesis.ts:366`; asserted in `use-speech-synthesis.dom.test.tsx:261`.
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
- **Behaviour notes:** five gates, in order — `withTrace` wrapper (:88); `TELEMETRY_ENABLED === "false"` → **204** with no emit (:92-95); rate limit on its own `beacon` bucket (`checkRateLimit(req, "beacon")`) → **429** + `Retry-After` (:101-107), so a beacon loop cannot starve chat or voice; declared `content-length > MAX_BODY_BYTES` (8KB, :65) → **413** (:112-114); `req.json()` failure → **400** (:121-125); post-read `JSON.stringify(raw).length > MAX_BODY_BYTES` → **413** (:131-133); `ErrorBeaconSchema.safeParse` failure → **400** (:139-142). Success emits one `client.error` event and returns **204 with no body** (:183).
- **Gotchas / invariants:**
  - The `source` enum `["boundary","global-boundary","window","unhandledrejection","react19"]` (:83) is declared the source of truth — it must be kept in sync with `ErrorBeaconPayload` in `beacon.ts` or a legitimate beacon 400s silently.
  - Field caps: `message` 1–2000, `stack` ≤8000, `url` ≤500, `userAgent` ≤500, `componentStack` ≤4000 (:78-84).
  - `message` and `stack` are `redact()`-ed before emit; `componentStack` is **not** (React-internal, not visitor-supplied) (:145-166).
  - Opt-**out** semantics are deliberate: only the exact string `"false"` disables telemetry; unset/typo keeps it on (:89-92).
  - The post-read 413 exists because `sendBeacon` and the fetch fallback do not always send `Content-Length`, so gate 4 alone is bypassable (:127-130).
  - The `anvilry:errors:recent` Redis write is one `redis.pipeline()` of `lpush` + `ltrim(…, 0, 49)` (keeps the last 50), fire-and-forget with `.catch(() => {})` (:174-180); separately, the `client.error` `emit()` before it only trims its own sorted set on 1-in-20 calls (`TRIM_SAMPLE_EVERY` in `src/lib/telemetry/emit.ts`, sampled to stay inside Upstash's free-tier command quota).

### `src/app/api/visit/route.ts`
- **Role:** Global visitor counter for the footer badge.
- **Exports:** `POST`.
- **Reads / depends on:** `next/server` (`NextResponse`), `@/lib/redis`, `@upstash/ratelimit`.
- **Consumed by:** `src/components/site-footer.tsx:56`.
- **Behaviour notes:** has its **own** limiter — `Ratelimit.slidingWindow(1, "30 m")`, prefix `anvilry:visit`, `analytics: false` (:38-45) — not the shared `checkRateLimit`. On a limiter denial it returns the current total with `today: 0` rather than a 429, so the badge never breaks (:54-59). Counts via a pipeline of two `incr`s (`anvilry:visits:total`, `anvilry:visits:daily`, :73-76) and sets the daily TTL only when `today === 1` (:78-81). TTL is computed to the next UTC midnight (:66-70).
- **Gotchas / invariants:** this route has its **own** `clientIp()` (:25-36) rather than importing one — deliberate duplication, documented at :19-24. **Spoofable-IP defect — was live, now FIXED.** This copy used to take the **leftmost** `x-forwarded-for` segment while `src/lib/rate-limit.ts:78` and `src/lib/telemetry/with-trace.ts:71` took the **last**; the leftmost segment is attacker-controlled, so a client could rotate spoofed XFF values and mint a fresh 1-per-30-min budget each time, inflating the visitor counter at will. Its only justification was an adjacent `// leftmost = client IP` comment, which was itself wrong. Current code is `if (xff) return xff.split(",").pop()!.trim();` (:34) — the last segment, matching the other two copies — and the comment now spells out the bypass it closes (:26-30). All three prefer the unspoofable `x-vercel-forwarded-for` first (:31-32). **Guard:** `src/lib/client-ip-consistency.test.ts` enumerates all three copies (`:27-29`) and asserts each takes the LAST segment, never the first (`:140`, rationale at `:146`), so the duplication can no longer drift. No flag check happens here — the gate is client-side (`NEXT_PUBLIC_VISITOR_COUNTER`), stated at :14-16 so rate-limit state stays consistent across flag flips.

### `src/app/api/github/stats/route.ts`
- **Role:** Aggregates the GitHub repo feed plus the user profile into one compact JSON summary.
- **Exports:** `GET`.
- **Reads / depends on:** `@/lib/github` (`getRepoFeed`). Env: `GITHUB_TOKEN` (:19).
- **Consumed by:** `src/components/github-stats-strip.tsx:45`; `src/app/api/chat/route.ts:42`; `src/app/api/cron/github-sync/route.ts:38`; probed as `github_stats_api` by `health-check/route.ts:61`.
- **Behaviour notes:** the user fetch hardcodes `https://api.github.com/users/sairam0424` (:29) with `next: { revalidate: 3600 }` (:31) and swallows failures to `null` (:33-34). Fully fail-open: `totalStars`/`totalForks` reduce over whatever repos came back, `mostRecentPush` is `null` on an empty feed (:49-55), `followers` defaults to `0`, `publicRepos` falls back to `repos.length` (:63-66).
- **Gotchas / invariants:** `export const revalidate = 3600` was **removed** for `cacheComponents`; the 1-hour cadence now lives only in the two fetch-level `next: { revalidate: 3600 }` options (`:31` and `src/lib/github.ts:114`) — deleting either silently changes the GitHub polling cadence (:3-7). `health-check` treats `repoCount === 0` as a `warn`, which is the canary for a missing/rate-limited token (`health-check/route.ts:119-124`).

### `src/app/api/cron/*` — the CRON_SECRET check
All five cron routes share **one** guard, `unauthorizedUnlessCron(req)` from `src/lib/cron-auth.ts:23-26`,
called first in the handler:

```ts
const denied = unauthorizedUnlessCron(req);
if (denied) return denied;
```

Locations: `eval/route.ts:102-103`, `health-check/route.ts:151-153`, `github-sync/route.ts:19-20`,
`seo-audit/route.ts:17-18`, `content-audit/route.ts:20-21`. The check itself is `hasValidCronSecret`
(`cron-auth.ts:15-20`): **fail-closed** — an unset/empty `CRON_SECRET` or a missing `authorization` header
returns false; otherwise both the supplied header and `` `Bearer ${secret}` `` are SHA-256 hashed and compared
with `crypto.timingSafeEqual` (constant-time, equal-length by construction, no scheme-case tolerance, no
trimming, no `x-vercel-*` alternative). The 401 body is `{ error: "Unauthorized" }`.
`src/app/api/cron/cron-auth.routes.test.ts` pins all five routes to this behaviour. The same
`hasValidCronSecret` is what lets the eval cron bypass the `chat` rate-limit bucket (`rate-limit.ts:100`).
Base-URL derivation, by contrast, is **not** uniform:
`eval/route.ts:105-107`, `github-sync/route.ts:32-34` and `seo-audit/route.ts:21-22` each inline
`process.env.VERCEL_URL ? \`https://${VERCEL_URL}\` : "http://localhost:3000"`; `content-audit` makes
zero network calls and needs no base at all; and `health-check` no longer reads `VERCEL_URL` directly —
it calls `probeBase()` from `@/lib/health-expectations` (`health-check/route.ts:155`,
`src/lib/health-expectations.ts:51-58`), which prefers `VERCEL_PROJECT_PRODUCTION_URL` and falls back
to `VERCEL_URL` only as a last resort. See the health-check section below for why that distinction is
load-bearing.

Schedules come from `vercel.json` (Vercel Cron issues **GET**):
`/api/cron/health-check` `0 5 * * *`; `/api/cron/eval` `0 9 * * 1`; `/api/cron/github-sync` `0 8 * * *`;
`/api/cron/seo-audit` `0 6 * * 1`; `/api/cron/content-audit` `0 7 * * 1`.

#### `src/app/api/cron/eval/route.ts`
- **Exports:** `maxDuration` (`= 60`, :5); `GET` and `POST` both aliased to `runEval` (:185-186) — POST is for manual triggering with the same header (:184).
- **Behaviour notes:** 12 `GOLDEN_PAIRS` (:21-83) across categories `factual`, `rag`, `injection`. Each pair fires one POST at `/api/chat` with a 25s `AbortSignal.timeout` (:131). Two headers matter: `X-Chat-Skip-Cache: 1` (:123) so the run always exercises the live model + corpus path instead of the FAQ cache, and `Authorization: Bearer ${CRON_SECRET}` (:126) so the chat limiter recognises the run and skips the 8/min per-IP budget (a run of 12 sequential chats would otherwise 429 itself). The body is reduced to the visible answer by `answerFromBody` (imported from `@/lib/llm-trace` at :2, called at :138), which drops a leading reasoning block and the trailing trace frame, so neither counts as answer text. Non-injection pairs pass if **any** expected keyword appears case-insensitively (:97-98); the two injection pairs pass only if their own `forbidden` token (`HELLO_INJECTED`, `INJECTED_PAYLOAD_XYZ`) is **absent** (:90-95). Result is written to `anvilry:eval:latest` with `ex: 8 * 24 * 3600` — "weekly cadence + 1 day grace" so stale data self-expires (:173-179).
- **Gotchas / invariants:** the eval calls the **live** `/api/chat`, so it consumes real Bedrock spend (docstring: ~12 calls ≈ $0.012/run, :18); its own limiter budget is bypassed, not shared. Worst case 12 × 25s exceeds `maxDuration` 60. The eval used to cut the body at the first `U+001E`, but every live body opens with `THINKING_SENTINEL` (same first byte) while extended thinking is on, reasoning or not, so each of the 12 pairs read an empty answer and failed; it now parses with `answerFromBody` (`route.test.ts` and `llm-trace.test.ts` pin it, including the empty-reasoning body production sends). In production the 12 requests do not get that far: the base is `VERCEL_URL`, the protected generated host, which answered `POST /api/chat` with 401 on 2026-10-01 (`DEPLOY.md` section 7). Even a reachable run would usually score 11 of 12: the email pair expects "sairamugge" (`route.ts:68-72`), which the published address `uggesairam0000@gmail.com` does not contain. Renaming the skip-cache header on either side turns the eval into a cache test. `src/app/api/cron/eval/route.test.ts` asserts every outgoing chat call carries the bearer (`:26-42`) and `X-Chat-Skip-Cache: 1` (`:123-138`), so a replayed hit never stands in for the live model.

#### `src/app/api/cron/health-check/route.ts`
- **Exports:** `maxDuration` (`= 25`, :5); `GET`.
- **Behaviour notes:** `CHECKS` is 13 entries with per-check `criticality` (`P1`/`P2`/`P3`) and per-check `timeout` (10s / 8s) (:55-69), probed with `Promise.all` (:160) against `probeBase()` (:155). The pass/fail gate is **not** a blanket HTTP 200 — it delegates to `isExpectedStatus(check.name, http_status)` / `expectedStatus(check.name)` from `@/lib/health-expectations` (:3, :107-109), which is what lets `mcp_get` expect its by-design 405. Extra validation on top: `github_stats_api` warns when `repoCount` is not a number or is `0` (:119-124); `llms_txt`/`llms_full_txt` **fail** when the body is `< 1000` chars — the empty-corpus canary (:128-135); `resume_json_api` fails when `json.basics` is missing (:137-143). Top status: `fail` if any P1 failed, else `warn` if any check failed **or warned**, else `pass` (:185-189). Alerting: on a `pass → fail` transition it sets `anvilry:health:alert:active` with `{ nx: true, ex: 90_000 }` — `nx` suppresses alert storms — and `del`s it on recovery (:206-218). Result stored at `anvilry:health:latest` with `ex: 90_000` (25h) so a missed run self-expires (:221).
- **The SSO-wall defect — was live, now FIXED.** `probe()` used to build its base from `process.env.VERCEL_URL`, the per-*deployment* host, which is covered by Vercel deployment protection on this project (only the production alias is exempt). Because `fetch` follows redirects by default, each probe was walked from a 302 to `vercel.com/login` and recorded **200 with ~478KB of login HTML** — so 11 of 13 checks were scoring an auth wall as *healthy*, and `mcp_get` in particular was **falsely passing**, not failing. `llms_txt`/`llms_full_txt` even satisfied their `> 1000` bytes body assertion on the login page. The residual `warn` came from `github_stats_api` and `resume_json_api`, whose `res.json()` throws on HTML. Current state: the base comes from `probeBase()` (`src/lib/health-expectations.ts:51-58`), which prefers `VERCEL_PROJECT_PRODUCTION_URL` and only falls back to `VERCEL_URL`; `probe()` sets `redirect: "manual"` (:79) and **fails** any 3xx, naming Vercel SSO when `location` matches `vercel.com/(sso-api|login)` so a responder reads "auth wall" instead of a bare status code (:85-99). The rationale is recorded at `src/lib/health-expectations.ts:34-50` with the measured `curl` output.
- **Gotchas / invariants:** `p2_pass` is computed and reported but does **not** feed `topStatus` (which already covers P2 via `failedNames`) (:177-189). The previous-state read tolerates both a raw object and a JSON string from Upstash (:210). The alert fires only on a `pass → fail` transition: `warn → fail`, a first-ever run, or an expired key never sets `alert:active` (:211-213). Expecting `mcp_get`'s 405 is only safe *because* the base is now the production alias — against a protected host that answers 200 from a login page, the 405 expectation converts a false pass into a permanent false `fail` with the maximally misleading `expected 405, got 200`.

#### `src/app/api/cron/github-sync/route.ts`
- **Exports:** `maxDuration` (`= 30`, :4); `GET`.
- **Behaviour notes:** returns `{ synced: false, reason: "Redis not configured" }` when `redis` is null (:22-24). Idempotency: if `anvilry:github:stats:latest` already exists it short-circuits with `reason: "cache_fresh"` (:27-30) — double invocations from Vercel's best-effort delivery are harmless. Fetch failures return `reason: "fetch_failed"` (:43-45); a falsy payload returns `reason: "upstream_error"` **before** the Redis write, so a 429/503 from GitHub can never report `synced: true` (:49-51). TTL is `ex: 5400` (90 min) (:53).
- **Gotchas / invariants:** the docstring says "**Hourly** GitHub stats cache warm" (:9) but `vercel.json` schedules it `0 8 * * *` — **daily**. The 90-minute TTL means the key has expired before the next run, so the `cache_fresh` skip is effectively always cold at a daily cadence, and the skip branch returns without refreshing the key.

#### `src/app/api/cron/seo-audit/route.ts`
- **Exports:** `maxDuration` (`= 60`, :5); `GET`.
- **Behaviour notes:** probes four routes with a 10s timeout each (:24-42). Then counts content items with a missing/blank summary — and normalises the field name per collection: Work/Article/Note use `summary`, **Project uses `excerpt`** per the Velite schema (:44-55). While `NOTES_ENABLED` is off `allNotes` is empty, so notes drop out of both the count and `total_content`.
- **Gotchas / invariants:** the `excerpt` mapping is load-bearing — the in-file note (:45-46) records that using `summary` for projects false-positives every project. Result stored at `anvilry:seo:audit:latest`, `ex: 7 * 24 * 3600`.

#### `src/app/api/cron/content-audit/route.ts`
- **Exports:** `maxDuration` (`= 60`, :5); `GET`.
- **Behaviour notes:** `EIGHTEEN_MONTHS_MS = 18 * 30 * 24 * 60 * 60 * 1000` (:17) — 18 × **30-day** months, i.e. 540 days, not calendar months. Flags articles and notes whose `date` predates `Date.now() - threshold` (:23-31). While `NOTES_ENABLED` is off `allNotes` is empty, so `stale_notes` is always `[]`. Zero network calls. Stored at `anvilry:content:audit:latest`, `ex: 7 * 24 * 3600`.

### `src/app/api/md/{work,projects,articles,notes}/[slug]/route.ts` and `src/app/{work,projects,articles,notes}/[slug].md/route.ts`
- **Role:** Serve raw MDX/MD bodies (frontmatter removed) as `text/markdown` so AI crawlers can read canonical content.
- **Exports:** `GET` in all eight files.
- **Reads / depends on:** the matching `@/lib/content` collection (`allWork` / `allProjects` / `allArticles` / `allNotes`), `fs.readFileSync`, `path.join`, `next/server` type import only.
- **Consumed by:** `src/lib/llms-txt.ts:88-103` advertises the pretty form (`${BASE}${item.url}.md`) for work, projects, notes, and non-external articles. `next.config.ts:240-248` rewrites `/work/:slug.md`, `/projects/:slug.md`, `/articles/:slug.md`, `/notes/:slug.md` → `/api/md/<collection>/:slug`. **UNVERIFIED:** which of the two implementations actually serves a live request — the `next.config.ts` `rewrites()` return is the bare-array (`afterFiles`) form and there is also a filesystem route at `app/<collection>/[slug].md/route.ts`; resolution order was not exercised. Both produce byte-identical output.
- **Behaviour notes:** two-stage 404 — first the slug must exist in the Velite collection, then the file must be readable (`api/md/work/[slug]/route.ts:28-32`). `readRawContent` tries `.mdx` then `.md` under `process.cwd()/content/<collection>/` (:11-21). `stripFrontmatter` is `raw.replace(/^---[\s\S]*?---\s*\n?/, "").trimStart()` (:7-9). The existence check reads `allNotes` for the notes handlers, which is empty while `NOTES_ENABLED` is off, so both notes handlers 404 every slug in that state (the `/notes` pages 404 too).
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
- **Consumed by:** linked from `src/components/site-footer.tsx:243`; probed by `seo-audit/route.ts:28` and `health-check/route.ts:65`.
- **Behaviour notes:** `BASE` is the hardcoded `"https://anvilry.vercel.app"` (:6). `xml()` escapes all five XML predefined entities (:9-16). Articles use `externalUrl` for both `<link>` and `<guid>` when present, so readers open the original publication rather than a stub on this domain (:32-38). Items are merged and sorted newest-first by parsed `pubDate` (:40-42). Empty-safe: with no content the feed is still valid but item-less (:5).
- **Gotchas / invariants:** `BASE` is one of the hardcoded base URLs (`:6`). **Undercount — was a live defect, now FIXED:** `CLAUDE.md` used to list only four files to update on a custom domain (`layout.tsx`, `sitemap.ts`, `robots.ts`, `json-ld.tsx`), and this file's `BASE` was one of the occurrences missing from it. `CLAUDE.md`'s "Custom domain" paragraph now says the host is hardcoded in **24 files / 33 occurrences** at this tree, and `feed.xml/route.ts` is named explicitly in the enumeration of `BASE` declarations (`CLAUDE.md:397`); re-verify with `grep -rn 'anvilry\.vercel\.app' src Makefile` rather than trusting any list. Cross-reference: [15 § The hardcoded base URL](./15-invariants-and-gotchas.md#the-hardcoded-base-url). The feed reads `allNotes`, which is empty while `NOTES_ENABLED` is off, so notes drop out of the feed with the flag (as they do from `llms.txt`, MCP and the chat corpus); it does not consult `ARTICLES_ENABLED` at all, unlike `sitemap.ts`.

### `src/app/sitemap.ts`
- **Role:** Flag-aware sitemap generator (`/sitemap.xml`).
- **Exports:** `default sitemap(): MetadataRoute.Sitemap`.
- **Reads / depends on:** `@/lib/content` (all four collections), `@/lib/writing-flags` (`ARTICLES_ENABLED`, `NOTES_ENABLED`, `STATS_ENABLED`, `SEARCH_ENABLED`).
- **Consumed by:** `robots.ts:16` points at it; `e2e/views.spec.ts:246`; probed by `seo-audit` and `health-check` (P1).
- **Behaviour notes:** static routes are `["", "/work", "/projects", "/about", "/resume", "/mcp"]` (:13-19) with `priority` 1 for `""` and 0.8 otherwise. Priorities: work 0.7, projects 0.6, listing pages 0.6, note/article detail 0.5, `/stats` 0.6, `/search` 0.5. `changeFrequency` is `"monthly"` everywhere except the `/notes` and `/articles` listing pages (`"weekly"`). `lastModified` is set only on note and article entries, from the item's real `date` (the listing page uses the newest entry's date, :38-57, :59-85); static, work, project, `/stats` and `/search` entries carry none.
- **Gotchas / invariants:** notes and articles are included only when the flag **and** non-empty content both hold (`NOTES_ENABLED && allNotes.length`, :41; `ARTICLES_ENABLED && indexableArticles.length`, :68). Articles that only point at a note (`linkedNote` set, no `externalUrl`) are filtered out while `NOTES_ENABLED` is false (:64-66) so the sitemap never lists a URL that 404s; `allArticles` itself already drops these at the data layer (`isNoteOnlyArticle` in `src/lib/content.ts`, a superset that also covers an `externalUrl` pointing at an own `/notes/` URL). `base` is hardcoded (:10). `.md` passthrough URLs are not listed.

### `src/app/robots.ts`
- **Role:** `/robots.txt`.
- **Exports:** `default robots(): MetadataRoute.Robots`.
- **Behaviour notes:** allow-all — `{ userAgent: "*", allow: "/" }` (:6-7) — plus a `Content-Signal: search=yes, ai-input=yes, ai-train=no` line in the `*` rule block via `other` (:14; a stated preference under Cloudflare's Content Signals convention, not enforcement) and `sitemap: "https://anvilry.vercel.app/sitemap.xml"` (:16). No `disallow` entries at all: `/admin/*` is not excluded from crawling here (it is protected by `src/proxy.ts` instead).

### `src/app/llms.txt/route.ts` and `src/app/llms-full.txt/route.ts`
- **Roles:** `/llms.txt` returns `buildLlmsTxt()` — the curated index (~1-2KB); `/llms-full.txt` returns `buildCorpus()` — the full chatbot grounding corpus (~4-8KB).
- **Exports:** `GET` in both; both set `Content-Type: text/plain; charset=utf-8`.
- **Consumed by:** `/llms.txt` linked from `src/components/site-footer.tsx:105`, checked by `e2e/views.spec.ts:241`; both probed by `health-check/route.ts:63-64` with a **`< 1000` chars ⇒ fail** body-length assertion.
- **Gotchas / invariants:** `llms-full.txt`'s docblock (:13-18) records that `dynamic = "force-dynamic"` was removed both because `cacheComponents` rejects it and because the original rationale was wrong — `buildCorpus()` reads build-time Velite content, so a static route already regenerates on every deploy.

### `src/proxy.ts`
- **Role:** The Next 16 Proxy (formerly Middleware). It runs on the Node.js runtime (the Proxy default, docblock :7-9) before any route handler. Its only job is to return a real `401` with a `WWW-Authenticate` header for `/admin/*`, which an App Router server component cannot do (it must return React nodes) (:11-13).
- **Exports:** `config` (`{ matcher: ["/admin/:path*"] }`, :21-23); `proxy(req: NextRequest)` (:25).
- **Matcher:** exactly `["/admin/:path*"]` — nothing else in the app is intercepted. In practice that is `/admin/telemetry` (`src/app/admin/telemetry/page.tsx`). `/api/admin/*` (the FAQ-cache purge) does **not** match and relies on `requireAdmin` alone.
- **Auth path:** `proxy` delegates the whole credential check to `isAdminAuthorized(req.headers.get("Authorization"))` (:26) from `src/lib/admin-auth.ts:24-44`, the single implementation now shared by this proxy, `requireAdmin` (route handlers, `admin-auth.ts:48-50`) and the `/admin/telemetry` page (which re-checks and calls `notFound()` when unauthorized). It denies when `ADMIN_PASSWORD` is unset (logging an `[admin-auth]` warning on every denied call, never revealing why to the client), when the scheme is not `Basic `, or when the credential mismatches. The supplied value is decoded with `Buffer.from(_, "base64")` (never throws; garbage simply fails the compare) and both `"password"` and `"username:password"` forms are accepted, taking everything after the first colon (:37-41). The compare is `constantTimeEqual` — SHA-256 digests of both sides through `crypto.timingSafeEqual` (:55-59), so it is constant-time and length-safe.
- **Behaviour notes:** one 401 exit — `new NextResponse("Unauthorized", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="anvilry"' } })` (:27-30) — for every failure mode, so the response never distinguishes an unset env from a wrong password. Success returns `NextResponse.next()` (:34). `src/proxy.test.ts` pins the 401 + challenge for unset/wrong credentials and the `x-middleware-next` pass-through on success.
- **Gotchas / invariants:** the docblock (:15-18) states this proxy is the *first filter*, not the only gate: the admin pages re-check auth themselves. Because all three call sites (the proxy, `requireAdmin` and the page) use the same `isAdminAuthorized`, they can no longer disagree about a credential (previously the proxy carried its own Edge/Web Crypto copy with a plain `!==` digest compare). The `requireAdmin` 401 additionally sets `Cache-Control: no-store` (`unauthorized()` in `admin-auth.ts`); the proxy's 401 does not.

### `src/instrumentation.ts`
- **Role:** Next 16 server instrumentation hook — one structured config-snapshot log per server process start, plus a production-only corpus build timestamp.
- **Exports:** `register()` (async).
- **Reads / depends on:** `process.env` only for the snapshot; dynamically `import("@/lib/redis")` at :95.
- **Behaviour notes:** returns immediately when `process.env.NEXT_RUNTIME === "edge"` (:35). Builds a `config` object with: `vercel_env` (enum of `production|preview|development`, fallback `"local"`), `node_env`, `region` (`VERCEL_REGION ?? AWS_REGION ?? "unknown"`), `flag_driver` (`vercel|local`, fallback `local`), `flags_sdk_configured` (`FLAGS` present), `flags_secret_configured` (`FLAGS_SECRET` present), a `beast_flags` block (`NEXT_PUBLIC_ORB_POSTPROCESSING`, `NEXT_PUBLIC_INK_TRANSITION`, `NEXT_PUBLIC_SKILL_TREE`, `NEXT_PUBLIC_404_ORB`, `NEXT_PUBLIC_VISITOR_COUNTER`, each `=== "true"`), an `integrations` presence-only block (`BEDROCK_ACCESS_KEY_ID`, `UPSTASH_REDIS_REST_URL`, `GOOGLE_TTS_API_KEY`, `GITHUB_TOKEN`, `ADMIN_PASSWORD`, `TELEMETRY_IP_SALT`), `llm_provider` (`bedrock|anthropic`, fallback `bedrock`) and `llm_sdk` (`anthropic-bedrock|aws-sdk-bedrock`) (:39-80). Emitted as a single `console.log("[config]", JSON.stringify(config))` (:84).
- **Gotchas / invariants:** only booleans and safe enum values are logged — never a secret value (:12-14). Grep handles are distinct and load-bearing: `[config]` here, `[trace]` for telemetry spans (`src/lib/telemetry/emit.ts:61`), `[vitals]` for RUM (`src/instrumentation-client.ts:52`), `[flags]` for flag resolution (`src/lib/flags.ts:45`). `discovery_badges` is deliberately omitted from `beast_flags` because it is runtime-resolved and logged by `getDiscoveryBadgesEnabled()` (:59-60). The corpus timestamp write (`anvilry:corpus:built_at`, `ex: 7 * 24 * 3600`) is gated on `VERCEL_ENV === "production"` — **not** `NODE_ENV`, because Vercel preview deploys also run with `NODE_ENV=production` and would pollute the value; it falls back to `NODE_ENV` only when `VERCEL_ENV` is absent (:86-104). The value is the current time in milliseconds (:97), written again by every production `register()`, i.e. at every process start (each cold start or fresh serverless instance), not only on a content deploy; a FAQ-cache entry whose `corpusBuiltAt` differs from the current stamp reads as a miss (`chat-cache.ts:201-206`, `chat-cache.ts:264`), so cached answers do not survive a production process start. The docblock (:16-18) warns `register()` is best-effort startup logging, not a hard init gate — Next makes no guarantee it blocks before the first request.

### `src/instrumentation-client.ts`
- **Role:** Next 16 client instrumentation hook — registers web-vitals reporting and the two window-level error listeners that sit under the React boundaries.
- **Exports:** none. The whole file is a module-load side effect guarded by `if (typeof window !== "undefined")` (:46); the framework contract is "side-effects at module load are run" (:5-7).
- **Reads / depends on:** lazy `import("web-vitals")` (:50) and lazy `import("@/lib/telemetry/beacon")` (:59).
- **Behaviour notes:** `onLCP`/`onINP`/`onCLS` all report via `console.info("[vitals]", name, Math.round(value), rating)` — no Redis, no API route (:50-56); the whole vitals block is `.catch()`-swallowed so observability can never break the page. Two listeners are registered: `"error"` (:74) and `"unhandledrejection"` (:86), each calling `sendErrorBeacon` with `source: "window"` / `"unhandledrejection"`, `url: window.location.href`, `userAgent: navigator.userAgent`, `level: "error"`. Rejection reasons are narrowed four ways — `Error` instance, object with a string `.message` (and optional `.stack`), non-null primitive via `String()`, else the literal `"unhandled rejection"` (:93-106).
- **Gotchas / invariants:** the **dedupe contract** is the subtle part (:26-39, :65-72): React boundaries set `window.__anvilry_error_recently__ = Date.now()` *before* they beacon, and both window listeners suppress if that timestamp is within `DEDUPE_MS = 100`. It is a timestamp rather than a boolean specifically to avoid a `setTimeout` cleanup that would add an event-loop turn and re-create the race. Two genuinely distinct errors 200ms apart still both report. If a boundary stops setting that global, every render error double-reports to `/api/error`. Both `import()`s are dynamic to keep `web-vitals` (~4KB) and the beacon module out of the SSR bundle and off the critical path.

### Test files in scope
- **`src/app/api/error/route.test.ts`** — mocks `@/lib/telemetry/emit`, `@/lib/rate-limit`, and `@/lib/telemetry/with-trace` (passthrough with a synthetic ctx) via `vi.hoisted` + `vi.mock`, then re-imports the route with `vi.resetModules()` per test. Asserts the exact `client.error` envelope (`kind`, `route`, `traceId`, `parentSpanId`, fresh `spanId`), Zod 400s (missing `message`/`source`, bad enum, malformed JSON), the 413 declared-content-length short-circuit, the `TELEMETRY_ENABLED=false` 204-no-emit path, the 429 + `Retry-After: 17`, that the limiter is charged on the `beacon` class (`:199-203`), and — most load-bearing — that emails and 32+-char tokens are redacted out of both `message` and `stack` before `emit()` runs (`:225-264`). The fixture builds its fake token with `.repeat()` deliberately: a hand-typed literal would trip the project's secret-scan hook, and a JWT-shaped fixture splits on `.` into sub-32-char segments the redactor correctly ignores (`:232-236`).
- **`src/app/api/tts/cache.test.ts`** — pins the v1.7 cross-voice isolation invariant: distinct keys per voice and per tier, determinism, "text encoded last so a malicious text containing a pipe cannot forge another voice", LRU bump-on-hit, eviction past `CACHE_MAX`, `ALLOWED_TIERS` exactly `{neural, generative}`, and end-to-end validate→resolve→key flows including rejection of a Google catalog id on the Polly engine (cross-engine attack).
- **`src/app/api/tts-google/cache.test.ts`** — key distinctness per voice, identical-input determinism, set/get round-trip, no cross-voice collision, eviction beyond 100.
- **`src/app/api/tts-google/route.test.ts`** — 503 when `GOOGLE_TTS_API_KEY` is unset or empty; 400 for invalid JSON, missing/empty text, missing `voiceId`, unknown `voiceId`, and a **Polly** catalog id submitted to the Google route (cross-engine attack); 413 over 8KB; base64→bytes happy path with `fetch` mocked; 502 on non-2xx and on missing `audioContent`; and a second identical request served from cache.
- **`src/app/api/chat/route.test.ts`** — mocks `@/lib/llm`, `@/lib/chat-cache` (bar the last block, which runs the real module) and the limiter. Pins that chat charges the `chat` bucket (`:131-137`); FAQ-cache eligibility wiring: a single first-turn text question consults the cache, a multi-turn request never does, and `X-Chat-Skip-Cache` bypasses it (`:139-176`); a hit returns the cached answer without calling `streamWithFallback` or fetching live GitHub stats, a miss falls through (`:178-215`); and the `onAttempt` write-through calls `faqCacheSet` with question / answer / model / cost / `finish_reason`, but never on an attempt with no `answerText`, on an answer served by a fallback rung (`fell_back`), or on a multi-turn request (`:217-310`); and the `llm.attempt` cost telemetry (`:312-478`): `cost_usd` is the verified price of the model that answered (cache writes at the 1-hour rate, `0` for an empty usage block, none when no usage arrived, kept for an attempt that failed after `message_start`), absent for an unpriced model, the event carries the model id and `usage` block, and `cache_control.ttl` follows `CACHE_WRITE_TTL`; and the exact-hit reasoning replay (`:514-774`): the body is sentinel, reasoning, end marker, answer and trace frame, and `answerFromBody` returns the answer alone; an entry without reasoning, a semantic hit and `EXTENDED_THINKING=false` each get the plain body; stored reasoning that is whitespace, control bytes or not a string is untrusted (embedded control bytes are stripped); the `chat.cache` span carries the boolean `reasoning_replayed`, never the text; `faqCacheSet` receives the reasoning as its sixth argument (`undefined` when the model did not reason, nothing written for a fallback rung) and the `llm.attempt` event never contains it; and, with the real `chat-cache` over an in-memory Redis (`:776-929`), a miss writes what the next exact hit replays, a question over the reasoning bound is still served from the cache but without it, and replay stops once `EXTENDED_THINKING` is `false`.
- **`src/app/api/admin/faq-cache/purge/route.test.ts`** — 401 without credentials and with a wrong credential (both assert Redis is untouched), and with `ADMIN_PASSWORD` unset (`:52-73`); authenticated: purges an existing entry and removes it from the index, reports `not_found` with 200, 503 when Redis throws, 400 for a missing or blank question, 413 for a declared oversize body (`:75-122`).
- **`src/app/api/cron/cron-auth.routes.test.ts`** — runs all five cron handlers through the shared guard: 401 when `CRON_SECRET` is unset even with a plausible header, 401 on a missing header, 401 on a wrong value / wrong scheme / longer or shorter value, and proceeds only on the exact bearer (`:57-90`).
- **`src/app/api/cron/eval/route.test.ts`** — every outgoing `/api/chat` call from the eval carries the cron secret as a bearer token (`:26-42`), and the scoring (`:44-121`): 12 of 12 pass with no sentinel, with the empty-reasoning body production sends (sentinel and end marker, nothing between), with a reasoning block ahead of each answer, and when the injection payload appears only in the reasoning; and every call sends `X-Chat-Skip-Cache: 1` (`:123-138`), so a replayed hit never stands in for the live model.
- **`src/app/api/voice-rate-limit-class.test.ts`** — `/api/tts`, `/api/tts-google` and `/api/transcribe` charge the `voice` bucket, not `chat` (`:38`).
- **`src/proxy.test.ts`** — the `/admin/*` gate: 401 + `WWW-Authenticate: Basic` when `ADMIN_PASSWORD` is unset or the credential is wrong, `x-middleware-next` pass-through on the correct credential.

## Coverage
- `src/app/api/chat/route.ts`
- `src/app/api/chat/route.test.ts`
- `src/app/api/admin/faq-cache/purge/route.ts`
- `src/app/api/admin/faq-cache/purge/route.test.ts`
- `src/app/api/voice-rate-limit-class.test.ts`
- `src/app/api/cron/cron-auth.routes.test.ts`
- `src/app/api/cron/content-audit/route.ts`
- `src/app/api/cron/eval/route.ts`
- `src/app/api/cron/eval/route.test.ts`
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
- `src/proxy.test.ts`
- `src/instrumentation.ts`
- `src/instrumentation-client.ts`
