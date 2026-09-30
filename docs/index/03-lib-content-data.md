---
kind: doc
title: lib — Content, Data Derivation & Domain Model
domain: [content]
status: current
version: v3.8.0
---

# lib — Content, Data Derivation & Domain Model

> Part of the Anvilry v3.8.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
>
> Describes Anvilry v3.8.0 (`package.json` 3.8.0), i.e. main @ a929932 (v3.6.0) plus five later fixes that touch this domain: notes are hidden at the data layer when `NOTES_ENABLED` is off, per-class rate-limit buckets (chat/voice/beacon) with a cron-secret bypass, admin auth shared through `isAdminAuthorized`, command-palette talk mode gated by `isVoiceViewActive`, and the bundle-budget `MIN_ROUTES` floor plus removal of dead components. Only the first changes code owned by this doc (`content.ts`, `llms-txt.ts`); the others are listed so a reader does not look for them here (rate limiting and auth live in the infra half of `src/lib`).

**Scope:** `src/lib/*.ts` (top level only), content/data/domain half — `content.ts`, `corpus.ts`, `decisions.ts`, `game-model.ts`, `graph-data.ts`, `article-grouping.ts`, `llms-txt.ts`, `profile.ts`, `personal.ts`, `testimonials.ts`, `resume-json.ts`, `mcp-tools.ts`, `claims-integrity.ts`, `integrity-chain.ts`, `discovery-store.ts`, `enabled-views.ts`, `flags.ts`, `writing-flags.ts`, `github.ts`, `utils.ts`, `highlight-store.ts`; plus the CLI `scripts/seal-claims.ts` and the committed ledger `data/integrity-chain.json`. Excludes `*.test.ts` and the AI/voice/infra half (`llm*.ts`, `llm-trace.ts`, `agent-trace.ts`, `chat-cache.ts`, `faq-embeddings.ts`, `voice-*`, `rate-limit.ts`, `redis.ts`, `admin-auth.ts`, `cron-auth.ts`, `health-expectations.ts`, `metadata-colors.ts`, `theme-context.tsx`, `r3f.ts`, `use-*.ts`, `telemetry/`, `scroll/`).
**Files indexed:** 21 `src/lib` modules + 1 script + 1 data file

There is **no `src/lib/avatar-glb.ts`** — `src/lib/avatar-glb.test.ts` is a standalone binary-asset invariant test that parses `public/avatar/sairam.glb` directly (`avatar-glb.test.ts:16`, budget `MAX_BYTES = 1.5 * 1024 * 1024` at `:21`). Likewise `notes.test.ts`, `notes-dark.test.ts` and `case-study-depth.test.ts` have no matching source module — all three test `content.ts`.

## At a glance

| File | Role | Key exports |
|---|---|---|
| `src/lib/content.ts` | Velite typed-access layer: re-exports generated collections with sort/filter helpers. The root of every derivation. | `Project`/`Work`/`Note`/`Article` (types), `allProjects`, `allWork`, `featuredProjects`, `pinnedProjects`, `projectGroups`, `projectsByGroup()`, `getProject()`, `getWork()`, `publishedNotes`, `allNotes`, `getNote()`, `hasNotes`, `inkforgeNotes`, `inkforgeArticles`, `allArticles`, `getArticle()`, `hasArticles` |
| `src/lib/corpus.ts` | Builds the in-context chatbot grounding document (docblock says ~4KB) from content + profile + personal + testimonials. | `buildCorpus()` |
| `src/lib/decisions.ts` | Flat architecture-decision ledger derived from `Project.decisions[]` and `Work.constraints`/`tradeoffs`; feeds `/decisions` and the `list_decisions` MCP tool. | `LedgerEntry`, `allDecisions`, `decisionsByTag()`, `DECISION_COUNTS` |
| `src/lib/game-model.ts` | Derivation layer mapping hero-graph node ids → real Velite content; builds quest nodes, dossiers, resolved edges. | `ContentKind`, `NODE_CONTENT`, `ResolvedContent`, `resolveNode()`, `hrefFor()`, `QuestNode`, `questNodes`, `graphEdgesResolved`, `DossierFact`, `Dossier`, `dossierFor()`, `questGroups()`, `TOTAL_SYSTEMS`, `CONTENT_COUNTS` |
| `src/lib/graph-data.ts` | Hand-authored 3D knowledge-graph topology: 16 nodes with deterministic positions, 19 edges, kind→color map. | `GraphNode`, `GraphEdge`, `graphNodes`, `graphEdges`, `kindColor`, `resolveKindColor()` |
| `src/lib/article-grouping.ts` | Groups multi-platform syndications of the same article into one canonical group; flag-driven dedup key. | `GroupingConfig`, `ArticleGroup`, `groupArticles()`, `getGroupSources()`, `filterGroupsBySource()` |
| `src/lib/llms-txt.ts` | Renders `/llms.txt` (llmstxt.org spec) from the content layer. | `buildLlmsTxt()` |
| `src/lib/profile.ts` | Static identity/skills/achievements/résumé source of truth; repo count derived from content. | `profile`, `impactMetrics`, `skills`, `achievements`, `resumeVariants` |
| `src/lib/personal.ts` | Owner-authored "beyond the résumé" content + empty-safe gates for easter eggs. | `UsesGroup`, `personal`, `now`, `hasPersonalContent`, `hasNow` |
| `src/lib/testimonials.ts` | Testimonials source (currently empty array) + dark-ship gate; requires `sourceUrl` per entry. | `Testimonial`, `testimonials`, `hasTestimonials` |
| `src/lib/resume-json.ts` | Builds the jsonresume.org v1.0.0 payload served at `/api/resume.json`. | `buildResumeJson()` |
| `src/lib/mcp-tools.ts` | Pure, transport-agnostic implementations + Zod input schemas for the portfolio MCP server (10 tools). | `RESUME_ROLES`, `ResumeRole`, `projectSlugSchema`, `workSlugSchema`, `searchSchema`, `resumeRoleSchema`, `decisionsTagSchema`, `contentTypeSchema`, `projectSlugs()`, `workSlugs()`, `NotFound`, `getProfileData()`, `listProjectsData()`, `getProjectData()`, `listWorkData()`, `getWorkData()`, `searchExperienceData()`, `getResumeVariantData()`, `listDecisionsData()`, `wrapToolResult()`, `listAllContentData()`, `getContentItemData()` |
| `src/lib/claims-integrity.ts` | Pure SHA-256 hash-chain primitives for the Claims Integrity Ledger (seals `impactMetrics` + `achievements`). | `ClaimsFields`, `ChainEntry`, `canonicalEncode()`, `computeHash()`, `buildEntry()`, `verifyChain()`, `currentClaimsMatchLastSeal()` |
| `src/lib/integrity-chain.ts` | Client-safe static import of `data/integrity-chain.json`. | `integrityChain` |
| `src/lib/discovery-store.ts` | localStorage-backed module-level external store tracking 4 exploration "discoveries". | `DiscoveryKey`, `unlock()`, `unlockAll()`, `useDiscoveries()`, `getDiscoveryCount()`, `DISCOVERY_TOTAL` |
| `src/lib/enabled-views.ts` | Build-time flag parsing which optional views (beyond Classic) exist in this build. | `isViewEnabled()`, `ENABLED_VIEWS` |
| `src/lib/flags.ts` | Dual-driver resolver for the one migrated flag (`NEXT_PUBLIC_DISCOVERY_BADGES`): Vercel Flags SDK vs build-time env. | `getDiscoveryBadgesEnabled()` |
| `src/lib/writing-flags.ts` | 9 build-time `NEXT_PUBLIC_*` booleans + 1 enum flag for writing sections, hiring signals, and article dedup. | `ARTICLES_ENABLED`, `NOTES_ENABLED`, `OPEN_TO_WORK`, `OPEN_TO_WORK_BANNER_HEIGHT_REM`, `STATS_ENABLED`, `SEARCH_ENABLED`, `TESTIMONIALS_ENABLED`, `INKFORGE_ARTICLES_ENABLED`, `GITHUB_STATS_ENABLED`, `DedupPrimaryKey`, `ARTICLE_DEDUP_KEY`, `CHROME_TTS_BANNER_ENABLED` |
| `src/lib/github.ts` | Allowlist-gated, fail-open GitHub repo feed with an hourly fetch-level data cache. | `REPO_ALLOWLIST`, `GithubRepo`, `fetchRepo()`, `getRepoFeed()`, `pushedAgo()` |
| `src/lib/highlight-store.ts` | Client external store that glows a project card for 3s when chat emits `[[cmd:highlight:<slug>]]`. Only `highlightProject` has a caller and nothing reads the store. | `highlightProject()`, `clearHighlight()`, `useHighlightedSlug()` |
| `src/lib/utils.ts` | Tailwind class merge helper (trivial). | `cn()` |
| `scripts/seal-claims.ts` | CLI that verifies (default) or appends to (`--write`) the ledger. | — (script) |
| `data/integrity-chain.json` | Committed ledger; currently one genesis entry (seq 1). | — (data) |

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
  │   sorts, filters drafts, hides notes while NOTES_ENABLED is off (content.ts:56),
  │   derives pinned/featured/inkforge subsets
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

