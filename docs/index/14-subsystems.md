---
kind: doc
title: Cross-cutting subsystem maps (part 1 of 2)
domain: [content]
status: current
version: v3.4.2
---

# Cross-cutting subsystem maps — part 1 of 2

> Part of the Anvilry v3.4.2 codebase index. Master entry point: [docs/index/README.md](./README.md)
> Continued in [`14b-subsystems.md`](./14b-subsystems.md) — subsystems 7–10, the cross-subsystem coupling
> table, the entry-point cheat sheet, and the UNVERIFIED ledger for both parts.

**Scope:** the "how the parts connect" layer — **subsystems 1–6 of 10** (content pipeline · view system ·
chat/LLM · voice · MCP · telemetry & observability). Every fact below is sourced from sections 01–13 of this
index (each of which cites its own reads) or from a direct read recorded inline.
**Files indexed:** none — this is a synthesis pass; it maps flows, entry/exit points, failure modes and the
flag/env surface that alters each one, and adds no new file inventory.

**Reading convention.** `A → B → C` is data/control flow. `path:line` citations point at the exact
construct. "Entry point" is where an external actor (visitor, crawler, agent, cron, CI) first touches the
subsystem; "exit point" is the last thing the subsystem produces before something else owns the result.

## At a glance

| # | Subsystem | Entry point | Exit point |
|---|---|---|---|
| 1 | Content pipeline | Editing/adding a file under `content/`, then any Velite invocation (`predev`, `pnpm content`, the `build` chain) | Rendered HTML for the four content route trees; `/llms.txt`, `/llms-full.txt`, `/feed.xml`, `/sitemap.xml`, `/api/resume.json`; the nine MCP tool responses; the gamified view's `questNodes` |
| 2 | View system (six-member union; 4 server-rendered pills → 5 after hydration on desktop) | `/` only — a `?view=` deep link, a user gesture (`ViewSwitcher`, ⌘K), or a `[[cmd:view:…]]` chat token | The mounted view component's DOM, the rewritten `?view=` query string, the completed view-transition animation |
| 3 | Chat / LLM request path | `useChat.send()` from one of three surfaces, or a direct `POST /api/chat` (the eval cron does exactly this, 12× per run) | A `text/plain` stream terminated by the trace frame plus `x-anvilry-trace-id`; on the client, sanitized markdown + resolved cards |
| 4 | Voice pipeline | Any of the five doors, all funnelling through `claimVoiceSurface` — except the voice **view**, which enters through `ViewRouter` | Audio from `speechSynthesis` or an `<audio>` object URL; the visible caption and `aria-live` line; the orb's rAF-driven pixels |
| 5 | MCP server | `POST /api/mcp/mcp` (Streamable HTTP; `/api/mcp/sse` is deliberately 404'd by `disableSse: true`) | A JSON-RPC result whose `content[0].text` is pretty-printed JSON, mirrored in `structuredContent`, `isError: true` on not-found |
| 6 | Telemetry & observability | Any `/api/*` request wrapped in `withTrace`; any browser error or unhandled rejection; the five cron snapshot writers | A `[trace]` line in Vercel Runtime Logs, a member in `anvilry:trace:<kind>`, the trace-id response header, the `/admin/telemetry` HTML, `replay-trace.mjs` stdout |

## Coverage

**Mapped in this file (6 of 10):** 1. content pipeline · 2. view system · 3. chat/LLM request path ·
4. voice pipeline · 5. MCP server · 6. telemetry & observability.
**Continued in [`14b-subsystems.md`](./14b-subsystems.md):** 7. auth & security surface · 8. feature flags ·
9. 3D / WebGL · 10. build & deploy, plus the cross-subsystem coupling table, the entry-point cheat sheet and
the UNVERIFIED / carried-forward ledger for both parts.
**Synthesized from** sections [01](./01-routes-pages.md)–[13](./13-dependencies-and-versions.md) (each cites
its own reads), plus two direct source reads recorded inline: `src/lib/voice-catalog.ts:62,317-320`
(`getDefaultVoiceId`, subsystem 4) and the `budget.tick` producer grep over `src/`
(`src/lib/telemetry/schema.ts:44` · `src/app/admin/telemetry/page.tsx:376`, subsystem 6).

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
src/lib/content.ts   — sorts, drops drafts, derives featured/pinned/inkforge subsets
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
+ terminal      /llms-full.txt                                 (9 tools)        writing-preview,
(cat/ls/tree)   terminal grep                                                   article-group-card
```

Four route trees (`/work`, `/projects`, `/notes`, `/articles`) consume `content.ts` directly, as do
`sitemap.ts`, `feed.xml/route.ts`, the four `/api/md/*` handlers, the four `<collection>/[slug].md`
handlers, and `command-palette.tsx` (~44 non-test importers in total, per section 03).

### Participating files, in flow order

| # | File | Exact role in the flow |
|---|---|---|
| 1 | `content/**/*.{md,mdx}` | Authored frontmatter + MDX body. 5 work, 11 projects, 5 notes, 15 articles. |
| 2 | `velite.config.ts:11-31,34-56,62-85,93-112` | The four Zod collections; registered at `:127`. Each ends in a `.transform()` that is the **only** place `url` is created. |
| 3 | `velite.config.ts:115-128` | Output layout: `root: "content"`, data → `.velite`, assets → `public/static` (base `/static/`), `clean: false` (`:125`), `mdx: { gfm: true }` (`:128`). |
| 4 | `.velite/*.json` + `index.d.ts` | Generated, gitignored. Every Article body is `""`; every Note body is compiled MDX. |
| 5 | `src/lib/content.ts:18-21,23,26-28,30-34,43-44,48-71` | Copies before sorting (`[...raw]`), `byOrder` ascending, notes/articles newest-first by **ISO string compare**, drafts excluded here so nothing downstream re-checks `draft`. |
| 6 | `src/lib/game-model.ts:28-50` | `NODE_CONTENT`: 16 graph-node ids → `{kind, slug}`. `resolveNode()` (`:62-71`) returns `null` on a miss; `questNodes` `flatMap`s nulls away (`:96-109`). |
| 7 | `src/lib/graph-data.ts:18-41` | Hand-authored 16 nodes + 19 edges (`graphEdges` `:43-70`) + `kindColor` (`:72-77`). No `Math.random` — build output is stable (`:1-6`); the docblock now defers the node count to `graphNodes` instead of hardcoding it (`:3`). |
| 8 | `src/lib/corpus.ts:13-76` | The whole chatbot grounding document as one markdown string. Reads work/projects/**notes** — never articles. |
| 9 | `src/lib/llms-txt.ts:12-79` | `/llms.txt`. Dedupes articles through `groupArticles` (`:22`), truncates summaries (100/80 chars), emits a `## Markdown Versions` block (`:68-79`). |
| 10 | `src/lib/resume-json.ts:12-45` | jsonresume.org v1.0.0 payload; prefixes `register` into each work summary (`:30`). |
| 11 | `src/lib/mcp-tools.ts:50-175` | Nine pure tool functions + Zod input shapes. |
| 12 | `src/lib/article-grouping.ts:62-117` | Two-pass syndication dedup keyed by `linkedNote` or `canonicalUrl`. |

### Entry point

Editing/adding a file under `content/`, then any Velite invocation: `predev` (`package.json:6`, bare
`velite`, no `--clean`), `pnpm content` (`package.json:13`, `velite --clean`), the `build` chain
(`package.json:8`), or the dev-only watcher started from inside `next.config.ts:12-16` when
`process.argv` contains `"dev"`.

### Exit point

Rendered HTML for the four content route trees; `/llms.txt`, `/llms-full.txt`, `/feed.xml`,
`/sitemap.xml`, `/api/resume.json`; the nine MCP tool responses; the gamified view's `questNodes` and
dossiers; the terminal's `ls`/`cat`/`tree`/`grep` output.

### Build-order constraints

1. **`velite` must run before anything that compiles.** `.velite/` is gitignored (`.gitignore:45`) but
   `src/lib/content.ts:14` imports it by relative path, so **both** `vitest` and `next build` fail at
   module resolution without it. The chain is `velite --clean && vitest run && next build`
   (`package.json:8`).
2. **`vitest run` sits in the middle so a failing test aborts the deploy** — the `&&` is the gate.
3. **CI mirrors this order:** `pnpm content` runs before `pnpm lint`, `npx tsc --noEmit`, and `pnpm test`
   (`.github/workflows/ci.yml:43-53`), and again in `bundle-analysis.yml:50-51`.
4. **`predev` deliberately omits `--clean`** and `velite.config.ts:125` sets `clean: false`, because
   `--clean` in dev races webpack into "Can't resolve './projects.json'" (`velite.config.ts:121-124`).
   Production purity comes from the explicit `--clean` in the `build`/`content` scripts.
5. **`pnpm clean`** (`package.json:14`) deletes `.velite`, so `pnpm content` is mandatory afterwards.

### Failure modes

| Failure | Mechanism |
|---|---|
| Module resolution error in vitest and next build | `.velite/` absent (fresh clone, after `pnpm clean`, or CI without `pnpm content`) — `src/lib/content.ts:14`. |
| **Deploy blocked** — added a content file without a graph node, or vice versa | `src/lib/game-model.test.ts:22-40` (forward), `:42-53` (reverse), `:55-58` (`work + projects === nodes`). Current counts: 16 nodes = 5 work + 11 projects. |
| **Deploy blocked** — invented a dossier fact | `game-model.test.ts:73-101` requires every fact to be a verbatim real metric or a derived count. |
| Velite build fails for *every* existing file at once | A newly-**required** field on Work/Project. This is why the hiring-depth fields at `velite.config.ts:49-52` are `.optional()`. |
| Destructured import breaks | Renaming a key in `collections` (`velite.config.ts:127`) renames `.velite/<key>.json`, breaking `src/lib/content.ts:5-14`. |
| Group-name drift (three copies) | `velite.config.ts:4-8` (Zod enum) / `src/lib/content.ts:30-34` (`projectGroups`) / `src/lib/game-model.ts:177-181` (`projectGroupOrder`) hold the same three strings. |
| A project silently disappears from `pinnedProjects` | `pinned: true` without `pinRank` is dropped at `src/lib/content.ts:26-28`. |
| Dangling `/notes/<slug>` link | `linkedNote` is a bare `s.string()` with no referential check (`velite.config.ts:105`). Three articles point at nonexistent notes: `tombstone-v1-2-devto` → `tombstone-v1-2-release`; `trelix-v1-launch-devto` and `-substack` → `trelix-code-intelligence-engine`. Only reachable once `NEXT_PUBLIC_NOTES_ENABLED=true`. |
| Tied sort order shifts | `order` duplicates 5/6/7 and `pinRank` duplicates 4/5 resolve by Velite's file-walk order — the comparators at `src/lib/content.ts:18-21,26-28` are plain numeric. |
| `.md` passthrough 404s in production | `src/app/<collection>/[slug].md/route.ts` and `/api/md/*` read `content/<collection>/<slug>.{mdx,md}` from disk **at request time**, so `content/` must ship in the deployed bundle. |
| Corpus loses attribution | `register` is required by Zod (`velite.config.ts:42`) and flows verbatim into `src/lib/corpus.ts:17` and `src/lib/resume-json.ts:30`. |

### Flags / env that alter it

Velite itself reads none. The gates are all downstream, all build-time `NEXT_PUBLIC_*`:
`ARTICLES_ENABLED` (opt-**out**, default true, `src/lib/writing-flags.ts:20`), `NOTES_ENABLED`
(`:23`), `INKFORGE_ARTICLES_ENABLED` (`:44`), `ARTICLE_DEDUP_KEY` (`:72`, captured at module load by
`src/lib/article-grouping.ts:30`), `STATS_ENABLED`/`SEARCH_ENABLED` (`:31`,`:34` — nav + sitemap only,
**not** route gates), `TESTIMONIALS_ENABLED` (`:39`), `GITHUB_STATS_ENABLED` (`:49`).

---

## 2. View system (a six-member union; 4 server-rendered pills, 5 after hydration on desktop)

### Flow

```
                            ┌─ SSR / no-JS / crawler ─────────────────────────────┐
GET /?view=chat  ───────────┤ getServerSnapshot() → DEFAULT_VIEW "classic"        │
                            │ (view-context.tsx:65) → HTML is ALWAYS Classic      │
                            └──────────────────┬──────────────────────────────────┘
                                               │ hydrate
                                               ▼
             <ViewQuerySync> (inside its own <Suspense fallback={null}>)
             useSearchParams() → effect → setViewInternal(fromUrl, {updateUrl:false, transition:false})
                                               │  view-context.tsx:162-173, :181-183
                                               ▼
   MODULE-LEVEL STORE (outside React):  let current  ·  listeners:Set  ·  emit()
                                        view-context.tsx:49, :50, :52
                                               │
                                    useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
                                               │  view-context.tsx:176
                                               ▼
                        ViewProvider context { view, setView }  → useView()
                                               │
                                               ▼
   ViewRouter (view-router.tsx:52)  — the ONLY mount site, from src/app/page.tsx:26
     ├─ Classic  → children, hidden={view!=="classic"}       ← never unmounted
     ├─ chat     → ChatView        ┐
     ├─ gamified → GameView        │ next/dynamic, ssr:false, SkeletonViewTransition fallback,
     ├─ developer→ DeveloperView   │ each additionally gated by isViewEnabled(...)
     ├─ voice    → AnvilView       │ UNMOUNTED when inactive → R3F disposes the WebGL context
     └─ resume   → ResumeView      ┘

   user-initiated switch (ViewSwitcher | ⌘K | terminal NavAction | ViewEscapeHatch):
     setView → setViewInternal → dataset.viewDir = forward|backward → commitViewChange
        → document.startViewTransition(() => flushSync(emit))     ← flushSync is load-bearing
        → ::view-transition-old/new(view-body) CSS animates
        → history.replaceState (?view=X, or param deleted when X === classic)
        → unlock("view-switch")
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/components/view-context.tsx:24-26` | `View` is a **six**-member union — `classic \| gamified \| chat \| developer \| voice \| resume`; `VIEWS` mirrors it; `VIEW_ORDER` (`:30-37`) exists only to compute slide direction. |
| 2 | `src/components/view-context.tsx:49-59` | The store: `let current`, `listeners` Set, `emit()`, `subscribe`. |
| 3 | `src/components/view-context.tsx:64-65` | `getClientSnapshot` returns live `current`; `getServerSnapshot` returns the literal `DEFAULT_VIEW`. |
| 4 | `src/components/view-context.tsx:79-116` | `commitViewChange`: snap branch (reduced motion **or** no `startViewTransition`), ink branch (`NEXT_PUBLIC_INK_TRANSITION`), default branch. |
| 5 | `src/components/view-context.tsx:133-145` | Stamps `document.documentElement.dataset.viewDir`, then `history.replaceState`. |
| 6 | `src/components/view-context.tsx:139` | `unlock("view-switch")` — discovery badge #1. |
| 7 | `src/components/view-context.tsx:162-173,181-183` | `ViewQuerySync` + its dedicated `<Suspense>` boundary. |
| 8 | `src/components/providers.tsx:51-53` | `MotionConfig reducedMotion="user"` → `ViewProvider` → `ScrollFlagsSync`. |
| 9 | `src/app/page.tsx:26-37` | Server-renders the Classic `<main>` and hands it to `ViewRouter` as `children`. |
| 10 | `src/components/view-router.tsx:56-69` | The `viewTransitionName: "view-body"` wrapper + the six branches. |
| 11 | `src/lib/enabled-views.ts:20-40` | `isViewEnabled()`; `classic` and `resume` are unconditionally true. |
| 12 | `src/components/view-switcher.tsx:16-42` | 4 server-rendered pills; Voice appended only when `mounted && !compact && isViewEnabled("voice")` (`:38`). Per-instance `layoutId` (`:42`). |
| 13 | `src/components/site-nav.tsx:40,66-71` | `viewTransitionName: "site-header"`; both switcher instances live in the DOM simultaneously. |
| 14 | `src/app/globals.css:257-299` | The four slide keyframes, the `[data-view-dir]` selectors, the `site-header` `animation: none` pin, and the reduced-motion kill switch. |
| 15 | `src/components/view-escape-hatch.tsx` | First focusable element of each non-classic view; imported by `chat-view`, `anvil-view`, `game-view`, `developer-view` — **not** by `view-router.tsx`. |

### Entry point

`/` only. `ViewRouter` is imported nowhere else in `src/` (grep-verified, section 01). Three ways in:
a `?view=` deep link (applied post-hydration), a user gesture (`ViewSwitcher`, ⌘K "Switch view",
terminal `classic`/`developer`/`chat`, a `[[cmd:view:<slug>]]` chat token), or `setView("classic")` from
`ViewEscapeHatch` / `AnvilView`'s `onClose`.

### Exit point

The mounted view component's DOM, plus the rewritten `?view=` query string and the completed
view-transition animation.

### Failure modes

| Failure | Mechanism |
|---|---|
| Nothing animates on switch | `flushSync(emit)` removed from inside the `startViewTransition` callback (`view-context.tsx:115`). `useSyncExternalStore` emits are batched, so the "after" DOM snapshot is still the old view (`:70-77`). |
| Transition CSS silently dead | Removing `viewTransitionName: "view-body"` (`view-router.tsx:56`) or `"site-header"` (`site-nav.tsx:40`) — the CSS at `globals.css:270-289` keys on those exact names. |
| Sticky nav fades with the body | Deleting the `::view-transition-old/new(site-header) { animation: none }` pin (`globals.css:284-289`). |
| Hydration mismatch / SSG regression | Making `getServerSnapshot` return anything but `DEFAULT_VIEW`. `src/components/view-context.test.ts:30-34` is the guard. |
| Whole provider tree forced client-rendered | Moving `useSearchParams()` out of the `ViewQuerySync` leaf — it forces client rendering up to the nearest Suspense boundary (`view-context.tsx:155-160`). |
| GPU memory leak on low-end mobile | Changing the gamified branch from unmount to `hidden` — a hidden-but-live WebGL context is never disposed (`view-router.tsx:9-24`). |
| `?view=X` silently ignored | `isViewEnabled(X)` false for a build with `NEXT_PUBLIC_ENABLED_VIEWS` restricted; the router stays on Classic (`view-router.tsx:64-69`). |
| One Motion pill animates between the two switchers | Sharing `layoutId` across the desktop and compact instances (`view-switcher.tsx:39-42`). |
| `useView` throws | Any consumer outside `<ViewProvider>` (`view-context.tsx:190-194`). |

### Flags / env that alter it

`NEXT_PUBLIC_ENABLED_VIEWS` — comma list; **unset ⇒ all optional views on, empty string ⇒ all optional
views off**, distinguished by `raw === undefined || raw === null` (`src/lib/enabled-views.ts:28`).
`NEXT_PUBLIC_INK_TRANSITION` selects the WebGL2 ink-burn commit path (`view-context.tsx:99`).
`prefers-reduced-motion` (OS-level) forces the snap branch (`:80-92`) and is separately enforced in CSS
(`globals.css:293-299`). No cookie, no localStorage — a bare `/` is always Classic by design
(`view-context.tsx:118-125`).

---

## 3. Chat / LLM request path

### Flow

```
CLIENT
 ChatView composer | AskPortfolio widget | TalkMode/AnvilCoreSurface (via useVoiceSession)
   → useChat.send(text, files?)         (use-chat.ts:262 — early-returns while status==="streaming")
   → attachment blocks first, text block LAST; PDFs as "[PDF: name]\n<text>", images as base64
   → fetch POST /api/chat  { AbortController }                            use-chat.ts:305
SERVER  /api/chat  (maxDuration = 30, route.ts:12)
   → withTrace(req, "chat")                                               route.ts:157
   → isConfigured()            ─ false → 503                              :158-160
   → checkRateLimit(req)       ─ deny  → 429 + Retry-After                :164-170
   → content-length > 2 MB     ─       → 413                              :177-180
   → req.json() throws         ─       → 400                              :183-187
   → sanitize: slice(-12) MAX_MESSAGES · role filter · MAX_CHARS 600
              · image mediatype allowlist · application/pdf only
              · "[PDF:" text blocks up to 10000 chars                     :61,:194-236
   → last message must be role "user"  ─ else → 400                       :247-249
   → ctx.attrs({messageCount, lastMessageLen})   (no prompt text logged)  :256
   → getLiveGithubStats()  → own /api/github/stats, next.revalidate 3600
                             null on failure ⇒ block omitted from prompt  :69-98,:261
   → system prompt = buildCorpus() + profile + PROJECT_SLUGS/WORK_SLUGS
                     + cache_control { type: "ephemeral" }                :128-129,:265-315
   → streamWithFallback(...)
        modelChain(): us.anthropic.claude-sonnet-4-6
                    → us.anthropic.claude-opus-4-6-v1
                    → us.anthropic.claude-haiku-4-5-20251001-v1:0         llm.ts:31-35
        makeClient() INSIDE start() so a ctor failure becomes an apology
                     stream, emitted as model:"client-init", attempt_index:-1  llm.ts:263-281
        per attempt: client.beta.messages.stream(), timeout 15_000 ms      llm.ts:24,:323
        onAttempt → one llm.attempt span incl. cost_usd from BEDROCK_PRICE route.ts:24-46,:284-311
   → WIRE: [THINKING_SENTINEL][reasoning][THINKING_END][answer][TRACE_DELIMITER][JSON]
                                                                          llm-trace.ts:6-9
   → Response(stream, "Cache-Control: no-store", x-anvilry-trace-id)      route.ts:317-319
CLIENT
   → read loop → parseAccumulated() → scheduleFlush() → ≤1 commit / animation frame
                 + 250 ms BACKGROUND_FLUSH_MS safety timer for hidden tabs use-chat.ts:93-116,:124,:222-233
   → trailing flushNow(acc) is mandatory                                  use-chat.ts:353-354
   → parseCards(content)  → segments: text | project | work | cmd-view | cmd-highlight
   → slug allowlist: getProject/getWork over Velite output; unresolved → DROPPED
                                                                          parse-cards.ts:33,:54-68
   → text segments → MarkdownMessage (react-markdown + skipHtml + rehypeSanitize)
   → project/work  → ChatCard (100% Velite-sourced fields)
   → cmd-*         → NO DOM; dispatched once per settled message only     chat-messages.tsx:297-311
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/components/chat/use-chat.ts` | The one transport for **every** surface: message list, stream read loop, rAF coalescing, thinking-phase timing, abort. |
| 2 | `src/components/chat/chat-view.tsx` / `src/components/ask-portfolio.tsx` / `src/components/chat/use-voice-session.ts` | The three `useChat` call sites. `ask-portfolio.tsx:39` keys the widget by `view` so a view change resets the transcript. |
| 3 | `src/lib/telemetry/with-trace.ts:200-221` | Mints the traceId, stamps `x-anvilry-trace-id` on a **reconstructed** Response that passes `res.body` through so streaming survives; emits exactly one span. |
| 4 | `src/lib/rate-limit.ts:19-26,53-82` | `slidingWindow(8, "60 s")`, prefix `anvilry:chat`; **fails open** twice over. |
| 5 | `src/lib/corpus.ts:13` | Grounding document, rebuilt per request from build-time Velite data. |
| 6 | `src/lib/llm.ts:52-54` | Provider toggle: `LLM_PROVIDER === "anthropic" ? "anthropic" : "bedrock"` — anything else, including unset, is Bedrock. |
| 7 | `src/lib/llm.ts:63-72` | `decodeSecret`: base64-vs-raw discrimination by re-encoding the decode and comparing (`:66-67`). |
| 8 | `src/lib/llm.ts:136-147` | `isFallbackEligible`: connection error, 429/404, ≥500, or a 400 whose message hits one of six `MODEL_UNAVAILABLE_MARKERS` (`:43-50`). |
| 9 | `src/lib/llm.ts:251,330,385,405,433` | `emittedAny` — declared, then gating THINKING_SENTINEL emission, being set on the first `text_delta`, gating trace-frame emission, and gating fallback. |
| 10 | `src/lib/llm-trace.ts:23-42` | `TRACE_DELIMITER` U+001E, `THINKING_SENTINEL` U+001E U+0001, `THINKING_END` U+001E U+0002, `TraceFrame`. |
| 11 | `src/components/chat/parse-cards.ts:33,54-68` | Token grammar with a locked `[a-z0-9-]+` slug charset; every token resolved against the build-time allowlist or dropped. |
| 12 | `src/components/chat/markdown-message.tsx:88-93` | `remarkGfm` + `rehypeSanitize` + `skipHtml`, default `urlTransform` left in place. |
| 13 | `src/components/chat/chat-messages.tsx` | Transcript renderer: thinking block, model badge, read-aloud, cmd dispatch, autoscroll, `useChatA11y` live region. |
| 14 | `src/components/chat/chat-card.tsx:12-77` | Renders only Velite fields — the model chooses *which* card, never its contents or href. |

### Entry point

`useChat.send()` from one of three surfaces; or a direct `POST /api/chat` (the eval cron does exactly
this, 12× per run, `src/app/api/cron/eval/route.ts:113`).

### Exit point

A `text/plain` byte stream terminated by the trace frame, plus the `x-anvilry-trace-id` header; on the
client, committed `ChatMessage`s rendered as sanitized markdown + resolved cards.

### The `emittedAny` fallback invariant

`if (emittedAny || isLast || !isFallbackEligible(err))` → append `apologyTail` and close
(`src/lib/llm.ts:433-437`, read directly). Fallback to the next model is possible **only while zero
bytes have been sent**. The load-bearing reason is at `src/lib/llm.ts:149-157`: streaming errors surface
*inside* the `for await` loop, never at the `.stream()` callsite, so connect-time and mid-stream failures
are indistinguishable by call site — bytes-on-the-wire is the only reliable discriminator. The same flag
also keeps a zero-byte attempt from materialising a trace frame (`:405-412`) and makes the thinking
sentinel a one-shot (`:330-332`).

### Telemetry spans emitted on this path

One `http.request` (or `server.error` on an uncaught throw) from `withTrace`; one `llm.attempt` per model
attempt carrying `model`, `attempt_index`, `fell_back`, `ttft_ms`, `latency_ms`, `finish_reason`, `usage`
(snake_case), and `cost_usd` (`src/app/api/chat/route.ts:284-311`). `attempt.error.message` passes
through `redact()` first (`:293`).

### Failure modes

| Failure | Mechanism |
|---|---|
| 503 "Chat is not configured" | `isConfigured()` false — no `BEDROCK_ACCESS_KEY_ID`/`BEDROCK_SECRET_ACCESS_KEY` (or no `ANTHROPIC_API_KEY` under the direct provider). Client copy at `use-chat.ts:312-325`. |
| 429 | Shared 8/60s budget exhausted — **shared with `/api/tts`, `/api/tts-google`, `/api/transcribe`, `/api/error`**, all under prefix `anvilry:chat`. |
| Unbounded spend when Upstash is down | `checkRateLimit` fails open: `{ ok: true }` when unconfigured (`rate-limit.ts:73`) and on any thrown error (`:79-82`). The only signal is a production-only module-load warning (`:41-47`). |
| Wrong `cost_usd` for a new model id | `BEDROCK_PRICE` (`route.ts:24-46`) is a hardcoded table; unknown models silently fall back to Sonnet 4.6 pricing (`:49-50`) — non-zero but wrong. |
| Token telemetry silently zeroes | An SDK returning camelCase usage keys. Pinned by `src/lib/llm.test.ts:244-249`. |
| Region signed wrong in production | `AWS_REGION` is reserved on Vercel and was observed as `"s-east-1"`. Resolution order `BEDROCK_REGION \|\| AWS_REGION \|\| "us-east-1"` (`llm.ts:87`) is what shields it. |
| Opus 4.6 400s "model identifier is invalid" | Dropping the `-v1` suffix (`llm.ts:27-30`). |
| Bedrock 400 on extended thinking | Using `client.messages.stream()` with a `betas` body param instead of `client.beta.messages.stream()` (`llm.ts:307-312,:323`). |
| Dropped tail token / frozen background tab | Removing the trailing `flushNow(acc)` (`use-chat.ts:353-354`) or the `BACKGROUND_FLUSH_MS` timer (`:124,:229`). |
| Card fabricated for nonexistent content | Structurally impossible: locked slug charset, build-time allowlist, unresolved tokens dropped. `src/components/chat/parse-cards.test.ts:55-75` is the gate. |
| XSS via streamed markdown | Removing `skipHtml` or overriding `urlTransform` (`markdown-message.tsx:10-16`). |
| Abort loses the partial answer | `AbortError` is treated as a user action — partial kept, suffixed ` …[stopped]` (`use-chat.ts:363-374`); the catch path flushes **before** mutating messages (`:360`). |

### Flags / env that alter it

`LLM_PROVIDER`, `BEDROCK_ACCESS_KEY_ID`, `BEDROCK_SECRET_ACCESS_KEY`, `BEDROCK_SESSION_TOKEN`,
`BEDROCK_REGION`, `AWS_REGION`, `ANTHROPIC_API_KEY` (the seven `llm.ts` reads);
`EXTENDED_THINKING` (server, **not** `NEXT_PUBLIC_`-prefixed, default ON, `route.ts:263`);
`NEXT_PUBLIC_EXTENDED_THINKING` (client thinking-block rendering, `chat-messages.tsx:159`);
`NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS` (`chat-view.tsx:155`); `NEXT_PUBLIC_PDF_ATTACHMENTS`
(`file-picker-button.tsx:7`); `UPSTASH_REDIS_REST_URL`/`_TOKEN` (rate limit + telemetry sink);
`VERCEL_URL` (self-fetch base for the GitHub stats block).

---

## 4. Voice pipeline

Fail-closed end to end: every capability defaults **off** and degrades to the browser baseline.

### Flow

```
ENTRY (five doors)
  header orb  ·  Chat-view "Talk"  ·  ⌘K  ·  ?view=voice  ·  wake word ("Hey portfolio")
        │
        ├─ header-orb-trigger.tsx:69-78  routes by BUILD FLAGS × viewport:
        │     ORB_MODE inplace + ≥768px + EXPERIENCE core → openCoreVoice
        │     ORB_MODE inplace + ≥768px + EXPERIENCE classic → openInlineVoice
        │     everything else (mobile, or ORB_MODE modal) → openTalkMode
        │     ORB_MODE off, or STT unsupported → renders null (:62)
        │     view === "voice" → renders DISABLED (:67, :84-90)
        ▼
  ONE-MIC MUTEX:  open*() → claimVoiceSurface(id) → force-closes every OTHER registered surface
                  voice-surface-mutex.ts:23,:40-43;  registration at module scope in each store
        ▼
  TalkMode | AnvilInlinePanel(TalkMode autoStart) | AnvilCoreSurface | AnvilView(TalkMode prompts)
        ▼
  useVoiceSession   (state DERIVED every render; only `active` is stored — use-voice-session.ts:81,:248-253)
        │
   LISTEN ──► useStt(settings.sttEngine)                            use-stt.ts:22-28
        │      ├─ useSpeechRecognition  — Web Speech, lang en-US, continuous:FALSE,
        │      │    interimResults, + sibling getUserMedia purely for the OS mic indicator
        │      │                                        use-speech-recognition.ts:161-164,:202-203
        │      └─ useTranscribeRecognition — getUserMedia → AudioContext →
        │           ScriptProcessor(4096) → Int16 PCM @16 kHz → POST /api/transcribe
        │           (application/octet-stream) → AWS Transcribe Streaming
        │                                        use-transcribe-recognition.ts:34-44,:87-91
        │      degrade rule: transcribe returned only when supported AND !error (:25-27)
        ▼
   final transcript → session.send() → /api/chat  ── subsystem 3 ──►  streaming answer
        ▼
   SPEAK ──► toCaptionText(content)  (parseCards + strip markdown + strip a dangling "[[card:")
        │                                        use-voice-session.ts:36-63
        │     → tts.speakChunk(fullTextSoFar)   (holds back a trailing partial sentence)
        │                                        use-speech-synthesis.ts:518-520
        │     ├─ browser  → speechSynthesis, ONE utterance per sentence (≤200 chars),
        │     │              desktop-only 12 s pause/resume keep-alive
        │     │                                  use-speech-synthesis.ts:53-81,:236-276
        │     ├─ polly    → POST /api/tts        → AWS Polly (Neural | Generative)
        │     └─ google   → POST /api/tts-google → Chirp 3 HD via REST
        │        remote failure → felledBackRef → browser engine for the rest of the turn (:226-232)
        ▼
   ORB ──► useVoiceLevel(state) writes a smoothed 0..1 into a REF (never React state)
        │                                        use-voice-level.ts:30-52
        └─► VoiceOrb selects: use3D = isDesktop && webgl && !reduced && !glFailed
                              → VoiceOrb3D (R3F, fBm-displaced icosahedron)  voice-orb.tsx:42
                              → else VoiceOrbCanvas (2D canvas; static ring under reduced motion)
        ▼
   speech ends → beginListening() → back to LISTEN                  use-voice-session.ts:219-224
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/components/chat/header-orb-trigger.tsx:34-45,62-90` | Build-time router between the three overlay surfaces; the `?view=voice` exclusion. |
| 2 | `src/components/chat/voice-surface-mutex.ts:23-43` | `VoiceSurfaceId = "modal" \| "inline" \| "core"`; `claimVoiceSurface` iterates `closers` and invokes every *other* close. |
| 3 | `src/components/chat/talk-overlay-store.ts` / `anvil-inline-store.ts` / `anvil-core-store.ts` | Three structurally identical module stores; each registers at module scope and calls `claimVoiceSurface` at the top of `open*()`. |
| 4 | `src/components/chat/talk-mode.tsx` | The shared surface UI: orb, captions, controls, first-run primer, Chrome-TTS banner, Space/Esc handling. |
| 5 | `src/components/chat/anvil-inline-panel.tsx` | Non-modal ARIA **disclosure** (not `role="dialog"`), positioned from the orb's `getBoundingClientRect()`, capture-phase outside-click close. |
| 6 | `src/components/chat/anvil-core-surface.tsx` | Orb-only surface; renders raw assistant content through `MarkdownMessage` (`:163`) rather than `toCaptionText`. |
| 7 | `src/components/chat/anvil-view.tsx` | The `?view=voice` view; four hardcoded recruiter `PROMPTS` (`:23-28`) handed to `TalkMode`. |
| 8 | `src/components/chat/use-voice-session.ts` | The half-duplex turn machine. Three side-effect-only effects; unmount teardown via `teardownRef` with empty deps. |
| 9 | `src/components/chat/use-stt.ts` | Engine selector; calls both child hooks unconditionally. |
| 10 | `src/components/chat/use-speech-synthesis.ts` | Per-sentence queue, `remoteTokenRef` invalidation, `felledBackRef` one-way fallback, character knobs. |
| 11 | `src/lib/voice-catalog.ts:61-141,283-294,317-320,350-367` | 6 curated + 12 extended = 18 voices; `getDefaultVoiceId()` returns `JOANNA.id` = `"polly-neural-joanna"` for anything but `"male"` (read directly at `:317-320`, id literal at `:62`); `validateVoiceForEngine` is the server-side allowlist. |
| 12 | `src/lib/voice-settings-context.tsx:77-88,90-158,191` | Persisted prefs as a module store; `STORAGE_KEY = "anvilry:voice:settings"`; `parse` validates field-by-field; `getServerSnapshot` returns `DEFAULTS`. |
| 13 | `src/app/api/tts/route.ts` / `src/app/api/tts-google/route.ts` / `src/app/api/transcribe/route.ts` | The three server engines, each with an LRU (Polly keyed by voice **and** tier), a 10 s abort, and fail-closed non-2xx. |
| 14 | `src/components/chat/wake-word-controller.tsx:29,44-54` | Wake word scoped to `ACTIVE_VIEWS = new Set(["chat"])`; mandatory persistent "Listening" banner. |
| 15 | `src/components/chat/voice-orb.tsx` / `voice-orb-canvas.tsx` / `voice-orb-3d.tsx` | Capability-tiered orb stack; all three `aria-hidden`. |
| 16 | `src/components/chat/voice-pitfalls.ts` | Browser landmine workarounds + the first-run-primer storage key. |

### Entry point

Any of the five doors above. All of them funnel through a store `open*()` (or, for `?view=voice`, through
`ViewRouter`), and therefore through `claimVoiceSurface` — except the voice **view**, which is
deliberately not a mutex participant (`voice-surface-mutex.ts:18-20`).

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
| `voiceId` | intentionally **omitted** so the catalog default resolves at point of use | `:150-151` |
| `voiceCharacter` | `{ speed: "natural", tone: "neutral", pause: "normal" }` | `:71-75` |
| Server snapshot | `DEFAULTS` — SSR HTML is always "all off" | `:191` |
| Toggle semantics | Toggles record **intent** only; runtime capability detection always wins | `:20-23` |
| Mic consent | First click with `micEnabled === false` shows a disclosure and does **not** listen | `mic-button.tsx:60-63` |
| Unsupported browser | `MicButton` returns `null`; `TalkMode` renders a "type instead" panel; `HeaderOrbTrigger` returns `null` | `src/components/chat/mic-button.tsx:40` · `src/components/chat/talk-mode.tsx:273-289` · `src/components/chat/header-orb-trigger.tsx:62` |
| Remote TTS/STT failure | Non-2xx is the signal to cascade to the browser engine | `src/app/api/tts/route.ts:30` · `src/app/api/transcribe/route.ts:27` |

### Failure modes

| Failure | Mechanism |
|---|---|
| Two live mics at once | A surface opening without `claimVoiceSurface`, or `WakeWordController` armed outside `ACTIVE_VIEWS` (`wake-word-controller.tsx:22-29`). Guarded by `voice-surface-mutex.test.ts`. |
| **Total silence** (documented past bug) | Listing `[recognition, tts]` on `useVoiceSession`'s unmount effect — both are fresh objects every render, so `tts.cancel()` fires on every render (`use-voice-session.ts:226-244`). |
| **Permanent silence** (documented past bug) | Listing `[cancel]` on `useSpeechSynthesis`' visibilitychange/unmount effect — it wipes `spokenCountRef` (`use-speech-synthesis.ts:552-575`). |
| Whole answer re-spoken on settle | Using `speak()` instead of `speakChunk()` in the settle finalizer (`use-voice-session.ts:184-188`). |
| Second answer silent | `resetTurn()` not firing on the turn rising edge (`use-voice-session.ts:176-179`); pinned by `use-speech-synthesis.dom.test.tsx`. |
| 429 storm + duplicate speech | Re-entering the remote path after a fallback — blocked by `felledBackRef` (`use-speech-synthesis.ts:226-232,336-338`). |
| Voice permanently broken in production | `wss://speech.googleapis.com` missing from `connect-src` — Chrome's `SpeechRecognition` opens a cross-origin WebSocket subject to CSP since Chrome 63; every attempt then fails `onerror.error === "network"` (`next.config.ts:56-66`). |
| AWS 5xx from a tier mismatch | Sending a Neural voice with `tier=generative`. `validateVoiceForEngine` (`voice-catalog.ts:350-367`) rejects it; the route accepts no `tier` field at all (`api/tts/route.ts:92-97`). |
| Visitor B hears visitor A's audio | A cache key not varying by voice **and** tier. Pinned by `src/app/api/tts/cache.test.ts`. |
| Self-hearing / echo | Structurally impossible: `continuous = false` (`use-speech-recognition.ts:162`) means the mic is already closed during thinking and speaking; barge-in is a UI interrupt (tap/Space), not voice (`use-voice-session.ts:26-31`). |
| Screen-reader double-speak | `useChatA11y` swaps the answer text for `"Speaking answer aloud."` while TTS owns the audio (`use-chat-a11y.ts:19-23`); the captions block is `aria-hidden={speaking}` (`talk-mode.tsx:362-380`). |
| Raw `[[card:` fragment spoken or shown | `toCaptionText` strips both complete tokens and a dangling mid-stream fragment (`use-voice-session.ts:48-63`). Note `anvil-core-surface.tsx:163` does **not** use it. |
| Transcript text in telemetry | Never emitted — only `audio_bytes`, derived `audio_seconds`, `transcript_chars` (`api/transcribe/route.ts:105-112`). |

### Flags / env that alter it

Build-time: `NEXT_PUBLIC_ANVIL_ORB_MODE` (`inplace \| modal \| off`, default `inplace`),
`NEXT_PUBLIC_ENABLE_ANVIL_ORB` (legacy `"false"` → `off`), `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE`
(`core \| classic`) — all three at `header-orb-trigger.tsx:34-45`; `NEXT_PUBLIC_VOICE_PICKER_MODE`
(`voice-picker-mode.ts:20`); `NEXT_PUBLIC_CHROME_TTS_BANNER` (`writing-flags.ts:87`, consumed at
`talk-mode.tsx:348-350`); `NEXT_PUBLIC_VOICE_TEST_AUDIO` (`talk-mode.tsx:478`);
`NEXT_PUBLIC_ORB_POSTPROCESSING` (`voice-orb-3d.tsx:300`, additionally gated on `getDeviceTier() === "high"`).
Server: `GOOGLE_TTS_API_KEY` (`api/tts-google/route.ts:39` — unset ⇒ 503 ⇒ Google hidden), the Bedrock
credentials reused by Polly/Transcribe via `bedrockCreds` (`api/tts/route.ts:2`,
`api/transcribe/route.ts:6`). Runtime, per-visitor: the nine persisted `voice-settings-context` fields.

---

## 5. MCP server

### Flow

```
MCP client (Claude Desktop via `npx -y mcp-remote`, Cursor via direct HTTP, any agent)
   → GET|POST|DELETE  https://anvilry.vercel.app/api/mcp/mcp
   → src/app/api/mcp/[transport]/route.ts   (maxDuration = 30, :9; no `runtime` export, :6-8)
   → createMcpHandler(server => { 9 × server.registerTool(...) },
                      undefined,
                      { basePath: "/api/mcp", disableSse: true })          :126
   → each tool body → T.<name>Data(...)  from src/lib/mcp-tools.ts   (pure, transport-agnostic)
   → mcp-tools.ts reads @/lib/content (allProjects, allWork, allArticles, allNotes,
                                       getProject, getWork) + @/lib/profile
   → wrap(data)  →  { content: [{ type:"text", text: JSON.stringify(data,null,2) }],
                      structuredContent: data,
                      isError: true  ⟸ IFF the payload has a `notFound` key }   :12-19
   → JSON-RPC response over Streamable HTTP
```

### The nine registered tools

| Tool | Input schema | Impl | Not-found |
|---|---|---|---|
| `get_profile` | `{}` | `getProfileData()` `mcp-tools.ts:50` | n/a |
| `list_projects` | `{}` | `listProjectsData()` `:65` | n/a |
| `get_project` | `projectSlugSchema` `:29` | `getProjectData()` `:77` | `notFound("project", slug, projectSlugs())` `:79` |
| `list_work` | `{}` | `listWorkData()` `:93` | n/a |
| `get_work` | `workSlugSchema` `:30` | `getWorkData()` `:105` | `notFound("work", slug, workSlugs())` `:107` |
| `search_experience` | `searchSchema` `:31-33` | `searchExperienceData()` `:121` | none — `{ query, matches: [], skills: [] }` |
| `get_resume_variant` | `resumeRoleSchema` `:34-36` | `getResumeVariantData()` `:137` | `notFound("resume_variant", role, [...RESUME_ROLES])` `:140` |
| `list_all_content` | `{}` | `listAllContentData()` `:150` | n/a |
| `get_content_item` | `contentTypeSchema` `:144-147` | `getContentItemData()` `:160` | delegates, or `notFound("article"\|"note", …)` `:166`,`:171` |

Registration sites: `route.ts:30, 40, 50, 59, 69, 78, 88, 98, 108`. **The count is 9** — and as of this
branch every copy of that count agrees. The 7-vs-9 drift this index originally recorded is **fixed**: the
route's own docblock now reads "9 read-only tools" (`src/app/api/mcp/[transport]/route.ts:22`), `CLAUDE.md:202`
and `CLAUDE.md:293` both say 9, and the hand-written `TOOLS` table on `/mcp` lists all nine rows
(`src/app/mcp/page.tsx:35-45`) — `list_all_content` and `get_content_item` were the two it had been missing.
`src/lib/mcp-tools.ts` was correct throughout, exporting all nine `*Data` functions
(`:50,65,77,93,105,121,137,150,160`); the two tools landed at v3.0.0 (`CHANGELOG.md:307-308` records the
7 → 9 growth) and the docs caught up here (`CHANGELOG.md:22-24`).

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/app/api/mcp/[transport]/route.ts:1,28-129` | Transport wiring; `wrap()`; `GET`/`POST`/`DELETE` all bound to the same handler (`:129`). |
| 2 | `src/lib/mcp-tools.ts` | Nine pure data functions, five Zod **raw-shape** input schemas (plain objects of `z.*` fields, which is what `registerTool` takes), `notFound()`, `ROLE_TO_LABEL`, hardcoded `BASE` (`:14`). |
| 3 | `src/lib/content.ts` | The allowlist the tools resolve against. |
| 4 | `src/lib/profile.ts` | Identity, skills, achievements, `resumeVariants`. |
| 5 | `src/app/mcp/page.tsx` | Human-readable docs; `ENDPOINT` constant at `:6`; the `TOOLS` table (`:35-45`) is still a hand-maintained duplicate, but it is now **enforced** rather than trusted — the comment at `:32-34` points at `src/app/mcp/tools-documented.test.ts`, which set-equality-checks it against the route's `registerTool` calls. |
| 6 | `src/lib/llms-txt.ts:65` | Advertises the server to agents. Fixed on this branch: it now publishes the working `${BASE}/api/mcp/mcp` (it used to publish the 404'd `/api/mcp/sse`). |
| 7 | `src/app/api/cron/health-check/route.ts:61` | Probes `/api/mcp/mcp` as a P2 check. Fixed on this branch: the expected status is per-check (`:81`, gated at `:83`) and `mcp_get` expects **405**, not 200 (`src/lib/health-expectations.ts:30`). |

### Entry point

`POST /api/mcp/mcp` (Streamable HTTP). `/api/mcp/sse` is deliberately 404'd by `disableSse: true`.

### Exit point

A JSON-RPC result whose `content[0].text` is pretty-printed JSON, mirrored in `structuredContent`, with
`isError: true` on a not-found.

### What is deliberately excluded

- **`src/lib/personal.ts` is never imported** — the professional-only boundary is stated at
  `src/lib/mcp-tools.ts:11-13` and asserted by `src/lib/mcp-tools.test.ts:22` ("does NOT leak personal.ts").
- **`getProfileData()` hand-picks fields** rather than spreading `profile`; `email`, `calendlyUrl`, and
  `substackUrl` are not returned (`mcp-tools.ts:50-63`).
- **Legacy SSE transport** — `disableSse: true` (`route.ts:126`).
- **`export const runtime`** — removed because `cacheComponents` rejects the export's mere presence
  (`route.ts:6-8`).

### The not-found (`isError`) contract

`notFound()` returns `{ notFound: true, kind, given, valid }` (`mcp-tools.ts:42-48`). `wrap()` detects the
**literal `notFound` property** and sets `isError: true` (`route.ts:13`), so the calling agent receives the
list of valid options instead of a fabricated answer. Renaming that field turns every not-found into a
silent success.

### Failure modes

| Failure | Mechanism |
|---|---|
| Unhandled 500 on `/api/mcp/sse` | Removing `disableSse: true` — the `[transport]` segment matches `"sse"`, mcp-handler enters its Redis init and throws `redisUrl is required`, because this project uses Upstash REST, not `REDIS_URL`/`KV_URL` (`route.ts:120-126`). |
| Every not-found reported as success | Renaming the `notFound` key in `mcp-tools.ts` (`route.ts:13`). |
| `cacheComponents` build failure | Re-adding `export const runtime` (`route.ts:6-8`). |
| `get_resume_variant` silently breaks | Renaming a `resumeVariants[].label` in `profile.ts` — `ROLE_TO_LABEL` (`mcp-tools.ts:20-26`) hardcodes the exact strings, including `"Sairam Resume"` and hyphenated `"Full-Stack"`. `mcp-tools.test.ts:65` asserts every role resolves to a PDF that exists on disk. |
| Tool list drifts from content | `mcp-tools.test.ts:36` asserts `list_projects`/`list_work` cover the whole content layer. |
| Agents pointed at a dead endpoint | Publishing the legacy `/api/mcp/sse` path, which `disableSse: true` 404s. `src/lib/llms-txt.ts:65` used to do exactly that; **fixed on this branch** — it now advertises `${BASE}/api/mcp/mcp` (`CHANGELOG.md:15-18`), and `src/lib/llms-txt.test.ts:22,25-26` pins both the live path and the absence of `/api/mcp/sse`. |
| `/mcp` docs drift | `src/app/mcp/page.tsx:35-45` is still hand-maintained, but **no longer unguarded**: `src/app/mcp/tools-documented.test.ts:76,81,90` asserts the documented set equals the route's `registerTool` set, and `vitest run` is chained into `pnpm build`, so adding a tool without documenting it fails the build. |

### Flags / env that alter it

**None.** No flag gates this route, no rate limit applies, no auth. Its only environmental coupling is the
`@modelcontextprotocol/sdk` exact pin `1.26.0` (`package.json:23`), which is `mcp-handler@1.1.0`'s literal
peer requirement (`pnpm-lock.yaml:3607`) and the direct cause of the `security_update_not_possible`
Dependabot state that forced the ten `pnpm.overrides`.

---

## 6. Telemetry & observability

### Flow

```
PRODUCERS
  route wrapper:   withTrace(req, "<route>", handler)      → http.request | server.error
  chat route:      onAttempt callback                      → llm.attempt (+ cost_usd)
  tts / tts-google / transcribe:  catch blocks             → server.error
  /api/error:      validated browser beacon                → client.error
        │  every producer calls redact() ITSELF — emit does no redaction
        ▼
  src/lib/telemetry/emit.ts  emit(event): void   ← NOT a Promise; never awaited
        │
        ├─ SINK 1 (always, DECLARED SOURCE OF TRUTH)
        │    console.log("[trace]", JSON.stringify(event))            emit.ts:49
        │    → Vercel Runtime Logs · grep handle `[trace]` · permanent
        │    wrapped in try/catch and does NOT early-return, so sink 2 still runs (:48-53)
        │
        └─ SINK 2 (best effort, skipped when `redis` is null)
             ZADD  anvilry:trace:${event.kind}   score = event.ts   member = JSON     emit.ts:58,:65
             ZREMRANGEBYSCORE key 0 (event.ts - SEVEN_DAYS_MS)                        emit.ts:42,:60,:74
             both promises get explicit .catch() → "[telemetry] redis sink failed"    (:66-71,:75-80)
CONSUMERS
  /admin/telemetry   → 9 Redis reads in one Promise.all; 24 h window; events table capped at 100
  make trace ID=…    → scripts/replay-trace.mjs → 7 hardcoded kinds → chronological waterfall
  vercel logs --tail → make logs / logs-llm / logs-flags
CLIENT SIDE
  window "error" / "unhandledrejection"      instrumentation-client.ts:74,:86
  <ErrorBoundary> error.tsx / global-error.tsx
        │  both stamp window.__anvilry_error_recently__ = Date.now() BEFORE beaconing
        ▼
  sendErrorBeacon()  → navigator.sendBeacon("/api/error", Blob{application/json})
                       → fallback fetch(..., { keepalive: true })        beacon.ts:46-95
        ▼
  POST /api/error  → 5 gates → redact(message, stack) → emit({ kind: "client.error" })  → 204
  web-vitals: onLCP/onINP/onCLS → console.info("[vitals"], …)  — NO Redis, NO API route
                                                                instrumentation-client.ts:50-56
```

### Participating files, in flow order

| # | File | Exact role |
|---|---|---|
| 1 | `src/lib/telemetry/schema.ts:37-45,66-76` | 7 `KIND_LITERALS`; the 9-field envelope with an opaque `attrs` record. |
| 2 | `src/lib/telemetry/schema.ts:83-106,124-128` | `redact()` — email → token(≥32 chars) → digit-run(12–19), **order is load-bearing**; `hashIp(ip, salt)` → 16 hex chars, `"anonymous"` with no salt. |
| 3 | `src/lib/telemetry/with-trace.ts:63-73,148-246` | `clientIp` (**last** XFF segment), traceId mint, session id, `awsRequestIdOf`, response reconstruction, 5xx level escalation, `after()`-scheduled emission, re-throw. |
| 4 | `src/lib/telemetry/emit.ts:30-80` | The dual sink and the 7-day trim. |
| 5 | `src/lib/redis.ts:26-39` | The singleton; `null` when unconfigured; construction try/caught because the SDK throws a synchronous `UrlError`. |
| 6 | `src/lib/telemetry/beacon.ts:42-98` | The one client egress; `BEACON_URL = "/api/error"` hardcoded because CSP `connect-src 'self'` would block anything else. |
| 7 | `src/instrumentation-client.ts:26-39,46-106` | The 100 ms dedupe contract, both window listeners, the lazy `web-vitals` import. |
| 8 | `src/app/error.tsx:39,57-81` / `src/app/global-error.tsx:33,52-57` | Boundary beacons with distinct `source` values (`"boundary"` / `"global-boundary"`). |
| 9 | `src/app/api/error/route.ts:83,89-183` | The sink route: opt-out gate, rate limit, dual 413, Zod, redaction, 204. |
| 10 | `src/instrumentation.ts:35-104` | Cold-start `[config]` snapshot (presence-only, never secret values) + the production-only `anvilry:corpus:built_at` write. |
| 11 | `src/app/admin/telemetry/page.tsx` | The dashboard; 7 hardcoded Redis key literals; `CACHE_READ_PRICE_PER_MTOK = 0.3` (`:112`); snake_case usage reads (`:59-66`). |
| 12 | `scripts/replay-trace.mjs:47-108` | The replay CLI; one `zrange` per kind over a 7-day window. |

### Entry point

Any `/api/*` request wrapped in `withTrace` (chat, tts, tts-google, transcribe, error); any browser error
or unhandled rejection; the five cron routes that write their own `anvilry:*:latest` snapshots
(`health-check/route.ts:191` · `eval/route.ts:148` · `github-sync/route.ts:55` · `seo-audit/route.ts:68` ·
`content-audit/route.ts:45`).

### Exit point

A `[trace]` line in Vercel Runtime Logs (the declared source of truth), a member in
`anvilry:trace:<kind>`, the `x-anvilry-trace-id` response header, the `/admin/telemetry` HTML, and
`replay-trace.mjs` stdout.

### The four grep handles (distinct and load-bearing)

| Handle | Emitted at | Content |
|---|---|---|
| `[config]` | `src/instrumentation.ts:84` | One cold-start snapshot per server process; booleans and safe enums only. |
| `[trace]` | `src/lib/telemetry/emit.ts:49` | Every telemetry span. |
| `[vitals]` | `src/instrumentation-client.ts:52` | LCP / INP / CLS, client-side only. |
| `[flags]` | `src/lib/flags.ts:45` | One line per flag resolution, incl. `driver` and `value`. |

### Failure modes

| Failure | Mechanism |
|---|---|
| Every error double-beacons | Renaming `DEDUPE_FLAG = "__anvilry_error_recently__"` in one of its three homes: `src/app/error.tsx:39`, `src/app/global-error.tsx:33`, `src/instrumentation-client.ts` (100 ms window). |
| Rate-limit bypass via spoofed header | Taking the **first** `x-forwarded-for` segment instead of the last. All three copies now take the last: `src/lib/rate-limit.ts:57`, `src/lib/telemetry/with-trace.ts:71`, and `src/app/api/visit/route.ts:34` — the third was the odd one out (it took the leftmost segment and carried a comment asserting that was correct), and it is **fixed on this branch** (`CHANGELOG.md:30-35`). It was never exploitable in production: the counter is flag-off by default, the handler returns early on absent Redis before `clientIp` (`:25`) runs, and `x-vercel-forwarded-for` is checked first. Pinned two ways — `src/lib/telemetry/with-trace.test.ts:220-230` for the telemetry copy, and `src/lib/client-ip-consistency.test.ts:140` for every copy, which **discovers** `clientIp` bodies under `src/` rather than assuming a fixed three (`:101,118`) and rejects `.reverse().pop()` / `.slice(0,1).pop()` look-alikes (`:59-69`). |
| Secrets in the trace log | A producer emitting without `redact()` first — `emit` does none (`emit.ts:30-35`). `src/app/api/error/route.test.ts:218-255` pins redact-before-emit. `componentStack` is deliberately **not** redacted (React-internal, `api/error/route.ts:145-166`). |
| Retention stops trimming | The trim is piggybacked on writes (`emit.ts:74`), so a kind that stops receiving events is never trimmed again. |
| Telemetry failure becomes request failure | Removing a `.catch()` from either Redis promise, or awaiting `emit` (it returns `void` by design, `emit.ts:30-35`). |
| Streaming chat buffered | Not passing `res.body` through when reconstructing the Response (`with-trace.ts:200-207`). |
| TTFB regression | Calling `emit` synchronously instead of via the lazy `require("next/server").after` (`with-trace.ts:7-17,212-213`). |
| Errors swallowed instead of observed | `withTrace` re-throws after emitting — "an OBSERVER; never a SWALLOWER" (`with-trace.ts:244-246`). |
| Beacon recursion | Removing the `.catch()` from the keepalive `fetch` fallback — an unhandled rejection re-fires `unhandledrejection` straight back into `sendErrorBeacon` (`beacon.ts:85-95`). |
| `sendBeacon` silently refuses the body | Passing a raw string instead of a `Blob` of type `application/json` (`beacon.ts:72,77-80`). |
| Legitimate beacon 400s | The `source` enum at `api/error/route.ts:83` drifting from `ErrorBeaconPayload` in `beacon.ts:42`. |
| Oversized body still read | Removing the **post-read** 413 backstop (`api/error/route.ts:131-133`) — `sendBeacon` does not always send `Content-Length`, so the header-only gate is bypassable. |
| Dashboard tile goes blank | A cron route writing a different key than the 7 literals hardcoded in `src/app/admin/telemetry/page.tsx` (`:25,217,251,254,257,260,265`). |
| Preview deploys pollute the corpus timestamp | Gating on `NODE_ENV` instead of `VERCEL_ENV === "production"` — Vercel previews also run `NODE_ENV=production` (`instrumentation.ts:86-92`). |
| Replay CLI silently drops every event | Reintroducing `JSON.parse(member)`: `@upstash/redis` has `automaticDeserialization=true`, so members return as objects and the parse coerces to `"[object Object]"` and throws (`scripts/replay-trace.mjs:65-68`). |
| New span kind invisible in replay | `KINDS` is hardcoded (`replay-trace.mjs:47-55`); `KIND_LITERALS` and the dashboard filter must also be updated (`schema.ts:36-37`). |

### Flags / env that alter it

`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (both or neither — sink 2 and the whole dashboard);
`TELEMETRY_IP_SALT` (unset ⇒ every IP stored as `"anonymous"`, `with-trace.ts:157`);
`TELEMETRY_ENABLED` — **opt-out, and only the exact string `"false"`**, read at exactly one place,
`src/app/api/error/route.ts:92` (`.env.example:113` and `docs/configuration.md:97` describe it as
disabling "all event emission", which is broader than the single read); `ADMIN_PASSWORD` (gates the
dashboard, via `src/proxy.ts`); `VERCEL_ENV` (corpus timestamp gate); `CRON_SECRET` (the five cron
snapshot writers, `vercel.json:3-7`).

### Resolved here

`budget.tick` is declared in `KIND_LITERALS` (`src/lib/telemetry/schema.ts:44`), asserted by
`src/lib/telemetry/schema.test.ts:150`, and consumed by the dashboard's `case "budget.tick"`
(`src/app/admin/telemetry/page.tsx:376`) — but a grep of `src/` for `budget.tick` returns only those
four sites. **No producer emits it at v3.4.2.** (Section 04 left this open; resolved by direct grep.)
