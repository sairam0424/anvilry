---
kind: doc
title: lib — Content, Data Derivation & Domain Model
domain: [content]
status: current
version: v3.4.2
---

# lib — Content, Data Derivation & Domain Model

> Part of the Anvilry v3.4.2 codebase index. Master entry point: [docs/index/README.md](./README.md)

**Scope:** `src/lib/*.ts` (top level only), content/data/domain half — `content.ts`, `corpus.ts`, `game-model.ts`, `graph-data.ts`, `article-grouping.ts`, `llms-txt.ts`, `profile.ts`, `personal.ts`, `testimonials.ts`, `resume-json.ts`, `mcp-tools.ts`, `discovery-store.ts`, `enabled-views.ts`, `flags.ts`, `writing-flags.ts`, `github.ts`, `utils.ts`, `highlight-store.ts`. Excludes `*.test.ts` and the AI/voice/infra half (`llm*.ts`, `agent-trace.ts`, `voice-*`, `rate-limit.ts`, `redis.ts`, `admin-auth.ts`, `r3f.ts`, `use-*.ts`, `telemetry/`, `scroll/`).
**Files indexed:** 18

There is **no `src/lib/avatar-glb.ts`** — `src/lib/avatar-glb.test.ts` is a standalone binary-asset invariant test that parses `public/avatar/sairam.glb` directly (`avatar-glb.test.ts:16`, budget `MAX_BYTES = 1.5 * 1024 * 1024` at `:22`). Likewise `notes.test.ts` and `case-study-depth.test.ts` have no matching source module — both test `content.ts`.

## At a glance

| File | Role | Key exports |
|---|---|---|
| `src/lib/content.ts` | Velite typed-access layer: re-exports generated collections with sort/filter helpers. The root of every derivation. | `Project`/`Work`/`Note`/`Article` (types), `allProjects`, `allWork`, `featuredProjects`, `pinnedProjects`, `projectGroups`, `projectsByGroup()`, `getProject()`, `getWork()`, `allNotes`, `getNote()`, `hasNotes`, `inkforgeNotes`, `inkforgeArticles`, `allArticles`, `getArticle()`, `hasArticles` |
| `src/lib/corpus.ts` | Builds the ~4KB in-context chatbot grounding document from content + profile + personal + testimonials. | `buildCorpus()` |
| `src/lib/game-model.ts` | Derivation layer mapping hero-graph node ids → real Velite content; builds quest nodes, dossiers, resolved edges. | `ContentKind`, `NODE_CONTENT`, `ResolvedContent`, `resolveNode()`, `hrefFor()`, `QuestNode`, `questNodes`, `graphEdgesResolved`, `DossierFact`, `Dossier`, `dossierFor()`, `questGroups()`, `TOTAL_SYSTEMS`, `CONTENT_COUNTS` |
| `src/lib/graph-data.ts` | Hand-authored 3D knowledge-graph topology: 16 nodes with deterministic positions, 19 edges, kind→color map. | `GraphNode`, `GraphEdge`, `graphNodes`, `graphEdges`, `kindColor` |
| `src/lib/article-grouping.ts` | Groups multi-platform syndications of the same article into one canonical group; flag-driven dedup key. | `GroupingConfig`, `ArticleGroup`, `groupArticles()`, `getGroupSources()`, `filterGroupsBySource()` |
| `src/lib/llms-txt.ts` | Renders `/llms.txt` (llmstxt.org spec) from the content layer. | `buildLlmsTxt()` |
| `src/lib/profile.ts` | Static identity/skills/achievements/résumé-variant source of truth; repo count derived from content. | `profile`, `impactMetrics`, `skills`, `achievements`, `resumeVariants` |
| `src/lib/personal.ts` | Owner-authored "beyond the résumé" content + empty-safe gates for easter eggs. | `UsesGroup`, `personal`, `now`, `hasPersonalContent`, `hasNow` |
| `src/lib/testimonials.ts` | Testimonials source (currently empty array) + dark-ship gate; requires `sourceUrl` per entry. | `Testimonial`, `testimonials`, `hasTestimonials` |
| `src/lib/resume-json.ts` | Builds the jsonresume.org v1.0.0 payload served at `/api/resume.json`. | `buildResumeJson()` |
| `src/lib/mcp-tools.ts` | Pure, transport-agnostic implementations + Zod input schemas for the portfolio MCP server. | `RESUME_ROLES`, `ResumeRole`, `projectSlugSchema`, `workSlugSchema`, `searchSchema`, `resumeRoleSchema`, `contentTypeSchema`, `projectSlugs()`, `workSlugs()`, `NotFound`, `getProfileData()`, `listProjectsData()`, `getProjectData()`, `listWorkData()`, `getWorkData()`, `searchExperienceData()`, `getResumeVariantData()`, `listAllContentData()`, `getContentItemData()` |
| `src/lib/discovery-store.ts` | localStorage-backed module-level external store tracking 5 exploration "discoveries". | `DiscoveryKey`, `unlock()`, `unlockAll()`, `useDiscoveries()`, `getDiscoveryCount()`, `DISCOVERY_TOTAL` |
| `src/lib/enabled-views.ts` | Build-time flag parsing which optional views (beyond Classic) exist in this build. | `isViewEnabled()`, `ENABLED_VIEWS` |
| `src/lib/flags.ts` | Dual-driver resolver for the one migrated flag (`NEXT_PUBLIC_DISCOVERY_BADGES`): Vercel Flags SDK vs build-time env. | `getDiscoveryBadgesEnabled()` |
| `src/lib/writing-flags.ts` | 9 build-time `NEXT_PUBLIC_*` booleans + 1 enum flag for writing sections, hiring signals, and article dedup. | `ARTICLES_ENABLED`, `NOTES_ENABLED`, `OPEN_TO_WORK`, `STATS_ENABLED`, `SEARCH_ENABLED`, `TESTIMONIALS_ENABLED`, `INKFORGE_ARTICLES_ENABLED`, `GITHUB_STATS_ENABLED`, `DedupPrimaryKey`, `ARTICLE_DEDUP_KEY`, `CHROME_TTS_BANNER_ENABLED` |
| `src/lib/github.ts` | Server-only, allowlist-gated, fail-open GitHub repo feed with ISR data cache. | `REPO_ALLOWLIST`, `GithubRepo`, `getRepoFeed()` |
| `src/lib/highlight-store.ts` | Client external store that glows a project card for 3s when chat emits `[[cmd:highlight:<slug>]]`. Only `highlightProject` has a caller today. | `highlightProject()`, `clearHighlight()`, `useHighlightedSlug()` |
| `src/lib/utils.ts` | Tailwind class merge helper (trivial). | `cn()` |