`decisions.ts` also reads `content.ts` (`allProjects`, `allWork`, `decisions.ts:1`) and is consumed by `mcp-tools.ts:11` and `src/app/decisions/page.tsx`. Also derived, but not via `content.ts`: `profile.ts` imports `allProjects` solely to derive the "open-source repos" banner number (`profile.ts:6`, used at `profile.ts:65`), and `github.ts` imports `profile.githubUser` as the fetch owner (`github.ts:129`).

Real counts at this version (`.velite/*.json`): **projects 11, work 5, notes 7 published (0 visible: `NOTES_ENABLED` defaults off), articles 15 files (14 published — `how-dns-works-hashnode` is a draft — and 12 visible while notes are dark, because `how-dns-works` and `tombstone-v1-2-devto` only point at a note)**. `graph-data.graphNodes` has **16** entries (5 work + 11 projects) and `NODE_CONTENT` has **16** entries — the bijection asserted by `game-model.test.ts:55-57` currently holds exactly.

### Node-id → slug exceptions (exhaustive)

Three of the 16 graph node ids do **not** equal their content slug. These are intentional, cited verbatim:

| Node id | Content kind | Slug | Cite |
|---|---|---|---|
| `aava` | `work` | `aava-code` | `src/lib/game-model.ts:31` (`// node id != slug`) |
| `grpc` | `project` | `grpc-microservices` | `src/lib/game-model.ts:42` (`// node id != slug`) |
| `nhl` | `project` | `not-humans-lab` | `src/lib/game-model.ts:45` (`// node id != slug`) |

All other 13 mappings are identity (`game-model.ts:30,32-41,43-44,46-49`). The module docblock states the failure this map prevents: without it, "click a node → open its card" would 404 for "those three (including the flagship AAVA work item)" (`game-model.ts:21-22`).

The module docblock reads "3 of the **16** graph node ids" (`game-model.ts:19`), matching `graphNodes` and `NODE_CONTENT`, and the failure is stated count-free — "would 404 for those three" (`:21-22`) — so it cannot go stale when content is added (it once said "3 of the 10" and derived a percentage from it).

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
| `NEXT_PUBLIC_NOTES_ENABLED` | `NOTES_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:22` (also gates the data layer: `content.ts:56,82`) |
| `NEXT_PUBLIC_OPEN_TO_WORK` | `OPEN_TO_WORK` | `false` | `=== "true"` | `writing-flags.ts:24` |
| `NEXT_PUBLIC_STATS_ENABLED` | `STATS_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:38` |
| `NEXT_PUBLIC_SEARCH_ENABLED` | `SEARCH_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:40` |
| `NEXT_PUBLIC_TESTIMONIALS_ENABLED` | `TESTIMONIALS_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:44-45` |
| `NEXT_PUBLIC_INKFORGE_ARTICLES_ENABLED` | `INKFORGE_ARTICLES_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:49-50` |
| `NEXT_PUBLIC_GITHUB_STATS_ENABLED` | `GITHUB_STATS_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:54-55` |
| `NEXT_PUBLIC_ARTICLE_DEDUP_KEY` | `ARTICLE_DEDUP_KEY` | `"linkedNote"` | `raw === "canonicalUrl" ? "canonicalUrl" : "linkedNote"` (enum, not boolean) | `writing-flags.ts:78-80` |
| `NEXT_PUBLIC_CHROME_TTS_BANNER` | `CHROME_TTS_BANNER_ENABLED` | `false` | `=== "true"` | `writing-flags.ts:92-93` |

`ARTICLES_ENABLED` is the only inverted one — it is on unless explicitly set to the string `"false"` (`writing-flags.ts:20`). `OPEN_TO_WORK_BANNER_HEIGHT_REM` (defined just above `STATS_ENABLED`) is a non-flag layout constant (`"2.3125rem"`) living in the same module. `NOTES_ENABLED` is read directly by the `/notes` and `/articles` pages, `site-nav.tsx`, `sitemap.ts`, `article-group-card.tsx`, `related-writing.tsx` and `llms-txt.ts`, and by `content.ts`, where it empties `allNotes` and drops note-only articles so that surfaces with no check of their own (`feed.xml`, MCP, the chat corpus, the `.md` handlers) cannot publish a note the pages 404 (see the `content.ts` section).

### `src/lib/enabled-views.ts` — build-time comma-list

| Flag | Default when unset | Resolution mechanism | Cite |
|---|---|---|---|
| `NEXT_PUBLIC_ENABLED_VIEWS` | **all optional views enabled** | If `raw === undefined \|\| raw === null` → `new Set(ALL_OPTIONAL)`. Otherwise split on `","`, trim, lowercase, drop empties, and intersect with `ALL_OPTIONAL`. Setting it to the **empty string** therefore yields an empty set (Classic + `resume` only). | `enabled-views.ts:23`, `:27-34` |

`ALL_OPTIONAL = ["gamified", "chat", "developer", "voice", "resume"]` (`enabled-views.ts:20-21`). `isViewEnabled()` short-circuits `"classic"` and everything in `ALWAYS_OPTIONAL` (`["resume"]`) to `true` regardless of the flag (`enabled-views.ts:37-40`) — `View` is defined at `src/components/view-context.tsx:24`.

## MCP tool inventory

`src/lib/mcp-tools.ts` is transport-agnostic; the wiring is `src/app/api/mcp/[transport]/route.ts`. **The route registers 10 tools** (`registerTool` calls at `route.ts:20,30,40,49,59,68,78,88,98,109`; the route docblock says "10 read-only tools", `route.ts:12`).

Where the count is quoted or guarded (and where it deliberately is not), plus the result-shaping wrapper:

- `CLAUDE.md` (MCP Server section: "**10 tools**", followed by a ten-row table) and its Key Files row "MCP server (10 read-only tools)".
- The `mcp-tools.ts` docblock (`mcp-tools.ts:13-21`) carries no count — it states only the single-source and professional-only boundaries.
- The public documentation table `src/app/mcp/page.tsx:40-60` (`const TOOLS`) lists all ten, and is enforced: `src/app/mcp/tools-documented.test.ts` asserts the documented set and the route's `registerTool` calls are the same set — documents-nothing-extra (`:76`), documents-everything (`:81`), identical set and count (`:90`) — plus a regex-drop guard so an extraction failure cannot make the comparison vacuous (`:61`). `vitest run` is chained into `pnpm build`, so adding a tool without documenting it fails the build.
- `wrapToolResult()` (`mcp-tools.ts:241-251`) shapes every tool result for the wire: a bare array (every `list_*`/`search_experience` tool) fails the MCP SDK's runtime validation of `structuredContent` unless wrapped in `{ items: data }` first, and a result carrying a `notFound` key gets `isError: true`. It once lived unwrapped in the route file, so all array-returning tools failed on every real call, undetected because the tests only exercised the pure data functions; `mcp-tools.test.ts:107` now pins the wrapping.

