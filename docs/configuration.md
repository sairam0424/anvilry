# Configuration Reference — Anvilry

Single source of truth for every environment variable, feature flag, and build-time
config in the portfolio. `.env.example` in the project root is the copy-paste companion
for local dev setup.

**Quick start:** `cp .env.example .env.local` → fill in the required secrets → `pnpm dev`.

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
Sonnet 4.6 (primary) → Opus 4.6 (deeper reasoning) → Haiku 4.5 (fallback)
```
Auto-falls-through on `400 "model identifier is invalid"` or access-denied.

---

## 2. AWS Bedrock Credentials

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_PROVIDER` | No | `bedrock` | `bedrock` or `anthropic`. Switching is an env change, no code change. |
| `BEDROCK_ACCESS_KEY_ID` | Conditional | — | IAM key (raw or BASE64-encoded). |
| `BEDROCK_SECRET_ACCESS_KEY` | Conditional | — | IAM secret (raw or BASE64-encoded). |
| `BEDROCK_SESSION_TOKEN` | No | — | Only for temporary STS credentials. |
| `BEDROCK_REGION` | No | `us-east-1` | **Prefer this over `AWS_REGION`** — Vercel/Lambda corrupts the reserved `AWS_REGION` name (observed as `"s-east-1"`). |
| `AWS_REGION` | No | `us-east-1` | Fallback if `BEDROCK_REGION` unset. RESERVED on Vercel. |
| `NEXT_PUBLIC_LLM_SDK` | No | `anthropic-bedrock` | Build-time. SDK for `/api/chat`: `anthropic-bedrock` (default) or `aws-sdk-bedrock` (reserved for v1.8.x OTel). Requires redeploy. |

**Polly + Transcribe** (optional voice upgrades, reuse existing Bedrock key — no new vars):

| Engine | Route | IAM action needed | Fallback |
|---|---|---|---|
| AWS Polly Neural TTS | `/api/tts` | `polly:SynthesizeSpeech` | Browser speechSynthesis |
| AWS Transcribe streaming STT | `/api/transcribe` | `transcribe:StartStreamTranscription` | Browser SpeechRecognition |

Both routes **fail closed** — without the IAM permission they return 4xx and the client falls back to free browser voice.

---

## 3. Rate Limiting — Upstash Redis

| Variable | Required | Default | Description |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` | No | — | Upstash Redis endpoint. If unset, rate limiter is a no-op (loud warning in prod). |
| `UPSTASH_REDIS_REST_TOKEN` | No | — | Upstash REST token. Must be set alongside `_URL`. |

**Policy:** 8 req/min per IP on `/api/chat`, `/api/tts`, `/api/transcribe`. Fails OPEN without these. Also used by the telemetry sink and visitor counter.

---

## 4. Voice Engines

| Variable | Required | Default | Description |
|---|---|---|---|
| `GOOGLE_TTS_API_KEY` | No | — | Google Cloud TTS Chirp 3 HD — permanent 1M chars/mo free tier (hedges Polly's 12-month cliff). Without it, Google voices are hidden from the picker. Route fails closed → Polly → browser. Create key at [console.cloud.google.com](https://console.cloud.google.com/apis/credentials) with Cloud Text-to-Speech API enabled. |

---

## 5. Telemetry & Observability

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEMETRY_ENABLED` | No | `true` (on) | Set `"false"` to disable all event emission. Any other value = on. |
| `TELEMETRY_IP_SALT` | No | — | Salt for SHA-256 IP hashing. Without it IPs stored as `"anonymous"`. Generate: `openssl rand -base64 16`. |
| `ADMIN_PASSWORD` | No | — | HTTP Basic Auth for `/admin/telemetry` dashboard. When unset the page shows setup instructions. |

**Dual sink:** Vercel Runtime Logs (always) + Upstash Redis sorted sets (7-day retention, best-effort).

Trace replay: `node scripts/replay-trace.mjs <traceId>` — the trace ID is in the `x-anvilry-trace-id` response header on every `/api/*` response.

---

## 6. GitHub Integration

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | No | — | GitHub PAT (`public_repo` scope, read-only). Raises rate limit from 60 to 5,000 req/hr. Used by `/api/github/stats` and `src/lib/github.ts`. Without it, the GitHub stats strip hides automatically (shows zeros otherwise). |

---

## 7. Cron & Internal Routes

| Variable | Required | Default | Description |
|---|---|---|---|
| `CRON_SECRET` | No | — | Bearer token for `/api/cron/eval`. Vercel sets this automatically when a cron schedule is configured. Returns 401 without it. |

---

## 8. Feature Flags — Writing Sections

