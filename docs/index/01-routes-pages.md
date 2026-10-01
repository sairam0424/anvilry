---
kind: doc
title: Routes & Pages (App Router UI surface)
domain: [content]
status: current
version: v3.11.0
---

# Routes & Pages (App Router UI surface)

> Part of the Anvilry v3.11.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
>
> **Describes:** Anvilry v3.11.0 (`package.json` 3.11.0), i.e. main `a929932` plus five later fixes, described by behaviour — notes hidden at the data layer while `NOTES_ENABLED` is off (`allNotes` empty; `publishedNotes` keeps the raw list), per-class rate-limit buckets, admin auth through one shared `isAdminAuthorized` (proxy, `requireAdmin`, and the telemetry page itself), the command palette's talk-mode gated on the active voice view, and a `MIN_ROUTES = 17` bundle-budget floor with dead components removed. Only the first and third change anything in this doc's files.

**Scope:** every file under `src/app/**` that is NOT under `src/app/api/**` and is NOT a `route.ts`.
Concretely: `src/app/{layout,page,error,global-error,not-found,opengraph-image,icon,apple-icon,manifest,robots,sitemap}.*`,
`src/app/globals.css`, `src/app/layout.hydration-proof.dom.test.tsx`,
`src/app/{about,decisions,mcp,resume,search,stats}/**`, `src/app/{articles,notes,projects,work}/**` (pages + layouts +
opengraph-image only — the `[slug].md/route.ts` handlers belong to the API section), `src/app/admin/telemetry/page.tsx`.
`src/proxy.ts` (the `/admin/:path*` gate) is outside `src/app` but is described here wherever it changes a page's behaviour.
There are 16 `page.tsx` files: `/`, `/about`, `/admin/telemetry`, `/articles`, `/articles/[slug]`, `/decisions`, `/mcp`, `/notes`, `/notes/[slug]`, `/projects`, `/projects/[slug]`, `/resume`, `/search`, `/stats`, `/work`, `/work/[slug]`.
Excluded by rule: `src/app/api/**`, `src/app/.well-known/vercel/flags/route.ts`, `src/app/feed.xml/route.ts`,
`src/app/llms.txt/route.ts`, `src/app/llms-full.txt/route.ts`, `src/app/{articles,notes,projects,work}/[slug].md/route.ts`.

**Files indexed:** 40 — matches the Coverage list below. Since the previous revision this doc gained `src/app/decisions/page.tsx` (the `/decisions` ledger page had no entry), `src/app/robots.test.ts` (Content-Signal guard) and `src/app/admin/telemetry/page.test.tsx` (page-level auth guard).

## At a glance

| File | Role | Key exports |
|---|---|---|
| `src/app/layout.tsx` | Root layout: fonts, global `metadata`/`viewport`, no-flash theme script + Person/WebSite/FAQ JSON-LD in `<head>`, `Providers` + all global client mounts | `viewport`, `metadata`, default `RootLayout` (async server) |
| `src/app/page.tsx` | Homepage `/`; the ONLY place `ViewRouter` (multi-view switcher) enters | `metadata`, default `Home` |
| `src/app/error.tsx` | Route-segment React error boundary; beacons `source:"boundary"` | default `RouteError` (client) |
| `src/app/global-error.tsx` | Root error boundary (catches layout crashes); own `<html>/<body>`, inline styles; beacons `source:"global-boundary"` | default `GlobalError` (client) |
| `src/app/not-found.tsx` | 404 page — a live gamified `Terminal` seeded with a fake kernel-panic boot banner | default `NotFound` (client) |
| `src/app/opengraph-image.tsx` | Root OG card (1200×630) via `next/og` `ImageResponse` | `alt`, `size`, `contentType`, default `OpengraphImage` |
| `src/app/icon.tsx` | 32×32 favicon — cyan "A" on ink, generated at build | `size`, `contentType`, default `Icon` |
| `src/app/apple-icon.tsx` | 180×180 Apple touch icon, same mark + accent glow | `size`, `contentType`, default `AppleIcon` |
| `src/app/manifest.ts` | Web app manifest → `/manifest.webmanifest` | default `manifest()` |
| `src/app/robots.ts` | `/robots.txt` — allow-all, `Content-Signal: search=yes, ai-input=yes, ai-train=no`, sitemap pointer (hardcoded absolute URL) | default `robots()` |
| `src/app/robots.test.ts` | Vitest guard: Content-Signal value and `allow: "/"` stay pinned | Vitest `describe`/`it` only |
| `src/app/sitemap.ts` | `/sitemap.xml` — static routes + Velite content, flag-gated sections, per-item `lastModified` for notes/articles | default `sitemap()` |
| `src/app/globals.css` | Tailwind v4 entry + design-token `:root`, `@theme inline` map, and every hand-written animation/utility | — (CSS) |
| `src/app/layout.hydration-proof.dom.test.tsx` | Co-located happy-dom proof that `suppressHydrationWarning` silences extension-injected attribute mismatches | Vitest `describe`/`it` only |
| `src/app/about/page.tsx` | `/about` — prose bio, `// now`, `// uses`, `// skills`, `ProfilePageJsonLd` | `metadata`, default `AboutPage` |
| `src/app/mcp/page.tsx` | `/mcp` — MCP server docs: endpoint, Claude Desktop + Cursor JSON configs, **10**-row tool table (all 10 registered, test-enforced) | `metadata`, default `McpPage` |
| `src/app/decisions/page.tsx` | `/decisions` — client ledger of architecture decisions with category radio + tag rail; no `metadata`, no layout | default `DecisionsPage` (client) |
| `src/app/resume/page.tsx` | `/resume` — client PDF/Web tab switcher (default tab `web`), desktop-only iframe preview, flag-gated variant list | default `ResumePage` (client) |
| `src/app/resume/layout.tsx` | Metadata carrier for `/resume` (page is a Client Component and cannot export metadata) | `metadata`, default `ResumeLayout` |
| `src/app/search/page.tsx` | `/search` — injects Pagefind CSS+JS at runtime, idempotently mounts `#pagefind-search` | default `SearchPage` (client) |
| `src/app/search/layout.tsx` | Metadata carrier for `/search` | `metadata`, default `SearchLayout` |
| `src/app/stats/page.tsx` | `/stats` — 6 "by the numbers" tiles: 4 derived from Velite + `profile`, 2 hand-written "Daily users" literals | default `StatsPage` (server) |
| `src/app/stats/layout.tsx` | Metadata carrier for `/stats` | `metadata`, default `StatsLayout` |
| `src/app/admin/telemetry/page.tsx` | `/admin/telemetry` — request-time Redis telemetry dashboard; Basic auth at the proxy AND re-checked in the page (`notFound()` when unauthorized) | `instant = false`, default `TelemetryDashboard` (async server) |
| `src/app/admin/telemetry/page.test.tsx` | Vitest guard: the telemetry page re-checks Basic auth itself (`notFound()` before any Redis read), and its cost tiles are priced per model | Vitest `describe`/`it` only |
| `src/app/articles/page.tsx` | `/articles` — client page: platform filter pills, featured hero, deduped group grid | default `ArticlesPage` (client) |
| `src/app/articles/layout.tsx` | Metadata + `ARTICLES_ENABLED` route gate (404 when off) | `metadata`, default `ArticlesLayout` |
| `src/app/articles/[slug]/page.tsx` | Article detail; redirects to `/notes/<linkedNote>` or the external publication; native articles render MDX + BlogPosting/Breadcrumb JSON-LD | `generateStaticParams`, `generateMetadata`, default `ArticlePage` |
| `src/app/articles/[slug]/opengraph-image.tsx` | Per-article OG card with source-coloured eyebrow | `size`, `contentType`, `alt`, `generateStaticParams`, default `ArticleOgImage` |
| `src/app/notes/page.tsx` | `/notes` — flag- and content-gated note grid (404 when `NOTES_ENABLED` is off or `allNotes` is empty) | `metadata`, default `NotesPage` |
| `src/app/notes/[slug]/page.tsx` | Note detail: `ReadingProgress`, MDX body, `BlogPosting` + breadcrumb JSON-LD | `generateStaticParams`, `generateMetadata`, default `NotePage` |
| `src/app/notes/[slug]/opengraph-image.tsx` | Per-note OG card | `size`, `contentType`, `alt`, `generateStaticParams`, default `NoteOgImage` |
| `src/app/projects/page.tsx` | `/projects` — `"use cache"` + `cacheLife("hours")`; awaits the live GitHub repo feed | `metadata`, default `ProjectsPage` |
| `src/app/projects/[slug]/page.tsx` | Project detail: whole page is a `"use cache"` + `cacheLife("hours")` boundary; live `fetchRepo`, repo CTA, related articles, derived reading time, `SoftwareSourceCode` + Breadcrumb JSON-LD | `generateStaticParams`, `generateMetadata`, default `ProjectPage` |
| `src/app/projects/[slug]/opengraph-image.tsx` | Per-project OG card (name + tagline + group) | `size`, `contentType`, `alt`, `generateStaticParams`, default `ProjectOgImage` |
| `src/app/work/page.tsx` | `/work` — case-study cards with `register` + real metrics | `metadata`, default `WorkPage` |
| `src/app/work/[slug]/page.tsx` | Case-study detail + optional `constraints`/`tradeoffs`/`diagram` blocks | `generateStaticParams`, `generateMetadata`, default `WorkPage` |
| `src/app/work/[slug]/opengraph-image.tsx` | Per-work OG card (name + register + top metric) | `size`, `contentType`, `alt`, `generateStaticParams`, default `WorkOgImage` |

