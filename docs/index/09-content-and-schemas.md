---
kind: doc
title: Content Corpus & Velite Schemas
domain: [content]
status: current
version: v3.5.0
---

# Content Corpus & Velite Schemas

> Part of the Anvilry v3.5.0 codebase index. Master entry point: [docs/index/README.md](./README.md)

**Scope:** `velite.config.ts`, `content/work/*.mdx` (5), `content/projects/*.mdx` (11), `content/notes/*.{md,mdx}` (5) + `content/notes/.gitkeep`, `content/articles/*.mdx` (15)
**Files indexed:** 38

## At a glance

| File | Role | Key exports |
|---|---|---|
| `velite.config.ts` | Defines the 4 Velite collections (Project, Work, Note, Article) with Zod schemas + `url` transforms; sets output dir `.velite`, asset dir `public/static`, `clean: false`, `mdx.gfm: true` | `default` (Velite config via `defineConfig`); module-local `themeGroup`, `projects`, `work`, `notes`, `articles` |
| `content/work/pensieve.mdx` | Work case study — AI process-orchestration engine at Ascendion; `order: 1` (first in `allWork`) | frontmatter data (no code exports) |
| `content/work/aava-code.mdx` | Work case study — multi-agent VS Code coding plugin; `order: 2`; the node-id mismatch target `aava` → `aava-code` | frontmatter data |
| `content/work/wireframe-generator.mdx` | Work case study — GenAI wireframe generator over SSE; `order: 3` | frontmatter data |
| `content/work/prompt-to-react.mdx` | Work case study — wireframe → React component/routing codegen; `order: 4` | frontmatter data |
| `content/work/execution-engine.mdx` | Work case study — prompt-driven RAG + ReAct artifact engine; `order: 5` | frontmatter data |
| `content/projects/mindforge.mdx` | Project — agentic-intelligence framework for Claude Code; `order: 1`, 1193 commits, `featured: true` | frontmatter data |
| `content/projects/graph-forge.mdx` | Project — Neo4j + Chroma code-intelligence platform, ~19 microservices; `order: 2`, `featured: true` | frontmatter data |
| `content/projects/agent-forge.mdx` | Project — self-improving agent loop over git-versioned `AGENT.md`; `order: 3`, `pinRank: 1`, `featured: true` | frontmatter data |
| `content/projects/contextos.mdx` | Project — intelligence/resilience layer, 3 npm packages + 3D dashboard; `order: 4`, `featured: false` | frontmatter data |
| `content/projects/ag-bash.mdx` | Project — TypeScript AI-native bash interpreter over WASM runtimes; `order: 5`, `featured: false` | frontmatter data |
| `content/projects/tombstone.mdx` | Project — feature-flag intelligence platform; `order: 5` (ties ag-bash), `featured: true` | frontmatter data |
| `content/projects/not-humans-lab.mdx` | Project — federated polyglot AI-infra workspace; `order: 6`, `pinned: false` | frontmatter data |
| `content/projects/trelix.mdx` | Project — offline code intelligence engine, 7-leg RRF retrieval; `order: 6` (ties not-humans-lab), `featured: true` | frontmatter data |
| `content/projects/commandvault.mdx` | Project — universal AI command manager; `order: 7`, `pinned: false` | frontmatter data |
| `content/projects/inkforge.mdx` | Project — STORM + BM25 article generation/publishing pipeline; `order: 7` (ties commandvault), `featured: true` | frontmatter data |
| `content/projects/grpc-microservices.mdx` | Project — event-driven Go+Python order-processing backend; `order: 8`; the only project with **no** `commits` field | frontmatter data |
| `content/notes/.gitkeep` | Single-line comment placeholder documenting that `/notes` "ships dark until real posts exist"; keeps the dir tracked | n/a (108-byte comment file) |
| `content/notes/feature-flags-at-scale-distributed-control-system.md` | Inkforge-generated note (3401 words) on feature flags as a distributed control plane | frontmatter + MDX body |
| `content/notes/how-dns-works.mdx` | Inkforge-generated note (3784 words) on DNS resolution/caching/failure modes; `.mdx` despite `generatedBy: inkforge`; **no** `category` field | frontmatter + MDX body |
| `content/notes/how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-bedrock.md` | Inkforge note (3751 words) — first-person build log of Inkforge's STORM/BM25/Bedrock design | frontmatter + MDX body |
| `content/notes/how-i-built-tombstone-feature-flag-intelligence-platform.md` | Inkforge note (3531 words) — first-person build log of Tombstone, keyed on the Knight Capital `POWER_PHLX` incident | frontmatter + MDX body |
| `content/notes/how-i-traced-one-browser-request-from-keystroke-to-rendered-page.mdx` | Inkforge note (2068 words) — keystroke→render walkthrough; the only content file containing MDX comment expressions (`{/* … */}`, 10 occurrences) | frontmatter + MDX body |
| `content/articles/how-dns-works.mdx` | Article, `source: native`, `linkedNote: how-dns-works`, no `externalUrl`/`canonicalUrl`; body is empty | frontmatter only |
| `content/articles/how-dns-works-devto.mdx` | Article, `source: devto`, links to the `how-dns-works` note | frontmatter only |
| `content/articles/how-dns-works-hashnode.mdx` | Article, `source: hashnode`, **`draft: true`** — the only draft in the corpus | frontmatter only |
| `content/articles/feature-flags-at-scale-devto.mdx` | Article, `source: devto`, linked to the feature-flags note | frontmatter only |
| `content/articles/feature-flags-at-scale-substack.mdx` | Article, `source: substack`, same canonical/note as the devto twin | frontmatter only |
| `content/articles/how-i-traced-one-browser-request-devto.mdx` | Article, `source: devto`, linked to the browser-request note | frontmatter only |
| `content/articles/how-i-traced-one-browser-request-hashnode.mdx` | Article, `source: hashnode`, linked to the browser-request note | frontmatter only |
| `content/articles/how-i-traced-one-browser-request-medium.mdx` | Article, `source: medium`; has `canonicalUrl` but **no** `linkedNote` | frontmatter only |
| `content/articles/how-i-traced-one-browser-request-substack.mdx` | Article, `source: substack`; has `canonicalUrl` but **no** `linkedNote` | frontmatter only |
| `content/articles/inkforge-build-devto.mdx` | Article, `source: devto`, linked to the Inkforge build note | frontmatter only |
| `content/articles/tombstone-launch-devto.mdx` | Article, `source: devto`, linked to the Tombstone build note | frontmatter only |
| `content/articles/tombstone-launch-substack.mdx` | Article, `source: substack`, retitled ("I Built Tombstone Because I Was Tired of 2am Flag Incidents"), same `linkedNote` | frontmatter only |
| `content/articles/tombstone-v1-2-devto.mdx` | Article, `source: devto`; `linkedNote: tombstone-v1-2-release` — **no such note exists** | frontmatter only |
| `content/articles/trelix-v1-launch-devto.mdx` | Article, `source: devto`; `linkedNote: trelix-code-intelligence-engine` — **no such note exists** | frontmatter only |
| `content/articles/trelix-v1-launch-substack.mdx` | Article, `source: substack`; same dangling `linkedNote: trelix-code-intelligence-engine` | frontmatter only |