## Derivation pipeline

```
content/{work,projects,notes,articles}/*.{md,mdx}
  │  velite.config.ts — 4 Zod collections; each .transform() appends `url`
  │  (projects → /projects/<slug>, work → /work/<slug>, notes → /notes/<slug>, articles → /articles/<slug>)
  ▼
.velite/{projects,work,notes,articles}.json + index.d.ts   (GITIGNORED — generated)
  │  exports: `projects`/`work`/`notes`/`articles` arrays + `Project`/`Work`/`Note`/`Article` types
  ▼
src/lib/content.ts        ← imports via RELATIVE path "../../.velite" (content.ts:5-14), not an alias
  │   sorts, filters drafts, derives pinned/featured/inkforge subsets
  ├──────────────┬───────────────┬──────────────┬────────────────┬─────────────────┐
  ▼              ▼               ▼              ▼                ▼                 ▼
game-model.ts   corpus.ts     llms-txt.ts   resume-json.ts   mcp-tools.ts   article-grouping.ts
  │(+graph-data)  │(+profile,     │(+profile,     │(+profile)       │(+profile)       │(+writing-flags)
  │               │ personal,     │ article-      │                 │                 │
  │               │ testimonials) │ grouping)     │                 │                 │
  ▼               ▼               ▼               ▼                 ▼                 ▼
game view        /api/chat      /llms.txt      /api/resume.json  /api/mcp/[transport] /articles,
(build-graph*,   route,                                                              article-group-card,
 dossier-card,   /llms-full.txt,                                                     home/writing-preview
 graph-index,    terminal
 terminal)       commands
```

Also derived, but not via `content.ts`: `profile.ts` imports `allProjects` solely to derive the "open-source repos" banner number (`profile.ts:39`), and `github.ts` imports `profile.githubUser` as the fetch owner (`github.ts:116`).

Real counts at this version (`.velite/*.json`): **projects 11, work 5, notes 5, articles 15**. `graph-data.graphNodes` has **16** entries (5 work + 11 projects) and `NODE_CONTENT` has **16** entries — the bijection asserted by `game-model.test.ts:55-57` currently holds exactly.

### Node-id → slug exceptions (exhaustive)

Three of the 16 graph node ids do **not** equal their content slug. These are intentional, cited verbatim:

| Node id | Content kind | Slug | Cite |
|---|---|---|---|
| `aava` | `work` | `aava-code` | `src/lib/game-model.ts:31` (`// node id != slug`) |
| `grpc` | `project` | `grpc-microservices` | `src/lib/game-model.ts:42` (`// node id != slug`) |
| `nhl` | `project` | `not-humans-lab` | `src/lib/game-model.ts:45` (`// node id != slug`) |

All other 13 mappings are identity (`game-model.ts:30,32-41,43-44,46-49`). The module docblock states the failure this map prevents: without it, "click a node → open its card" would 404 for 30% of the graph (`game-model.ts:20-27`).

## Flag inventory (complete, all three flag modules)

### `src/lib/flags.ts` — dual-driver (the only migrated flag)

| Flag | Default | Resolution mechanism | Cite |
|---|---|---|---|
| `NEXT_PUBLIC_DISCOVERY_BADGES` | `false` | **Two paths selected by `FLAG_DRIVER`.** `FLAG_DRIVER=vercel` → Vercel Flags SDK `flag<boolean>({ key: "NEXT_PUBLIC_DISCOVERY_BADGES", defaultValue: false, decide: () => false })`, awaited server-side. Anything else → build-time `process.env.NEXT_PUBLIC_DISCOVERY_BADGES === "true"`. | declaration `flags.ts:17-29`; driver read `flags.ts:13`; vercel path `flags.ts:42-55`; local path `flags.ts:58` |

`useVercelDriver` is computed once at module load, so changing `FLAG_DRIVER` without a process restart has no effect (`flags.ts:12-13`). Every resolution logs one `[flags]` JSON line including `driver`, `value`, and either `flags_secret_present` (vercel path, `flags.ts:51`) or `source: "env_var" | "default_false"` (local path, `flags.ts:65-67`). The same flag is re-declared for the Vercel discovery endpoint at `src/app/.well-known/vercel/flags/route.ts:11-23` (gated by `verifyAccess`, 401 on failure).

### `src/lib/writing-flags.ts` — build-time `NEXT_PUBLIC_*` only (redeploy to toggle)

| Flag | Export | Default | Predicate | Cite |
|---|---|---|---|---|
| `NEXT_PUBLIC_ARTICLES_ENABLED` | `ARTICLES_ENABLED` | **`true`** | `!== "false"` (opt-**out**) | `writing-flags.ts:19-20` |
| `NEXT_PUBLIC_NOTES_ENABLED` | `NOTES_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:22-23` |
| `NEXT_PUBLIC_OPEN_TO_WORK` | `OPEN_TO_WORK` | `false` | `=== "true"` | `writing-flags.ts:25-26` |
| `NEXT_PUBLIC_STATS_ENABLED` | `STATS_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:30-31` |
| `NEXT_PUBLIC_SEARCH_ENABLED` | `SEARCH_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:33-34` |
| `NEXT_PUBLIC_TESTIMONIALS_ENABLED` | `TESTIMONIALS_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:38-39` |
| `NEXT_PUBLIC_INKFORGE_ARTICLES_ENABLED` | `INKFORGE_ARTICLES_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:43-44` |
| `NEXT_PUBLIC_GITHUB_STATS_ENABLED` | `GITHUB_STATS_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:48-49` |
| `NEXT_PUBLIC_ARTICLE_DEDUP_KEY` | `ARTICLE_DEDUP_KEY` | `"linkedNote"` | `raw === "canonicalUrl" ? "canonicalUrl" : "linkedNote"` (enum, not boolean) | `writing-flags.ts:72-74` |
| `NEXT_PUBLIC_CHROME_TTS_BANNER` | `CHROME_TTS_BANNER_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:86-87` |