## Route matrix

`cacheComponents: true` is set globally (`next.config.ts:203`, rationale comment from `:171`), so page routes are built as
`renderingMode: "PARTIALLY_STATIC"` with `experimentalPPR: true`. The "Render mode" column therefore records
what the *segment config + build artifact* say, not a pre-Next-16 static/ISR/dynamic trichotomy.
The `compute` / `response` / `initialRevalidateSeconds` values were read from a local, gitignored `.next` build of an earlier tree and
were **not re-measured** for this tree (no `.next` exists in the worktree this revision was checked against — see UNVERIFIED); segment-config
facts (`"use cache"`, `cacheLife`, `instant`, `generateStaticParams`, `notFound()` gates) are re-read from source and are not env-dependent.

| Route path | File | Render mode | revalidate | generateStaticParams? | generateMetadata? | auth | notable data deps |
|---|---|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | PARTIALLY_STATIC, `compute:"static"`, `response:"initial"` | none (`initialRevalidateSeconds:false`) | no | no — static `metadata` (`page.tsx:15`) | none | Velite via home components; `GITHUB_STATS_ENABLED` is read in `components/home/hero.tsx:159`, not here |
| `/about` | `src/app/about/page.tsx` | PARTIALLY_STATIC, `compute:"static"` | none | no | no — static `metadata` (`about/page.tsx:17`) | none | `profile`, `skills`, `impactMetrics`, `personal`/`now`, `allProjects.length` |
| `/mcp` | `src/app/mcp/page.tsx` | PARTIALLY_STATIC, `compute:"static"` | none | no | no — static `metadata` (`mcp/page.tsx:9`) | none | `profile` only; endpoint string hardcoded (`mcp/page.tsx:6`); `TOOLS` table (`:40-60`) |
| `/resume` | `src/app/resume/page.tsx` + `resume/layout.tsx` | PARTIALLY_STATIC, `compute:"static"`; page is `"use client"` (`resume/page.tsx:1`) | none | no | no — static `metadata` in the layout (`resume/layout.tsx:6`) | none | `resumeVariants` from `@/lib/profile`; `NEXT_PUBLIC_RESUME_VARIANTS` (`resume/page.tsx:29`) |
| `/search` | `src/app/search/page.tsx` + `search/layout.tsx` | PARTIALLY_STATIC, `compute:"static"`; page is `"use client"` (`search/page.tsx:1`) | none | no | no — static `metadata` in the layout (`search/layout.tsx:3`) | none | `/pagefind/pagefind-ui.{css,js}` injected at runtime (`search/page.tsx:20-51`) |
| `/stats` | `src/app/stats/page.tsx` + `stats/layout.tsx` | PARTIALLY_STATIC, `compute:"static"` | none | no | no — static `metadata` in the layout (`stats/layout.tsx:4`) | none | `allProjects`/`allNotes`/`allArticles`, `profile` |
| `/work` | `src/app/work/page.tsx` | PARTIALLY_STATIC, `compute:"static"` | none — `revalidate = 3600` deliberately deleted (`work/page.tsx:9-13`) | no | no — static `metadata` (`work/page.tsx:17`) | none | `allWork` (build-time Velite only) |
| `/work/[slug]` | `src/app/work/[slug]/page.tsx` | PARTIALLY_STATIC per-slug prerender + dynamic fallback | none | **yes** — `allWork` (`work/[slug]/page.tsx:13`) | **yes** (`work/[slug]/page.tsx:17`) | none | `getWork(slug)`, `notFound()` on miss |
| `/work/<slug>/opengraph-image` | `src/app/work/[slug]/opengraph-image.tsx` | PARTIALLY_STATIC per-slug | none | **yes** (`:12`) | n/a (image route) | none | `getWork(slug)`, `metrics[0]` |
| `/projects` | `src/app/projects/page.tsx` | PARTIALLY_STATIC, `compute:"static"`; body opens with `"use cache"` (`projects/page.tsx:39`) | **3600 s** (`cacheLife("hours")`, `projects/page.tsx:40`) → manifest `initialRevalidateSeconds:3600`, `initialExpireSeconds:86400` | no | no — static `metadata` (`projects/page.tsx:13`) | none | `projectsByGroup()` (Velite) + **live** `getRepoFeed()` GitHub call (`:42`) |
| `/projects/[slug]` | `src/app/projects/[slug]/page.tsx` | PARTIALLY_STATIC per-slug; the whole page function is a `"use cache"` boundary (`:69`) with `cacheLife("hours")` (`:70`) → hourly revalidate | 3600 s (`cacheLife("hours")`) | **yes** — `allProjects` (`:25`) | **yes** (`:29`), page-specific `openGraph`/`twitter` | none | `getProject(slug)`, **live** `fetchRepo(profile.githubUser, repoName)` (`:80`), `getArticle()` for `relatedArticles` (`:83-85`) |
| `/projects/<slug>/opengraph-image` | `src/app/projects/[slug]/opengraph-image.tsx` | PARTIALLY_STATIC per-slug | none | **yes** (`:10`) | n/a | none | `getProject(slug)` |
| `/articles` | `src/app/articles/page.tsx` + `articles/layout.tsx` | PARTIALLY_STATIC, `compute:"static"`; page is `"use client"` (`articles/page.tsx:1`) | none | no | no — static `metadata` in the layout (`articles/layout.tsx:5`) | none | `allArticles` (already stripped of note-only articles while notes are off), `inkforgeArticles`, `groupArticles()`; gate `ARTICLES_ENABLED` (`articles/layout.tsx:12`) |
| `/articles/[slug]` | `src/app/articles/[slug]/page.tsx` | PARTIALLY_STATIC per-slug + dynamic fallback; many slugs resolve to `redirect()` | none | **yes** — `allArticles`, plus a now-redundant `linkedNote && !externalUrl && !NOTES_ENABLED` filter (`:39-45`) | **yes** (`:47`) | none | `getArticle(slug)` (over `allArticles`); `NOTES_ENABLED`; `article.externalUrl` protocol guard (`:79`) |
| `/articles/<slug>/opengraph-image` | `src/app/articles/[slug]/opengraph-image.tsx` | PARTIALLY_STATIC per-slug | none | **yes** — `allArticles` (`:29-31`); same set the page renders | n/a | none | `getArticle(slug)`, `SOURCE_LABEL: Record<ArticleSource,string>` (`:20-27`) |
| `/notes` | `src/app/notes/page.tsx` | PARTIALLY_STATIC, `response:"complete"` (fully filled shell — no dynamic holes) | none — `revalidate = 3600` deliberately deleted (`notes/page.tsx:9-11`) | no | no — static `metadata` (`notes/page.tsx:13`) | none | `allNotes` (empty while notes are dark); `notFound()` when `!NOTES_ENABLED` or empty (`:21-23`) |
| `/notes/[slug]` | `src/app/notes/[slug]/page.tsx` | PARTIALLY_STATIC per-slug + dynamic fallback | none | **yes** — `publishedNotes` (raw list, **no flag check**, `:15-26`) | **yes**, returns `{}` when `!NOTES_ENABLED` (`:28-43`) | none | `getNote(slug)` (over `allNotes`, so it misses while dark); `notFound()` when flag off (`:51`) or slug missing (`:53`) |
| `/notes/<slug>/opengraph-image` | `src/app/notes/[slug]/opengraph-image.tsx` | PARTIALLY_STATIC per-slug | none | **yes** — `publishedNotes` (`:12-14`) | n/a | none | `getNote(slug)` → falls back to the branded card while notes are dark |
| `/decisions` | `src/app/decisions/page.tsx` | client page (`decisions/page.tsx:1`); build-artifact mode not measured | none | no | **no** — no `metadata` export and no layout file, so it inherits the root title/canonical | none | `allDecisions` from `@/lib/decisions` (bundled into the client chunk, `:7`) |
| `/admin/telemetry` | `src/app/admin/telemetry/page.tsx` | PARTIALLY_STATIC but `response:"empty"`, `compute:"blocking"`, `htmlSize:0` — no static shell; `export const instant = false` (`:13`) + `await headers()` (`:470`) + `await connection()` (`:478`) | none | no | no — exports **no** metadata at all | **HTTP Basic** twice: `src/proxy.ts` (Node runtime, `matcher: ["/admin/:path*"]`, `:22`) and again in the page via `isAdminAuthorized` (`:470`, `notFound()` on failure); both compare against `ADMIN_PASSWORD` | Upstash Redis: `anvilry:trace:<kind>` sorted sets, `anvilry:eval:latest`, `anvilry:github:stats:latest`, `anvilry:seo:audit:latest`, `anvilry:content:audit:latest`, `anvilry:health:latest`, `anvilry:corpus:built_at` |
| `/opengraph-image` | `src/app/opengraph-image.tsx` | static image route (prerendered) | none | no | n/a | none | `profile`, `METADATA_COLORS` |
| `/icon` | `src/app/icon.tsx` | static image route | none | no | n/a | none | none |
| `/apple-icon` | `src/app/apple-icon.tsx` | static image route | none | no | n/a | none | none |
| `/manifest.webmanifest` | `src/app/manifest.ts` | static metadata route | none | no | n/a | none | `profile`; icon routes `/icon` + `/apple-icon` (`manifest.ts:15-19`) — the two `/static/screenshot-*.png` entries were removed, see FIXED note below |
| `/robots.txt` | `src/app/robots.ts` | static metadata route | none | no | n/a | none | none (hardcoded sitemap URL, `robots.ts:16`; `Content-Signal` at `:14`) |
| `/sitemap.xml` | `src/app/sitemap.ts` | static metadata route | none | no | n/a | none | all four Velite collections + `ARTICLES_ENABLED`/`NOTES_ENABLED`/`STATS_ENABLED`/`SEARCH_ENABLED`; `/decisions` is **not** listed |
| 404 fallback (`/_not-found`) | `src/app/not-found.tsx` | prerendered (`.next/server/app/_not-found.html`); page is `"use client"` | none | no | no (client component) | none | `Terminal`, `bootBanner404()`, `NEXT_PUBLIC_404_ORB` (`not-found.tsx:34`) |
| root error boundary (`/_global-error`) | `src/app/global-error.tsx` | prerendered (`.next/server/app/_global-error.html`) | none | no | no | none | dynamic `import("@/lib/telemetry/beacon")` |
| segment error boundary | `src/app/error.tsx` | client boundary, no URL of its own | n/a | no | no | none | dynamic `import("@/lib/telemetry/beacon")` |

