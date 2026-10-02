---
kind: doc
title: Content Corpus & Velite Schemas
domain: [content]
status: current
version: v3.12.0
---

# Content Corpus & Velite Schemas

> Part of the Anvilry v3.12.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
>
> Describes Anvilry v3.12.0 (`package.json` 3.12.0), i.e. `main` at a929932 plus five post-a929932 fixes. The one that matters here: notes are hidden at the data layer when `NOTES_ENABLED` is off (`allNotes` is empty and note-only articles are dropped from `allArticles`; see Cross-references §5). The others (per-class rate-limit buckets, shared admin auth, voice-gated command palette, `MIN_ROUTES` and dead-component removal) do not touch this file's scope.

**Scope:** `velite.config.ts`, `content/work/*.mdx` (5), `content/projects/*.mdx` (11), `content/notes/*.{md,mdx}` (7) + `content/notes/.gitkeep`, `content/articles/*.mdx` (15)
**Files indexed:** 40 (39 content/config files + `.gitkeep`)

## At a glance

| File | Role | Key exports |
|---|---|---|
| `velite.config.ts` | Defines the 4 Velite collections (Project, Work, Note, Article) with Zod schemas + `url` transforms and a shared `decision` object; sets output dir `.velite`, asset dir `public/static`, `clean: false`, `mdx.gfm: true` | `default` (Velite config via `defineConfig`); module-local `themeGroup`, `decision`, `projects`, `work`, `notes`, `articles` |
| `content/work/pensieve.mdx` | Work case study — AI process-orchestration engine at Ascendion; `order: 1` (first in `allWork`) | frontmatter data (no code exports) |
| `content/work/aava-code.mdx` | Work case study — multi-agent VS Code coding plugin; `order: 2`; the node-id mismatch target `aava` → `aava-code` | frontmatter data |
| `content/work/wireframe-generator.mdx` | Work case study — GenAI wireframe generator over SSE; `order: 3` | frontmatter data |
| `content/work/prompt-to-react.mdx` | Work case study — wireframe → React component/routing codegen; `order: 4` | frontmatter data |
| `content/work/execution-engine.mdx` | Work case study — prompt-driven RAG + ReAct artifact engine; `order: 5` | frontmatter data |
| `content/projects/mindforge.mdx` | Project — agentic-intelligence framework for Claude Code; `order: 1`, 1677 commits, `featured: true` | frontmatter data |
| `content/projects/graph-forge.mdx` | Project — Neo4j + Chroma code-intelligence platform, ~19 microservices; `order: 2`, `featured: true`; no `dateCreated`/`license` | frontmatter data |
| `content/projects/agent-forge.mdx` | Project — self-improving agent loop over git-versioned `AGENT.md`; `order: 3`, `pinRank: 1`, `featured: true`; no `dateCreated`/`license` | frontmatter data |
| `content/projects/contextos.mdx` | Project — intelligence/resilience layer, 3 npm packages + 3D dashboard; `order: 4`, `featured: false` | frontmatter data |
| `content/projects/ag-bash.mdx` | Project — TypeScript AI-native bash interpreter over WASM runtimes; `order: 5`, `featured: false` | frontmatter data |
| `content/projects/tombstone.mdx` | Project — feature-flag intelligence platform; `order: 5` (ties ag-bash), `featured: true`; `relatedArticles` x2 | frontmatter data |
| `content/projects/not-humans-lab.mdx` | Project — governance layer over three personal sub-projects; `order: 6`, `pinned: false`, `commits: 2` | frontmatter data |
| `content/projects/trelix.mdx` | Project — offline code intelligence engine, 7-leg RRF retrieval; `order: 6` (ties not-humans-lab), `featured: true`; `relatedArticles` x1 | frontmatter data |
| `content/projects/commandvault.mdx` | Project — universal AI command manager; `order: 7`, `pinned: false` | frontmatter data |
| `content/projects/inkforge.mdx` | Project — STORM + BM25 article generation/publishing pipeline; `order: 7` (ties commandvault), `featured: true`; `relatedArticles` x1 | frontmatter data |
| `content/projects/grpc-microservices.mdx` | Project — event-driven Go+Python order-processing backend; `order: 8`; the only project with **no** `commits` field | frontmatter data |
| `content/notes/.gitkeep` | Single-line comment placeholder ("Empty by design — the /notes section ships dark until real posts exist"); keeps the dir tracked | n/a (108-byte comment file) |
| `content/notes/feature-flags-at-scale-distributed-control-system.md` | Inkforge-generated note (3401 words) on feature flags as a distributed control plane | frontmatter + MDX body |
| `content/notes/how-dns-works.mdx` | Inkforge-generated note (3784 words) on DNS resolution/caching/failure modes; `.mdx` despite `generatedBy: inkforge`; **no** `category` field | frontmatter + MDX body |
| `content/notes/how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-bedrock.md` | Inkforge note (3751 words) — first-person build log of Inkforge's STORM/BM25/Bedrock design | frontmatter + MDX body |
| `content/notes/how-i-built-tombstone-feature-flag-intelligence-platform.md` | Inkforge note (3531 words) — first-person build log of Tombstone, keyed on the Knight Capital `POWER_PHLX` incident | frontmatter + MDX body |
| `content/notes/how-i-traced-one-browser-request-from-keystroke-to-rendered-page.mdx` | Inkforge note (2068 words) — keystroke→render walkthrough; the only content file containing MDX comment expressions (`{/* … */}`, 10 occurrences) | frontmatter + MDX body |
| `content/notes/tombstone-v1-2-release.mdx` | Hand-authored note (no `generatedBy`, no `wordCount`) — post-mortem of nine bugs found pressure-testing Tombstone v1.0; `category: incident-response`, `readingTime: 9` | frontmatter + MDX body |
| `content/notes/trelix-code-intelligence-engine.mdx` | Hand-authored note (no `generatedBy`, no `wordCount`) — how trelix was built; `category: developer-tools`, `readingTime: 9` | frontmatter + MDX body |
| `content/articles/how-dns-works.mdx` | Article, `source: native`, `linkedNote: how-dns-works`, no `externalUrl`/`canonicalUrl`; body is empty | frontmatter only |
| `content/articles/how-dns-works-devto.mdx` | Article, `source: devto`, links to the `how-dns-works` note | frontmatter only |
| `content/articles/how-dns-works-hashnode.mdx` | Article, `source: hashnode`, **`draft: true`** — the only draft in the corpus | frontmatter only |
| `content/articles/feature-flags-at-scale-devto.mdx` | Article, `source: devto`, linked to the feature-flags note | frontmatter only |
| `content/articles/feature-flags-at-scale-substack.mdx` | Article, `source: substack`, same canonical/note as the devto twin | frontmatter only |
| `content/articles/how-i-traced-one-browser-request-devto.mdx` | Article, `source: devto`, linked to the browser-request note | frontmatter only |
| `content/articles/how-i-traced-one-browser-request-hashnode.mdx` | Article, `source: hashnode`, linked to the browser-request note | frontmatter only |
| `content/articles/how-i-traced-one-browser-request-medium.mdx` | Article, `source: medium`; has `canonicalUrl` **and** `linkedNote` | frontmatter only |
| `content/articles/how-i-traced-one-browser-request-substack.mdx` | Article, `source: substack`; has `canonicalUrl` **and** `linkedNote` | frontmatter only |
| `content/articles/inkforge-build-devto.mdx` | Article, `source: devto`, linked to the Inkforge build note | frontmatter only |
| `content/articles/tombstone-launch-devto.mdx` | Article, `source: devto`, linked to the Tombstone build note | frontmatter only |
| `content/articles/tombstone-launch-substack.mdx` | Article, `source: substack`, retitled ("I Built Tombstone Because I Was Tired of 2am Flag Incidents"), same `linkedNote` | frontmatter only |
| `content/articles/tombstone-v1-2-devto.mdx` | Article, `source: devto`; `linkedNote: tombstone-v1-2-release`; its `externalUrl` and `canonicalUrl` are both the internal `anvilry.vercel.app/notes/tombstone-v1-2-release` URL (a self-link) | frontmatter only |
| `content/articles/trelix-v1-launch-devto.mdx` | Article, `source: devto`; `linkedNote: trelix-code-intelligence-engine` | frontmatter only |
| `content/articles/trelix-v1-launch-substack.mdx` | Article, `source: substack`; same `linkedNote: trelix-code-intelligence-engine` | frontmatter only |