## Schemas

All four collections are declared in `velite.config.ts` and registered at `velite.config.ts:127`
(`collections: { projects, work, notes, articles }`). Global config: `root: "content"`
(`velite.config.ts:115`), data output `.velite`, asset output `public/static` served from base
`/static/` with filename pattern `[name]-[hash:6].[ext]` (`velite.config.ts:117-120`),
`clean: false` (`velite.config.ts:125`), and `mdx: { gfm: true }` (`velite.config.ts:128`).

Velite primitive semantics (verified in `node_modules/velite/dist/index.js`):

- `s.slug(group)` → `string().min(3).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i)` AND
  uniqueness in namespace `slug:<group>` (`node_modules/velite/dist/index.js:5095`). **Uniqueness
  is scoped per group**, so the same slug may exist in two collections — and does
  (`how-dns-works` is both a Note slug and an Article slug).
- `s.isodate()` → `string()` refined by `!isNaN(Date.parse(value))` then transformed to
  `new Date(value).toISOString()` (`node_modules/velite/dist/index.js:140`). Frontmatter
  `date: 2026-06-19` therefore lands in `.velite` as `"2026-06-19T00:00:00.000Z"`.
- `s.mdx()` compiles the file body to a JS function string; an empty body yields `body: ""`
  (all 15 Article files have empty bodies).

### Project (`velite.config.ts:11-31`) — pattern `projects/**/*.mdx`

| Field | Zod type | Req/Opt | Transform / default | Cite |
|---|---|---|---|---|
| `slug` | `s.slug("project")` | required | unique in `slug:project` | `:16` |
| `name` | `s.string()` | required | — | `:17` |
| `tagline` | `s.string()` | required | — | `:18` |
| `group` | `s.enum([...])` | required | one of `"Agent Frameworks & Infrastructure"`, `"Code Intelligence & Engines"`, `"Tooling & Lab"` | `:19`, enum at `:4-8` |
| `repo` | `s.string().url()` | required | must be a valid URL | `:20` |
| `commits` | `s.number()` | **optional** | — | `:21` |
| `tech` | `s.array(s.string())` | required | — | `:22` |
| `pinned` | `s.boolean()` | optional | `.default(false)` | `:23` |
| `pinRank` | `s.number()` | **optional** | — | `:24` |
| `featured` | `s.boolean()` | optional | `.default(false)` | `:25` |
| `order` | `s.number()` | optional | `.default(100)` | `:26` |
| `body` | `s.mdx()` | required | compiled MDX | `:27` |
| `excerpt` | `s.string()` | required | — | `:28` |
| `url` | — (derived) | added | `.transform((data) => ({ ...data, url: \`/projects/${data.slug}\` }))` | `:30` |

The `themeGroup` enum (`velite.config.ts:4-8`) is duplicated as a literal tuple in
`src/lib/content.ts:30-34` (`projectGroups`) — the ordering there drives `/projects` section order.

### Work (`velite.config.ts:34-56`) — pattern `work/**/*.mdx`

| Field | Zod type | Req/Opt | Transform / default | Cite |
|---|---|---|---|---|
| `slug` | `s.slug("work")` | required | unique in `slug:work` | `:39` |
| `name` | `s.string()` | required | — | `:40` |
| `role` | `s.string()` | required | — | `:41` |
| `register` | `s.string()` | **required** | honest contribution note, e.g. `"Co-built · architected the backend"` | `:42` |
| `summary` | `s.string()` | required | — | `:43` |
| `metrics` | `s.array(s.object({ value: s.string(), label: s.string() }))` | required | `value` is a **string**, not a number | `:44` |
| `tech` | `s.array(s.string())` | required | — | `:45` |
| `order` | `s.number()` | optional | `.default(100)` | `:46` |
| `constraints` | `s.string()` | **optional** | renders only when present | `:49` |
| `tradeoffs` | `s.string()` | **optional** | renders only when present | `:50` |
| `diagram` | `s.string()` | **optional** | path to an owner-authored diagram (e.g. `/static/...`) | `:51` |
| `diagramAlt` | `s.string()` | **optional** | comment marks it "REQUIRED alt text when `diagram` is set (a11y) — asserted in a test" | `:52` |
| `body` | `s.mdx()` | required | compiled MDX | `:53` |
| `url` | — (derived) | added | `.transform(... url: \`/work/${data.slug}\`)` | `:55` |