| Tool (registered name) | Input schema (exact) | Impl | Not-found behaviour |
|---|---|---|---|
| `get_profile` | `{}` | `getProfileData()` `mcp-tools.ts:73` | n/a — always resolves; withholds `email` and `calendlyUrl` |
| `list_projects` | `{}` | `listProjectsData()` `:99` | n/a |
| `get_project` | `projectSlugSchema` = `{ slug: z.string().describe("project slug, e.g. mindforge") }` `:37-39` | `getProjectData()` `:111` | `notFound("project", slug, projectSlugs())` `:113` |
| `list_work` | `{}` | `listWorkData()` `:127` | n/a |
| `get_work` | `workSlugSchema` = `{ slug: z.string().describe("work slug, e.g. pensieve") }` `:40-42` | `getWorkData()` `:139` | `notFound("work", slug, workSlugs())` `:141` |
| `search_experience` | `searchSchema` = `{ query: z.string().min(1).max(120).describe(...) }` `:43-49` | `searchExperienceData()` `:155` | none — returns `{ query, matches: [], skills: [] }` on no match |
| `get_resume_variant` | `resumeRoleSchema` = `{ role: z.enum(RESUME_ROLES) }` `:50-54`, where `RESUME_ROLES = ["master"]` `:24` | `getResumeVariantData()` `:193` | `notFound("resume_variant", role, [...RESUME_ROLES])` `:196` (unreachable while `ROLE_TO_LABEL` stays in sync) |
| `list_all_content` | `{}` | `listAllContentData()` `:253` | n/a |
| `get_content_item` | `contentTypeSchema` = `{ type: z.enum(["work","project","article","note"]), slug: z.string() }` `:228-231` | `getContentItemData()` `:287` | delegates to `getWorkData`/`getProjectData`, or `notFound("article"\|"note", slug, <all slugs>)` `:299`,`:316` |
| `list_decisions` | `decisionsTagSchema` = `{ tag: z.string().optional() }` `:205-210` | `listDecisionsData(tag?)` `:214` | none — an unknown tag returns `[]` |

Error contract: `notFound()` returns `{ notFound: true, kind, given, valid }` (`mcp-tools.ts:59-71`); `wrapToolResult()` detects the `notFound` key and sets `isError: true` on the MCP result — so the calling agent receives the list of valid options instead of a fabricated answer. The route itself is thin: each handler is `T.wrapToolResult(T.<impl>(...))`.

## Detail

### `src/lib/content.ts`
- **Role:** The single typed access layer over Velite's generated output; every other content derivation reads from here.
- **Exports:** types `Project`/`Work`/`Note`/`Article` (re-exported from `.velite`); `allProjects`, `allWork` (sorted by `order`); `featuredProjects`; `pinnedProjects`; `projectGroups` (const tuple); `projectsByGroup()`; `getProject(slug)`, `getWork(slug)`; `publishedNotes`, `allNotes`, `getNote(slug)`, `hasNotes`; `inkforgeNotes`, `inkforgeArticles`; `allArticles`, `getArticle(slug)`, `hasArticles`.
- **Reads / depends on:** `../../.velite` — a **relative** import, deliberately, because `.velite` lives at the repo root outside `src` (`content.ts:1-14`); and `NOTES_ENABLED` from `@/lib/writing-flags` (`:15`). No network.
- **Consumed by:** 47 non-test files including all four content route trees, `sitemap.ts`, `feed.xml/route.ts`, all four `/api/md/*` routes, all four `[slug].md` routes, `command-palette-content.tsx`, `game/terminal/commands.ts`, the two cron audits, and the sibling lib derivations (`corpus.ts`, `decisions.ts`, `game-model.ts`, `llms-txt.ts`, `resume-json.ts`, `mcp-tools.ts`, `article-grouping.ts` type-only, `profile.ts`, `agent-trace.ts`).
- **Behaviour notes:** Arrays are copied (`[...raw]`) before sorting so the Velite export is never mutated (`content.ts:21-22,50,80`). `byOrder` sorts ascending on `order` (`:19`) — Velite defaults `order` to `100` (`velite.config.ts:45,65`). **Notes are hidden at the data layer**: `publishedNotes` (`:50-52`) is every non-draft note, newest first, regardless of the flag; `allNotes` (`:56`) is `publishedNotes` only when `NOTES_ENABLED`, else `[]`. Every machine-readable consumer (llms.txt, feed, MCP, chat corpus, `.md` handlers, `inkforgeNotes`/`inkforgeArticles`, `hasNotes`) reads `allNotes`, so a dark `/notes` cannot leak note URLs. The only `publishedNotes` readers are `src/app/notes/[slug]/page.tsx:25` and `src/app/notes/[slug]/opengraph-image.tsx:13`, because `cacheComponents` needs `generateStaticParams` to return at least one entry even while the section is dark. `allArticles` (`:80-83`) drops drafts, and — while notes are dark — drops articles that only point at a note (`isNoteOnlyArticle`, `:73-74`: a `linkedNote` and either no `externalUrl` or one starting with `https://anvilry.vercel.app/notes/`, `:69`), since they would link to a 404. Notes and articles sort **newest-first by ISO string comparison**, not `Date` (`:52,83`).
- **Gotchas / invariants:** `pinnedProjects` requires **both** `pinned === true` and `pinRank != null`; a project marked pinned without a rank is silently dropped (`content.ts:27-29`). `projectGroups` (`:31-35`) is a hand-copied duplicate of the `themeGroup` enum in `velite.config.ts:4-8` and of `projectGroupOrder` in `game-model.ts:177-181` — three copies of the same three strings must stay in sync. `hasNotes`/`hasArticles` (`:59,86`) are the dark-ship gates for nav links and section rendering. `inkforgeNotes` (`:62`) and `inkforgeArticles` (`:67`) both filter **`allNotes`** (not `allArticles`) with the same predicate — drafts are already gone from `allNotes`, so the extra `!n.draft` is redundant. Guarded by `src/lib/notes.test.ts` (draft exclusion, newest-first, parseable dates, `hasNotes` truthiness, all over `allNotes`, so those loops are empty unless `NEXT_PUBLIC_NOTES_ENABLED=true` is set in the test env), `src/lib/notes-dark.test.ts` (re-imports the module graph with the flag stubbed both ways: with notes dark `allNotes` is `[]`, `publishedNotes` is not, llms.txt / feed / MCP / corpus / both `.md` handlers publish nothing; with notes on everything publishes them) and `src/lib/case-study-depth.test.ts` (`diagram` ⇒ non-empty `diagramAlt`, and the asset exists under `public/`).