## Schemas

All four collections are declared in `velite.config.ts` and registered at `velite.config.ts:155`
(`collections: { projects, work, notes, articles }`). Global config: `root: "content"`
(`velite.config.ts:143`), data output `.velite`, asset output `public/static` served from base
`/static/` with filename pattern `[name]-[hash:6].[ext]` (`velite.config.ts:144-148`),
`clean: false` (`velite.config.ts:153`), and `mdx: { gfm: true }` (`velite.config.ts:156`).

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

### Project (`velite.config.ts:19-50`) — pattern `projects/**/*.mdx`

| Field | Zod type | Req/Opt | Transform / default | Cite |
|---|---|---|---|---|
| `slug` | `s.slug("project")` | required | unique in `slug:project` | `:25` |
| `name` | `s.string()` | required | — | `:26` |
| `tagline` | `s.string()` | required | — | `:27` |
| `group` | `s.enum([...])` | required | one of `"Agent Frameworks & Infrastructure"`, `"Code Intelligence & Engines"`, `"Tooling & Lab"` | `:28`, enum at `:4-8` |
| `repo` | `s.string().url()` | required | must be a valid URL | `:29` |
| `commits` | `s.number()` | **optional** | — | `:30` |
| `dateCreated` | `s.isodate()` | **optional** | real GitHub repo creation date; omitted (not fabricated) for private repos (404 unauthenticated) — unset on `graph-forge` and `agent-forge` | `:34` |
| `license` | `s.string()` | **optional** | SPDX ID; omitted where the repo has no license file — unset on `graph-forge`, `agent-forge`, `grpc-microservices` | `:35` |
| `relatedArticles` | `s.array(s.string())` | **optional** | Article slugs documenting the project; **no referential check** (set on `tombstone`, `trelix`, `inkforge` only) | `:39` |
| `decisions` | `s.array(decision)` | optional | `.default([])`; `decision` = `{ title, body, tags (default []) }` (`:13-17`), migrated verbatim from the former "## Key Decisions" MDX section; all 11 projects carry 3 (33 total) | `:40` |
| `tech` | `s.array(s.string())` | required | — | `:41` |
| `pinned` | `s.boolean()` | optional | `.default(false)` | `:42` |
| `pinRank` | `s.number()` | **optional** | — | `:43` |
| `featured` | `s.boolean()` | optional | `.default(false)` | `:44` |
| `order` | `s.number()` | optional | `.default(100)` | `:45` |
| `body` | `s.mdx()` | required | compiled MDX | `:46` |
| `excerpt` | `s.string()` | required | — | `:47` |
| `url` | — (derived) | added | `.transform((data) => ({ ...data, url: \`/projects/${data.slug}\` }))` | `:49` |

The `themeGroup` enum (`velite.config.ts:4-8`) is duplicated as a literal tuple in
`src/lib/content.ts:31-35` (`projectGroups`) — the ordering there drives `/projects` section order.
`dateCreated`/`license` feed `SoftwareSourceCodeJsonLd`; `relatedArticles` is resolved by
`src/app/projects/[slug]/page.tsx:83-85` via `getArticle` (unknown slugs are silently dropped) and
rendered by `src/components/related-writing.tsx`.

### Work (`velite.config.ts:53-75`) — pattern `work/**/*.mdx`

| Field | Zod type | Req/Opt | Transform / default | Cite |
|---|---|---|---|---|
| `slug` | `s.slug("work")` | required | unique in `slug:work` | `:58` |
| `name` | `s.string()` | required | — | `:59` |
| `role` | `s.string()` | required | — | `:60` |
| `register` | `s.string()` | **required** | honest contribution note, e.g. `"Co-built · architected the backend"` | `:61` |
| `summary` | `s.string()` | required | — | `:62` |
| `metrics` | `s.array(s.object({ value: s.string(), label: s.string() }))` | required | `value` is a **string**, not a number | `:63` |
| `tech` | `s.array(s.string())` | required | — | `:64` |
| `order` | `s.number()` | optional | `.default(100)` | `:65` |
| `constraints` | `s.string()` | **optional** | renders only when present; also a decisions-ledger source | `:68` |
| `tradeoffs` | `s.string()` | **optional** | renders only when present; also a decisions-ledger source | `:69` |
| `diagram` | `s.string()` | **optional** | path to an owner-authored diagram (e.g. `/static/...`) | `:70` |
| `diagramAlt` | `s.string()` | **optional** | comment marks it "REQUIRED alt text when `diagram` is set (a11y) — asserted in a test" | `:71` |
| `body` | `s.mdx()` | required | compiled MDX | `:72` |
| `url` | — (derived) | added | `.transform(... url: \`/work/${data.slug}\`)` | `:74` |

There is **no `featured` field on Work** — the home page's "featured work" list is
`allWork` in full (`src/components/home/featured-work.tsx:12`).
`diagramAlt` is not enforced by Zod; the coupling is a test:
`src/lib/case-study-depth.test.ts:12-22` asserts non-empty `diagramAlt` whenever `diagram` is set,
`:24-36` asserts the asset exists under `public/`, `:38-53` asserts `constraints`/`tradeoffs`
are >20 chars and free of `TODO|TBD|lorem`, and `:55-72` applies the same prose check to every
project `decisions[]` entry (title >3 chars, body >20 chars).

### Note (`velite.config.ts:81-106`) — pattern `notes/**/*.{md,mdx}`