There is **no `featured` field on Work** — the home page's "featured work" list is
`allWork` in full (`src/components/home/featured-work.tsx:12`).
`diagramAlt` is not enforced by Zod; the coupling is a test:
`src/lib/case-study-depth.test.ts:12-16` asserts non-empty `diagramAlt` whenever `diagram` is set,
`:21-27` asserts the asset exists under `public/`, and `:32-38` asserts `constraints`/`tradeoffs`
are >20 chars and free of `TODO|TBD|lorem`.

### Note (`velite.config.ts:62-85`) — pattern `notes/**/*.{md,mdx}`

| Field | Zod type | Req/Opt | Transform / default | Cite |
|---|---|---|---|---|
| `slug` | `s.slug("note")` | required | unique in `slug:note` | `:67` |
| `title` | `s.string()` | required | — | `:68` |
| `date` | `s.isodate()` | required | → ISO string | `:69` |
| `summary` | `s.string()` | required | — | `:70` |
| `tags` | `s.array(s.string())` | optional | `.default([])` | `:71` |
| `draft` | `s.boolean()` | optional | `.default(false)` | `:72` |
| `tone` | `s.enum(["beginner","intermediate","senior"])` | **optional** | Inkforge metadata | `:74` |
| `format` | `s.enum(["tutorial","narrative","explainer","opinion","showcase"])` | **optional** | Inkforge metadata | `:75` |
| `length` | `s.enum(["thread","short","medium","comprehensive"])` | **optional** | Inkforge metadata | `:76` |
| `wordCount` | `s.number()` | **optional** | — | `:77` |
| `readingTime` | `s.number()` | **optional** | minutes | `:78` |
| `generatedBy` | `s.string()` | **optional** | free-form string, **not** an enum; `"inkforge"` is the only value in use | `:79` |
| `category` | `s.string()` | **optional** | free-form | `:80` |
| `platforms` | `s.array(s.string())` | optional | `.default([])` | `:81` |
| `body` | `s.mdx()` | required | compiled MDX (both `.md` and `.mdx` go through the MDX compiler) | `:82` |
| `url` | — (derived) | added | `.transform(... url: \`/notes/${data.slug}\`)` | `:84` |

### Article (`velite.config.ts:93-112`) — pattern `articles/**/*.{md,mdx}`

| Field | Zod type | Req/Opt | Transform / default | Cite |
|---|---|---|---|---|
| `slug` | `s.slug("article")` | required | unique in `slug:article` | `:98` |
| `title` | `s.string()` | required | — | `:99` |
| `date` | `s.isodate()` | required | → ISO string | `:100` |
| `summary` | `s.string()` | required | — | `:101` |
| `source` | `s.enum(["medium","substack","linkedin","devto","hashnode","native"])` | required | — | `:102` |
| `externalUrl` | `s.string().url()` | **optional** | comment: "required for non-native; omit for native" — **not enforced by the schema** | `:103` |
| `canonicalUrl` | `s.string().url()` | **optional** | SEO canonical | `:104` |
| `linkedNote` | `s.string()` | **optional** | plain string, **no referential check** against Note slugs | `:105` |
| `tags` | `s.array(s.string())` | optional | `.default([])` | `:106` |
| `draft` | `s.boolean()` | optional | `.default(false)` | `:107` |
| `readingTime` | `s.number()` | **optional** | estimated minutes | `:108` |
| `body` | `s.mdx()` | required | compiled MDX; every shipped Article body is `""` | `:109` |
| `url` | — (derived) | added | `.transform(... url: \`/articles/${data.slug}\`)` | `:111` |

Note the two unenforced invariants written as comments only: `externalUrl` "required for
non-native" (`velite.config.ts:103`) and `linkedNote` "slug of an existing /notes entry"
(`velite.config.ts:105`). Neither is a Zod refinement, and no test enforces either —
see "Cross-references" for the three live violations.

## Content inventory

### Work — 5 files, `content/work/*.mdx`

`register` strings are reproduced **verbatim**; `CLAUDE.md:347` and `ARCHITECTURE.md:95` declare
this field the canonical contribution-attribution source.

| slug | name / title | role | `register` (verbatim) | order | metrics (value ▸ label) | tech |
|---|---|---|---|---|---|---|
| `pensieve` | Pensieve | AI Process-Orchestration Engine · Ascendion | `Co-built · production-hardened` | 1 | `2K+` ▸ daily users across domains; `HITL` ▸ approval gates; `Multi-cloud` ▸ governed LLM routing | Python, LLM Orchestration, Multi-Agent, SSE, Redis Streams, Cloud Routing |
| `aava-code` | AAVA Code | AI Coding Plugin for VS Code · Ascendion | `Co-built · architected the backend` | 2 | `3K+` ▸ daily users; `5+` ▸ client environments; `150+` ▸ skills · 40+ tools · ~60 commands | Python, crewAI, Multi-Agent, VS Code, Backend Architecture |
| `wireframe-generator` | Wireframe Generator | GenAI Wireframe Generator · Ascendion | `Co-built · production-ready` | 3 | `40%` ▸ fewer UX iteration cycles (5 rounds → 3); `60%` ▸ faster prototyping; `500+` ▸ users daily | GenAI, Angular, SSE, Real-Time Rendering, Backend Stream Handling |
| `prompt-to-react` | Prompt-to-React | Prompt-to-React Code Generation · Ascendion | `Co-built · production-ready` | 4 | `50%` ▸ less frontend dev time (2 days → 1 per feature); `55%` ▸ less manual coding effort; `2K+` ▸ developers; `50+` ▸ teams | React, Code Generation, Modular Components, Routing Logic, Wireframe Input |
| `execution-engine` | Execution Engine | Prompt-Driven Execution Engine · Ascendion | `Co-built` | 5 | `1.5h → 15m` ▸ workflow planning time; `65% → 85%` ▸ first-pass acceptance; `1.5K+` ▸ users | LLM Agent Orchestration, RAG, ReAct, Prompt-Driven |