### `src/lib/corpus.ts`
- **Role:** Assembles the entire chatbot grounding document as one markdown string.
- **Exports:** `buildCorpus(): string` (`corpus.ts:13`).
- **Reads / depends on:** `@/lib/content` (`allProjects`, `allWork`, `allNotes`), `@/lib/profile` (`profile`, `skills`, `achievements`), `@/lib/personal` (`personal`, `now`, `hasPersonalContent`, `hasNow`), `@/lib/testimonials` (`testimonials`, `hasTestimonials`) (`corpus.ts:1-4`).
- **Consumed by:** `src/app/api/chat/route.ts`, `src/app/llms-full.txt/route.ts`, `src/components/game/terminal/commands.ts`.
- **Behaviour notes:** Fixed order: header (`# name — role @ company (tenure)`, Location, Summary, a Links line covering GitHub/LinkedIn/npm/PyPI/Dev.to/Substack, and `Contact: ${profile.email}`, `:79-83`) → `## Production Work (at Ascendion)` (`:85`) → `## Open-Source Projects (github.com/<githubUser>)` (`:88`) → `## Skills` (`:91`) → `## Achievements` (`:94`) → optional `## Personal (beyond the résumé)` → optional `## Recommendations` → optional `## Writing`. Three sections are conditional and collapse to `""` when their source is empty: personal on `hasPersonalContent || hasNow` (`:43-65`), testimonials on `hasTestimonials` (`:69-71`), notes on `allNotes.length` (`:75-77`; heading is `## Writing`, listing each note's title and summary). Because `allNotes` is empty while `NOTES_ENABLED` is off, the default corpus has no Writing section. Inside the personal block each line is individually gated then `.filter(Boolean).join("\n")` (`:45-64`), so a partially filled `personal.ts` emits only its populated lines. No decisions or articles are included.
- **Gotchas / invariants:** Work entries emit `Contribution: ${w.register}` verbatim (`:17`) — the honest-attribution field flows straight into the model context. Project commits render only when truthy (`p.commits ? ... : ""`, `:26-28`), so `commits: 0` would be omitted. Nothing truncates, so corpus size grows linearly with content; the docblock still pins the size at ~4KB (`:9-11`) and names pgvector + BM25 as the upgrade path — stale now that the corpus holds 11 projects, 5 work items and the personal block. The owner's email is placed in LLM context (`:83`), unlike the MCP `get_profile` tool, which withholds it. Guarded by `src/lib/corpus.test.ts` (professional record always present, `:13`; personal section present **iff** `personal.ts` is populated, `:20`) and `notes-dark.test.ts` (no `## Writing` while dark).

### `src/lib/decisions.ts`
- **Role:** Derivation layer that surfaces architecture-decision narratives already living in project frontmatter (`Project.decisions[]`) and work case studies (`Work.constraints` / `Work.tradeoffs`) as one flat, typed ledger — zero duplication, zero fabrication. Mirrors `game-model.ts` for the decisions surface (`decisions.ts:3-10`).
- **Exports:** `LedgerEntry` (`{ id, sourceKind: "work" | "project", sourceSlug, sourceName, title, body, tags, href }`, `:12-21`), `allDecisions` (`:65`), `decisionsByTag(tag)` (`:67-69`), `DECISION_COUNTS` `{ projectEntries, workEntries, totalEntries }` (`:72-76`).
- **Reads / depends on:** `@/lib/content` (`allProjects`, `allWork`) (`:1`).
- **Consumed by:** `src/app/decisions/page.tsx` (client page; category and tag filters) and `mcp-tools.ts:11` (`list_decisions`).
- **Behaviour notes:** Project entries come first (`allProjects.flatMap(p.decisions)`, `:23-34`), ids `project:<slug>:<index>`, tags copied from the decision, `href = p.url`. Work entries follow (`:36-63`): one `Constraints` and/or one `Tradeoffs` entry per work item that populates the field, ids `work:<slug>:constraints|tradeoffs`, **tags always `[]`**. `allDecisions` is projects-then-work (`:65`). All 11 project MDX files currently carry a `decisions:` block.
- **Gotchas / invariants:** Work entries never carry tags, so tag filtering only ever matches project entries (the `/decisions` page scopes tags to the active category for that reason). No project populates `tags` today (all 33 project decisions are untagged), so every tag filter — the page's tag row, which renders only when at least two distinct tags exist, and `list_decisions`'s `tag` — currently matches nothing; the tests only prove the filter path is empty-safe (`decisions.test.ts:95`, `mcp-tools.test.ts:93`). Guarded by `src/lib/decisions.test.ts`: every project with `decisions[]` has entries (`:16`), every populated work `constraints`/`tradeoffs` has one (`:31`), title/body trace verbatim to content (`:44`), every entry deep-links to a canonical route (`:75`), ids are unique and stable (`:83`), counts form a bijection (`:88`), `decisionsByTag` returns only tagged entries (`:95`).

### `src/lib/game-model.ts`
- **Role:** The gamified view's derivation layer — turns hand-authored graph nodes into content-backed quest nodes, dossiers, and drawable edges.
- **Exports:** `ContentKind`, `NODE_CONTENT`, `ResolvedContent`, `resolveNode()`, `hrefFor()`, `QuestNode`, `questNodes`, `graphEdgesResolved`, `DossierFact`, `Dossier`, `dossierFor()`, `questGroups()`, `TOTAL_SYSTEMS`, `CONTENT_COUNTS`.
- **Reads / depends on:** `@/lib/content` (`allProjects`, `allWork`, `getProject`, `getWork`), `@/lib/graph-data` (`graphNodes`, `graphEdges`, `GraphNode`).
- **Consumed by:** `src/components/game/build-graph-scene.tsx`, `build-graph.tsx`, `dossier-card.tsx`, `graph-index.tsx`, `game/terminal/commands.ts`.
- **Behaviour notes:** `resolveNode()` returns `null` for an unmapped id **or** a mapped-but-missing slug (`:62-71`); `questNodes` is built with `flatMap` so nulls are dropped rather than throwing (`:96-109`). `graphEdgesResolved` keeps only edges whose **both** endpoints survived into `questNodes`, using a `Map` built from those nodes (`:116-121`). `dossierFor()` branches on content kind: work dossiers carry `register` and map `w.metrics` 1:1 into facts (`:145-155`); project dossiers synthesise facts — `commits` only when `p.commits != null` (`:160`) plus an always-present `"<n> technologies"` fact (`:161`) — and carry `repo` (`:170`). `questGroups()` emits `"Production Work"` first, then the three project groups, and filters out empty groups (`:175-191`).
- **Gotchas / invariants:** `NODE_CONTENT` must stay exhaustive over `graphNodes` — `game-model.test.ts:22` asserts zero unmapped ids and `:42-52` asserts reverse coverage (no work item or project unreachable from the graph). `CONTENT_COUNTS` (`:197-202`) exists purely so the test imports one module; `game-model.test.ts:55-57` asserts `nodes === quests` **and** `work + projects === nodes`, i.e. adding a content file without adding a graph node **fails the build**. `hrefFor()` trusts Velite's `url` transform (`:74-76`); `game-model.test.ts:60-63` pins the shape to `/^\/(work|projects)\/[a-z0-9-]+$/`. `game-model.test.ts:73-100` additionally asserts every dossier fact traces to a real content value (register/blurb/name verbatim, tech-count and commit-count exact) — inventing a dossier fact fails the build. The visual `kind` from `graph-data` is deliberately distinct from `ContentKind` and is collapsed at `NODE_CONTENT` (`:13-27`).

### `src/lib/graph-data.ts`
- **Role:** The hand-authored topology and palette for the hero/gamified WebGL graph.
- **Exports:** `GraphNode` (type, `:8-14`), `GraphEdge` (type, `[string, string]`, `:16`), `graphNodes` (16 entries, `:18-81`), `graphEdges` (19 entries, `:83-110`), `kindColor` (`:112-117`), `resolveKindColor(colors)` (`:128-140`, the theme-aware counterpart).
- **Reads / depends on:** nothing — pure data, no imports.
- **Consumed by:** `src/components/game/build-graph-scene.tsx`, `game/dossier-card.tsx`, `src/components/hero-graph/scene.tsx`, and `src/lib/game-model.ts`.
- **Behaviour notes:** Positions are literal tuples with **no `Math.random`**, so SSR/build output is stable (`graph-data.ts:1-7`). Visual `kind` is one of `work | agent | engine | tool` (`:11`) and maps to hex colors `#38e1ff` / `#a78bfa` / `#4ade80` / `#fbbf24` (`:112-117`). `kindColor` is a build-time/SSR-safe default that never reacts to a theme flip; hook-capable components pass `useThemeColors()` output to `resolveKindColor` instead (`:119-127`).
- **Gotchas / invariants:** Positions are constrained by an explicit frustum budget recorded inline: "Positions kept within frustum: camera z=7, fov=45 → visible half-height ≈ 2.9 / SCALE=1.6 ≈ 1.8 units" (`:77`) — node coordinates outside roughly ±1.8 on Y will clip. Adding a node here without a matching `NODE_CONTENT` entry fails `game-model.test.ts`.
- **Docblock is deliberately count-free.** It reads "Nodes = every flagship work system + every OSS repo (see `graphNodes` below for the count — game-model.ts asserts a bijection with real content, so it moves with the content)" (`graph-data.ts:3-4`); an earlier "5 flagship work systems + 8 OSS repos" wording had gone stale. The data is authoritative — 16 nodes: work 5, agent 3 (mindforge, agent-forge, contextos), engine 4 (graph-forge, ag-bash, grpc, trelix), tool 4 (commandvault, nhl, tombstone, inkforge) (`:18-81`) — and the bijection test (`game-model.test.ts:55-57`) is what actually pins the count.

### `src/lib/article-grouping.ts`
- **Role:** Collapses the same article syndicated to multiple platforms into a single canonical group.
- **Exports:** `GroupingConfig` (interface), `ArticleGroup` (interface), `groupArticles()`, `getGroupSources()`, `filterGroupsBySource()`.
- **Reads / depends on:** type-only `Article` from `@/lib/content`, type-only `ArticleSource` from `@/components/platform-badge`, and `ARTICLE_DEDUP_KEY` + `DedupPrimaryKey` from `@/lib/writing-flags` (`article-grouping.ts:1-4`).
- **Consumed by:** `src/app/articles/page.tsx`, `src/components/article-group-card.tsx`, `src/components/home/writing-preview.tsx`, `src/lib/llms-txt.ts`.
- **Behaviour notes:** Two-pass algorithm. Pass 1 assigns each article a key — `note:<linkedNote>` or `canonical:<canonicalUrl>`, order decided by `config.primaryKey`, with the other field always as fallback (`:62-76`); articles with neither field go to `ungrouped` (`:82`). Pass 2 sorts each bucket by rank `native=0 > has linkedNote=1 > external=2`, then newest-first, and takes `sorted[0]` as `canonical` with the rest as `externalPlatforms` (`:90-102`). Ungrouped articles become single-item groups (`:105-111`). Final sort is newest canonical first with `slug.localeCompare` as a deterministic tiebreaker (`:114-117`).
- **Gotchas / invariants:** `safeMs()` coerces an unparseable ISO date to `0` so `NaN` can never poison the sort (`:10-13`) — malformed dates sort last, not randomly. `DEFAULT_CONFIG` captures `ARTICLE_DEDUP_KEY` at **module load** (`:30`), so the flag is build-time-frozen unless a caller passes an explicit config. `getGroupSources()` returns sources in the fixed `SOURCE_ORDER` (`:7`, `:129`), so a new platform must be appended to that array to appear in the filter bar. `ArticleGroup.platforms` **includes** the canonical; `externalPlatforms` excludes it (`:34-38`). No dedicated test file exists for this module (**UNVERIFIED** whether it is covered indirectly by any `*.dom.test.tsx`).

### `src/lib/llms-txt.ts`
- **Role:** Renders the `/llms.txt` discovery document.
- **Exports:** `buildLlmsTxt(): string` (`llms-txt.ts:13`).
- **Reads / depends on:** `@/lib/profile`, `@/lib/content` (`allWork`, `allProjects`, `allNotes`, `allArticles`), `@/lib/article-grouping` (`groupArticles`), `NOTES_ENABLED` from `@/lib/writing-flags` (`:1-4`).
- **Consumed by:** `src/app/llms.txt/route.ts` (a bare `GET` returning `text/plain; charset=utf-8`).
- **Behaviour notes:** `BASE = "https://anvilry.vercel.app"` is hardcoded (`:6`). Articles are deduped through `groupArticles(allArticles)` with the default config (`:23`); each group's href is `${BASE}/notes/${linkedNote}` only when the canonical article has a `linkedNote` **and** `NOTES_ENABLED` (`:29-31`), else its `externalUrl`, else `${BASE}${url}` — so a dark notes section is never advertised. Summaries are truncated with an unconditional `"..."` appended: articles at 100 chars (`:32`), notes at 80 (`:43`). The Articles and Notes sections are omitted entirely when empty (`:63`); notes are empty while `NOTES_ENABLED` is off. A hardcoded `## Availability` block (`:54-56`) always claims open-to-work and ignores `OPEN_TO_WORK`. The `## Links` block (`:65-76`) covers portfolio, GitHub, LinkedIn, npm, PyPI, Dev.to, Substack, résumé, `/api/resume.json` (`:74`), the MCP server at `/api/mcp/mcp` (`:75`) and the RSS feed. A `## AI Usage Policy` section (`:78-86`) states the robots.txt Content-Signal preference (search=yes, ai-input=yes, ai-train=no) as a preference, not enforcement. `## Markdown Versions` (`:88-102`) lists `<url>.md` for all work, all projects, all notes (or the literal `"(none yet)"`, `:96`), and **only non-external articles** (`:98-102`, no empty guard).
- **Transport advertisement:** the MCP line emits the live Streamable HTTP endpoint (`- MCP server (for AI agents): ${BASE}/api/mcp/mcp`, `llms-txt.ts:75`), never `/api/mcp/sse`, which the route deliberately 404s via `disableSse: true` (`route.ts:127`, rationale `:121-126`).
- **Guards:** `src/lib/llms-txt.test.ts` — asserts the advertised transport by anchoring on the exact `- MCP server (for AI agents):` line prefix (`:14`; a substring match hit a project summary interpolated above the Links section), asserts `/api/mcp/sse` appears nowhere (`:28`), and reads the route source to tie that to the actual `disableSse: true` setting (`:32`); a second block pins the AI Usage Policy section (`:45-64`). `notes-dark.test.ts` asserts no `/notes/` URL appears while notes are dark.
- **Gotchas / invariants:** The hardcoded `BASE` here is one of the base-URL sites — `https://anvilry.vercel.app` is hardcoded in **24 files / 33 occurrences** (20 non-test files / 25 lines, plus 4 test files that assert the same host; the "Custom domain" note in `CLAUDE.md` gives the grep). `resume-json.ts:4` and `mcp-tools.ts:22` are two of the sibling lib copies. Run `grep -rn 'anvilry\.vercel\.app' src Makefile` rather than trusting any enumeration.

### `src/lib/profile.ts`
- **Role:** Static, hand-maintained identity/skills/achievements/résumé record.
- **Exports:** `profile` (`as const` object), `impactMetrics`, `skills`, `achievements`, `resumeVariants`.
- **Reads / depends on:** `@/lib/content` (`allProjects`) — its only import (`profile.ts:6`).
- **Consumed by:** 44 non-test `src/` files — every page/layout, all `opengraph-image.tsx` files, `manifest.ts`, `json-ld.tsx`, `site-nav`/`site-footer`/`mobile-nav`, the terminal, and the lib derivations `corpus.ts`, `github.ts`, `llm.ts`, `llms-txt.ts`, `mcp-tools.ts`, `resume-json.ts`, plus `scripts/seal-claims.ts`.
- **Behaviour notes:** `profile` (`:8-40`) holds `name`, `role`, `company`, `tenure`, `location`, `locationCity`/`locationCountry` (structured for JSON-LD), `headline`, `subhead`, `email`, `calendlyUrl`, `links.{github,linkedin,npm,pypi,devto,substack,resume}` (`:23-38`) and `githubUser` (`:39`). `impactMetrics` (`:46-70`) has 3 entries; the third value is **derived** — `` `${allProjects.length}` `` (`:65`) — explicitly so the banner number cannot drift from published content (rationale `:42-45`). `skills` is 6 groups (`:72-122`); `achievements` is 5 entries (`:124-133`); `resumeVariants` (`:135-142`) has **exactly one** entry, "Sairam Resume" → `/resume/Sairam_Resume_MX_E.pdf` (tag "Backend & GenAI"), the single canonical résumé.
- **Gotchas / invariants:** `location` and `locationCity`/`locationCountry` are duplicated data that must be kept in sync — the comment says so at `:14`. `resumeVariants[].label` is the join key for `mcp-tools.ts`'s `ROLE_TO_LABEL` (`mcp-tools.ts:28-34`); renaming the label breaks `get_resume_variant`, and `mcp-tools.test.ts:82` asserts every role resolves to a variant whose PDF exists on disk. `impactMetrics` and `achievements` are the two fields hashed into the Claims Integrity Ledger (see below): editing either — or adding/removing a project, which changes the derived count — fails the CI seal check until a new entry is sealed. No dedicated `profile.test.ts`.

### `src/lib/personal.ts`
- **Role:** The one source for all "beyond the résumé" reveals (terminal `secret`/`uses`/`now`/`about`, chat corpus).
- **Exports:** `UsesGroup` (type, `:21`), `personal` (`as const`, `:23-57`), `now` (`as const`, `:65-77`), `hasPersonalContent` (`:83-88`), `hasNow` (`:91`).
- **Reads / depends on:** nothing.
- **Consumed by:** `src/app/about/page.tsx`, `game/developer-view.tsx`, `game/easter-eggs.tsx`, `game/terminal/boot-banner.ts`, `game/terminal/commands.ts`, `components/json-ld.tsx`, `src/lib/corpus.ts`.
- **Behaviour notes:** Currently **populated**: 4 hobbies, 2 funFacts, 4 currentlyLearning, 4 askMeAbout, 4 `uses` groups (`:25-56`); `now.updated = "2026-06-14"` with 4 focus lines (`:69-76`). `hasPersonalContent` is an OR across all five lists (`:83-88`); `hasNow` requires **both** `updated !== ""` and a non-empty `focus` (`:91`).
- **Gotchas / invariants:** The file header (`:1-18`) still says "EMPTY BY DEFAULT" and carries an OWNER TODO checklist although every list is filled — stale prose, the data is live. `now.updated` is annotated `as string` rather than the literal type specifically so the `!== ""` comparison stays type-valid whether or not it is filled (`:66-69`). Emptying the arrays is the documented way to make every egg go dark rather than show a placeholder (`:6-9`). Guarded by `src/lib/personal.test.ts` (shape, `:11`; `hasPersonalContent` iff a list is non-empty, `:21`; `hasNow` iff dated **and** non-empty, `:31`; every `uses` group has a label and ≥1 item, `:35`).

### `src/lib/testimonials.ts`
- **Role:** Social-proof source + its dark-ship gate.
- **Exports:** `Testimonial` (type, `:14-24`), `testimonials` (currently `[]`, `:26`), `hasTestimonials` (`:29`).
- **Reads / depends on:** nothing.
- **Consumed by:** `src/components/home/testimonials.tsx`, `src/lib/corpus.ts`.
- **Behaviour notes:** `testimonials` is an empty array at this version (`:26`), so `hasTestimonials === false` (`:29`) and both the homepage strip and the corpus `## Recommendations` section are omitted.
- **Gotchas / invariants:** `sourceUrl` is a **required** field on the type and is documented as the anti-fabrication guarantee — an entry without a real public permalink is invalid (`:6-9`, `:22-23`). `src/lib/testimonials.test.ts:14` asserts every present entry has a real source URL plus all required fields, so adding a quote without a link fails the build. The homepage section is *also* behind `TESTIMONIALS_ENABLED` (`writing-flags.ts:44-45`), i.e. two independent gates.

### `src/lib/resume-json.ts`
- **Role:** Builds the machine-readable JSON Resume payload.
- **Exports:** `buildResumeJson()` (`:12`) — returns a plain object, not a string.
- **Reads / depends on:** `@/lib/profile` (`profile`, `skills`, `achievements`), `@/lib/content` (`allWork`, `allProjects`).
- **Consumed by:** `src/app/api/resume.json/route.ts` only.
- **Behaviour notes:** Pins `$schema` to `https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json` (`:14-15`). `basics` carries name, label, email, summary, structured location and `url: BASE` (`:16-24,49`); `profiles[]` has **six** entries — GitHub, LinkedIn, npm, PyPI, Dev.to, Substack — with hardcoded npm/PyPI/Dev.to/Substack usernames (`:25-48`). Every `work[]` entry uses `profile.company` as the employer name (`:52`) and folds the register into the summary as `` `${w.register}. ${w.summary}` `` (`:54`); highlights are `metrics` flattened to `"<value> <label>"` strings (`:55`). Projects set `url` to the **repo** and `entity` to the on-site dossier page (`:58-65`). `skills` maps the skill groups (`:66`) and `awards` maps `achievements` (`:67`). `meta` is `{ canonical: "<BASE>/api/resume.json", version: "v1" }` (`:69`).
- **Gotchas / invariants:** `education` is deliberately absent, with the reason stated inline — no education data exists in `profile.ts` and it is not invented (`:9-10`, `:68`). The LinkedIn profile entry reports `profile.githubUser` as its `username` (`:31-35`). Hardcoded `BASE` at `:4`. No dedicated test file.

### `src/lib/mcp-tools.ts`
- **Role:** Pure implementations + Zod input schemas behind the portfolio MCP server; the route is thin wiring.
- **Exports:** see the At-a-glance row and the MCP tool inventory above.
- **Reads / depends on:** `zod`, `@/lib/content` (`allProjects`, `allWork`, `allArticles`, `allNotes`, `getProject`, `getWork`), `@/lib/profile` (`profile`, `skills`, `achievements`, `resumeVariants`), `@/lib/decisions` (`allDecisions`) (`mcp-tools.ts:1-11`).
- **Consumed by:** `src/app/api/mcp/[transport]/route.ts` only (imported as `* as T`).
- **Behaviour notes:** All URLs are absolutised with the hardcoded `BASE` (`:22`). `getProfileData()` hand-picks fields (`:73-97`) rather than spreading `profile` — `email` and `calendlyUrl` are **not** returned (the `links` block does include the `substack` profile URL). `searchExperienceData()` is a case-insensitive substring match over joined field strings: work matches on `name/role/register/summary/tech` (`:157-163`), projects on `name/tagline/group/tech` (`:170-176`), skills on `group/items` with the item list itself filtered down to matching items (`:183-189`); work + project hits are merged into one `matches` array while skills are a separate key (`:190`). `listDecisionsData(tag?)` (`:214-226`) maps `allDecisions` to `{ sourceKind, sourceName, title, body, tags, url }`, filtered by exact tag membership when a tag is given. `getContentItemData()` is an exhaustive `switch` over the 4 content types with no `default` (`:287-329`). Because it reads `allNotes` / `allArticles`, notes are invisible to `list_all_content` and `get_content_item` while `NOTES_ENABLED` is off.
- **Gotchas / invariants:** `personal.ts` is deliberately **not** imported — the professional-only boundary is stated at `:19-20` and asserted by `mcp-tools.test.ts:24` ("does NOT leak personal.ts"). `RESUME_ROLES` is `["master"]` (`:24`) and `ROLE_TO_LABEL` (`:28-34`) maps it to the exact `resumeVariants[].label` `"Sairam Resume"`; the comment at `:30-33` spells out the three edits needed to re-add a role (keyword, exact label, PDF in `public/resume/`). A label rename in `profile.ts` silently breaks `get_resume_variant`. `notFound()` results are structurally identified by the presence of the `notFound` key, which is what `wrapToolResult()` turns into `isError: true`; renaming that key would make errors look like successes. `mcp-tools.test.ts:48` asserts `list_projects`/`list_work` cover the whole content layer (zero drift) and `:93` covers `list_decisions` including the tag filter.

### `src/lib/claims-integrity.ts`, `src/lib/integrity-chain.ts`, `scripts/seal-claims.ts`, `data/integrity-chain.json` — Claims Integrity Ledger
- **Role:** A hash chain over the résumé claim strings (`impactMetrics` + `achievements` from `profile.ts`) so a claim's stability since a specific commit is independently verifiable. It proves the strings have **not been silently edited since sealing**, not that they were ever accurate — there is no independent issuer, and every user-facing surface must say so (`claims-integrity.ts:1-16`). Simplified from Tombstone's Merkle-chain audit log: same length-prefixed encoding and prev-hash chaining, plain SHA-256, no locking (single writer).
- **`claims-integrity.ts` exports:** `ClaimsFields` (`:19-22`), `ChainEntry` (`{ seq, prevHash, hash, parentCommitSha, sealedAt, fields }`, `:24-31`), `canonicalEncode()` (`:39-46`), `computeHash()` (`:52-56`), `buildEntry()` (`:58-74`), `verifyChain()` (`:82-101`), `currentClaimsMatchLastSeal()` (`:104-113`). Imports only `node:crypto`.
- **Mechanics:** `canonicalEncode` emits `<len>:<json>` for `impactMetrics` then `achievements` in fixed order — never delimiter-joined, so two distinct pairs cannot serialise identically. `computeHash` is `sha256:` + hex of `${encoded}${prev.length}:${prev}` with a null prev treated as `""`, so each entry commits to its whole history. `buildEntry` uses seq 1 / `prevHash: null` at genesis, else `prev.seq + 1`. `verifyChain` re-derives every hash and checks every `prevHash` link, returning the first broken `seq`. `currentClaimsMatchLastSeal` recomputes with the last entry's `prevHash` and compares to its `hash`.
- **`integrity-chain.ts`** (`:7-10`): imports `data/integrity-chain.json` directly (no `fs`), so it is safe in client components; consumed by the terminal `integrity` command (`src/components/game/terminal/commands.ts:242-288`, import at `:6`).
- **`data/integrity-chain.json`:** one entry — seq 1, `prevHash: null`, sealed 2026-09-07, with the sealed repo count literally `"11"` (`:22-27`).
- **`scripts/seal-claims.ts`:** run via `pnpm seal-claims` (`package.json:18`) / `tsx scripts/seal-claims.ts [--write]`; must be `tsx`, not bare `node`, because `profile.ts` uses the `@/*` alias (`:10-13`). It always verifies linkage first and exits 1 with `CHAIN BROKEN at seq N` if broken (`:43-50`). With `--write` it appends a new entry only if the claims changed (`:52-70`; `buildEntry` at `:59` with `git rev-parse HEAD` from `parentCommitSha()` `:32-36` and `new Date().toISOString()` `:63`; write at `:67`). Without it, it exits 1 if the current claims differ from the last seal (`:73-80`), else prints "Claims Integrity Ledger OK — N entry, chain intact." (`:81-83`).
- **CI:** step "Claims integrity chain" (`.github/workflows/ci.yml:83`) runs the verify mode in the `ci` job; the opt-in job `claims-integrity-autocommit` (`ci.yml:86`) has `needs: ci` (`:97`) and `if: vars.SEAL_CLAIMS_AUTO_COMMIT == 'true'` (`:98`) and is off by default.
- **Gotchas / invariants:** `CHAIN_PATH` is cwd-relative (`seal-claims.ts:25`) — from the wrong directory the chain loads as `[]`, so the verify run exits 1 ("changed since the last seal") and `--write` would try to seal a fresh genesis entry under that directory. `parentCommitSha` is `HEAD` at sealing time, not the commit that contains the ledger file. Only `impactMetrics` and `achievements` are hashed, but `impactMetrics[2].value` is `allProjects.length` (`profile.ts:65`), so adding or removing a project fails the CI seal step until `seal-claims --write` is committed. Guarded by `src/lib/claims-integrity.test.ts` (length-prefixed encoding incl. the `'ab','c'` vs `'a','bc'` collision case, `:11-30`; `computeHash`, `:33`; `buildEntry`, `:50`; `verifyChain` incl. exact broken seq, `:81`; `currentClaimsMatchLastSeal`, `:126`).

### `src/lib/discovery-store.ts`
- **Role:** Tracks which of 4 exploration moments the visitor has hit, for the celebratory `★ N/4` badge.
- **Exports:** `DiscoveryKey` (union of `"view-switch" | "chat-question" | "terminal-command" | "dossier-open"`, `:12-16`), `unlock()`, `unlockAll()`, `useDiscoveries()`, `getDiscoveryCount()`, `DISCOVERY_TOTAL` (`= ALL_KEYS.length = 4`, `:88`).
- **Reads / depends on:** `react` (`useSyncExternalStore`), `localStorage` key `"anvilry:discoveries"` (`:18`).
- **Consumed by:** `chat/chat-messages.tsx`, `command-palette-content.tsx`, `game/discovery-badge.tsx`, `game/dossier-card.tsx`, `game/terminal/use-terminal.ts`, `components/view-context.tsx`. `unlock()` callers: `view-context.tsx:213`, `chat-messages.tsx:326`, `use-terminal.ts:44`, `dossier-card.tsx:82`; `unlockAll()` at `command-palette-content.tsx:238`.
- **Behaviour notes:** Module-level store initialised eagerly from storage at import time (`:48`). `readStorage()` fails closed to an empty `Set` on SSR, missing key, non-array JSON, or a throw, and filters unknown keys against `ALL_KEYS` (`:26-37`). The `konami` key was removed on 2026-10-01; a leftover `"konami"` string in a returning visitor's storage is dropped by that same filter, so no migration was needed (that visitor's count simply falls by one). `writeStorage()` swallows quota errors silently by design (`:39-46`). `unlock()` is idempotent, early-returns if already present, and replaces the `Set` with a new instance rather than mutating (`:64-69`) — required for `useSyncExternalStore` identity comparison. `unlockAll()` is the Cmd+K escape hatch (`:72-76`) and, unlike `unlock()`, always writes and emits.
- **Gotchas / invariants:** The store has **no gating power** — nothing is locked behind a discovery (`:5-6`). There is no `'use client'` directive (unlike `highlight-store.ts`). `getServerSnapshot` returns a fresh `new Set()` on every call (`:61`), so the server snapshot is never referentially stable across calls (a possible hydration warning; not reproduced). `getDiscoveryCount()` reads the module variable synchronously **without** subscribing (`:84-86`), so a component using only it will not re-render on unlock. Adding a key requires editing both the `DiscoveryKey` union and `ALL_KEYS` (`:12-24`). Guarded by `src/lib/discovery-store.dom.test.ts` (2 tests: exactly four keys and none of them `konami`; a legacy stored `konami` value is ignored without a migration).