| Field | Zod type | Req/Opt | Transform / default | Cite |
|---|---|---|---|---|
| `slug` | `s.slug("note")` | required | unique in `slug:note` | `:86` |
| `title` | `s.string()` | required | — | `:87` |
| `date` | `s.isodate()` | required | → ISO string | `:88` |
| `summary` | `s.string()` | required | — | `:89` |
| `tags` | `s.array(s.string())` | optional | `.default([])` | `:90` |
| `draft` | `s.boolean()` | optional | `.default(false)` | `:91` |
| `tone` | `s.enum(["beginner","intermediate","senior"])` | **optional** | Inkforge metadata | `:93` |
| `format` | `s.enum(["tutorial","narrative","explainer","opinion","showcase"])` | **optional** | Inkforge metadata | `:94-96` |
| `length` | `s.enum(["thread","short","medium","comprehensive"])` | **optional** | Inkforge metadata | `:97` |
| `wordCount` | `s.number()` | **optional** | — | `:98` |
| `readingTime` | `s.number()` | **optional** | minutes | `:99` |
| `generatedBy` | `s.string()` | **optional** | free-form string, **not** an enum; `"inkforge"` is the only value in use, and 2 of the 7 notes omit it | `:100` |
| `category` | `s.string()` | **optional** | free-form | `:101` |
| `platforms` | `s.array(s.string())` | optional | `.default([])` | `:102` |
| `body` | `s.mdx()` | required | compiled MDX (both `.md` and `.mdx` go through the MDX compiler) | `:103` |
| `url` | — (derived) | added | `.transform(... url: \`/notes/${data.slug}\`)` | `:105` |

### Article (`velite.config.ts:114-140`) — pattern `articles/**/*.{md,mdx}`

| Field | Zod type | Req/Opt | Transform / default | Cite |
|---|---|---|---|---|
| `slug` | `s.slug("article")` | required | unique in `slug:article` | `:119` |
| `title` | `s.string()` | required | — | `:120` |
| `date` | `s.isodate()` | required | → ISO string | `:121` |
| `summary` | `s.string()` | required | — | `:122` |
| `source` | `s.enum(["medium","substack","linkedin","devto","hashnode","native"])` | required | `linkedin` is in the enum but no file uses it | `:123-130` |
| `externalUrl` | `s.string().url()` | **optional** | comment: "required for non-native; omit for native" — **not enforced by the schema**; an empty string fails `.url()` (logged, non-fatal; see Detail) | `:131` |
| `canonicalUrl` | `s.string().url()` | **optional** | SEO canonical | `:132` |
| `linkedNote` | `s.string()` | **optional** | plain string, **no referential check** against Note slugs | `:133` |
| `tags` | `s.array(s.string())` | optional | `.default([])` | `:134` |
| `draft` | `s.boolean()` | optional | `.default(false)` | `:135` |
| `readingTime` | `s.number()` | **optional** | estimated minutes | `:136` |
| `body` | `s.mdx()` | required | compiled MDX; every shipped Article body is `""` | `:137` |
| `url` | — (derived) | added | `.transform(... url: \`/articles/${data.slug}\`)` | `:139` |

Note the unenforced invariants written as comments only: `externalUrl` "required for
non-native" (`velite.config.ts:131`) and `linkedNote` "slug of an existing /notes entry"
(`velite.config.ts:133`). Neither is a Zod refinement, and no test enforces either
(`relatedArticles` at `:39` is likewise unchecked). Today both hold in the data: every non-native
article has an `externalUrl` and all 7 distinct `linkedNote` values resolve to a real note — see
"Cross-references" §5.

## Content inventory

### Work — 5 files, `content/work/*.mdx`

`register` strings are reproduced **verbatim**; the `CLAUDE.md` "Content Authorship Rules" section and the
`ARCHITECTURE.md` "Never fabricate metrics" invariant declare this field the canonical
contribution-attribution source.

| slug | name / title | role | `register` (verbatim) | order | metrics (value ▸ label) | tech |
|---|---|---|---|---|---|---|
| `pensieve` | Pensieve | AI Process-Orchestration Engine · Ascendion | `Co-built · production-hardened` | 1 | `2K+` ▸ daily users across domains; `HITL` ▸ approval gates; `Multi-cloud` ▸ governed LLM routing | Python, LLM Orchestration, Multi-Agent, SSE, Redis Streams, Cloud Routing |
| `aava-code` | AAVA Code | AI Coding Plugin for VS Code · Ascendion | `Co-built · architected the backend` | 2 | `3K+` ▸ daily users; `5+` ▸ client environments; `150+` ▸ skills · 40+ tools · ~60 commands | Python, crewAI, Multi-Agent, VS Code, Backend Architecture |
| `wireframe-generator` | Wireframe Generator | GenAI Wireframe Generator · Ascendion | `Co-built · production-ready` | 3 | `40%` ▸ fewer UX iteration cycles (5 rounds → 3); `60%` ▸ faster prototyping; `500+` ▸ users daily | GenAI, Angular, SSE, Real-Time Rendering, Backend Stream Handling |
| `prompt-to-react` | Prompt-to-React | Prompt-to-React Code Generation · Ascendion | `Co-built · production-ready` | 4 | `50%` ▸ less frontend dev time (2 days → 1 per feature); `55%` ▸ less manual coding effort; `2K+` ▸ developers; `50+` ▸ teams | React, Code Generation, Modular Components, Routing Logic, Wireframe Input |
| `execution-engine` | Execution Engine | Prompt-Driven Execution Engine · Ascendion | `Co-built` | 5 | `1.5h → 15m` ▸ workflow planning time; `65% → 85%` ▸ first-pass acceptance; `1.5K+` ▸ users | LLM Agent Orchestration, RAG, ReAct, Prompt-Driven |

All 5 Work files set `constraints` **and** `tradeoffs` (10 ledger entries). **None** sets `diagram` or
`diagramAlt`, so `case-study-depth.test.ts`'s diagram assertions (`:12-36`) are currently vacuous.
Every Work body follows the same H2 shape — `## Problem`, `## Approach`, `## Impact` — closed by a
`> **Contribution:** …` blockquote that restates the register in prose
(e.g. `content/work/aava-code.mdx:31`). The `make new-work` scaffold does **not** follow this shape
(it emits `## What I Built`, no `constraints`/`tradeoffs`).

### Project — 11 files, `content/projects/*.mdx`