All 5 Work files set `constraints` **and** `tradeoffs`. **None** sets `diagram` or `diagramAlt`
(verified against `.velite/work.json`), so `case-study-depth.test.ts`'s diagram assertions are
currently vacuous. Every Work body follows the same H2 shape — `## Problem`, `## Approach`,
`## Impact` — closed by a `> **Contribution:** …` blockquote that restates the register in prose
(e.g. `content/work/aava-code.mdx:31`).

### Project — 11 files, `content/projects/*.mdx`

| slug | name | group | repo | commits | pinned / pinRank | featured | order | tagline |
|---|---|---|---|---|---|---|---|---|
| `mindforge` | MindForge | Agent Frameworks & Infrastructure | `github.com/sairam0424/MindForge` | 1193 | true / 6 | **true** | 1 | Agentic-intelligence framework for Claude Code. |
| `graph-forge` | Graph-Forge | Code Intelligence & Engines | `github.com/sairam0424/Graph-Forge` | 555 | true / 2 | **true** | 2 | AI-native distributed code-intelligence platform. |
| `agent-forge` | Agent-Forge | Agent Frameworks & Infrastructure | `github.com/sairam0424/Agent-Forge` | 201 | true / 1 | **true** | 3 | Self-improving AI agent infrastructure. |
| `contextos` | ContextOS | Agent Frameworks & Infrastructure | `github.com/sairam0424/ContextOS` | 175 | true / 5 | false | 4 | Intelligence layer for autonomous AI agents. |
| `ag-bash` | ag-bash | Code Intelligence & Engines | `github.com/sairam0424/ag-bash` | 392 | true / 4 | false | 5 | AI-native bash interpreter, in TypeScript. |
| `tombstone` | Tombstone | Agent Frameworks & Infrastructure | `github.com/sairam0424/Tombstone` | 492 | true / 4 | **true** | 5 | Production intelligence layer for 5,000+ feature flags. |
| `not-humans-lab` | Not-Humans-Lab | Tooling & Lab | `github.com/sairam0424/not-humans-lab` | 289 | false / — | false | 6 | Federated AI-infrastructure workspace. |
| `trelix` | Trelix | Code Intelligence & Engines | `github.com/sairam0424/trelix` | 501 | true / 5 | **true** | 6 | Offline code intelligence engine — Tree-sitter indexing, hybrid BM25+vector+graph search. |
| `commandvault` | CommandVault | Tooling & Lab | `github.com/sairam0424/CommandVault` | 139 | false / — | false | 7 | Universal AI command manager. |
| `inkforge` | Inkforge | Tooling & Lab | `github.com/sairam0424/Inkforge` | 89 | true / 7 | **true** | 7 | Notes, topics, or code → published technical articles. |
| `grpc-microservices` | Order Processing System | Code Intelligence & Engines | `github.com/sairam0424/gRPC-micro-services` | *(absent)* | true / 3 | **true** | 8 | Distributed, event-driven gRPC microservices. |

**Duplicate `order` values:** 5 (`ag-bash`, `tombstone`), 6 (`not-humans-lab`, `trelix`),
7 (`commandvault`, `inkforge`). **Duplicate `pinRank` values:** 4 (`ag-bash`, `tombstone`),
5 (`contextos`, `trelix`). Since `src/lib/content.ts:18-21` and `:26-28` use plain numeric
comparators, tied items keep whatever relative order the Velite file walk produced — the
displayed order among ties is not pinned by the frontmatter.

`grpc-microservices` is the only project without `commits`; the corpus builder guards this with
`p.commits ? \` · ${p.commits} commits\` : ""` (`src/lib/corpus.ts:26-28`).
`slug: grpc-microservices` does **not** match its repo name `gRPC-micro-services`
(`content/projects/grpc-microservices.mdx:6`), and `name: Order Processing System` does not match
the slug either — the only project where all three differ.

### Note — 5 content files (+ `.gitkeep`), `content/notes/*.{md,mdx}`

No Note is a draft, so `allNotes.length === 5`.

