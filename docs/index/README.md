---
kind: doc
title: Anvilry v3.9.0 — Codebase Index
domain: [content]
status: current
version: v3.9.0
---

# Anvilry v3.9.0 — Codebase Index

**Anvilry** is a personal portfolio and AI-powered developer showcase: one Next.js App Router app that
serves multiple client-switchable experiences from a single URL, grounded on one MDX content source that
also feeds a chatbot, an MCP server, a 3D knowledge graph, a keyboard terminal, and a machine-readable
résumé.

**Version:** `3.9.0` (`package.json:3`). The previous release, `v3.8.0` (tag `ce0ee10`, 2026-09-30), was one behaviour fix and one opt-in setting; before it, `v3.7.0` (tag `8ba0be5`, 2026-09-30) was a hardening and correctness pass, and `v3.6.0` (tag `c734c14`, 2026-08-21) was a **correctness and
CI-integrity** release: the pnpm 11 install failure CI could not see, all four article source-label maps
type-enforced (two re-keyed by `ArticleSource`), a bundle gate that can actually fail replacing one that ran 222
times (211 green, 11 red) and produced zero artifacts, ever (`CHANGELOG.md:223-313`). `main` @ `a929932` had moved 297
commits past that tag with no version bump and no `CHANGELOG.md` entry; `3.7.0` was the first bump since, so `3.9.0`
names the *declared* version of this tree, and the `v3.6.0` tag marks an older tree.

**Stack:** Next.js 16.3.5 (App Router, `cacheComponents: true`) · React 19.3.0 · TypeScript 5.9 (strict) ·
Tailwind v4 (CSS-first, no JS config) · Velite 0.4 (MDX → typed collections) · AWS Bedrock / Anthropic SDK ·
Upstash Redis (rate limits, FAQ response cache, telemetry) · React Three Fiber + three.js 0.186 ·
Vitest 5 + Playwright 1.62 · deployed on Vercel.

**This index describes Anvilry v3.9.0 (`package.json` 3.9.0), i.e. `main` @ `a929932` (2026-09-19) plus five later behavioural fixes, two more in v3.8.0 (an IAM-denied model falls through to the next rung; `LLM_USE_SONNET_5_5` opts in to Claude Sonnet 5.5) and two in v3.9.0 (the model and provider line under chat answers, and the Konami-code easter egg, are removed).** It was measured in
the worktree at `8e9e73e` (branch `docs/fix-index-drift-post-v3-6`), whose non-`docs/` tree differs from
`a929932` only by those fixes (`git diff a929932 8e9e73e -- . ':!docs'` lists exactly their files):

1. **Notes are hidden at the data layer** while `NEXT_PUBLIC_NOTES_ENABLED` is off — `allNotes` is empty
   (`publishedNotes` stays ungated for the `/notes` route files, which need at least one static param), so
   `llms.txt`, the RSS feed, MCP, the chat corpus and the `.md` handlers stop publishing notes the `/notes` pages
   404; articles that only point at a note are dropped too.
2. **Rate limiting is per class** — `chat`, `voice` and `beacon` each get their own 8 requests / 60 s / IP
   bucket, and a valid `CRON_SECRET` bearer bypasses the limiter (the eval cron fires 12 sequential chats).
3. **One shared guard per gate** — `isAdminAuthorized` (`src/lib/admin-auth.ts`, constant-time) is used by
   `src/proxy.ts`, `requireAdmin` (route handlers) and the `/admin/telemetry` page, which re-checks it and calls
   `notFound()`; `src/lib/cron-auth.ts` (`hasValidCronSecret`, `unauthorizedUnlessCron`) guards all five crons.
4. **The command palette's talk-mode entry is gated by `isVoiceViewActive`**, so it cannot open a second
   session on top of the `voice` view.
5. **The bundle gate's `MIN_ROUTES` is 17**, the verified-dead `article-card`, `ui/button`, `ui/empty-state` and
   `ArticleJsonLd` were removed, local harness state is gitignored, and `ship-change` defaults its base branch
   to `develop`.