`ARTICLES_ENABLED` is the only inverted one — it is on unless explicitly set to the string `"false"` (`writing-flags.ts:20`).

### `src/lib/enabled-views.ts` — build-time comma-list

| Flag | Default when unset | Resolution mechanism | Cite |
|---|---|---|---|
| `NEXT_PUBLIC_ENABLED_VIEWS` | **all optional views enabled** | If `raw === undefined \|\| raw === null` → `new Set(ALL_OPTIONAL)`. Otherwise split on `","`, trim, lowercase, drop empties, and intersect with `ALL_OPTIONAL`. Setting it to the **empty string** therefore yields an empty set (Classic + `resume` only). | `enabled-views.ts:23`, `:27-34` |

`ALL_OPTIONAL = ["gamified", "chat", "developer", "voice", "resume"]` (`enabled-views.ts:20-21`). `isViewEnabled()` short-circuits `"classic"` and everything in `ALWAYS_OPTIONAL` (`["resume"]`) to `true` regardless of the flag (`enabled-views.ts:37-40`) — `View` is defined at `src/components/view-context.tsx:24`.

## MCP tool inventory

`src/lib/mcp-tools.ts` is transport-agnostic; the wiring is `src/app/api/mcp/[transport]/route.ts`. **The route registers 9 tools**, not 7 — `CLAUDE.md:181` and the `mcp-tools.ts:5-13` docblock both still say "7 tools"; `list_all_content` and `get_content_item` were added later (`route.ts` registrations after `get_resume_variant`).

| Tool (registered name) | Input schema (exact) | Impl | Not-found behaviour |
|---|---|---|---|
| `get_profile` | `{}` | `getProfileData()` `mcp-tools.ts:50` | n/a — always resolves |
| `list_projects` | `{}` | `listProjectsData()` `:65` | n/a |
| `get_project` | `projectSlugSchema` = `{ slug: z.string().describe("project slug, e.g. mindforge") }` `:29` | `getProjectData()` `:77` | `notFound("project", slug, projectSlugs())` `:79` |
| `list_work` | `{}` | `listWorkData()` `:93` | n/a |
| `get_work` | `workSlugSchema` = `{ slug: z.string().describe("work slug, e.g. pensieve") }` `:30` | `getWorkData()` `:105` | `notFound("work", slug, workSlugs())` `:107` |
| `search_experience` | `searchSchema` = `{ query: z.string().min(1).max(120).describe("keywords, e.g. 'kafka' or 'multi-agent'") }` `:31-33` | `searchExperienceData()` `:121` | none — returns `{ query, matches: [], skills: [] }` on no match |
| `get_resume_variant` | `resumeRoleSchema` = `{ role: z.enum(["master","backend","fullstack","frontend","genai"]) }` `:16`,`:34-36` | `getResumeVariantData()` `:137` | `notFound("resume_variant", role, [...RESUME_ROLES])` `:140` (unreachable while `ROLE_TO_LABEL` stays in sync) |
| `list_all_content` | `{}` | `listAllContentData()` `:150` | n/a |
| `get_content_item` | `contentTypeSchema` = `{ type: z.enum(["work","project","article","note"]), slug: z.string() }` `:144-147` | `getContentItemData()` `:160` | delegates to `getWorkData`/`getProjectData`, or `notFound("article"\|"note", slug, <all slugs>)` `:166`,`:171` |

Error contract: `notFound()` returns `{ notFound: true, kind, given, valid }` (`mcp-tools.ts:42-48`); the route's `wrap()` detects the `notFound` key and sets `isError: true` on the MCP result — so the calling agent receives the list of valid options instead of a fabricated answer.

## Detail

### `src/lib/content.ts`
- **Role:** The single typed access layer over Velite's generated output; every other content derivation reads from here.
- **Exports:** types `Project`/`Work`/`Note`/`Article` (re-exported from `.velite`); `allProjects`, `allWork` (sorted by `order`); `featuredProjects`; `pinnedProjects`; `projectGroups` (const tuple); `projectsByGroup()`; `getProject(slug)`, `getWork(slug)`; `allNotes`, `getNote(slug)`, `hasNotes`; `inkforgeNotes`, `inkforgeArticles`; `allArticles`, `getArticle(slug)`, `hasArticles`.
- **Reads / depends on:** `../../.velite` — a **relative** import, deliberately, because `.velite` lives at the repo root outside `src` (`content.ts:1-14`). No env vars, no network.
- **Consumed by:** ~44 non-test files including all four content route trees, `sitemap.ts`, `feed.xml/route.ts`, all four `/api/md/*` routes, all four `[slug].md` routes, `command-palette.tsx`, `game/terminal/commands.ts`, and the five sibling lib derivations (`corpus.ts`, `game-model.ts`, `llms-txt.ts`, `resume-json.ts`, `mcp-tools.ts`, `article-grouping.ts` type-only, `profile.ts`, `agent-trace.ts`).
- **Behaviour notes:** All arrays are copies (`[...raw]`) before sorting so the Velite export is never mutated (`content.ts:20-21,48,66`). `byOrder` sorts ascending on `order` (`:18`) — Velite defaults `order` to `100` (`velite.config.ts:26,50`). Notes and articles are sorted **newest-first by ISO string comparison**, not by `Date` (`content.ts:50,68`). Drafts are excluded at this layer, so downstream code never has to re-check `draft` (`:49,:67`).
- **Gotchas / invariants:** `pinnedProjects` requires **both** `pinned === true` and `pinRank != null`; a project marked pinned without a rank is silently dropped (`content.ts:26-28`). `projectGroups` (`:30-34`) is a hand-copied duplicate of the `themeGroup` enum in `velite.config.ts:4-8` and of `projectGroupOrder` in `game-model.ts:177-181` — three copies of the same three strings must stay in sync. `hasNotes`/`hasArticles` are the dark-ship gates for the nav links and section rendering (`:53,:71`). `inkforgeNotes` (`:56`) and `inkforgeArticles` (`:61`) both filter **`allNotes`** (not `allArticles`) — drafts are already gone from `allNotes`, so the extra `!n.draft` in `inkforgeArticles` is redundant. Guarded by `src/lib/notes.test.ts` (draft exclusion, newest-first, parseable dates, `hasNotes` truthiness) and `src/lib/case-study-depth.test.ts` (`diagram` ⇒ non-empty `diagramAlt`, and the asset exists under `public/`).

