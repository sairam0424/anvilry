---
kind: doc
title: Anvilry v3.6.0 — Codebase Index
domain: [content]
status: current
version: v3.6.0
---

# Anvilry v3.6.0 — Codebase Index

**Anvilry** is a personal portfolio and AI-powered developer showcase: one Next.js App Router app that
serves multiple client-switchable experiences from a single URL, grounded on one MDX content source that
also feeds a chatbot, an MCP server, a 3D knowledge graph, a keyboard terminal, and a machine-readable
résumé.

**Version:** `3.6.0` (`package.json:3`) — a **correctness and CI-integrity** release: the pnpm 11
install failure CI could not see, four article source-label maps made type-enforced, a bundle gate
that can actually fail replacing one that ran 222 times (211 green, 11 red) and produced zero artifacts, ever
(`CHANGELOG.md:7-97`).

**Stack:** Next.js 16.3.0 (App Router, `cacheComponents: true`) · React 19.2.8 · TypeScript 5.9 (strict) ·
Tailwind v4 (CSS-first, no JS config) · Velite 0.4 (MDX → typed collections) · AWS Bedrock / Anthropic SDK ·
Upstash Redis (rate limit + telemetry) · React Three Fiber + three.js 0.185 · Vitest 4 + Playwright 1.61 ·
deployed on Vercel.

**This index describes the tree at v3.6.0**, specifically `release/v3.6.0` @ `c734c14` — not `main`
and not `develop`. Of the 14 commits `main..develop`, only 3 are Dependabot bumps; the other 11 are
the pnpm-11 install fix, the article source-label fix, the bundle gate and two docs passes. Every
`path:line` citation is against `c734c14`, which matters because files cited here (e.g.
`scripts/bundle-budget.mjs`) do not exist on `main` at all.

---

## At a glance

