---
kind: doc
title: Cross-cutting subsystem maps (part 1 of 2)
domain: [content]
status: current
version: v3.11.0
---

# Cross-cutting subsystem maps — part 1 of 2

> Part of the Anvilry v3.11.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
> **Baseline:** describes Anvilry v3.11.0 (`package.json` 3.11.0), i.e. `main` at a929932 plus five post-a929932 fixes, each described by behaviour — notes are
> hidden at the data layer when `NOTES_ENABLED` is off; rate limiting has per-class buckets (`chat` / `voice` /
> `beacon`) with an eval-cron bypass, built on `src/lib/cron-auth.ts`; admin auth goes through the shared
> `isAdminAuthorized` (`src/proxy.ts`, `requireAdmin`, the telemetry page); overlay voice entry points are gated
> by `isVoiceViewActive`; the bundle-budget gate asserts `MIN_ROUTES = 17` and dead components were removed.
> Continued in [`14b-subsystems.md`](./14b-subsystems.md) — subsystems 7–10, the cross-subsystem coupling
> table, the entry-point cheat sheet, and the UNVERIFIED ledger for both parts.

**Scope:** the "how the parts connect" layer — **subsystems 1–6 of 10** (content pipeline · view system ·
chat/LLM · voice · MCP · telemetry & observability). Every fact below is sourced from sections 01–13 of this
index (each of which cites its own reads) or from a direct read recorded inline.
**Files indexed:** none — this is a synthesis pass; it maps flows, entry/exit points, failure modes and the
flag/env surface that alters each one, and adds no new file inventory. Every citation below was re-read against
the source at this baseline; where the old text and the code disagreed, the code won.

**Reading convention.** `A → B → C` is data/control flow. `path:line` citations point at the exact
construct. "Entry point" is where an external actor (visitor, crawler, agent, cron, CI) first touches the
subsystem; "exit point" is the last thing the subsystem produces before something else owns the result.

## At a glance

