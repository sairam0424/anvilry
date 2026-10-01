---
kind: architecture
title: Knowledge-base architecture
type: decision
status: adopted
---

> **Version:** v1.0.0 — knowledge base bootstrapped 2026-06-24. Active domains: content, seo, performance.
> **Scope:** the domain table, layout map and invariants below describe Anvilry v3.11.0 (`package.json` 3.11.0), i.e. `main` @ `a929932` (`package.json` 3.6.0) plus five later behavioural fixes: notes hidden at the data layer while `NEXT_PUBLIC_NOTES_ENABLED` is off; per-class rate-limit buckets (`chat` / `voice` / `beacon`) with a `CRON_SECRET` bypass for the eval cron; one shared `isAdminAuthorized` (proxy, `requireAdmin`, telemetry page) and one shared `src/lib/cron-auth.ts`; command-palette talk mode gated by `isVoiceViewActive`; `MIN_ROUTES` 17 in the bundle gate, verified-dead components removed (all v3.7.0); v3.8.0 adds two more: an IAM-denied model falls through to the next rung instead of ending the chain, and `LLM_USE_SONNET_5_5` opts in to Sonnet 5.5 as the primary rung; v3.9.0 removes two things a visitor could see: the model and provider line under chat answers, and the Konami-code easter egg; v3.10.0 changes how the chat model behaves and what a visitor reads: Sonnet 4.6 backs up a Sonnet 5.x primary and Opus is opt-in, Sonnet 5.x streams a reasoning summary, `cost_usd` comes from a verified per-model price table, and a neutral AI cue says the answers are AI-generated; v3.11.0 lets `LLM_THINKING_EFFORT` take all five effort levels, so Sonnet 5.5 can be made to reason on every question. The `v1.0.0` above versions the knowledge-base model, not the app.

# Knowledge-base architecture

How this repo is organized as the operating substrate for a long-lived, autonomous agent (and its humans). Everything is plain
**markdown + frontmatter in git** — diffable, reviewable, agent-writable. This doc is the durable record of the model so the shape
stays intentional as it grows.

**Product:** Anvilry — personal portfolio + AI-powered developer showcase (Next.js 16). The `View` union has six members (`classic`, `gamified`, `chat`, `developer`, `voice`, `resume`); the switcher shows four pills server-side and five on desktop after hydration. See `CLAUDE.md` → "The View System".

---

## The model (v1 — deliberately minimal)

Two ideas only:

1. **Artifacts** are global, foldered by **kind**; `domain:` is a **field (a list)**, not a folder.
   Each artifact has exactly one home (by *what it is*). Cross-cutting is handled by tags + links
   — never by duplicating or by nesting inside a domain.
2. **Domains** are "loops" — a thread of work with a charter, cadence, and metrics. A domain
   folder holds only its **README (charter)** + **machinery** (metrics, collectors). It **links**
   artifacts; it never contains them.

### Kinds (start with just these two)

| kind | what it is | folder | key frontmatter |
|---|---|---|---|
| `signal` | evidence: feedback / idea / observation (deduped, frequency-counted) | `signals/` | `category, frequency, sources[], domain[], status` |
| `doc` | durable knowledge: an analysis, a decision, a thing you learned | `docs/` | `domain[], status?, links` |

Each folder's `README` is its schema — read it before adding artifacts of that kind.
A loop's to-dos live inline as a backlog in its domain `README`. Promote them to a `task`
kind only once you've earned it.

### Earning a new kind

Default to an existing kind. Add a new one **only** when it has all three of: its own status
machine **AND** queryable frontmatter fields **AND** a distinct body shape. Otherwise it's a
`doc` or a `signal` with a tag, or a backlog line in a domain README.

---

## Domains (active loops)

| Domain | Goal | Cadence | Collector |
|--------|------|---------|-----------|
| `content` | Keep the portfolio content fresh, consistent, and discoverable | weekly | MDX files + Velite output; `/api/cron/content-audit` (18-month staleness flags) |
| `seo` | Maximize organic reach via structured data, sitemap, and canonical URLs (`llms.txt` stays as a coding-agent surface, not a search lever) | weekly | `/api/cron/seo-audit` (route 200-checks + missing summaries); Vercel Analytics and Search Console are read by hand |
| `performance` | Keep Core Web Vitals green; catch bundle regressions before they ship | on PR | `pnpm build` per-route first-load stats, gated by `scripts/bundle-budget.mjs` in the CI `e2e` job; local `pnpm analyze` for module attribution; Vercel Speed Insights dashboard for web-vitals |

---

## Repo layout (agent-readable map)