| slug | ext | title | date | tone | format | length | category | wordCount | readingTime | generatedBy | platforms | tags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `feature-flags-at-scale-distributed-control-system` | `.md` | Feature Flags at Scale: Designing a Distributed Control System for Production Behavior | 2026-06-20 | senior | explainer | comprehensive | `system-design` | 3401 | 13 | `inkforge` | `[]` | feature-flags, system-design, distributed-systems, devops, engineering |
| `how-dns-works` | `.mdx` | How DNS Actually Works: Resolution Hierarchy, Caching, and Production Failure Modes | 2026-06-19 | senior | explainer | comprehensive | *(absent)* | 3784 | 14 | `inkforge` | `[]` | dns, distributed-systems, networking, system-design, infrastructure |
| `how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-bedrock` | `.md` | How I Built Inkforge: Designing an AI-Powered Article System with STORM Pipeline, BM25 RAG, and AWS Bedrock | 2026-06-20 | senior | narrative | comprehensive | `general` | 3751 | 14 | `inkforge` | `[]` | inkforge, typescript, ai, buildinpublic, rag, aws-bedrock |
| `how-i-built-tombstone-feature-flag-intelligence-platform` | `.md` | How I Built Tombstone: A Self-Hosted Feature Flag Intelligence Platform to Prevent the Next Knight Capital | 2026-06-27 | senior | narrative | comprehensive | `system-design` | 3531 | 13 | `inkforge` | `[]` | feature-flags, system-design, open-source, devops, incident-response, distributed-systems |
| `how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | `.mdx` | How I Traced One Browser Request from Keystroke to Rendered Page | 2026-06-19 | intermediate | narrative | medium | `system-design` | 2068 | 8 | `inkforge` | `[]` | networking, dns, tls, http, system-design, browser |

Every Note carries the full Inkforge extended set except `category`, which
`content/notes/how-dns-works.mdx` omits. Consequently **`inkforgeNotes` /
`inkforgeArticles` (`src/lib/content.ts:56`, `:61`) equal all 5 notes** — there are no
hand-written notes in the corpus today.

`content/notes/.gitkeep` is not empty: it holds one comment line —
"`# Notes content lives here (MDX). Empty by design — the /notes section ships dark until real
posts exist.`" That statement is now stale relative to the 5 shipped notes; the actual dark/live
gate is `NOTES_ENABLED` (`src/lib/writing-flags.ts:22-23`, default **false** unless
`NEXT_PUBLIC_NOTES_ENABLED === "true"`).

### Article — 15 files, `content/articles/*.mdx`

`readingTime` (RT) in minutes. Host column abbreviates `externalUrl`'s origin; full URLs are in
the files. Only `how-dns-works-hashnode` is a draft, so `allArticles.length === 14`.

| slug | title | date | source | externalUrl host | canonicalUrl | linkedNote | RT | draft |
|---|---|---|---|---|---|---|---|---|
| `how-dns-works` | How DNS Actually Works: … | 2026-06-19 | `native` | *(none)* | *(none)* | `how-dns-works` | 14 | false |
| `how-i-traced-one-browser-request-medium` | How I Traced One Browser Request … | 2026-06-19 | `medium` | `medium.com/@uggesairam0000` | `/notes/how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | *(none)* | 8 | false |
| `how-i-traced-one-browser-request-substack` | How I Traced One Browser Request … | 2026-06-19 | `substack` | `sairam0000.substack.com` | same as above | *(none)* | 8 | false |
| `feature-flags-at-scale-devto` | Feature Flags at Scale: … | 2026-06-20 | `devto` | `dev.to/sai_ram_0000` | `/notes/feature-flags-at-scale-distributed-control-system` | `feature-flags-at-scale-distributed-control-system` | 13 | false |
| `feature-flags-at-scale-substack` | Feature Flags at Scale: … | 2026-06-20 | `substack` | `sairam0000.substack.com` | same as above | `feature-flags-at-scale-distributed-control-system` | 13 | false |
| `how-dns-works-devto` | How DNS Actually Works: … | 2026-06-20 | `devto` | `dev.to/sai_ram_0000` | `/notes/how-dns-works` | `how-dns-works` | 14 | false |
| `how-dns-works-hashnode` | How DNS Actually Works: … | 2026-06-20 | `hashnode` | `sairam0000.hashnode.dev` | `/notes/how-dns-works` | `how-dns-works` | 14 | **true** |
| `how-i-traced-one-browser-request-devto` | How I Traced One Browser Request … | 2026-06-20 | `devto` | `dev.to/sai_ram_0000` | `/notes/how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | `how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | 8 | false |
| `how-i-traced-one-browser-request-hashnode` | How I Traced One Browser Request … | 2026-06-20 | `hashnode` | `sairam0000.hashnode.dev` | same as above | `how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | 8 | false |
| `inkforge-build-devto` | How I Built Inkforge: … | 2026-06-27 | `devto` | `dev.to/sai_ram_0000` | `/notes/how-i-built-inkforge-…-bedrock` | `how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-bedrock` | 12 | false |
| `tombstone-launch-devto` | How I Built Tombstone: … | 2026-06-27 | `devto` | `dev.to/sai_ram_0000` | `/notes/how-i-built-tombstone-feature-flag-intelligence-platform` | `how-i-built-tombstone-feature-flag-intelligence-platform` | 13 | false |
| `tombstone-launch-substack` | I Built Tombstone Because I Was Tired of 2am Flag Incidents | 2026-06-27 | `substack` | `open.substack.com/pub/sairam0000` | same as above | `how-i-built-tombstone-feature-flag-intelligence-platform` | 13 | false |
| `tombstone-v1-2-devto` | We Shipped Tombstone v1.0. Then We Found Nine Bugs … | 2026-07-05 | `devto` | `dev.to/sai_ram_0000` | `/notes/tombstone-v1-2-release` | ⚠ `tombstone-v1-2-release` (**missing**) | 10 | false |
| `trelix-v1-launch-devto` | I Built trelix Because I Was Tired of Grepping … | 2026-07-05 | `devto` | `dev.to/sai_ram_0000` | `/notes/trelix-code-intelligence-engine` | ⚠ `trelix-code-intelligence-engine` (**missing**) | 12 | false |
| `trelix-v1-launch-substack` | I Built trelix Because I Was Tired of Grepping … | 2026-07-05 | `substack` | `open.substack.com/pub/sairam0000` | same as above | ⚠ `trelix-code-intelligence-engine` (**missing**) | 12 | false |

All `canonicalUrl` values are absolute `https://anvilry.vercel.app/notes/<note-slug>` URLs (i.e.
they point at the internal note, not at the external platform). Twelve of the 15 articles carry a
`linkedNote`; the two `how-i-traced-…-medium` / `-substack` entries deliberately omit it and rely
on `canonicalUrl` alone for grouping. Under the default dedup strategy
`ARTICLE_DEDUP_KEY = "linkedNote"` (`src/lib/writing-flags.ts:73-74`), that means the medium and
substack twins of the browser-request article group by `canonicalUrl` while their devto/hashnode
siblings group by `linkedNote` — see `src/lib/article-grouping.ts:23-45` for the fallback chain.

## Cross-references

### 1. Game-model node IDs → content slugs

`src/lib/game-model.ts:28-50` (`NODE_CONTENT`) maps **16** hero-graph node IDs to
`{ kind, slug }` pairs, covering all 5 Work slugs and all 11 Project slugs — a total bijection
with `content/work` + `content/projects`. The node list itself is `graphNodes` in
`src/lib/graph-data.ts:18-41` (16 entries). `resolveNode()` (`src/lib/game-model.ts:62-71`) looks
the slug up via `getWork`/`getProject`, returning `null` when absent, and `hrefFor()`
(`:74-76`) returns the Velite-derived `item.url`.

**The three intentional node-id / slug mismatches** (comment at `src/lib/game-model.ts:16-27`,
also recorded in `CLAUDE.md:306`):

| Graph node id | Content slug | Kind | Cite |
|---|---|---|---|
| `aava` | `aava-code` | work | `src/lib/game-model.ts:31` |
| `grpc` | `grpc-microservices` | project | `src/lib/game-model.ts:42` |
| `nhl` | `not-humans-lab` | project | `src/lib/game-model.ts:45` |

Every other node id equals its slug exactly. The docblock line `src/lib/game-model.ts:19` now
reads "3 of the **16** graph node ids" — the stale `10` this index previously recorded has since
been **fixed**, so the comment agrees with the 16 entries that `graphNodes`
(`src/lib/graph-data.ts:18-41`) and `NODE_CONTENT` (`src/lib/game-model.ts:28-50`) each hold
today. The bijection is guarded at build time by `src/lib/game-model.test.ts`
(`CLAUDE.md:306`, `ARCHITECTURE.md:96` — "it blocks deploys if orphaned").

`aava-code` is also hard-referenced outside the graph: `src/lib/agent-trace.ts:61` and `:75`
(`refs: ["aava-code", "mindforge"]`, `refs: ["aava-code"]`), the terminal's sample output comment
`src/components/game/terminal/fmt.ts:79`, and the card-parsing test fixture
`src/components/chat/parse-cards.test.ts:14`.

### 2. Corpus (chatbot grounding) → content

`src/lib/corpus.ts:13` `buildCorpus()` reads `allProjects, allWork, allNotes` (`:1`) — **not**
`allArticles`. Field-by-field:

- **Work** (`:14-21`): `name`, `role`, `register` (rendered as `Contribution: …`), `summary`,
  `metrics` flattened `value label` joined by `; `, and `tech`. All 5 items, in `order`.
- **Projects** (`:23-30`): `name`, `tagline`, `group`, optional `commits`, `repo`, `excerpt`,
  `tech`. All 11 items, in `order`.
- **Notes** (`:56-58`): `title` + `summary` only, emitted under `## Writing / Notes`, and only
  when `allNotes.length` is non-zero — so the section is present today (5 notes).
- Articles, note bodies, and Work `constraints`/`tradeoffs`/`body` never enter the corpus.

`src/lib/corpus.test.ts:13-18` asserts the corpus always contains `profile.name`,
`## Production Work`, and `## Skills`. The `register` string reaching the LLM verbatim is also
reinforced in the chat system prompt at `src/app/api/chat/route.ts:114`.

### 3. Resume → content

`src/lib/resume-json.ts:2` imports `allWork, allProjects`.

- `work[]` (`:27-33`): `position: w.role`, `summary: \`${w.register}. ${w.summary}\`` (**the
  register is prefixed into the résumé summary verbatim**, `:30`), `highlights` from
  `w.metrics` as `value label`, and `url: BASE + w.url`. All 5 Work items.
- `projects[]` (`:34-41`): `name`, `description: p.tagline`, `keywords: p.tech`,
  `url: p.repo`, `entity: BASE + p.url`. All 11 Project items.
- `education` is deliberately omitted (`src/lib/resume-json.ts:44` — "no data; we don't
  fabricate it"). Notes and Articles are not in the résumé JSON.

The printed `/resume` page (`src/app/resume/page.tsx`) does **not** import `@/lib/content`
directly (verified by grep) — it is tab/PDF-driven; `register` reaches recruiters through
`resume-json.ts` and through the `/work` pages (`src/app/work/page.tsx:53`,
`src/app/work/[slug]/page.tsx:57`, and the OG image at
`src/app/work/[slug]/opengraph-image.tsx:21`).

### 4. Home page featured lists

- **Featured work** — `src/components/home/featured-work.tsx:3` imports `allWork` and maps it
  in full at `:12`. There is no `featured` flag on the Work schema, so **all 5 Work case studies
  render**, in `order` (pensieve, aava-code, wireframe-generator, prompt-to-react,
  execution-engine).
- **Featured projects** — `src/components/home/featured-projects.tsx:3` imports
  `featuredProjects`, defined as `allProjects.filter((p) => p.featured)`
  (`src/lib/content.ts:23`). That resolves to **7** projects: `mindforge`, `graph-forge`,
  `agent-forge`, `tombstone`, `trelix`, `inkforge`, `grpc-microservices` (order-sorted).
  The 4 non-featured projects are `contextos`, `ag-bash`, `not-humans-lab`, `commandvault`.
- `pinnedProjects` (`src/lib/content.ts:26-28`) is the separate GitHub-pin-mirroring list:
  9 projects have `pinned: true` with a `pinRank`; `not-humans-lab` and `commandvault` are
  excluded. `src/lib/github.ts:29-40` (`REPO_ALLOWLIST`) is a third, independent list keyed on
  **GitHub repo names** (not slugs) — it includes `Thunderboard-Labs` and `Shop.this`, which have
  no content file, and omits `Tombstone`, `trelix`, and `Inkforge`, which do.

### 5. Article `linkedNote` → Note slug (three dangling references)

Verified against `.velite/notes.json` + `.velite/articles.json`: 5 Note slugs exist, and three
Article records point at slugs that do not:

| Article slug | `linkedNote` | Resolves? |
|---|---|---|
| `tombstone-v1-2-devto` | `tombstone-v1-2-release` | **no** |
| `trelix-v1-launch-devto` | `trelix-code-intelligence-engine` | **no** |
| `trelix-v1-launch-substack` | `trelix-code-intelligence-engine` | **no** |

Nothing validates this: `linkedNote` is a bare `s.string()` (`velite.config.ts:105`), and grep
across `src/**/*.test.ts*` finds no test referencing `linkedNote`. The consumers build the href
unconditionally — `src/components/article-card.tsx:18`
(`if (a.linkedNote) return { href: \`/notes/${a.linkedNote}\` … }`),
`src/components/article-group-card.tsx:21-22`, `src/app/articles/page.tsx:152-153`, and the
`redirect()` at `src/app/articles/[slug]/page.tsx:53-54` — all gated on `NOTES_ENABLED`.
Because `NOTES_ENABLED` defaults to **false** (`src/lib/writing-flags.ts:22-23`), those three
cards currently fall back to `externalUrl`, which all three have; the dangling links only become
reachable once `NEXT_PUBLIC_NOTES_ENABLED=true`. `src/lib/llms-txt.ts:27-28` builds the same
`/notes/<linkedNote>` URL for the AI-discovery file.