### `src/lib/corpus.ts`
- **Role:** Assembles the entire chatbot grounding document as one markdown string.
- **Exports:** `buildCorpus(): string` (`corpus.ts:13`).
- **Reads / depends on:** `@/lib/content` (`allProjects`, `allWork`, `allNotes`), `@/lib/profile` (`profile`, `skills`, `achievements`), `@/lib/personal` (`personal`, `now`, `hasPersonalContent`, `hasNow`), `@/lib/testimonials` (`testimonials`, `hasTestimonials`).
- **Consumed by:** `src/app/api/chat/route.ts`, `src/app/llms-full.txt/route.ts`, `src/components/game/terminal/commands.ts`.
- **Behaviour notes:** Fixed section order: header → `## Production Work (at Ascendion)` → `## Open-Source Projects (github.com/<githubUser>)` → `## Skills` → `## Achievements` → optional `## Personal (beyond the résumé)` → optional `## Recommendations` → optional `## Writing / Notes` (`corpus.ts:60-76`). Three sections are conditionally emitted and collapse to `""` when their source is empty: personal gated on `hasPersonalContent || hasNow` (`:39`), testimonials on `hasTestimonials` (`:50`), notes on `allNotes.length` (`:56`). Inside the personal block each line is individually gated then `.filter(Boolean).join("\n")` (`:40-46`), so a partially filled `personal.ts` emits only its populated lines.
- **Gotchas / invariants:** Work entries emit `Contribution: ${w.register}` verbatim (`:17`) — the honest-attribution field flows straight into the model context. Project commits render only when truthy (`p.commits ? ... : ""`, `:26-27`), so `commits: 0` would be omitted. Nothing here truncates, so corpus size grows linearly with content — the docblock pins the current size at ~4KB and names pgvector + BM25 as the upgrade path (`:9-11`). Guarded by `src/lib/corpus.test.ts` (professional record always present; personal section present **iff** `personal.ts` is populated).

### `src/lib/game-model.ts`
- **Role:** The gamified view's derivation layer — turns hand-authored graph nodes into content-backed quest nodes, dossiers, and drawable edges.
- **Exports:** `ContentKind`, `NODE_CONTENT`, `ResolvedContent`, `resolveNode()`, `hrefFor()`, `QuestNode`, `questNodes`, `graphEdgesResolved`, `DossierFact`, `Dossier`, `dossierFor()`, `questGroups()`, `TOTAL_SYSTEMS`, `CONTENT_COUNTS`.
- **Reads / depends on:** `@/lib/content` (`allProjects`, `allWork`, `getProject`, `getWork`), `@/lib/graph-data` (`graphNodes`, `graphEdges`, `GraphNode`).
- **Consumed by:** `src/components/game/build-graph-scene.tsx`, `build-graph.tsx`, `dossier-card.tsx`, `graph-index.tsx`, `game/terminal/commands.ts`.
- **Behaviour notes:** `resolveNode()` returns `null` for an unmapped id **or** a mapped-but-missing slug (`:62-71`); `questNodes` is built with `flatMap` so nulls are dropped rather than throwing (`:96-109`). `graphEdgesResolved` keeps only edges whose **both** endpoints survived into `questNodes`, using a `Map` built from those nodes (`:116-121`). `dossierFor()` branches on content kind: work dossiers carry `register` and map `w.metrics` 1:1 into facts (`:145-155`); project dossiers synthesise facts — `commits` only when `p.commits != null` (`:160`) plus an always-present `"<n> technologies"` fact (`:161`) — and carry `repo` (`:170`). `questGroups()` emits `"Production Work"` first, then the three project groups, and filters out empty groups (`:175-191`).
- **Gotchas / invariants:** `NODE_CONTENT` must stay exhaustive over `graphNodes` — `game-model.test.ts:22` asserts zero unmapped ids and `:42-52` asserts reverse coverage (no work item or project unreachable from the graph). `CONTENT_COUNTS` (`:197-202`) exists purely so the test imports one module; `game-model.test.ts:55-57` asserts `nodes === quests` **and** `work + projects === nodes`, i.e. adding a content file without adding a graph node **fails the build**. `hrefFor()` trusts Velite's `url` transform (`:74-76`); `game-model.test.ts:60-63` pins the shape to `/^\/(work|projects)\/[a-z0-9-]+$/`. `game-model.test.ts:73-98` additionally asserts every dossier fact traces to a real content value (register/blurb/name verbatim, tech-count and commit-count exact) — inventing a dossier fact fails the build. The visual `kind` from `graph-data` is deliberately distinct from `ContentKind` and is collapsed at `NODE_CONTENT` (`:13-27`).

