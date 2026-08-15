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

### Extended Makefile Targets

```bash
# Environment
make env-check             # audit which env vars are set (Bedrock, Redis, GCP TTS, admin, flags)
make env-setup             # step-by-step guide to bootstrap .env.local
make env-vercel            # pull Vercel production vars into local .env.local

# Feature flags
make flags-show            # print all NEXT_PUBLIC_* flags + current values
make flags-beast           # print unlock commands for all visual effects (orb bloom, ink, skill tree)
make flags-notes-on / flags-notes-off  # toggle /notes section on Vercel

# Observability
make logs                  # stream Vercel runtime logs
make logs-llm              # stream logs, grep LLM lines
make admin                 # open /admin/telemetry in browser

# Deployment / git
make deploy-preview        # trigger manual Vercel preview
make rollback              # rollback to previous Vercel deployment
make pr                    # open PR: current branch → develop
make pr-prod               # open PR: develop → main
make push                  # push current branch

# Content management
make resume-list / resume-open   # manage PDFs in public/resume/
```

---

## Branch Model & CI

**Branch topology:**
- `develop` — integration branch; all feature work targets this; Vercel Preview deploys
- `main` — production release branch; merged from `develop` only; Vercel Production deploys

**CI pipeline (`.github/workflows/`):**
- `ci.yml` — runs on every push + PRs to `develop`/`main`: lint → typecheck (`tsc --noEmit`) → `pnpm test`. Generates `.velite/` before typecheck and vitest — this mirrors the production build order and is required because `.velite/` is gitignored.
- `bundle-analysis.yml` — runs on `develop`/`main` and their PRs; posts bundle-diff comment.
- `codeql.yml` — static JavaScript/TypeScript analysis on `develop` PRs + weekly.
- `dependency-review.yml` — dependency security check on PRs.

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

### Route Tree

```
/ (SSG → ViewRouter → Classic | Chat | Gamified | Developer)
├── /projects                    ISR 1h; live GitHub feed server-side
│   └── /[slug]
├── /articles                    cross-posted + native articles
│   └── /[slug]
├── /notes
│   └── /[slug]
├── /work
│   └── /[slug]
├── /resume                      print-optimized recruiter view
├── /search                      Pagefind static search
├── /stats                       GitHub/writing aggregate stats
├── /mcp                         MCP server documentation (force-static)
├── /about
├── /admin/telemetry             HTTP Basic Auth; reads Upstash Redis
├── /.well-known/vercel/flags    Vercel Flags SDK endpoint
├── /llms.txt                    AI model discovery file
├── /feed.xml                    RSS/Atom
├── /api/resume.json
├── /api/chat                    LLM streaming; rate-limited; telemetry (Node, 30s)
├── /api/mcp/[transport]         MCP server — GET/POST/DELETE; use /api/mcp/mcp (Node, 30s)
├── /api/tts                     AWS Polly TTS caching; rate-limited
├── /api/tts-google              Google Cloud TTS caching; rate-limited
├── /api/transcribe              AWS Transcribe STT; rate-limited
├── /api/visit                   page visit tracking
├── /api/error                   client-side error beaconing
├── /api/github/stats            ISR 1h; GitHub aggregate feed
└── /api/cron/eval               evaluation cron (CRON_SECRET protected)
```

All content routes generate per-route `opengraph-image.tsx` images. Every API route runs on the **Node.js runtime** (not Edge) with a 30s max duration.

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

**Notes accept both `.md` and `.mdx`** — `.md` files come from the Inkforge pipeline and carry extended frontmatter (`tone`, `format`, `length`, `wordCount`, `readingTime`, `generatedBy`, `platforms`). Hand-written `.mdx` notes omit these fields and still compile.

**Articles support a `linkedNote` field** — when set to a note slug, the article card links to the `/notes/[slug]` page instead of the external URL. Use this for cross-posted content to avoid duplicate body rendering.

### LLM / Chat Architecture

`src/lib/llm.ts` is the single source of truth for the chatbot's AI layer:

- **Provider toggle:** `LLM_PROVIDER=bedrock` (default) or `LLM_PROVIDER=anthropic` (direct API).
- **Bedrock model chain:** `us.anthropic.claude-sonnet-4-6` → `us.anthropic.claude-opus-4-6-v1` → `us.anthropic.claude-haiku-4-5-20251001-v1:0`. Note: Opus 4.6 **requires** the `-v1` suffix — the bare ID 400s.
- **Fallback invariant:** Streaming errors surface inside the `for await` loop (never at `.stream()`). The only reliable guard for "can we still fall back?" is whether bytes have already been sent to the client. Once `emittedAny = true`, any subsequent error appends an apology and closes the stream — no retry.
- **Credential handling:** `BEDROCK_ACCESS_KEY_ID` / `BEDROCK_SECRET_ACCESS_KEY` are stored base64-encoded. `decodeSecret()` performs a round-trip equality check to detect base64 vs. raw keys without false-positives. Use `BEDROCK_REGION` (not `AWS_REGION` — Vercel mangles the reserved name in production).
- **Telemetry:** Each model attempt emits an `LlmAttempt` span via `onAttempt` callback. The chat route uses this to write structured `llm.attempt` events for the dashboard.

The chatbot grounding is the **in-context corpus** (`src/lib/corpus.ts`, ~4KB). No vector DB at this scale. The model can emit `[[card:work:slug]]` intent tokens; the client validates slugs against a build-time allowlist before rendering — this is the structural zero-fabrication guard.

### MCP Server

`/api/mcp/[transport]` exposes the portfolio as a read-only MCP server (HTTP Streamable, legacy SSE disabled). Public endpoint: `https://anvilry.vercel.app/api/mcp/mcp`.

**7 tools** (all sourced from `src/lib/mcp-tools.ts`, transport-agnostic pure functions):

| Tool | Description |
|---|---|
| `get_profile` | Identity, headline, links, skills, achievements |
| `list_projects` | All OSS projects |
| `get_project` | Single project by slug |
| `list_work` | All case studies |
| `get_work` | Single case study by slug |
| `search_experience` | Keyword search across work, projects, skills |
| `get_resume_variant` | Role-targeted PDF URL (`master \| backend \| fullstack \| frontend \| genai`) |

Deliberately excludes `personal.ts` (hobbies) — professional-only surface. Tools return `isError: true` with valid options on not-found rather than fabricating.

**Configuration:**
```
# Claude Desktop
npx -y mcp-remote https://anvilry.vercel.app/api/mcp/mcp

# Cursor (direct HTTP)
https://anvilry.vercel.app/api/mcp/mcp
```

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
- `src/proxy.ts` is the **Edge-runtime** auth gate for `/admin/*` (uses Web Crypto SubtleCrypto SHA-256). `src/lib/admin-auth.ts` is the **server-side** version (Node.js `timingSafeEqual`). Both exist because Edge runtime lacks Node.js APIs.

### Feature Flags

Two mechanisms — choose based on how fast you need the toggle:

| Mechanism | How | Latency |
|---|---|---|
| `NEXT_PUBLIC_*` env vars | Build-time; set in Vercel dashboard → redeploy | Minutes |
| Vercel Flags SDK | Runtime; set `FLAG_DRIVER=vercel` → instant | Seconds |