## Detail

### `src/app/layout.tsx`
- **Role:** the single root layout for every route — fonts, global metadata/viewport, `<head>` scripts and JSON-LD, and the one place every global client mount lives.
- **Exports:** `viewport` (`Viewport`) — `themeColor:"#07080d"`, `colorScheme:"dark light"`, `viewportFit:"cover"` (`:38-45`; `colorScheme` is a browser-UI hint only, the static `theme_color`/`background_color` stay dark). `metadata` (`Metadata`) — `metadataBase: new URL("https://anvilry.vercel.app")`, title template `` `%s — ${profile.name}` ``, 9 `keywords`, `openGraph`, `twitter.images:[siteUrl + "/opengraph-image"]`, `robots:{index:true,follow:true}` (`:47-80`). default `RootLayout` (**async** server component).
- **Reads / depends on:** `next/font/google` `Inter` → `--font-sans`, `JetBrains_Mono` → `--font-mono` (`:24-33`); `./globals.css`; `@/lib/profile`; `hasNotes`/`hasArticles` from `@/lib/content` (`:19`, passed to `SiteNav` at `:133`); `getDiscoveryBadgesEnabled()` from `@/lib/flags` (`:85`); `OPEN_TO_WORK` from `@/lib/writing-flags` (renders `OpenToWorkBanner`, `:134`); `@vercel/analytics/next`, `@vercel/speed-insights/next`.
- **`<head>`:** the first child is an inline **no-flash theme script** that reads `localStorage["anvilry:theme"]` and sets `document.documentElement.dataset.theme` to `"light"`/`"dark"` before hydration (`:114-119`, persisted store in `src/lib/theme-context.tsx`); then `PersonJsonLd`, `WebSiteJsonLd`, `FaqJsonLd` (`:120-122`). A light palette exists (`[data-theme="light"]`, `globals.css:54`); `METADATA_COLORS` and the manifest remain dark-only.
- **Client boundary:** `Providers` (`src/components/providers.tsx:1` is `"use client"`) wraps `SiteNav`, `OpenToWorkBanner` (flag), the `#main-content` div holding `children`, `SiteFooter`, `CommandPalette`, `AskPortfolio`, `TalkModeMount`, `AnvilInlinePanel`, `AnvilCoreSurface`, `WakeWordController`, `ViewHint`, `EasterEggs` (`:132-161`). `Providers` mounts `MotionConfig reducedMotion="user"` → `ViewProvider` → `TooltipProvider` → `ScrollFlagsSync`, plus lazily `InkTransition` and (conditionally) `DiscoveryBadge` (`providers.tsx:52-62`). `ViewProvider` mounts `ViewQuerySync` (`src/components/view-context.tsx:236,262`), the post-hydration `?view=` applier.
- **Behaviour notes:** `discoveryBadgesEnabled` is resolved **server-side** and threaded in as a prop because `Providers` is a client component (`:85`, `:132`, `:143`). `data-scroll-behavior="smooth"` on `<html>` re-opts into Next 16's scroll override so the `scroll-behavior: smooth` in `globals.css:92` still applies to in-page anchors (`:86-90`, `:102`). `suppressHydrationWarning` is set on exactly `<html>`, `<head>`, `<body>` (`:104`, `:106`, `:126`) — browser extensions inject attributes on those three before hydration; the flag does not cascade to children, so real mismatches inside the app still surface (`:92-98`).
- **Gotchas / invariants:** `siteUrl` is **hardcoded** at `:35`; the base URL appears in many more files than this one — run `grep -rn 'anvilry\.vercel\.app' src Makefile` rather than trust any list (it currently matches 33 lines in 24 files, tests included). The `<a href="#main-content" className="skip-link">` at `:129` must stay the first focusable element (WCAG 2.4.1) and pairs with `#main-content tabIndex={-1}` at `:137`. Removing a `suppressHydrationWarning` re-opens the bug that `layout.hydration-proof.dom.test.tsx` locks down.