| | |
|---|---|
| **What it is** | One Next.js App Router app presenting six `View` union members from `/`, all derived from one Velite MDX corpus |
| **Version** | `3.6.0` — correctness + CI-integrity release (`package.json:3`) |
| **Scale** | 416 files indexed · 279 `.ts`/`.tsx` in `src/` totalling 32,253 lines · 37 content files · 59 route-defining files |
| **Subsystems** | content pipeline · view system · chat/LLM · voice · MCP (9 tools) · telemetry · auth/security · feature flags · 3D/WebGL · build & deploy |
| **Hardest constraint** | `cacheComponents: true` (`next.config.ts:183`) — no route may export `runtime`, `revalidate` or `dynamic`; every page builds `PARTIALLY_STATIC` |
| **Strongest guard** | `game-model.test.ts` asserts a bijection between 3D graph nodes and real content — it blocks the deploy |
| **This index** | 17 files: this front door, 13 per-area sections, 2 subsystem maps, 1 invariants ledger |
| **Start with** | [§ Index map](#index-map) to navigate · [§ Route index](#route-index-all-routes) to find a route · [15](./15-invariants-and-gotchas.md) before changing anything |

---

## By the numbers

Measured from the working tree at v3.5.0 on `develop`.

Where a row once recorded a doc-vs-code drift that has since been closed, the old claim is **struck
through** and marked *corrected on this branch* — same convention as
[15 § Documented-but-unconfirmed](./15-invariants-and-gotchas.md#documented-but-unconfirmed). A
struck-through phrase is history, not a live contradiction; the citation beside it points at the
corrected text.

| Metric | Value | How measured |
|---|---|---|
| Files covered by this index | **416 files across 419 distinct paths** — 407 files inside `sairam-dev/`, plus 3 directory entries (`public/static/`, `.swarm/`, `.claude-flow/`), plus 9 parent-directory appendix files | union of the `## Coverage` lists in sections 01–13; `public/static/` holds 0 files and is flagged as an empty dir in three places in section 11 — its `**Files indexed:**` note, its `public/static/` row in [11 § At a glance](./11-config-build-ci-infra.md#at-a-glance), and its [11 § Coverage](./11-config-build-ci-infra.md#coverage) list |
| Manifest reconciliation | **393 of 393 manifest paths have a Coverage entry — zero gaps** | the 17 further in-repo paths that are covered — `pnpm-lock.yaml`, `public/static/`, `public/avatar/sairam.glb`, the 5 `public/resume/*.pdf`, the 5 create-next-app scaffold SVGs (`public/{file,globe,next,vercel,window}.svg`), and the 4 agent-tooling artifacts (`agentdb.rvf`, `agentdb.rvf.lock`, `.swarm/`, `.claude-flow/`) — lie outside the manifest's search roots and were added by the sections that own them |
| `src/app` | 67 files / 7,015 lines | `find src/app -type f` |
| `src/lib` | 66 files / 7,360 lines | `find src/lib -type f` |
| `src/components` | 144 files / 17,961 lines | `find src/components -type f` |
| `src/**/*.{ts,tsx}` | 279 files / **32,253 lines** | `find src -name '*.ts' -o -name '*.tsx'` |
| `content/` | 37 files / 1,568 lines — 33 `.mdx` + 3 `.md` + 1 `.gitkeep` | `find content -type f` |
| `e2e/` | 2 files / 259 lines | `find e2e -type f` |
| App Router route-defining files | **59** — 15 `page.tsx`, 26 `route.ts`, 5 `layout.tsx`, 5 `opengraph-image.tsx`, 8 special (`error`, `global-error`, `not-found`, `icon`, `apple-icon`, `manifest`, `robots`, `sitemap`) | `find src/app -name …` |
| Test / spec files | 65 — 63 under `src/` (of which 24 are `*.dom.test.*`) + 2 Playwright specs | `find src -name '*.test.*'`, `find e2e -name '*.spec.ts'` |
| Dependencies | **33 prod + 17 dev** (was 35 prod at v3.4.2 — v3.5.0 removed `@react-three/offscreen` and `@react-three/rapier`, both declared but never imported), plus 10 `overrides`, 1 `onlyBuiltDependencies`, and a 3-entry `allowBuilds` map. **There is no `pnpm` field in `package.json`:** v3.5.0 moved every pnpm setting to `pnpm-workspace.yaml`, because pnpm 11 stopped reading that field and would have silently dropped the ten security overrides | `package.json:23-55` (prod), `:58-74` (dev) — each **+1** from the ranges this row used to carry, because the new `analyze` script was inserted at `package.json:12`; `pnpm-workspace.yaml:18-28` (overrides), `:44-45` (`onlyBuiltDependencies`), `:55-58` (`allowBuilds`) — see [13](./13-dependencies-and-versions.md) |
| npm scripts | **12** — the previous 11 plus `analyze`, added on this branch when `bundle-analysis.yml` was deleted. `analyze` is `velite --clean && ANALYZE=true next build --webpack`; the `--webpack` flag is **mandatory**, because a bare `next build` in Next 16 is Turbopack and `@next/bundle-analyzer` is webpack-only. Still no `search-index` — see [11](./11-config-build-ci-infra.md) | `package.json:8-22` — the block starts at `:8`, not `:5`, since `engines` was inserted at `:5-7`; `analyze` is `package.json:12` |
| Content items | 5 work · 11 projects · 5 notes · 15 articles (14 non-draft) | `.velite/*.json`, section [09](./09-content-and-schemas.md) |
| 3D graph | 16 nodes / 19 edges, bijective with 5 work + 11 projects; count it from the arrays — the file's header docblock no longer hardcodes a node count (it now says "every flagship work system + every OSS repo … see `graphNodes` below for the count") | `src/lib/graph-data.ts:18-41` (nodes), `:43-70` (edges); de-numbered docblock `:3-4` |
| MCP tools | **9** registered. ~~"docs still say 7"~~ — **corrected on this branch:** the route docblock now says "9 read-only tools" (`src/app/api/mcp/[transport]/route.ts:22`), the public table lists all 9 (`src/app/mcp/page.tsx:35-45`), and `CLAUDE.md` agrees in both places (`CLAUDE.md:212`, `:302`). Guarded: `src/app/mcp/tools-documented.test.ts` asserts the documented table and the route's `registerTool` calls are identical, and `vitest run` is chained into `pnpm build`, so adding a tool without documenting it fails the build | `src/app/api/mcp/[transport]/route.ts:30-117` |
| Terminal commands | **31** — 27 visible + 4 hidden eggs. ~~"docs still say roughly 16"~~ — **corrected on this branch:** `CLAUDE.md:115` and `ARCHITECTURE.md:74` both say 31 now | `src/components/game/terminal/commands.ts:503-508` |
| Voice catalog | 18 voices — 6 curated + 12 extended, across 3 TTS engines | `src/lib/voice-catalog.ts:134-294` |
| Cron jobs | 5, all fail-closed on `CRON_SECRET` | `vercel.json:3-7` |
| `View` union members | **6** (`classic`, `gamified`, `chat`, `developer`, `voice`, `resume`); the switcher renders **4 pills server-side → 5 on desktop after hydration** on a default build, and the compact/mobile instance stays at 4; `resume` is never a pill | `src/components/view-context.tsx:24-34`; `src/components/view-switcher.tsx:17-22`, `:32-33`, `:38` |
| CHANGELOG version tags | 19 (was 18 before `3.6.0`; still no `2.x`, no `3.1`–`3.3`) | `CHANGELOG.md:7` is the newest; `grep -c '^## \[[0-9]' CHANGELOG.md`. A bare `^## \[` also returns 19 — there is no live `[Unreleased]` section |

Two figures differ from the numbers quoted in the indexing brief and were corrected by re-measurement:
dependency counts were **35 + 17** at v3.4.2 (not the brief's 39 + 18 — already flagged in section
[13](./13-dependencies-and-versions.md)'s "Declared counts (verified, not from the brief)" note) and
are **33 + 17** here, since v3.5.0 removed the two never-imported R3F packages, and
route-defining files are **59** (not 55). The 13 declared "Files indexed" headers sum to **474**, which matches
the **474** `## Coverage` bullets exactly, while the union is **419** distinct paths. The surplus of **55**
occurrences comes from **54** paths that are deliberately indexed by more than one section — 53 of them twice,
and `src/lib/r3f.ts` three times: it is owned by [04](./04-lib-ai-voice-infra.md) and cross-referenced by both
[07](./07-components-3d.md) and [13](./13-dependencies-and-versions.md).

### Primary owner for double-covered paths

Most double coverage is one-directional by construction — [13](./13-dependencies-and-versions.md) lists
import sites and [10](./10-tests-and-quality-gates.md) lists test files, so the area section always owns
those. The five cases where two *area* sections both claim a path resolve as follows; update the primary,
read the cross-reference for context.

| Path | Primary owner (update here) | Cross-reference |
|---|---|---|
| `src/app/robots.ts` | [02 § `src/app/robots.ts`](./02-api-routes.md#srcapprobotsts) — machine-readable endpoints | [01 § At a glance](./01-routes-pages.md#at-a-glance) and [01 § Route matrix](./01-routes-pages.md#route-matrix) |
| `src/app/sitemap.ts` | [02 § `src/app/sitemap.ts`](./02-api-routes.md#srcappsitemapts) — machine-readable endpoints | [01 § At a glance](./01-routes-pages.md#at-a-glance), [01 § Route matrix](./01-routes-pages.md#route-matrix) and [01 § `src/app/sitemap.ts`](./01-routes-pages.md#srcappsitemapts) |
| `src/components/game/webgl-boundary.tsx` | [06 § `src/components/game/webgl-boundary.tsx`](./06-components-game-terminal.md#srccomponentsgamewebgl-boundarytsx) | [07 § `src/components/game/webgl-boundary.tsx`](./07-components-3d.md#srccomponentsgamewebgl-boundarytsx) (labelled "cross-referenced" in section 07's **Scope** list) |
| `public/avatar/sairam.glb` | [07 § `public/avatar/sairam.glb`](./07-components-3d.md#publicavatarsairamglb) | [11 § `public/avatar/sairam.glb`](./11-config-build-ci-infra.md#publicavatarsairamglb) (public asset tree) |
| `src/lib/r3f.ts` | [04 § Coverage](./04-lib-ai-voice-infra.md#coverage) — the "Table-only" `src/lib/r3f.ts` bullet | [07 § `src/lib/r3f.ts`](./07-components-3d.md#srclibr3fts) (labelled "cross-reference — the lib section owns its entry" in section 07's **Scope** list) |

---

## Index map

| File | What's in it | When you'd open it |
|---|---|---|
| [`README.md`](./README.md) (this file) | Front door: stats, index map, repo layout, the full route table, reading order | First stop, and whenever you need to find *which* section owns a topic |
| [`01-routes-pages.md`](./01-routes-pages.md) | Every non-API file under `src/app` — pages, layouts, error boundaries, OG images, metadata routes, `globals.css`; the page render matrix | You're changing a page, its metadata, its caching, or a route gate |
| [`02-api-routes.md`](./02-api-routes.md) | All `src/app/api/**` handlers, the machine-readable endpoints (`llms.txt`, `feed.xml`, `.md` passthroughs), `src/proxy.ts`, both instrumentation hooks; the endpoint matrix | You're touching an API route, a cron, auth, or instrumentation |
| [`03-lib-content-data.md`](./03-lib-content-data.md) | `src/lib` content/data half — `content.ts`, `corpus.ts`, `game-model.ts`, `graph-data.ts`, `profile.ts`, `mcp-tools.ts`, the three flag modules; the derivation pipeline and full flag inventory | You're changing what the site knows about itself, or a feature flag |
| [`04-lib-ai-voice-infra.md`](./04-lib-ai-voice-infra.md) | `src/lib` AI/voice/infra half — `llm.ts`, `llm-trace.ts`, `voice-catalog.ts`, `rate-limit.ts`, `redis.ts`, `telemetry/**`, `scroll/**`, `r3f.ts`, the media hooks | You're changing the model chain, voice engines, rate limiting, telemetry, or autoscroll |
| [`05-components-chat-voice.md`](./05-components-chat-voice.md) | `src/components/chat/**` + `ask-portfolio.tsx` — the chat transport, the three voice surfaces, the one-mic mutex, the orb stack, the streamed-markdown security path | You're changing chat, voice UI, or the injection/XSS boundary |
| [`06-components-game-terminal.md`](./06-components-game-terminal.md) | `src/components/game/**` — the gamified view, the developer terminal (full 31-command registry table), easter eggs, discovery badges, the skill tree | You're changing the Play or Developer view, or adding a terminal command |
| [`07-components-3d.md`](./07-components-3d.md) | `src/components/hero-graph/**`, `hero-avatar/**`, `webgl-boundary.tsx`, the R3F barrel, `public/avatar/sairam.glb` | You're changing a WebGL scene, a mount gate, or the avatar asset |
| [`08-components-site-shell-ui.md`](./08-components-site-shell-ui.md) | Root-level components, `home/**`, `ui/**`, `scroll/**` — the view store and router, nav/footer, command palette, JSON-LD, `MDXContent`, cards, the UI kit | You're changing the shell, the view state machine, or a home section |
| [`09-content-and-schemas.md`](./09-content-and-schemas.md) | `velite.config.ts` + every file under `content/` — the four Zod schemas field-by-field, the full content inventory, cross-references and dangling links | You're authoring content or changing a schema |
| [`10-tests-and-quality-gates.md`](./10-tests-and-quality-gates.md) | All 65 test/spec files + `vitest.config.ts` + `playwright.config.ts` — the guard matrix (test → module → what breaks) and the four load-bearing gates verified against source | A test failed, or you want to know what a change will trip |
| [`11-config-build-ci-infra.md`](./11-config-build-ci-infra.md) | `package.json`, `next.config.ts`, CSP/headers directive-by-directive, `Makefile` (36 targets), `vercel.json`, the 3 CI workflows (`bundle-analysis.yml` was deleted on this branch), Dependabot, `public/**`, the complete env-var table | You're changing build, CI, headers, or an environment variable |
| [`12-docs-knowledge-and-harness.md`](./12-docs-knowledge-and-harness.md) | Every root doc, `docs/**`, `domains/**`, `signals/`, the 5 `.claude` skills, `ship-change.js`; version history and a 15-item doc-vs-code drift ledger | You're updating docs, or you distrust something a doc told you |
| [`13-dependencies-and-versions.md`](./13-dependencies-and-versions.md) | Every declared dependency with its import sites, the server/client/edge runtime split, all exact pins and the 10 security overrides, framework-version notes | You're adding, bumping, or removing a dependency |
| [`14-subsystems.md`](./14-subsystems.md) | Cross-cutting subsystem maps, **part 1 of 2** — subsystems 1–6 (content pipeline, view system, chat/LLM, voice, MCP, telemetry) with flows, entry/exit points, failure modes and the flag/env surface for each | "How does X actually work end to end?" for content, views, chat, voice, MCP or telemetry |
| [`14b-subsystems.md`](./14b-subsystems.md) | Cross-cutting subsystem maps, **part 2 of 2** — subsystems 7–10 (auth & security, feature flags, 3D/WebGL, build & deploy), plus the cross-subsystem coupling table, the entry-point cheat sheet, and the UNVERIFIED ledger for both parts | "If I change X, what else moves?" and "where do I start?" |
| [`15-invariants-and-gotchas.md`](./15-invariants-and-gotchas.md) | Every deploy blocker, every multi-file contract, every platform quirk, and the silent-failure ledger — re-cut by blast radius instead of by directory | Before you edit anything load-bearing, and when something fails with no error |

---

## Repo layout

Annotated, 2–3 levels. The repo under index is `Anvilry/sairam-dev/`; the parent `Anvilry/` wrapper holds
pre-build artifacts and third-party agent tool state (indexed as an appendix in
[12](./12-docs-knowledge-and-harness.md)).

```
Anvilry/                                  parent wrapper — NOT the app
├── PLAN.md                               original pre-build plan (Next.js 15 era; historical)
├── RESEARCH.md                           the adversarially-verified research blueprint behind it
├── .aava/                                Aava agent scaffolding (constitution, memory, skills index)
├── .claude-flow/                         Ruflo policy ledger + neural counters
├── ruvector.db                           Ruflo vector store (binary)
└── sairam-dev/                           ◄── THE APP (own git repo)
    ├── src/
    │   ├── app/                          App Router: 15 pages, 26 route handlers, 5 layouts, 5 OG images
    │   │   ├── api/                       chat · mcp/[transport] · tts · tts-google · transcribe ·
    │   │   │                              error · visit · github/stats · resume.json · cron/×5 · md/×4
    │   │   ├── {work,projects,notes,articles}/   content route trees (+ [slug], OG image, [slug].md)
    │   │   ├── {about,mcp,resume,search,stats}/  standalone pages
    │   │   ├── admin/telemetry/           request-time Redis dashboard (Basic auth via src/proxy.ts)
    │   │   ├── {feed.xml,llms.txt,llms-full.txt}/  machine-readable route handlers
    │   │   ├── layout.tsx · page.tsx      root layout + the ONLY ViewRouter mount site
    │   │   ├── error.tsx · global-error.tsx · not-found.tsx   boundaries (404 = a live terminal)
    │   │   ├── {icon,apple-icon,opengraph-image}.tsx · {manifest,robots,sitemap}.ts
    │   │   └── globals.css                Tailwind v4 entry + design tokens + every keyframe
    │   ├── components/
    │   │   ├── chat/                      chat transport, 3 voice surfaces, one-mic mutex, orb stack
    │   │   ├── game/                      gamified view + terminal/ (31-command registry)
    │   │   ├── hero-graph/ · hero-avatar/ the two hero WebGL slots
    │   │   ├── home/                      the six homepage sections + the résumé view
    │   │   ├── ui/ · scroll/              design primitives, ink transition, autoscroll pill
    │   │   └── view-{context,router,switcher}.tsx   the view state machine
    │   ├── lib/
    │   │   ├── content.ts · corpus.ts · game-model.ts · graph-data.ts · profile.ts   content + derivation
    │   │   ├── llm.ts · llm-trace.ts · mcp-tools.ts   AI layer + MCP tool impls
    │   │   ├── voice-catalog.ts · voice-settings-context.tsx   voice source of truth
    │   │   ├── telemetry/                 schema · emit · with-trace · beacon
    │   │   ├── scroll/                    the two autoscroll engines behind a runtime flag
    │   │   └── r3f.ts                     the load-bearing R3F re-export barrel
    │   ├── proxy.ts                       Edge HTTP Basic Auth for /admin/*
    │   └── instrumentation{,-client}.ts   [config] cold-start snapshot · [vitals] + error beacons
    ├── content/                           MDX source: work/5 · projects/11 · notes/5 · articles/15
    ├── e2e/                               Playwright: views.spec.ts · resume.spec.ts
    ├── public/                            avatar/sairam.glb (1.05 MB) · resume/×5 PDFs · static/ (empty)
    ├── docs/
    │   ├── index/                         ◄── THIS INDEX (17 files)
    │   ├── configuration.md               env-var + flag reference
    │   └── superpowers/{plans,specs}/     14 dated plans + 5 design specs (point-in-time)
    ├── domains/{content,seo,performance}/  knowledge-base loop charters
    ├── signals/                           signal-kind schema README (no signal files yet)
    ├── .claude/{skills,workflows}/         5 agent skills + ship-change.js
    ├── .github/{workflows,ISSUE_TEMPLATE}/ ci · codeql · dependency-review (3 — bundle-analysis deleted)
    ├── scripts/                           bundle-budget.mjs (CI budget gate) · check-index-citations.mjs ·
    │                                      replay-trace.mjs (telemetry waterfall replay CLI)
    ├── velite.config.ts · next.config.ts · vitest.config.ts · playwright.config.ts
    ├── package.json · pnpm-lock.yaml · pnpm-workspace.yaml · vercel.json · Makefile
    ├── CLAUDE.md · ARCHITECTURE.md · CHANGELOG.md · LOG.md
    └── VOICE.md · TELEMETRY.md · DEPLOY.md · README.md · SECURITY.md · LICENSE
```

Generated-and-gitignored, present locally but not in the repo: `.velite/` (required before any compile),
`.next/`, `next-env.d.ts`, `.vercel/`, `test-results/`, `playwright-report/`, `scratch-pad/`.

---

## The four views

All of them live on `/` alone — `ViewRouter` is mounted at `src/app/page.tsx:26` and imported nowhere else.
Classic is server-rendered and kept `hidden` (never unmounted, so scroll survives); the others are
`next/dynamic` with `ssr: false` and **are** unmounted when inactive, which is what lets R3F dispose the
WebGL context (`src/components/view-router.tsx:9-24`, `:58-69`).

| View | What it is | Entry file | How it's reached |
|---|---|---|---|
| `classic` | The SEO/no-JS default: hero, featured work, featured projects, achievements, writing, contact. Always what SSR and crawlers get. | `src/app/page.tsx:26-37` (the `children` handed to `ViewRouter`) | Default. `?view=classic` deletes the param. Cannot be disabled. |
| `gamified` ("Play") | 3D WebGL knowledge-graph explorer + an accessible DOM-first system index + dossier cards. | `src/components/game/game-view.tsx` | Switcher pill, `?view=gamified`, ⌘K, or a `[[cmd:view:gamified]]` chat token |
| `chat` | Full-height AI concierge console grounded on the MDX corpus (chips, composer, mic, attachments). | `src/components/chat/chat-view.tsx` | Switcher pill, `?view=chat`, ⌘K, terminal `chat` |
| `developer` | Keyboard-driven terminal (31 commands) plus a recruiter rail on `lg+`. | `src/components/game/developer-view.tsx` | Switcher pill, `?view=developer`, ⌘K, terminal `developer` |

Two further members exist in the same union. `voice` (`src/components/chat/anvil-view.tsx`) **is** a
switcher pill on desktop, but only after hydration: `OPTIONS` holds just the four above
(`src/components/view-switcher.tsx:17-22`) and `VOICE_OPTION` is appended when
`mounted && !compact && isViewEnabled("voice")` (`:38`). Since an unset `NEXT_PUBLIC_ENABLED_VIEWS`
enables every optional view (`src/lib/enabled-views.ts:28`, with `voice` in `ALL_OPTIONAL` at `:21`), a
**default build renders 4 pills on the server and 5 on desktop after hydration**; the compact (mobile)
instance deliberately stays at 4 and routes voice through the header Anvil orb instead
(`src/components/view-switcher.tsx:32-33`). `resume` (`src/components/home/resume-view.tsx`) is **never** a
pill — it is reachable only via ⌘K "Recruiter view" or `?view=resume`. So `View` is a six-member union
(`src/components/view-context.tsx:24-34`) and "four views" describes the server-rendered switcher, not the
store — see [08 § Four-view state machine](./08-components-site-shell-ui.md#four-view-state-machine) for the full state machine and
[15](./15-invariants-and-gotchas.md) for the doc-drift entry.

State lives in three module-level bindings outside React and is read with `useSyncExternalStore`; the
server and first-client snapshot always return `classic`, and a `?view=` deep link is applied only
post-hydration by `ViewQuerySync`. There is no cookie and no localStorage — a bare `/` is always Classic.

---

## Route index (all routes)

Every addressable path in the app. `cacheComponents: true` is set globally (`next.config.ts:183`), so every
**page** route builds as `renderingMode: "PARTIALLY_STATIC"` with `experimentalPPR: true`; the column
records what the segment config and build artifact actually say. **No file in the app exports `runtime`** —
every route handler runs on Next's default Node.js runtime; `src/proxy.ts` is the one Edge file.

| Path | Kind | File | Render / runtime |
|---|---|---|---|
| `/` | page | `src/app/page.tsx` | PARTIALLY_STATIC, `compute:"static"`; the only `ViewRouter` mount |
| `/about` | page | `src/app/about/page.tsx` | PARTIALLY_STATIC, static |
| `/mcp` | page | `src/app/mcp/page.tsx` | PARTIALLY_STATIC, static; exports **no** segment config — `CLAUDE.md:140` now says the same ("no segment config"), so this is no longer a doc contradiction |
| `/resume` | page | `src/app/resume/page.tsx` + `resume/layout.tsx` | PARTIALLY_STATIC, static; page is `"use client"`; relaxed `frame-ancestors 'self'` CSP |
| `/search` | page | `src/app/search/page.tsx` + `search/layout.tsx` | PARTIALLY_STATIC, static; `"use client"`; injects `/pagefind/*` at runtime |
| `/stats` | page | `src/app/stats/page.tsx` + `stats/layout.tsx` | PARTIALLY_STATIC, static; **not** flag-gated (`STATS_ENABLED` only hides the nav link) |
| `/work` | page | `src/app/work/page.tsx` | PARTIALLY_STATIC, static; `revalidate` deliberately deleted |
| `/work/[slug]` | dynamic page | `src/app/work/[slug]/page.tsx` | Per-slug prerender via `generateStaticParams` + dynamic fallback |
| `/work/<slug>/opengraph-image` | image | `src/app/work/[slug]/opengraph-image.tsx` | Per-slug prerendered PNG (1200×630) |
| `/work/<slug>.md` | machine-readable | `src/app/work/[slug].md/route.ts` (also rewritten to `/api/md/work/:slug`) | nodejs; dynamic (reads `req.url`); reads `content/` from disk |
| `/projects` | page | `src/app/projects/page.tsx` | PARTIALLY_STATIC; the **only** page with `"use cache"` + `cacheLife("hours")` → revalidate 3600 / expire 86400; live GitHub fetch |
| `/projects/[slug]` | dynamic page | `src/app/projects/[slug]/page.tsx` | Per-slug prerender + dynamic fallback |
| `/projects/<slug>/opengraph-image` | image | `src/app/projects/[slug]/opengraph-image.tsx` | Per-slug prerendered PNG |
| `/projects/<slug>.md` | machine-readable | `src/app/projects/[slug].md/route.ts` → `/api/md/projects/:slug` | nodejs; dynamic |
| `/articles` | page | `src/app/articles/page.tsx` + `articles/layout.tsx` | PARTIALLY_STATIC, static; `"use client"`; **layout gate** `ARTICLES_ENABLED` (default true) 404s the whole subtree |
| `/articles/[slug]` | dynamic page | `src/app/articles/[slug]/page.tsx` | Per-slug prerender (filtered params) + dynamic fallback; most slugs `redirect()`, guarded by an `https?://` prefix check |
| `/articles/<slug>/opengraph-image` | image | `src/app/articles/[slug]/opengraph-image.tsx` | Per-slug prerendered PNG; maps **all** slugs, unfiltered (intentional) |
| `/articles/<slug>.md` | machine-readable | `src/app/articles/[slug].md/route.ts` → `/api/md/articles/:slug` | nodejs; dynamic |
| `/notes` | page | `src/app/notes/page.tsx` | PARTIALLY_STATIC; `notFound()` when `NOTES_ENABLED` off (default off) |
| `/notes/[slug]` | dynamic page | `src/app/notes/[slug]/page.tsx` | Per-slug prerender for **all** notes (no flag check — `cacheComponents` requires ≥1 param); renders as 404 when the flag is off |
| `/notes/<slug>/opengraph-image` | image | `src/app/notes/[slug]/opengraph-image.tsx` | Per-slug prerendered PNG |
| `/notes/<slug>.md` | machine-readable | `src/app/notes/[slug].md/route.ts` → `/api/md/notes/:slug` | nodejs; dynamic |
| `/admin/telemetry` | page | `src/app/admin/telemetry/page.tsx` | **No static shell** (`response:"empty"`, `htmlSize:0`): `export const instant = false` + `await connection()`; HTTP Basic auth upstream in `src/proxy.ts` |
| `/opengraph-image` | image | `src/app/opengraph-image.tsx` | Static image route (prerendered) |
| `/icon` · `/apple-icon` | image | `src/app/icon.tsx` · `src/app/apple-icon.tsx` | Static image routes (32×32 · 180×180) |
| `/manifest.webmanifest` | metadata | `src/app/manifest.ts` | Static metadata route. It used to declare two PWA screenshots (`/static/screenshot-{desktop,mobile}.png`) that 404 because `public/static/` is empty; **both entries were deleted on this branch** and the file now carries **no `screenshots` key** at all, with a comment recording why and how to re-add them (`src/app/manifest.ts:19-24`). Guarded: `src/app/manifest.test.ts:66-72` asserts `screenshots` is empty, and `:74-80` asserts that if it is ever re-declared every `src` must resolve. See [15](./15-invariants-and-gotchas.md) for the history |
| `/robots.txt` | metadata | `src/app/robots.ts` | Static; allow-all, no `disallow` entries |
| `/sitemap.xml` | metadata | `src/app/sitemap.ts` | Static; flag-aware; never emits `lastModified` |
| `/_not-found` (404) | page | `src/app/not-found.tsx` | Prerendered; `"use client"`; a live terminal seeded with a fake kernel panic |
| `/_global-error` | boundary | `src/app/global-error.tsx` | Prerendered; own `<html>/<body>`, inline hex palette |
| (segment boundary) | boundary | `src/app/error.tsx` | Client boundary, no URL of its own |
| `/llms.txt` | machine-readable | `src/app/llms.txt/route.ts` | nodejs; `text/plain`; static (no request access) |
| `/llms-full.txt` | machine-readable | `src/app/llms-full.txt/route.ts` | nodejs; `text/plain`; static (full chatbot corpus) |
| `/feed.xml` | machine-readable | `src/app/feed.xml/route.ts` | nodejs; `application/xml`; static; ignores the notes/articles flags |
| `/.well-known/vercel/flags` | api | `src/app/.well-known/vercel/flags/route.ts` | nodejs; `verifyAccess`-gated (401 + `null` body); exposes exactly 1 flag |
| `POST /api/chat` | api | `src/app/api/chat/route.ts` | nodejs · `maxDuration = 30` · rate-limited · streams, `Cache-Control: no-store` |
| `GET,POST,DELETE /api/mcp/[transport]` | api | `src/app/api/mcp/[transport]/route.ts` | nodejs · `maxDuration = 30` · public read-only; 9 tools; `disableSse: true`. Public endpoint: `/api/mcp/mcp` |
| `POST /api/tts` | api | `src/app/api/tts/route.ts` | nodejs · `maxDuration = 15` · rate-limited · AWS Polly · per-instance LRU |
| `POST /api/tts-google` | api | `src/app/api/tts-google/route.ts` | nodejs · `maxDuration = 15` · rate-limited · Google Chirp 3 HD via REST |
| `POST /api/transcribe` | api | `src/app/api/transcribe/route.ts` | nodejs · `maxDuration = 20` · rate-limited · AWS Transcribe Streaming |
| `POST /api/error` | api | `src/app/api/error/route.ts` | nodejs · `maxDuration = 5` · rate-limited · Zod + `redact()` → 204 no body |
| `POST /api/visit` | api | `src/app/api/visit/route.ts` | nodejs · own limiter `slidingWindow(1, "30 m")` · Upstash INCR |
| `GET /api/github/stats` | api | `src/app/api/github/stats/route.ts` | nodejs · fail-open · 1 h cadence only at fetch level |
| `GET /api/resume.json` | api | `src/app/api/resume.json/route.ts` | nodejs · JSON Resume v1.0.0 passthrough |
| `GET /api/cron/health-check` | api (cron) | `src/app/api/cron/health-check/route.ts` | nodejs · `maxDuration = 25` · `Bearer CRON_SECRET`, fail-closed · `0 5 * * *` |
| `GET,POST /api/cron/eval` | api (cron) | `src/app/api/cron/eval/route.ts` | nodejs · `maxDuration = 60` · `Bearer CRON_SECRET` · `0 9 * * 1` |
| `GET /api/cron/github-sync` | api (cron) | `src/app/api/cron/github-sync/route.ts` | nodejs · `maxDuration = 30` · `Bearer CRON_SECRET` · `0 8 * * *` (docstring says "hourly") |
| `GET /api/cron/seo-audit` | api (cron) | `src/app/api/cron/seo-audit/route.ts` | nodejs · `maxDuration = 60` · `Bearer CRON_SECRET` · `0 6 * * 1` |
| `GET /api/cron/content-audit` | api (cron) | `src/app/api/cron/content-audit/route.ts` | nodejs · `maxDuration = 60` · `Bearer CRON_SECRET` · `0 7 * * 1` |
| `GET /api/md/{work,projects,articles,notes}/[slug]` | machine-readable | `src/app/api/md/*/[slug]/route.ts` (4 files) | nodejs · `text/markdown`; reads `content/` from disk at request time |
| `(all) /admin/:path*` | proxy | `src/proxy.ts` | **edge** · HTTP Basic Auth vs `ADMIN_PASSWORD`, SHA-256 hex compare (documented as a first filter, not constant-time) |

Caveats on this table, carried forward honestly: render-mode / revalidate / prerendered-slug values come
from a **local, gitignored build** dated 15 Aug (`.next/prerender-manifest.json`,
`.next/routes-manifest.json`) and reflect that machine's `NEXT_PUBLIC_*` values — a production build with
different flags prerenders a different slug set. Segment-config facts (`instant`, `"use cache"`,
`cacheLife`, `generateStaticParams`) are read from source and are env-independent. Whether the four
`.md` paths are served by the `next.config.ts:220-228` rewrites or by the filesystem handlers was not
exercised against a running server; both produce byte-identical output. Details in
[01](./01-routes-pages.md) and [02](./02-api-routes.md).

---

## Start here

Reading order for a new maintainer. Sections 14 and 15 carry the highest information density per minute.

1. **[`15-invariants-and-gotchas.md`](./15-invariants-and-gotchas.md)** — read the "Deploy blockers" and
   "Load-bearing invariants" sections before you edit anything. Three facts frame the whole repo:
   `"build": "velite --clean && vitest run && next build"`, `cacheComponents: true`, and `.velite/` being
   gitignored while `src/lib/content.ts` imports it.
2. **[`14-subsystems.md`](./14-subsystems.md)** + **[`14b-subsystems.md`](./14b-subsystems.md)** — the ten
   flow maps, split across two parts (1–6 and 7–10). Part 2's "Entry-point cheat sheet" answers "if I want
   to change X, where do I start?" for ~45 common tasks.
3. **This file's route table** (above) — the single most-used lookup.
4. **[`09-content-and-schemas.md`](./09-content-and-schemas.md)** — content is the source of truth for
   every view, so the schemas explain most of the rest.
5. **[`03-lib-content-data.md`](./03-lib-content-data.md)** — the derivation pipeline that turns that
   content into the graph, the corpus, the résumé, the MCP tools, and `llms.txt`.
6. **[`08-components-site-shell-ui.md`](./08-components-site-shell-ui.md)** — the view state machine, since
   nearly every UI question routes through it.
7. **Then the area you're actually working in**: [`02`](./02-api-routes.md) /
   [`04`](./04-lib-ai-voice-infra.md) / [`05`](./05-components-chat-voice.md) for chat, voice and
   telemetry; [`06`](./06-components-game-terminal.md) / [`07`](./07-components-3d.md) for the Play and
   Developer views and WebGL; [`01`](./01-routes-pages.md) for pages.
8. **[`10-tests-and-quality-gates.md`](./10-tests-and-quality-gates.md)** and
   [`11-config-build-ci-infra.md`](./11-config-build-ci-infra.md) — before your first commit, so you know
   what will block the deploy and which commands exist.
9. **[`13-dependencies-and-versions.md`](./13-dependencies-and-versions.md)** — before touching
   `package.json`; several pins are load-bearing.
10. **[`12-docs-knowledge-and-harness.md`](./12-docs-knowledge-and-harness.md)** last. Its doc-vs-code
    drift ledger matters because `CLAUDE.md`, `ARCHITECTURE.md`, `DEPLOY.md` and `VOICE.md` each contained
    claims the code contradicts — the code wins, and section 12 (with section 15's
    "Documented-but-unconfirmed" table) records exactly where. A batch of those entries — the MCP tool
    count, the terminal command count, the `/mcp` segment-config claim, the base-URL occurrence count and
    the two test-guard claims — was **corrected in `CLAUDE.md` and `ARCHITECTURE.md` on this branch**, so
    read the ledgers for what they now mark as still-live rather than assuming every row is open.

---

## Coverage

**This file indexes no files of its own.** It is a synthesis front door; the authoritative file inventory is
the union of the `## Coverage` lists in sections 01–13, summarised in [§ By the numbers](#by-the-numbers):

- **419 distinct paths** — 407 files inside `sairam-dev/`, 3 directory entries (`public/static/`, `.swarm/`,
  `.claude-flow/`), and 9 parent-directory appendix files owned by
  [12](./12-docs-knowledge-and-harness.md) = **416 file paths**
- **393 of 393** paths in the generated file manifest have a Coverage entry — **zero gaps**
- **54** paths are covered by more than one section; primary owners are resolved in
  [§ Primary owner for double-covered paths](#primary-owner-for-double-covered-paths)
- Sections [14](./14-subsystems.md), [14b](./14b-subsystems.md) and
  [15](./15-invariants-and-gotchas.md) likewise index no new files — they re-cut sections 01–13 by data flow
  and by blast radius respectively

---

## Provenance

**Generated:** 2026-08-20, against `release/v3.4.2` at commit `a848117`. **Re-pinned 2026-08-21 to
v3.5.0** — release merge `00e38a2` on `origin/main`, working tree `develop`. The re-pin corrected
citations and counts against the new tree; it was not a full regeneration.

**Method.** Thirteen per-area indexers ran in parallel, each assigned a disjoint slice of the tree and each
required to read every file it claimed before writing about it, to cite `path:line`, to describe only the
current version, to record no reviews or recommendations, and to write exactly one output file. Two
synthesis passes then ran over those thirteen sections: the cross-cutting flow maps
([`14-subsystems.md`](./14-subsystems.md) + [`14b-subsystems.md`](./14b-subsystems.md), one pass split
across two files to stay inside the per-file size budget) and
[`15-invariants-and-gotchas.md`](./15-invariants-and-gotchas.md) (the same material re-cut by blast radius).
This front door is the third synthesis pass.

**Adversarial verification.** Load-bearing claims were re-read against source rather than inherited: the
four gates `CLAUDE.md:365-368` names were each checked line by line (two were misstated at the time of
indexing, and **both have since been corrected in `CLAUDE.md` on this branch**), the
`emittedAny` fallback condition, the card-token regex, the `getServerSnapshot` contract, the
`CRON_SECRET` guard and the base-URL occurrence list were all quoted verbatim from source, and
`npx tsc --noEmit` was run once (exit 0) to settle one open type question. Where a section could not
verify something, it says so in its own `## UNVERIFIED` block, and those items are carried forward
unresolved in [14b](./14b-subsystems.md) and [15](./15-invariants-and-gotchas.md) rather than guessed. Two
figures from the indexing brief were corrected by re-measurement (dependency counts and route-file count);
both corrections are noted under "By the numbers".

**What was not run.** `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm e2e` and `pnpm analyze` were **not**
executed for this index. Every behavioural claim is read from source, not observed at runtime. Bundle-size
and chunk-count figures are the repo's own recorded measurements (`next.config.ts:133-144`,
`domains/performance/README.md:84-95`), not reproduced here — and both are **Turbopack** measurements,
since a bare `next build` in Next 16 is Turbopack, not webpack. The per-route half of them is no longer
trust-only: `scripts/bundle-budget.mjs` re-asserts it on every CI run (`.github/workflows/ci.yml:115-116`).

**Staleness is enforced, not trusted.** Every fully-qualified `path:line` citation in this directory
is fingerprinted into `.citations.json` — **1,406** of them when v3.5.0 widened the checker's
coverage from 1,086, because it used to skip every root-level file and so left 613 citations into
`package.json`, `pnpm-lock.yaml`, `CHANGELOG.md`, `CLAUDE.md` and the configs unchecked behind a
green summary. Run the script for the live count; it moves with every re-fingerprint.
`scripts/check-index-citations.mjs` re-checks those fingerprints and additionally rejects any citation
landing on a blank line. `src/lib/index-citations.test.ts` runs that check, and `vitest run` is chained into
`pnpm build` — so a citation that no longer points at what it described **fails the build**, naming
the file, the old line, the new line, and which index file cites it.

```bash
node scripts/check-index-citations.mjs           # verify
node scripts/check-index-citations.mjs --write   # re-fingerprint, after reviewing the drift
```

This exists because the honest criticism of a document like this is that it is write-only prose
that decays invisibly — a reader cannot tell a live citation from a dead one. Measured before the
guard existed: one unrelated 530-line change invalidated **33 of 699** citations with no signal at
all. Now that shows up as a red build with the exact list.

**Regenerate when:** this index is **pinned to v3.6.0** — cut from `release/v3.6.0` at `c734c14`, so
`package.json:3` reads `3.6.0`. Note this pin is a *re-pin*, not a regeneration: the frontmatter and
banners were bumped and the changed areas reconciled, but the counts below were measured at v3.5.0. Counts and render-mode values are anchored to that tree. On the next release, regenerate the thirteen area
sections, re-run the two synthesis passes and this file, bump the `version:` frontmatter in all
seventeen, then `--write` the fingerprints. Between releases the working tree is authoritative for
anything newer — and the citation check tells you exactly where the index has fallen behind.
