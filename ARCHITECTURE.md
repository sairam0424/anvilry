---
kind: architecture
title: Knowledge-base architecture
type: decision
status: adopted
---

> **Version:** v1.0.0 — knowledge base bootstrapped 2026-06-24. Active domains: content, seo, performance.

# Knowledge-base architecture

How this repo is organized as the operating substrate for a long-lived, autonomous agent
(and its humans). Everything is plain **markdown + frontmatter in git** — diffable, reviewable,
agent-writable. This doc is the durable record of the model so the shape stays intentional as
it grows.

**Product:** Anvilry — personal portfolio + AI-powered developer showcase (Next.js 16, 4-view system).

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
| `content` | Keep the portfolio content fresh, consistent, and discoverable | weekly | MDX files + Velite output |
| `seo` | Maximize organic reach via llms.txt, structured data, sitemap, and canonical URLs | weekly | Vercel Analytics + Google Search Console |
| `performance` | Keep Core Web Vitals green; catch bundle regressions before they ship | on PR | `pnpm build` bundle analysis + web-vitals |

---

## Repo layout (agent-readable map)

```
sairam-dev/
├── src/
│   ├── app/                        Next.js App Router — pages, API routes, layouts
│   │   ├── api/chat/route.ts       LLM streaming endpoint (Bedrock / Anthropic)
│   │   ├── api/tts*/               Text-to-speech (Polly, Google)
│   │   ├── api/mcp/                MCP server transport
│   │   └── [articles|work|projects|notes]/  Content pages (SSG from Velite)
│   ├── components/
│   │   ├── chat/                   Chat view — use-chat.ts hook, chat-messages.tsx, file-picker
│   │   ├── hero-graph/             3D R3F graph (scene.tsx, scene-physics.tsx, index.tsx)
│   │   └── game/terminal/          Developer terminal view (16 commands, combobox)
│   └── lib/
│       ├── llm.ts                  LLM provider abstraction + extended thinking stream
│       ├── corpus.ts               Chatbot grounding corpus (built from Velite)
│       ├── game-model.ts           3D graph derivation layer
│       ├── content.ts              Velite typed-access layer
│       └── use-reduced-motion.ts   SSR-safe prefers-reduced-motion hook
├── content/                        MDX source (work, projects, notes, articles)
├── e2e/                            Playwright E2E suite (4 views + SEO + API)
├── .claude/
│   ├── skills/                     Slash commands: /dev-local /pr /e2e-setup /new-loop /setup-codebase-harness
│   └── workflows/ship-change.js    End-to-end ship workflow (worktree → implement → review → verify → PR)
├── signals/                        Evidence: feedback, ideas, observations
├── docs/                           Durable knowledge: decisions, analyses, learnings
└── domains/                        Loop charters (content, seo, performance)
```

---

## Key invariants

- **Never fabricate metrics.** The `register` field on Work MDX items is the canonical attribution source.
- **Bijection guard.** `game-model.test.ts` asserts every graph node maps to real content — it blocks deploys if orphaned.
- **`.velite/` is gitignored.** Always run `pnpm content` before type-checking or testing.
- **Secrets via env.** No hardcoded keys. Use `vercel env pull .env.local` for local dev.
- **Feature flags.** `NEXT_PUBLIC_*` env vars gate experimental features (GRAPH_PHYSICS, MULTIMODAL_ATTACHMENTS, PDF_ATTACHMENTS, EXTENDED_THINKING).