### `src/lib/graph-data.ts`
- **Role:** The hand-authored topology and palette for the hero/gamified WebGL graph.
- **Exports:** `GraphNode` (type), `GraphEdge` (type, `[string, string]`), `graphNodes` (16 entries), `graphEdges` (19 entries), `kindColor`.
- **Reads / depends on:** nothing — pure data, no imports.
- **Consumed by:** `src/components/game/build-graph-scene.tsx`, `game/dossier-card.tsx`, `src/components/hero-graph/scene.tsx`, and `src/lib/game-model.ts`.
- **Behaviour notes:** Positions are literal tuples with **no `Math.random`**, so SSR/build output is stable (`graph-data.ts:1-6`). Visual `kind` is one of `work | agent | engine | tool` (`:10`) and maps to hex colors `#38e1ff` / `#a78bfa` / `#4ade80` / `#fbbf24` (`:71-76`).
- **Gotchas / invariants:** Positions are constrained by an explicit frustum budget recorded inline: "camera z=7, fov=45 → visible half-height ≈ 2.9 / SCALE=1.6 ≈ 1.8 units" (`:36`) — node coordinates outside roughly ±1.8 on Y will clip. Adding a node here without a matching `NODE_CONTENT` entry fails `game-model.test.ts`. The module header comment still reads "the 5 flagship work systems + 8 OSS repos" (`:3-4`) while the array actually holds 5 work + 11 project nodes — the comment is stale, the data is authoritative.

### `src/lib/article-grouping.ts`
- **Role:** Collapses the same article syndicated to multiple platforms into a single canonical group.
- **Exports:** `GroupingConfig` (interface), `ArticleGroup` (interface), `groupArticles()`, `getGroupSources()`, `filterGroupsBySource()`.
- **Reads / depends on:** type-only `Article` from `@/lib/content`, type-only `ArticleSource` from `@/components/platform-badge`, and `ARTICLE_DEDUP_KEY` + `DedupPrimaryKey` from `@/lib/writing-flags` (`article-grouping.ts:1-4`).
- **Consumed by:** `src/app/articles/page.tsx`, `src/components/article-group-card.tsx`, `src/components/home/writing-preview.tsx`, `src/lib/llms-txt.ts`.
- **Behaviour notes:** Two-pass algorithm. Pass 1 assigns each article a key — `note:<linkedNote>` or `canonical:<canonicalUrl>`, order decided by `config.primaryKey`, with the other field always as fallback (`:62-76`); articles with neither field go to `ungrouped` (`:82`). Pass 2 sorts each bucket by rank `native=0 > has linkedNote=1 > external=2`, then newest-first, and takes `sorted[0]` as `canonical` with the rest as `externalPlatforms` (`:90-102`). Ungrouped articles become single-item groups (`:105-111`). Final sort is newest canonical first with `slug.localeCompare` as a deterministic tiebreaker (`:114-117`).
- **Gotchas / invariants:** `safeMs()` coerces an unparseable ISO date to `0` so `NaN` can never poison the sort (`:10-13`) — malformed dates sort last, not randomly. `DEFAULT_CONFIG` captures `ARTICLE_DEDUP_KEY` at **module load** (`:30`), so the flag is build-time-frozen unless a caller passes an explicit config. `getGroupSources()` returns sources in the fixed `SOURCE_ORDER` (`:7`, `:129`), so a new platform must be appended to that array to appear in the filter bar. `ArticleGroup.platforms` **includes** the canonical; `externalPlatforms` excludes it (`:34-38`). No dedicated test file exists for this module (**UNVERIFIED** whether it is covered indirectly by any `*.dom.test.tsx`).

### `src/lib/llms-txt.ts`
- **Role:** Renders the `/llms.txt` discovery document.
- **Exports:** `buildLlmsTxt(): string` (`llms-txt.ts:12`).
- **Reads / depends on:** `@/lib/profile`, `@/lib/content` (`allWork`, `allProjects`, `allNotes`, `allArticles`), `@/lib/article-grouping` (`groupArticles`).
- **Consumed by:** `src/app/llms.txt/route.ts` (a bare `GET` returning `text/plain; charset=utf-8`).
- **Behaviour notes:** `BASE = "https://anvilry.vercel.app"` is hardcoded (`:5`). Articles are deduped through `groupArticles(allArticles)` with the default config (`:22`); each group's href prefers `${BASE}/notes/${linkedNote}`, then `externalUrl`, then `${BASE}${url}` (`:27-29`). Summaries are truncated — articles to 100 chars + `"..."` (`:30`), notes to 80 chars + `"..."` (`:38`). The Articles and Notes sections are omitted entirely when empty (`:57`). A `## Markdown Versions` section lists `<url>.md` for all work, all projects, all notes (or the literal `"(none yet)"`), and **only non-external articles** (`:68-79`).
- **Gotchas / invariants:** `:65` advertises the MCP server as `${BASE}/api/mcp/sse`, but the route sets `disableSse: true` (`src/app/api/mcp/[transport]/route.ts`, `{ basePath: "/api/mcp", disableSse: true }`) and the documented public endpoint is `/api/mcp/mcp` — the URL in `llms.txt` points at a deliberately 404'd transport. The hardcoded `BASE` here is a fifth base-URL site beyond the four `CLAUDE.md:292` names (`layout.tsx`, `sitemap.ts`, `robots.ts`, `json-ld.tsx`); `resume-json.ts:4` and `mcp-tools.ts:14` are two more. No dedicated test file.

### `src/lib/profile.ts`
- **Role:** Static, hand-maintained identity/skills/achievements/résumé-variant record.
- **Exports:** `profile` (`as const` object), `impactMetrics`, `skills`, `achievements`, `resumeVariants`.
- **Reads / depends on:** `@/lib/content` (`allProjects`) — its only import (`profile.ts:6`).
- **Consumed by:** ~44 non-test files — every page/layout, all `opengraph-image.tsx` files, `manifest.ts`, `json-ld.tsx`, `site-nav`/`site-footer`/`mobile-nav`, the terminal, and the lib derivations `corpus.ts`, `github.ts`, `llm.ts`, `llms-txt.ts`, `mcp-tools.ts`, `resume-json.ts`.
- **Behaviour notes:** `profile` holds `name`, `role`, `company`, `tenure`, `location`, `locationCity`/`locationCountry` (structured for JSON-LD), `headline`, `subhead`, `email`, `calendlyUrl`, `substackUrl`, `links.{github,linkedin,resume}`, `githubUser` (`:8-30`). `impactMetrics` has 3 entries; the third value is **derived** — `` `${allProjects.length}` `` — explicitly so the banner number cannot drift from published content (`:36-40`, rationale at `:32-35`). `skills` is 6 groups (`:42-65`); `achievements` is 5 entries (`:67-73`); `resumeVariants` is 5 entries whose `file` paths point into `public/resume/` (`:76-82`).
- **Gotchas / invariants:** `location` and `locationCity`/`locationCountry` are duplicated data that must be kept in sync — the comment says so at `:13`. `resumeVariants[].label` strings are the join key for `mcp-tools.ts`'s `ROLE_TO_LABEL` map (`mcp-tools.ts:20-26`); renaming a label breaks `get_resume_variant`, and `mcp-tools.test.ts:65` asserts every role resolves to a variant whose PDF exists on disk. No dedicated `profile.test.ts`.