### 6. Slug namespace overlap

`s.slug()` is unique per *group*, not globally (`node_modules/velite/dist/index.js:5095`), so
`how-dns-works` legitimately exists twice: as `content/notes/how-dns-works.mdx` (group `note`,
→ `/notes/how-dns-works`) and as `content/articles/how-dns-works.mdx` (group `article`,
→ `/articles/how-dns-works`). The article is `source: native` with a `linkedNote` pointing at
its own name and no `externalUrl`, which makes it the "notes-only article" case explicitly
handled at `src/app/articles/[slug]/page.tsx:25` and `:65-66`: it is dropped from
`generateStaticParams` and returns nothing when `NOTES_ENABLED` is false.

## Detail

### `velite.config.ts`

- **Role:** Single source of truth for the content schemas and the Velite build output layout.
- **Exports:** `default` — the object returned by `defineConfig` (`:114-129`). The four
  `defineCollection` results (`projects`, `work`, `notes`, `articles`) and the `themeGroup` enum
  are module-local, surfaced only through the `collections` map at `:127`.
- **Reads / depends on:** `velite` (`defineConfig`, `defineCollection`, `s`). No env vars, no
  network. Input root `content/` (`:115`); writes `.velite/` (data) and `public/static/` (assets).
- **Consumed by:** the `velite` CLI in `package.json` scripts — `predev` (`velite`, no `--clean`),
  `build` (`velite --clean && vitest run && next build`), `content` (`velite --clean`).
  Its generated output is imported once, via the relative path `../../.velite`, by
  `src/lib/content.ts:5-14`; every other module goes through `@/lib/content`.