| # | Subsystem | Entry point | Exit point |
|---|---|---|---|
| 1 | Content pipeline | Editing/adding a file under `content/`, then any Velite invocation (`predev`, `pnpm content`, the `build` chain) | Rendered HTML for the four content route trees (`/notes` dark unless `NOTES_ENABLED`); `/decisions`; `/llms.txt`, `/llms-full.txt`, `/feed.xml`, `/sitemap.xml`, `/api/resume.json`; the ten MCP tool responses; the gamified view's `questNodes` |
| 2 | View system (six-member union; 4 server-rendered pills → 5 after hydration on desktop) | `/` only — a `?view=` deep link, a user gesture (`ViewSwitcher`, ⌘K), or a `[[cmd:view:…]]` chat token | The mounted view component's DOM, the rewritten `?view=` query string, the completed view-transition animation |
| 3 | Chat / LLM request path | `useChat.send()` from one of three surfaces, or a direct `POST /api/chat` (the eval cron does exactly this, 12× per run, with the cache-skip header and its cron bearer) | A `text/plain` stream terminated by the trace frame plus `x-anvilry-trace-id` (a first-turn FAQ-cache hit returns the stored answer + trace frame in one body with `X-Chat-Cache: hit`; an exact-tier hit whose entry stored a reasoning summary leads with it in the live thinking framing unless `EXTENDED_THINKING=false`); on the client, sanitized markdown + resolved cards |
| 4 | Voice pipeline | Any of the five doors, all funnelling through `claimVoiceSurface` — except the voice **view**, which enters through `ViewRouter` | Audio from `speechSynthesis` or an `<audio>` object URL; the visible caption and `aria-live` line; the orb's rAF-driven pixels |
| 5 | MCP server | `POST /api/mcp/mcp` (Streamable HTTP; `/api/mcp/sse` is deliberately 404'd by `disableSse: true`) | A JSON-RPC result whose `content[0].text` is pretty-printed JSON, mirrored in `structuredContent` (bare arrays wrapped as `{ items }`), `isError: true` on not-found |
| 6 | Telemetry & observability | Any `/api/*` request wrapped in `withTrace`; any browser error or unhandled rejection; the five cron snapshot writers | A `[trace]` line in Vercel Runtime Logs, a member in `anvilry:trace:<kind>` (eight kinds), the trace-id response header, the `/admin/telemetry` HTML, `replay-trace.mjs` stdout |

## Coverage

**Mapped in this file (6 of 10):** 1. content pipeline · 2. view system · 3. chat/LLM request path ·
4. voice pipeline · 5. MCP server · 6. telemetry & observability.
**Continued in [`14b-subsystems.md`](./14b-subsystems.md):** 7. auth & security surface · 8. feature flags ·
9. 3D / WebGL · 10. build & deploy, plus the cross-subsystem coupling table, the entry-point cheat sheet and
the UNVERIFIED / carried-forward ledger for both parts.
**Synthesized from** sections [01](./01-routes-pages.md)–[13](./13-dependencies-and-versions.md) (each cites
its own reads), plus direct source reads recorded inline: `src/lib/voice-catalog.ts:62,317-320`
(`getDefaultVoiceId`, subsystem 4) and the producer greps over `src/` for `budget.tick`
(`src/lib/telemetry/schema.ts:44` · `src/app/admin/telemetry/page.tsx:414`) and for `tts.request` /
`transcribe.request` (subsystem 6, "Resolved here").

---

## 1. Content pipeline

MDX on disk is the single source of truth for every view, every machine-readable endpoint, and the 3D graph.
Nothing downstream keeps its own copy.

### Flow

```
content/{work,projects,notes,articles}/*.{md,mdx}
   │  velite.config.ts — 4 Zod collections; each .transform() appends `url`
   │  (projects → /projects/<slug>, work → /work/<slug>, notes → /notes/<slug>, articles → /articles/<slug>)
   ▼
.velite/{projects,work,notes,articles}.json + index.d.ts        ← GITIGNORED (.gitignore:45)
   │  imported ONCE, by relative path "../../.velite"  (src/lib/content.ts:5-14)
   ▼
src/lib/content.ts   — sorts, drops drafts, hides notes unless NOTES_ENABLED, derives featured/pinned/inkforge subsets
   │
   ├──────────────┬──────────────┬───────────────┬──────────────┬────────────────────┐
   ▼              ▼              ▼               ▼              ▼                    ▼
game-model.ts   corpus.ts     llms-txt.ts    resume-json.ts   mcp-tools.ts    article-grouping.ts
(+graph-data)   (+profile,    (+profile,     (+profile)       (+profile)      (+writing-flags)
                 personal,     article-
                 testimonials) grouping)
   │              │              │               │              │                    │
   ▼              ▼              ▼               ▼              ▼                    ▼
gamified view   /api/chat     /llms.txt      /api/resume.json  /api/mcp/mcp      /articles,
+ terminal      /llms-full.txt                                 (10 tools)       writing-preview,
(cat/ls/tree)   terminal grep                                                   article-group-card

decisions.ts  ← content.ts (allProjects[].decisions + allWork[].constraints/tradeoffs → one flat `allDecisions` ledger)
   ├─ /decisions page (client component: category + tag filter)
   └─ mcp-tools.ts → list_decisions (the 10th MCP tool)
```

Four route trees (`/work`, `/projects`, `/notes`, `/articles`) consume `content.ts` directly, as do
`sitemap.ts`, `feed.xml/route.ts`, the four `/api/md/*` handlers, the four `<collection>/[slug].md`
handlers, and `command-palette-content.tsx` (47 non-test files import `@/lib/content` at this baseline, counted
by grepping the `from "@/lib/content"` clause — a bare-string grep also matches a comment in `site-nav.tsx`; section 03
carries the list). The `/decisions` page reads only `decisions.ts`.

### Participating files, in flow order

| # | File | Exact role in the flow |
|---|---|---|
| 1 | `content/**/*.{md,mdx}` | Authored frontmatter + MDX body. 5 work, 11 projects, 7 notes, 15 articles. |
| 2 | `velite.config.ts:19-50,53-75,81-106,114-140` | The four Zod collections (project · work · note · article); registered at `:155`. Each ends in a `.transform()` that is the **only** place `url` is created (`:49,74,105,139`). Projects also carry `decisions: s.array(decision).default([])` (`:40`, shape at `:13-17`). |
| 3 | `velite.config.ts:142-157` | Output layout: `root: "content"`, data → `.velite`, assets → `public/static` (base `/static/`), `clean: false` (`:153`), `mdx: { gfm: true }` (`:156`). |
| 4 | `.velite/*.json` + `index.d.ts` | Generated, gitignored. Every Article file is frontmatter-only (empty body); every Note body is compiled MDX. |
| 5 | `src/lib/content.ts:19,21-22,27-29,31-35,44-45,50-59,62-67,73-83` | Copies before sorting (`[...raw]`), `byOrder` ascending. `publishedNotes` (`:50-52`, drafts dropped, newest-first by **ISO string compare**) is read only by the `/notes` route files; every other consumer reads `allNotes` (`:56`), which is `[]` unless `NOTES_ENABLED` — so hiding notes happens **at the data layer**, not per surface. `allArticles` (`:80-83`) drops drafts and, while notes are dark, any article whose only destination is a note (`isNoteOnlyArticle`, `:73-74`). Drafts are excluded here so nothing downstream re-checks `draft`. |
| 6 | `src/lib/game-model.ts:28-50` | `NODE_CONTENT`: 16 graph-node ids → `{kind, slug}`. `resolveNode()` (`:62-71`) returns `null` on a miss; `questNodes` `flatMap`s nulls away (`:96-109`). |
| 7 | `src/lib/graph-data.ts:18-81` | Hand-authored 16 nodes + 19 edges (`graphEdges` `:83-110`) + `kindColor` (`:112-117`). No `Math.random` — build output is stable (`:1-6`); the docblock defers the node count to `graphNodes` instead of hardcoding it (`:3`). |
| 8 | `src/lib/corpus.ts:13-96` | The whole chatbot grounding document as one markdown string: work, projects, skills, achievements, optional personal + testimonials sections, and the `## Writing` notes section (`:75-77`) — which is omitted when `allNotes` is empty (notes dark). Never reads articles. |
| 9 | `src/lib/llms-txt.ts:13-104` | `/llms.txt`. Dedupes articles through `groupArticles` (`:23`), truncates summaries (100/80 chars, `:32,43`), emits a `## Markdown Versions` block (`:88-102`) whose notes list is `(none yet)` while notes are dark. |
| 10 | `src/lib/resume-json.ts:12-71` | jsonresume.org v1.0.0 payload; prefixes `register` into each work summary (`:54`) and stamps `meta.canonical` (`resume-json.ts:69`). |
| 11 | `src/lib/mcp-tools.ts:73-330` | Ten pure tool functions + Zod input shapes + `wrapToolResult`. |
| 12 | `src/lib/article-grouping.ts:51-118` | Two-pass syndication dedup keyed by `linkedNote` or `canonicalUrl` (the per-article key choice is `article-grouping.ts:62`). |
| 13 | `src/lib/decisions.ts:1-76` | Pure derivation: `Project.decisions[]` + `Work.constraints` / `Work.tradeoffs` → flat `allDecisions: LedgerEntry[]` (`:65`), `decisionsByTag` (`:67`). Consumed by `src/app/decisions/page.tsx` and `mcp-tools.ts` (`list_decisions`). Zero duplication of prose; `decisions.test.ts` asserts bidirectional coverage. |

### Entry point

Editing/adding a file under `content/`, then any Velite invocation: `predev` (`package.json:9`, bare
`velite`, no `--clean`), `pnpm content` (`package.json:17`, `velite --clean`), the `build` chain
(`package.json:11`), the local-only `pnpm analyze` (`package.json:12`, also `velite --clean`), or the
dev-only watcher started from inside `next.config.ts:12-16` when `process.argv` contains `"dev"`.

### Exit point

Rendered HTML for the four content route trees (the `/notes` tree only when `NOTES_ENABLED`) and `/decisions`;
`/llms.txt`, `/llms-full.txt`, `/feed.xml`, `/sitemap.xml`, `/api/resume.json`; the ten MCP tool responses;
the gamified view's `questNodes` and dossiers; the terminal's `ls`/`cat`/`tree`/`grep` output.

### Build-order constraints

1. **`velite` must run before anything that compiles.** `.velite/` is gitignored (`.gitignore:45`) but
   `src/lib/content.ts:14` imports it by relative path, so **both** `vitest` and `next build` fail at
   module resolution without it. The chain is `velite --clean && vitest run && next build && pagefind …`
   (`package.json:11`).
2. **`vitest run` sits in the middle so a failing test aborts the deploy** — the `&&` is the gate.
3. **CI mirrors this order:** `pnpm content` runs before `pnpm lint`, `npx tsc --noEmit`, and `pnpm test`
   (`.github/workflows/ci.yml:54-63`). That is the **only** standalone Velite step in CI — the
   second copy lived in `bundle-analysis.yml`, which is **deleted**; the `e2e` job gets
   `.velite/` from the `velite --clean` inside `pnpm build` (`ci.yml:177`).
4. **`predev` deliberately omits `--clean`** and `velite.config.ts:153` sets `clean: false`, because
   `--clean` in dev deletes `.velite/*.json` mid-session and the bundler then fails "Can't resolve
   './projects.json'" (`velite.config.ts:149-152`). The comment's "webpack" is historical wording: in
   Next 16 `next dev` resolves its bundler through the same default as `next build`
   (`node_modules/next/dist/cli/next-dev.js:173` → `node_modules/next/dist/lib/bundler.js:142-144`), so
   the bundler being raced today is Turbopack. The race mechanism — a file vanishing mid-compile — is
   bundler-agnostic. Production purity comes from the explicit `--clean` in the `build`/`content`
   scripts.
5. **`pnpm clean`** (`package.json:19`) deletes `.velite`, so `pnpm content` is mandatory afterwards.

### Failure modes

| Failure | Mechanism |
|---|---|
| Module resolution error in vitest and next build | `.velite/` absent (fresh clone, after `pnpm clean`, or CI without `pnpm content`) — `src/lib/content.ts:14`. |
| **Deploy blocked** — added a content file without a graph node, or vice versa | `src/lib/game-model.test.ts:22-40` (forward), `:42-53` (reverse), `:55-58` (`work + projects === nodes`). Current counts: 16 nodes = 5 work + 11 projects. |
| **Deploy blocked** — invented a dossier fact | `game-model.test.ts:73-100` requires every fact to be a verbatim real metric or a derived count. |
| **Deploy blocked** — a decision entry with no source, or a source field with no entry | `src/lib/decisions.test.ts:16,31` (every populated `decisions[]` / `constraints` / `tradeoffs` has an entry), `:44` (every entry's title and body trace to real content), `:88` (counts line up). `src/lib/case-study-depth.test.ts:38,55` rejects placeholder prose in those fields. |
| Velite drops *every* existing record at once, and the deploy then breaks at `vitest run` | A newly-**required** field on Work/Project. Velite runs non-strict (no `--strict` in any script): it logs `error Required <field>` per file, emits an empty collection and still exits 0, so the failure surfaces in `vitest run` (e.g. `game-model.test.ts`), not at the Velite step. This is why the hiring-depth fields at `velite.config.ts:68-71` are `.optional()` and `decisions` (`:40`) is `.default([])`. |
| Destructured import breaks | Renaming a key in `collections` (`velite.config.ts:155`) renames `.velite/<key>.json`, breaking `src/lib/content.ts:5-14`. |
| Group-name drift (three copies) | `velite.config.ts:4-8` (Zod enum) / `src/lib/content.ts:31-35` (`projectGroups`) / `src/lib/game-model.ts:177-181` (`projectGroupOrder`) hold the same three strings. |
| A project silently disappears from `pinnedProjects` | `pinned: true` without `pinRank` is dropped at `src/lib/content.ts:27-29`. |
| A note leaks while the section is dark | Any consumer reading `publishedNotes` instead of `allNotes` (`src/lib/content.ts:47-52` declares the former, `:54-59` the latter). Only the `/notes` route files may — `generateStaticParams` there needs at least one entry under `cacheComponents` even while the section is dark (`:47-49`). `src/lib/notes-dark.test.ts:25-81` pins that the content layer, `llms.txt`, `feed.xml`, the MCP tools, the chat corpus and both note `.md` handlers publish nothing when `NOTES_ENABLED` is off, and `:83` that turning it on changes nothing else (the on case asserts only the legacy `notes/[slug].md` handler, not `api/md/notes`). |
| Dangling `/notes/<slug>` link | `linkedNote` is a bare `s.string()` with no referential check (`velite.config.ts:133`). At this baseline all 15 articles' `linkedNote` values name a note file that exists, but nothing enforces it — a typo would 404 once `NEXT_PUBLIC_NOTES_ENABLED=true`. While notes are dark, `isNoteOnlyArticle` (`src/lib/content.ts:73-74`) drops every article whose only destination is a note (`:82`) so no article card links to a hidden note (`notes-dark.test.ts:25`). |
| Tied sort order shifts | Project `order` duplicates 5/6/7 and `pinRank` duplicates 4/5 resolve by Velite's file-walk order — the comparators at `src/lib/content.ts:19-22,27-29` are plain numeric. |
| `.md` passthrough 404s in production | `src/app/<collection>/[slug].md/route.ts` and `/api/md/*` read `content/<collection>/<slug>.{mdx,md}` from disk **at request time**, so `content/` must ship in the deployed bundle. The two note handlers 404 by design while notes are dark (they look the slug up in `allNotes`). |
| Corpus loses attribution | `register` is required by Zod (`velite.config.ts:61`) and flows verbatim into `src/lib/corpus.ts:17` and `src/lib/resume-json.ts:54`. |

### Flags / env that alter it

Velite itself reads none. The gates are all downstream, all build-time `NEXT_PUBLIC_*`, all in
`src/lib/writing-flags.ts` (line numbers below are in that file): `ARTICLES_ENABLED` (opt-**out**, default
true, `:19-20`), `NOTES_ENABLED` (opt-**in**, `:22`), `INKFORGE_ARTICLES_ENABLED` (`:49-50`),
`ARTICLE_DEDUP_KEY` (`:78-79`, captured at module load by `src/lib/article-grouping.ts:30`),
`STATS_ENABLED` / `SEARCH_ENABLED` (`:38`, `:40` — nav + sitemap only, **not** route gates),
`TESTIMONIALS_ENABLED` (`:44-45`), `GITHUB_STATS_ENABLED` (`:54-55`). `NOTES_ENABLED` is the one that also
reaches into the data layer: `src/lib/content.ts:15` imports it, which is where notes are actually hidden.

---

## 2. View system (a six-member union; 4 server-rendered pills, 5 after hydration on desktop)

### Flow

```
                            ┌─ SSR / no-JS / crawler ─────────────────────────────┐
GET /?view=chat  ───────────┤ getServerSnapshot() → DEFAULT_VIEW "classic"        │
                            │ (view-context.tsx:91) → HTML is ALWAYS Classic      │
                            └──────────────────┬──────────────────────────────────┘
                                               │ hydrate
                                               ▼
             <ViewQuerySync> (inside its own <Suspense fallback={null}>)
             useSearchParams() → effect → setViewInternal(fromUrl, {updateUrl:false, transition:false})
                                               │  view-context.tsx:236-248
                                               ▼
   MODULE-LEVEL STORE (outside React):  let current  ·  listeners:Set  ·  emit()
                                        view-context.tsx:75, :76, :78
                                               │
                                    useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
                                               │  view-context.tsx:251
                                               ▼
                        ViewProvider context { view, setView }  → useView()
                                               │
                                               ▼
   ViewRouter (view-router.tsx:52)  — the ONLY mount site, from src/app/page.tsx:24
     ├─ Classic  → children, hidden={view!=="classic"}       ← never unmounted
     ├─ chat     → ChatView        ┐
     ├─ gamified → GameView        │ next/dynamic, ssr:false, SkeletonViewTransition fallback,
     ├─ developer→ DeveloperView   │ each additionally gated by isViewEnabled(...)
     ├─ voice    → AnvilView       │ UNMOUNTED when inactive → R3F disposes the WebGL context
     └─ resume   → ResumeView      ┘

   user-initiated switch (ViewSwitcher | ⌘K | terminal NavAction | ViewEscapeHatch):
     setView → setViewInternal (view-context.tsx:174)
        → not on "/"?  router.push("/" or "/?view=X") and STOP — ViewQuerySync applies ?view=X on arrival   :199-202
        → dataset.viewDir = forward|backward                                              :207-210
        → current = view · unlock("view-switch") · history.replaceState                  :211-219
             (?view=X, or param deleted when X === classic)
        → commitViewChange()                                                              :222
        → document.startViewTransition(() => flushSync(emit))     ← flushSync is load-bearing   :141
        → ::view-transition-old/new(view-body) CSS animates
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/components/view-context.tsx:24-35` | `View` is a **six**-member union — `classic \| gamified \| chat \| developer \| voice \| resume`; `VIEWS` mirrors it (`:27-34`); `VIEW_ORDER` (`:38-45`) exists only to compute slide direction. |
| 2 | `src/components/view-context.tsx:75-85` | The store: `let current`, `listeners` Set, `emit()`, `subscribe`. |
| 3 | `src/components/view-context.tsx:90-91` | `getClientSnapshot` returns live `current`; `getServerSnapshot` returns the literal `DEFAULT_VIEW`. |
| 4 | `src/components/view-context.tsx:105-142` | `commitViewChange`: snap branch (reduced motion **or** no `startViewTransition`, `:115-118`), ink branch (`NEXT_PUBLIC_INK_TRANSITION`, `:123-139`), default branch (`:141`). |
| 5 | `src/components/view-context.tsx:174-224` | `setViewInternal`, in order: the off-home `router.push` branch (`:199-202`), `dataset.viewDir` stamp (`:207-210`), `current = view`, `history.replaceState` (`:214-219`), then `commitViewChange()` (`:222`; a deep-link sync passes `transition:false` and just `emit()`s). |
| 6 | `src/components/view-context.tsx:213` | `unlock("view-switch")` — discovery badge #1. |
| 7 | `src/components/view-context.tsx:236-248,261-263` | `ViewQuerySync` + its dedicated `<Suspense>` boundary inside `ViewProvider`. |
| 8 | `src/components/view-context.tsx:151-164,58-66` | `ViewRouterBridge` (module-level `routerBridge` so the non-React `setViewInternal` can `router.push`) and the one-shot `setPendingChatQuery` / `consumePendingChatQuery` hand-off the command palette uses to open Chat with a query. |
| 9 | `src/components/providers.tsx:52-55` | `MotionConfig reducedMotion="user"` → `ViewProvider` → `TooltipProvider` → `ScrollFlagsSync`. |
| 10 | `src/app/page.tsx:24-34` | Server-renders the Classic `<main>` and hands it to `ViewRouter` as `children`. |
| 11 | `src/components/view-router.tsx:56-69` | The `viewTransitionName: "view-body"` wrapper + the six branches. |
| 12 | `src/lib/enabled-views.ts:20-40` | `isViewEnabled()`; `classic` and `resume` are unconditionally true. |
| 13 | `src/components/view-switcher.tsx:75-112` | 4 server-rendered pills; Voice appended only when `mounted && !compact && isViewEnabled("voice")` (`:102-105`). Per-instance `layoutId`, disambiguated by an optional `scope` prop for a third (drawer) render site (`:112`). |
| 14 | `src/components/site-nav.tsx:68,101-106` | `viewTransitionName: "site-header"` (`:68`); the full and compact switcher instances are both in the DOM simultaneously (CSS classes decide which is visible); the third, `scope="drawer"`, is mounted by `mobile-nav.tsx:113`. |
| 15 | `src/app/globals.css:360-402` | The four slide keyframes (`:367-370`), the `[data-view-dir]` selectors (`:373-386`), the `site-header` `animation: none` pin (`:387-392`), and the reduced-motion kill switch (`:396-402`). |
| 16 | `src/components/view-escape-hatch.tsx` | First focusable element of each non-classic view; imported by `chat-view`, `anvil-view`, `game-view`, `developer-view` — **not** by `view-router.tsx`, and not by `resume-view.tsx` (which only mentions it in a comment, `:14`). |

### Entry point

`/` only. `ViewRouter` is imported nowhere else in `src/` (grep-verified, section 01). Three ways in:
a `?view=` deep link (applied post-hydration), a user gesture (`ViewSwitcher`, ⌘K "Switch view",
terminal `classic`/`developer`/`chat`, a `[[cmd:view:<slug>]]` chat token), or `setView("classic")` from
`ViewEscapeHatch` / `AnvilView`'s `onClose`. A gesture fired on any *other* route first navigates to `/`
(`/?view=X`, or bare `/` for Classic) through `ViewRouterBridge` (`view-context.tsx:151-164,199-202`). The store
is a module singleton that an ordinary `<Link>` navigation does not reset, so that branch runs before the
`view === current` early return (`current` can already equal the requested view while the visitor is off-home;
pinned by `view-context.dom.test.tsx:71,90`), and the store flips only after the navigation lands, when
`ViewQuerySync` applies `?view=X` (bare `/` carries no `?view=`, so nothing is applied for Classic).

### Exit point

The mounted view component's DOM, plus the rewritten `?view=` query string and the completed
view-transition animation.

### Failure modes

| Failure | Mechanism |
|---|---|
| Nothing animates on switch | `flushSync(emit)` removed from inside the `startViewTransition` callback (`view-context.tsx:141`). `useSyncExternalStore` emits are batched, so the "after" DOM snapshot is still the old view (`:96-100`). |
| Transition CSS silently dead | Removing `viewTransitionName: "view-body"` (`view-router.tsx:56`) or `"site-header"` (`site-nav.tsx:68`) — the CSS at `globals.css:373-392` keys on those exact names. |
| Sticky nav fades with the body | Deleting the `::view-transition-old/new(site-header) { animation: none }` pin (`globals.css:387-392`). |
| Hydration mismatch / SSG regression | Making `getServerSnapshot` return anything but `DEFAULT_VIEW`. `src/components/view-context.test.ts:30-35` is the guard. (Its sibling test at `:12` is titled "includes the five views" and never asserts `resume` — stale wording, not a gap in the guard.) |
| Whole provider tree forced client-rendered | Moving `useSearchParams()` out of the `ViewQuerySync` leaf — it forces client rendering up to the nearest Suspense boundary (`view-context.tsx:229-234`). |
| Two quick switches from a non-home route push twice | `routerBridge.pathname` is one render behind an in-flight `router.push`, so back-to-back switches can both push — an extra history entry, no lost state. Documented as an accepted narrow race (`view-context.tsx:189-197`). |
| GPU memory leak on low-end mobile | Changing the gamified branch from unmount to `hidden` — a hidden-but-live WebGL context is never disposed (`view-router.tsx:9-24`). |
| `?view=X` silently ignored | `isViewEnabled(X)` false for a build with `NEXT_PUBLIC_ENABLED_VIEWS` restricted; the router stays on Classic (`view-router.tsx:64-69`). |
| One Motion pill animates between multiple switcher instances | Sharing `layoutId` across concurrently-mounted instances without a distinct `scope` — up to three can exist at once (desktop full, top-row compact, drawer compact) since CSS/open-state only controls visibility, not mounting (`view-switcher.tsx:106-112`). |
| `useView` throws | Any consumer outside `<ViewProvider>` (`view-context.tsx:270-274`). |

### Flags / env that alter it

`NEXT_PUBLIC_ENABLED_VIEWS` — comma list; **unset ⇒ all optional views on, empty string ⇒ all optional
views off**, distinguished by `raw === undefined || raw === null` (`src/lib/enabled-views.ts:28`).
`NEXT_PUBLIC_INK_TRANSITION` selects the WebGL2 ink-burn commit path (`view-context.tsx:123-126`).
`prefers-reduced-motion` (OS-level) forces the snap branch (`:106-118`) and is separately enforced in CSS
(`globals.css:396-402`). No cookie, no localStorage — a bare `/` is always Classic by design
(`view-context.tsx:166-173`).

---

## 3. Chat / LLM request path

### Flow

```
CLIENT
 ChatView composer | AskPortfolio widget | TalkMode/AnvilCoreSurface (via useVoiceSession)
   → useChat.send(text, files?)         (use-chat.ts:262 — early-returns while status==="streaming")
   → attachment blocks first, text block LAST; PDFs as "[PDF: name]\n<text>", images as base64
   → fetch POST /api/chat  { AbortController }                            use-chat.ts:305
SERVER  /api/chat  (maxDuration = 60, route.ts:24)
   → withTrace(req, "chat")                                               route.ts:137
   → isConfigured()            ─ false → 503                              :138-143
   → checkRateLimit(req, "chat") ─ deny → 429 + Retry-After              :145-153
         (own `chat` bucket; a valid CRON_SECRET bearer skips it — the eval cron)
   → content-length > 2 MB     ─       → 413                              :155-163
   → req.json() throws         ─       → 400                              :165-170
   → sanitize: slice(-12) MAX_MESSAGES · role filter · MAX_CHARS 600
              · image mediatype allowlist · application/pdf only
              · "[PDF:" text blocks up to 10000 chars                     :26-27,:172-247
   → last message must be role "user"  ─ else → 400                       :249-257
   → ctx.attrs({messageCount, lastMessageLen})   (no prompt text logged)  :267
   → FAQ cache — ONLY a lone first-turn string question with no
     x-chat-skip-cache header                                             :269-363
         faqCacheGet (exact) ?? faqCacheSemanticGet (flag-gated) → emit chat.cache
         HIT  → stored answer + trace frame {cacheHit:true}, X-Chat-Cache: hit; on an exact-tier hit with EXTENDED_THINKING on and a stored summary the body opens THINKING_SENTINEL + summary + THINKING_END (the live framing);
                skips getLiveGithubStats() and streamWithFallback ⇒ zero model spend
         MISS → falls through; onAttempt writes the answer back (below)
   → getLiveGithubStats()  → own /api/github/stats, next.revalidate 3600
                             null on failure ⇒ block omitted from prompt  :34-66,:368
   → system prompt = buildCorpus() + profile + PROJECT_SLUGS/WORK_SLUGS
                     + cache_control { type: "ephemeral", ttl: "1h" }     :83-114,:382-396
                     (live GitHub stats ride in a SEPARATE, uncached system block)
   → streamWithFallback(...)
        modelChain(): provider-dependent (LLM_PROVIDER, default bedrock); buildChain() =
          [primary, Opus only if LLM_USE_OPUS_FALLBACK, Sonnet 4.6, Haiku], repeats dropped llm.ts:102-110
          bedrock: us.anthropic.claude-sonnet-4-6 (or -sonnet-5 if LLM_USE_SONNET_5,
                   global.anthropic.claude-sonnet-5-5 if LLM_USE_SONNET_5_5; 4.6 then behind it)
                   → us.anthropic.claude-haiku-4-5-20251001-v1:0         llm.ts:118-126
          anthropic: claude-sonnet-4-6 (or claude-sonnet-5 / -5-5, 4.6 behind it)
                   → claude-haiku-4-5                                    llm.ts:129-137
        makeClient() INSIDE start() so a ctor failure becomes an apology
                     stream, emitted as model:"client-init", attempt_index:-1  llm.ts:494-514
        per attempt: client.messages.stream() w/ adaptive thinking; 15_000 ms timeout
                     set on the client                                    llm.ts:313,:322,:571
        onAttempt → one llm.attempt span incl. cost_usd from costUsd() llm-pricing.ts:107-119, route.ts:408-450
                  → clean end_turn !fell_back ⇒ void faqCacheSet(..., attempt.reasoningText)     route.ts:452-476
   → WIRE: [THINKING_SENTINEL][reasoning][THINKING_END][answer][TRACE_DELIMITER][JSON]
                                                                          llm-trace.ts:6-9
   → Response(stream, "Cache-Control: no-store")                          route.ts:482-487
     withTrace then re-wraps it and stamps x-anvilry-trace-id             with-trace.ts:202-207
CLIENT
   → read loop → parseAccumulated() → scheduleFlush() → ≤1 commit / animation frame
                 + 250 ms BACKGROUND_FLUSH_MS safety timer for hidden tabs use-chat.ts:93-116,:124,:222-233
   → trailing flushNow(acc) is mandatory                                  use-chat.ts:352-354
   → parseCards(content)  → segments: text | project | work | cmd-view | cmd-highlight
   → slug allowlist: getProject/getWork over Velite output; unresolved → DROPPED
                                                                          parse-cards.ts:29-33,:54-68
   → text segments → MarkdownMessage (react-markdown + skipHtml + rehypeSanitize)
   → project/work  → ChatCard (100% Velite-sourced fields)
   → cmd-*         → NO DOM; dispatched once per settled message only     chat-messages.tsx:322-338
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/components/chat/use-chat.ts` | The one transport for **every** surface: message list, stream read loop, rAF coalescing, thinking-phase timing, abort. |
| 2 | `src/components/chat/chat-view.tsx` / `src/components/ask-portfolio.tsx` / `src/components/chat/use-voice-session.ts` | The three `useChat` call sites. `ask-portfolio.tsx:42` keys the widget by `view` so a view change resets the transcript. |
| 3 | `src/lib/telemetry/with-trace.ts:200-221` | Mints the traceId, stamps `x-anvilry-trace-id` on a **reconstructed** Response that passes `res.body` through so streaming survives; emits exactly one span. |
| 4 | `src/lib/rate-limit.ts:15-17,19-51,95-110` | `RateLimitClass = "chat" \| "voice" \| "beacon"` (declared `:19`, rationale in the docblock `:15-17`); one `slidingWindow(8, "60 s")` limiter **per class** (`:22-23,33-46`) under prefixes `anvilry:chat` / `anvilry:voice` / `anvilry:beacon` (`:25-29`); `cls` is a required argument (`:95-98`). A valid `CRON_SECRET` bearer skips the limiter (`rate-limit.ts:100`, via `hasValidCronSecret`, `src/lib/cron-auth.ts:15-20`). **Fails open** twice over (`rate-limit.ts:99`, `:106-109`). |
| 5 | `src/lib/corpus.ts:13` | Grounding document, rebuilt per request from build-time Velite data. |
| 6 | `src/lib/llm.ts:244-246` | Provider toggle: `LLM_PROVIDER === "anthropic" ? "anthropic" : "bedrock"` — anything else, including unset, is Bedrock. `LLM_USE_SONNET_5 === "true"` (`:45-47`) swaps the primary rung on both chains; `LLM_USE_SONNET_5_5 === "true"` does the same for Sonnet 5.5 (the global Bedrock profile) and wins. |
| 7 | `src/lib/llm.ts:255-265` | `decodeSecret`: base64-vs-raw discrimination by re-encoding the decode and comparing (`:258-260`). |
| 8 | `src/lib/llm.ts:338-358` | `isFallbackEligible`: connection error, 429/404, ≥500, a 400 whose message hits one of six `MODEL_UNAVAILABLE_MARKERS` (`:228-235`), or a 403 that names a per-model deny (those markers or `MODEL_DENIED_MARKERS`). |
| 9 | `src/lib/llm.ts:477,598,691,731,760` | `emittedAny` — declared, then gating THINKING_SENTINEL emission, being set on the first `text_delta`, gating the `answerText` and `reasoningText` fields of the success record (`:723,725`), gating trace-frame emission, and gating fallback. |
| 10 | `src/lib/llm-trace.ts:23-55` | `TRACE_DELIMITER` U+001E, `THINKING_SENTINEL` U+001E U+0001, `THINKING_END` U+001E U+0002, `stripControlBytes` (`:34-38` — applied to every model-generated chunk so a completion can never smuggle in framing bytes), `LlmUsage`, `TraceFrame`. |
| 11 | `src/components/chat/parse-cards.ts:29-33,54-68` | Token grammar with a locked `[a-z0-9-]+` slug charset; every token resolved against the build-time allowlist or dropped. |
| 12 | `src/components/chat/markdown-message.tsx:88-93` | `remarkGfm` + `rehypeSanitize` + `skipHtml`, default `urlTransform` left in place. |
| 13 | `src/components/chat/chat-messages.tsx` | Transcript renderer: thinking block (a replayed FAQ-cache hit arrives at once, so it settles collapsed as "Thought for a moment", `chat-messages.tsx:260`), read-aloud, cmd dispatch, autoscroll, `useChatA11y` live region. |
| 14 | `src/components/chat/chat-card.tsx:12-78` | Renders only Velite fields — the model chooses *which* card, never its contents or href. |
| 15 | `src/lib/chat-cache.ts` / `src/lib/faq-embeddings.ts` | The Upstash-backed FAQ response cache (see the section below). |
| 16 | `src/app/api/admin/faq-cache/purge/route.ts` | Operator remediation: `POST` a question, its cache entry is deleted. `requireAdmin` (Basic auth, `ADMIN_PASSWORD`). |

### Entry point

`useChat.send()` from one of three surfaces; or a direct `POST /api/chat` (the eval cron does exactly
this, 12× per run, `src/app/api/cron/eval/route.ts:115`, sending `X-Chat-Skip-Cache: 1` so it always exercises
the live model and its `Authorization: Bearer ${CRON_SECRET}` so it skips the 8/min limiter).

### Exit point

A `text/plain` byte stream terminated by the trace frame, plus the `x-anvilry-trace-id` header (a FAQ-cache
hit is the same wire format in one non-streamed body, with `X-Chat-Cache: hit`; it opens with the thinking frames only on an exact-tier hit whose entry stored a reasoning summary while `EXTENDED_THINKING` is not `false`, and has none otherwise); on the
client, committed `ChatMessage`s rendered as sanitized markdown + resolved cards.

### The `emittedAny` fallback invariant

`const goingToApology = emittedAny || isLast || !isFallbackEligible(err); ... if (goingToApology)` →
append `apologyTail` and close (`src/lib/llm.ts:759-786`, read directly — as of 2026-09-18 also closes
the thinking phase with `THINKING_END` first if one was open, `:772-781`). Fallback to the next model is possible
**only before any `text_delta` event has been received** — NOT literally "zero bytes sent": `emittedAny` is set unconditionally inside the `text_delta` branch (`:691`), before any content check, so a `text_delta` whose text strips to empty would still set it and suppress any later fallback. Thinking bytes never count either way (`thinking_delta` is a different branch). The load-bearing reason is at `src/lib/llm.ts:360-368`: streaming errors surface
*inside* the `for await` loop, never at the `.stream()` callsite, so connect-time and mid-stream failures
are indistinguishable by call site — whether a `text_delta` has already arrived is the only reliable
discriminator. The same flag also keeps an attempt with no `text_delta` from materialising a trace frame
(`:729-738`). `THINKING_SENTINEL`'s own one-shot behavior is a SEPARATE, stream-scoped guard
(`thinkingSentinelEmitted`, declared `:484`, checked `:598-600`), not `emittedAny` — see `04-lib-ai-voice-infra.md`'s fuller
writeup.

### Telemetry spans emitted on this path

One `http.request` (or `server.error` on an uncaught throw) from `withTrace`; one `llm.attempt` per model
attempt carrying `model`, `attempt_index`, `fell_back`, `ttft_ms`, `latency_ms`, `finish_reason`, `usage`
(snake_case), and `cost_usd` (`src/app/api/chat/route.ts:419-450`). `attempt.error.message` passes
through `redact()` first (`:428`). A request that reached the FAQ-cache check also emits one `chat.cache`
span (`outcome` hit/miss, `tier` exact/semantic/none, and on a hit `saved_usd`, `model`, `reasoning_replayed` (a boolean; the summary text never goes to telemetry, `:337`), plus `similarity` for
the semantic tier — `:317-342`) and stamps `cache_hit` / `cache_tier` on the parent `http.request` span (`:316`).
A cache-layer Redis failure emits its own `server.error` (`attrs.source: "chat-cache"`,
`src/lib/chat-cache.ts:222-240`) so a broken cache is distinguishable from a genuine miss.

### FAQ response cache (first-turn questions)

`src/lib/chat-cache.ts` + `src/lib/faq-embeddings.ts`, wired into `/api/chat` (`src/app/api/chat/route.ts:269-363` read,
`:452-476` write-through). A repeat first-turn question is answered from Upstash with no model call.

- **Eligibility** (`route.ts:284-294`): no `x-chat-skip-cache` header, exactly one message, string content,
  non-blank. Scoped to turn 1 because a later turn can legitimately warrant a different persona/depth
  (`:269-274`). The header needs no auth — skipping only forfeits a saving, it grants nothing (`:275-280`).
- **Key and value:** SHA-256 of the *normalized* question (lowercase, whitespace-collapsed, trailing `?!.,;:`
  stripped by a plain loop, not a regex — `chat-cache.ts:132-148`) under `anvilry:chat:cache:` (`:56`), value
  `{answer, reasoning?, model, costUsd, cachedAt, corpusBuiltAt, embedding?}` (`:97-114`), TTL `FAQ_CACHE_TTL_SECONDS` = 24 h
  (`:67`). No raw question text is stored, but the optional `reasoning` summary is model-written prose that can quote or paraphrase the question: it is kept only for a normalized question of at most `MAX_REASONING_QUESTION_CHARS` = 200 characters (`:95`) and replayed only on an exact-tier hit, as `THINKING_SENTINEL` + summary + `THINKING_END` ahead of the answer unless `EXTENDED_THINKING=false` (`route.ts:309-313,352-353`).
- **Two tiers.** Exact (`faqCacheGet`, `:246`) is on by default; the kill switch is `FAQ_CACHE_ENABLED=false`
  (`isFaqCacheEnabled`, `:158`). Semantic (`faqCacheSemanticGet`, `:278`) is **off** unless
  `FAQ_CACHE_SEMANTIC_MATCH=true` (`:150`): Titan `amazon.titan-embed-text-v2:0`, 512 dims, 5 s timeout
  (`faq-embeddings.ts:20-28`), cosine similarity ≥ 0.92 (`chat-cache.ts:282`) over a capped ZSET index
  `anvilry:chat:cache:index` (`FAQ_CACHE_INDEX_CAP` = 500, `:57,70`). The embedding module is imported
  dynamically, so its AWS SDK cost is paid only when the flag is on. The exact tier normalizes a stored `reasoning` on read (`withReplayableReasoning`, `:181`, built on `replayableReasoning`, `:172`, and applied at `:265`: Redis is a trust boundary, so an unusable value becomes no reasoning); the semantic tier deletes it (`:310-314`) and its hit type is `Omit<FaqCacheEntry, "reasoning">` (`:123`), so a semantic hit can never replay another visitor's wording.
- **Staleness:** every entry is tagged with `anvilry:corpus:built_at` (stamped in production by
  `src/instrumentation.ts:97`, re-stamped with `Date.now()` on EVERY production process start: every cold start or fresh serverless instance, not only a content deploy); a mismatch at read time is a miss (`chat-cache.ts:189-206`), so entries die at each such start. Both-null counts as a
  match, so local dev caches without a deploy stamp.
- **Write gate** (`faqCacheSet`, `:331`): only `finish_reason === "end_turn"`, control bytes stripped, 1–4000
  chars (`MAX_CACHEABLE_ANSWER_CHARS`, `:83`). `answerText` reaches the route only for a clean, complete
  answer (`llm.ts:531,690,723`; `reasoningText`, exactly the `thinking_delta` bytes sent to the client, rides the same record when non-empty and is never emitted to telemetry, `llm.ts:534,671,725`), so an apology tail or a partial answer can never be cached; a clean answer from a fallback rung does reach the route, which declines to write it through (`!attempt.fell_back`, `route.ts:466`), so a transient primary outage is not pinned for 24 h. The sixth parameter `reasoning?` (`:337`) is stored beside the answer only when `replayableReasoning` (`:172`) keeps it (control bytes stripped, trimmed, 1–4000 chars, `MAX_CACHEABLE_REASONING_CHARS`, `:89`) and the normalized question is at most `MAX_REASONING_QUESTION_CHARS` = 200 (`:95`, checked at `:355-358`); otherwise the answer is cached without it, and a summary over 4000 characters is logged by length only (`console.warn`, `:365`). The route passes `attempt.reasoningText` (`route.ts:474`). Index trimming is
  sampled 1-in-20 (`TRIM_SAMPLE_EVERY`, `:76`).
- **Accepted gap:** the gate proves completion cleanliness, not content safety — a jailbreak that finishes with
  `end_turn` would be replayed until TTL, a corpus-build tag change (every production process start re-stamps it), or a purge (`chat-cache.ts:25-32`); the stored reasoning summary is model text too, bounded but not content-checked, and can quote the question (kept for the same TTL, replayed only to the same normalized question).
- **Purge:** `POST /api/admin/faq-cache/purge` (`src/app/api/admin/faq-cache/purge/route.ts:31-74`) →
  `faqCachePurge` (`chat-cache.ts:449`). `requireAdmin` Basic auth; the `/admin/:path*` proxy matcher does
  **not** cover `/api/admin/*`, so the route authenticates itself. 4 KB body cap checked before *and* after
  parse, question ≤ 2000 chars, deliberately not rate-limited.
- **Fail-open:** every function guards `redis === null` and turns a Redis error into a miss (a no-op for
  `faqCacheSet`) plus a `server.error` span (`emitCacheError`, `:222-240`; its message is cut at Upstash's `, command was:` echo, which for a failed SET is the whole entry, and capped at 300 characters, `:212-214`; the purge result's message is cut the same way, `:466`). The one deliberate exception is
  `faqCachePurge`, an operator action: it emits the same span but returns a distinguishable `error` result (also when
  Redis is unconfigured), which the purge route maps to HTTP 503 (`chat-cache.ts:433-436,449-468`;
  `purge/route.ts:70-72`).

### Failure modes

| Failure | Mechanism |
|---|---|
| 503 "Chat is not configured" | `isConfigured()` false — no `BEDROCK_ACCESS_KEY_ID`/`BEDROCK_SECRET_ACCESS_KEY` (or no `ANTHROPIC_API_KEY` under the direct provider). Client copy at `use-chat.ts:312-325`. |
| 429 | The caller's per-IP `chat` budget (8 per 60 s, prefix `anvilry:chat`) is exhausted. Only `/api/chat` charges it; `/api/tts`, `/api/tts-google` and `/api/transcribe` charge the separate `voice` bucket (`anvilry:voice`) and `/api/error` the `beacon` bucket (`anvilry:beacon`), so a burst of per-sentence TTS or an error-beacon loop can no longer 429 the visitor's chat (`rate-limit.ts:15-17`, buckets `:25-29`; call sites `chat/route.ts:147`, `tts/route.ts:69`, `tts-google/route.ts:67`, `transcribe/route.ts:63`, `error/route.ts:101`). `src/lib/rate-limit.test.ts:227,239` pins the isolation. |
| Eval cron self-throttles | It fires 12 sequential chats; without the bypass it would trip the 8/min limit. A valid `Authorization: Bearer ${CRON_SECRET}` skips the limiter (`rate-limit.ts:100`, `hasValidCronSecret` in `cron-auth.ts:15-20`); a wrong or unset secret does not — `rate-limit.test.ts:262` (valid), `:274` (wrong), `:288` (unset). |
| Unbounded spend when Upstash is down | `checkRateLimit` fails open: `{ ok: true }` when unconfigured (`rate-limit.ts:99`) and on any thrown error (`:106-109`). The only signal is a production-only module-load warning (`:62-68`). |
| Wrong `cost_usd` for a new model id | `costUsd()` (`llm-pricing.ts:107-119`) looks the id up in a five-row table (`llm-pricing.ts:57-95`) and returns `null` for any other id, so the `llm.attempt` event carries no `cost_usd` rather than a wrong one; a direct-API id has no row by design. `llm-pricing.test.ts` fails the build when a Bedrock id `modelChain()` can produce has no row. |
| Token telemetry silently zeroes | An SDK returning camelCase usage keys. Pinned by `src/lib/llm.test.ts:309-318`. |
| Region signed wrong in production | `AWS_REGION` is reserved on Vercel and was observed as `"s-east-1"`. Resolution order `BEDROCK_REGION \|\| AWS_REGION \|\| "us-east-1"` (`llm.ts:277-279` explains it; the expression is `:280`) is what shields it. |
| Opus 4.6 400s "model identifier is invalid" | Dropping the `-v1` suffix (`llm.ts:112-114`, chain entry `:123`). |
| Sonnet 5 / Opus 5 400s on extended thinking | Still sending the old `thinking:{type:"enabled",budget_tokens}` shape — deprecated on 4.6, hard-rejected on 5. Must be `thinking:{type:"adaptive"}` + `output_config:{effort:...}` (`llm.ts:547-592`). |
| Reasoning panel stays empty on Sonnet 5.x | Dropping `display: "summarized"` (`adaptiveThinking()`, `llm.ts:215-222`) — the thinking block then has empty text, though the thinking tokens are billed — or lowering the effort to `low` (`thinkingEffort()`, `llm.ts:182-189`), at which Sonnet 5.5 reasoned on 0 of 8 questions in the first probe and 1 of 15 calls in the later matrix (`medium` reasons mostly on the hard ones, `xhigh` on every question). Both pinned by `llm.test.ts` ("thinking a visitor can actually see"). |
| Unsolicited/unframed reasoning bytes in the visible chat | If a model ever defaults thinking ON when the field is omitted (true for Sonnet 5/Opus 5) and the explicit `disabled` send were ever removed, `thinking_delta` bytes would need to stay gated on `useThinking` and `thinkingEndEmitted` (`llm.ts:660`) or they'd stream raw with no `THINKING_SENTINEL`; the `thinkingEndEmitted` half also keeps a late block out of the cached `reasoningText` (`llm.ts:671`). |
| Dropped tail token / frozen background tab | Removing the trailing `flushNow(acc)` (`use-chat.ts:352-354`) or the `BACKGROUND_FLUSH_MS` timer (`:124,:229`). |
| Card fabricated for nonexistent content | Structurally impossible: locked slug charset, build-time allowlist, unresolved tokens dropped. `src/components/chat/parse-cards.test.ts:41-75` is the gate. |
| Model navigates to a view the prompt never offered | The `[[cmd:view:<x>]]` parser accepts every `VIEWS` member (all six, including `resume` — `parse-cards.ts:62`), while the system prompt lists five (`chat/route.ts:109`). Harmless — `ViewRouter` still gates on `isViewEnabled` — but the grammar and the prompt are two separate copies. |
| XSS via streamed markdown | Removing `skipHtml` or overriding `urlTransform` (`markdown-message.tsx:10-16`). |
| Abort loses the partial answer | `AbortError` is treated as a user action — partial kept, suffixed ` …[stopped]` (`use-chat.ts:363-374`); the catch path flushes **before** mutating messages (`:360`). |
| A repeat question replays a stale or unsafe answer | Serving from the FAQ cache is bounded by the 24 h TTL, the corpus-build tag, and the purge route — but a jailbreak that ends `end_turn` passes the write gate. Remedy: `POST /api/admin/faq-cache/purge` with the question text (`chat-cache.ts:449`). |
| Eval cron silently tests the cache instead of the model | Dropping `X-Chat-Skip-Cache` from the cron's request (`eval/route.ts:123`); `route.ts:284` is the only reader. Each side is pinned by its own test (`cron/eval/route.test.ts`, `chat/route.test.ts`), so only a rename of one side together with its own test stays silent. |
| Broken cache looks like a normal miss | Swallowing the Redis error instead of `emitCacheError` (`chat-cache.ts:222-240`) — the `server.error` with `source: "chat-cache"` is the only signal. |

### Flags / env that alter it

`LLM_PROVIDER`, `LLM_USE_SONNET_5`, `LLM_USE_SONNET_5_5`, `LLM_USE_OPUS_FALLBACK`, `LLM_THINKING_EFFORT`, `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`,
`BEDROCK_SESSION_TOKEN`, `BEDROCK_REGION`, `AWS_REGION`, `ANTHROPIC_API_KEY` (the eleven `llm.ts` reads);
`EXTENDED_THINKING` (server, **not** `NEXT_PUBLIC_`-prefixed, default ON, also the switch for replaying a stored reasoning summary on an exact FAQ-cache hit (`route.ts:309-313`); read once at `route.ts:283`);
`NEXT_PUBLIC_EXTENDED_THINKING` (client thinking-block rendering, `chat-messages.tsx:165`);
`NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS` (`chat-view.tsx:259`); `NEXT_PUBLIC_PDF_ATTACHMENTS`
(`file-picker-button.tsx:7`); `FAQ_CACHE_ENABLED` (kill switch, default on) and `FAQ_CACHE_SEMANTIC_MATCH`
(default off) (`chat-cache.ts:150,158`); `CRON_SECRET` (rate-limit bypass for the eval cron);
`UPSTASH_REDIS_REST_URL`/`_TOKEN` (rate limit + FAQ cache + telemetry sink); `VERCEL_URL` (self-fetch base for
the GitHub stats block, `route.ts:39` — unlike the health-check cron, which prefers the production alias via
`probeBase()` (`src/lib/health-expectations.ts:51-59`), this fetch has no SSO-wall handling: on a protected
per-deployment host it fails and the stats block is silently omitted).

---

## 4. Voice pipeline

Fail-closed end to end: every capability defaults **off** and degrades to the browser baseline.

### Flow

```
ENTRY (five doors)
  header orb  ·  Chat-view "Talk"  ·  ⌘K  ·  ?view=voice  ·  wake word ("Hey portfolio")
        │
        ├─ header-orb-trigger.tsx:71-79  routes by BUILD FLAGS × viewport:
        │     ORB_MODE inplace + ≥768px + EXPERIENCE core → openCoreVoice
        │     ORB_MODE inplace + ≥768px + EXPERIENCE classic → openInlineVoice
        │     everything else (mobile, or ORB_MODE modal) → openTalkMode
        │     ORB_MODE off, or STT unsupported → renders null (:63)
        │     isVoiceViewActive(view) → renders DISABLED, open() is a no-op (:68, :71, :85-91)
        ├─ ⌘K "Start voice conversation" → openTalkMode — offered only when STT is supported, the
        │     talk surface is "modal", and !isVoiceViewActive(view)  command-palette-content.tsx:437-439
        ▼
  ONE-MIC MUTEX:  open*() → claimVoiceSurface(id) → force-closes every OTHER registered surface
                  voice-surface-mutex.ts:31,:48-52;  registration at module scope in each store
        ▼
  TalkMode | AnvilInlinePanel(TalkMode autoStart) | AnvilCoreSurface | AnvilView(TalkMode prompts)
        ▼
  useVoiceSession   (state DERIVED every render; only `active` is stored — use-voice-session.ts:81,:248-253)
        │
   LISTEN ──► useStt(settings.sttEngine)                            use-stt.ts:22-28
        │      ├─ useSpeechRecognition  — Web Speech, lang en-US, continuous:FALSE,
        │      │    interimResults, + sibling getUserMedia purely for the OS mic indicator
        │      │                                        use-speech-recognition.ts:161-164,:203
        │      └─ useTranscribeRecognition — getUserMedia → AudioContext →
        │           ScriptProcessor(4096) → Int16 PCM @16 kHz → POST /api/transcribe
        │           (application/octet-stream) → AWS Transcribe Streaming
        │                                        use-transcribe-recognition.ts:34-44,:87-91
        │      degrade rule: transcribe returned only when supported AND !error (use-stt.ts:25-27)
        ▼
   final transcript → session.send() → /api/chat  ── subsystem 3 ──►  streaming answer
        ▼
   SPEAK ──► toCaptionText(content)  (parseCards + strip markdown + strip a dangling "[[card:")
        │                                        use-voice-session.ts:36-63
        │     → tts.speakChunk(fullTextSoFar)   (holds back a trailing partial sentence)
        │                                        use-speech-synthesis.ts:574-576
        │     ├─ browser  → speechSynthesis, ONE utterance per sentence (≤200 chars),
        │     │              desktop-only 12 s pause/resume keep-alive
        │     │                                  use-speech-synthesis.ts:61-89,:254-294
        │     ├─ polly    → POST /api/tts        → AWS Polly (Neural | Generative)
        │     └─ google   → POST /api/tts-google → Chirp 3 HD via REST
        │        remote failure → felledBackRef → browser engine for the rest of the turn (:242-248)
        ▼
   ORB ──► useVoiceLevel(state) writes a smoothed 0..1 into a REF (never React state)
        │                                        use-voice-level.ts:30-100
        └─► VoiceOrb selects: use3D = isDesktop && webgl && !reduced && !glFailed
                              → VoiceOrb3D (R3F, fBm-displaced icosahedron)  voice-orb.tsx:42
                              → else VoiceOrbCanvas (2D canvas; static ring under reduced motion)
        ▼
   speech ends → beginListening() → back to LISTEN                  use-voice-session.ts:219-224
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/components/chat/header-orb-trigger.tsx:35-46,63-91` | Build-time router between the three overlay surfaces; the `?view=voice` exclusion via `isVoiceViewActive` (`:68`). |
| 2 | `src/components/chat/voice-surface-mutex.ts:26-52` | `isVoiceViewActive(view)` (`:27-29`) — the one predicate every overlay entry point (header orb, command palette) gates on; `VoiceSurfaceId = "modal" \| "inline" \| "core"` (`:31`); `claimVoiceSurface` iterates `closers` and invokes every *other* close (`:48-52`). |
| 3 | `src/components/chat/talk-overlay-store.ts` / `anvil-inline-store.ts` / `anvil-core-store.ts` | Three structurally identical module stores; each registers at module scope and calls `claimVoiceSurface` at the top of `open*()`. |
| 4 | `src/components/chat/talk-mode.tsx` | The shared surface UI: orb, captions, controls, first-run primer, Chrome-TTS banner, Space/Esc handling. |
| 5 | `src/components/chat/anvil-inline-panel.tsx` | Non-modal ARIA **disclosure** (not `role="dialog"`), positioned from the orb's `getBoundingClientRect()`, capture-phase outside-click close. |
| 6 | `src/components/chat/anvil-core-surface.tsx` | Orb-only surface; renders raw assistant content through `MarkdownMessage` (`:196`) rather than `toCaptionText`. |
| 7 | `src/components/chat/anvil-view.tsx` | The `?view=voice` view; four hardcoded recruiter `PROMPTS` (`:23-28`) handed to `TalkMode`. |
| 8 | `src/components/chat/use-voice-session.ts` | The half-duplex turn machine. Three side-effect-only effects; unmount teardown via `teardownRef` with empty deps. |
| 9 | `src/components/chat/use-stt.ts` | Engine selector; calls both child hooks unconditionally. |
| 10 | `src/components/chat/use-speech-synthesis.ts` | Per-sentence queue, `remoteTokenRef` invalidation, `felledBackRef` one-way fallback, character knobs. |
| 11 | `src/lib/voice-catalog.ts:61-141,283-294,317-320,350-367` | 6 curated + 12 extended = 18 voices; `getDefaultVoiceId()` returns `JOANNA.id` = `"polly-neural-joanna"` for anything but `"male"` (read directly at `:317-320`, id literal at `:62`); `validateVoiceForEngine` is the server-side allowlist. |
| 12 | `src/lib/voice-settings-context.tsx:77-88,90-158,191` | Persisted prefs as a module store; `STORAGE_KEY = "anvilry:voice:settings"`; `parse` validates field-by-field; `getServerSnapshot` returns `DEFAULTS`. |
| 13 | `src/app/api/tts/route.ts` / `src/app/api/tts-google/route.ts` / `src/app/api/transcribe/route.ts` | The three server engines, all `voice`-bucket rate-limited and fail-closed to a non-2xx. The two TTS engines each keep a 100-entry in-process LRU (`tts/cache.ts:17-18`, Polly keyed by voice **and** tier) and cap the upstream call at 10 s (`tts/route.ts:163`, `tts-google/route.ts:144`); `transcribe` has neither — it is a one-shot 16 kHz PCM buffer (≤ 5 MB, `transcribe/route.ts:31`) fed to AWS Transcribe. |
| 14 | `src/components/chat/wake-word-controller.tsx:29,44-54` | Wake word scoped to `ACTIVE_VIEWS = new Set(["chat"])`; mandatory persistent "Listening" banner. |
| 15 | `src/components/chat/voice-orb.tsx` / `voice-orb-canvas.tsx` / `voice-orb-3d.tsx` | Capability-tiered orb stack; all three `aria-hidden`. |
| 16 | `src/components/chat/voice-pitfalls.ts` | Browser landmine workarounds + the first-run-primer storage key. |

### Entry point

Any of the five doors above. All of them funnel through a store `open*()` (or, for `?view=voice`, through
`ViewRouter`), and therefore through `claimVoiceSurface` — except the voice **view**, which is
deliberately not a mutex participant — a view isn't a closeable overlay, it is mutually exclusive by routing,
and each overlay entry point gates itself instead (`voice-surface-mutex.ts:26-29`; the rationale is in the file's header docblock).

### Exit point

Audio out of `speechSynthesis` or an `<audio>` element fed by an object URL; the visible caption and the
`aria-live` status line; the orb's rAF-driven pixels. Session teardown on unmount stops recognition and
cancels TTS (`use-voice-session.ts:238-244`).

### Every fail-closed default

| Default | Value | Cite |
|---|---|---|
| `micEnabled` | `false` | `voice-settings-context.tsx:78` |
| `ttsEnabled` | `false` | `:79` |
| `wakeWord` | `false` | `:80` |
| `captions` | **`true`** (a11y) | `:81` |
| `sttEngine` | `"browser"` | `:82` |
| `ttsEngine` | `"browser"` | `:83` |
| `talkSurface` | `"modal"` | `:84` |
| `voiceId` | intentionally **omitted** so the catalog default resolves at point of use | `:85-86,150-152` |
| `voiceCharacter` | `{ speed: "natural", tone: "neutral", pause: "normal" }` | `:70-75` |
| Server snapshot | `DEFAULTS` — SSR HTML is always "all off" | `:191` |
| Toggle semantics | Toggles record **intent** only; runtime capability detection always wins | `:19-22` |
| Mic consent | First click with `micEnabled === false` shows a disclosure and does **not** listen | `mic-button.tsx:61-64` |
| Unsupported browser | `MicButton` returns `null`; `TalkMode` renders a "type instead" panel; `HeaderOrbTrigger` returns `null` | `src/components/chat/mic-button.tsx:41` · `src/components/chat/talk-mode.tsx:274-290` · `src/components/chat/header-orb-trigger.tsx:63` |
| Remote TTS/STT failure | Non-2xx is the signal to cascade to the browser engine | `src/app/api/tts/route.ts:29-30` · `src/app/api/transcribe/route.ts:27` |

### Failure modes

| Failure | Mechanism |
|---|---|
| Two live mics at once | A surface opening without `claimVoiceSurface`, `WakeWordController` armed outside `ACTIVE_VIEWS` (`wake-word-controller.tsx:22-29`), or an overlay entry point that skips the `isVoiceViewActive` gate — the header orb (`header-orb-trigger.tsx:68,71`) and the ⌘K "Start voice conversation" item (`command-palette-content.tsx:437-439`, pinned by `command-palette-content.dom.test.tsx:135`). The mutex itself is guarded by `voice-surface-mutex.test.ts:15,35,58`. |
| **Total silence** (documented past bug) | Listing `[recognition, tts]` on `useVoiceSession`'s unmount effect — both are fresh objects every render, so `tts.cancel()` fires on every render (`use-voice-session.ts:226-244`). |
| **Permanent silence** (documented past bug) | Listing `[cancel]` on `useSpeechSynthesis`' visibilitychange/unmount effect — it wipes `spokenCountRef` (`use-speech-synthesis.ts:608-631`). |
| Whole answer re-spoken on settle | Using `speak()` instead of `speakChunk()` in the settle finalizer (`use-voice-session.ts:184-188`). |
| Second answer silent | `resetTurn()` not firing on the turn rising edge (`use-voice-session.ts:176-179`); pinned by `use-speech-synthesis.dom.test.tsx`. |
| 429 storm + duplicate speech | Re-entering the remote path after a fallback — blocked by `felledBackRef` (`use-speech-synthesis.ts:242-248,385,578`). |
| Voice permanently broken in production | `wss://speech.googleapis.com` missing from `connect-src` — Chrome's `SpeechRecognition` opens a cross-origin WebSocket subject to CSP since Chrome 63; every attempt then fails `onerror.error === "network"` (`next.config.ts:56-67`). |
| AWS 5xx from a tier mismatch | Sending a Neural voice with `tier=generative`. `validateVoiceForEngine` (`voice-catalog.ts:350-367`) rejects it; the route accepts no `tier` field at all (`api/tts/route.ts:92-97`). |
| Visitor B hears visitor A's audio | A cache key not varying by voice **and** tier. Pinned by `src/app/api/tts/cache.test.ts`. |
| Self-hearing / echo | Structurally impossible: `continuous = false` (`use-speech-recognition.ts:162`) means the mic is already closed during thinking and speaking; barge-in is a UI interrupt (tap/Space), not voice (`use-voice-session.ts:26-31`). |
| Screen-reader double-speak | `useChatA11y` swaps the answer text for `"Speaking answer aloud."` while TTS owns the audio (`use-chat-a11y.ts:19-23`); the captions block is `aria-hidden={speaking}` (`talk-mode.tsx:363-381`). |
| Raw `[[card:` fragment spoken or shown | `toCaptionText` strips both complete tokens and a dangling mid-stream fragment (`use-voice-session.ts:48-63`). Note `anvil-core-surface.tsx:196` does **not** use it. |
| Transcript text in telemetry | Never emitted — only `audio_bytes`, derived `audio_seconds`, `transcript_chars` (`api/transcribe/route.ts:105-112`). |

### Flags / env that alter it

Build-time: `NEXT_PUBLIC_ANVIL_ORB_MODE` (`inplace \| modal \| off`, default `inplace`),
`NEXT_PUBLIC_ENABLE_ANVIL_ORB` (legacy `"false"` → `off`), `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE`
(`core \| classic`) — all three at `header-orb-trigger.tsx:35-46`; `NEXT_PUBLIC_VOICE_PICKER_MODE`
(`voice-picker-mode.ts:20`); `NEXT_PUBLIC_CHROME_TTS_BANNER` (`writing-flags.ts:92-93`, consumed at
`talk-mode.tsx:349-351`); `NEXT_PUBLIC_VOICE_TEST_AUDIO` (`talk-mode.tsx:494`);
`NEXT_PUBLIC_ORB_POSTPROCESSING` (`voice-orb-3d.tsx:300`, additionally gated on `getDeviceTier() === "high"`).
Server: `GOOGLE_TTS_API_KEY` (`api/tts-google/route.ts:39` — unset ⇒ 503 ⇒ the client speaks the rest of the turn with the browser voice; nothing hides the Google voices from the picker), the Bedrock
credentials reused by Polly/Transcribe via `bedrockCreds` (`api/tts/route.ts:2`,
`api/transcribe/route.ts:6`), and the shared `voice` rate-limit bucket that all three engine routes charge
(`checkRateLimit(req, "voice")`, `api/tts/route.ts:69` · `api/tts-google/route.ts:67` ·
`api/transcribe/route.ts:63`; 8 per 60 s per IP, separate from chat's budget). Runtime, per-visitor: the nine
persisted `voice-settings-context` fields.

---

## 5. MCP server

### Flow

```
MCP client (Claude Desktop via `npx -y mcp-remote`, Cursor via direct HTTP, any agent)
   → GET|POST|DELETE  https://anvilry.vercel.app/api/mcp/mcp
   → src/app/api/mcp/[transport]/route.ts   (maxDuration = 30, :9; no `runtime` export, :6-8)
   → createMcpHandler(server => { 10 × server.registerTool(...) },
                      {},
                      { basePath: "/api/mcp", disableSse: true })          :18-20,:120,:127
   → each tool body → T.wrapToolResult(T.<name>Data(...))  from src/lib/mcp-tools.ts
                      (pure, transport-agnostic)
   → mcp-tools.ts reads @/lib/content (allProjects, allWork, allArticles, allNotes,
                                       getProject, getWork) + @/lib/profile + @/lib/decisions
   → wrapToolResult(data)  →  { content: [{ type:"text", text: JSON.stringify(data,null,2) }],
                      structuredContent: data (a bare array is wrapped as { items: data }),
                      isError: true  ⟸ IFF the payload has a `notFound` key }   mcp-tools.ts:241-251
   → JSON-RPC response over Streamable HTTP
```

### The ten registered tools

| Tool | Input schema | Impl | Not-found |
|---|---|---|---|
| `get_profile` | `{}` | `getProfileData()` `mcp-tools.ts:73` | n/a |
| `list_projects` | `{}` | `listProjectsData()` `:99` | n/a |
| `get_project` | `projectSlugSchema` `:37-39` | `getProjectData()` `:111` | `notFound("project", slug, projectSlugs())` `:113` |
| `list_work` | `{}` | `listWorkData()` `:127` | n/a |
| `get_work` | `workSlugSchema` `:40-42` | `getWorkData()` `:139` | `notFound("work", slug, workSlugs())` `:141` |
| `search_experience` | `searchSchema` `:43-49` | `searchExperienceData()` `:155` | none — `{ query, matches: [], skills: [] }` |
| `get_resume_variant` | `resumeRoleSchema` `:50-54` (enum of `RESUME_ROLES`, currently only `"master"`, `:24`) | `getResumeVariantData()` `:193` | `notFound("resume_variant", role, [...RESUME_ROLES])` `:196` |
| `list_all_content` | `{}` | `listAllContentData()` `:253` | n/a |
| `get_content_item` | `contentTypeSchema` `:228-231` | `getContentItemData()` `:287` | delegates, or `notFound("article"\|"note", …)` `:299`,`:316` |
| `list_decisions` | `decisionsTagSchema` `:205-210` (optional `tag`) | `listDecisionsData()` `:214` — maps `allDecisions` from `src/lib/decisions.ts` to `{sourceKind, sourceName, title, body, tags, url}` | n/a — an unknown tag returns `[]` |

Registration sites: `route.ts:20, 30, 40, 49, 59, 68, 78, 88, 98, 109` (`list_decisions` is the tenth, `:109-118`).
**The count is 10** and every copy of it agrees: the route's own docblock reads "10 read-only tools"
(`src/app/api/mcp/[transport]/route.ts:12`), `CLAUDE.md` (its MCP Server section and Key Files table) says 10 in both places, the hand-written
`TOOLS` table on `/mcp` lists all ten rows (`src/app/mcp/page.tsx:40-60`), and `src/lib/mcp-tools.ts` exports
ten `*Data` functions (`:73,99,111,127,139,155,193,214,253,287`). History: the server grew 7 → 9 at v3.0.0
(`CHANGELOG.md:797-798`) and `/mcp` was brought back in line in v3.5.0 (`CHANGELOG.md:462-464`); the tenth
tool has **no CHANGELOG entry** yet.

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/app/api/mcp/[transport]/route.ts:1,18-130` | Thin transport wiring: ten `registerTool` calls (`:20-118`), the `createMcpHandler` options (`:120-127`), `GET`/`POST`/`DELETE` all bound to the same handler (`:130`). Result wrapping is **not** here — it is `T.wrapToolResult` in `mcp-tools.ts`. |
| 2 | `src/lib/mcp-tools.ts` | Ten pure data functions, six Zod **raw-shape** input schemas (plain objects of `z.*` fields, which is what `registerTool` takes — `:37-54,205-210,228-231`), `notFound()` (`:66-71`), `wrapToolResult` (`:241-251`), `ROLE_TO_LABEL` (`:28-34`), hardcoded `BASE` (`:22`). |
| 3 | `src/lib/content.ts` | The allowlist the tools resolve against; `allNotes` is empty while notes are dark, so `list_all_content` / `get_content_item` expose no note then (`src/lib/notes-dark.test.ts:55`). |
| 4 | `src/lib/profile.ts` | Identity, skills, achievements, `resumeVariants`. |
| 5 | `src/lib/decisions.ts` | Source of `list_decisions` (`allDecisions`, project `decisions[]` + work `constraints`/`tradeoffs`). |
| 6 | `src/app/mcp/page.tsx` | Human-readable docs; `ENDPOINT` constant at `:6`; the `TOOLS` table (`:40-60`) is a hand-maintained duplicate, but it is **enforced** rather than trusted — the comment at `:37-39` points at `src/app/mcp/tools-documented.test.ts`, which set-equality-checks it against the route's `registerTool` calls. |
| 7 | `src/lib/llms-txt.ts:75` | Advertises the server to agents: publishes the working `${BASE}/api/mcp/mcp` (it used to publish the 404'd `/api/mcp/sse`, `CHANGELOG.md:455-458`). |
| 8 | `src/app/api/cron/health-check/route.ts:62` | Probes `/api/mcp/mcp` as a P2 check. The expected status is per-check (`expectedStatus`, `:107`, gated by `isExpectedStatus` at `:109`) and `mcp_get` expects **405**, not 200 (`src/lib/health-expectations.ts:30-32`). |

### Entry point

`POST /api/mcp/mcp` (Streamable HTTP). `/api/mcp/sse` is deliberately 404'd by `disableSse: true`.

### Exit point

A JSON-RPC result whose `content[0].text` is pretty-printed JSON, mirrored in `structuredContent`, with
`isError: true` on a not-found.

### What is deliberately excluded

- **`src/lib/personal.ts` is never imported** — the professional-only boundary is stated at
  `src/lib/mcp-tools.ts:19-21` and asserted by `src/lib/mcp-tools.test.ts:24` ("does NOT leak personal.ts").
- **`getProfileData()` hand-picks fields** rather than spreading `profile`: `links` carries only the public
  profile URLs (github, linkedin, npm, pypi, devto, substack, site); `email` and `calendlyUrl` are not returned
  (`mcp-tools.ts:73-97`).
- **Legacy SSE transport** — `disableSse: true` (`route.ts:127`).
- **`export const runtime`** — removed because `cacheComponents` rejects the export's mere presence
  (`route.ts:6-8`).

### The not-found (`isError`) contract

`notFound()` returns `{ notFound: true, kind, given, valid }` (`mcp-tools.ts:66-71`). `wrapToolResult()`
detects the **literal `notFound` property** and sets `isError: true` (`mcp-tools.ts:242,249`), so the calling
agent receives the list of valid options instead of a fabricated answer. Renaming that field turns every
not-found into a silent success. The same function guards a second contract: MCP requires
`structuredContent` to be an object, and the SDK's runtime validation rejected the bare arrays the
`list_*` / `search_*` tools return on every real call until they were wrapped as `{ items }` (`:243-245`,
pinned by `mcp-tools.test.ts:107`); `content[0].text` keeps the raw array.

### Failure modes

| Failure | Mechanism |
|---|---|
| Unhandled 500 on `/api/mcp/sse` | Removing `disableSse: true` — the `[transport]` segment matches `"sse"`, mcp-handler enters its Redis init and throws `redisUrl is required`, because this project uses Upstash REST, not `REDIS_URL`/`KV_URL` (`route.ts:121-127`). |
| Every not-found reported as success | Renaming the `notFound` key in `mcp-tools.ts` (`:242`). |
| Every array-returning tool errors | Passing a bare array as `structuredContent` instead of `{ items }` (`mcp-tools.ts:243-245`; `mcp-tools.test.ts:107`). |
| `cacheComponents` build failure | Re-adding `export const runtime` (`route.ts:6-8`). |
| `get_resume_variant` silently breaks | Renaming a `resumeVariants[].label` in `profile.ts` — `ROLE_TO_LABEL` (`mcp-tools.ts:28-34`) hardcodes the exact string `"Sairam Resume"` for the only role, `master`. Adding a role needs three edits (the `RESUME_ROLES` keyword, its exact label, the PDF in `public/resume/`) or it returns `notFound` (`:29-33`). `mcp-tools.test.ts:82` asserts every role resolves to a PDF that exists on disk. |
| Tool list drifts from content | `mcp-tools.test.ts:48` asserts `list_projects`/`list_work` cover the whole content layer; `:93` covers `list_decisions`. |
| Agents pointed at a dead endpoint | Publishing the legacy `/api/mcp/sse` path, which `disableSse: true` 404s. `src/lib/llms-txt.ts:75` used to do exactly that; it now advertises `${BASE}/api/mcp/mcp` (`CHANGELOG.md:455-458`), and `src/lib/llms-txt.test.ts:25` pins the live path and `:29` the absence of `/api/mcp/sse`. |
| `/mcp` docs drift | `src/app/mcp/page.tsx:40-60` is hand-maintained, but **guarded**: `src/app/mcp/tools-documented.test.ts:76,81,90` asserts the documented set equals the route's `registerTool` set, and `vitest run` is chained into `pnpm build`, so adding a tool without documenting it fails the build. |
| Health check flaps on MCP | The cron probes `GET /api/mcp/mcp`, which `mcp-handler` answers **405** by itself, so `mcp_get` must expect 405 (`health-expectations.ts:30-32`); `health-expectations.test.ts:27,41` pins it and `:161,173` pin the installed `mcp-handler` behaviour it depends on. |

### Flags / env that alter it

**None of its own.** No flag gates this route, no rate limit applies, no auth, and it is not wrapped in
`withTrace` — MCP traffic emits no `http.request` span and never appears on `/admin/telemetry`. Two indirect
couplings: `NOTES_ENABLED` decides, through `allNotes`, whether `list_all_content` / `get_content_item` expose
any note (`notes-dark.test.ts:55`); and the `@modelcontextprotocol/sdk` exact pin `1.26.0` (`package.json:29`)
is `mcp-handler@1.1.0`'s literal peer requirement (`pnpm-lock.yaml:3711-3712`) and the direct cause of the
`security_update_not_possible` Dependabot state that forced the `overrides` block — twelve pins now, which as
of v3.5.0 live in `pnpm-workspace.yaml:18-43` (the last pin, `qs`, is `:44`), **not** in package.json's `pnpm`
field (pnpm 11 stopped reading it).

---

## 6. Telemetry & observability

### Flow

```
PRODUCERS
  route wrapper:   withTrace(req, "<route>", handler)      → http.request | server.error
  chat route:      onAttempt callback                      → llm.attempt (+ cost_usd)
  chat route:      first-turn FAQ-cache lookup             → chat.cache (hit | miss)
  chat-cache.ts:   Redis failure in get/set/purge          → server.error (source: "chat-cache")
  tts / tts-google / transcribe:  catch blocks             → server.error
  /api/error:      validated browser beacon                → client.error
        │  every producer calls redact() ITSELF — emit does no redaction
        ▼
  src/lib/telemetry/emit.ts  emit(event): void   ← NOT a Promise; never awaited
        │
        ├─ SINK 1 (always, DECLARED SOURCE OF TRUTH)
        │    console.log("[trace]", JSON.stringify(event))            emit.ts:61
        │    → Vercel Runtime Logs · grep handle `[trace]` · permanent
        │    wrapped in try/catch and does NOT early-return, so sink 2 still runs (:57-65)
        │
        └─ SINK 2 (best effort, skipped when `redis` is null)
             ZADD  anvilry:trace:${event.kind}   score = event.ts   member = JSON     emit.ts:70,:76-77
             ZREMRANGEBYSCORE key 0 (event.ts - SEVEN_DAYS_MS)   only when            emit.ts:85-87 (cutoff :72, constant :42)
                 event.ts % TRIM_SAMPLE_EVERY (20) === 0 — a stateless 1-in-20 sample  emit.ts:54,:85
             both promises get explicit .catch() → "[telemetry] redis sink failed"    (:78-83,:88-93)
CONSUMERS
  /admin/telemetry   → 9 top-level reads in one Promise.all (the first fans out one ZRANGE per kind,
                       8); 24 h window; events table capped at 100    page.tsx:493-504,:521
                       auth re-checked in the page (isAdminAuthorized, else notFound())       :470
  make trace TRACE_ID=… → scripts/replay-trace.mjs → 7 hardcoded kinds (no chat.cache) → chronological waterfall
  vercel logs --tail → make logs / logs-llm / logs-flags
CLIENT SIDE
  window "error" / "unhandledrejection"      instrumentation-client.ts:74,:86
  <ErrorBoundary> error.tsx / global-error.tsx
        │  both stamp window.__anvilry_error_recently__ = Date.now() BEFORE beaconing
        ▼
  sendErrorBeacon()  → navigator.sendBeacon("/api/error", Blob{application/json})
                       → fallback fetch(..., { keepalive: true })        beacon.ts:64-98
        ▼
  POST /api/error  → 5 gates → redact(message, stack) → emit({ kind: "client.error" })  → 204
  web-vitals: onLCP/onINP/onCLS → console.info("[vitals"], …)  — NO Redis, NO API route
                                                                instrumentation-client.ts:50-56
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/lib/telemetry/schema.ts:37-50,71-81` | 8 `KIND_LITERALS` (`chat.cache` is the eighth, `:49`); the 9-field envelope with an opaque `attrs` record. |
| 2 | `src/lib/telemetry/schema.ts:88-111,129-136` | `redact()` — email → token(≥32 chars) → digit-run(12–19), **order is load-bearing**; `hashIp(ip, salt)` → 16 hex chars, `"anonymous"` with no salt. |
| 3 | `src/lib/telemetry/with-trace.ts:63-73,148-246` | `clientIp` (**last** XFF segment), traceId mint, session id, `awsRequestIdOf`, response reconstruction, 5xx level escalation, `after()`-scheduled emission, re-throw. |
| 4 | `src/lib/telemetry/emit.ts:42-95` | The dual sink and the 7-day trim (sampled 1-in-20). |
| 5 | `src/lib/redis.ts:26-40` | The singleton; `null` when unconfigured; construction try/caught because the SDK throws a synchronous `UrlError`. |
| 6 | `src/lib/telemetry/beacon.ts:27-98` | The one client egress; `BEACON_URL = "/api/error"` hardcoded because CSP `connect-src 'self'` would block anything else. |
| 7 | `src/instrumentation-client.ts:26-39,46-106` | The 100 ms dedupe contract, both window listeners, the lazy `web-vitals` import. |
| 8 | `src/app/error.tsx:39,54-81` / `src/app/global-error.tsx:34,51-70` | Boundary beacons with distinct `source` values (`"boundary"` / `"global-boundary"`). |
| 9 | `src/app/api/error/route.ts:83,87-184` | The sink route: opt-out gate, rate limit (the `beacon` bucket, `:101`), dual 413, Zod, redaction, 204. |
| 10 | `src/instrumentation.ts:35-105` | Cold-start `[config]` snapshot (presence-only, never secret values) + the production-only `anvilry:corpus:built_at` write. |
| 11 | `src/app/admin/telemetry/page.tsx` | The dashboard; 6 hardcoded snapshot-key literals plus the templated `anvilry:trace:${kind}`; the "saved by caching" tile priced per model via `cacheReadSavingsUsd` from `llm-pricing.ts` (`costSummary`, `:115-133`); snake_case usage reads (`:60-68`); its own Basic-auth re-check (`:470`). |
| 12 | `scripts/replay-trace.mjs:47-108` | The replay CLI; one `zrange` per kind over a 7-day window. |
| 13 | `src/lib/admin-auth.ts` / `src/proxy.ts` / `src/lib/cron-auth.ts` | The two auth gates the telemetry surface sits behind: admin Basic auth (one `isAdminAuthorized` shared by the proxy `:21-35`, `requireAdmin` `:48-50` and the page) and the fail-closed `Bearer ${CRON_SECRET}` check (`hasValidCronSecret` `:15-20`, `unauthorizedUnlessCron` `:23-26`) used by all five cron routes and by the rate limiter's bypass. |

### Entry point

Any `/api/*` request wrapped in `withTrace` (chat, tts, tts-google, transcribe, error); any browser error
or unhandled rejection; the five cron routes that write their own `anvilry:*:latest` snapshots
(`health-check/route.ts:221` · `eval/route.ts:176` · `github-sync/route.ts:53` · `seo-audit/route.ts:66` ·
`content-audit/route.ts:43`; the health check also clears its `anvilry:health:alert:active` flag on recovery,
`health-check/route.ts:216`).

### Exit point

A `[trace]` line in Vercel Runtime Logs (the declared source of truth), a member in
`anvilry:trace:<kind>`, the `x-anvilry-trace-id` response header, the `/admin/telemetry` HTML, and
`replay-trace.mjs` stdout.

### The four grep handles (distinct and load-bearing)

| Handle | Emitted at | Content |
|---|---|---|
| `[config]` | `src/instrumentation.ts:84` | One cold-start snapshot per server process; booleans and safe enums only. |
| `[trace]` | `src/lib/telemetry/emit.ts:61` | Every telemetry span. |
| `[vitals]` | `src/instrumentation-client.ts:52` | LCP / INP / CLS, client-side only. |
| `[flags]` | `src/lib/flags.ts:45` | One line per flag resolution, incl. `driver` and `value`. |

### Failure modes

| Failure | Mechanism |
|---|---|
| Every error double-beacons | Renaming `DEDUPE_FLAG = "__anvilry_error_recently__"` in one of its three homes: `src/app/error.tsx:39`, `src/app/global-error.tsx:34`, `src/instrumentation-client.ts:65-71` (100 ms window). |
| Rate-limit bypass via spoofed header | Taking the **first** `x-forwarded-for` segment instead of the last. All three copies take the last: `src/lib/rate-limit.ts:78`, `src/lib/telemetry/with-trace.ts:71`, and `src/app/api/visit/route.ts:34` — the third was the odd one out (it took the leftmost segment and carried a comment asserting that was correct), and it was **fixed in v3.5.0** (`CHANGELOG.md:487-492`). It was never exploitable in production: the counter is flag-off by default, the handler returns early on absent Redis before `clientIp` (`:25`) runs, and `x-vercel-forwarded-for` is checked first. Pinned two ways — `src/lib/telemetry/with-trace.test.ts:220-230` for the telemetry copy, and `src/lib/client-ip-consistency.test.ts:140` for every copy, which **discovers** `clientIp` bodies under `src/` rather than assuming a fixed three (`:101,118`) and rejects `.reverse().pop()` / `.slice(0,1).pop()` look-alikes (`:59-69`). |
| Secrets in the trace log | A producer emitting without `redact()` first — `emit` does none (`emit.ts:30-35`). `src/app/api/error/route.test.ts:226-263` pins redact-before-emit. `componentStack` is deliberately **not** redacted (React-internal, `api/error/route.ts:147-165`). |
| Retention stops trimming | The trim is piggybacked on writes **and** sampled: it runs only when `event.ts % 20 === 0` (`emit.ts:54,85-87`), so a kind that stops receiving events is never trimmed again, and even a busy kind is trimmed on ~5% of writes (each cheap `ZADD` is unconditional; the `ZREMRANGEBYSCORE` is what was cut to spare Upstash's command quota). |
| Telemetry failure becomes request failure | Removing a `.catch()` from either Redis promise, or awaiting `emit` (it returns `void` by design, `emit.ts:25-35,56`). |
| Streaming chat buffered | Not passing `res.body` through when reconstructing the Response (`with-trace.ts:200-207`). |
| TTFB regression | Calling `emit` synchronously instead of via the lazy `require("next/server").after` (`with-trace.ts:7-17,212-213`). |
| Errors swallowed instead of observed | `withTrace` re-throws after emitting — "an OBSERVER; never a SWALLOWER" (`with-trace.ts:244-246`). |
| Beacon recursion | Removing the `.catch()` from the keepalive `fetch` fallback — an unhandled rejection re-fires `unhandledrejection` straight back into `sendErrorBeacon` (`beacon.ts:85-95`). |
| `sendBeacon` silently refuses the body | Passing a raw string instead of a `Blob` of type `application/json` (`beacon.ts:72,77-80`). |
| Legitimate beacon 400s | The `source` enum at `api/error/route.ts:83` drifting from `ErrorBeaconPayload` in `beacon.ts:42`. |
| Oversized body still read | Removing the **post-read** 413 backstop (`api/error/route.ts:131-133`) — `sendBeacon` does not always send `Content-Length`, so the header-only gate is bypassable. |
| Dashboard tile goes blank | A cron route writing a different key than the snapshot literals hardcoded in `src/app/admin/telemetry/page.tsx` (`anvilry:eval:latest` `:244`, `anvilry:github:stats:latest` `:278`, `anvilry:seo:audit:latest` `:281`, `anvilry:content:audit:latest` `:284`, `anvilry:health:latest` `:287`, `anvilry:corpus:built_at` `:293`; the trace key is templated at `:29`). |
| TTS / transcribe latency tiles are always empty | No code emits `tts.request` or `transcribe.request` (see "Resolved here"); the tiles read kinds nobody writes (`page.tsx:495-496,532-533`). |
| Preview deploys pollute the corpus timestamp | Gating on `NODE_ENV` instead of `VERCEL_ENV === "production"` — Vercel previews also run `NODE_ENV=production` (`instrumentation.ts:87-92`). |
| Replay CLI silently drops every event | Reintroducing `JSON.parse(member)`: `@upstash/redis` has `automaticDeserialization=true`, so members return as objects and the parse coerces to `"[object Object]"` and throws (`scripts/replay-trace.mjs:65-68`). |
| New span kind invisible in replay | `KINDS` is hardcoded (`replay-trace.mjs:47-55`); `KIND_LITERALS` and the dashboard filter must also be updated (`schema.ts:36-37`). `chat.cache` is already in that state — it is in `KIND_LITERALS` and the dashboard but not in `KINDS`, so `make trace` never shows a cache lookup. |

### Flags / env that alter it

`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (both or neither — sink 2 and the whole dashboard);
`TELEMETRY_IP_SALT` (unset ⇒ every IP stored as `"anonymous"`, `with-trace.ts:157`);
`TELEMETRY_ENABLED` — **opt-out, and only the exact string `"false"`**, read at exactly one place,
`src/app/api/error/route.ts:92` (`.env.example:147` used to describe it as disabling "all event emission",
which is broader than the single read; it and the `TELEMETRY_ENABLED` row of `docs/configuration.md` now state
the narrow, beacon-only behaviour); `ADMIN_PASSWORD` (Basic auth for
`/admin/*` — checked first by `src/proxy.ts:21-35` and again by the page `:470`; unset ⇒ locked out for
everyone, `admin-auth.ts:24-31`; it also gates `POST /api/admin/faq-cache/purge` through `requireAdmin`);
`VERCEL_ENV` (corpus timestamp gate); `CRON_SECRET` (bearer for the five cron routes, `vercel.json:3-7`, all
through the shared fail-closed `unauthorizedUnlessCron`; the same bearer skips the rate limiter for the eval
cron).

### Resolved here

`budget.tick` is declared in `KIND_LITERALS` (`src/lib/telemetry/schema.ts:44`), asserted by
`src/lib/telemetry/schema.test.ts:151`, and consumed by the dashboard's `case "budget.tick"`
(`src/app/admin/telemetry/page.tsx:414`) — but a grep of `src/` for `budget.tick` returns only those
four sites (`schema.ts:60` is a docblock mention; `scripts/replay-trace.mjs:54` lists it in `KINDS`).
**No producer emits it at v3.11.0.** (Section 04 left this open; resolved by direct grep.)

`tts.request` and `transcribe.request` are in the same state, which the earlier pass missed: declared
(`schema.ts:40-41`), fetched by the dashboard (`page.tsx:495-496`, feeding the two latency tiles at
`:534-535`) and listed in `replay-trace.mjs:50-51`, yet no `emit({ kind: "tts.request" | "transcribe.request" })`
exists in `src/`. The per-request facts (`voiceId`, `char_count`, `cache_hit`, `audio_bytes`, …) are attached to
the route's `http.request` span with `ctx.attrs(...)` instead (`api/tts/route.ts:119,145,168`,
`api/tts-google/route.ts:117,189,201`, `api/transcribe/route.ts:107`); only failures get their own span, as
`server.error`. The span-kinds table in `TELEMETRY.md` records both kinds as never emitted.