### `src/lib/personal.ts`
- **Role:** The one source for all "beyond the résumé" reveals (terminal `secret`/`uses`/`now`/`about`, Konami card, chat corpus).
- **Exports:** `UsesGroup` (type), `personal` (`as const`), `now` (`as const`), `hasPersonalContent`, `hasNow`.
- **Reads / depends on:** nothing.
- **Consumed by:** `src/app/about/page.tsx`, `game/developer-view.tsx`, `game/easter-eggs.tsx`, `game/terminal/boot-banner.ts`, `game/terminal/commands.ts`, `components/json-ld.tsx`, `src/lib/corpus.ts`.
- **Behaviour notes:** Currently **populated**: 4 hobbies, 2 funFacts, 4 currentlyLearning, 4 askMeAbout, 4 `uses` groups (`:25-56`); `now.updated = "2026-06-14"` with 4 focus lines (`:69-76`). `hasPersonalContent` is an OR across all five lists (`:83-88`); `hasNow` requires **both** `updated !== ""` and a non-empty `focus` (`:91`).
- **Gotchas / invariants:** `now.updated` is annotated `as string` rather than the literal type specifically so the `!== ""` comparison stays type-valid whether or not it is filled (`:66-69`) — narrowing it to a literal would make that check a type error. Emptying the arrays is the documented way to make every egg go dark rather than show a placeholder (`:6-9`). Guarded by `src/lib/personal.test.ts` (shape; `hasPersonalContent` iff a list is non-empty; `hasNow` iff dated **and** non-empty; every `uses` group has a label and ≥1 item).

### `src/lib/testimonials.ts`
- **Role:** Social-proof source + its dark-ship gate.
- **Exports:** `Testimonial` (type), `testimonials` (currently `[]`), `hasTestimonials`.
- **Reads / depends on:** nothing.
- **Consumed by:** `src/components/home/testimonials.tsx`, `src/lib/corpus.ts`.
- **Behaviour notes:** `testimonials` is an empty array at this version (`:26`), so `hasTestimonials === false` (`:29`) and both the homepage strip and the corpus `## Recommendations` section are omitted.
- **Gotchas / invariants:** `sourceUrl` is a **required** field on the type and is documented as the anti-fabrication guarantee — an entry without a real public permalink is invalid (`:8-12`, `:22-23`). `src/lib/testimonials.test.ts:14` asserts every present entry has a real source URL plus all required fields, so adding a quote without a link fails the build. Note the homepage section is *also* behind `TESTIMONIALS_ENABLED` (`writing-flags.ts:38-39`), i.e. two independent gates.

### `src/lib/resume-json.ts`
- **Role:** Builds the machine-readable JSON Resume payload.
- **Exports:** `buildResumeJson()` (`:12`) — returns a plain object, not a string.
- **Reads / depends on:** `@/lib/profile` (`profile`, `skills`, `achievements`), `@/lib/content` (`allWork`, `allProjects`).
- **Consumed by:** `src/app/api/resume.json/route.ts` only.
- **Behaviour notes:** Pins `$schema` to `https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json` (`:14`). Every `work[]` entry uses `profile.company` as the employer name (`:28`) and folds the register into the summary as `` `${w.register}. ${w.summary}` `` (`:30`); highlights are `metrics` flattened to `"<value> <label>"` strings (`:31`). Projects set `url` to the **repo** and `entity` to the on-site dossier page (`:37-40`). `meta` is `{ canonical: "<BASE>/api/resume.json", version: "v1" }` (`:45`).
- **Gotchas / invariants:** `education` is deliberately absent, with the reason stated inline — no education data exists in `profile.ts` and it is not invented (`:9-10`, `:44`). Both `profiles[]` entries use `profile.githubUser` as `username`, so the LinkedIn profile reports the GitHub handle (`:22-23`). Hardcoded `BASE` at `:4`. No dedicated test file.

### `src/lib/mcp-tools.ts`
- **Role:** Pure implementations + Zod input schemas behind the portfolio MCP server; the route is thin wiring.
- **Exports:** see the At-a-glance row and the MCP tool inventory above.
- **Reads / depends on:** `zod`, `@/lib/content` (`allProjects`, `allWork`, `allArticles`, `allNotes`, `getProject`, `getWork`), `@/lib/profile` (`profile`, `skills`, `achievements`, `resumeVariants`).
- **Consumed by:** `src/app/api/mcp/[transport]/route.ts` only (imported as `* as T`).
- **Behaviour notes:** All URLs are absolutised with the hardcoded `BASE` (`:14`). `getProfileData()` hand-picks fields (`:50-63`) rather than spreading `profile` — `email`, `calendlyUrl`, and `substackUrl` are **not** returned. `searchExperienceData()` is a case-insensitive substring match over joined field strings: work matches on `name/role/register/summary/tech` (`:125`), projects on `name/tagline/group/tech` (`:129`), skills on `group/items` with the item list itself filtered down to matching items (`:131-133`); work + project hits are merged into one `matches` array while skills are a separate key (`:134`). `getContentItemData()` is an exhaustive `switch` over the 4 content types with no `default` (`:160-175`).
- **Gotchas / invariants:** `personal.ts` is deliberately **not** imported — the professional-only boundary is stated at `:11-13` and asserted by `mcp-tools.test.ts:22` ("does NOT leak personal.ts"). `ROLE_TO_LABEL` (`:20-26`) hard-codes the exact `resumeVariants[].label` strings including `"Sairam Resume"` for `master` and hyphenated `"Full-Stack"` — a label rename in `profile.ts` silently breaks `get_resume_variant`. `notFound()` results are structurally identified by the presence of the `notFound` key, which is what `route.ts`'s `wrap()` turns into `isError: true`; renaming that key would make errors look like successes. `mcp-tools.test.ts:36` asserts `list_projects`/`list_work` cover the whole content layer (zero drift).