- **Behaviour notes:**
  - `clean: false` (`:125`) is deliberate. The comment at `:121-124` records why: `predev` +
    the dev watcher regenerate in place, and `--clean` in dev races webpack into
    "Can't resolve './projects.json'". Production purity comes from the explicit `--clean` in the
    `build`/`content` scripts, not from this config.
  - Asset pipeline: `assets: "public/static"`, `base: "/static/"`,
    `name: "[name]-[hash:6].[ext]"` (`:118-120`). Work `diagram` paths are documented as
    `/static/...` (`:51`) to match this base — and `case-study-depth.test.ts:21-27` resolves them
    under `public/`.
  - `mdx: { gfm: true }` (`:128`) — GitHub-flavoured markdown for all four collections,
    including the `.md` Inkforge notes.
  - Each collection's `.transform()` is the only place `url` is created; nothing else in the repo
    constructs `/work/<slug>` or `/projects/<slug>` by hand (`src/lib/game-model.ts:75` returns
    `resolved.item.url` and comments as much).
- **Gotchas / invariants:**
  - Renaming a collection key in `collections` (`:127`) renames the generated `.velite/*.json`
    file and breaks the destructured import at `src/lib/content.ts:5-14`.
  - Adding a required field to Work or Project fails the Velite build for *every existing file*
    at once; that is why all the hiring-manager depth fields at `:49-52` are `.optional()`.
  - `register` (`:42`) is required by Zod and is the only schema-level enforcement of the
    "never fabricate ownership" rule (`CLAUDE.md:347`, `ARCHITECTURE.md:95`). Making it optional
    would silently drop attribution from the corpus (`src/lib/corpus.ts:17`) and the résumé
    (`src/lib/resume-json.ts:30`).
  - `diagramAlt` (`:52`) is *not* conditionally required in Zod — the a11y guarantee lives only
    in `src/lib/case-study-depth.test.ts:12-16`. Deleting that test removes the guard.
  - `externalUrl` (`:103`) and `linkedNote` (`:105`) carry their invariants in comments only;
    both are currently violated in `content/articles/` (see Cross-references §5).
  - `s.number()` on `commits`/`wordCount`/`readingTime` means these are numbers in YAML, not
    strings; `metrics[].value` is the reverse — an `s.string()` (`:44`) so `"1.5h → 15m"` and
    `"65% → 85%"` are legal.