### `src/lib/enabled-views.ts`
- **Role:** Build-time gate for which non-Classic views exist in a given deployment.
- **Exports:** `isViewEnabled(view)`, `ENABLED_VIEWS` (`ReadonlySet<View>`).
- **Reads / depends on:** type-only `View` from `@/components/view-context` (`:1`), env `NEXT_PUBLIC_ENABLED_VIEWS` (`:23`).
- **Consumed by:** `src/components/view-router.tsx`, `src/components/view-switcher.tsx` (`llm-sdk-mode.ts` and `voice-picker-mode.ts` only mention it in comments).
- **Behaviour notes / gotchas:** See the flag table above. Key asymmetry: **unset ⇒ everything on**, but **set-to-empty-string ⇒ everything optional off** (`:25-34`) — the `raw === undefined || raw === null` check is what distinguishes them. Unknown entries in the list are dropped by the `ALL_OPTIONAL.includes(v)` filter (`:33`), so a typo silently disables that view rather than erroring. `classic` can never be disabled — it is the SSG/no-JS default and the `getServerSnapshot` contract (`:12-14`, `:38`). `resume` is in `ALWAYS_OPTIONAL` and therefore also always `true` even if omitted from the list (`:20`, `:38`). No dedicated test file.

### `src/lib/flags.ts`
- **Role:** The dual-driver resolver for the single flag migrated to the Vercel Flags SDK.
- **Exports:** `getDiscoveryBadgesEnabled(): Promise<boolean>` (`:41`).
- **Reads / depends on:** `flag` from `flags/next` (`flags@^4.3.0`), env `FLAG_DRIVER`, `NEXT_PUBLIC_DISCOVERY_BADGES`, and `FLAGS_SECRET` (read only to log its presence, `:51`).
- **Consumed by:** `src/app/layout.tsx` — imported at `src/app/layout.tsx:20`, awaited at `src/app/layout.tsx:85`.
- **Behaviour notes / gotchas:** See the flag table above. Documented contract: call only from a Server Component or Route Handler, never a client component (`:33-34`). The SDK checks the override cookie **before** invoking `decide()`, which is why `decide: () => false` does not defeat dashboard overrides (`:25-28`). Both paths log exactly one `[flags]` JSON line — grep handle documented as `vercel logs | grep '\[flags\]'` (`:36-39`). The module docblock states that **all other** beast-mode flags remain plain `NEXT_PUBLIC_` reads in their own files (`:7-8`). No dedicated test file.