### `src/lib/discovery-store.ts`
- **Role:** Tracks which of 5 exploration moments the visitor has hit, for the celebratory `★ N/5` badge.
- **Exports:** `DiscoveryKey` (union of `"view-switch" | "chat-question" | "terminal-command" | "konami" | "dossier-open"`, `:12-17`), `unlock()`, `unlockAll()`, `useDiscoveries()`, `getDiscoveryCount()`, `DISCOVERY_TOTAL` (`= 5`, `:90`).
- **Reads / depends on:** `react` (`useSyncExternalStore`), `localStorage` key `"anvilry:discoveries"` (`:19`).
- **Consumed by:** `chat/chat-messages.tsx`, `command-palette.tsx`, `game/discovery-badge.tsx`, `game/dossier-card.tsx`, `game/easter-eggs.tsx`, `game/terminal/use-terminal.ts`, `components/view-context.tsx`.
- **Behaviour notes:** Module-level store initialised eagerly from storage at import time (`:50`). `readStorage()` fails closed to an empty `Set` on SSR, missing key, non-array JSON, or a throw, and filters unknown keys against `ALL_KEYS` (`:28-39`). `writeStorage()` swallows quota errors silently by design (`:41-48`). `unlock()` is idempotent, early-returns if already present, and replaces the `Set` with a new instance rather than mutating (`:66-71`) — required for `useSyncExternalStore` identity comparison. `unlockAll()` is the Cmd+K escape hatch (`:74-78`).
- **Gotchas / invariants:** The store has **no gating power** — nothing is locked behind a discovery (`:5-6`). `getServerSnapshot` returns a fresh `new Set()` on every call (`:63`), so the server snapshot is never referentially stable across calls. `getDiscoveryCount()` reads the module variable synchronously **without** subscribing (`:86-88`), so a component using only it will not re-render on unlock. Adding a key requires editing both the `DiscoveryKey` union and `ALL_KEYS` (`:12-26`); `DISCOVERY_TOTAL` derives from `ALL_KEYS.length`. No dedicated test file.

### `src/lib/enabled-views.ts`
- **Role:** Build-time gate for which non-Classic views exist in a given deployment.
- **Exports:** `isViewEnabled(view)`, `ENABLED_VIEWS` (`ReadonlySet<View>`).
- **Reads / depends on:** type-only `View` from `@/components/view-context` (`:1`), env `NEXT_PUBLIC_ENABLED_VIEWS` (`:23`).
- **Consumed by:** `src/components/view-router.tsx`, `src/components/view-switcher.tsx`.
- **Behaviour notes / gotchas:** See the flag table above. Key asymmetry: **unset ⇒ everything on**, but **set-to-empty-string ⇒ everything optional off** (`:25-34`) — the `raw === undefined || raw === null` check is what distinguishes them. Unknown entries in the list are dropped by the `ALL_OPTIONAL.includes(v)` filter (`:33`), so a typo silently disables that view rather than erroring. `classic` can never be disabled — it is the SSG/no-JS default and the `getServerSnapshot` contract (`:12-14`, `:38`). `resume` is in `ALWAYS_OPTIONAL` and therefore also always `true` even if omitted from the list (`:20`, `:38`). No dedicated test file.

### `src/lib/flags.ts`
- **Role:** The dual-driver resolver for the single flag migrated to the Vercel Flags SDK.
- **Exports:** `getDiscoveryBadgesEnabled(): Promise<boolean>` (`:41`).
- **Reads / depends on:** `flag` from `flags/next` (`flags@^4.2.0`), env `FLAG_DRIVER`, `NEXT_PUBLIC_DISCOVERY_BADGES`, and `FLAGS_SECRET` (read only to log its presence, `:51`).
- **Consumed by:** `src/app/layout.tsx:19` — awaited at `layout.tsx:66`.
- **Behaviour notes / gotchas:** See the flag table above. Documented contract: call only from a Server Component or Route Handler, never a client component (`:33-34`). The SDK checks the override cookie **before** invoking `decide()`, which is why `decide: () => false` does not defeat dashboard overrides (`:25-28`). Both paths log exactly one `[flags]` JSON line — grep handle documented as `vercel logs | grep '\[flags\]'` (`:36-39`). The module docblock states that **all other** beast-mode flags remain plain `NEXT_PUBLIC_` reads in their own files (`:7-8`). No dedicated test file.

### `src/lib/writing-flags.ts`
- **Role:** Central declaration of the build-time writing/hiring/dedup flags.
- **Exports:** 9 booleans + `DedupPrimaryKey` + `ARTICLE_DEDUP_KEY` — full table above.
- **Reads / depends on:** `process.env` only; no imports.
- **Consumed by:** `articles/[slug]/page.tsx`, `articles/layout.tsx`, `articles/page.tsx`, `layout.tsx`, `notes/[slug]/page.tsx`, `notes/page.tsx`, `page.tsx`, `sitemap.ts`, `article-group-card.tsx`, `chat/talk-mode.tsx`, `home/testimonials.tsx`, `home/writing-preview.tsx`, `site-nav.tsx`, `src/lib/article-grouping.ts`.
- **Gotchas / invariants:** All values are computed at module load and `NEXT_PUBLIC_*` is inlined by Next.js at build time — toggling any of these requires a redeploy (`:16`). `ARTICLES_ENABLED` alone is opt-out (`!== "false"`), every other boolean is opt-in (`=== "true"`); mixing the two conventions up flips a section's default. Each flag's blast radius is documented inline: `ARTICLES_ENABLED`/`NOTES_ENABLED` gate the route **and** the nav link **and** the sitemap **and** the RSS feed (`:5-10`). `ARTICLE_DEDUP_KEY` only changes behaviour for articles that set **both** `linkedNote` and `canonicalUrl`, since each strategy falls back to the other field (`:65-67`). No dedicated test file.