| slug | name | group | repo | commits | pinned / pinRank | featured | order | dateCreated · license | tagline |
|---|---|---|---|---|---|---|---|---|---|
| `mindforge` | MindForge | Agent Frameworks & Infrastructure | `github.com/sairam0424/MindForge` | 1677 | true / 6 | **true** | 1 | 2026-03-19 · MIT | Agentic-intelligence framework for Claude Code. |
| `graph-forge` | Graph-Forge | Code Intelligence & Engines | `github.com/sairam0424/Graph-Forge` | 612 | true / 2 | **true** | 2 | — | AI-native distributed code-intelligence platform. |
| `agent-forge` | Agent-Forge | Agent Frameworks & Infrastructure | `github.com/sairam0424/Agent-Forge` | 201 | true / 1 | **true** | 3 | — | Self-improving AI agent infrastructure. |
| `contextos` | ContextOS | Agent Frameworks & Infrastructure | `github.com/sairam0424/ContextOS` | 190 | true / 5 | false | 4 | 2026-03-30 · MIT | Intelligence layer for autonomous AI agents. |
| `ag-bash` | ag-bash | Code Intelligence & Engines | `github.com/sairam0424/ag-bash` | 449 | true / 4 | false | 5 | 2026-04-14 · Apache-2.0 | AI-native bash interpreter, in TypeScript. |
| `tombstone` | Tombstone | Agent Frameworks & Infrastructure | `github.com/sairam0424/Tombstone` | 775 | true / 4 | **true** | 5 | 2026-06-21 · MIT | Production intelligence layer for 5,000+ feature flags. |
| `not-humans-lab` | Not-Humans-Lab | Tooling & Lab | `github.com/sairam0424/not-humans-lab` | 2 | false / — | false | 6 | 2026-09-02 · Apache-2.0 | Governance layer over three personal sub-projects. |
| `trelix` | Trelix | Code Intelligence & Engines | `github.com/sairam0424/trelix` | 1192 | true / 5 | **true** | 6 | 2026-06-25 · MIT | Offline code intelligence engine — Tree-sitter indexing, hybrid BM25+vector+graph search. |
| `commandvault` | CommandVault | Tooling & Lab | `github.com/sairam0424/CommandVault` | 140 | false / — | false | 7 | 2026-05-01 · MIT | Universal AI command manager. |
| `inkforge` | Inkforge | Tooling & Lab | `github.com/sairam0424/Inkforge` | 89 | true / 7 | **true** | 7 | 2026-06-19 · MIT | Notes, topics, or code → published technical articles. |
| `grpc-microservices` | Order Processing System | Code Intelligence & Engines | `github.com/sairam0424/gRPC-micro-services` | *(absent)* | true / 3 | **true** | 8 | 2026-02-07 · — | Distributed, event-driven gRPC microservices. |

**Duplicate `order` values:** 5 (`ag-bash`, `tombstone`), 6 (`not-humans-lab`, `trelix`),
7 (`commandvault`, `inkforge`). **Duplicate `pinRank` values:** 4 (`ag-bash`, `tombstone`),
5 (`contextos`, `trelix`); `inkforge` has `pinRank: 7`, past the "rank 1..6" comment above
`pinnedProjects` in `src/lib/content.ts`. Since `src/lib/content.ts:19-22` and `:27-29` use plain numeric
comparators, tied items keep whatever relative order the Velite file walk produced — the
displayed order among ties is not pinned by the frontmatter.

`grpc-microservices` is the only project without `commits`; the corpus builder guards this with
`p.commits ? \` · ${p.commits} commits\` : ""` (`src/lib/corpus.ts:26-28`).
`not-humans-lab` has `commits: 2` (it was 289 in an earlier revision of this index); the value
flows verbatim into the corpus and the project page and has not been reconciled with the live repo.
`slug: grpc-microservices` does **not** match its repo name `gRPC-micro-services`
(`content/projects/grpc-microservices.mdx:6`), and `name: Order Processing System` does not match
the slug either — the only project where all three differ.

`content/projects/trelix.mdx` ships a self-contradicting figure: the `excerpt` (`:16`) cites 1,467
unit tests, the pull-quote (`:37`) cites 929 unit + 16 integration tests at a 75% coverage gate, and an
in-body note (`:58`) states that the two disagree and neither matches the repo. Hard-coded counts in
frontmatter (`commits`, test counts, user counts) are static and are not re-verified against live repos.

### Note — 7 content files (+ `.gitkeep`), `content/notes/*.{md,mdx}`

No Note is a draft, so `publishedNotes.length === 7` always; `allNotes.length` is 7 only when
`NOTES_ENABLED` is on and **0** otherwise (see §5).

