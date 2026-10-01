# Configuration Reference — Anvilry

Single source of truth for every environment variable, feature flag, and build-time config in the portfolio. `.env.example` in the project root is the copy-paste companion for local dev setup.

> **Scope:** describes Anvilry v3.10.0 (`package.json` 3.10.0), i.e. `main` @ `a929932` (`package.json` 3.6.0) **plus eleven post-`a929932` behaviour changes**: notes hidden at the data layer while `NEXT_PUBLIC_NOTES_ENABLED` is off; per-class rate limits (`chat` / `voice` / `beacon`) with a `CRON_SECRET` bypass; one shared admin auth check and one shared cron auth check; command-palette talk-mode gated by the active voice view; bundle gate `MIN_ROUTES=17`; and, added in v3.8.0, IAM-denied models falling through to the next rung and the opt-in `LLM_USE_SONNET_5_5`; and, added in v3.9.0, the removed model and provider line under chat answers and the removed Konami code (so the discovery badge counts to 4); and, added in v3.10.0, Sonnet 4.6 behind a 5.x primary with Opus opt-in (`LLM_USE_OPUS_FALLBACK`), summarized reasoning at effort `medium` on Sonnet 5.x (`LLM_THINKING_EFFORT`), the verified per-model price table and the neutral AI cue (no setting). When this file and the code disagree, the code wins. The sections after §17 (Server Toggles, Caches & Crons; Security Headers; Quick-Reference; Files That Read Environment Variables) are unnumbered and not in the table of contents.

**Quick start:** `cp .env.example .env.local` → replace or delete the placeholder `BEDROCK_*` lines (any non-empty value counts as "configured", so chat then fails at AWS instead of returning the 503 "not configured" message) → fill in the required secrets → `pnpm dev`.

---

## Table of Contents