### `src/lib/writing-flags.ts`
- **Role:** Central declaration of the build-time writing/hiring/dedup flags.
- **Exports:** 9 booleans + `OPEN_TO_WORK_BANNER_HEIGHT_REM` + `DedupPrimaryKey` + `ARTICLE_DEDUP_KEY` — full table above.
- **Reads / depends on:** `process.env` only; no imports.
- **Consumed by:** `articles/[slug]/page.tsx`, `articles/layout.tsx`, `articles/page.tsx`, `layout.tsx`, `notes/[slug]/page.tsx`, `notes/page.tsx`, `sitemap.ts`, `article-group-card.tsx`, `related-writing.tsx`, `chat/chat-view.tsx`, `chat/talk-mode.tsx`, `game/developer-view.tsx`, `home/hero.tsx`, `home/testimonials.tsx`, `home/writing-preview.tsx`, `site-nav.tsx`, and the lib modules `article-grouping.ts`, `content.ts` and `llms-txt.ts`.
- **Gotchas / invariants:** All values are computed at module load and `NEXT_PUBLIC_*` is inlined by Next.js at build time — toggling any of these requires a redeploy (`:16`). `ARTICLES_ENABLED` alone is opt-out (`!== "false"`), every other boolean is opt-in (`=== "true"`); mixing the two conventions up flips a section's default. Each flag's blast radius is documented inline: `ARTICLES_ENABLED`/`NOTES_ENABLED` gate the route **and** the nav link **and** the sitemap **and** the RSS feed (`:5-10`); `NOTES_ENABLED` additionally empties `allNotes` at the data layer (`content.ts:56`), which is how llms.txt, MCP, the chat corpus and the `.md` handlers go dark with it. `ARTICLE_DEDUP_KEY` only changes behaviour for articles that set **both** `linkedNote` and `canonicalUrl`, since each strategy falls back to the other field (`:71-72`). No dedicated test file.