| slug | ext | title | date | tone | format | length | category | wordCount | readingTime | generatedBy | platforms | tags |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `feature-flags-at-scale-distributed-control-system` | `.md` | Feature Flags at Scale: Designing a Distributed Control System for Production Behavior | 2026-06-20 | senior | explainer | comprehensive | `system-design` | 3401 | 13 | `inkforge` | `[]` | feature-flags, system-design, distributed-systems, devops, engineering |
| `how-dns-works` | `.mdx` | How DNS Actually Works: Resolution Hierarchy, Caching, and Production Failure Modes | 2026-06-19 | senior | explainer | comprehensive | *(absent)* | 3784 | 14 | `inkforge` | `[]` | dns, distributed-systems, networking, system-design, infrastructure |
| `how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-bedrock` | `.md` | How I Built Inkforge: Designing an AI-Powered Article System with STORM Pipeline, BM25 RAG, and AWS Bedrock | 2026-06-20 | senior | narrative | comprehensive | `general` | 3751 | 14 | `inkforge` | `[]` | inkforge, typescript, ai, buildinpublic, rag, aws-bedrock |
| `how-i-built-tombstone-feature-flag-intelligence-platform` | `.md` | How I Built Tombstone: A Self-Hosted Feature Flag Intelligence Platform to Prevent the Next Knight Capital | 2026-06-27 | senior | narrative | comprehensive | `system-design` | 3531 | 13 | `inkforge` | `[]` | feature-flags, system-design, open-source, devops, incident-response, distributed-systems |
| `how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | `.mdx` | How I Traced One Browser Request from Keystroke to Rendered Page | 2026-06-19 | intermediate | narrative | medium | `system-design` | 2068 | 8 | `inkforge` | `[]` | networking, dns, tls, http, system-design, browser |
| `tombstone-v1-2-release` | `.mdx` | We Shipped Tombstone v1.0. Then We Found Nine Bugs That Would Have Paged Us at 2am. | 2026-07-05 | senior | narrative | comprehensive | `incident-response` | *(absent)* | 9 | *(absent)* | `[]` | devops, open-source, system-design, go, feature-flags, incident-response |
| `trelix-code-intelligence-engine` | `.mdx` | I Built trelix Because I Was Tired of Grepping My Way Through Codebases | 2026-07-05 | senior | narrative | comprehensive | `developer-tools` | *(absent)* | 9 | *(absent)* | `[]` | python, open-source, ai, code-search, developer-tools, mcp |

The five June notes carry the full Inkforge extended set except `category`, which
`content/notes/how-dns-works.mdx` omits; the two 2026-07-05 notes carry no `generatedBy` and no
`wordCount`. Consequently **`inkforgeNotes` / `inkforgeArticles` (`src/lib/content.ts:62`,
`:67`) match 5 of the 7 notes** (and are empty while `NOTES_ENABLED` is off, because they derive
from `allNotes`); the other 2 are the hand-authored ones. File extension is not a provenance
signal: both `.mdx` notes among the five carry `generatedBy: inkforge`, while the two hand-authored
notes are `.mdx` as well.

`content/notes/.gitkeep` is not empty: it holds one comment line —
"`# Notes content lives here (MDX). Empty by design — the /notes section ships dark until real
posts exist.`" That statement is stale relative to the 7 shipped notes; the actual dark/live
gate is `NOTES_ENABLED` (`src/lib/writing-flags.ts:22`, default **false** unless
`NEXT_PUBLIC_NOTES_ENABLED === "true"`), applied at the data layer (`allNotes` in
`src/lib/content.ts`, documented at `:54-55`). The header of `src/lib/notes.test.ts:4-8` and the
comment at `src/lib/corpus.ts:73-74` still describe the older "empty collection = dark" model.

### Article — 15 files, `content/articles/*.mdx`

`readingTime` (RT) in minutes. Host column abbreviates `externalUrl`'s origin; full URLs are in
the files. Only `how-dns-works-hashnode` is a draft. `allArticles` is 14 with notes on and **12**
with notes off (the default): `how-dns-works` (native, no `externalUrl`) and `tombstone-v1-2-devto`
(self-link `externalUrl`) are dropped as note-only articles.

| slug | title | date | source | externalUrl host | canonicalUrl | linkedNote | RT | draft |
|---|---|---|---|---|---|---|---|---|
| `how-dns-works` | How DNS Actually Works: … | 2026-06-19 | `native` | *(none)* | *(none)* | `how-dns-works` | 14 | false |
| `how-i-traced-one-browser-request-medium` | How I Traced One Browser Request … | 2026-06-19 | `medium` | `medium.com/@uggesairam0000` | `/notes/how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | `how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | 8 | false |
| `how-i-traced-one-browser-request-substack` | How I Traced One Browser Request … | 2026-06-19 | `substack` | `sairam0000.substack.com` | same as above | `how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | 8 | false |
| `feature-flags-at-scale-devto` | Feature Flags at Scale: … | 2026-06-20 | `devto` | `dev.to/sai_ram_0000` | `/notes/feature-flags-at-scale-distributed-control-system` | `feature-flags-at-scale-distributed-control-system` | 13 | false |
| `feature-flags-at-scale-substack` | Feature Flags at Scale: … | 2026-06-20 | `substack` | `sairam0000.substack.com` | same as above | `feature-flags-at-scale-distributed-control-system` | 13 | false |
| `how-dns-works-devto` | How DNS Actually Works: … | 2026-06-20 | `devto` | `dev.to/sai_ram_0000` | `/notes/how-dns-works` | `how-dns-works` | 14 | false |
| `how-dns-works-hashnode` | How DNS Actually Works: … | 2026-06-20 | `hashnode` | `sairam0000.hashnode.dev` | `/notes/how-dns-works` | `how-dns-works` | 14 | **true** |
| `how-i-traced-one-browser-request-devto` | How I Traced One Browser Request … | 2026-06-20 | `devto` | `dev.to/sai_ram_0000` | `/notes/how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | `how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | 8 | false |
| `how-i-traced-one-browser-request-hashnode` | How I Traced One Browser Request … | 2026-06-20 | `hashnode` | `sairam0000.hashnode.dev` | same as above | `how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | 8 | false |
| `inkforge-build-devto` | How I Built Inkforge: … | 2026-06-27 | `devto` | `dev.to/sai_ram_0000` | `/notes/how-i-built-inkforge-…-bedrock` | `how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-bedrock` | 12 | false |
| `tombstone-launch-devto` | How I Built Tombstone: … | 2026-06-27 | `devto` | `dev.to/sai_ram_0000` | `/notes/how-i-built-tombstone-feature-flag-intelligence-platform` | `how-i-built-tombstone-feature-flag-intelligence-platform` | 13 | false |
| `tombstone-launch-substack` | I Built Tombstone Because I Was Tired of 2am Flag Incidents | 2026-06-27 | `substack` | `open.substack.com/pub/sairam0000` | same as above | `how-i-built-tombstone-feature-flag-intelligence-platform` | 13 | false |
| `tombstone-v1-2-devto` | We Shipped Tombstone v1.0. Then We Found Nine Bugs … | 2026-07-05 | `devto` | **`anvilry.vercel.app/notes/tombstone-v1-2-release`** (self-link) | `/notes/tombstone-v1-2-release` | `tombstone-v1-2-release` | 10 | false |
| `trelix-v1-launch-devto` | I Built trelix Because I Was Tired of Grepping … | 2026-07-05 | `devto` | `dev.to/sai_ram_0000` | `/notes/trelix-code-intelligence-engine` | `trelix-code-intelligence-engine` | 12 | false |
| `trelix-v1-launch-substack` | I Built trelix Because I Was Tired of Grepping … | 2026-07-05 | `substack` | `open.substack.com/pub/sairam0000` | same as above | `trelix-code-intelligence-engine` | 12 | false |

Every `canonicalUrl` that is set (all but the native `how-dns-works`) is an absolute
`https://anvilry.vercel.app/notes/<note-slug>` URL (i.e. it points at the internal note, not at the
external platform) and always equals the `linkedNote` slug's URL. **All 15 articles carry a `linkedNote`** (the browser-request medium and substack
entries now set it too), so under the default dedup strategy
`ARTICLE_DEDUP_KEY = "linkedNote"` (`src/lib/writing-flags.ts:79-80`) they form **7 groups**, one per
note (6 while notes are dark, when `tombstone-v1-2-devto` is dropped and its group vanishes), and the
`canonicalUrl` fallback branch (`src/lib/article-grouping.ts:73-75`) is exercised by no
article; see `src/lib/article-grouping.ts:59-76` for the key chain. Metadata is not always in
parity across syndication variants: `inkforge-build-devto` is dated 2026-06-27 while its note is
2026-06-20 (the devto/hashnode variants of the DNS and browser-request notes are likewise one day
after their notes), and `readingTime` differs for `inkforge` (note 14, article 12), `tombstone-v1-2`
(note 9, article 10) and `trelix` (note 9, article 12).

## Cross-references

### 1. Game-model node IDs → content slugs

`src/lib/game-model.ts:28-50` (`NODE_CONTENT`) maps **16** hero-graph node IDs to
`{ kind, slug }` pairs, covering all 5 Work slugs and all 11 Project slugs — a total bijection
with `content/work` + `content/projects`. The node list itself is `graphNodes` in
`src/lib/graph-data.ts:18-81` (16 entries). `resolveNode()` (`src/lib/game-model.ts:62-71`) looks
the slug up via `getWork`/`getProject`, returning `null` when absent, and `hrefFor()`
(`:74-76`) returns the Velite-derived `item.url`.

**The three intentional node-id / slug mismatches** (comment at `src/lib/game-model.ts:16-27`,
also recorded in the `CLAUDE.md` "Testing Notes" section):

| Graph node id | Content slug | Kind | Cite |
|---|---|---|---|
| `aava` | `aava-code` | work | `src/lib/game-model.ts:31` |
| `grpc` | `grpc-microservices` | project | `src/lib/game-model.ts:42` |
| `nhl` | `not-humans-lab` | project | `src/lib/game-model.ts:45` |

Every other node id equals its slug exactly. The docblock line `src/lib/game-model.ts:19` reads
"3 of the **16** graph node ids", agreeing with the 16 entries that `graphNodes`
(`src/lib/graph-data.ts:18-81`) and `NODE_CONTENT` (`src/lib/game-model.ts:28-50`) each hold. The
bijection is guarded at build time by `src/lib/game-model.test.ts` (build-chained through
`vitest run` in the `build` script; `ARCHITECTURE.md` "Bijection guard"): forward coverage (`:22`,
`:27`), slug exists in Velite (`:34`), reverse coverage — every content item has a node (`:42`),
count equality (`:55`), canonical hrefs (`:60`), quest-group no-loss/no-dup (`:66`), plus an
anti-fabrication block (`:72`) asserting dossier facts trace to real `work.metrics` values.

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
- **Notes** (`:75-77`): `title` + `summary` only, emitted under `## Writing`, and only when
  `allNotes.length` is non-zero. `allNotes` is empty while `NOTES_ENABLED` is off, so **the
  section is absent by default** and present only when the flag is on (then 7 notes;
  `src/lib/notes-dark.test.ts:63-69` and `:99-100` pin both directions).
- Optional `## Personal` (`:43-65`, only when `personal.ts` is populated) and `## Recommendations`
  (`:69-71`, only when testimonials exist) sections; skills and achievements come from `profile.ts`.
- Articles, note bodies, project `decisions`/bodies, and Work `constraints`/`tradeoffs`/`body`
  never enter the corpus.

`src/lib/corpus.test.ts:13-18` asserts the corpus always contains `profile.name`,
`## Production Work`, and `## Skills`; `:20-28` asserts `## Personal` appears iff `personal.ts` is
populated. The `register` string reaching the LLM verbatim is also reinforced in the chat system
prompt at `src/app/api/chat/route.ts:90`. The header comment at `src/lib/corpus.ts:9` ("~4KB") is
stale: `buildCorpus()` measures 9,133 chars with notes dark (the default) and 11,437 with notes on.

### 3. Resume → content

`src/lib/resume-json.ts:2` imports `allWork, allProjects`.

- `work[]` (`:51-57`): `position: w.role`, `summary: \`${w.register}. ${w.summary}\`` (**the
  register is prefixed into the résumé summary verbatim**, `:54`), `highlights` from
  `w.metrics` as `value label`, and `url: BASE + w.url`. All 5 Work items.
- `projects[]` (`:58-65`): `name`, `description: p.tagline`, `keywords: p.tech`,
  `url: p.repo`, `entity: BASE + p.url`. All 11 Project items.
- `education` is deliberately omitted (`src/lib/resume-json.ts:68` — "no data; we don't
  fabricate it"). Notes and Articles are not in the résumé JSON.

The printed `/resume` page (`src/app/resume/page.tsx`) does **not** import `@/lib/content`
directly (verified by grep) — it is tab/PDF-driven; `register` reaches recruiters through
`resume-json.ts` and through the `/work` pages (`src/app/work/page.tsx:53`,
`src/app/work/[slug]/page.tsx:68`, and the OG image at
`src/app/work/[slug]/opengraph-image.tsx:26`).

### 4. Home page featured lists

- **Featured work** — `src/components/home/featured-work.tsx:3` imports `allWork` and maps it
  in full at `:12`. There is no `featured` flag on the Work schema, so **all 5 Work case studies
  render**, in `order` (pensieve, aava-code, wireframe-generator, prompt-to-react,
  execution-engine).
- **Featured projects** — `src/components/home/featured-projects.tsx:3` imports
  `featuredProjects`, defined as `allProjects.filter((p) => p.featured)`
  (`src/lib/content.ts:24`). That resolves to **7** projects: `mindforge`, `graph-forge`,
  `agent-forge`, `tombstone`, `trelix`, `inkforge`, `grpc-microservices` (order-sorted).
  The 4 non-featured projects are `contextos`, `ag-bash`, `not-humans-lab`, `commandvault`.
- `pinnedProjects` (`src/lib/content.ts:27-29`) is the separate GitHub-pin-mirroring list:
  9 projects have `pinned: true` with a `pinRank`; `not-humans-lab` and `commandvault` are
  excluded. `src/lib/github.ts:30-44` (`REPO_ALLOWLIST`, 13 entries) is a third, independent list
  keyed on **GitHub repo names** (not slugs) — it now covers all 11 content projects and adds
  `Thunderboard-Labs` and `Shop.this`, which have no content file.

### 5. Notes gating and Article `linkedNote` → Note slug

**Notes are hidden at the data layer.** `src/lib/content.ts` exports `publishedNotes` (`:50-52`;
drafts dropped, newest first, regardless of the flag — only the `/notes` route files and
`notes/[slug]/opengraph-image.tsx` use it, because `cacheComponents` needs a non-empty
`generateStaticParams`). `allNotes` (`:56`) is `publishedNotes` when `NOTES_ENABLED` is true and
`[]` otherwise; `hasNotes`, `getNote`, `inkforgeNotes` and `inkforgeArticles` derive from it. So
with the default (`NEXT_PUBLIC_NOTES_ENABLED` unset) `llms.txt` (`src/lib/llms-txt.ts:38-46`, `:95-96`),
`feed.xml` (`src/app/feed.xml/route.ts:24`), the MCP `list_all_content`/`get_content_item` tools
(`src/lib/mcp-tools.ts`), the chat corpus, sitemap (`src/app/sitemap.ts:40-57`) and both raw-`.md`
handler sets can no longer publish a note the `/notes` pages 404. `allArticles` (`:80-83`) also drops
**note-only articles** while notes are dark — those with a `linkedNote` and either no `externalUrl`
or an `externalUrl` under `https://anvilry.vercel.app/notes/` (`isNoteOnlyArticle`, `:73-74`): today
`how-dns-works` (native) and `tombstone-v1-2-devto` (self-link). Result: notes off → 0 notes, 12
articles; notes on → 7 notes, 14 articles. `src/lib/notes-dark.test.ts` pins the dark state across
content, `llms.txt`, feed, MCP, corpus and both `.md` handlers, and the on state for the same
surfaces except the `api/md` notes handler (only the legacy `notes/[slug].md` handler is asserted).

**`linkedNote` resolution.** Verified against the frontmatter: 7 distinct `linkedNote` values, one
per note, and all resolve to an existing note slug (the previously dangling targets
`tombstone-v1-2-release` and `trelix-code-intelligence-engine` now have notes).

| Note slug | Articles pointing at it |
|---|---|
| `how-dns-works` | `how-dns-works` (native), `-devto`, `-hashnode` (draft) |
| `how-i-traced-one-browser-request-from-keystroke-to-rendered-page` | `-devto`, `-hashnode`, `-medium`, `-substack` |
| `feature-flags-at-scale-distributed-control-system` | `-devto`, `-substack` |
| `how-i-built-inkforge-…-bedrock` | `inkforge-build-devto` |
| `how-i-built-tombstone-feature-flag-intelligence-platform` | `tombstone-launch-devto`, `tombstone-launch-substack` |
| `tombstone-v1-2-release` | `tombstone-v1-2-devto` |
| `trelix-code-intelligence-engine` | `trelix-v1-launch-devto`, `trelix-v1-launch-substack` |

Nothing enforces resolution: `linkedNote` is a bare `s.string()` (`velite.config.ts:133`), and no
test asserts it (`notes-dark.test.ts` only re-implements the note-only predicate). A future typo
would surface only when the flag is on, as a 404 redirect target. The consumers build the href
unconditionally when `NOTES_ENABLED` — `src/components/article-group-card.tsx:21-22`,
`src/app/articles/page.tsx:199-200` (and `:272`), `src/components/related-writing.tsx:13-14`, and the
`redirect()` at `src/app/articles/[slug]/page.tsx:71-72`. `src/lib/llms-txt.ts:29-31` builds the same
`/notes/<linkedNote>` URL for the AI-discovery file. With notes on, `tombstone-v1-2-devto` (whose
`externalUrl` equals the note URL) yields a feed item whose `link`/`guid`
(`src/app/feed.xml/route.ts:34-35`) duplicates the note's own item.

`relatedArticles` (Project) is unchecked in the same way: `src/app/projects/[slug]/page.tsx:83-85`
maps each slug through `getArticle` and silently drops misses, so an article that is dark (a
note-only article while notes are off, or a draft) simply disappears from "Related writing"
(`src/components/related-writing.tsx`). Today `tombstone-launch-devto`, `tombstone-v1-2-devto`,
`trelix-v1-launch-devto` and `inkforge-build-devto` are referenced (all devto variants).

### 6. Slug namespace overlap

`s.slug()` is unique per *group*, not globally (`node_modules/velite/dist/index.js:5095`), so
`how-dns-works` legitimately exists twice: as `content/notes/how-dns-works.mdx` (group `note`,
→ `/notes/how-dns-works`) and as `content/articles/how-dns-works.mdx` (group `article`,
→ `/articles/how-dns-works`). The article is `source: native` with a `linkedNote` pointing at
its own name and no `externalUrl`, which makes it the "notes-only article" case handled at
`src/app/articles/[slug]/page.tsx:43` (dropped from `generateStaticParams`), `:71-72` (redirect to
the note when notes are on) and `:84-86` (`notFound()`). While notes are off it is already absent
from `allArticles`, so `getArticle` misses and the page 404s at `:67`. Because its body is empty,
the native-inline render path is never reached.

### 7. Decisions ledger

`src/lib/decisions.ts` flattens the architecture-decision narratives into one typed
`allDecisions: LedgerEntry[]` (`:65`) with zero duplication: every project's `decisions[]`
(`:23-34`, id `project:<slug>:<i>`, `href` = the project URL) plus each Work item's populated
`constraints` and `tradeoffs` (`:36-63`, id `work:<slug>:constraints|tradeoffs`, titled
"Constraints"/"Tradeoffs", empty `tags`). Today that is 33 project entries + 10 work entries = 43
(`DECISION_COUNTS`, `:72-76`); `decisionsByTag(tag)` is at `:67`. Consumers: the `/decisions` page
(`src/app/decisions/page.tsx:7`), the MCP `list_decisions` tool (`src/lib/mcp-tools.ts:205-226`,
registered at `src/app/api/mcp/[transport]/route.ts:109`, documented at `src/app/mcp/page.tsx:57`).
`src/lib/decisions.test.ts` (build-chained) enforces bidirectional coverage — an entry per populated
project decision (`:16`) and per populated work field (`:31`), verbatim title/body tracing to real
content (`:44`), valid Classic deep-links (`:75`), unique ids (`:83`), matching counts (`:88`) and
`decisionsByTag` correctness (`:95`). The prose-quality bar for the source fields lives in
`case-study-depth.test.ts:38-72`.

## Detail

### `velite.config.ts`

- **Role:** Single source of truth for the content schemas and the Velite build output layout.
- **Exports:** `default` — the object returned by `defineConfig` (`:142-157`). The four
  `defineCollection` results (`projects`, `work`, `notes`, `articles`), the `themeGroup` enum and the
  `decision` object are module-local, surfaced only through the `collections` map at `:155`.
- **Reads / depends on:** `velite` (`defineConfig`, `defineCollection`, `s`). No env vars, no
  network. Input root `content/` (`:143`); writes `.velite/` (data) and `public/static/` (assets).
- **Consumed by:** the `velite` CLI in `package.json` scripts — `predev` (`velite`, no `--clean`,
  `package.json:9`), `build` (`velite --clean && vitest run && next build && pagefind --site
  .next/server/app --output-path public/pagefind`, `package.json:11` — so the content tests gate every
  production build and Pagefind runs inside `pnpm build`), `content` (`velite --clean`,
  `package.json:17`). In `next dev`, `next.config.ts:13-15` additionally starts
  `build({ watch: true, clean: false })` (guarded by `VELITE_STARTED`). Generated output is imported
  once, via the relative path `../../.velite`, by `src/lib/content.ts:5-14`; every other module goes
  through `@/lib/content`.
- **Behaviour notes:**
  - `clean: false` (`:153`) is deliberate. The comment at `:149-152` records why: `predev` +
    the dev watcher regenerate in place, and `--clean` in dev races webpack into
    "Can't resolve './projects.json'". Production purity comes from the explicit `--clean` in the
    `build`/`content` scripts, not from this config.
  - Asset pipeline: `assets: "public/static"`, `base: "/static/"`,
    `name: "[name]-[hash:6].[ext]"` (`:146-148`). Work `diagram` paths are documented as
    `/static/...` (`:70`) to match this base — and `case-study-depth.test.ts:24-36` resolves them
    under `public/`.
  - `mdx: { gfm: true }` (`:156`) — GitHub-flavoured markdown for all four collections,
    including the `.md` Inkforge notes.
  - Each collection's `.transform()` is the only place `url` is created; nothing else in the repo
    constructs `/work/<slug>` or `/projects/<slug>` by hand (`src/lib/game-model.ts:75` returns
    `resolved.item.url` and comments as much), apart from the canonical-URL literals in the two
    `generateMetadata` functions (`src/app/projects/[slug]/page.tsx:37`, `src/app/work/[slug]/page.tsx:25`).
- **Gotchas / invariants:**
  - Renaming a collection key in `collections` (`:155`) renames the generated `.velite/*.json`
    file and breaks the destructured import at `src/lib/content.ts:5-14`.
  - Adding a required field to Work or Project fails validation for *every existing file* at once.
    Velite runs non-strict (no `--strict` in any script): it logs the errors, drops the records and
    exits 0, so the deploy breaks at `vitest run` (e.g. `game-model.test.ts`), not at the Velite step.
    That is why the hiring-manager depth fields at `:68-71` and the Project additions
    (`dateCreated`, `license`, `relatedArticles` at `:34-39`; `decisions` defaults to `[]` at `:40`)
    are optional/defaulted.
  - `register` (`:61`) is required by Zod and is the only schema-level enforcement of the
    "never fabricate ownership" rule (`CLAUDE.md` "Content Authorship Rules", `ARCHITECTURE.md`
    "Never fabricate metrics"). Making it optional would silently drop attribution from the corpus
    (`src/lib/corpus.ts:17`) and the résumé (`src/lib/resume-json.ts:54`).
  - `diagramAlt` (`:71`) is *not* conditionally required in Zod — the a11y guarantee lives only
    in `src/lib/case-study-depth.test.ts:12-22`. Deleting that test removes the guard.
  - `externalUrl` (`:131`) and `linkedNote` (`:133`) carry their invariants in comments only; both
    currently hold in the data (Cross-references §5). `externalUrl` is `.url().optional()`, so an
    empty string is a schema violation — but Velite is non-strict, so it only logs
    `Invalid url externalUrl`, exits 0 and still emits the record. That is what `make new-article`
    (default `SOURCE=native`, `URL=`) scaffolds (`externalUrl: ""`, `draft: true`) until that line is
    removed or filled.
  - `s.number()` on `commits`/`wordCount`/`readingTime` means these are numbers in YAML, not
    strings; `metrics[].value` is the reverse — an `s.string()` (`:63`) so `"1.5h → 15m"` and
    `"65% → 85%"` are legal. The `make new-note` scaffold writes `wordCount: 0` / `readingTime: 0`
    placeholders, and `new-project` omits `commits`, `dateCreated`, `license`, `relatedArticles`,
    `decisions` and `pinRank`.

### `content/notes/how-i-traced-one-browser-request-from-keystroke-to-rendered-page.mdx`

- **Role:** The one content file whose `.mdx` extension is load-bearing.
- **Behaviour notes:** It contains 10 MDX comment expressions of the form
  `{/* DIAGRAM: Upload assets/diagram-full-journey.png here */}` and
  `{/* GIF: Search giphy.com … */}` (first pair at lines 30-32). These are JSX expression
  containers — valid MDX, invalid plain Markdown — so they are silently stripped from the rendered
  output rather than displayed. The other six notes (including the `.mdx` `how-dns-works`,
  `tombstone-v1-2-release` and `trelix-code-intelligence-engine`) contain zero such constructs
  (verified by grep), so their extension is stylistic.
- **Gotchas / invariants:** Extension is **not** a reliable proxy for provenance: two `.mdx` notes
  are Inkforge-generated and two `.mdx` notes (`tombstone-v1-2-release`,
  `trelix-code-intelligence-engine`) are hand-authored. Use `generatedBy` (which is what
  `src/lib/content.ts:62` and `:67` actually filter on): 5 of 7 notes.

### `content/articles/*.mdx` (all 15, as a class)

- **Role:** Frontmatter-only "curator" pointers, not article bodies. Every file is 11-13 lines and
  ends immediately after the closing `---`; every article compiles to `body: ""`.
- **Behaviour notes:** The schema comment (`velite.config.ts:108-113`) says native articles "render
  their body inline like notes" — the one `source: native` file
  (`content/articles/how-dns-works.mdx`) has no body, and instead sets
  `linkedNote: how-dns-works`, so the native-inline path is unexercised today: the page redirects
  to the note when notes are on and 404s when they are off.
- **Gotchas / invariants:** Multi-platform twins share `title`, `date`, `summary`, `tags`, and
  `readingTime` mostly verbatim and differ in `slug`, `source`, and `externalUrl`. Dedup for the
  `/articles` page, the home-page writing preview and `llms.txt` depends on `linkedNote`/`canonicalUrl`
  agreeing across the twins (`src/lib/article-grouping.ts:59-76`); the RSS feed does not group and
  emits one item per article. Group primary selection ranks native (0)
  > has-`linkedNote` (1) > external (2), then newest (`:91-98`); because every non-native article
  now has a `linkedNote`, ranking falls through to date in every group except `how-dns-works`, where
  the native article outranks its newer devto twin while notes are on. The browser-request set spans
  2026-06-19 (medium, substack) and 2026-06-20 (devto, hashnode), so a devto/hashnode variant
  becomes the group's canonical. Final group order is newest canonical first with a slug tiebreak
  (`:113-117`).

### Raw markdown endpoints and `llms.txt`

- **Two parallel handler sets exist:** `src/app/api/md/{work,projects,notes,articles}/[slug]/route.ts`
  (targets of the `/:collection/:slug.md` rewrites at `next.config.ts:244-247`) and
  `src/app/{work,projects,notes,articles}/[slug].md/route.ts` (which parse the slug from `req.url`).
  Both check the slug against the published `allX` collection (notes: `allNotes`, hence a 404 while
  notes are dark — `src/app/api/md/notes/[slug]/route.ts:28`), `readFileSync` the source from
  `content/<collection>/<slug>.{mdx,md}` at request time (`:11-21`) and strip frontmatter with
  `^---[\s\S]*?---` (`:8`), which would truncate at a `---` inside a frontmatter value. Which set
  wins routing is not established here; `notes-dark.test.ts:71-80` exercises both.
- `src/lib/llms-txt.ts:88-103` advertises `<BASE>/<collection>/<slug>.md` for work, projects, notes
  (`:95-96`, "(none yet)" while dark) and "Articles (native only)" (`:98-102`), which filters on
  `!a.externalUrl` (`:100`) rather than `source === "native"` — the same set today (only
  `how-dns-works`, and that is empty while notes are dark). Articles are body-less, so their `.md`
  is empty text.
- `NOTES_ENABLED`-independent hazard: `content/` must be present in the serverless function bundle
  for the `readFileSync` reads; no `outputFileTracingIncludes` was found in `next.config.ts`
  (unverified against a deployed build).

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
- `content/notes/tombstone-v1-2-release.mdx`
- `content/notes/trelix-code-intelligence-engine.mdx`
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

- I did not read the full bodies of the 5 longest notes end-to-end; all frontmatter in scope was
  read in full, from every file, and the `{/* … */}` comment counts were taken by grep across all 7
  notes.
- `wordCount` / `readingTime` values in Note frontmatter are taken as authored; I did not
  recount words to confirm they match the bodies.
- Behavioural claims about `allNotes`/`allArticles` under each `NOTES_ENABLED` state are read from
  `src/lib/content.ts` and `src/lib/notes-dark.test.ts`; the 12-vs-14 article counts and the
  7-vs-6 group counts were recomputed by replaying the `content.ts` / `article-grouping.ts` filters
  over a fresh `velite` build of `content/` (zero schema issues), not observed via a vitest run.
- I did not run `pnpm test`, so I have not observed `game-model.test.ts`, `decisions.test.ts`,
  `case-study-depth.test.ts` or `notes-dark.test.ts` pass/fail here; their assertions are quoted
  from source.
- Whether both `.md` handler sets are routed, and whether `content/` is in the deployed function
  trace, needs a deployed check. Whether production sets `NEXT_PUBLIC_NOTES_ENABLED` cannot be
  determined from source (env values are not read).
