# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **AGENTS.md warning applies here.** This is Next.js 16 — APIs, file conventions, and RSC behaviour differ from training data. Before writing any Next.js code, check `node_modules/next/dist/docs/` for the authoritative reference on whatever you are touching.

---

## Commands

```bash
# Development
pnpm install
pnpm dev                   # starts Velite watch + Next.js dev @ localhost:3000

# Build (Velite + tests + Next.js, in that order)
pnpm build

# Testing
pnpm test                  # vitest run once
pnpm test:watch            # vitest interactive watch mode
npx vitest run src/lib/llm.test.ts          # single file
npx vitest run -t "corpus"                  # single test by name

# Lint
pnpm lint                  # eslint (flat config, no --fix by default)

# Content regeneration (when MDX changes aren't picked up by watch)
pnpm content               # velite --clean

# After build: generate Pagefind search index
pnpm search-index

# Cache wipe (all build artifacts)
pnpm clean

# Makefile convenience wrappers
make dev / make build / make test / make lint
make new-work SLUG=my-case-study     # scaffold work MDX
make new-project SLUG=my-oss-repo    # scaffold project MDX
make new-note SLUG=my-note           # scaffold note MDX
make new-article SLUG=my-post        # scaffold article MDX
make health                          # smoke-test /api/chat locally
make trace TRACE_ID=abc123           # replay a request from Redis telemetry
make deploy-prod                     # vercel deploy --prod
```

---

## Architecture Overview

### The Four-View System

The entire site is one Next.js App Router app that presents four client-side switchable experiences from the same URL (`/`):

| View | Description |
|---|---|
| `classic` | SSG-rendered, SEO default — what crawlers and first-paint serve |
| `gamified` | 3D WebGL graph explorer (React Three Fiber, lazy-imported) |
| `chat` | AI chatbot grounded on the MDX content corpus |
| `developer` | Keyboard-driven terminal with ~16 commands |

View state is managed via a **module-level external store** (`src/components/view-context.tsx`) using `useSyncExternalStore`. State lives outside React so it can be read synchronously on first render (prevents Classic→other flash on deep-linked `?view=` URLs). The server and first-client snapshot always return `classic` — SSR is always Classic for crawlers; the deep-link applies post-hydration via `<ViewQuerySync>`.

View switches reflect in `?view=` query params (no localStorage/cookie persistence — first load is always Classic by owner design).

### Content Layer

All content (work case studies, OSS projects, notes, articles) lives in `content/` as MDX files. **Velite** processes them at build time into typed TypeScript collections in `.velite/`. The access layer is `src/lib/content.ts`.

```
content/{work,projects,notes,articles}/*.mdx
  → velite (Zod-validated schemas)
  → .velite/ (TypeScript + JSON)
  → src/lib/content.ts (typed access)
  → consumed by all four views
```

No view owns its own copy of content. Every view derives from the same Velite output. The `game-model.ts` derivation layer builds the 3D graph; `corpus.ts` builds the chatbot grounding document. A build-time bijection test (`game-model.test.ts`) fails the deploy if any graph node is orphaned from real content.

**Velite quirk:** `predev` runs Velite synchronously before `next dev` starts; do not pass `--clean` in dev mode or you'll get a race where webpack tries to resolve a momentarily deleted `.velite/projects.json`. The `build` script passes `--clean` explicitly for a pristine production build.

### LLM / Chat Architecture

`src/lib/llm.ts` is the single source of truth for the chatbot's AI layer:

- **Provider toggle:** `LLM_PROVIDER=bedrock` (default) or `LLM_PROVIDER=anthropic` (direct API).
- **Bedrock model chain:** `us.anthropic.claude-sonnet-4-6` → `us.anthropic.claude-opus-4-6-v1` → `us.anthropic.claude-haiku-4-5-20251001-v1:0`. Note: Opus 4.6 **requires** the `-v1` suffix — the bare ID 400s.
- **Fallback invariant:** Streaming errors surface inside the `for await` loop (never at `.stream()`). The only reliable guard for "can we still fall back?" is whether bytes have already been sent to the client. Once `emittedAny = true`, any subsequent error appends an apology and closes the stream — no retry.
- **Credential handling:** `BEDROCK_ACCESS_KEY_ID` / `BEDROCK_SECRET_ACCESS_KEY` are stored base64-encoded. `decodeSecret()` performs a round-trip equality check to detect base64 vs. raw keys without false-positives. Use `BEDROCK_REGION` (not `AWS_REGION` — Vercel mangles the reserved name in production).
- **Telemetry:** Each model attempt emits an `LlmAttempt` span via `onAttempt` callback. The chat route uses this to write structured `llm.attempt` events for the dashboard.

The chatbot grounding is the **in-context corpus** (`src/lib/corpus.ts`, ~4KB). No vector DB at this scale. The model can emit `[[card:work:slug]]` intent tokens; the client validates slugs against a build-time allowlist before rendering — this is the structural zero-fabrication guard.

### Voice Layer

Voice is pure progressive enhancement — all capabilities default off and fail closed to the browser baseline:

- **STT path:** Web Speech API (browser, free, default) → optional AWS Transcribe (flag-gated)
- **TTS path:** `speechSynthesis` (browser, free, per-sentence) → optional AWS Polly Neural → optional Google Cloud TTS
- Settings live in `src/lib/voice-settings.ts`; the full voice reference is `VOICE.md`

### 3D Graph (Play View)

`src/components/hero-graph/` — React Three Fiber canvas. Key decisions:
- `frameloop="demand"` — no perpetual render loop at idle
- `@react-three/offscreen` for worker offload
- Instanced meshes (one draw call for all nodes)
- Lazy-imported — NOT in the LCP critical path

### Rate Limiting & Telemetry

- `/api/chat`, `/api/tts`, `/api/transcribe` are guarded by Upstash Redis rate limiting (8 req/min per IP).
- Telemetry uses a dual-sink strategy: Vercel Runtime Logs (permanent) + Upstash Redis sorted sets (7-day retention, queryable). The `/admin/telemetry` dashboard is HTTP Basic Auth–protected via `ADMIN_PASSWORD`.

---

## Key Files

| File | Role |
|---|---|
| `src/lib/llm.ts` | LLM provider abstraction, model chain, streaming fallback loop |
| `src/components/view-context.tsx` | 4-view external store + view transitions |
| `src/components/view-router.tsx` | View switcher component |
| `src/lib/corpus.ts` | Chatbot grounding corpus (built from Velite output) |
| `src/lib/game-model.ts` | 3D graph derivation layer + content-coverage assertions |
| `src/lib/content.ts` | Velite typed-access layer |
| `velite.config.ts` | Content schemas (Zod) — Work, Project, Note, Article |
| `next.config.ts` | CSP headers, security, Turbopack, experimental flags |
| `src/app/api/chat/route.ts` | LLM streaming endpoint |
| `src/instrumentation.ts` | Next.js instrumentation hook (telemetry init) |

---

## Environment Variables

Minimum for local chat to work:

```bash
LLM_PROVIDER=bedrock
BEDROCK_ACCESS_KEY_ID=<base64 or raw>
BEDROCK_SECRET_ACCESS_KEY=<base64 or raw>
BEDROCK_REGION=us-east-1
```

Optional (voice, rate limiting, telemetry):

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
GOOGLE_TTS_API_KEY=...
ADMIN_PASSWORD=...                    # /admin/telemetry dashboard
NEXT_PUBLIC_ANVIL_ORB_MODE=inplace    # build-time feature flags
```

Pull production env vars with: `vercel env pull .env.local`

---

## Content Authorship Rules

Every content file must reflect honest contribution registers. The `register` field on Work items (e.g. `"Co-built · architected the backend"`) is the canonical source for contribution attribution — never fabricate ownership claims. Metrics must be real; the corpus test fails if required fields are missing.

Work frontmatter supports optional `constraints`, `tradeoffs`, and `diagram`/`diagramAlt` fields for hiring-manager depth — these render only when present, so existing case studies are unchanged until filled.

---

## Testing Notes

- `game-model.test.ts` asserts a bijection between graph nodes and content items — it **blocks deploys** if orphaned. Run it whenever you add or rename content.
- `ask-portfolio.dom.test.ts` covers prompt injection and XSS guards on streamed markdown — do not weaken or skip these.
- `llm.test.ts` pins the snake_case usage field names from the Anthropic SDK (`input_tokens`, not `inputTokens`). A future SDK update that returns camelCase would silently zero out token telemetry; this test is the regression guard.
- Tests run as part of `pnpm build` — a failing test blocks deployment.

---

## Skills (Loop-Engineer Harness)

Skills live in `.claude/skills/` and are available as slash commands in Claude Code.

| Skill | Command | When to use |
|---|---|---|
| **dev-local** | `/dev-local` | Start/stop/verify the local dev stack — Anvilry-specific launcher |
| **pr** | `/pr` | Prove a feature works (fresh verifier sub-agent drives the app) then open PR |
| **e2e-setup** | `/e2e-setup` | Add or extend the Playwright E2E suite (`e2e/` package) |
| **new-loop** | `/new-loop` | Bootstrap the knowledge base and create a new compounding agent loop |
| **setup-codebase-harness** | `/setup-codebase-harness` | Master harness skill — orchestrates the others |

### E2E Tests
```bash
pnpm e2e          # run Playwright tests (requires dev server running at :3000)
pnpm e2e:ui       # interactive Playwright UI mode
```

E2E specs live in `e2e/`. The suite covers all four views (classic, chat, gamified, developer),
SEO routes (llms.txt, sitemap.xml, robots.txt), and API smoke tests.

### Knowledge Base (new-loop)
After running `/new-loop`, the knowledge base lives at the repo root:
- `ARCHITECTURE.md` — system structure (agent-readable map)
- `LOG.md` — global append-only feed of agent work
- `signals/` — ephemeral observations (SEO findings, perf metrics, support friction)
- `docs/` — durable artifacts (decisions, research, guides)
- `domains/` — loop charters (each loop owns a `domains/<name>/README.md`)