### `src/lib/github.ts`
- **Role:** First-party, allowlist-gated GitHub repo feed replacing third-party `github-readme-stats` image embeds.
- **Exports:** `REPO_ALLOWLIST` (13 names, `:30-44`), `GithubRepo` (type, `:47-56`), `fetchRepo(owner, name)` (`:105`), `getRepoFeed()` (`:128`), `pushedAgo(iso)` (`:141`).
- **Reads / depends on:** `@/lib/profile` (`githubUser` as the owner), `https://api.github.com`, env `GITHUB_TOKEN` (optional).
- **Consumed by:** `src/app/projects/page.tsx:9` (`getRepoFeed`), `src/app/projects/[slug]/page.tsx:13` (`fetchRepo`, `pushedAgo`, called at `:80` inside a `"use cache"` body), `src/app/api/github/stats/route.ts:1` (`getRepoFeed`), `src/components/github-feed.tsx:2` and `src/components/github-stats-strip.tsx:8` (`pushedAgo`).
- **Behaviour notes:** `getRepoFeed()` fetches all 13 allowlisted repos in parallel via `Promise.all`, drops nulls, and sorts newest-push-first (`:128-136`). `fetchRepo()` returns `null` for a name not on the allowlist (`:109`), on any non-OK status (404 private/renamed, 403 rate-limit; `:116`) or any thrown error (`:119-121`). `next: { revalidate: 3600 }` puts the fetch in the data cache (`:111-115`), in lockstep with the `/projects` page, which migrated to `"use cache"` + `cacheLife("hours")` (`projects/page.tsx:39-40`, revalidate 3600 s). Headers are `Accept: application/vnd.github+json` and `X-GitHub-Api-Version: 2022-11-28`, plus `Authorization: Bearer` only when `GITHUB_TOKEN` is set (`:91-99`). `normalize()` returns `null` unless both `html_url` and `full_name` are non-empty strings, and coerces counts through `num()`/`str()` so a malformed payload becomes `0`/`null` rather than `undefined` (`:68-88`). `pushedAgo()` renders `Intl.RelativeTimeFormat` day/week/month/year strings and `""` for unparseable input (`:138-151`).
- **Gotchas / invariants:** **Server-only by convention, not enforcement.** The docblock (`:8-10`) says the module is imported solely by the `/projects` server component, which is no longer true: five files import it, and `github-stats-strip.tsx` is a `"use client"` component pulling `pushedAgo`, so the module is bundled into client code. The `GITHUB_TOKEN` read is confined to `headers()` (`:96`) and a non-`NEXT_PUBLIC_` env var is `undefined` in the browser, so no secret ships, but no `server-only` package guards it. The allowlist is 11 Velite-featured projects plus two extras, Thunderboard-Labs and Shop.this (`:22-29`); casing must match the canonical GitHub repo name exactly (note `gRPC-micro-services` and `Shop.this`), and private repos that 404 unauthenticated (Agent-Forge, Graph-Forge per the comment) simply do not render without a token. Unauthenticated GitHub allows 60 req/hr and one feed cycle makes 13 fetches (`:16-17`, `:130-132`). Fail-open is intentional: total failure yields `[]` and the feed simply hides (`:12-17`, `:124-127`). Guarded by `src/lib/github.test.ts` (no duplicate allowlist entries, `:40`; owner-called-out extras, `:44`; `[]` on all-fail and on network error without throwing, `:53`,`:61`; 404s dropped, `:71`; newest-push sort, `:86`; no `Authorization` header when `GITHUB_TOKEN` is unset, `:107`, `Bearer` when set, `:119`; `fetchRepo` allowlist gate, `:143`; `pushedAgo`, `:154-181`).