### `content/notes/how-i-traced-one-browser-request-from-keystroke-to-rendered-page.mdx`

- **Role:** The one content file whose `.mdx` extension is load-bearing.
- **Behaviour notes:** It contains 10 MDX comment expressions of the form
  `{/* DIAGRAM: Upload assets/diagram-full-journey.png here */}` and
  `{/* GIF: Search giphy.com … */}` (first pair at lines 30-32). These are JSX expression
  containers — valid MDX, invalid plain Markdown — so they are silently stripped from the rendered
  output rather than displayed. `content/notes/how-dns-works.mdx` is `.mdx` too but contains zero
  such constructs (verified by grep), so its extension is stylistic.
- **Gotchas / invariants:** `CLAUDE.md:161` states "`.md` files come from the Inkforge pipeline
  and carry extended frontmatter … Hand-written `.mdx` notes omit these fields". That mapping does
  not hold in the current corpus: both `.mdx` notes carry `generatedBy: inkforge` and the full
  extended field set. Extension is therefore **not** a reliable proxy for provenance — use
  `generatedBy` (which is what `src/lib/content.ts:56` and `:61` actually filter on).

### `content/articles/*.mdx` (all 15, as a class)

- **Role:** Frontmatter-only "curator" pointers, not article bodies. Every file is 11-13 lines and
  ends immediately after the closing `---`; `.velite/articles.json` confirms `body: ""` for all 15.
- **Behaviour notes:** The schema comment (`velite.config.ts:87-92`) says native articles "render
  their body inline like notes" — the one `source: native` file
  (`content/articles/how-dns-works.mdx`) has no body, and instead sets
  `linkedNote: how-dns-works`, so the native-inline path is unexercised today.
- **Gotchas / invariants:** Multi-platform twins share `title`, `date`, `summary`, `tags`, and
  `readingTime` verbatim and differ only in `slug`, `source`, and `externalUrl`. Dedup for the
  `/articles` page, the RSS feed, and `llms.txt` depends on `canonicalUrl`/`linkedNote` agreeing
  across the twins (`src/lib/article-grouping.ts:42-45`); editing one twin's `canonicalUrl`
  without the other splits the group into two cards. Dates are also not always equal across twins
  — the browser-request set spans 2026-06-19 (medium, substack) and 2026-06-20 (devto, hashnode),
  which decides which member becomes the group's "newest" primary (`:33`).

## Coverage

- `velite.config.ts`
- `content/work/aava-code.mdx`
- `content/work/execution-engine.mdx`
- `content/work/pensieve.mdx`
- `content/work/prompt-to-react.mdx`
- `content/work/wireframe-generator.mdx`
- `content/projects/ag-bash.mdx`
- `content/projects/agent-forge.mdx`
- `content/projects/commandvault.mdx`
- `content/projects/contextos.mdx`
- `content/projects/graph-forge.mdx`
- `content/projects/grpc-microservices.mdx`
- `content/projects/inkforge.mdx`
- `content/projects/mindforge.mdx`
- `content/projects/not-humans-lab.mdx`
- `content/projects/tombstone.mdx`
- `content/projects/trelix.mdx`
- `content/notes/.gitkeep`
- `content/notes/feature-flags-at-scale-distributed-control-system.md`
- `content/notes/how-dns-works.mdx`
- `content/notes/how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-bedrock.md`
- `content/notes/how-i-built-tombstone-feature-flag-intelligence-platform.md`
- `content/notes/how-i-traced-one-browser-request-from-keystroke-to-rendered-page.mdx`
- `content/articles/feature-flags-at-scale-devto.mdx`
- `content/articles/feature-flags-at-scale-substack.mdx`
- `content/articles/how-dns-works-devto.mdx`
- `content/articles/how-dns-works-hashnode.mdx`
- `content/articles/how-dns-works.mdx`
- `content/articles/how-i-traced-one-browser-request-devto.mdx`
- `content/articles/how-i-traced-one-browser-request-hashnode.mdx`
- `content/articles/how-i-traced-one-browser-request-medium.mdx`
- `content/articles/how-i-traced-one-browser-request-substack.mdx`
- `content/articles/inkforge-build-devto.mdx`
- `content/articles/tombstone-launch-devto.mdx`
- `content/articles/tombstone-launch-substack.mdx`
- `content/articles/tombstone-v1-2-devto.mdx`
- `content/articles/trelix-v1-launch-devto.mdx`
- `content/articles/trelix-v1-launch-substack.mdx`

## UNVERIFIED

- I did not read the full bodies of the 3 longest `.md` notes end-to-end (I read the complete
  frontmatter plus the opening sections of `how-i-built-inkforge-…`,
  `how-i-built-tombstone-…`, and `how-i-traced-one-browser-request-…`, and the complete
  bodies of `feature-flags-at-scale-…` and `how-dns-works.mdx`). All frontmatter in scope was
  read in full, from every file.
- `wordCount` / `readingTime` values in Note frontmatter are taken as authored; I did not
  recount words to confirm they match the bodies.
- I did not run `pnpm test`, so I have not observed `game-model.test.ts` or
  `case-study-depth.test.ts` pass/fail; their assertions are quoted from source.
- The `.velite/` snapshot I inspected is dated 15 Aug (build artifact) while the content files are
  dated 28 Jun; the two agreed on every field I spot-checked, but I did not re-run
  `pnpm content` to regenerate it.