### `src/lib/github.ts`
- **Role:** First-party, allowlist-gated GitHub repo feed replacing third-party `github-readme-stats` image embeds.
- **Exports:** `REPO_ALLOWLIST` (10 names, `:29-40`), `GithubRepo` (type, `:43-52`), `getRepoFeed()` (`:115`).
- **Reads / depends on:** `@/lib/profile` (`githubUser` as the owner), `https://api.github.com`, env `GITHUB_TOKEN` (optional).
- **Consumed by:** `src/app/api/github/stats/route.ts`, `src/app/projects/page.tsx`, `src/components/github-feed.tsx`.
- **Behaviour notes:** `getRepoFeed()` fetches all 10 allowlisted repos in parallel via `Promise.all`, drops nulls, and sorts newest-push-first (`:115-121`). Each `fetchRepo()` returns `null` on any non-OK status (404 private/renamed, 403 rate-limit) or any thrown error (`:96-109`). `next: { revalidate: 3600 }` puts the fetch in the ISR data cache in lockstep with the `/projects` page's hourly revalidate (`:100-101`). Auth header is added only when `GITHUB_TOKEN` is present (`:85-93`). `normalize()` returns `null` unless both `html_url` and `full_name` are non-empty strings, and coerces counts through `num()`/`str()` so a malformed payload becomes `0`/`null` rather than `undefined` (`:64-82`).
- **Gotchas / invariants:** **Server-only by convention, not enforcement** — the module reads `process.env.GITHUB_TOKEN` and the docblock explicitly notes that no `server-only` package is installed; the single server-component import site *is* the guarantee (`:6-10`). Importing this from a client component would attempt to ship the token read. Allowlist casing must match the canonical GitHub repo name exactly (`:28`) — note `gRPC-micro-services` and `Shop.this`. Fail-open is intentional: total failure yields `[]` and the feed simply hides rather than erroring in front of a recruiter (`:12-17`, `:112-114`). Guarded by `src/lib/github.test.ts` (no duplicate allowlist entries; `[]` on all-fail and on network error without throwing; 404s dropped; newest-push sort; no `Authorization` header when `GITHUB_TOKEN` unset, `Bearer` header when set).

### `src/lib/highlight-store.ts`
- **Role:** Transient client store that glows one project card when the chat model emits `[[cmd:highlight:<slug>]]`.
- **Exports:** `highlightProject(slug)`, `clearHighlight()`, `useHighlightedSlug()`.
- **Reads / depends on:** `react` (`useSyncExternalStore`); `"use client"` at `:1`.
- **Consumed by:** `src/components/chat/chat-messages.tsx:15` — and it imports **only** `highlightProject`. A repo-wide grep for `useHighlightedSlug` and `clearHighlight` finds **no importers at all**, so nothing currently subscribes to or clears this store; the highlight is written but never read. The docblock at `:9-10` claims `project-card.tsx` subscribes via `useSyncExternalStore` — `project-card.tsx` does not import this module.
- **Behaviour notes:** Auto-clears after **3000 ms** (`:33-38`); a second `highlightProject()` call clears the pending timer first so the window restarts rather than truncating (`:30`). `getServerSnapshot` is the inline `() => null` third argument (`:50`), so SSR always renders unhighlighted.
- **Gotchas / invariants:** State is a single module-level `string | null` — only one card can be highlighted at a time (`:12`). `clearHighlight()` must be used rather than setting the variable, otherwise `clearTimer` leaks and a stale timeout will null out a newer highlight (`:40-47`). No dedicated test file.

### `src/lib/utils.ts`
- **Role:** Single 3-line helper. Trivial.
- **Exports:** `cn(...inputs: ClassValue[])` — `twMerge(clsx(inputs))` (`:5-7`).
- **Consumed by:** `app/resume/page.tsx`, `game/terminal/terminal.tsx`, `ui/button.tsx`, `ui/empty-state.tsx`, `ui/section.tsx`, `ui/skeleton.tsx`, `view-switcher.tsx`.

## Test guards (which test file covers which module)

| Module | Guarding test |
|---|---|
| `content.ts` | `src/lib/notes.test.ts`, `src/lib/case-study-depth.test.ts` |
| `corpus.ts` | `src/lib/corpus.test.ts` |
| `game-model.ts` + `graph-data.ts` | `src/lib/game-model.test.ts` (**blocks deploys** on orphaned nodes/content) |
| `mcp-tools.ts` | `src/lib/mcp-tools.test.ts` |
| `personal.ts` | `src/lib/personal.test.ts` |
| `testimonials.ts` | `src/lib/testimonials.test.ts` |
| `github.ts` | `src/lib/github.test.ts` |
| `profile.ts` (indirect) | `src/lib/mcp-tools.test.ts:65` (résumé PDFs exist), `src/components/game/terminal/commands.test.ts` |
| `article-grouping.ts`, `llms-txt.ts`, `resume-json.ts`, `flags.ts`, `writing-flags.ts`, `enabled-views.ts`, `discovery-store.ts`, `highlight-store.ts`, `utils.ts` | **no dedicated test file** |

## Coverage

- `src/lib/content.ts`
- `src/lib/corpus.ts`
- `src/lib/game-model.ts`
- `src/lib/graph-data.ts`
- `src/lib/article-grouping.ts`
- `src/lib/llms-txt.ts`
- `src/lib/profile.ts`
- `src/lib/personal.ts`
- `src/lib/testimonials.ts`
- `src/lib/resume-json.ts`
- `src/lib/mcp-tools.ts`
- `src/lib/discovery-store.ts`
- `src/lib/enabled-views.ts`
- `src/lib/flags.ts`
- `src/lib/writing-flags.ts`
- `src/lib/github.ts`
- `src/lib/highlight-store.ts`
- `src/lib/utils.ts`

Read for context but owned by other sections: `velite.config.ts`, `src/app/api/mcp/[transport]/route.ts`, `src/app/.well-known/vercel/flags/route.ts`, `src/app/llms.txt/route.ts`, `.velite/index.d.ts`.