### `src/lib/highlight-store.ts`
- **Role:** Transient client store meant to glow one project card when the chat model emits `[[cmd:highlight:<slug>]]`.
- **Exports:** `highlightProject(slug)` (`:29`), `clearHighlight()` (`:40`), `useHighlightedSlug()` (`:49`).
- **Reads / depends on:** `react` (`useSyncExternalStore`); `"use client"` at `:1`.
- **Consumed by:** `src/components/chat/chat-messages.tsx:15` imports **only** `highlightProject` and calls it for `cmd-highlight` segments (`:334`; token parsed in `chat/parse-cards.ts:68`). A repo-wide grep finds **no** importer of `useHighlightedSlug` or `clearHighlight`, so nothing subscribes to or clears this store: the highlight is written but never read, i.e. dead end-to-end. The docblock at `:5-10` claims `project-card.tsx` subscribes via `useSyncExternalStore`; `project-card.tsx` does not import this module.
- **Behaviour notes:** Auto-clears after **3000 ms** (`:33-38`); a second `highlightProject()` call clears the pending timer first so the window restarts rather than truncating (`:30`). The server snapshot is the inline `() => null` third argument (`:50`), so SSR always renders unhighlighted.
- **Gotchas / invariants:** State is a single module-level `string | null` — only one card can be highlighted at a time (`:12`). `clearHighlight()` must be used rather than setting the variable, otherwise `clearTimer` leaks and a stale timeout will null out a newer highlight (`:40-47`). No dedicated test file.

### `src/lib/utils.ts`
- **Role:** Single 3-line helper. Trivial.
- **Exports:** `cn(...inputs: ClassValue[])` — `twMerge(clsx(inputs))` (`:5-7`).
- **Consumed by:** `app/resume/page.tsx`, `game/terminal/terminal.tsx`, `game/developer-view.tsx`, `chat/chat-view.tsx`, `home/resume-view.tsx`, `ui/section.tsx`, `ui/skeleton.tsx`, `ui/tooltip.tsx`, `view-switcher.tsx`.

## Test guards (which test file covers which module)

| Module | Guarding test |
|---|---|
| `content.ts` | `src/lib/notes.test.ts`, `src/lib/notes-dark.test.ts` (notes hidden at the data layer, both flag states), `src/lib/case-study-depth.test.ts` |
| `corpus.ts` | `src/lib/corpus.test.ts` |
| `decisions.ts` | `src/lib/decisions.test.ts` |
| `discovery-store.ts` | `src/lib/discovery-store.dom.test.ts` (four keys, none named `konami`; a legacy stored `konami` is ignored) |
| `game-model.ts` + `graph-data.ts` | `src/lib/game-model.test.ts` (**blocks deploys** on orphaned nodes/content) |
| `mcp-tools.ts` | `src/lib/mcp-tools.test.ts`; the *documented* tool set is additionally pinned by `src/app/mcp/tools-documented.test.ts:81`, `:90` (route registrations ≡ `src/app/mcp/page.tsx:40-60`) |
| `llms-txt.ts` | `src/lib/llms-txt.test.ts` — advertised MCP transport (`:14`), no `/api/mcp/sse` anywhere (`:28`), consistency with the route's `disableSse` (`:32`), AI Usage Policy (`:45-64`); plus `notes-dark.test.ts` |
| `claims-integrity.ts` | `src/lib/claims-integrity.test.ts`; end-to-end seal check is the CI step `.github/workflows/ci.yml:83` |
| `personal.ts` | `src/lib/personal.test.ts` |
| `testimonials.ts` | `src/lib/testimonials.test.ts` |
| `github.ts` | `src/lib/github.test.ts` |
| `profile.ts` (indirect) | `src/lib/mcp-tools.test.ts:82` (résumé PDFs exist), `src/components/game/terminal/commands.test.ts` |
| `article-grouping.ts`, `resume-json.ts`, `flags.ts`, `writing-flags.ts`, `enabled-views.ts`, `highlight-store.ts`, `integrity-chain.ts`, `utils.ts` | **no dedicated test file** |

Standalone tests with no matching source module: `src/lib/avatar-glb.test.ts` (binary-asset invariant on `public/avatar/sairam.glb`), `src/lib/notes.test.ts`, `src/lib/notes-dark.test.ts` and `src/lib/case-study-depth.test.ts` (all test `content.ts`).

## Coverage

- `src/lib/content.ts`
- `src/lib/corpus.ts`
- `src/lib/decisions.ts`
- `src/lib/game-model.ts`
- `src/lib/graph-data.ts`
- `src/lib/article-grouping.ts`
- `src/lib/llms-txt.ts`
- `src/lib/profile.ts`
- `src/lib/personal.ts`
- `src/lib/testimonials.ts`
- `src/lib/resume-json.ts`
- `src/lib/mcp-tools.ts`
- `src/lib/claims-integrity.ts`
- `src/lib/integrity-chain.ts`
- `src/lib/discovery-store.ts`
- `src/lib/enabled-views.ts`
- `src/lib/flags.ts`
- `src/lib/writing-flags.ts`
- `src/lib/github.ts`
- `src/lib/highlight-store.ts`
- `src/lib/utils.ts`
- `scripts/seal-claims.ts`
- `data/integrity-chain.json`

Read for context but owned by other sections: `velite.config.ts`, `src/app/api/mcp/[transport]/route.ts`, `src/app/.well-known/vercel/flags/route.ts`, `src/app/llms.txt/route.ts`, `src/app/decisions/page.tsx`, `.velite/index.d.ts`.