All `NEXT_PUBLIC_*` flags are **inlined at build time** by Next.js. Changing them requires a **redeploy**. Source of truth: `src/lib/writing-flags.ts`.

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_ARTICLES_ENABLED` | `true` (on) | Controls `/articles` route, nav link, sitemap, RSS feed. Any value except `"false"` = on. |
| `NEXT_PUBLIC_NOTES_ENABLED` | `false` | Controls `/notes` route, nav link, sitemap, RSS feed. Must explicitly set to `"true"`. |
| `NEXT_PUBLIC_STATS_ENABLED` | `false` | Shows `/stats` page in nav (aggregate open-source impact numbers). Enable when page content is populated. |
| `NEXT_PUBLIC_SEARCH_ENABLED` | `false` | Shows `/search` page in nav (Pagefind static full-text search). Run `make search-index` after each production build to regenerate the search index. |
| `NEXT_PUBLIC_TESTIMONIALS_ENABLED` | `false` | Shows the Recommendations section on the homepage. Enable when real LinkedIn recommendations are added to `src/lib/testimonials.ts`. |
| `NEXT_PUBLIC_INKFORGE_ARTICLES_ENABLED` | `false` | Shows inkforge-generated notes in the "Generated" section of `/articles`. Only manually published articles show by default. |

---

## 9. Feature Flags — Hiring Signals

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_OPEN_TO_WORK` | `false` | Shows a subtle green-pulse "Open to work" banner below the nav with Email + Calendly CTAs. Flip to `"true"` when actively job searching. |

---

## 10. Feature Flags — Homepage Sections

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_GITHUB_STATS_ENABLED` | `false` | Shows GitHub stats strip on homepage (followers, repos, stars, forks). Enable when numbers are worth showing. Requires `GITHUB_TOKEN` for real data; hides automatically on zero/no-token. |

---

## 11. Feature Flags — Beast Mode

All default `false`. Set to `"true"` and redeploy to enable. The portfolio functions normally without these — they are visual/UX enhancements.

| Variable | Added | Description |
|---|---|---|
| `NEXT_PUBLIC_ORB_POSTPROCESSING` | v1.9 | Bloom + Vignette + Noise + ChromaticAberration + cursor Fluid on the 3D orb. High-tier devices only (≥4 GB RAM + ≥4 cores). |
| `NEXT_PUBLIC_INK_TRANSITION` | v1.9 | WebGL2 ink-bleed shader on view switches. Falls back to CSS crossfade when `prefers-reduced-motion` is on or View Transitions API unavailable. |
| `NEXT_PUBLIC_SKILL_TREE` | v1.9 | SVG RPG Skill Tree at the bottom of the Play view. |
| `NEXT_PUBLIC_404_ORB` | v2.0 | Distressed red/orange 3D orb above the 404 terminal. `WebGLBoundary` fallback to terminal-only when WebGL unavailable. |
| `NEXT_PUBLIC_VISITOR_COUNTER` | v2.0 | "↑ N engineers visited" badge in footer. Requires `UPSTASH_REDIS_REST_URL` + `_TOKEN`. Rate-limited to 1 increment per IP per 30 min. |
| `NEXT_PUBLIC_DISCOVERY_BADGES` | v2.0 | "★ N/5 discovered" badge (bottom-right). localStorage-backed. 5 unlock triggers: view switch, chat question, terminal command, Konami, dossier open. Escape hatch: ⌘K → "Unlock all discoveries". **Can also be toggled at runtime** via Vercel Flags SDK — see §14. |
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
| `NEXT_PUBLIC_ENABLED_VIEWS` | (all on) | Comma-separated: `gamified`, `chat`, `developer`, `voice` | Which views appear in the switcher beyond Classic. Classic is always on (non-disableable — SSG/crawler default). Unset = all enabled. Empty string = Classic-only. |
| `NEXT_PUBLIC_ANVIL_ORB_MODE` | `inplace` | `inplace` \| `modal` \| `off` | Header voice orb placement. `inplace` = expands in-place on desktop (mobile always modal). `modal` = always centred overlay. `off` = orb hidden (Voice view still works). |
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

Allows toggling `NEXT_PUBLIC_DISCOVERY_BADGES` at runtime without redeploy.

| Variable | Required | Default | Description |
|---|---|---|---|
| `FLAG_DRIVER` | No | `local` | `local` = build-time (requires redeploy). `vercel` = Flags SDK (instant toggle from Vercel dashboard). |
| `FLAGS` | If `FLAG_DRIVER=vercel` | — | SDK connection string (auto-set by Vercel when Flags is enabled in project settings). |
| `FLAGS_SECRET` | If `FLAG_DRIVER=vercel` | — | 32-byte base64url secret for signing override cookies. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Never commit. |

**Currently migrated to runtime:** `NEXT_PUBLIC_DISCOVERY_BADGES` only. All other flags remain build-time.

---

## 15. Runtime Voice Settings (localStorage)

Stored under `anvilry:voice:settings`. Toggled via ⌘K → Voice group. No server config needed.

| Key | Default | Description |
|---|---|---|
| `micEnabled` | `false` | Show push-to-talk mic button in composer. |
| `ttsEnabled` | `false` | Allow "read aloud" per-answer + spoken talk-mode output. |
| `wakeWord` | `false` | Always-listening wake word ("Hey Anvil"). |
| `captions` | `true` | Live caption transcript in talk mode. |
| `sttEngine` | `browser` | `browser` (Web Speech API) or `transcribe` (AWS Transcribe). |
| `ttsEngine` | `browser` | `browser`, `polly` (AWS Polly Neural), or `google` (Google Cloud TTS — requires `GOOGLE_TTS_API_KEY`). |
| `voiceId` | `undefined` | Catalog ID of the user-picked voice (e.g. `polly-generative-stephen`). |
| `voiceCharacter.speed` | `natural` | `slow` \| `natural` \| `fast` — maps to `u.rate` 0.85–1.15 for browser; `<prosody rate>` for Polly Neural. |
| `voiceCharacter.tone` | `neutral` | `warm` \| `neutral` \| `crisp` — pitch bias. |
| `voiceCharacter.pause` | `normal` | `spacious` \| `normal` \| `tight` — inter-sentence pause. |

---

## 16. Auto-Provided by Vercel

Do not set these manually — Vercel injects them automatically.

| Variable | Description |
|---|---|
| `VERCEL_URL` | Deployment URL without `https://`. Used as base URL fallback in cron evals. |
| `VERCEL_ENV` | `production`, `preview`, or `development`. Logged in startup config snapshot. |
| `VERCEL_REGION` | Compute region. Logged in startup config snapshot. |
| `CRON_SECRET` | Set by Vercel when a cron schedule is configured in `vercel.json`. |

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
| `NEXT_PUBLIC_OPEN_TO_WORK` | `.env.local` | Project settings |
| All other `NEXT_PUBLIC_*` | `.env.local` for local testing | Project settings |