The `path:line` citations are checked against the tree by `scripts/check-index-citations.mjs` in CI (see [Provenance](#provenance) for what that does and does not cover), not pinned to a SHA. `a929932` is itself 297 commits past the `v3.6.0` tag, and the
earlier pin (`release/v3.6.0` @ `c734c14`) predates it, so citations written against the old pin do not line up.

---

## At a glance

| | |
|---|---|
| **What it is** | One Next.js App Router app presenting six `View` union members from `/`, all derived from one Velite MDX corpus |
| **Version** | `3.9.0` (`package.json:3`) — `main` @ `a929932` plus the five fixes above, the two v3.8.0 changes and the two v3.9.0 removals (`a929932` is 297 commits past the `v3.6.0` tag) |
| **Scale** | 325 `.ts`/`.tsx` files in `src/` totalling 43,763 lines (230 non-test files / 29,398 lines + 95 test files) · 39 files under `content/` · 61 route-defining files |
| **Subsystems** | content pipeline (incl. the decisions ledger) · view system · chat/LLM (incl. the FAQ response cache) · voice · MCP (10 tools) · telemetry · auth/security · feature flags · 3D/WebGL · build & deploy |
| **Hardest constraint** | `cacheComponents: true` (`next.config.ts:203`) — no route may export `runtime`, `revalidate` or `dynamic`; every page builds `PARTIALLY_STATIC` |
| **Strongest guard** | `game-model.test.ts` asserts a bijection between 3D graph nodes and real content — it blocks the deploy |
| **This index** | 17 files: this front door, 13 per-area sections, 2 subsystem maps, 1 invariants ledger |
| **Start with** | [§ Index map](#index-map) to navigate · [§ Route index](#route-index-all-routes) to find a route · [15](./15-invariants-and-gotchas.md) before changing anything |

---

## By the numbers

Measured from the working tree at `8e9e73e` (`main` @ `a929932` plus the five fixes above) unless a row says
otherwise. A claim in `CLAUDE.md`, `README.md`, `ARCHITECTURE.md` and friends that the code contradicts is
ledgered in [12 § Doc-vs-code drift](./12-docs-knowledge-and-harness.md#doc-vs-code-drift) and
[15 § Documented-but-unconfirmed](./15-invariants-and-gotchas.md#documented-but-unconfirmed); this table states
what the code says.

| Metric | Value | How measured |
|---|---|---|
| Files covered by this index | **470 distinct paths** — 458 inside `sairam-dev/` (452 tracked files, plus 6 gitignored local artifacts: `next-env.d.ts`, `ruvector.db`, `agentdb.rvf`, `agentdb.rvf.lock`, `.claude/proven-config.json`, `.claude/.proven-config-version`), 3 directory entries (`public/static/`, `.swarm/`, `.claude-flow/`), and 9 parent-directory appendix files (`../PLAN.md`, `../RESEARCH.md`, five under `../.aava/`, two under `../.claude-flow/`) = **467 file paths** | union of the `## Coverage` lists in sections 01–13 — see the recipe under the table |
| Coverage reconciliation | **452 of 456** tracked files outside `docs/index/` have a Coverage entry. The 4 without one are `src/lib/health-expectations.ts`, `src/lib/metadata-colors.ts`, `src/lib/theme-context.tsx` and `src/lib/use-theme-colors.ts` — a gap in the `src/lib` sections, not a measurement artifact | `git ls-files` minus the union of the Coverage lists (recipe under the table) |
| `src/app` | 78 files / 9,165 lines | `find src/app -type f` |
| `src/lib` | 89 files / 12,611 lines | `find src/lib -type f` |
| `src/components` | 153 files / 21,076 lines | `find src/components -type f` |
| `src/**/*.{ts,tsx}` | 325 files / **43,763 lines** — 230 non-test files (117 `.tsx`, 113 `.ts`) / 29,398 lines, plus 95 test files. The other 4 top-level `src/` files are `proxy.ts`, `proxy.test.ts`, `instrumentation.ts` and `instrumentation-client.ts` | `find src -name '*.ts' -o -name '*.tsx'` |
| `content/` | 39 files / 2,097 lines — 35 `.mdx` + 3 `.md` + 1 `.gitkeep` | `find content -type f` |
| `e2e/` | 2 files / 401 lines | `find e2e -type f` |
| App Router route-defining files | **61** — 16 `page.tsx`, 27 `route.ts`, 5 `layout.tsx`, 5 `opengraph-image.tsx`, 8 special (`error`, `global-error`, `not-found`, `icon`, `apple-icon`, `manifest`, `robots`, `sitemap`). Of the 27 `route.ts`, 19 sit under `src/app/api` and 8 outside it | `find src/app -name …` |
| Test / spec files | 97 — 95 under `src/` (62 in Vitest's `node` project, 33 `*.dom.test.*` in its `dom` project) + 2 Playwright specs. `npx vitest run` passes 923 tests (Vitest 5.0.0, ~12 s); Playwright runs two projects, `chromium` and `mobile-safari`, against `pnpm start` | `find src -name '*.test.*'`, `find e2e -name '*.spec.ts'`; `playwright.config.ts:15-38` |
| Dependencies | **35 prod + 18 dev** — up from 33 + 17 at the `v3.6.0` tag: `@aws-sdk/client-bedrock-runtime` (Titan embeddings for the FAQ cache) and `@radix-ui/react-tooltip` joined prod, `tsx` (runs `scripts/seal-claims.ts`) joined dev. Plus **12** `overrides`, 1 `patchedDependencies` entry (`@react-three/fiber@9.7.0`), the legacy `onlyBuiltDependencies` (1) and `ignoredBuiltDependencies` (2) lists, and the live 3-entry `allowBuilds` map. **There is no `pnpm` field in `package.json`:** v3.5.0 moved every pnpm setting to `pnpm-workspace.yaml`, because pnpm 11 stopped reading that field and would have silently dropped the ten security overrides then in force (two more have been added since) | `package.json:24-58` (prod), `package.json:61-78` (dev); `pnpm-workspace.yaml:18-43` (overrides; the last of the 12, `qs`, sits on line 44), `pnpm-workspace.yaml:49-54` (patch), `pnpm-workspace.yaml:70-71` and `pnpm-workspace.yaml:74-76` (legacy lists), `pnpm-workspace.yaml:81-84` (`allowBuilds`) — see [13](./13-dependencies-and-versions.md) |
| npm scripts | **13** — the 12 at the `v3.6.0` tag plus `seal-claims` (`tsx scripts/seal-claims.ts`). `build` is now `velite --clean && vitest run && next build && pagefind --site .next/server/app --output-path public/pagefind`, so **a failing Vitest test blocks the deploy and Pagefind runs last**. `analyze` is `velite --clean && ANALYZE=true next build --webpack`; the `--webpack` flag is **mandatory**, because a bare `next build` in Next 16 is Turbopack and `@next/bundle-analyzer` is webpack-only. There is still no `search-index` script (that is a Makefile target) — see [11](./11-config-build-ci-infra.md) | the `scripts` block of `package.json` (13 entries; it opens on line 8, not line 5, since `engines` occupies lines 5–7); `build` is `package.json:11` and `analyze` is `package.json:12` |
| Content items | 5 work · 11 projects · 7 notes · 15 articles (14 non-draft). 5 of the 7 notes carry `generatedBy: inkforge`; notes are hidden while `NOTES_ENABLED` is off (the default) | `find content -type f`, section [09](./09-content-and-schemas.md) |
| Decisions ledger | **43** entries — 33 project `decisions[]` (3 × 11 projects) + 5 work `constraints` + 5 work `tradeoffs`; served at `/decisions` and by the MCP `list_decisions` tool, and `decisions.test.ts` asserts bidirectional coverage against the content | `src/lib/decisions.ts:65`; `content/projects/*.mdx`, `content/work/*.mdx` frontmatter |
| Claims ledger | 1 sealed entry hash-chaining `impactMetrics` + `achievements`; verified in CI by `scripts/seal-claims.ts` (the `Claims integrity chain` step of the `ci` job) and shown by the terminal `integrity` command. Adding or removing a project changes a sealed claim, so the seal must be re-run | `data/integrity-chain.json`; `.github/workflows/ci.yml:83-84` |
| 3D graph | 16 nodes / 19 edges, bijective with 5 work + 11 projects (work 5, engine 4, tool 4, agent 3); count it from the arrays — the file's header docblock no longer hardcodes a node count (it says "every flagship work system + every OSS repo … see `graphNodes` below for the count") | `src/lib/graph-data.ts:18-81` (nodes), `src/lib/graph-data.ts:83-110` (edges); de-numbered docblock `src/lib/graph-data.ts:3-4` |
| MCP tools | **10** — `get_profile`, `list_projects`, `get_project`, `list_work`, `get_work`, `search_experience`, `get_resume_variant`, `list_all_content`, `get_content_item`, `list_decisions`. The route docblock says "10 read-only tools" and the public table on `/mcp` lists all 10. Guarded: `src/app/mcp/tools-documented.test.ts` asserts the documented table and the route's `registerTool` calls are identical, and `vitest run` is chained into `pnpm build`, so adding a tool without documenting it fails the build | `src/app/api/mcp/[transport]/route.ts:12` (docblock), `src/app/api/mcp/[transport]/route.ts:20-118` (registrations); `src/app/mcp/page.tsx:40-60` (`TOOLS` table) |
| Terminal commands | **32** — 28 visible + 4 hidden eggs (`secret`, `personal` (an alias of `secret`), `uses`, `now`); `COMMAND_NAMES` (autocomplete) lists the visible 28 only. The visible set includes `integrity` | `src/components/game/terminal/commands.ts:689-723` |
| Voice catalog | 18 voices — 6 curated + 12 extended, across 3 TTS engines | `src/lib/voice-catalog.ts:134-294` |
| Cron jobs | 5, all fail-closed on `CRON_SECRET` through the shared constant-time `unauthorizedUnlessCron` (`src/lib/cron-auth.ts`) | `vercel.json:3-7` |
| Rate limiting | **3 classes** — `chat`, `voice`, `beacon` — each its own Upstash sliding window of 8 requests / 60 s per IP (prefixes `anvilry:chat`, `anvilry:voice`, `anvilry:beacon`). `/api/chat` uses `chat`; `/api/tts`, `/api/tts-google` and `/api/transcribe` use `voice`; `/api/error` uses `beacon`. It fails open when Upstash is unconfigured or errors, and a valid `CRON_SECRET` bearer bypasses it. `/api/visit` keeps its own `slidingWindow(1, "30 m")` limiter; `/api/mcp/[transport]` and the admin purge route are not rate-limited | `src/lib/rate-limit.ts:21-31` (window, prefixes, class list; the `RateLimitClass` type sits just above), `src/lib/rate-limit.ts:95-110` (`checkRateLimit`); `src/app/api/visit/route.ts:41` |
| FAQ response cache | First-turn `/api/chat` questions (exactly one string message, no `X-Chat-Skip-Cache` header): an exact tier keyed by the SHA-256 of the normalized question, plus an optional semantic tier (`FAQ_CACHE_SEMANTIC_MATCH=true`; Titan v2 embeddings, 512 dims, 5 s timeout; cosine ≥ 0.92). TTL 24 h; index capped at 500 entries and trimmed on 1-in-20 writes; answers ≤ 4,000 chars and only after a clean `end_turn` served by the primary rung (a fallback-rung answer is never cached); entries written under an older `anvilry:corpus:built_at` stamp count as misses. Kill switch `FAQ_CACHE_ENABLED=false`; operator purge is `POST /api/admin/faq-cache/purge` | `src/lib/chat-cache.ts:63-79` (constants), `src/lib/chat-cache.ts:121-131` (env switches), `src/lib/chat-cache.ts:223` (threshold); `src/lib/faq-embeddings.ts:20-28`; `src/app/api/chat/route.ts:276-282` (eligibility); `src/instrumentation.ts:93-100` (corpus stamp) |
| Telemetry span kinds | **8** — `http.request`, `llm.attempt`, `tts.request`, `transcribe.request`, `client.error`, `server.error`, `budget.tick`, `chat.cache`. Only five are emitted today; `tts.request`, `transcribe.request` and `budget.tick` appear only in the schema, the admin dashboard, the `scripts/replay-trace.mjs` kind list and tests, never at an emit site. Redis retention is 7 days, trimmed on 1-in-20 emits | `src/lib/telemetry/schema.ts:37-49`; `src/lib/telemetry/emit.ts:54` (sample rate), `src/lib/telemetry/emit.ts:85` (the sampled trim) |
| `View` union members | **6** (`classic`, `gamified`, `chat`, `developer`, `voice`, `resume`); the switcher renders **4 pills server-side → 5 on desktop after hydration** on a default build, and the compact/mobile instance stays at 4; `resume` is never a pill | `src/components/view-context.tsx:24-34`; `src/components/view-switcher.tsx:25-60`, `src/components/view-switcher.tsx:96-97`, `src/components/view-switcher.tsx:103` |
| CHANGELOG version tags | 22 (still no `2.x`, no `3.1`–`3.3`) | `[3.9.0]` (2026-10-01) is the newest entry, then `[3.8.0]` (2026-09-30), `[3.7.0]` (2026-09-30) and `[3.6.0]` (`CHANGELOG.md:223`); `grep -c '^## \[[0-9]' CHANGELOG.md`. A bare `^## \[` also returns 22 — there is no live `[Unreleased]` section, and no entry describes the 297 commits between the `v3.6.0` tag and `a929932` (`[3.7.0]` covers what changed after `a929932`, #279–#284; `[3.8.0]` covers #287; `[3.9.0]` covers #291 and #292) |

Recipe for the two coverage rows (bash; re-run it after editing any section's Coverage list — the figures above
were taken from sections 01–13 as they stood when this file was last edited):

```bash
cov() { for f in docs/index/{0[1-9],1[0-3]}-*.md; do
  awk '/^## Coverage/{c=1;next} /^## /{c=0} c && /^- `/{sub(/^- `/,""); sub(/`.*/,""); print}' "$f"; done; }
cov | wc -l                                                     # Coverage bullets, duplicates included
cov | sort -u | wc -l                                           # distinct paths
comm -23 <(git ls-files | grep -v '^docs/index/' | sort) <(cov | sort -u)   # tracked files with no entry
```

**79** distinct paths are covered by more than one section (81 surplus occurrences — `src/lib/r3f.ts` and
the R3F patch are each claimed by three sections). Count distinct paths, not bullets: section 04 deliberately
repeats three paths in its trailing "Table-only" list, so a raw bullet total overstates the inventory.

### Primary owner for double-covered paths

Most double coverage is one-directional by construction — [13](./13-dependencies-and-versions.md) lists
import sites and [10](./10-tests-and-quality-gates.md) lists test files, so the area section always owns those
(68 of the 79 paths: 53 shared with 13, 15 with 10). Five paths are shared by 10 and 13 alone —
`vitest.config.ts`, `playwright.config.ts`, both Playwright specs and `pnpm-build-allowlist-consistency.test.ts` —
and belong to 10. The six cases where two *area* sections both claim a path resolve as follows; update the
primary, read the cross-reference for context.

| Path | Primary owner (update here) | Cross-reference |
|---|---|---|
| `src/app/robots.ts` | [02 § `src/app/robots.ts`](./02-api-routes.md#srcapprobotsts) — machine-readable endpoints | [01 § At a glance](./01-routes-pages.md#at-a-glance), [01 § Route matrix](./01-routes-pages.md#route-matrix) and [01 § `src/app/robots.ts`](./01-routes-pages.md#srcapprobotsts) |
| `src/app/sitemap.ts` | [02 § `src/app/sitemap.ts`](./02-api-routes.md#srcappsitemapts) — machine-readable endpoints | [01 § At a glance](./01-routes-pages.md#at-a-glance), [01 § Route matrix](./01-routes-pages.md#route-matrix) and [01 § `src/app/sitemap.ts`](./01-routes-pages.md#srcappsitemapts) |
| `src/components/game/webgl-boundary.tsx` | [06 § `src/components/game/webgl-boundary.tsx`](./06-components-game-terminal.md#srccomponentsgamewebgl-boundarytsx) | [07 § `src/components/game/webgl-boundary.tsx`](./07-components-3d.md#srccomponentsgamewebgl-boundarytsx) (labelled "cross-referenced" in section 07's **Scope** list) |
| `public/avatar/sairam.glb` | [07 § `public/avatar/sairam.glb`](./07-components-3d.md#publicavatarsairamglb) | [11 § `public/avatar/sairam.glb`](./11-config-build-ci-infra.md#publicavatarsairamglb) (public asset tree) |
| `src/lib/r3f.ts` | [04 § Coverage](./04-lib-ai-voice-infra.md#coverage) — the "Table-only" `src/lib/r3f.ts` bullet | [07 § `src/lib/r3f.ts`](./07-components-3d.md#srclibr3fts) (labelled "cross-reference — the shared R3F barrel; the lib section owns its entry" in section 07's **Scope** list); [13](./13-dependencies-and-versions.md) lists its import sites |
| `patches/@react-three__fiber@9.7.0.patch` | [07 § Cross-references outside this section](./07-components-3d.md#cross-references-outside-this-section) — what the null-target guard prevents (listed in 07's **Scope**) | [11](./11-config-build-ci-infra.md) (config tree entry) and [13 § `patchedDependencies`](./13-dependencies-and-versions.md) (the pnpm pin and when to drop it) |

---

## Index map

| File | What's in it | When you'd open it |
|---|---|---|
| [`README.md`](./README.md) (this file) | Front door: stats, index map, repo layout, the full route table, reading order | First stop, and whenever you need to find *which* section owns a topic |
| [`01-routes-pages.md`](./01-routes-pages.md) | Every non-API file under `src/app` — pages (incl. `/decisions`), layouts, error boundaries, OG images, metadata routes, `globals.css`; the page render matrix | You're changing a page, its metadata, its caching, or a route gate |
| [`02-api-routes.md`](./02-api-routes.md) | All `src/app/api/**` handlers (chat, voice, MCP, crons, `.md` passthroughs, the admin FAQ-cache purge), the machine-readable endpoints (`llms.txt`, `feed.xml`), `src/proxy.ts`, both instrumentation hooks; the endpoint matrix | You're touching an API route, a cron, auth, or instrumentation |
| [`03-lib-content-data.md`](./03-lib-content-data.md) | `src/lib` content/data half — `content.ts`, `corpus.ts`, `decisions.ts`, `game-model.ts`, `graph-data.ts`, `profile.ts`, `mcp-tools.ts`, the claims-integrity ledger, the three flag modules; the derivation pipeline and full flag inventory | You're changing what the site knows about itself, or a feature flag |
| [`04-lib-ai-voice-infra.md`](./04-lib-ai-voice-infra.md) | `src/lib` AI/voice/infra half — `llm.ts`, `llm-trace.ts`, `chat-cache.ts`, `faq-embeddings.ts`, `voice-catalog.ts`, `rate-limit.ts`, `redis.ts`, `admin-auth.ts`, `cron-auth.ts`, `telemetry/**`, `scroll/**`, `r3f.ts`, the media hooks | You're changing the model chain, the FAQ cache, voice engines, rate limiting, auth guards, telemetry, or autoscroll |
| [`05-components-chat-voice.md`](./05-components-chat-voice.md) | `src/components/chat/**` + `ask-portfolio.tsx` — the chat transport, the three voice surfaces, the one-mic mutex, the orb stack, the streamed-markdown security path | You're changing chat, voice UI, or the injection/XSS boundary |
| [`06-components-game-terminal.md`](./06-components-game-terminal.md) | `src/components/game/**` — the gamified view, the developer terminal (full 32-command registry table), easter eggs, discovery badges, the skill tree | You're changing the Play or Developer view, or adding a terminal command |
| [`07-components-3d.md`](./07-components-3d.md) | `src/components/hero-graph/**`, `hero-avatar/**`, `webgl-boundary.tsx`, the R3F barrel, `public/avatar/sairam.glb` | You're changing a WebGL scene, a mount gate, or the avatar asset |
| [`08-components-site-shell-ui.md`](./08-components-site-shell-ui.md) | Root-level components, `home/**`, `ui/**`, `scroll/**` — the view store and router, nav/footer, command palette, JSON-LD, `MDXContent`, cards, the UI kit | You're changing the shell, the view state machine, or a home section |
| [`09-content-and-schemas.md`](./09-content-and-schemas.md) | `velite.config.ts` + every file under `content/` — the four Zod schemas field-by-field, the full content inventory, cross-references and dangling links | You're authoring content or changing a schema |
| [`10-tests-and-quality-gates.md`](./10-tests-and-quality-gates.md) | All 97 test/spec files (95 under `src/` + 2 Playwright specs) + `vitest.config.ts` + `playwright.config.ts` + the CI wiring of the non-Vitest gates (bundle budget, citation check, claims seal) — the guard matrix (test → module → what breaks) and the four load-bearing gates verified against source | A test failed, or you want to know what a change will trip |
| [`11-config-build-ci-infra.md`](./11-config-build-ci-infra.md) | `package.json`, `next.config.ts`, CSP/headers directive-by-directive, `Makefile` (36 targets), `vercel.json`, the 5 GitHub workflows (`ci`, `codeql`, `dependency-review`, `gitleaks`, `scorecard`; `bundle-analysis.yml` was deleted in v3.6.0), Dependabot, `public/**`, the complete env-var table | You're changing build, CI, headers, or an environment variable |
| [`12-docs-knowledge-and-harness.md`](./12-docs-knowledge-and-harness.md) | Every root doc, `docs/**`, `domains/**`, `signals/`, the 5 `.claude` skills, `ship-change.js`; version history and the doc-vs-code drift ledger | You're updating docs, or you distrust something a doc told you |
| [`13-dependencies-and-versions.md`](./13-dependencies-and-versions.md) | Every declared dependency with its import sites, the server/client runtime split, all exact pins and the 12 security overrides, framework-version notes | You're adding, bumping, or removing a dependency |
| [`14-subsystems.md`](./14-subsystems.md) | Cross-cutting subsystem maps, **part 1 of 2** — subsystems 1–6 (content pipeline, view system, chat/LLM, voice, MCP, telemetry) with flows, entry/exit points, failure modes and the flag/env surface for each | "How does X actually work end to end?" for content, views, chat, voice, MCP or telemetry |
| [`14b-subsystems.md`](./14b-subsystems.md) | Cross-cutting subsystem maps, **part 2 of 2** — subsystems 7–10 (auth & security, feature flags, 3D/WebGL, build & deploy), plus the cross-subsystem coupling table, the entry-point cheat sheet, and the UNVERIFIED ledger for both parts | "If I change X, what else moves?" and "where do I start?" |
| [`15-invariants-and-gotchas.md`](./15-invariants-and-gotchas.md) | Every deploy blocker, every multi-file contract, every platform quirk, and the silent-failure ledger — re-cut by blast radius instead of by directory | Before you edit anything load-bearing, and when something fails with no error |

---

## Repo layout

Annotated, 2–3 levels. The repo under index is `Anvilry/sairam-dev/`; the parent `Anvilry/` wrapper holds
pre-build artifacts, third-party agent tool state (indexed as an appendix in
[12](./12-docs-knowledge-and-harness.md)) and the sibling `git worktree` checkouts of the app.

```
Anvilry/                                  parent wrapper — NOT the app
├── PLAN.md                               original pre-build plan (Next.js 15 era; historical)
├── RESEARCH.md                           the adversarially-verified research blueprint behind it
├── .aava/                                Aava agent scaffolding (constitution, memory, skills index)
├── .claude-flow/                         Ruflo policy ledger + neural counters
├── ruvector.db                           Ruflo vector store (binary)
├── anvilry-* / wt-*                      sibling git worktrees of sairam-dev (transient; not part of the app)
└── sairam-dev/                           ◄── THE APP (own git repo)
    ├── src/
    │   ├── app/                          App Router: 16 pages, 27 route handlers, 5 layouts, 5 OG images
    │   │   ├── api/                       chat · mcp/[transport] · tts · tts-google · transcribe · error · visit ·
    │   │   │                              github/stats · resume.json · cron/×5 · md/×4 · admin/faq-cache/purge
    │   │   ├── {work,projects,notes,articles}/   content route trees (+ [slug], OG image, [slug].md)
    │   │   ├── {about,decisions,mcp,resume,search,stats}/  standalone pages
    │   │   ├── admin/telemetry/           request-time Redis dashboard (Basic auth: src/proxy.ts, re-checked in the page)
    │   │   ├── {feed.xml,llms.txt,llms-full.txt}/  machine-readable route handlers
    │   │   ├── .well-known/vercel/flags/  Vercel Flags SDK discovery endpoint (verifyAccess-gated)
    │   │   ├── layout.tsx · page.tsx      root layout + the ONLY ViewRouter mount site
    │   │   ├── error.tsx · global-error.tsx · not-found.tsx   boundaries (404 = a live terminal)
    │   │   ├── {icon,apple-icon,opengraph-image}.tsx · {manifest,robots,sitemap}.ts
    │   │   └── globals.css                Tailwind v4 entry + design tokens + every keyframe
    │   ├── components/
    │   │   ├── chat/                      chat transport, 3 talk surfaces (modal · inline · core), one-mic mutex, orb stack
    │   │   ├── game/                      gamified view + terminal/ (32-command registry)
    │   │   ├── hero-graph/ · hero-avatar/ the two alternative hero WebGL backdrops (one slot, NEXT_PUBLIC_HERO_MODE)
    │   │   ├── home/                      the seven homepage sections (testimonials flag-gated) + the résumé view
    │   │   ├── ui/ · scroll/              reveal · section · skeleton · tooltip · ink transition · autoscroll pill
    │   │   └── view-{context,router,switcher}.tsx   the view state machine
    │   ├── lib/
    │   │   ├── content.ts · corpus.ts · game-model.ts · graph-data.ts · profile.ts · decisions.ts   content + derivation
    │   │   ├── llm.ts · llm-trace.ts · chat-cache.ts · faq-embeddings.ts · mcp-tools.ts   AI layer, FAQ cache, MCP tool impls
    │   │   ├── rate-limit.ts · redis.ts · admin-auth.ts · cron-auth.ts   3-class limiter, Redis singleton, shared auth guards
    │   │   ├── claims-integrity.ts · integrity-chain.ts   sealed-claims ledger over data/integrity-chain.json
    │   │   ├── voice-catalog.ts · voice-settings-context.tsx   voice source of truth
    │   │   ├── telemetry/                 schema · emit · with-trace · beacon
    │   │   ├── scroll/                    the two autoscroll engines behind a runtime flag
    │   │   └── r3f.ts                     the load-bearing R3F re-export barrel
    │   ├── proxy.ts                       Next 16 Proxy (Node runtime): HTTP Basic Auth first filter for /admin/*
    │   └── instrumentation{,-client}.ts   [config] cold-start snapshot + corpus stamp · [vitals] + error beacons
    ├── content/                           MDX source: work/5 · projects/11 · notes/7 · articles/15
    ├── data/                              integrity-chain.json (the sealed claims ledger)
    ├── e2e/                               Playwright: views.spec.ts · resume.spec.ts
    ├── patches/                           @react-three/fiber@9.7.0 (pnpm patchedDependencies)
    ├── public/                            avatar/sairam.glb (1.05 MiB) · resume/ (1 PDF) · 5 unreferenced create-next-app SVGs
    ├── docs/
    │   ├── index/                         ◄── THIS INDEX (17 files)
    │   ├── README.md · configuration.md   docs schema · env-var + flag reference
    │   ├── next-upgrade-plan-2026-09.md   Next upgrade plan (draft)
    │   └── superpowers/{plans,specs}/     17 dated plans + 6 design specs (point-in-time)
    ├── domains/{content,seo,performance}/  knowledge-base loop charters
    ├── signals/                           signal-kind schema README (no signal files yet)
    ├── .claude/{skills,workflows}/         5 agent skills + ship-change.js
    ├── .github/                           workflows/ (ci · codeql · dependency-review · gitleaks · scorecard) ·
    │                                      dependabot.yml · ISSUE_TEMPLATE/ · PR template · CONTRIBUTING.md
    ├── scripts/                           bundle-budget.mjs (CI budget gate) · check-index-citations.mjs (this index's gate) ·
    │                                      seal-claims.ts (claims ledger seal/verify) · replay-trace.mjs (telemetry replay CLI)
    ├── velite.config.ts · next.config.ts · vitest.config.ts · playwright.config.ts
    ├── package.json · pnpm-lock.yaml · pnpm-workspace.yaml · vercel.json · Makefile
    ├── CLAUDE.md · AGENTS.md · ARCHITECTURE.md · CHANGELOG.md · LOG.md
    └── VOICE.md · TELEMETRY.md · DEPLOY.md · README.md · SECURITY.md · CODE_OF_CONDUCT.md · LICENSE
```

Generated-and-gitignored, present locally but not in the repo: `.velite/` (required before any compile),
`.next/`, `next-env.d.ts`, `.vercel/`, `test-results/`, `playwright-report/`, `scratch-pad/`, `public/pagefind/`
(written by the last step of `pnpm build`), `public/static/` (Velite's asset output directory, created empty by a
build), and the agent-tooling state `ruvector.db`, `agentdb.rvf*`, `.swarm/`, `.claude-flow/` and
`.claude/proven-config*`.

---

## The views (six union members, four server-rendered pills)

All of them live on `/` alone — `ViewRouter` is mounted at `src/app/page.tsx:24-34` and imported nowhere else.
Classic is server-rendered and kept `hidden` (never unmounted, so scroll survives); the others are
`next/dynamic` with `ssr: false` and **are** unmounted when inactive, which is what lets R3F dispose the
WebGL context (`src/components/view-router.tsx:9-24`, `src/components/view-router.tsx:58-69`).

| View | What it is | Entry file | How it's reached |
|---|---|---|---|
| `classic` | The SEO/no-JS default: hero, featured work, featured projects, achievements, writing, contact — plus testimonials, which render nothing while `TESTIMONIALS_ENABLED` is off (the default). Always what SSR and crawlers get. | `src/app/page.tsx:24-34` (the `ViewRouter` element and the `<main>` children it receives) | Default. `?view=classic` deletes the param. Cannot be disabled. |
| `gamified` ("Play") | 3D WebGL knowledge-graph explorer + an accessible DOM-first system index + dossier cards. | `src/components/game/game-view.tsx` | Switcher pill, `?view=gamified`, ⌘K, or a `[[cmd:view:gamified]]` chat token |
| `chat` | Full-height AI concierge console grounded on the MDX corpus (chips, composer, mic, attachments). | `src/components/chat/chat-view.tsx` | Switcher pill, `?view=chat`, ⌘K, terminal `chat` |
| `developer` | Keyboard-driven terminal (32 commands) plus a recruiter rail on `lg+`. | `src/components/game/developer-view.tsx` | Switcher pill, `?view=developer`, ⌘K, terminal `developer` |

Two further members exist in the same union. `voice` (`src/components/chat/anvil-view.tsx`) **is** a
switcher pill on desktop, but only after hydration: `OPTIONS` holds just the four above
(`src/components/view-switcher.tsx:25-60`) and `VOICE_OPTION` is appended when
`mounted && !compact && isViewEnabled("voice")` (`src/components/view-switcher.tsx:103`). Since an unset
`NEXT_PUBLIC_ENABLED_VIEWS` enables every optional view (`src/lib/enabled-views.ts:28`, with `voice` in
`ALL_OPTIONAL` at `src/lib/enabled-views.ts:21`), a **default build renders 4 pills on the server and 5 on
desktop after hydration**; the compact (mobile) instance deliberately stays at 4 and routes voice through the
header Anvil orb instead (`src/components/view-switcher.tsx:96-97`). While the `voice` view is active the
overlay entry points stay inert — the header orb is disabled and the palette's "Start voice conversation"
entry is omitted (`isVoiceViewActive`, `src/components/chat/voice-surface-mutex.ts:27`), so a second
concurrent mic cannot stack on top of it. `resume` (`src/components/home/resume-view.tsx`) is **never** a
pill — it is reachable only via ⌘K "Recruiter view" or `?view=resume`. So `View` is a six-member union
(`src/components/view-context.tsx:24-34`) and "four views" describes the server-rendered switcher, not the
store — see [08 § Six-view state machine](./08-components-site-shell-ui.md#six-view-state-machine) for the full
state machine and [15](./15-invariants-and-gotchas.md) for the doc-drift entry.

State lives in module-level bindings outside React — `current` and `listeners` (the store proper),
`routerBridge` (so a non-React function can push a route when a view is chosen off `/`) and `pendingChatQuery`
(the palette → chat one-shot hand-off) — and is read with `useSyncExternalStore`. The server and first-client
snapshot always return `classic`, and a `?view=` deep link is applied only post-hydration by `ViewQuerySync`.
There is no cookie and no localStorage — a bare `/` is always Classic.

---

## Route index (all routes)

Every addressable path in the app. `cacheComponents: true` is set globally (`next.config.ts:203`), so every
**page** route builds as `renderingMode: "PARTIALLY_STATIC"` with `experimentalPPR: true`; the column
records what the segment config and build artifact actually say. **No file in the app exports `runtime`** —
every route handler runs on Next's default Node.js runtime, and so does `src/proxy.ts` (a Next 16 Proxy defaults
to Node and cannot set `runtime`); nothing in the app runs on Edge.

| Path | Kind | File | Render / runtime |
|---|---|---|---|
| `/` | page | `src/app/page.tsx` | PARTIALLY_STATIC, `compute:"static"`; the only `ViewRouter` mount |
| `/about` | page | `src/app/about/page.tsx` | PARTIALLY_STATIC, static |
| `/decisions` | page | `src/app/decisions/page.tsx` | PARTIALLY_STATIC, static; `"use client"`, no `metadata` and no layout; not in the sitemap or `llms.txt`. Renders the decisions ledger (`allDecisions`, `src/lib/decisions.ts`) with category and tag filters; linked from the footer, the command palette and the `/work` and `/projects` index pages |
| `/mcp` | page | `src/app/mcp/page.tsx` | PARTIALLY_STATIC, static; exports **no** segment config (only `metadata`); its hand-maintained `TOOLS` table must list all 10 tools and `tools-documented.test.ts` enforces that |
| `/resume` | page | `src/app/resume/page.tsx` + `resume/layout.tsx` | PARTIALLY_STATIC, static; page is `"use client"`; relaxed `frame-ancestors 'self'` CSP and `X-Frame-Options: SAMEORIGIN` from the per-route override in `next.config.ts` |
| `/search` | page | `src/app/search/page.tsx` + `search/layout.tsx` | PARTIALLY_STATIC, static; `"use client"`; injects `/pagefind/*` at runtime; `SEARCH_ENABLED` only hides the nav link and the sitemap entry |
| `/stats` | page | `src/app/stats/page.tsx` + `stats/layout.tsx` | PARTIALLY_STATIC, static; **not** flag-gated (`STATS_ENABLED` only hides the nav link and the sitemap entry) |
| `/work` | page | `src/app/work/page.tsx` | PARTIALLY_STATIC, static; `revalidate` deliberately deleted |
| `/work/[slug]` | dynamic page | `src/app/work/[slug]/page.tsx` | Per-slug prerender via `generateStaticParams` (5 slugs) + dynamic fallback; an unknown slug calls `notFound()` |
| `/work/<slug>/opengraph-image` | image | `src/app/work/[slug]/opengraph-image.tsx` | Per-slug prerendered PNG (1200×630) |
| `/work/<slug>.md` | machine-readable | `src/app/work/[slug].md/route.ts` (also rewritten to `/api/md/work/:slug`) | nodejs; dynamic (reads `req.url`); reads `content/` from disk |
| `/projects` | page | `src/app/projects/page.tsx` | PARTIALLY_STATIC; `"use cache"` + `cacheLife("hours")` on the page function → revalidate 3600 / expire 86400; live GitHub fetch |
| `/projects/[slug]` | dynamic page | `src/app/projects/[slug]/page.tsx` | Per-slug prerender (11 slugs) + dynamic fallback. **Also** `"use cache"` + `cacheLife("hours")` — the page function calls `fetchRepo()` and `pushedAgo()` (`Date.now()`), so each prerendered slug revalidates every 3600 s too |
| `/projects/<slug>/opengraph-image` | image | `src/app/projects/[slug]/opengraph-image.tsx` | Per-slug prerendered PNG |
| `/projects/<slug>.md` | machine-readable | `src/app/projects/[slug].md/route.ts` → `/api/md/projects/:slug` | nodejs; dynamic |
| `/articles` | page | `src/app/articles/page.tsx` + `articles/layout.tsx` | PARTIALLY_STATIC, static; `"use client"`; **layout gate** `ARTICLES_ENABLED` (default true) 404s the whole subtree |
| `/articles/[slug]` | dynamic page | `src/app/articles/[slug]/page.tsx` | Per-slug prerender over `allArticles` (filtered params: 12 slugs with notes dark — 15 articles minus 1 draft minus the 2 note-only ones, `how-dns-works` and `tombstone-v1-2-devto`; 14 once notes are enabled) + dynamic fallback; most slugs `redirect()`, guarded by an `https?://` prefix check |
| `/articles/<slug>/opengraph-image` | image | `src/app/articles/[slug]/opengraph-image.tsx` | Per-slug prerendered PNG; maps `allArticles`, which already drops note-only articles while notes are dark, so its slug set equals the page's |
| `/articles/<slug>.md` | machine-readable | `src/app/articles/[slug].md/route.ts` → `/api/md/articles/:slug` | nodejs; dynamic |
| `/notes` | page | `src/app/notes/page.tsx` | PARTIALLY_STATIC; `notFound()` when `NOTES_ENABLED` is off (default off) or when `allNotes` is empty |
| `/notes/[slug]` | dynamic page | `src/app/notes/[slug]/page.tsx` | Per-slug prerender for **all** published notes (`publishedNotes`, deliberately ungated — `cacheComponents` requires ≥1 param); the page calls `notFound()` while `NOTES_ENABLED` is off, so those slugs prerender as 404s |
| `/notes/<slug>/opengraph-image` | image | `src/app/notes/[slug]/opengraph-image.tsx` | Per-slug prerendered PNG from the same ungated `publishedNotes` params; `getNote` reads the gated `allNotes`, so while notes are dark every card falls back to the generic title/date |
| `/notes/<slug>.md` | machine-readable | `src/app/notes/[slug].md/route.ts` → `/api/md/notes/:slug` | nodejs; dynamic; reads the gated `allNotes`, so it 404s while notes are dark |
| `/admin/telemetry` | page | `src/app/admin/telemetry/page.tsx` | **No static shell** (`response:"empty"`, `compute:"blocking"`, `htmlSize:0`): `export const instant = false` + `await connection()`. Auth is enforced twice — the `src/proxy.ts` gate, then the page itself, which calls `isAdminAuthorized` and `notFound()` before any Redis read |
| `/opengraph-image` | image | `src/app/opengraph-image.tsx` | Static image route (prerendered) |
| `/icon` · `/apple-icon` | image | `src/app/icon.tsx` · `src/app/apple-icon.tsx` | Static image routes (32×32 · 180×180) |
| `/manifest.webmanifest` | metadata | `src/app/manifest.ts` | Static metadata route. It declares **no `screenshots` key**: it used to declare two PWA screenshots (`/static/screenshot-{desktop,mobile}.png`) that 404 because `public/static/` is empty, and the file now carries a comment recording why and how to re-add them (`src/app/manifest.ts:20-25`). Guarded: `src/app/manifest.test.ts:66-72` asserts `screenshots` is empty, and `src/app/manifest.test.ts:74-80` asserts that if it is ever re-declared every `src` must resolve. See [15](./15-invariants-and-gotchas.md) for the history |
| `/robots.txt` | metadata | `src/app/robots.ts` | Static; allow-all, no `disallow` entries; carries the advisory `Content-Signal: search=yes, ai-input=yes, ai-train=no` directive (guarded by `robots.test.ts`) |
| `/sitemap.xml` | metadata | `src/app/sitemap.ts` | Static; flag-aware (notes, articles, stats, search); `lastModified` only on note and article entries, taken from each item's frontmatter `date` |
| `/_not-found` (404) | page | `src/app/not-found.tsx` | Prerendered; `"use client"`; a live terminal seeded with a fake kernel panic |
| `/_global-error` | boundary | `src/app/global-error.tsx` | Prerendered; own `<html>/<body>`, inline hex palette |
| (segment boundary) | boundary | `src/app/error.tsx` | Client boundary, no URL of its own |
| `/llms.txt` | machine-readable | `src/app/llms.txt/route.ts` | nodejs; `text/plain`; static (no request access); lists notes only while `allNotes` is non-empty |
| `/llms-full.txt` | machine-readable | `src/app/llms-full.txt/route.ts` | nodejs; `text/plain`; static (full chatbot corpus) |
| `/feed.xml` | machine-readable | `src/app/feed.xml/route.ts` | nodejs; `application/xml`; static; notes are gated at the data layer (`allNotes`), `ARTICLES_ENABLED` is not consulted |
| `/.well-known/vercel/flags` | api | `src/app/.well-known/vercel/flags/route.ts` | nodejs; `verifyAccess`-gated (401 + `null` body); exposes exactly 1 flag |
| `POST /api/chat` | api | `src/app/api/chat/route.ts` | nodejs · `maxDuration = 30` · rate-limited (`chat` class) · streams, `Cache-Control: no-store`; first-turn questions can be answered from the FAQ response cache (`X-Chat-Cache: hit`, no Bedrock call) unless the request carries `X-Chat-Skip-Cache`; emits `llm.attempt` and `chat.cache` |
| `GET,POST,DELETE /api/mcp/[transport]` | api | `src/app/api/mcp/[transport]/route.ts` | nodejs · `maxDuration = 30` · public read-only; 10 tools; `disableSse: true`; no auth and no rate limit (the file imports only `mcp-handler` and `@/lib/mcp-tools`). Public endpoint: `/api/mcp/mcp` |
| `POST /api/tts` | api | `src/app/api/tts/route.ts` | nodejs · `maxDuration = 15` · rate-limited (`voice` class) · AWS Polly · per-instance LRU |
| `POST /api/tts-google` | api | `src/app/api/tts-google/route.ts` | nodejs · `maxDuration = 15` · rate-limited (`voice` class) · Google Chirp 3 HD via REST |
| `POST /api/transcribe` | api | `src/app/api/transcribe/route.ts` | nodejs · `maxDuration = 20` · rate-limited (`voice` class) · AWS Transcribe Streaming |
| `POST /api/error` | api | `src/app/api/error/route.ts` | nodejs · `maxDuration = 5` · rate-limited (`beacon` class) · Zod + `redact()` → 204 no body |
| `POST /api/visit` | api | `src/app/api/visit/route.ts` | nodejs · own limiter `slidingWindow(1, "30 m")` · Upstash INCR |
| `GET /api/github/stats` | api | `src/app/api/github/stats/route.ts` | nodejs · fail-open · 1 h cadence only at fetch level |
| `GET /api/resume.json` | api | `src/app/api/resume.json/route.ts` | nodejs · JSON Resume v1.0.0 passthrough |
| `POST /api/admin/faq-cache/purge` | api | `src/app/api/admin/faq-cache/purge/route.ts` | nodejs · `maxDuration = 10` · `requireAdmin` (Basic auth against `ADMIN_PASSWORD`) — **outside** the `src/proxy.ts` matcher, so that is its only gate · deliberately not rate-limited · body `{"question": "<≤ 2000 chars>"}` (4 KB cap) removes one FAQ-cache entry by question text; 503 when Redis errors |
| `GET /api/cron/health-check` | api (cron) | `src/app/api/cron/health-check/route.ts` | nodejs · `maxDuration = 25` · `Bearer CRON_SECRET`, fail-closed · `0 5 * * *` |
| `GET,POST /api/cron/eval` | api (cron) | `src/app/api/cron/eval/route.ts` | nodejs · `maxDuration = 60` · `Bearer CRON_SECRET` · `0 9 * * 1` · POSTs 12 golden questions sequentially to `/api/chat` with `X-Chat-Skip-Cache: 1` and its own bearer, which the limiter recognises and bypasses |
| `GET /api/cron/github-sync` | api (cron) | `src/app/api/cron/github-sync/route.ts` | nodejs · `maxDuration = 30` · `Bearer CRON_SECRET` · `0 8 * * *` (docstring says "hourly") |
| `GET /api/cron/seo-audit` | api (cron) | `src/app/api/cron/seo-audit/route.ts` | nodejs · `maxDuration = 60` · `Bearer CRON_SECRET` · `0 6 * * 1` |
| `GET /api/cron/content-audit` | api (cron) | `src/app/api/cron/content-audit/route.ts` | nodejs · `maxDuration = 60` · `Bearer CRON_SECRET` · `0 7 * * 1` |
| `GET /api/md/{work,projects,articles,notes}/[slug]` | machine-readable | `src/app/api/md/*/[slug]/route.ts` (4 files) | nodejs · `text/markdown`; reads `content/` from disk at request time |
| `(all) /admin/:path*` | proxy | `src/proxy.ts` | **Node.js** (the Next 16 Proxy default; `runtime` cannot be set there) · HTTP Basic Auth vs `ADMIN_PASSWORD` through the shared `isAdminAuthorized` (`src/lib/admin-auth.ts`: SHA-256 digests compared with `timingSafeEqual`, username ignored) · a first filter, not the only gate — matcher at `src/proxy.ts:21-23` |

Caveats on this table, carried forward honestly: render-mode / revalidate / prerendered-slug values come from a
**local, gitignored `next build`** of the main checkout dated 19 Sep (`.next/prerender-manifest.json`,
`.next/routes-manifest.json`). It ran before the `a929932` merge and before the five fixes, and it reflects that
machine's `NEXT_PUBLIC_*` values (notes dark: 7 note slugs prerender as 404s; it prerendered 13 article slugs,
one more than the described tree's 12, because the note-only filter inside `allArticles` is one of the fixes) — a
production build with different flags prerenders a different slug set. Segment-config facts (`instant`,
`"use cache"`, `cacheLife`, `generateStaticParams`) are read from source at the described tree and are
env-independent. Which handler answers the four `.md` paths is unproven: the `next.config.ts:240-248` rewrites
map `/<collection>/:slug.md` to `/api/md/*`, but the same local build also registers the four `[slug].md`
route files under `staticRoutes` with the regex of the plain `[slug]` pages (no `.md` in the pattern), and
neither path was exercised against a running server; both handlers produce byte-identical output. Details in
[01](./01-routes-pages.md) and [02](./02-api-routes.md).

---

## Start here

Reading order for a new maintainer. Sections 14 and 15 carry the highest information density per minute.

1. **[`15-invariants-and-gotchas.md`](./15-invariants-and-gotchas.md)** — read the "Deploy blockers" and
   "Load-bearing invariants" sections before you edit anything. Three facts frame the whole repo:
   `"build": "velite --clean && vitest run && next build && pagefind --site .next/server/app --output-path public/pagefind"`
   (a failing test blocks the deploy; Pagefind runs last), `cacheComponents: true`, and `.velite/` being
   gitignored while `src/lib/content.ts` imports it.
2. **[`14-subsystems.md`](./14-subsystems.md)** + **[`14b-subsystems.md`](./14b-subsystems.md)** — the ten
   flow maps, split across two parts (1–6 and 7–10). Part 2's "Entry-point cheat sheet" answers "if I want
   to change X, where do I start?" for more than 40 common tasks.
3. **This file's route table** (above) — the single most-used lookup.
4. **[`09-content-and-schemas.md`](./09-content-and-schemas.md)** — content is the source of truth for
   every view, so the schemas explain most of the rest.
5. **[`03-lib-content-data.md`](./03-lib-content-data.md)** — the derivation pipeline that turns that
   content into the graph, the corpus, the résumé, the MCP tools, the decisions ledger, and `llms.txt`.
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
    drift ledger matters because `CLAUDE.md`, `README.md`, `ARCHITECTURE.md`, `DEPLOY.md`, `SECURITY.md` and `VOICE.md` each
    contain, or contained, claims the code contradicts — the code wins, and section 12 (with section 15's
    "Documented-but-unconfirmed" table) records exactly where. Some rows have since been closed by edits to
    those root docs, so read the ledgers for what they mark as still-live rather than assuming every row is
    open.

---

## Coverage

**This file indexes no files of its own.** It is a synthesis front door; the authoritative file inventory is
the union of the `## Coverage` lists in sections 01–13, summarised in [§ By the numbers](#by-the-numbers):

- **470 distinct paths** — 458 inside `sairam-dev/`, 3 directory entries (`public/static/`, `.swarm/`,
  `.claude-flow/`), and 9 parent-directory appendix files owned by
  [12](./12-docs-knowledge-and-harness.md) = **467 file paths**
- **452 of 456** tracked files outside `docs/index/` have a Coverage entry — the 4 exceptions are named in
  [§ By the numbers](#by-the-numbers)
- **79** paths are covered by more than one section; primary owners are resolved in
  [§ Primary owner for double-covered paths](#primary-owner-for-double-covered-paths)
- Sections [14](./14-subsystems.md), [14b](./14b-subsystems.md) and
  [15](./15-invariants-and-gotchas.md) likewise index no new files — they re-cut sections 01–13 by data flow
  and by blast radius respectively

---

## Provenance

**Generated:** 2026-08-20, against `release/v3.4.2` at commit `a848117`. **Re-pinned 2026-08-21 to v3.5.0** —
release merge `00e38a2` on `origin/main`, working tree `develop` — **and again to v3.6.0** (`release/v3.6.0` @
`c734c14`). **Re-pinned 2026-09-29 to `main` @ `a929932` plus the five fixes listed at the top**, measured at
`8e9e73e`. Each re-pin corrected citations and counts against the new tree in place; none was a full
regeneration. The 2026-09-29 pass re-checked the claims in the thirteen area sections and in this file against
source, and rewrote the ones the code no longer supports — among them that `src/proxy.ts` is the app's one Edge
file (a Next 16 Proxy runs on Node.js), that `/projects` alone uses `"use cache"`, that the sitemap never emits
`lastModified`, the counts of commands, tests, routes, dependencies, overrides and workflows, and that a Vitest
test enforces the citation check (it is a CI step). **Relabelled 2026-09-30 to v3.7.0** (`release/v3.7.0`, cut from `develop` @ `f1508b7`): the version metadata, the pin paragraphs and the statements about `CHANGELOG.md` were updated; the counts were not re-measured — they are still those taken at `8e9e73e`, and the code has changed since only in comments, messages and two test files (`notes.test.ts` now asserts over `publishedNotes`; `notes-dark.test.ts` no longer pins a content slug), with no test added or removed, plus the version bump. **Relabelled again 2026-09-30 to v3.8.0** (`release/v3.8.0`, cut from `develop` after #287): the version metadata, the pin paragraphs and the `CHANGELOG.md` statements were updated the same way. The areas #287 touched (`llm.ts`, its tests, the model-chain and env-var docs) were updated in that PR; the counts elsewhere were not re-measured, and the per-area headers keep their original five-fix lists. **Relabelled again 2026-10-01 to v3.9.0** (`release/v3.9.0`, cut from `develop` after #291 and #292): the version metadata, the pin paragraphs and the `CHANGELOG.md` statements were updated the same way. The areas #291 and #292 touched (the chat answer footer, the easter-egg, discovery-badge and Developer-view sections, and the file and test counts they change) were updated in those PRs; the counts elsewhere were not re-measured.

**Method.** Thirteen per-area indexers ran in parallel, each assigned a disjoint slice of the tree and each
required to read every file it claimed before writing about it, to cite `path:line`, to describe only the
current version, to record no reviews or recommendations, and to write exactly one output file. Two
synthesis passes then ran over those thirteen sections: the cross-cutting flow maps
([`14-subsystems.md`](./14-subsystems.md) + [`14b-subsystems.md`](./14b-subsystems.md), one pass split
across two files to stay inside the per-file size budget) and
[`15-invariants-and-gotchas.md`](./15-invariants-and-gotchas.md) (the same material re-cut by blast radius).
This front door is the third synthesis pass.

**Adversarial verification.** Load-bearing claims were re-read against source rather than inherited: the
four test gates named in `CLAUDE.md` § Testing Notes were each checked line by line (two were misstated when
the index was first written, and `CLAUDE.md` now carries the corrections), the `emittedAny` fallback
condition, the card-token regex, the `getServerSnapshot` contract, the `CRON_SECRET` guard and the base-URL
occurrence list were all quoted verbatim from source, and `npx tsc --noEmit` was run once (exit 0) to settle
one open type question. Where a section could not verify something, it says so in its own `## UNVERIFIED`
block, and those items are carried forward unresolved in [14b](./14b-subsystems.md) and
[15](./15-invariants-and-gotchas.md) rather than guessed. Two figures from the original indexing brief (the
dependency counts and the route-file count) were corrected by re-measurement and superseded by the numbers
under "By the numbers".

**What was run, and what was not.** For the 2026-09-29 pass `npx vitest run` was executed (93 files, 817 tests,
all passing) and `node scripts/check-index-citations.mjs` was run against this directory. `pnpm build`,
`pnpm lint`, `pnpm e2e` and `pnpm analyze` were **not** executed, so every other behavioural claim is read from
source, not observed at runtime. Bundle-size and chunk-count figures are the repo's own recorded measurements
(`next.config.ts:153-164`, and the "CURRENT BASELINE" block of `domains/performance/README.md`), not reproduced
here — and both are **Turbopack** measurements, since a bare `next build` in Next 16 is Turbopack, not webpack.
The per-route half of them is no longer trust-only: `scripts/bundle-budget.mjs` re-asserts it on every CI run
(`.github/workflows/ci.yml:190-191`; ceiling `MAX_FIRST_LOAD_BYTES = 1_336_000` at
`scripts/bundle-budget.mjs:72`, route floor `MIN_ROUTES = 17` at `scripts/bundle-budget.mjs:40`, three.js
marker `WebGLRenderer` at `scripts/bundle-budget.mjs:84`).

**Staleness is checked, not trusted.** Every fully-qualified `path:line` citation in this directory (and the
partial-path and unique-basename forms) is fingerprinted into `.citations.json`.
`scripts/check-index-citations.mjs` re-checks those fingerprints as the `Codebase index citations` step of the
`ci` job (`.github/workflows/ci.yml:76-77`). It is **not** part of `pnpm build` or of Vitest: an earlier
vitest wrapper was removed on purpose, because documentation freshness must gate a merge and never a deploy (the
rationale is the comment at `.github/workflows/ci.yml:69-71`), so a stale index fails a PR and can never block a
production build. What blocks: a cited file or line that no longer exists, a citation that points at a blank
line (a new one, or one already blank when fingerprinted), an inverted range (`a-b` with `b < a`), and cited
text that appears nowhere in the file — or only at positions inconsistent with the line shifts observed
elsewhere in it. What only warns: cited text that merely
moved to exactly one other line (the printed offset says where), so line *positions* are reported and not
enforced. `--strict` turns warnings into failures for local sweeps, and `--write` re-fingerprints but refuses
while anything is open. A green run therefore proves the cited text is still in the cited file — not that the
prose describing it is right: the snapshot is regenerated in the same commit as the prose it validates, and
context-relative `(:44)` citations are counted but not checked at all.

```bash
node scripts/check-index-citations.mjs           # verify
node scripts/check-index-citations.mjs --write   # re-fingerprint, after re-pointing every reported line
```

This exists because the honest criticism of a document like this is that it is write-only prose
that decays invisibly — a reader cannot tell a live citation from a dead one. Measured before the
guard existed: one unrelated 530-line change invalidated **33 of 699** citations with no signal at
all. Now that shows up as a red `ci` job with the exact list. Run the script for the live citation count; it
moves with every re-fingerprint.

**Regenerate when** the next release tag is cut from `main`. This index is a *re-pin*, not a regeneration: it
was cut for `release/v3.4.2` and has been re-pinned six times since (v3.5.0, v3.6.0, the 2026-09-29 pass over 297 commits at once, and the v3.7.0, v3.8.0 and v3.9.0 relabels).
The frontmatter reads `v3.9.0` because `package.json` does. On the next release, regenerate the
thirteen area sections, re-run the two synthesis passes and this file, bump the `version:` frontmatter in all
seventeen, then `--write` the fingerprints. Between releases the working tree is authoritative for anything
newer — and the citation check tells you exactly where the index has fallen behind.