Key flags: `NEXT_PUBLIC_DISCOVERY_BADGES`, `NEXT_PUBLIC_OPEN_TO_WORK`, `NEXT_PUBLIC_GITHUB_STATS_ENABLED`, `NEXT_PUBLIC_ANVIL_ORB_MODE`, `NEXT_PUBLIC_INK_TRANSITION`, `NEXT_PUBLIC_SKILL_TREE`. Run `make flags-show` to see all current values.

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
| `src/lib/mcp-tools.ts` | Pure MCP tool implementations (transport-agnostic) |
| `src/lib/agent-trace.ts` | Glass-box agent demo; `PLACEHOLDER_SENTINEL` shipping gate |
| `src/lib/voice-settings-context.tsx` | Persisted voice prefs (external store, localStorage) |
| `src/lib/voice-catalog.ts` | Authoritative voice catalog for all engines |
| `src/lib/rate-limit.ts` | Per-IP Upstash rate limiter (fails open) |
| `src/lib/redis.ts` | Upstash Redis singleton (shared by rate-limit, telemetry, admin) |
| `src/lib/flags.ts` | Feature flag resolver (build-time env vs. Vercel Flags SDK runtime) |
| `src/proxy.ts` | Edge-runtime HTTP Basic Auth for /admin/* (SubtleCrypto) |
| `velite.config.ts` | Content schemas (Zod) — Work, Project, Note, Article |
| `next.config.ts` | CSP headers (enforced), security, Turbopack, experimental flags |
| `src/app/api/chat/route.ts` | LLM streaming endpoint |
| `src/app/api/mcp/[transport]/route.ts` | MCP server (7 read-only tools) |
| `src/instrumentation.ts` | Next.js instrumentation hook (config snapshot on cold start) |
| `src/instrumentation-client.ts` | Browser error beaconing + web-vitals reporting |

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
CRON_SECRET=...                       # /api/cron/eval protection
```

Pull production env vars with: `vercel env pull .env.local`

**Critical gotcha:** Never use `AWS_REGION` — Vercel corrupts it to `s-east-1` in production (missing the `u`). Always use `BEDROCK_REGION`.

**Custom domain:** If pointing a custom domain at the deployment, update the hardcoded base URL in exactly four files: `src/app/layout.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/components/json-ld.tsx`.

---

## Content Authorship Rules

Every content file must reflect honest contribution registers. The `register` field on Work items (e.g. `"Co-built · architected the backend"`) is the canonical source for contribution attribution — never fabricate ownership claims. Metrics must be real; the corpus test fails if required fields are missing.

Work frontmatter supports optional `constraints`, `tradeoffs`, and `diagram`/`diagramAlt` fields for hiring-manager depth — these render only when present, so existing case studies are unchanged until filled.

---

## Testing Notes

- `game-model.test.ts` asserts a bijection between graph nodes and content items — it **blocks deploys** if orphaned. Run it whenever you add or rename content. Three node IDs intentionally differ from their slugs: `aava` → `aava-code`, `grpc` → `grpc-microservices`, `nhl` → `not-humans-lab` — this is by design, not a bug.
- `ask-portfolio.dom.test.ts` covers prompt injection and XSS guards on streamed markdown — do not weaken or skip these.
- `llm.test.ts` pins the snake_case usage field names from the Anthropic SDK (`input_tokens`, not `inputTokens`). A future SDK update that returns camelCase would silently zero out token telemetry; this test is the regression guard.
- `agent-trace.test.ts` blocks shipping the glass-box multi-agent demo while any step in `src/lib/agent-trace.ts` still contains `PLACEHOLDER_SENTINEL` (`"[DRAFT — owner to approve]"`). The demo is dark until the owner fills in real reasoning traces.
- **Vitest runs two projects:** `node` (default, all `*.test.ts` except `*.dom.test.*`) and `dom` (happy-dom environment, all `*.dom.test.*`). `NODE_ENV` is forced to `"test"` to prevent React's missing `act()` warning in the production-default Node environment.
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

### ship-change workflow
The most powerful addition — ships a scoped change end-to-end with worktree isolation:
```javascript
Workflow({ name: 'ship-change', args: { task: 'what to build', repo: '/abs/path/to/repo' } })
```
Phases: **Setup** (isolated git worktree + env copy + deps) → **Implement** → **Simplify** →
**Review** (Codex if available) → **Verify** → **PR** (delegates to `/pr` skill).
Multiple ship-change runs can run in parallel — each gets its own worktree, no collisions.

### Knowledge Base
Already bootstrapped at the repo root:
- `ARCHITECTURE.md` — system map: repo layout, invariants, active domain loops
- `LOG.md` — append-only journal of finished work (newest first)
- `signals/` — evidence: feedback, ideas, observations (deduped, frequency-counted)
- `docs/` — durable knowledge: decisions, analyses, learnings
- `domains/content/` — content freshness loop (MDX quality, metrics completeness)
- `domains/seo/` — discoverability loop (llms.txt, structured data, sitemap)
- `domains/performance/` — web vitals loop (bundle analysis, LCP, R3F chunk tracking)

Add new loops with `/new-loop`. Append to `LOG.md` after any significant work session.