> **Rule:** secrets go in Vercel Project Settings — never committed to git. Only `.env.example` is committed; it contains no real values.

---

## Files That Read Environment Variables

| File | Variables Read |
|---|---|
| `src/lib/llm.ts` | `LLM_PROVIDER`, `BEDROCK_*`, `AWS_REGION`, `ANTHROPIC_API_KEY` |
| `src/lib/writing-flags.ts` | All `NEXT_PUBLIC_*` writing / hiring / beast / algorithm flags |
| `src/lib/flags.ts` | `FLAG_DRIVER`, `NEXT_PUBLIC_DISCOVERY_BADGES`, `FLAGS_SECRET` |
| `src/lib/enabled-views.ts` | `NEXT_PUBLIC_ENABLED_VIEWS` |
| `src/lib/rate-limit.ts` | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `NODE_ENV` |
| `src/lib/redis.ts` | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| `src/lib/telemetry/with-trace.ts` | `TELEMETRY_IP_SALT` |
| `src/lib/admin-auth.ts` | `ADMIN_PASSWORD` |
| `src/instrumentation.ts` | All (startup config snapshot log) |
| `src/app/api/github/stats/route.ts` | `GITHUB_TOKEN` |
| `src/app/api/tts-google/route.ts` | `GOOGLE_TTS_API_KEY` |
| `src/app/api/error/route.ts` | `TELEMETRY_ENABLED` |
| `src/app/api/cron/eval/route.ts` | `CRON_SECRET`, `VERCEL_URL` |
| `src/components/chat/header-orb-trigger.tsx` | `NEXT_PUBLIC_ANVIL_ORB_MODE`, `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE` |
| `src/components/chat/voice-orb-3d.tsx` | `NEXT_PUBLIC_ORB_POSTPROCESSING` |
| `src/components/chat/talk-mode.tsx` | `NEXT_PUBLIC_VOICE_TEST_AUDIO` |
| `src/components/site-footer.tsx` | `NEXT_PUBLIC_VISITOR_COUNTER` |
| `src/components/game/game-view.tsx` | `NEXT_PUBLIC_SKILL_TREE` |
| `src/app/not-found.tsx` | `NEXT_PUBLIC_404_ORB` |
| `next.config.ts` | `VELITE_STARTED` (internal dev guard) |