1. [Required Secrets](#1-required-secrets)
2. [AWS Bedrock Credentials](#2-aws-bedrock-credentials)
3. [Rate Limiting — Upstash Redis](#3-rate-limiting--upstash-redis)
4. [Voice Engines](#4-voice-engines)
5. [Telemetry & Observability](#5-telemetry--observability)
6. [GitHub Integration](#6-github-integration)
7. [Cron & Internal Routes](#7-cron--internal-routes)
8. [Feature Flags — Writing Sections](#8-feature-flags--writing-sections)
9. [Feature Flags — Hiring Signals](#9-feature-flags--hiring-signals)
10. [Feature Flags — Homepage Sections](#10-feature-flags--homepage-sections)
11. [Feature Flags — Beast Mode](#11-feature-flags--beast-mode)
12. [Algorithm Config Flags](#12-algorithm-config-flags)
13. [View & Voice UX Flags](#13-view--voice-ux-flags)
14. [Vercel Flags SDK](#14-vercel-flags-sdk)
15. [Runtime Voice Settings (localStorage)](#15-runtime-voice-settings-localstorage)
16. [Auto-Provided by Vercel](#16-auto-provided-by-vercel)
17. [How to Add a New Flag](#17-how-to-add-a-new-flag)

---

## 1. Required Secrets

These must be set before the chatbot works. Everything else degrades gracefully.

| Variable | Required | Description |
|---|---|---|
| `BEDROCK_ACCESS_KEY_ID` | If `LLM_PROVIDER=bedrock` | AWS IAM access key (raw or BASE64-encoded — decoded at runtime). |
| `BEDROCK_SECRET_ACCESS_KEY` | If `LLM_PROVIDER=bedrock` | AWS IAM secret key (raw or BASE64-encoded). |
| `ANTHROPIC_API_KEY` | If `LLM_PROVIDER=anthropic` | Direct Anthropic API key (`sk-ant-...`). |

**Model fallback chain** (configured in `src/lib/llm.ts`):
```
Bedrock (default): Sonnet 4.6 → Haiku 4.5   |   Direct Anthropic: Sonnet 4.6 → Haiku 4.5
Opt-in Opus rung right behind the primary (LLM_USE_OPUS_FALLBACK): Opus 4.6 on Bedrock, Opus 4.7 direct
```
`LLM_USE_SONNET_5=true` makes Claude Sonnet 5, and `LLM_USE_SONNET_5_5=true` Claude Sonnet 5.5 (which wins if both are set), the primary rung on whichever chain is active, with Sonnet 4.6 behind it (default off; see "Server Toggles, Caches & Crons" below). `LLM_USE_OPUS_FALLBACK=true` adds Opus right behind the primary (default off: an account that IAM-denies Opus would only answer 403 on that rung). Each attempt has a 15 s timeout. Fall-through happens only on availability errors (429 / 404 / 5xx / connection errors, a 400 whose message says the model is invalid or inaccessible, or a 403 whose message names an IAM or model-access deny) and only while no text has been streamed; other 400s, 401 / 422 and a credential 403 (invalid or expired token, signature mismatch) are deterministic, so they end the chain with the apology tail instead. Ids and rules live in `bedrockChain()`, `anthropicChain()`, `buildChain()` and `isFallbackEligible()` in `src/lib/llm.ts`.

---

## 2. AWS Bedrock Credentials

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER` | No | `bedrock` | `bedrock` or `anthropic`; only the exact string `anthropic` selects the direct API, so a typo silently selects Bedrock. Switching is an env change, no code change. |
| `BEDROCK_ACCESS_KEY_ID` | Conditional | — | IAM key (raw or BASE64-encoded). |
| `BEDROCK_SECRET_ACCESS_KEY` | Conditional | — | IAM secret (raw or BASE64-encoded). |
| `BEDROCK_SESSION_TOKEN` | No | — | Only for temporary STS credentials. |
| `BEDROCK_REGION` | No | `us-east-1` | **Prefer this over `AWS_REGION`** — Vercel/Lambda corrupts the reserved `AWS_REGION` name (observed as `"s-east-1"`). |
| `AWS_REGION` | No | `us-east-1` | Fallback if `BEDROCK_REGION` unset. RESERVED on Vercel. |
| `NEXT_PUBLIC_LLM_SDK` | No | `anthropic-bedrock` | Build-time, **no runtime effect today**: `/api/chat` uses `@anthropic-ai/bedrock-sdk` on the Bedrock provider and `@anthropic-ai/sdk` for `LLM_PROVIDER=anthropic`, whatever this says (`getLlmSdkMode()` in `src/lib/llm-sdk-mode.ts` has no non-test consumer); `aws-sdk-bedrock` is reserved for an unshipped OTel follow-up. The value is only echoed as `llm_sdk` in the `[config]` startup log. |

**Polly + Transcribe** (optional voice upgrades, reuse existing Bedrock key — no new vars):

| Engine | Route | IAM action needed | Fallback |
|---|---|---|---|
| AWS Polly Neural TTS | `/api/tts` | `polly:SynthesizeSpeech` | Browser speechSynthesis |
| AWS Transcribe streaming STT | `/api/transcribe` | `transcribe:StartStreamTranscription` | Browser SpeechRecognition |

Both routes **fail closed** — without the IAM permission they answer 502 and the client falls back to free browser voice. The same key also backs the optional semantic FAQ tier (Titan embeddings, see "Server Toggles, Caches & Crons"), so one IAM identity covers Bedrock chat, Polly, Transcribe and Titan.

---

## 3. Rate Limiting — Upstash Redis

| Variable | Required | Default | Description |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | No | — | Upstash Redis **REST** endpoint (not `redis://`). If unset or malformed, the shared `redis` client is `null` and every Redis-backed feature turns off together and fails open: rate limiter (one CRITICAL warning at load in production), FAQ cache, telemetry Redis sink and dashboard data, visitor counter, cron result keys. |
| `UPSTASH_REDIS_REST_TOKEN` | No | — | Upstash REST token. Must be set alongside `_URL`. |

**Policy** (`src/lib/rate-limit.ts`): three independent sliding windows of **8 requests / 60 s per IP**, one per route class, so one class cannot starve another: `chat` → `/api/chat` (`anvilry:chat`), `voice` → `/api/tts`, `/api/tts-google`, `/api/transcribe` (`anvilry:voice`), `beacon` → `/api/error` (`anvilry:beacon`). A valid `Authorization: Bearer $CRON_SECRET` bypasses the limiter (the eval cron fires 12 sequential chats). Outside the classes: `/api/visit` has its own 1-per-30-min limiter (`anvilry:visit`), while `/api/mcp/[transport]`, `/api/github/stats` and the crons are not limited. **Fails OPEN** without Redis or on any limiter error. Limiter keys use the raw client IP; the `TELEMETRY_IP_SALT` hash applies to telemetry only.

---

## 4. Voice Engines

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_TTS_API_KEY` | No | — | Google Cloud TTS Chirp 3 HD — permanent 1M chars/mo free tier (hedges Polly's 12-month cliff). Without it `/api/tts-google` answers 503 and the client speaks the rest of the answer with browser speech (there is no Google → Polly hop in `use-speech-synthesis.ts`); nothing hides the Google voices from the picker. Create key at [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) with Cloud Text-to-Speech API enabled. |

---

## 5. Telemetry & Observability

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEMETRY_ENABLED` | No | `true` (on) | Set `"false"` to make `/api/error` answer 204 without emitting `client.error` (browser-beacon kill switch); any other value = on. It gates **nothing else**: `withTrace` spans, `llm.attempt` / `chat.cache` events and the Redis sink have no off switch (leave Upstash unset for log-only). |
| `TELEMETRY_IP_SALT` | No | — | Salt for the SHA-256 hash (16 hex chars) of IP and user-agent on telemetry spans. Without it `ipHash` / `uaHash` / `session_id` are `"anonymous"` and the dashboard Visitors tile shows "—". Rate-limit keys always use the raw IP. Generate: `openssl rand -base64 16`. |
| `ADMIN_PASSWORD` | No | — | HTTP Basic credential for `/admin/*` and `POST /api/admin/faq-cache/purge`. `src/proxy.ts` is the first filter (401 + `WWW-Authenticate`); the telemetry page re-checks and calls `notFound()`; the purge route calls `requireAdmin`. All three share `isAdminAuthorized` (`src/lib/admin-auth.ts`): the password is the whole credential (any username, or `:password`), compared in constant time. When unset everything behind it is locked out with a bare 401; there is no setup-instructions page. |

**Dual sink:** Vercel Runtime Logs (always) + Upstash Redis sorted sets `anvilry:trace:<kind>` (best-effort; the 7-day window is trimmed on roughly 1-in-20 emits, so old entries can linger and readers filter by score; the dashboard shows the last 24 h).

Trace replay: `node scripts/replay-trace.mjs <traceId>` (or `make trace TRACE_ID=…`). The trace ID is in the `x-anvilry-trace-id` response header of the five `withTrace` routes (`/api/chat`, `/api/tts`, `/api/tts-google`, `/api/transcribe`, `/api/error`); `chat.cache` events are not replayed. Event kinds, PII rules and the dashboard are documented in `TELEMETRY.md`.

---

## 6. GitHub Integration

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | No | — | GitHub PAT (`public_repo` scope, read-only). Raises rate limit from 60 to 5,000 req/hr. Used by `/api/github/stats` and `src/lib/github.ts` (13-repo `REPO_ALLOWLIST`). Without it everything still works unauthenticated, but allowlisted private repos 404 and are silently dropped, so star / fork / repo totals are lower; the stats strip hides only when followers and public repos both come back 0. |

---

## 7. Cron & Internal Routes

| Variable | Required | Default | Description |
|---|---|---|---|
| `CRON_SECRET` | Crons only | — | Bearer token required by **all five** `/api/cron/*` routes (`health-check`, `eval`, `github-sync`, `seo-audit`, `content-audit`): 401 when unset or wrong (fail-closed; constant-time compare in `src/lib/cron-auth.ts`). Define it yourself (`openssl rand -hex 32`); Vercel Cron then sends it as `Authorization: Bearer …`. It also lets the eval cron bypass the chat rate limiter. Schedules, bases and result keys: "Server Toggles, Caches & Crons" below. |

---

## 8. Feature Flags — Writing Sections

All `NEXT_PUBLIC_*` flags are **inlined at build time** by Next.js. Changing them requires a **redeploy**. Source of truth: `src/lib/writing-flags.ts`.

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_ARTICLES_ENABLED` | `true` (on) | Controls `/articles` route, nav link, sitemap, RSS feed. Any value except `"false"` = on. |
| `NEXT_PUBLIC_NOTES_ENABLED` | `false` | Ships notes dark; must be exactly `"true"` to enable. Off: `/notes` and `/notes/[slug]` 404 and the nav link is hidden. Applied at the data layer (`allNotes` in `src/lib/content.ts` is empty), so notes are also absent from the sitemap, RSS feed, `llms.txt`, MCP tools, chat corpus, `.md` handlers and audit crons, and articles whose only destination is a note (`linkedNote` with no `externalUrl`, or an own `/notes/` URL) are dropped too. |
| `NEXT_PUBLIC_STATS_ENABLED` | `false` | Shows `/stats` page in nav (aggregate open-source impact numbers). Enable when page content is populated. |
| `NEXT_PUBLIC_SEARCH_ENABLED` | `false` | Shows `/search` page in nav (Pagefind static full-text search). The index is rebuilt by every `pnpm build` (its last step is `pagefind`); `make search-index` only re-runs pagefind without a rebuild. |
| `NEXT_PUBLIC_TESTIMONIALS_ENABLED` | `false` | Shows the Recommendations section on the homepage. Enable when real LinkedIn recommendations are added to `src/lib/testimonials.ts`. |
| `NEXT_PUBLIC_INKFORGE_ARTICLES_ENABLED` | `false` | Shows inkforge-generated notes in the "Generated" section of `/articles`. Only manually published articles show by default. Also needs `NEXT_PUBLIC_NOTES_ENABLED=true`: the section is built from `allNotes`, which is empty while notes are dark. |

---

## 9. Feature Flags — Hiring Signals

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_OPEN_TO_WORK` | `false` | Shows a subtle green-pulse "Open to work" banner below the nav with Email + Calendly CTAs. Flip to `"true"` when actively job searching. |

---

## 10. Feature Flags — Homepage Sections

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_GITHUB_STATS_ENABLED` | `false` | Shows GitHub stats strip on homepage (followers, repos, stars, forks). Enable when numbers are worth showing. Works without `GITHUB_TOKEN` (lower totals, see §6); the strip hides itself when followers and public repos both come back 0. |

---

## 11. Feature Flags — Beast Mode

All default `false`. Set to `"true"` and redeploy to enable. The portfolio functions normally without these — they are visual/UX enhancements.

| Variable | Added | Description |
|---|---|---|
| `NEXT_PUBLIC_ORB_POSTPROCESSING` | v1.9 | Bloom + Vignette + Noise + ChromaticAberration + cursor Fluid on the 3D orb. High-tier devices only (≥4 GB RAM + ≥4 cores). |
| `NEXT_PUBLIC_INK_TRANSITION` | v1.9 | WebGL2 ink-bleed shader on view switches. Falls back to CSS crossfade when `prefers-reduced-motion` is on or View Transitions API unavailable. |
| `NEXT_PUBLIC_SKILL_TREE` | v1.9 | SVG RPG Skill Tree at the bottom of the Play view. |
| `NEXT_PUBLIC_404_ORB` | v2.0 | Distressed red/orange 3D orb above the 404 terminal. `WebGLBoundary` fallback to terminal-only when WebGL unavailable. |
| `NEXT_PUBLIC_VISITOR_COUNTER` | v2.0 | Shows an `"↑ N engineers visited"` badge in the site footer. Increments a Redis counter (`anvilry:visits:total`) on each page load, rate-limited to 1 increment per IP per 30 min via `@upstash/ratelimit`. Requires Upstash Redis. **Fallback:** when Redis is unavailable (quota exhausted, network error), the badge shows the last-known count from `localStorage["anvilry:visits:total"]`. If no cached value exists, the badge hides. |
| `NEXT_PUBLIC_RESUME_VARIANTS` | v3.1 | Reveals role-targeted PDF variants beyond the master on `/resume`, the `?view=resume` downloads, the command palette and the terminal `resume` command. **No visible effect today:** `resumeVariants` in `src/lib/profile.ts` has a single entry (the master "Sairam Resume"), so `"true"` shows the same one PDF. Add entries and PDFs under `public/resume/` before relying on it. Default OFF; redeploy required. |
| `NEXT_PUBLIC_HERO_MODE` | v3.3 | Switch the hero WebGL slot. `"graph"` (default) = knowledge-graph (current). `"avatar"` = cursor-reactive 3D avatar with procedural gaze and idle breathing (requires `/public/avatar/sairam.glb`). Redeploy required. |
| `NEXT_PUBLIC_AVATAR_POSITION` | v3.3 | Avatar layout position when `NEXT_PUBLIC_HERO_MODE=avatar`. `"hero-side"` (default) = right slot replacing graph. `"hero-split"` = two-column layout (text left, avatar right). `"hero-top"` = avatar centered above headline. Ignored when hero mode is `"graph"`. Redeploy required. |
| `NEXT_PUBLIC_DISCOVERY_BADGES` | v2.0 | "★ N/4 discovered" badge (bottom-right). localStorage-backed. 4 unlock triggers: view switch, chat question, terminal command, dossier open. Escape hatch: ⌘K → "Unlock all discoveries". The only flag that can be evaluated through the Vercel Flags SDK instead of the build-time env var — see §14 for exactly what that path does. |
| `NEXT_PUBLIC_VOICE_TEST_AUDIO` | v1.6 | Shows "🔊 Test audio" button in talk mode (dev/QA only). No backend required. |

---

## 12. Algorithm Config Flags

These control the **behaviour** of the data layer, not feature visibility. They change how the app processes data — not what it shows.

| Variable | Default | Values | Description |
|---|---|---|---|
| `NEXT_PUBLIC_ARTICLE_DEDUP_KEY` | `linkedNote` | `linkedNote` \| `canonicalUrl` | Primary key for the article dedup/grouping algorithm in `src/lib/article-grouping.ts`. `linkedNote` (default) — stable internal slug, survives URL changes. `canonicalUrl` — external canonical URL, better for external-only publishing pipelines. Both strategies always fall back to the other field — switching only changes which wins when an article has both fields set. |

**How the flag flows through the codebase:**

```
NEXT_PUBLIC_ARTICLE_DEDUP_KEY  ← env var (build-time)
  → ARTICLE_DEDUP_KEY           ← writing-flags.ts export
  → DEFAULT_CONFIG              ← article-grouping.ts module constant
  → groupArticles(articles)     ← app default (no override)
  → groupArticles(articles, { primaryKey: "canonicalUrl" })  ← explicit override (tests)
```

---

## 13. View & Voice UX Flags

| Variable | Default | Values | Description |
|---|---|---|---|
| `NEXT_PUBLIC_ENABLED_VIEWS` | (all on) | Comma-separated: `gamified`, `chat`, `developer`, `voice` | Which views appear in the switcher beyond Classic. Classic (the SSG/crawler default) and Resume are always on and cannot be disabled. Unset = all enabled. Empty string = Classic + Resume only. |
| `NEXT_PUBLIC_ANVIL_ORB_MODE` | `inplace` | `inplace` \| `modal` \| `off` | Header voice orb placement. `inplace` = expands in-place on desktop (mobile always modal). `modal` = always centred overlay. `off` = orb hidden (Voice view still works; the legacy `NEXT_PUBLIC_ENABLE_ANVIL_ORB="false"` also maps to `off`). |
| `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE` | `classic` | `classic` \| `core` | Orb chrome level. `classic` = full panel (orb + captions + chips + controls). `core` = minimal Siri mode (orb + frosted result card, auto-listens). Orthogonal to `ORB_MODE`. |
| `NEXT_PUBLIC_VOICE_PICKER_MODE` | `descriptor` | `descriptor` \| `gender` | Voice picker layout. `descriptor` = named cards ("Stephen — warm & direct"). `gender` = Male / Female / System columns. Both share the same catalog. |

**Orb mode matrix (desktop):**

| ORB_MODE | EXPERIENCE | Behaviour |
|---|---|---|
| `inplace` | `classic` | Full in-place panel — **default** |
| `inplace` | `core` | Orb-only + frosted result card |
| `modal` | (any) | Centred modal overlay |
| `off` | (any) | Orb hidden; Voice view still accessible |

Mobile (<768px) always falls back to centred modal regardless of mode.

---

## 14. Vercel Flags SDK

Only `NEXT_PUBLIC_DISCOVERY_BADGES` can be resolved through the Flags SDK (`src/lib/flags.ts`); every other flag is a plain build-time env read.

| Variable | Required | Default | Description |
|---|---|---|---|
| `FLAG_DRIVER` | No | `local` | Read once at process start. `local` = `NEXT_PUBLIC_DISCOVERY_BADGES === "true"` inlined at build (redeploy to change). `vercel` = resolved per request by the Flags SDK: a Vercel Toolbar / dashboard override cookie wins, otherwise the flag's `decide()` returns `false`, so the env var is **ignored** on this path and no stored dashboard value is read (no adapter is wired). Treat it as a per-browser override, not a global switch. |
| `FLAGS` | No | — | Flags SDK connection string. Only its presence is logged (`flags_sdk_configured` in `[config]`); nothing in `src/` reads its value. |
| `FLAGS_SECRET` | If `FLAG_DRIVER=vercel` | — | 32-byte base64url secret for signing override cookies. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Never commit. |

**Currently migrated:** `NEXT_PUBLIC_DISCOVERY_BADGES` only; all other flags remain build-time. `GET /.well-known/vercel/flags` advertises it to the dashboard and answers 401 without a valid `FLAGS_SECRET`-verified proof (with no secret set and an `Authorization` header present, the SDK throws, so expect a 500 rather than a 401).

---

## 15. Runtime Voice Settings (localStorage)

Stored under `anvilry:voice:settings`. Toggled via ⌘K → Voice group. No server config needed.

| Key | Default | Description |
|---|---|---|
| `micEnabled` | `false` | Show push-to-talk mic button in composer. |
| `ttsEnabled` | `false` | Allow "read aloud" per-answer + spoken talk-mode output. |
| `wakeWord` | `false` | Always-listening wake word: "hey anvil", "hey portfolio", "hey sairam" or "ask my portfolio". |
| `captions` | `true` | Live caption transcript in talk mode. |
| `sttEngine` | `browser` | `browser` (Web Speech API) or `transcribe` (AWS Transcribe). |
| `ttsEngine` | `browser` | `browser`, `polly` (AWS Polly Neural), or `google` (Google Cloud TTS — requires `GOOGLE_TTS_API_KEY`). |
| `voiceId` | `undefined` | Catalog ID of the user-picked voice (e.g. `polly-generative-stephen`). |
| `voiceCharacter.speed` | `natural` | `slow` \| `natural` \| `fast` — maps to `u.rate` 0.85–1.15 for browser; `<prosody rate>` for Polly Neural. |
| `voiceCharacter.tone` | `neutral` | `warm` \| `neutral` \| `crisp` — pitch bias. |
| `voiceCharacter.pause` | `normal` | `spacious` \| `normal` \| `tight` — inter-sentence pause. |

---

## 16. Auto-Provided by Vercel

Do not set these manually — Vercel injects them automatically. `CRON_SECRET` is **not** in this list: you define it (§7).

| Variable | Description |
|---|---|
| `VERCEL` | Truthy on Vercel builds and deployments only. Gates the CSP `upgrade-insecure-requests` directive in `next.config.ts` (local `next start` over HTTP would break under WebKit otherwise). |
| `VERCEL_URL` | Per-deployment host without `https://`; it can sit behind Vercel deployment protection. The **only** base for the `eval`, `seo-audit` and `github-sync` crons and for `/api/chat`'s live GitHub-stats fetch (`http://localhost:3000` when unset). The `health-check` cron uses `probeBase()` instead. |
| `VERCEL_PROJECT_PRODUCTION_URL` | Production alias host without `https://`. `probeBase()` (`src/lib/health-expectations.ts`) prefers it, then `VERCEL_URL`, then `http://localhost:3000`, so the health check probes the public alias rather than a protected deployment URL. |
| `VERCEL_ENV` | `production`, `preview`, or `development`. Logged in the startup config snapshot; on a production deploy the snapshot hook also stamps `anvilry:corpus:built_at` in Redis, which invalidates FAQ-cache entries written against an older corpus. |
| `VERCEL_REGION` | Compute region. Logged in the startup config snapshot (falls back to `AWS_REGION`, never `BEDROCK_REGION`). |
| `VERCEL_GIT_COMMIT_SHA` | Recorded as `release_id` in the `health-check` cron result. |

---

## 17. How to Add a New Flag

### Build-time feature flag (show/hide a section or feature)

**1. Export from `src/lib/writing-flags.ts`:**
```ts
/** One-line description of what this controls.
 *  Default: false — enable when <condition>. */
export const MY_FEATURE_ENABLED =
  process.env.NEXT_PUBLIC_MY_FEATURE_ENABLED === "true";
```

**2. Gate the component or page:**
```tsx
// In a Server Component (page.tsx / layout.tsx):
import { MY_FEATURE_ENABLED } from "@/lib/writing-flags";
if (!MY_FEATURE_ENABLED) return null; // or notFound()

// In a homepage section (app/page.tsx):
{MY_FEATURE_ENABLED && <MyFeatureSection />}
```

**3. Add to `.env.example`:**
```
# NEXT_PUBLIC_MY_FEATURE_ENABLED=true  # Short description (default off)
```

**4. Document in this file** under the appropriate section (§8–11).

---

### Server-side secret (API key, token, password)

**1. Read in the API route:**
```ts
const myKey = process.env.MY_API_KEY;
if (!myKey) return Response.json({ error: "not configured" }, { status: 503 });
```

**2. Add to `.env.example`:**
```
# MY_API_KEY=your-key-here   # Description. Get one at https://...
```

**3. Add to Vercel Project Settings → Environment Variables** for production. Never commit the actual value.

**4. Document in this file** under the appropriate category (§1–7).

---

### Algorithm config flag (controls behaviour, not visibility)

**1. Add the type + export to `src/lib/writing-flags.ts`:**
```ts
export type MyAlgoStrategy = "option-a" | "option-b";
const rawMyFlag = process.env.NEXT_PUBLIC_MY_ALGO_FLAG;
export const MY_ALGO_FLAG: MyAlgoStrategy =
  rawMyFlag === "option-b" ? "option-b" : "option-a";
```

**2. Accept as an optional config param in the algorithm:**
```ts
// src/lib/my-algorithm.ts
import { MY_ALGO_FLAG } from "@/lib/writing-flags";
export interface MyAlgoConfig { strategy: MyAlgoStrategy; }
const DEFAULT_CONFIG: MyAlgoConfig = { strategy: MY_ALGO_FLAG };
export function runAlgo(data: Data[], config = DEFAULT_CONFIG) { ... }
```

**3. Document in this file** under §12 (Algorithm Config Flags).

---

## Server Toggles, Caches & Crons

Server-side switches, the FAQ response cache, the cron schedule and the build-time toggles that §1–§16 do not cover.

### LLM tunables

| Variable | Default | Description |
|---|---|---|
| `LLM_USE_SONNET_5` | off | Exactly `"true"` makes Claude Sonnet 5 the **primary** rung (`us.anthropic.claude-sonnet-5` on Bedrock, `claude-sonnet-5` direct), with Sonnet 4.6 behind it. The profile must be enabled and allowed by IAM (`DEPLOY.md` §7, "Extra IAM by feature"). Cost telemetry prices it from the AWS list price in `src/lib/llm-pricing.ts`; the direct-Anthropic ids have no price row, so those events carry no `cost_usd`. |
| `LLM_USE_SONNET_5_5` | off | Exactly `"true"` makes Claude Sonnet 5.5 the **primary** rung, with Sonnet 4.6 behind it, and wins over `LLM_USE_SONNET_5`. On Bedrock that is the **global** profile `global.anthropic.claude-sonnet-5-5` (there is no `us.` profile), so requests may be processed outside the US regions and the IAM policy must allow the profile (`DEPLOY.md` §7, "Extra IAM by feature"); direct API: `claude-sonnet-5-5` (unverified on that path). 5.5 rejects `thinking: {type: "disabled"}`, so `llm.ts` sends `between_tools` when extended thinking is off. It is priced at the Global rate in `src/lib/llm-pricing.ts`. |
| `LLM_USE_OPUS_FALLBACK` | off | Exactly `"true"` adds Opus (`us.anthropic.claude-opus-4-6-v1` on Bedrock, `claude-opus-4-7` direct) right behind the primary. Off by default: the reference account IAM-denies the whole Opus family, so with the rung on every fallback would first spend a round trip on a 403 (visible as `attrs.status` 403 in `llm.attempt`). |
| `LLM_THINKING_EFFORT` | unset | `"low"` or `"medium"` (exact, lower case) overrides the reasoning effort on every thinking-capable rung; anything else, `"high"` included, is ignored (the `max_tokens` floor shared by reasoning and answer, 2048 or 4096 on Sonnet 5.x, was sized for low and medium; no effect while `EXTENDED_THINKING` is `"false"`). Unset → `medium` on Sonnet 5.x, which at `low` did not reason on any of 8 measured questions and so left the reasoning panel empty, and `low` on every other rung. Sonnet 5.x also sends `display: "summarized"`, without which its thinking block has no text. |
| `EXTENDED_THINKING` | on | Server switch read per request by `/api/chat`: anything but exactly `"false"` calls non-Haiku models with adaptive thinking (effort `medium` on Sonnet 5.x, `low` elsewhere, see `LLM_THINKING_EFFORT` above; `max_tokens` raised to at least 2048, or 4096 on Sonnet 5.x). `"false"` sends an explicit `thinking: {type: "disabled"}` (`between_tools` on the Sonnet 5.5 rung, which rejects `disabled`), never an omitted field, because `src/lib/llm.ts` notes that Sonnet 5 thinks by default when the field is absent. |
| `NEXT_PUBLIC_EXTENDED_THINKING` | on | Build-time, UI only (`chat-messages.tsx`): `"false"` hides the reasoning disclosure. Independent of `EXTENDED_THINKING`, so the two can disagree; set both to switch reasoning off end to end. |

### FAQ response cache

Repeat first-turn questions are answered from Redis with zero Bedrock spend (`src/lib/chat-cache.ts`). A request is eligible when it is a single message with string content and carries no `x-chat-skip-cache` header (presence is enough, any value, no auth, so anyone can bypass the cache, though the rate limiter still applies; the eval cron sends it). A hit skips the model and the live GitHub-stats fetch, returns the stored answer plus a trace frame with `cacheHit: true` and the header `X-Chat-Cache: hit`, and every eligible request emits a `chat.cache` telemetry event (`outcome`, `tier`, and on a hit `saved_usd` and, for the semantic tier, `similarity`).

| Variable | Default | Description |
|---|---|---|
| `FAQ_CACHE_ENABLED` | on | Kill switch for both tiers (anything but exactly `"false"` is on), independent of the rest of Redis. Also a plain miss when Redis is unset or erroring. |
| `FAQ_CACHE_SEMANTIC_MATCH` | off | Exactly `"true"` adds a second tier: the normalized question is embedded with Bedrock Titan Text Embeddings V2 (`amazon.titan-embed-text-v2:0`, 512 dimensions, 5 s timeout, the same `BEDROCK_*` credentials) and matched by cosine similarity ≥ 0.92 against an index capped at 500 entries. Costs one extra `InvokeModel` per exact-tier miss, plus one more when the clean answer is written through, and sends the question text to Bedrock. The IAM policy needs `bedrock:InvokeModel` on the Titan model (`DEPLOY.md` §7, "Extra IAM by feature"); on any failure the tier silently misses. |

Storage: `anvilry:chat:cache:<sha256 of the normalized question>` with a 24 h TTL (`FAQ_CACHE_TTL_SECONDS`) and an index at `anvilry:chat:cache:index`. Only a clean `end_turn` answer of 1–4,000 characters is written (control bytes stripped), and only when the primary model produced it: an answer served by a fallback rung is streamed but never cached, so a transient outage is not replayed for 24 h. Each entry is tagged with `anvilry:corpus:built_at`, which a production deploy re-stamps, so a corpus change turns older answers into misses (both tags null, as in local dev, counts as a match). The index trim runs on roughly 1-in-20 writes. Cache-layer errors are emitted as `server.error` with `attrs.source = "chat-cache"`.

**Purge a bad entry:** `curl -u :$ADMIN_PASSWORD -X POST https://<host>/api/admin/faq-cache/purge -H 'Content-Type: application/json' -d '{"question":"What is Pensieve?"}'`. The route (`maxDuration` 10, body ≤ 4 KB, question ≤ 2,000 characters) calls `requireAdmin`, is deliberately not rate-limited, sits outside the proxy matcher (`/admin/:path*`), and answers `purged` or `not_found` (both 200) or 503 when Redis is unavailable. It exists because the write gate checks completion cleanliness, not content safety.

### Cron routes

All five are `GET` handlers (eval also accepts `POST`) that need `Authorization: Bearer $CRON_SECRET`; Vercel Cron sends it once `CRON_SECRET` is set (§7). Schedules are UTC (`vercel.json`). Each writes a JSON result to Redis for the `/admin/telemetry` tiles (skipped without Redis).

| Route | Schedule | `maxDuration` | Base URL | Result key (TTL) | What it does |
|---|---|---|---|---|---|
| `/api/cron/health-check` | `0 5 * * *` | 25 s | `probeBase()` | `anvilry:health:latest` (25 h) | 13 parallel probes with redirects not followed (an SSO redirect fails the check); sets `anvilry:health:alert:active` only on a pass → fail transition |
| `/api/cron/eval` | `0 9 * * 1` | 60 s | `VERCEL_URL` | `anvilry:eval:latest` (8 d) | 12 sequential golden questions to `/api/chat` with `X-Chat-Skip-Cache: 1` and the cron bearer (limiter bypass), 25 s timeout each; the result is written only after the last question, so a run cut off by `maxDuration` stores nothing |
| `/api/cron/github-sync` | `0 8 * * *` | 30 s | `VERCEL_URL` | `anvilry:github:stats:latest` (90 min) | Snapshots `/api/github/stats` for the dashboard |
| `/api/cron/seo-audit` | `0 6 * * 1` | 60 s | `VERCEL_URL` | `anvilry:seo:audit:latest` (7 d) | GETs `/sitemap.xml`, `/llms.txt`, `/robots.txt`, `/feed.xml`; counts content items with an empty summary |
| `/api/cron/content-audit` | `0 7 * * 1` | 60 s | none (in-process) | `anvilry:content:audit:latest` (7 d) | Flags articles and notes dated more than 18 × 30 days ago |

### Other build-time toggles

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_CHROME_TTS_BANNER` | off | `"true"` re-enables the Chrome TTS compatibility banner in talk mode. Off by default because `src/lib/writing-flags.ts` records the Chrome TTS-daemon bug it warned about as fixed in recent Chrome; flip it on if the bug resurfaces. |
| `NEXT_PUBLIC_GRAPH_PHYSICS` | off | `"true"` loads the drifting `scene-physics.tsx` hero-graph variant instead of the static scene. The name is historical: it is plain sinusoidal motion, not a physics engine. |
| `NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS` | off | `"true"` shows the attachment picker in the chat composer (up to 3 images, 2 MB each). |
| `NEXT_PUBLIC_PDF_ATTACHMENTS` | off | `"true"` also lets that picker take PDFs (text is extracted client-side, 10 MB cap). Only matters when the multimodal flag is on. |
| `NEXT_PUBLIC_ENABLE_ANVIL_ORB` | on | Legacy: `"false"` maps the header orb to `off` unless `NEXT_PUBLIC_ANVIL_ORB_MODE` is `modal` or `off` (§13). |
| `NEXT_PUBLIC_BUILD_YEAR` | set by the build | Not an operator setting: `next.config.ts` inlines the current year at build time so the footer year is stable under Cache Components. |

---

## Security Headers — Per-Route CSP Overrides

`next.config.ts` builds one CSP string and a `securityHeaders` array of seven headers (X-Frame-Options `DENY`, X-Content-Type-Options, Referrer-Policy, COOP and CORP `same-origin`, Permissions-Policy, and the CSP) applied to every route (`source: "/:path*"`). The CSP is **enforced** (`Content-Security-Policy`, not Report-Only; it shipped Report-Only in v1.4.0 and was promoted later). `frame-ancestors 'none'` plus `X-Frame-Options: DENY` are the clickjacking defense; `upgrade-insecure-requests` is appended only when `VERCEL` is set; `script-src` keeps `'unsafe-inline'` and `'unsafe-eval'` because MDX bodies are evaluated with `new Function` in the browser.

**Per-route CSP overrides:** `async headers()` re-emits the same array for `/resume` and `/resume/:path*` with `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'` so the PDF iframe on the résumé page can load. All other routes keep `frame-ancestors 'none'`.

---

## Quick-Reference: What to Set Per Environment

| Variable | Local dev | Vercel Production |
|---|---|---|
| `BEDROCK_ACCESS_KEY_ID` | `.env.local` | Project settings |
| `BEDROCK_SECRET_ACCESS_KEY` | `.env.local` | Project settings |
| `UPSTASH_REDIS_REST_URL` | `.env.local` (optional) | Project settings |
| `UPSTASH_REDIS_REST_TOKEN` | `.env.local` (optional) | Project settings |
| `GITHUB_TOKEN` | `.env.local` (optional) | Project settings |
| `GOOGLE_TTS_API_KEY` | `.env.local` (optional) | Project settings |
| `ADMIN_PASSWORD` | `.env.local` (optional) | Project settings |
| `TELEMETRY_IP_SALT` | `.env.local` (optional) | Project settings |
| `CRON_SECRET` | `.env.local` (optional; crons are not run locally) | Project settings — **required**, or all five crons return 401 |
| `LLM_USE_SONNET_5`, `LLM_USE_SONNET_5_5`, `LLM_USE_OPUS_FALLBACK`, `LLM_THINKING_EFFORT`, `FAQ_CACHE_ENABLED`, `FAQ_CACHE_SEMANTIC_MATCH`, `EXTENDED_THINKING` | `.env.local` (optional) | Project settings (optional server toggles; read per request, but a changed value only reaches new deployments) |
| `NEXT_PUBLIC_OPEN_TO_WORK` | `.env.local` | Project settings |
| All other `NEXT_PUBLIC_*` | `.env.local` for local testing | Project settings |

> **Rule:** secrets go in Vercel Project Settings — never committed to git. Only `.env.example` is committed; it contains no real values.

---

## Files That Read Environment Variables

Checked against `src/`, `next.config.ts`, `scripts/` and `playwright.config.ts` with `grep -rn "process\.env\." src` (plus the `const env = process.env` alias in `src/instrumentation.ts`). Re-run it rather than trusting this list.

| File | Variables Read |
|---|---|
| `src/lib/llm.ts` | `LLM_PROVIDER`, `LLM_USE_SONNET_5`, `LLM_USE_SONNET_5_5`, `LLM_USE_OPUS_FALLBACK`, `LLM_THINKING_EFFORT`, `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`, `BEDROCK_SESSION_TOKEN`, `BEDROCK_REGION`, `AWS_REGION`, `ANTHROPIC_API_KEY` |
| `src/lib/writing-flags.ts` | The `NEXT_PUBLIC_*` writing, hiring, homepage and algorithm flags (§8–10, §12) plus `NEXT_PUBLIC_CHROME_TTS_BANNER` |
| `src/lib/flags.ts` | `FLAG_DRIVER`, `NEXT_PUBLIC_DISCOVERY_BADGES`, `FLAGS_SECRET` (presence log only; the Flags SDK reads the secret itself) |
| `src/lib/enabled-views.ts` | `NEXT_PUBLIC_ENABLED_VIEWS` |
| `src/lib/voice-picker-mode.ts` | `NEXT_PUBLIC_VOICE_PICKER_MODE` |
| `src/lib/llm-sdk-mode.ts` | `NEXT_PUBLIC_LLM_SDK` (no runtime consumer) |
| `src/lib/redis.ts` | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (the one shared client; everything else imports it) |
| `src/lib/rate-limit.ts` | `NODE_ENV` (production warning); `CRON_SECRET` indirectly via `cron-auth.ts` |
| `src/lib/cron-auth.ts` | `CRON_SECRET` |
| `src/lib/admin-auth.ts` | `ADMIN_PASSWORD` (shared by `src/proxy.ts`, the telemetry page and `requireAdmin`) |
| `src/lib/chat-cache.ts` | `FAQ_CACHE_ENABLED`, `FAQ_CACHE_SEMANTIC_MATCH` |
| `src/lib/github.ts`, `src/app/api/github/stats/route.ts` | `GITHUB_TOKEN` |
| `src/lib/health-expectations.ts` | `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL` |
| `src/lib/telemetry/with-trace.ts` | `TELEMETRY_IP_SALT` |
| `src/instrumentation.ts` | Presence-only `[config]` startup snapshot of most variables above; also `VERCEL_ENV`, `VERCEL_REGION`, `NEXT_RUNTIME`, `NODE_ENV`, `FLAGS` |
| `src/app/api/chat/route.ts` | `EXTENDED_THINKING`, `VERCEL_URL` |
| `src/app/api/tts-google/route.ts` | `GOOGLE_TTS_API_KEY` |
| `src/app/api/error/route.ts` | `TELEMETRY_ENABLED` |
| `src/app/api/cron/{eval,github-sync,seo-audit}/route.ts` | `VERCEL_URL` (eval also forwards `CRON_SECRET` to `/api/chat`) |
| `src/app/api/cron/health-check/route.ts` | `VERCEL_GIT_COMMIT_SHA` (base URL via `probeBase()`) |
| `src/components/chat/header-orb-trigger.tsx` | `NEXT_PUBLIC_ANVIL_ORB_MODE`, `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE`, `NEXT_PUBLIC_ENABLE_ANVIL_ORB` |
| `src/components/chat/voice-orb-3d.tsx` | `NEXT_PUBLIC_ORB_POSTPROCESSING` |
| `src/components/chat/talk-mode.tsx` | `NEXT_PUBLIC_VOICE_TEST_AUDIO` |
| `src/components/chat/chat-messages.tsx` | `NEXT_PUBLIC_EXTENDED_THINKING` |
| `src/components/chat/chat-view.tsx`, `src/components/chat/file-picker-button.tsx` | `NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS`, `NEXT_PUBLIC_PDF_ATTACHMENTS` |
| `src/components/site-footer.tsx` | `NEXT_PUBLIC_VISITOR_COUNTER`, `NEXT_PUBLIC_BUILD_YEAR` |
| `src/components/game/game-view.tsx` | `NEXT_PUBLIC_SKILL_TREE` |
| `src/components/view-context.tsx` | `NEXT_PUBLIC_INK_TRANSITION` |
| `src/components/hero-avatar/index.tsx`, `src/components/home/hero.tsx` | `NEXT_PUBLIC_HERO_MODE`, `NEXT_PUBLIC_AVATAR_POSITION` (avatar only) |
| `src/components/hero-graph/index.tsx` | `NEXT_PUBLIC_GRAPH_PHYSICS` |
| `src/app/resume/page.tsx`, `src/components/home/resume-view.tsx`, `src/components/command-palette-content.tsx`, `src/components/game/terminal/commands.ts` | `NEXT_PUBLIC_RESUME_VARIANTS` |
| `src/app/not-found.tsx` | `NEXT_PUBLIC_404_ORB` |
| `next.config.ts` | `VERCEL`, `ANALYZE`, `VELITE_STARTED` (internal dev guard); sets `NEXT_PUBLIC_BUILD_YEAR` |
| `scripts/replay-trace.mjs`, `playwright.config.ts` | `UPSTASH_REDIS_REST_URL` / `_TOKEN`; `CI` |