```
sairam-dev/
├── src/
│   ├── app/                        Next.js App Router — pages, API routes, layouts
│   │   ├── api/chat/route.ts       LLM streaming endpoint (Bedrock / Anthropic) + Redis FAQ answer cache
│   │   ├── api/{tts*,transcribe,mcp,cron,admin}/  Voice I/O (Polly, Google TTS, AWS Transcribe) · MCP server (10 read-only tools) · 5 crons · FAQ-cache purge
│   │   └── [articles|work|projects|notes]/  Content pages (static params from Velite; /projects* cache a live GitHub feed; notes ship dark)
│   ├── components/
│   │   ├── chat/                   Chat view (use-chat, chat-messages, file-picker-button) + Anvil voice stack (talk-mode, use-voice-session, STT/TTS hooks, wake word, voice-orb*, voice-surface-mutex)
│   │   ├── hero-graph/, hero-avatar/  Classic-hero WebGL backdrops, not the Play view (graph: index/scene/scene-physics; avatar when NEXT_PUBLIC_HERO_MODE=avatar)
│   │   ├── game/                   Play (gamified) view: build-graph.tsx + build-graph-scene.tsx (R3F), graph-index.tsx (DOM), dossier-card.tsx
│   │   │   └── terminal/           Developer terminal view (32 commands: 28 visible + 4 hidden, combobox)
│   ├── lib/
│   │   ├── llm.ts, chat-cache.ts   LLM provider abstraction + extended thinking stream · Redis FAQ answer cache
│   │   ├── corpus.ts, game-model.ts, decisions.ts, content.ts  Grounding corpus · 3D graph derivation · decisions ledger (/decisions, MCP list_decisions) · Velite typed access
│   │   ├── rate-limit.ts, admin-auth.ts, cron-auth.ts  Per-class limiter (chat|voice|beacon) · shared admin and cron auth checks
│   │   └── use-reduced-motion.ts   SSR-safe prefers-reduced-motion hook
│   └── proxy.ts                    Next 16 Proxy (Node runtime): first-filter Basic-auth gate for /admin/*
├── content/                        MDX source (work, projects, notes, articles)
├── e2e/                            Playwright (chromium + mobile-safari): views.spec.ts — 4 views, ⌘K switching, 3 SEO status-200 checks, API smoke; resume.spec.ts — /resume
├── .claude/                        skills/ (/dev-local /pr /e2e-setup /new-loop /setup-codebase-harness) + workflows/ship-change.js (sibling worktree → implement → simplify → review → verify → PR; the worktree is kept, default base develop)
├── scripts/                        bundle-budget.mjs · check-index-citations.mjs · seal-claims.ts (verifies data/integrity-chain.json) · replay-trace.mjs
├── .github/workflows/              ci.yml (lint · tsc · test · index-citation + claims-seal checks; e2e job = build + bundle budget + Playwright), codeql, dependency-review, gitleaks, scorecard
├── signals/                        Evidence: feedback, ideas, observations
├── docs/                           Durable knowledge: decisions, analyses, learnings; index/ is the citation-gated codebase index
└── domains/                        Loop charters (content, seo, performance)
```

---

## Key invariants

- **Never fabricate metrics.** The `register` field on Work MDX items is the canonical attribution source.
- **Bijection guard.** `game-model.test.ts` asserts every graph node maps to real content — it blocks deploys if orphaned.
- **`.velite/` is gitignored.** Always run `pnpm content` before type-checking or testing.
- **Secrets via env.** No hardcoded keys. Use `vercel env pull .env.local` for local dev.
- **Feature flags.** `NEXT_PUBLIC_*` env vars gate experimental features (GRAPH_PHYSICS, MULTIMODAL_ATTACHMENTS, PDF_ATTACHMENTS): build-time and opt-in — on only when set to `"true"`. `EXTENDED_THINKING` is the exception: default ON, off only when set to `"false"`, and it has two independent switches — unprefixed `EXTENDED_THINKING` (server; read per request in `api/chat/route.ts`) and `NEXT_PUBLIC_EXTENDED_THINKING` (client; build-time; hides the reasoning panel in `chat-messages.tsx`).
- **Ships dark.** `NEXT_PUBLIC_NOTES_ENABLED` (default off) is enforced at the data layer, in `lib/content.ts` (route guards, nav and sitemap still re-check it): `allNotes` is empty while dark, so the feed, `llms.txt`, MCP, the chat corpus and both `.md` handler sets cannot publish notes the `/notes` pages 404. Only the `/notes/[slug]` route files read `publishedNotes` (`generateStaticParams` must return at least one entry under `cacheComponents`).
- **Cost guards fail open, auth fails closed.** `checkRateLimit(req, cls)` (`lib/rate-limit.ts`) needs a class — `chat` (`/api/chat`), `voice` (`/api/tts`, `/api/tts-google`, `/api/transcribe`) or `beacon` (`/api/error`) — each its own 8 req / 60 s per-IP bucket; it allows everything when Upstash is absent or erroring, and a valid `CRON_SECRET` bearer bypasses it. Admin and cron checks deny when their secret is unset, and each has one implementation: `isAdminAuthorized` (proxy for `/admin/*`, `requireAdmin` for `/api/admin/*`, the telemetry page) and `hasValidCronSecret` / `unauthorizedUnlessCron` (`lib/cron-auth.ts`).
- **Gates.** Vitest runs inside `pnpm build` (`velite --clean && vitest run && next build && pagefind …`), so a failing test blocks the deploy. The bundle budget (`e2e` job), the `docs/index` citation check and the claims-chain seal (`ci` job) are CI steps: they fail PRs, never deploys.