### `src/app/page.tsx`
- **Role:** the `/` homepage and the sole entry point for the multi-view system.
- **Exports:** `metadata` — only `alternates:{canonical:"/"}` (`:15-17`); default `Home` (sync server component, `:19`).
- **Reads / depends on:** `@/components/view-router`; home sections `Hero`, `FeaturedWork`, `FeaturedProjects`, `Achievements`, `WritingPreview`, `Testimonials`, `Contact` (rendered in that order, `:26-32`).
- **Behaviour notes:** the Classic `<main>` is server-rendered and handed to `ViewRouter` as `children` (`:24-34`). `ViewRouter` (`src/components/view-router.tsx:52`) keeps Classic **mounted but `hidden`** (`:58`) and lazily mounts the other views with `ssr:false`; the gamified view is **unmounted** (not hidden) when inactive so R3F can dispose the WebGL context (`view-router.tsx:17-20`). The GitHub stats strip is **not** in this file: `GithubStatsStrip` is rendered by `components/home/hero.tsx` when `GITHUB_STATS_ENABLED` is on (`hero.tsx:159-165`).
- **Gotchas / invariants:** the canonical is pinned to the bare `"/"` on purpose — a literal self-canonical would canonicalize each `?view=` variant to itself (`:11-14`). `ViewRouter` is imported **nowhere else** in `src/app`: `/` is the only route with the view switcher. `ViewRouter` branches on **six** views — `classic`, `chat`, `gamified`, `developer`, `voice`, `resume` (`view-router.tsx:58-69`; union at `view-context.tsx:24`), each optional one gated by `isViewEnabled()` / `NEXT_PUBLIC_ENABLED_VIEWS`. `CLAUDE.md` states the same ("six members"; "four-view" only names the switcher's default server-rendered pill set).

### `src/app/error.tsx`
- **Role:** route-segment error boundary for every page/nested layout below the root layout.
- **Exports:** default `RouteError` (client) — props `{ error: Error & { digest?: string }, unstable_retry?, reset? }` (`:41-52`).
- **Behaviour notes:** accepts **both** `unstable_retry` (Next 16.2+ canonical) and the legacy `reset`, and calls `retry = unstable_retry ?? reset` (`:84`); the "Try again" button only renders when one exists (`:104`). On mount it stamps `window.__anvilry_error_recently__ = Date.now()` **before** beaconing (`:54-59`), then `import("@/lib/telemetry/beacon")` dynamically and calls `sendErrorBeacon({ source:"boundary", ... })` (`:64-77`). The import's `.catch()` is an intentional silent swallow so telemetry can never regress recovery (`:78-81`).
- **Gotchas / invariants:** `DEDUPE_FLAG = "__anvilry_error_recently__"` (`:39`) is a **shared string contract** with `global-error.tsx:34` and `src/instrumentation-client.ts` (100 ms dedupe window; the constant is duplicated, not imported). Renaming it in one place double-counts every error. Next 16 boundaries do not surface React's `componentStack`, so none is sent. `error.digest` is rendered verbatim (`:96-101`) because it is the only user-pasteable correlation key to a server log line.

### `src/app/global-error.tsx`
- **Role:** last-resort boundary for errors thrown *inside* `src/app/layout.tsx` or its providers.
- **Exports:** default `GlobalError` (client), same prop shape as `error.tsx`.
- **Behaviour notes:** renders its **own** `<html>`/`<body>` (`:84-85`) because the root layout has already unwound. Zero `@/components` imports — no `Providers` context exists at this point. All load-bearing styling is inline `style` objects whose values come from the shared `METADATA_COLORS` constant (`:32` import; e.g. `:93-94`), since `globals.css` may not have been applied yet. Beacons `source:"global-boundary"` (`:63`) so the sink can distinguish a layout crash from a route crash.
- **Gotchas / invariants:** the "Back to homepage" link is a **plain `<a>`**, not `next/link`, with `@next/next/no-html-link-for-pages` disabled on purpose (`:175`) — the router context is part of what unwound, so a full navigation is the safer recovery. `METADATA_COLORS` (`src/lib/metadata-colors.ts`) mirrors the dark `:root` tokens (`globals.css:8-35`) by name, by convention only — there is no test tying them together.

### `src/app/not-found.tsx`
- **Role:** the 404 page, implemented as a fully functional developer terminal pre-seeded with a fake kernel-panic boot sequence.
- **Exports:** default `NotFound` (client).
- **Reads / depends on:** `Terminal` and `bootBanner404()` from `@/components/game/terminal/*` (`:24-25`), `WebGLBoundary`, `VoiceOrb3D` (dynamic, `ssr:false`), `process.env.NEXT_PUBLIC_404_ORB`.
- **Behaviour notes:** `showOrb` is read at **module scope** (`:34`) — `NEXT_PUBLIC_404_ORB === "true"` adds a distressed `errorMode` 3D orb above the terminal, wrapped in `WebGLBoundary` and `aria-hidden` (`:42-54`). The visible eyebrow `// 404 :: route-not-found` (`.mono-label.glitch-eyebrow`, `:60`) is decorative; the real a11y anchor is an `sr-only <h1>Page not found</h1>` (`:67`). `Terminal` gets `initialLines={bootBanner404()}` and `maxHeightClass="max-h-96"` (`:69-73`).
- **Gotchas / invariants:** the glitch animation class `.glitch-eyebrow` is defined in `globals.css:414-420` and only there. It renders inside the root layout, so all `Providers` are available. `cd /` in the terminal is the documented in-terminal escape hatch, surfaced as visible copy at `:85`.

### `src/app/admin/telemetry/page.tsx`
- **Role:** request-time operations dashboard reading a rolling 24 h window of telemetry out of Upstash Redis.
- **Exports:** `instant = false` (route segment config, `:13`); default `TelemetryDashboard` (async server component, `:464`). Exports **no** `metadata`.
- **Reads / depends on:** `redis` singleton from `@/lib/redis`; `KIND_LITERALS` + `TelemetryEvent` from `@/lib/telemetry/schema`; `isAdminAuthorized` from `@/lib/admin-auth`; `unstable_noStore as noStore` from `next/cache`; `headers` from `next/headers`; `connection` from `next/server`.
- **Auth:** two layers, same check. `src/proxy.ts` (matcher `["/admin/:path*"]`, `:22`) returns a real 401 + `WWW-Authenticate: Basic realm="anvilry"` via `isAdminAuthorized(req.headers.get("Authorization"))` (`:26-31`); the proxy runs on the **Node.js runtime** and describes itself as "the first filter, not the only gate" (`:15-18`). The page then re-checks with `isAdminAuthorized((await headers()).get("Authorization"))` and calls `notFound()` on failure before any Redis read (`:464-470`; pages cannot emit a 401 challenge). `isAdminAuthorized` (`src/lib/admin-auth.ts`) accepts `password` or `user:password`, ignores the username, compares SHA-256 digests with `crypto.timingSafeEqual`, and denies everything when `ADMIN_PASSWORD` is unset. The same function backs `requireAdmin` for route handlers (e.g. `/api/admin/faq-cache/purge`), which the proxy matcher does **not** cover. `src/app/admin/telemetry/page.test.tsx` pins the page-level check: no credential and a wrong credential end in `notFound()` with no `redis.zrange` call, an unset `ADMIN_PASSWORD` also ends in `notFound()`, and a correct credential renders and reads Redis.
- **Behaviour notes:** `await connection()` at `:478` is what makes the segment request-time — under `cacheComponents` the synchronous `Date.now()` at `:480` would otherwise fail the prerender ("encountered the unstable value `Date.now()`"), and the comments at `:6-12` and `:471-477` record that `instant = false` alone does **not** clear synchronous-IO errors. `await headers()` is itself request-time data. Nine top-level reads are issued in one `Promise.all` (`:483-503`): `fetchAll` fans out one `zrange` per `KIND_LITERALS` entry (8 kinds: `http.request`, `llm.attempt`, `tts.request`, `transcribe.request`, `client.error`, `server.error`, `budget.tick`, `chat.cache`), then duplicate `fetchKind` calls for `tts.request` and `transcribe.request`, then six single-key reads — about 16 Redis commands per load. Every fetch helper is fail-soft: `fetchKind` returns `[]` and `fetchRedisJson` returns `null` on any throw or when `redis` is falsy (`:22-42`, `:229-239`). `fetchAll` calls `noStore()` (`:45`). The FAQ response cache has its own tile — "FAQ cache hit rate" — computed by `faqCacheStats` (`:135-158`, tile `:581-587`) from `chat.cache` events (`outcome === "hit"` / all events, `saved_usd` summed on hits); `chat.cache` is kept separate from `llm.attempt` so cache hits never distort the token/cost tiles. `budget.tick` is fetched and listed in the recent-events table but has no tile.
- **Gotchas / invariants:** The "saved by caching" tile is priced per model: `costSummary` (`:115-133`) sums each attempt's recorded `cost_usd` and adds `cacheReadSavingsUsd(model, usage)` from `src/lib/llm-pricing.ts` (imported at `:16`) for the saving — the cache-read tokens at the full input price minus the cache-read price, before the cache-write premium, and nothing for a model with no verified price. It replaced a flat `CACHE_READ_PRICE_PER_MTOK = 0.3`, which ignored the model and was the price of a cache *read*, not what reading from the cache saved. Token accounting reads **snake_case** Anthropic field names — `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` (`:54-81`, `:115-133`); `src/lib/llm.test.ts` is the regression guard for those names. Redis key names are string literals in this file: `anvilry:trace:${kind}` (`:29`), `anvilry:eval:latest` (`:244`), `anvilry:github:stats:latest` (`:278`), `anvilry:seo:audit:latest` (`:281`), `anvilry:content:audit:latest` (`:284`), `anvilry:health:latest` (`:287`), `anvilry:corpus:built_at` (`:293`) — they must match whatever `/api/cron/*` and `src/instrumentation.ts` write. Warn thresholds are inline magic numbers: fallback > 20 % (`:598`), error rate > 5 % (`:620`), TTS P95 > 3000 ms (`:742`), transcribe P95 > 5000 ms (`:761`), eval < 80 % warn / ≥ 90 % accent (`:771-772`), corpus stale > 7 days (`:548`). The events table is capped at the last 100 events (`:521`).

### `src/app/decisions/page.tsx`
- **Role:** `/decisions` — a filterable ledger of architecture and engineering tradeoffs drawn from project and case-study frontmatter.
- **Exports:** default `DecisionsPage` (`"use client"`, `:1`). **No** `metadata` and no `layout.tsx` (the directory holds only `page.tsx`), so the route inherits the root title and has no canonical/OG of its own.
- **Reads / depends on:** `allDecisions` and `LedgerEntry` from `@/lib/decisions` (`:7`) — the ledger is content-derived and lands in the client bundle. `src/lib/decisions.ts` flattens `Project.decisions` (id `project:<slug>:<i>`) and, per case study, at most two entries `work:<slug>:constraints` / `work:<slug>:tradeoffs` (titles fixed "Constraints"/"Tradeoffs", `tags: []`); order is all project entries, then all work entries. Current content: 11 projects × 3 decisions = 33, plus 5 case studies × 2 = 10, so 43 entries. The MCP tool `list_decisions` reads the same `allDecisions` through `listDecisionsData` (`src/lib/mcp-tools.ts:214`).
- **Behaviour notes:** filter state is two `useState` values (`:21-24`): category (`All` / `Professional` = work / `Open Source` = project, `:11-18`, rendered as a `role="radiogroup"`, `:65`) and tag. There is **no URL state** (no `useSearchParams`/router), so filters reset on reload and cannot be deep-linked. Category filters first (`byCategory`, `:30-36`); tag options are the sorted tags present in that category (`:38-42`); the tag rail (`aria-pressed` buttons) renders only when `tagOptions.length > 2` (`:106`). Cards show source name, title, body and a "View source" link to `e.href` (`:167-178`); the empty state reads "No decisions found for this filter." (`:187`).
- **Gotchas / invariants:** **no decision currently carries tags** — no project frontmatter decision has a `tags` key and work entries hardcode `[]` — so `tagOptions` is always `["all"]` and the tag rail never renders today (`src/lib/decisions.test.ts` records this as a deliberate YAGNI and only asserts `decisionsByTag("nonexistent-tag")` is empty). The route is reachable from the command palette (`components/command-palette-content.tsx:264-268`, `id:"decisions"`), the footer ("Decisions & rationale", `components/site-footer.tsx:134`) and a closing "Decisions" link on the `/projects` and `/work` index pages (`projects/page.tsx:85`, `work/page.tsx:84`); it is not in `site-nav` and not in `sitemap.ts`, so crawlers only find it through those links.

### `src/app/projects/page.tsx`
- **Role:** `/projects` index — performs a live network fetch during render (`getRepoFeed()`).
- **Exports:** `metadata` (with page-specific `openGraph`, `:13`); default `ProjectsPage` (async).
- **Behaviour notes:** the function body opens with the `"use cache"` directive followed by `cacheLife("hours")` (`:39-40`). The comment at `:32-37` records why: `export const revalidate = 3600` is rejected under `cacheComponents`, and the built-in `"hours"` profile is `{ stale: 300, revalidate: 3600, expire: 86400 }` (per that comment, citing `node_modules/next/dist/server/config-shared.js`) — an earlier `.next` build showed `initialRevalidateSeconds: 3600` / `initialExpireSeconds: 86400`. `getRepoFeed()` is awaited server-side (`:42`) and the `GithubFeed` block renders only when `repos.length > 0` (`:57`), so a GitHub failure degrades to hiding the strip.
- **Gotchas / invariants:** `"use cache"` must remain the **first statement** of the function body. `/work` and `/notes` deliberately have no cache directive because their only input is the build-time Velite import (`work/page.tsx:9-13`, `notes/page.tsx:9-11`) — do not "restore consistency" by adding one. `/projects/[slug]` is the other cached page; see its section below.

### `src/app/articles/[slug]/page.tsx`
- **Role:** article detail route that mostly exists to *redirect* — to an internal note or to the original publication.
- **Exports:** `generateStaticParams`, `generateMetadata`, default `ArticlePage` (async).
- **Behaviour notes:** `getArticle` reads `allArticles`, which (in `src/lib/content.ts`) already drops articles whose only destination is a note while `NOTES_ENABLED` is off, so those slugs 404 at `getArticle` (`:66-67`). Remaining ordered branches: (1) `article.linkedNote && NOTES_ENABLED` → `redirect(\`/notes/${linkedNote}\`)` (`:71-73`); (2) non-`native` source with an `externalUrl` → `redirect(url)`, but **only** after asserting the URL starts with `https://` or `http://`, otherwise `notFound()` (`:77-81`); (3) `linkedNote && !externalUrl && !NOTES_ENABLED` → `notFound()` (`:84-86`) — now a defensive branch, unreachable in practice because `allArticles` has already removed those articles. Only native, non-linked articles render the MDX body, with `BlogPosting` JSON-LD (`:88-97`, `:137`) and `BreadcrumbJsonLd` (`:138-144`). `generateMetadata` canonical prefers `article.canonicalUrl`, then `externalUrl`, then the local path (`:58-60`). `SOURCE_LABELS` (`:30-37`) is typed `Record<ArticleSource,string>`.
- **Gotchas / invariants:** the protocol allowlist at `:79` is the open-redirect guard (`javascript:`/`data:` URLs 404 instead of redirecting) — do not relax it. `generateStaticParams` still applies its own `linkedNote && !externalUrl && !NOTES_ENABLED` filter (`:39-45`) and `sitemap.ts` applies an identical one; with `allArticles` doing the stripping first, both are redundant subsets, so the page, its OG image (`opengraph-image.tsx:29-31`, plain `allArticles.map`) and the sitemap now agree on the slug set. `BASE = "https://anvilry.vercel.app"` is hardcoded at `:13` (also `notes/[slug]/page.tsx:13`, `projects/[slug]/page.tsx:23`, `work/[slug]/page.tsx:11`).

### `src/app/notes/[slug]/page.tsx`
- **Role:** note detail page with reading-progress bar and `BlogPosting` structured data.
- **Exports:** `generateStaticParams`, `generateMetadata`, default `NotePage` (async).
- **Behaviour notes:** notes are hidden at the data layer: `allNotes` in `src/lib/content.ts` is `[]` while `NOTES_ENABLED` is off, and `publishedNotes` is the raw (non-draft, newest-first) list kept for the `/notes` route files only. `generateStaticParams` returns **every** `publishedNotes` slug with no flag check; the comment at `:16-24` records that the previous `if (!NOTES_ENABLED) return []` short-circuit was removed because `cacheComponents` hard-requires at least one result and an empty array failed the build outright. User-visible behaviour is unchanged: the page calls `notFound()` when the flag is off (`:51`) and again when `getNote` (which reads `allNotes`) misses (`:53`) — the routes are simply prerendered *as 404s*. `generateMetadata` mirrors the guard and returns `{}` when the flag is off (`:34`) to avoid emitting partial metadata for a 404. `notes/[slug]/opengraph-image.tsx` likewise maps `publishedNotes` (`:12-14`) but its `getNote` (`:24`) misses while dark, so it renders the branded fallback card.
- **Gotchas / invariants:** do not "optimise" `generateStaticParams` back to an early empty return — it breaks the build — and do not switch it to `allNotes` for the same reason. Because llms.txt, the feed, MCP, the chat corpus and the `.md` handlers read `allNotes`, notes cannot leak through those surfaces while the flag is off. Mounts `ReadingProgress` (`:68`), which `/articles/[slug]` and `/work/[slug]` do not.

### `src/app/articles/page.tsx`
- **Role:** `/articles` index: platform filter pills, a featured hero card, and a deduplicated 2-column grid.
- **Exports:** default `ArticlesPage` — `"use client"` (`:1`), therefore **no** metadata export; metadata lives in `articles/layout.tsx`.
- **Reads / depends on:** `allArticles`, `inkforgeArticles`; `INKFORGE_ARTICLES_ENABLED`, `NOTES_ENABLED`; `groupArticles`, `getGroupSources`, `filterGroupsBySource` from `@/lib/article-grouping`; `ArticleGroupCard`, `NoteCard`, `PlatformBadge`.
- **Behaviour notes:** `visibleInkforge` and `grouped` are computed at **module scope** (`:44`, `:47`), not per render. `notFound()` is called from inside the client component when `allArticles.length === 0` (`:50`). The filter bar only renders when more than two options exist (`:115`). The featured card's href resolution order is: `linkedNote` (when `NOTES_ENABLED`) → `canonical.externalUrl` → first external platform's `externalUrl` → `canonical.url` (`:198-206`); `target="_blank"` is added only for non-native sources with an `externalUrl` (`:207-210`). Per-platform badges are `<button>`s inside the card `<Link>` that `stopPropagation()` + `preventDefault()` and `window.open(...)` (`:224-227`).
- **Gotchas / invariants:** `SOURCE_LABELS` (`:34-41`) is typed `Record<ArticleSource,string>` and must stay in step with the Velite `source` enum `["medium","substack","linkedin","devto","hashnode","native"]` (`velite.config.ts:123-130`); it is one of four article-source label maps (with `articles/[slug]/page.tsx:30`, `articles/[slug]/opengraph-image.tsx:20`, `components/platform-badge.tsx`) — the OG copy is deliberately lowercase (`"> dev.to"`), the others Title Case.

### `src/app/articles/layout.tsx`
- **Role:** metadata carrier **and** the route-level kill switch for the whole `/articles` subtree.
- **Behaviour notes:** `if (!ARTICLES_ENABLED) notFound()` (`:12`) — this is the only flag gate that lives in a layout, so it also 404s `/articles/[slug]`. `ARTICLES_ENABLED` defaults **on** (`writing-flags.ts:19-20`: `!== "false"`), unlike `NOTES_ENABLED` which defaults off (`:22`: `=== "true"`).

### `src/app/resume/page.tsx`
- **Role:** `/resume` — a client page with a segmented PDF/Web toggle (**default tab `web`**, `:21`), an iframe PDF preview with shimmer skeleton, and a flag-gated `<details>` list of role-targeted variants.
- **Exports:** default `ResumePage` (`"use client"`).
- **Behaviour notes:** `master = resumeVariants[0]` and `otherVariants = resumeVariants.slice(1)` are module-scope (`:17-18`); `src/lib/profile.ts:136` defines a single canonical variant today. `showVariants` is read **inside the function body**, not at module scope, explicitly so `vi.stubEnv` works in tests (`:28-29`, used at `:168`). The PDF iframe is **desktop-only**: `isDesktop = useMediaQuery("(min-width: 768px)")` (`:26`) selects the iframe (`:116`, `:132-133`); below 768 px the tab shows a Download-PDF CTA instead (`:143-157`). The `"web"` tab renders `ResumeViewInline` (`:225`) — the *Inline* variant exists specifically to avoid nesting two `<main>` landmarks (`src/components/home/resume-view.tsx:331,339`).
- **Gotchas / invariants:** the PDF `<iframe src={master.file}>` only works because `next.config.ts:236-237` applies a `frame-ancestors`-relaxed `resumeHeaders` CSP override (built at `:218-231`) to `/resume` and `/resume/:path*`. `e2e/resume.spec.ts` covers both flag states of `NEXT_PUBLIC_RESUME_VARIANTS`.

### `src/app/search/page.tsx`
- **Role:** `/search` — mounts the statically generated Pagefind UI bundle.
- **Behaviour notes:** augments the global `Window` type with `PagefindUI` (`:9-16`), then in a `useEffect` appends `/pagefind/pagefind-ui.css` and `/pagefind/pagefind-ui.js` to `document.head` and constructs `new window.PagefindUI({ element:"#pagefind-search", showImages:false, resetStyles:true })` in `script.onload` (`:20-45`). The `onload` handler is guarded against double-init (`container.children.length === 0`, `:38`) because it has been observed firing more than once per script (root cause "not fully isolated", `:27-34`); do not remove the guard. The cleanup removes both nodes (`:48-51`).
- **Gotchas / invariants:** the bundle is produced by `pnpm build` (its script ends in `pagefind --site .next/server/app --output-path public/pagefind`) and can be regenerated alone with `make search-index` — there is no `pnpm search-index` script; in dev the effect is a silent no-op (`:6-8`). `SEARCH_ENABLED` does **not** gate this route — see the cross-cutting note below.

### `src/app/stats/page.tsx`
- **Role:** `/stats` — six "by the numbers" tiles.
- **Behaviour notes:** `totalCommits` and the `stats` array are computed at **module scope** (`:6-27`), so they are frozen at build time. Four values derive from Velite (`allProjects.length`, summed `commits`, `allArticles.length + allNotes.length` — notes contribute 0 while dark) and from `profile.company`/`profile.tenure`; two are hand-written string literals — `"2K+"` / `"Pensieve at peak"` and `"3K+"` / `"AAVA Code at peak"` (`:19-20`, both labelled "Daily users"). It reads no GitHub or Redis data. Tiles are keyed `${label}-${sub}` and separated by literal `{" "}` spacers so Pagefind excerpts keep word boundaries.
- **Gotchas / invariants:** those two hardcoded figures are the only numbers on this page not derived from a single source — `CLAUDE.md` / `ARCHITECTURE.md` require metrics to be real and non-fabricated, so they must track the `impactMetrics` in `@/lib/profile` by hand. `/about` derives the same figures from `impactMetrics`, so the two pages can drift.

### `src/app/about/page.tsx`
- **Role:** `/about` — bio prose plus optional `// now` and `// uses` sections and the `// skills` grid.
- **Behaviour notes:** destructures `const [pensieve, aava] = impactMetrics` (`:27`) and interpolates `pensieve.value` / `aava.value` into the prose so the numbers cannot drift from `@/lib/profile` (`:40`). It also interpolates `allProjects.length` for the repo count (`:47`). The `// now` and `// uses` blocks are empty-safe, gated on `hasNow` (`:58`) and `hasPersonalContent && personal.uses.length > 0` (`:80`). `formatUpdated` (`:10`) forces `timeZone:"UTC"` so the "Last updated" date never drifts by locale. Emits `ProfilePageJsonLd` (`:119`).
- **Gotchas / invariants:** the prose assumes `impactMetrics` has at least two entries in Pensieve-then-AAVA order (`:27`); reordering that array silently swaps the two numbers in the sentence.

### `src/app/mcp/page.tsx`
- **Role:** `/mcp` — human-readable MCP server documentation.
- **Behaviour notes:** `ENDPOINT = "https://anvilry.vercel.app/api/mcp/mcp"` is a module constant (`:6`) interpolated into both the Claude Desktop config (`npx -y mcp-remote <ENDPOINT>`, `:26`) and the Cursor config (`{ "url": <ENDPOINT> }`, `:33`). The `TOOLS` array (`:40-60`) lists **all 10** tools registered by `src/app/api/mcp/[transport]/route.ts` — ten `server.registerTool(` calls at `route.ts:20`, `:30`, `:40`, `:49`, `:59`, `:68`, `:78`, `:88`, `:98`, `:109` (the tenth is `list_decisions`); see [02 § `src/app/api/mcp/[transport]/route.ts`](./02-api-routes.md#srcappapimcptransportroutets). History: the table once under-reported the server (7, then 9 rows); it is now complete and guarded.
- **Gotchas / invariants:** `TOOLS` is a **hand-maintained** list, not derived from `src/lib/mcp-tools.ts`, but it is guarded. `src/app/mcp/tools-documented.test.ts` reads both this file's `TOOLS` block and the `server.registerTool(...)` names in the route **from source** (neither is importable without widening a module-private surface) and asserts the two sets are identical: no undocumented registration (`:81-88`), no documented tool the route does not register (`:76-79`), equal counts and equal sorted sets (`:90-93`), plus a regex-drop cross-check so a name the pattern misses fails loudly instead of reading as "already documented" (`:61-74`). `vitest run` is chained into `pnpm build`, so adding a tool without a `TOOLS` row **fails the build** with the missing names in the message. Segment config: this file exports **no** `dynamic`/`revalidate`, and `CLAUDE.md` documents `/mcp` as "no segment config". A `force-static` grep over `src/app` returns no non-API file.

### `src/app/work/[slug]/page.tsx`
- **Role:** case-study detail page.
- **Behaviour notes:** `generateMetadata` (`:17`) sets a page-specific `openGraph`/`twitter` because Next merges metadata segments shallowly and replaces nested objects wholesale — without it the page inherits the root layout's homepage `og:title`/`og:url`; the file-based `opengraph-image.tsx` keeps the share *image* correct (`:26-44`). Three optional blocks render only when the owner authored them: `work.constraints` (`:105`), `work.tradeoffs` (`:114`), `work.diagram` (`:123`). The diagram uses a plain `<img>` with `@next/next/no-img-element` disabled (`:130`), and falls back to `` `${work.name} architecture diagram` `` when `diagramAlt` is absent (`:133`). Emits `BreadcrumbJsonLd` and `CreativeWorkJsonLd` (`:142-154`).
- **Gotchas / invariants:** `CLAUDE.md` records that three graph node IDs intentionally differ from these slugs (`aava` → `aava-code`, `grpc` → `grpc-microservices`, `nhl` → `not-humans-lab`) and that `game-model.test.ts` blocks deploys on orphaned nodes — renaming a work slug breaks that bijection test.

### `src/app/projects/[slug]/page.tsx`
- **Role:** project detail page; the second cached page after `/projects`.
- **Behaviour notes:** the whole `ProjectPage` function is a cache boundary — `"use cache"` must be its first statement (`:69`) followed by `cacheLife("hours")` (`:70`), because `fetchRepo()` + `pushedAgo()` call `Date.now()`, which `cacheComponents` rejects in an otherwise-static page (comment `:65-68`). `fetchRepo(profile.githubUser, repoName)` (`:80`) derives the repo name from the last path segment of `project.repo` and fails open (`null`) on a private/renamed/non-allowlisted repo, so "updated X ago" can be up to ~1 h stale. `relatedArticles` come from `getArticle()` over `project.relatedArticles` and render through `RelatedWriting` (`:83-85`, `:171`). `generateMetadata` (`:29`) sets page-specific `openGraph`/`twitter` (`:46-56`). Reading time is computed **inline in an IIFE during render** from the compiled MDX body — strip tags, collapse whitespace, split on spaces, `words / 200` rounded, minimum 1 min, and the badge is suppressed entirely below 100 words (`:105-121`). Emits `SoftwareSourceCodeJsonLd` + `BreadcrumbJsonLd` (`:174-189`).
- **Gotchas / invariants:** the `200` words-per-minute and `100`-word floor are inline magic numbers with no shared constant. Adding `cookies()`/`headers()` inside this function would break the prerender. `project.repo` is rendered as an external `<a target="_blank" rel="noopener noreferrer">` (`:124-128`); the Velite schema validates it as a URL (`velite.config.ts:29`).

### `src/app/{articles,notes,projects,work}/[slug]/opengraph-image.tsx`
- **Role:** four near-identical `next/og` `ImageResponse` generators producing one 1200×630 PNG per content slug.
- **Exports (each):** `size = { width: 1200, height: 630 }`, `contentType = "image/png"`, `alt` (string literal per collection: `"Article"`, `"Note"`, `"Open-source project"`, `"Work case study"`), `generateStaticParams`, default async component.
- **Behaviour notes:** each falls back to `profile.name` / `profile.role` when the slug misses, so a bad slug still yields a branded card instead of throwing (`articles:41-51`, `notes:24-33`, `projects:23-24`, `work:25-26`). Layout differs only in the eyebrow and third line: articles show a source-derived label from `SOURCE_LABEL` (`articles:20-27`, `Record<ArticleSource,string>`) plus the date, notes show `"> note"` plus the date, projects show `"> <group>"` (or `"> open source"`) plus tagline (`projects:51,73`), work shows `"> <register>"` plus `metrics[0].value · metrics[0].label` (`work:53,75`).
- **Gotchas / invariants:** colours come from the shared `METADATA_COLORS` constant in all five OG files (root included), so the flat colours are no longer hand-duplicated hex. What is still duplicated is the gradient/layout markup, and articles uniquely use an orange wash (`rgba(255,103,25,0.14)`, `articles:64`) while the others use violet+cyan. `generateStaticParams` sources differ: articles `allArticles`, notes `publishedNotes` (so note OG routes are prerendered even while `/notes/[slug]` 404s), projects `allProjects`, work `allWork`. `projects/[slug]/opengraph-image.tsx` is the one that does not hardcode the base URL.

### `src/app/sitemap.ts`
- **Role:** builds `/sitemap.xml` from a hardcoded static-route list plus every Velite collection.
- **Behaviour notes:** static routes are `["", "/work", "/projects", "/about", "/resume", "/mcp"]` at `changeFrequency:"monthly"`, priority `1` for `""` and `0.8` otherwise (`:13-24`). Work `0.7` (`:32-36`), projects `0.6` (`:26-30`); notes and articles each add an index entry (`weekly`, `0.6`, `lastModified` of the newest item) plus items (`monthly`, `0.5`, per-item `lastModified: new Date(date)`) (`:40-57`, `:64-85`); `/stats` `0.6` and `/search` `0.5` (`:87-105`). Notes require `NOTES_ENABLED && allNotes.length`; articles require `ARTICLES_ENABLED && indexableArticles.length`; `/stats` and `/search` require only their flag. `lastModified` is emitted for notes and articles only — never for the static, work, project, stats or search entries. Output order is static, work, projects, notes, articles, stats, search (`:107-115`).
- **Gotchas / invariants:** `/notes`, `/articles`, `/stats`, `/search` are absent from the hardcoded static list on purpose — they are added conditionally further down. `/decisions` is listed nowhere. The `indexableArticles` filter (`:64-66`) duplicates the `generateStaticParams` filter in `articles/[slug]/page.tsx` and is redundant now that `allArticles` already strips note-only articles while notes are dark. `base` is hardcoded (`:10`) — one of many base-URL sites (see the cross-cutting note).

### `src/app/robots.ts`
- **Role:** `/robots.txt` — `allow: "/"` for `*`, a sitemap pointer, and a Cloudflare Content Signals line.
- **Behaviour notes:** `other: { "Content-Signal": "search=yes, ai-input=yes, ai-train=no" }` (`:14`) is a stated preference, not a technical block; `ai-input=yes` is deliberate so the MCP server and `llms.txt`/`llms-full.txt` remain citable. The sitemap URL is a hardcoded absolute string (`:16`). There is no `Disallow`, so `/admin/*` is protected only by auth, not by robots.
- **Gotchas / invariants:** `src/app/robots.test.ts` pins the Content-Signal value and `allow: "/"`.

### `src/app/globals.css`
- **Role:** the single Tailwind v4 entry point, the design-token source of truth, and the home of every hand-written keyframe/utility.
- **Behaviour notes:** `@import "tailwindcss"` (`:1`); `:root` defines surfaces, text, accents and `--glow-accent` with the WCAG contrast ratios documented per token (`:8-35`); `[data-theme="light"]` re-declares the palette for the light theme (`:54-63`, contrast values flagged as unverified in the comment above it); `@theme inline` maps each token to a Tailwind `--color-*` / `--font-*` / `--radius-card` (`:65` on). `html { scroll-behavior: smooth; scroll-padding-top: 3.5rem }` — the padding clears the sticky `h-14` header for WCAG 2.2 SC 2.4.12 (`:91-105`). `:focus-visible:not(.no-focus-ring)` is a **deliberately unlayered** 3px outline rule (`:294`); the comment at `:287-293` notes unlayered CSS beats any Tailwind utility regardless of specificity, which is why `.no-focus-ring` exists as the opt-out. Named groups: `.hero-rise` (`:120`), `.terminal-cursor`/`.terminal-boot` (`:128-140`), `.anvil-orb-idle` metaball orb with `@property --anvil-swirl`/`--anvil-hue` (`:161-218`), `.skip-link` (`:302`), `.card-surface` (`:341`) / `.mono-label` (`:352`), view-transition slide keyframes keyed off `[data-view-dir="forward"|"backward"]` on `::view-transition-{old,new}(view-body)` with `site-header` pinned to no animation (`:360-392`), `.glitch-eyebrow` (`:414`), `.scroll-reveal` + `.scroll-reveal-stagger-1..6` using native `animation-timeline: view()` (`:435-447`), `.skeleton-shimmer` (`:469`).
- **Gotchas / invariants:** **ten** separate `@media (prefers-reduced-motion: reduce)` blocks exist (`:107`, `:124`, `:131`, `:139`, `:208`, `:319`, `:396`, `:418`, `:449`, `:483`; two further mentions at `:406` and `:427` are comments) — any new animation needs its own. The reduced-motion branch for the orb keeps `blur(1.4px) contrast(4.5)` and never sets `filter: none`, because dropping the filter shatters the metaballs into hard arcs (`:208-217`). The `1.4px` blur is tuned for the real 28 px host, not a preview. `view-transition-name: view-body` is set in JS at `view-router.tsx:56` — the CSS here only styles it.

### `src/app/layout.hydration-proof.dom.test.tsx`
- **Role:** a co-located `*.dom.test.tsx` (happy-dom Vitest project) that proves the extension-injected hydration warning exists and that `suppressHydrationWarning` silences it.
- **Behaviour notes:** renders a stand-in tree via `renderToString`, injects `data-locator-hook-status-message="ok"` into the server HTML **before** `hydrateRoot`, spies on `console.error`, and asserts a hydration error is present without the flag (`:54-60`) and absent with it (`:62-68`). It tests a stand-in, not the real layout, and documents itself as a lock on the fix, not a product test.
- **Gotchas / invariants:** filename must keep the `.dom.test.` infix — Vitest runs a `node` project for `*.test.ts` and a separate `dom` (happy-dom) project for `*.dom.test.*` (see `CLAUDE.md` § Testing Notes), and `NODE_ENV` is forced to `"test"` to avoid React's missing-`act()` warning.

## Cross-cutting notes

- **Metadata-in-layout pattern.** Four routes put `metadata` in a sibling `layout.tsx` instead of `page.tsx`: `/resume`, `/search`, `/articles` (all three because the page is `"use client"` and Client Components cannot export metadata) and `/stats` (whose page *is* a Server Component — the layout is not required there). `/decisions` is a client page with **neither**, so it has no metadata at all.
- **`/stats` and `/search` are NOT route-gated.** `STATS_ENABLED` and `SEARCH_ENABLED` are consumed only by `src/app/sitemap.ts:87-105` and `src/components/site-nav.tsx:53-54`. Neither `stats/layout.tsx` nor `search/layout.tsx` calls `notFound()`, so both routes render and are prerendered even with the flags off — they are merely unlinked and un-sitemapped. Contrast `/articles` (gated in the layout, `articles/layout.tsx:12`) and `/notes` (gated in the page, `notes/page.tsx:21`, and at the data layer).
- **Hardcoded base URL.** `"https://anvilry.vercel.app"` appears literally in `layout.tsx:35`, `sitemap.ts:10`, `robots.ts:16`, `mcp/page.tsx:6`, and as `const BASE` in `articles/[slug]/page.tsx:13`, `notes/[slug]/page.tsx:13`, `projects/[slug]/page.tsx:23`, `work/[slug]/page.tsx:11` (plus `feed.xml/route.ts`, `json-ld.tsx`, `llms-txt.ts` and others outside this doc's scope). The authoritative check is `grep -rn 'anvilry\.vercel\.app' src Makefile`; at this revision it matches 33 lines in 24 files (tests and OG footers included).
- **`cacheComponents` migration scars.** `work/page.tsx:9-13`, `notes/page.tsx:9-11`, `projects/page.tsx:32-37`, `projects/[slug]/page.tsx:65-68`, `notes/[slug]/page.tsx:16-24`, and `admin/telemetry/page.tsx:6-12` + `:471-477` each carry an in-file comment explaining a construct that was removed or added because `next.config.ts:203` sets `cacheComponents: true`. These comments are the only record of why `export const revalidate` is absent.
- **Client-boundary inventory (pages only).** `"use client"` appears in exactly **7** in-scope files, all at line 1: `error.tsx`, `global-error.tsx`, `not-found.tsx`, `decisions/page.tsx`, `articles/page.tsx`, `resume/page.tsx`, `search/page.tsx`. Every other page in scope is a Server Component; client interactivity on those pages comes from imported components (`Reveal`, `CopyButton`, `ReadingProgress`, `GithubFeed`, `MDXContent`, and the `Providers` subtree in the root layout).
- **Raw-markdown URLs.** `next.config.ts:240-247` rewrites `/{work,projects,articles,notes}/:slug.md` to `/api/md/<collection>/:slug`. The `src/app/<collection>/[slug].md/route.ts` files exist but are outside this doc's scope; whether the rewrite shadows them at runtime was not verified here (see UNVERIFIED) — edit `src/app/api/md/**` for the serving path.

## Coverage

- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `src/app/not-found.tsx`
- `src/app/opengraph-image.tsx`
- `src/app/icon.tsx`
- `src/app/apple-icon.tsx`
- `src/app/manifest.ts`
- `src/app/manifest.test.ts`
- `src/app/robots.ts`
- `src/app/robots.test.ts`
- `src/app/sitemap.ts`
- `src/app/globals.css`
- `src/app/layout.hydration-proof.dom.test.tsx`
- `src/app/about/page.tsx`
- `src/app/decisions/page.tsx`
- `src/app/mcp/page.tsx`
- `src/app/mcp/tools-documented.test.ts`
- `src/app/resume/page.tsx`
- `src/app/resume/layout.tsx`
- `src/app/search/page.tsx`
- `src/app/search/layout.tsx`
- `src/app/stats/page.tsx`
- `src/app/stats/layout.tsx`
- `src/app/admin/telemetry/page.tsx`
- `src/app/admin/telemetry/page.test.tsx`
- `src/app/articles/page.tsx`
- `src/app/articles/layout.tsx`
- `src/app/articles/[slug]/page.tsx`
- `src/app/articles/[slug]/opengraph-image.tsx`
- `src/app/notes/page.tsx`
- `src/app/notes/[slug]/page.tsx`
- `src/app/notes/[slug]/opengraph-image.tsx`
- `src/app/projects/page.tsx`
- `src/app/projects/[slug]/page.tsx`
- `src/app/projects/[slug]/opengraph-image.tsx`
- `src/app/work/page.tsx`
- `src/app/work/[slug]/page.tsx`
- `src/app/work/[slug]/opengraph-image.tsx`

## UNVERIFIED

- The `compute` / `response` / `initialRevalidateSeconds` values in the Route matrix (and the `.next/server/app/_not-found.html` / `_global-error.html` prerender claims) come from a **local, gitignored build** of an earlier tree. No `.next` exists in the worktree this revision was checked against, so they were not re-measured; a fresh `pnpm build` is needed to confirm them, and the `/decisions` render mode has never been read from an artifact. They also reflect whatever `NEXT_PUBLIC_*` values that build used (notably `NEXT_PUBLIC_NOTES_ENABLED`, which changes which note slugs appear); the segment-config columns are read from source and are not env-dependent.
- Whether `/articles/<slug>` entries that `redirect()` emit a prerendered artifact was not confirmed — several article slugs present in `generateStaticParams` have an `opengraph-image` entry in the prerender manifest but no page entry, which is consistent with the redirect path but not proven.
- Whether the `next.config.ts` rewrites for `/<collection>/:slug.md` shadow the in-tree `src/app/<collection>/[slug].md/route.ts` handlers (an earlier `routes-manifest.json` listed them under `staticRoutes` with a regex lacking `.md`) needs a live `curl` or fresh build.
- The `"hours"` `cacheLife` profile values (`stale 300 / revalidate 3600 / expire 86400`) are taken from the code comment in `projects/page.tsx:32-35`, not re-verified against the installed Next release.

## Verified defect worth recording — FIXED

**Was**: `src/app/manifest.ts` declared two PWA `screenshots` at `/static/screenshot-desktop.png` (1280×800, `form_factor:"wide"`) and `/static/screenshot-mobile.png` (390×844, `form_factor:"narrow"`) while no file matching `*screenshot*` existed anywhere under `public/` — so both URLs 404'd in every environment.

**Now**: the `screenshots` key is **deleted**. `manifest()` returns no `screenshots` at all; `icons` (`src/app/manifest.ts:15-19`) is the only asset list it declares, and every entry there is a Next.js generated route (`/icon`, `/apple-icon`). A comment at `src/app/manifest.ts:20-25` records the removal and the re-add contract (drop the PNGs into `public/static/` first). `public/static/` does not exist in the tree, which is consistent with the manifest rather than contradicted by it.

Regression cover: `src/app/manifest.test.ts:66` asserts `screenshots` is empty (so a silent re-add without assets fails loudly rather than passing a vacuous loop), `:74` asserts every src resolves *if* screenshots are ever re-added, and `:44` pins that the two removed paths still do not resolve. The docblock at `src/app/manifest.test.ts:12` explains why an "arming latch" test alone would assert nothing today.
