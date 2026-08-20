---
kind: doc
title: Routes & Pages (App Router UI surface)
domain: [content]
status: current
version: v3.4.2
---

# Routes & Pages (App Router UI surface)

> Part of the Anvilry v3.4.2 codebase index. Master entry point: [docs/index/README.md](./README.md)

**Scope:** every file under `src/app/**` that is NOT under `src/app/api/**` and is NOT a `route.ts`.
Concretely: `src/app/{layout,page,error,global-error,not-found,opengraph-image,icon,apple-icon,manifest,robots,sitemap}.*`,
`src/app/globals.css`, `src/app/layout.hydration-proof.dom.test.tsx`,
`src/app/{about,mcp,resume,search,stats}/**`, `src/app/{articles,notes,projects,work}/**` (pages + layouts +
opengraph-image only — the `[slug].md/route.ts` handlers belong to the API section), `src/app/admin/telemetry/page.tsx`.
Excluded by rule: `src/app/api/**`, `src/app/.well-known/vercel/flags/route.ts`, `src/app/feed.xml/route.ts`,
`src/app/llms.txt/route.ts`, `src/app/llms-full.txt/route.ts`, `src/app/{articles,notes,projects,work}/[slug].md/route.ts`.

**Files indexed:** 35

## At a glance

| File | Role | Key exports |
|---|---|---|
| `src/app/layout.tsx` | Root layout: fonts, global `metadata`/`viewport`, JSON-LD in `<head>`, `Providers` + all global client mounts | `viewport`, `metadata`, default `RootLayout` (async server) |
| `src/app/page.tsx` | Homepage `/`; the ONLY place `ViewRouter` (multi-view switcher) enters | `metadata`, default `Home` |
| `src/app/error.tsx` | Route-segment React error boundary; beacons `source:"boundary"` | default `RouteError` (client) |
| `src/app/global-error.tsx` | Root error boundary (catches layout crashes); own `<html>/<body>`, inline styles; beacons `source:"global-boundary"` | default `GlobalError` (client) |
| `src/app/not-found.tsx` | 404 page — a live gamified `Terminal` seeded with a fake kernel-panic boot banner | default `NotFound` (client) |
| `src/app/opengraph-image.tsx` | Root OG card (1200×630) via `next/og` `ImageResponse` | `alt`, `size`, `contentType`, default `OpengraphImage` |
| `src/app/icon.tsx` | 32×32 favicon — cyan "A" on ink, generated at build | `size`, `contentType`, default `Icon` |
| `src/app/apple-icon.tsx` | 180×180 Apple touch icon, same mark + accent glow | `size`, `contentType`, default `AppleIcon` |
| `src/app/manifest.ts` | Web app manifest → `/manifest.webmanifest` | default `manifest()` |
| `src/app/robots.ts` | `/robots.txt` — allow-all + sitemap pointer (hardcoded absolute URL) | default `robots()` |
| `src/app/sitemap.ts` | `/sitemap.xml` — static routes + all Velite content, flag-gated sections | default `sitemap()` |
| `src/app/globals.css` | Tailwind v4 entry + design-token `:root`, `@theme inline` map, and every hand-written animation/utility | — (CSS) |
| `src/app/layout.hydration-proof.dom.test.tsx` | Co-located happy-dom proof that `suppressHydrationWarning` silences extension-injected attribute mismatches | Vitest `describe`/`it` only |
| `src/app/about/page.tsx` | `/about` — prose bio, `// now`, `// uses`, `// skills`, `ProfilePageJsonLd` | `metadata`, default `AboutPage` |
| `src/app/mcp/page.tsx` | `/mcp` — MCP server docs: endpoint, Claude Desktop + Cursor JSON configs, 7-row tool table (of 9 registered) | `metadata`, default `McpPage` |
| `src/app/resume/page.tsx` | `/resume` — client PDF/Web tab switcher + iframe preview + flag-gated variant list | default `ResumePage` (client) |
| `src/app/resume/layout.tsx` | Metadata carrier for `/resume` (page is a Client Component and cannot export metadata) | `metadata`, default `ResumeLayout` |
| `src/app/search/page.tsx` | `/search` — injects Pagefind CSS+JS at runtime and mounts `#pagefind-search` | default `SearchPage` (client) |
| `src/app/search/layout.tsx` | Metadata carrier for `/search` | `metadata`, default `SearchLayout` |
| `src/app/stats/page.tsx` | `/stats` — 6 derived "by the numbers" tiles from Velite + `profile` | default `StatsPage` (server) |
| `src/app/stats/layout.tsx` | Metadata carrier for `/stats` | `metadata`, default `StatsLayout` |
| `src/app/admin/telemetry/page.tsx` | `/admin/telemetry` — request-time Redis telemetry dashboard behind Basic auth | `instant = false`, default `TelemetryDashboard` (async server) |
| `src/app/articles/page.tsx` | `/articles` — client page: platform filter pills, featured hero, deduped group grid | default `ArticlesPage` (client) |
| `src/app/articles/layout.tsx` | Metadata + `ARTICLES_ENABLED` route gate (404 when off) | `metadata`, default `ArticlesLayout` |
| `src/app/articles/[slug]/page.tsx` | Article detail; redirects to `/notes/<linkedNote>` or the external publication | `generateStaticParams`, `generateMetadata`, default `ArticlePage` |
| `src/app/articles/[slug]/opengraph-image.tsx` | Per-article OG card with source-coloured eyebrow | `size`, `contentType`, `alt`, `generateStaticParams`, default `ArticleOgImage` |
| `src/app/notes/page.tsx` | `/notes` — flag- and content-gated note grid | `metadata`, default `NotesPage` |
| `src/app/notes/[slug]/page.tsx` | Note detail: `ReadingProgress`, MDX body, `BlogPosting` + breadcrumb JSON-LD | `generateStaticParams`, `generateMetadata`, default `NotePage` |
| `src/app/notes/[slug]/opengraph-image.tsx` | Per-note OG card | `size`, `contentType`, `alt`, `generateStaticParams`, default `NoteOgImage` |
| `src/app/projects/page.tsx` | `/projects` — the ONLY page with `"use cache"` + `cacheLife("hours")`; awaits live GitHub repo feed | `metadata`, default `ProjectsPage` |
| `src/app/projects/[slug]/page.tsx` | Project detail: repo CTA, derived reading time, `SoftwareSourceCode` JSON-LD | `generateStaticParams`, `generateMetadata`, default `ProjectPage` |
| `src/app/projects/[slug]/opengraph-image.tsx` | Per-project OG card (name + tagline + group) | `size`, `contentType`, `alt`, `generateStaticParams`, default `ProjectOgImage` |
| `src/app/work/page.tsx` | `/work` — case-study cards with `register` + real metrics | `metadata`, default `WorkPage` |
| `src/app/work/[slug]/page.tsx` | Case-study detail + optional `constraints`/`tradeoffs`/`diagram` blocks | `generateStaticParams`, `generateMetadata`, default `WorkPage` |
| `src/app/work/[slug]/opengraph-image.tsx` | Per-work OG card (name + register + top metric) | `size`, `contentType`, `alt`, `generateStaticParams`, default `WorkOgImage` |

## Route matrix

`cacheComponents: true` is set globally (`next.config.ts:183`), so **every** page route is built as
`renderingMode: "PARTIALLY_STATIC"` with `experimentalPPR: true`. The "Render mode" column therefore records
what the *segment config + build artifact* actually say, not a pre-Next-16 static/ISR/dynamic trichotomy.
Build-artifact values below were read from the local `.next/prerender-manifest.json` + `.next/routes-manifest.json`
(gitignored; values are env-dependent — flags like `NEXT_PUBLIC_NOTES_ENABLED` change which slugs appear).

| Route path | File | Render mode | revalidate | generateStaticParams? | generateMetadata? | auth | notable data deps |
|---|---|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | PARTIALLY_STATIC, `compute:"static"`, `response:"initial"` | none (`initialRevalidateSeconds:false`) | no | no — static `metadata` (`page.tsx:17`) | none | Velite via home components; `GITHUB_STATS_ENABLED` (`page.tsx:31`) |
| `/about` | `src/app/about/page.tsx` | PARTIALLY_STATIC, `compute:"static"` | none | no | no — static `metadata` (`about/page.tsx:17`) | none | `profile`, `skills`, `impactMetrics`, `personal`/`now`, `allProjects.length` |
| `/mcp` | `src/app/mcp/page.tsx` | PARTIALLY_STATIC, `compute:"static"` | none | no | no — static `metadata` (`mcp/page.tsx:9`) | none | `profile` only; endpoint string hardcoded (`mcp/page.tsx:6`) |
| `/resume` | `src/app/resume/page.tsx` + `resume/layout.tsx` | PARTIALLY_STATIC, `compute:"static"`; page is `"use client"` (`resume/page.tsx:1`) | none | no | no — static `metadata` in the layout (`resume/layout.tsx:6`) | none | `resumeVariants` from `@/lib/profile`; `NEXT_PUBLIC_RESUME_VARIANTS` (`resume/page.tsx:24`) |
| `/search` | `src/app/search/page.tsx` + `search/layout.tsx` | PARTIALLY_STATIC, `compute:"static"`; page is `"use client"` (`search/page.tsx:1`) | none | no | no — static `metadata` in the layout (`search/layout.tsx:3`) | none | `/pagefind/pagefind-ui.{css,js}` injected at runtime (`search/page.tsx:18-31`) |
| `/stats` | `src/app/stats/page.tsx` + `stats/layout.tsx` | PARTIALLY_STATIC, `compute:"static"` | none | no | no — static `metadata` in the layout (`stats/layout.tsx:4`) | none | `allProjects`/`allNotes`/`allArticles`, `profile` |
| `/work` | `src/app/work/page.tsx` | PARTIALLY_STATIC, `compute:"static"` | none — `revalidate = 3600` deliberately deleted (`work/page.tsx:9-13`) | no | no — static `metadata` (`work/page.tsx:17`) | none | `allWork` (build-time Velite only) |
| `/work/[slug]` | `src/app/work/[slug]/page.tsx` | PARTIALLY_STATIC per-slug prerender + dynamic fallback | none | **yes** — `allWork` (`work/[slug]/page.tsx:13`) | **yes** (`work/[slug]/page.tsx:17`) | none | `getWork(slug)`, `notFound()` on miss |
| `/work/<slug>/opengraph-image` | `src/app/work/[slug]/opengraph-image.tsx` | PARTIALLY_STATIC per-slug | none | **yes** (`:11`) | n/a (image route) | none | `getWork(slug)`, `metrics[0]` |
| `/projects` | `src/app/projects/page.tsx` | PARTIALLY_STATIC, `compute:"static"`; body opens with `"use cache"` (`projects/page.tsx:38`) | **3600 s** (`cacheLife("hours")`, `projects/page.tsx:39`) → manifest `initialRevalidateSeconds:3600`, `initialExpireSeconds:86400` | no | no — static `metadata` (`projects/page.tsx:12`) | none | `projectsByGroup()` (Velite) + **live** `getRepoFeed()` GitHub call (`:41`) |
| `/projects/[slug]` | `src/app/projects/[slug]/page.tsx` | PARTIALLY_STATIC per-slug + dynamic fallback | none | **yes** — `allProjects` (`:14`) | **yes** (`:18`) | none | `getProject(slug)` |
| `/projects/<slug>/opengraph-image` | `src/app/projects/[slug]/opengraph-image.tsx` | PARTIALLY_STATIC per-slug | none | **yes** (`:9`) | n/a | none | `getProject(slug)` |
| `/articles` | `src/app/articles/page.tsx` + `articles/layout.tsx` | PARTIALLY_STATIC, `compute:"static"`; page is `"use client"` (`articles/page.tsx:1`) | none | no | no — static `metadata` in the layout (`articles/layout.tsx:5`) | none | `allArticles`, `inkforgeArticles`, `groupArticles()`; gate `ARTICLES_ENABLED` (`articles/layout.tsx:12`) |
| `/articles/[slug]` | `src/app/articles/[slug]/page.tsx` | PARTIALLY_STATIC per-slug + dynamic fallback; many slugs resolve to `redirect()` | none | **yes, filtered** — skips `linkedNote && !externalUrl && !NOTES_ENABLED` (`:21-27`) | **yes** (`:29`) | none | `getArticle(slug)`; `NOTES_ENABLED`; `article.externalUrl` protocol guard (`:61`) |
| `/articles/<slug>/opengraph-image` | `src/app/articles/[slug]/opengraph-image.tsx` | PARTIALLY_STATIC per-slug | none | **yes** — all articles, unfiltered (`:15`) | n/a | none | `getArticle(slug)`, `SOURCE_LABEL` map (`:8-13`) |
| `/notes` | `src/app/notes/page.tsx` | PARTIALLY_STATIC, `response:"complete"` (fully filled shell — no dynamic holes) | none — `revalidate = 3600` deliberately deleted (`notes/page.tsx:9-11`) | no | no — static `metadata` (`notes/page.tsx:13`) | none | `allNotes`; `notFound()` when `!NOTES_ENABLED` or empty (`:21-23`) |
| `/notes/[slug]` | `src/app/notes/[slug]/page.tsx` | PARTIALLY_STATIC per-slug + dynamic fallback | none | **yes** — all notes, **no flag check** (`:15-26`) | **yes**, returns `{}` when `!NOTES_ENABLED` (`:28-43`) | none | `getNote(slug)`; `notFound()` when flag off (`:51`) |
| `/notes/<slug>/opengraph-image` | `src/app/notes/[slug]/opengraph-image.tsx` | PARTIALLY_STATIC per-slug | none | **yes** (`:11`) | n/a | none | `getNote(slug)` |
| `/admin/telemetry` | `src/app/admin/telemetry/page.tsx` | PARTIALLY_STATIC but `response:"empty"`, `compute:"blocking"`, `htmlSize:0` — no static shell; `export const instant = false` (`:11`) + `await connection()` (`:434`) | none | no | no — exports **no** metadata at all | **HTTP Basic** via `src/proxy.ts` (Edge, `matcher: ["/admin/:path*"]`, `ADMIN_PASSWORD`) | Upstash Redis: `anvilry:trace:<kind>` sorted sets, `anvilry:eval:latest`, `anvilry:github:stats:latest`, `anvilry:seo:audit:latest`, `anvilry:content:audit:latest`, `anvilry:health:latest`, `anvilry:corpus:built_at` |
| `/opengraph-image` | `src/app/opengraph-image.tsx` | static image route (prerendered) | none | no | n/a | none | `profile` |
| `/icon` | `src/app/icon.tsx` | static image route | none | no | n/a | none | none |
| `/apple-icon` | `src/app/apple-icon.tsx` | static image route | none | no | n/a | none | none |
| `/manifest.webmanifest` | `src/app/manifest.ts` | static metadata route | none | no | n/a | none | `profile`; `/static/screenshot-{desktop,mobile}.png` |
| `/robots.txt` | `src/app/robots.ts` | static metadata route | none | no | n/a | none | none (hardcoded sitemap URL, `robots.ts:6`) |
| `/sitemap.xml` | `src/app/sitemap.ts` | static metadata route | none | no | n/a | none | all four Velite collections + `ARTICLES_ENABLED`/`NOTES_ENABLED`/`STATS_ENABLED`/`SEARCH_ENABLED` |
| 404 fallback (`/_not-found`) | `src/app/not-found.tsx` | prerendered (`.next/server/app/_not-found.html`); page is `"use client"` | none | no | no (client component) | none | `Terminal`, `bootBanner404()`, `NEXT_PUBLIC_404_ORB` (`not-found.tsx:34`) |
| root error boundary (`/_global-error`) | `src/app/global-error.tsx` | prerendered (`.next/server/app/_global-error.html`) | none | no | no | none | dynamic `import("@/lib/telemetry/beacon")` |
| segment error boundary | `src/app/error.tsx` | client boundary, no URL of its own | n/a | no | no | none | dynamic `import("@/lib/telemetry/beacon")` |

## Detail

### `src/app/layout.tsx`
- **Role:** the single root layout for every route — fonts, global metadata/viewport, `<head>` JSON-LD, and the one place every global client mount lives.
- **Exports:** `viewport` (`Viewport`) — `themeColor:"#07080d"`, `colorScheme:"dark"`, `viewportFit:"cover"` (`:29-33`). `metadata` (`Metadata`) — `metadataBase: new URL("https://anvilry.vercel.app")`, title template `` `%s — ${profile.name}` ``, 9 `keywords`, `openGraph`, `twitter.images:[siteUrl + "/opengraph-image"]`, `robots:{index:true,follow:true}` (`:35-63`). default `RootLayout` (**async** server component).
- **Reads / depends on:** `next/font/google` `Inter` → `--font-sans`, `JetBrains_Mono` → `--font-mono` (`:23-24`); `./globals.css`; `@/lib/profile`; `getDiscoveryBadgesEnabled()` from `@/lib/flags`; `OPEN_TO_WORK` from `@/lib/writing-flags`; `@vercel/analytics/next`, `@vercel/speed-insights/next`.
- **Client boundary:** `Providers` (`src/components/providers.tsx:1` is `"use client"`) wraps `SiteNav`, the `#main-content` div holding `children`, `SiteFooter`, `CommandPalette`, `AskPortfolio`, `TalkModeMount`, `AnvilInlinePanel`, `AnvilCoreSurface`, `WakeWordController`, `ViewHint`, `EasterEggs` (`:97-122`). `Providers` mounts `MotionConfig reducedMotion="user"` → `ViewProvider` → `ScrollFlagsSync` and lazily `InkTransition` + (conditionally) `DiscoveryBadge`. `ViewProvider` is what mounts `ViewQuerySync` (`src/components/view-context.tsx:182`), the post-hydration `?view=` applier.
- **Behaviour notes:** `discoveryBadgesEnabled` is resolved **server-side** and threaded in as a prop because `Providers` is a client component (`:66`, `:97`). `data-scroll-behavior="smooth"` on `<html>` re-opts into Next 16's scroll override so the `scroll-behavior: smooth` in `globals.css:59` still applies to in-page anchors (`:67-71`). `suppressHydrationWarning` is set on exactly `<html>`, `<head>`, `<body>` (`:85`, `:87`, `:92`) — browser extensions inject attributes on those three before hydration; the flag does not cascade to children, so real mismatches inside the app still surface (`:73-79`).
- **Gotchas / invariants:** `siteUrl` is **hardcoded** at `:26`; `CLAUDE.md:292` names this file as one of exactly four places to change for a custom domain (with `sitemap.ts`, `robots.ts`, `json-ld.tsx`). The `<a href="#main-content" className="skip-link">` at `:94` must stay the first focusable element (WCAG 2.4.1) and pairs with `#main-content tabIndex={-1}` at `:100`. Removing a `suppressHydrationWarning` re-opens the bug that `layout.hydration-proof.dom.test.tsx` locks down.

### `src/app/page.tsx`
- **Role:** the `/` homepage and the sole entry point for the multi-view system.
- **Exports:** `metadata` — only `alternates:{canonical:"/"}`; default `Home` (sync server component).
- **Reads / depends on:** `@/components/view-router`; home sections `Hero`, `FeaturedWork`, `FeaturedProjects`, `Achievements`, `Testimonials`, `Contact`, `WritingPreview`; `GithubStatsStrip`; `GITHUB_STATS_ENABLED`.
- **Behaviour notes:** the Classic `<main>` is server-rendered and handed to `ViewRouter` as `children` (`:26-37`). `ViewRouter` (`src/components/view-router.tsx:52`) keeps Classic **mounted but `hidden`** and lazily mounts the other views with `ssr:false`; the gamified view is **unmounted** (not hidden) when inactive so R3F can dispose the WebGL context (`view-router.tsx:17-20`). `GithubStatsStrip` renders only when `NEXT_PUBLIC_GITHUB_STATS_ENABLED === "true"` (`:31`).
- **Gotchas / invariants:** the canonical is pinned to the bare `"/"` on purpose — a literal self-canonical would canonicalize each `?view=` variant to itself (`:13-16`). `ViewRouter` is imported **nowhere else** in `src/` (verified by grep): `/` is the only route with the view switcher. `ViewRouter` branches on **six** views — `classic`, `chat`, `gamified`, `developer`, `voice`, `resume` (`view-router.tsx:58-69`), gated by `isViewEnabled()` / `NEXT_PUBLIC_ENABLED_VIEWS`; the "four-view" naming in `CLAUDE.md:99-104` predates `voice` and `resume`.

### `src/app/error.tsx`
- **Role:** route-segment error boundary for every page/nested layout below the root layout.
- **Exports:** default `RouteError` (client) — props `{ error: Error & { digest?: string }, unstable_retry?, reset? }`.
- **Behaviour notes:** accepts **both** `unstable_retry` (Next 16.2+ canonical) and the legacy `reset`, and calls `retry = unstable_retry ?? reset` (`:84`); the "Try again" button only renders when one exists (`:104`). On mount it stamps `window.__anvilry_error_recently__ = Date.now()` **before** beaconing (`:57-59`), then `import("@/lib/telemetry/beacon")` dynamically and calls `sendErrorBeacon({ source:"boundary", ... })` (`:64-77`). The import's `.catch()` is an intentional silent swallow so telemetry can never regress recovery (`:78-81`).
- **Gotchas / invariants:** `DEDUPE_FLAG = "__anvilry_error_recently__"` (`:39`) is a **shared string contract** with `global-error.tsx:33` and `src/instrumentation-client.ts` (100 ms dedupe window). Renaming it in one place double-counts every error. Next 16 boundaries do not surface React's `componentStack`, so none is sent (`:72-75`). `error.digest` is rendered verbatim because it is the only user-pasteable correlation key to a server log line (`:96-102`).

### `src/app/global-error.tsx`
- **Role:** last-resort boundary for errors thrown *inside* `src/app/layout.tsx` or its providers.
- **Exports:** default `GlobalError` (client), same prop shape as `error.tsx`.
- **Behaviour notes:** renders its **own** `<html>`/`<body>` (`:78-79`) because the root layout has already unwound. Zero `@/components` imports — no `Providers` context exists at this point (`:11-13`). All load-bearing styling is inline `style` objects with the token hex values duplicated literally (`#07080d`, `#e9ecf5`, `#9aa3b8`, `#747e99`, `#2c3346`, `#141826`, `#1f2433`) because `globals.css` may not have been applied yet (`:14-18`). Beacons `source:"global-boundary"` (`:57`) so the sink can distinguish a layout crash from a route crash.
- **Gotchas / invariants:** the "Back to homepage" link is a **plain `<a>`**, not `next/link`, with `@next/next/no-html-link-for-pages` disabled on purpose — the router context is part of what unwound, so a full navigation is the safer recovery (`:159-166`). The inline hex values are a hand-maintained copy of the `globals.css:8-31` tokens; changing the palette will silently desync this file.

### `src/app/not-found.tsx`
- **Role:** the 404 page, implemented as a fully functional developer terminal pre-seeded with a fake kernel-panic boot sequence.
- **Exports:** default `NotFound` (client).
- **Reads / depends on:** `Terminal` and `bootBanner404()` from `@/components/game/terminal/*`, `WebGLBoundary`, `VoiceOrb3D` (dynamic, `ssr:false`), `process.env.NEXT_PUBLIC_404_ORB`.
- **Behaviour notes:** `showOrb` is read at **module scope** (`:34`) — `NEXT_PUBLIC_404_ORB === "true"` adds a distressed `errorMode` 3D orb above the terminal, wrapped in `WebGLBoundary` and `aria-hidden` (`:45-56`). The visible eyebrow `// 404 :: route-not-found` is `aria-hidden` decorative; the real a11y anchor is an `sr-only <h1>Page not found</h1>` (`:59-67`). `Terminal` gets `initialLines={bootBanner404()}` and `maxHeightClass="max-h-96"` (`:70-73`).
- **Gotchas / invariants:** the glitch animation class `.glitch-eyebrow` is defined in `globals.css:311-317` and only there. It renders inside the root layout, so all `Providers` are available (`:20`). `cd /` in the terminal is the documented in-terminal escape hatch, surfaced as visible copy at `:84-85`.

### `src/app/admin/telemetry/page.tsx`
- **Role:** request-time operations dashboard reading a rolling 24 h window of telemetry out of Upstash Redis.
- **Exports:** `instant = false` (route segment config, `:11`); default `TelemetryDashboard` (async server component). Exports **no** `metadata`.
- **Reads / depends on:** `redis` singleton from `@/lib/redis`; `KIND_LITERALS` + `TelemetryEvent` from `@/lib/telemetry/schema`; `unstable_noStore as noStore` from `next/cache`; `connection` from `next/server`.
- **Behaviour notes:** `await connection()` at `:434` is what makes the segment request-time — under `cacheComponents` the synchronous `Date.now()` at `:436` would otherwise fail the prerender ("encountered the unstable value `Date.now()`"), and the comment at `:8-10` and `:428-433` records that `instant = false` alone does **not** clear synchronous-IO errors. Nine Redis reads are issued in one `Promise.all` (`:449-459`). Every fetch helper is fail-soft: `fetchKind` returns `[]` and `fetchRedisJson` returns `null` on any throw or when `redis` is falsy (`:22-38`, `:203-212`). `fetchAll` calls `noStore()` (`:41`). Auth is **not** checked in this file — the comment at `:425-426` states the request is already authenticated by `src/proxy.ts`.
- **Gotchas / invariants:** `CACHE_READ_PRICE_PER_MTOK = 0.3` (`:112`) is a hardcoded USD-per-million-tokens figure used for the "saved by caching" tile. Token accounting reads **snake_case** Anthropic field names — `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` (`:59-66`); `CLAUDE.md:308` notes `llm.test.ts` is the regression guard for those names. Redis key names are string literals in this file: `anvilry:trace:${kind}` (`:25`), `anvilry:eval:latest` (`:217`), `anvilry:github:stats:latest` (`:251`), `anvilry:seo:audit:latest` (`:254`), `anvilry:content:audit:latest` (`:257`), `anvilry:health:latest` (`:260`), `anvilry:corpus:built_at` (`:265`) — they must match whatever `/api/cron/*` writes. Warn thresholds are inline magic numbers: fallback > 20 % (`:545`), error rate > 5 % (`:567`), TTS P95 > 3000 ms (`:689`), transcribe P95 > 5000 ms (`:708`), eval < 80 % warn / ≥ 90 % accent (`:718-719`), corpus stale > 7 days (`:502`). The events table is capped at the last 100 events (`:475`).

### `src/app/projects/page.tsx`
- **Role:** `/projects` index — the only page in the repo that performs a live network fetch during render.
- **Exports:** `metadata` (with page-specific `openGraph`); default `ProjectsPage` (async).
- **Behaviour notes:** the function body opens with the `"use cache"` directive followed by `cacheLife("hours")` (`:38-39`). The comment at `:31-36` records why: `export const revalidate = 3600` is rejected under `cacheComponents`, and the built-in `"hours"` profile is `{ stale: 300, revalidate: 3600, expire: 86400 }` — the build artifact confirms `initialRevalidateSeconds: 3600` / `initialExpireSeconds: 86400`. `getRepoFeed()` is awaited server-side (`:41`) and the `GithubFeed` block renders only when `repos.length > 0` (`:56`), so a GitHub failure degrades to hiding the strip.
- **Gotchas / invariants:** `"use cache"` must remain the **first statement** of the function body. `/work` and `/notes` deliberately have no cache directive because their only input is the build-time Velite import (`work/page.tsx:9-13`, `notes/page.tsx:9-11`) — do not "restore consistency" by adding one.

### `src/app/articles/[slug]/page.tsx`
- **Role:** article detail route that mostly exists to *redirect* — to an internal note or to the original publication.
- **Exports:** `generateStaticParams`, `generateMetadata`, default `ArticlePage` (async).
- **Behaviour notes:** three ordered branches after `getArticle` (`:49`): (1) `article.linkedNote && NOTES_ENABLED` → `redirect(\`/notes/${linkedNote}\`)` (`:53-55`); (2) non-`native` source with an `externalUrl` → `redirect(url)`, but **only** after asserting the URL starts with `https://` or `http://`, otherwise `notFound()` (`:59-63`); (3) `linkedNote && !externalUrl && !NOTES_ENABLED` → `notFound()` (`:66-68`). Only native, non-linked articles actually render the MDX body. `generateMetadata` canonical prefers `article.canonicalUrl`, then `externalUrl`, then the local path (`:41`).
- **Gotchas / invariants:** the protocol allowlist at `:61` is the open-redirect guard (`javascript:`/`data:` URLs 404 instead of redirecting) — do not relax it. `generateStaticParams` filters out guaranteed-404 slugs (`:21-27`), but the sibling `opengraph-image.tsx:15-17` maps **all** article slugs with no filter — the two intentionally disagree. `BASE = "https://anvilry.vercel.app"` is hardcoded at `:12` (repeated in `notes/[slug]/page.tsx:13`, `projects/[slug]/page.tsx:12`, `work/[slug]/page.tsx:11`).

### `src/app/notes/[slug]/page.tsx`
- **Role:** note detail page with reading-progress bar and `BlogPosting` structured data.
- **Exports:** `generateStaticParams`, `generateMetadata`, default `NotePage` (async).
- **Behaviour notes:** `generateStaticParams` returns **every** note slug with no `NOTES_ENABLED` check; the comment at `:16-24` records that the previous `if (!NOTES_ENABLED) return []` short-circuit was removed because `cacheComponents` hard-requires at least one result and an empty array failed the build outright. User-visible behaviour is unchanged because the page component still calls `notFound()` when the flag is off (`:51`) — the routes are simply prerendered *as 404s*. `generateMetadata` mirrors the guard and returns `{}` when the flag is off (`:34`) to avoid emitting partial metadata for a 404.
- **Gotchas / invariants:** do not "optimise" `generateStaticParams` back to an early empty return — it breaks the build. Mounts `ReadingProgress` (`:68`), which `/articles/[slug]` and `/work/[slug]` do not.

### `src/app/articles/page.tsx`
- **Role:** `/articles` index: platform filter pills, a featured hero card, and a deduplicated 2-column grid.
- **Exports:** default `ArticlesPage` — `"use client"` (`:1`), therefore **no** metadata export; metadata lives in `articles/layout.tsx`.
- **Reads / depends on:** `allArticles`, `inkforgeArticles`; `INKFORGE_ARTICLES_ENABLED`, `NOTES_ENABLED`; `groupArticles`, `getGroupSources`, `filterGroupsBySource` from `@/lib/article-grouping`; `ArticleGroupCard`, `NoteCard`, `PlatformBadge`.
- **Behaviour notes:** `visibleInkforge` and `grouped` are computed at **module scope** (`:35`, `:38`), not per render. `notFound()` is called from inside the client component when `allArticles.length === 0` (`:41`). The filter bar only renders when more than two options exist (`:102`). The featured card's href resolution order is: `linkedNote` (when `NOTES_ENABLED`) → `canonical.externalUrl` → first external platform's `externalUrl` → `canonical.url` (`:151-157`); `target="_blank"` is added only for non-native sources with an `externalUrl` (`:158`). Per-platform badges are `<button>`s inside the card `<Link>` that `stopPropagation()` + `preventDefault()` and `window.open(...)` (`:166-178`).
- **Gotchas / invariants:** `SOURCE_LABELS` (`:25-32`) must stay in sync with the Velite `source` enum `["medium","substack","linkedin","devto","hashnode","native"]` (`velite.config.ts:102`) — a new platform without a label renders `undefined` in the filter pill.

### `src/app/articles/layout.tsx`
- **Role:** metadata carrier **and** the route-level kill switch for the whole `/articles` subtree.
- **Behaviour notes:** `if (!ARTICLES_ENABLED) notFound()` (`:12`) — this is the only flag gate that lives in a layout, so it also 404s `/articles/[slug]`. `ARTICLES_ENABLED` defaults **on** (`writing-flags.ts:19-20`: `!== "false"`), unlike `NOTES_ENABLED` which defaults off (`=== "true"`).

### `src/app/resume/page.tsx`
- **Role:** `/resume` — a client page with a segmented PDF/Web toggle, an iframe PDF preview with shimmer skeleton, and a flag-gated `<details>` list of role-targeted variants.
- **Exports:** default `ResumePage` (`"use client"`).
- **Behaviour notes:** `master = resumeVariants[0]` and `otherVariants = resumeVariants.slice(1)` are module-scope (`:16-17`); `profile.ts:76-82` defines 5 variants (master + Backend, Full-Stack, Frontend, GenAI). `showVariants` is read **inside the function body**, not at module scope, explicitly so `vi.stubEnv` works in tests (`:23-24`). The `"web"` tab renders `ResumeViewInline` — the *Inline* variant exists specifically to avoid nesting two `<main>` landmarks (`src/components/home/resume-view.tsx:255`).
- **Gotchas / invariants:** the PDF `<iframe src={master.file}>` (`:119-127`) only works because `next.config.ts:216-217` applies a `frame-ancestors`-relaxed `resumeHeaders` CSP override to `/resume` and `/resume/:path*`. `e2e/resume.spec.ts` covers both flag states of `NEXT_PUBLIC_RESUME_VARIANTS`.

### `src/app/search/page.tsx`
- **Role:** `/search` — mounts the statically generated Pagefind UI bundle.
- **Behaviour notes:** augments the global `Window` type with `PagefindUI` (`:9-13`), then in a `useEffect` appends `/pagefind/pagefind-ui.css` and `/pagefind/pagefind-ui.js` to `document.head` and constructs `new window.PagefindUI({ element:"#pagefind-search", showImages:false, resetStyles:true })` in `script.onload` (`:16-31`). The cleanup removes both nodes (`:33-36`).
- **Gotchas / invariants:** the bundle only exists after `pnpm search-index` runs post-build; in dev the effect is a silent no-op (`:6-8`). `SEARCH_ENABLED` does **not** gate this route — see the cross-cutting note below.

### `src/app/stats/page.tsx`
- **Role:** `/stats` — six "by the numbers" tiles.
- **Behaviour notes:** `totalCommits` and the `stats` array are computed at **module scope** (`:6-15`), so they are frozen at build time. Four values derive from Velite (`allProjects.length`, summed `commits`, `allArticles.length + allNotes.length`) and from `profile.company`/`profile.tenure`; two are hand-written string literals — `"2K+" / Pensieve at peak` and `"3K+" / AAVA Code at peak` (`:11-12`).
- **Gotchas / invariants:** those two hardcoded figures are the only numbers on this page not derived from a single source — `CLAUDE.md:298` / `ARCHITECTURE.md:95` require metrics to be real and non-fabricated, so they must track the `impactMetrics` in `@/lib/profile` by hand.

### `src/app/about/page.tsx`
- **Role:** `/about` — bio prose plus optional `// now` and `// uses` sections and the `// skills` grid.
- **Behaviour notes:** destructures `const [pensieve, aava] = impactMetrics` (`:27`) and interpolates `pensieve.value` / `aava.value` into the prose so the numbers cannot drift from `@/lib/profile` (`:40-42`). It also interpolates `allProjects.length` for the repo count (`:47`). The `// now` and `// uses` blocks are empty-safe, gated on `hasNow` (`:58`) and `hasPersonalContent && personal.uses.length > 0` (`:80`). `formatUpdated` (`:10-14`) forces `timeZone:"UTC"` so the "Last updated" date never drifts by locale. Emits `ProfilePageJsonLd` (`:119`).
- **Gotchas / invariants:** the prose assumes `impactMetrics` has at least two entries in Pensieve-then-AAVA order (`:27`); reordering that array silently swaps the two numbers in the sentence.

### `src/app/mcp/page.tsx`
- **Role:** `/mcp` — human-readable MCP server documentation.
- **Behaviour notes:** `ENDPOINT = "https://anvilry.vercel.app/api/mcp/mcp"` is a module constant (`:6`) interpolated into both the Claude Desktop config (`npx -y mcp-remote <ENDPOINT>`, `:17-24`) and the Cursor config (`{ "url": <ENDPOINT> }`, `:26-30`). The `TOOLS` array (`:32-40`) hand-lists **7 of the 9** tools actually registered by `src/app/api/mcp/[transport]/route.ts` — `list_all_content` (`route.ts:98`) and `get_content_item` (`route.ts:108`) are absent from this page, so the public docs page under-reports the server (see [02 § `src/app/api/mcp/[transport]/route.ts`](./02-api-routes.md#srcappapimcptransportroutets)).
- **Gotchas / invariants:** `TOOLS` is a **manual duplicate** of the real tool set in `src/lib/mcp-tools.ts` — adding an MCP tool does not update this page automatically, which is exactly how the two content tools went missing. Despite `CLAUDE.md:125` describing `/mcp` as `(force-static)`, this file exports **no** `dynamic`/`revalidate` segment config; grep over `src/app` confirms no non-API file exports `force-static`.

### `src/app/work/[slug]/page.tsx`
- **Role:** case-study detail page.
- **Behaviour notes:** `generateMetadata` sets a page-specific `openGraph` because Next merges metadata segments shallowly and replaces nested objects wholesale — without it the page inherits the root layout's homepage `og:title`/`og:url`; the file-based `opengraph-image.tsx` keeps the share *image* correct (`:26-28`). Three optional blocks render only when the owner authored them: `work.constraints` (`:87`), `work.tradeoffs` (`:96`), `work.diagram` (`:105`). The diagram uses a plain `<img>` with `@next/next/no-img-element` disabled, and falls back to `` `${work.name} architecture diagram` `` when `diagramAlt` is absent (`:112-117`).
- **Gotchas / invariants:** `CLAUDE.md:306` records that three graph node IDs intentionally differ from these slugs (`aava` → `aava-code`, `grpc` → `grpc-microservices`, `nhl` → `not-humans-lab`) and that `game-model.test.ts` blocks deploys on orphaned nodes — renaming a work slug breaks that bijection test.

### `src/app/projects/[slug]/page.tsx`
- **Role:** project detail page.
- **Behaviour notes:** reading time is computed **inline in an IIFE during render** from the compiled MDX body — strip tags, collapse whitespace, split on spaces, `words / 200` rounded, minimum 1 min, and the badge is suppressed entirely below 100 words (`:65-79`). Emits `SoftwareSourceCodeJsonLd` + `BreadcrumbJsonLd` (`:113-126`).
- **Gotchas / invariants:** the `200` words-per-minute and `100`-word floor are inline magic numbers with no shared constant. `project.repo` is rendered as an external `<a target="_blank" rel="noopener noreferrer">` (`:82-89`); the Velite schema validates it as a URL (`velite.config.ts:20`).

### `src/app/{articles,notes,projects,work}/[slug]/opengraph-image.tsx`
- **Role:** four near-identical `next/og` `ImageResponse` generators producing one 1200×630 PNG per content slug.
- **Exports (each):** `size = { width: 1200, height: 630 }`, `contentType = "image/png"`, `alt` (string literal per collection: `"Article"`, `"Note"`, `"Open-source project"`, `"Work case study"`), `generateStaticParams`, default async component.
- **Behaviour notes:** each falls back to `profile.name` / `profile.role` when the slug misses, so a bad slug still yields a branded card instead of throwing (`articles:24-32`, `notes:20-28`, `projects:18-19`, `work:20-22`). Layout differs only in the eyebrow and third line: articles show a source-derived label from `SOURCE_LABEL` (`articles:8-13`) plus the date, notes show `"> note"` plus the date, projects show `"> <group>"` (or `"> open source"`) plus tagline, work shows `"> <register>"` plus `metrics[0].value · metrics[0].label` (`work:47-51`).
- **Gotchas / invariants:** the background gradients and hex colours are duplicated in all four files plus `src/app/opengraph-image.tsx`; articles uniquely use an orange wash (`rgba(255,103,25,0.14)`, `articles:47`) while the others use violet+cyan. `articles/[slug]/opengraph-image.tsx` maps **all** article slugs while the sibling page filters some out — the OG images therefore exist for slugs whose pages redirect or 404.

### `src/app/sitemap.ts`
- **Role:** builds `/sitemap.xml` from a hardcoded static-route list plus every Velite collection.
- **Behaviour notes:** static routes are `["", "/work", "/projects", "/about", "/resume", "/mcp"]` at `changeFrequency:"monthly"`, priority `1` for `""` and `0.8` otherwise (`:8-12`). Work `0.7`, projects `0.6`, notes/articles index `0.6` + items `0.5`, `/stats` `0.6`, `/search` `0.5`. Notes and articles sections require **both** the flag and non-empty content (`:27`, `:39`); `/stats` and `/search` require only their flag (`:50-56`). No `lastModified` is emitted anywhere.
- **Gotchas / invariants:** `/notes`, `/articles`, `/stats`, `/search` are absent from the hardcoded static list on purpose — they are added conditionally further down. `base` is hardcoded (`:5`) — one of the four custom-domain edit points (`CLAUDE.md:292`).

### `src/app/globals.css`
- **Role:** the single Tailwind v4 entry point, the design-token source of truth, and the home of every hand-written keyframe/utility.
- **Behaviour notes:** `@import "tailwindcss"` (`:1`); `:root` defines surfaces, text, accents and `--glow-accent` with the WCAG contrast ratios documented per token (`:8-31`); `@theme inline` maps each token to a Tailwind `--color-*` / `--font-*` / `--radius-card` (`:33-52`). `html { scroll-behavior: smooth; scroll-padding-top: 3.5rem }` — the padding clears the sticky `h-14` header for WCAG 2.2 SC 2.4.12 (`:58-65`). `:focus-visible:not(.no-focus-ring)` is a **deliberately unlayered** 3px outline rule; the comment at `:194-200` notes unlayered CSS beats any Tailwind utility regardless of specificity, which is why `.no-focus-ring` exists as the opt-out. Named animation groups: `.hero-rise` (`:76-86`), `.terminal-cursor`/`.terminal-boot` (`:88-101`), `.anvil-orb-idle` metaball orb with `@property --anvil-swirl`/`--anvil-hue` (`:103-178`), `.skip-link` (`:209-230`), `.card-surface`/`.mono-label` (`:238-255`), view-transition slide keyframes keyed off `[data-view-dir="forward"|"backward"]` on `::view-transition-{old,new}(view-body)` with `site-header` pinned to `animation: none` (`:257-289`), `.glitch-eyebrow` (`:301-317`), `.scroll-reveal` + `.scroll-reveal-stagger-1..6` using native `animation-timeline: view()` (`:319-344`), `.skeleton-shimmer` (`:355-385`).
- **Gotchas / invariants:** **ten** separate `@media (prefers-reduced-motion: reduce)` blocks exist (`:67`, `:84`, `:91`, `:99`, `:168`, `:226`, `:293`, `:315`, `:346`, `:380`) — any new animation needs its own. The reduced-motion branch for the orb keeps `blur(1.4px) contrast(4.5)` and never sets `filter: none`, because dropping the filter shatters the metaballs into hard arcs (`:173-177`). The `1.4px` blur is tuned for the real 28 px host, not a preview (`:161-162`). `::view-transition-name: view-body` is set in JS at `view-router.tsx:56` — the CSS here only styles it.

### `src/app/layout.hydration-proof.dom.test.tsx`
- **Role:** a co-located `*.dom.test.tsx` (happy-dom Vitest project) that proves the extension-injected hydration warning exists and that `suppressHydrationWarning` silences it.
- **Behaviour notes:** renders a stand-in `<div data-role="head">` via `renderToString`, injects `data-locator-hook-status-message="ok"` into the server HTML **before** `hydrateRoot`, spies on `console.error`, and asserts a hydration error is present without the flag and absent with it (`:33-68`). Explicitly documents itself as a lock on the fix, not a product test (`:16`).
- **Gotchas / invariants:** filename must keep the `.dom.test.` infix — `CLAUDE.md:310` records that Vitest runs a `node` project for `*.test.ts` and a separate `dom` (happy-dom) project for `*.dom.test.*`, and that `NODE_ENV` is forced to `"test"` to avoid React's missing-`act()` warning.

## Cross-cutting notes

- **Metadata-in-layout pattern.** Four routes put `metadata` in a sibling `layout.tsx` instead of `page.tsx`: `/resume`, `/search`, `/articles` (all three because the page is `"use client"` and Client Components cannot export metadata) and `/stats` (whose page *is* a Server Component — the layout is not required there).
- **`/stats` and `/search` are NOT route-gated.** `STATS_ENABLED` and `SEARCH_ENABLED` are consumed only by `src/app/sitemap.ts:50-56` and `src/components/site-nav.tsx:22-23`. Neither `stats/layout.tsx` nor `search/layout.tsx` calls `notFound()`, so both routes render and are prerendered even with the flags off — they are merely unlinked and un-sitemapped. Contrast `/articles` (gated in the layout, `articles/layout.tsx:12`) and `/notes` (gated in the page, `notes/page.tsx:21`).
- **Hardcoded base URL.** `"https://anvilry.vercel.app"` appears literally in `layout.tsx:26`, `sitemap.ts:5`, `robots.ts:6`, `mcp/page.tsx:6`, and as `const BASE` in `articles/[slug]/page.tsx:12`, `notes/[slug]/page.tsx:13`, `projects/[slug]/page.tsx:12`, `work/[slug]/page.tsx:11`. `CLAUDE.md:292` lists only four files for a domain change; the four `BASE` constants and `mcp/page.tsx` are additional occurrences.
- **`cacheComponents` migration scars.** `work/page.tsx:9-13`, `notes/page.tsx:9-11`, `projects/page.tsx:31-36`, `notes/[slug]/page.tsx:16-24`, and `admin/telemetry/page.tsx:4-11` + `:428-433` each carry an in-file comment explaining a construct that was removed or added because `next.config.ts:183` sets `cacheComponents: true`. These comments are the only record of why `export const revalidate` is absent.
- **Client-boundary inventory (pages only).** `"use client"` appears in exactly **6** in-scope files, all at line 1: `error.tsx`, `global-error.tsx`, `not-found.tsx`, `articles/page.tsx`, `resume/page.tsx`, `search/page.tsx`. Every other page in scope is a Server Component; client interactivity on those pages comes from imported components (`Reveal`, `CopyButton`, `ReadingProgress`, `GithubFeed`, `MDXContent`, and the `Providers` subtree in the root layout).

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
- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/app/globals.css`
- `src/app/layout.hydration-proof.dom.test.tsx`
- `src/app/about/page.tsx`
- `src/app/mcp/page.tsx`
- `src/app/resume/page.tsx`
- `src/app/resume/layout.tsx`
- `src/app/search/page.tsx`
- `src/app/search/layout.tsx`
- `src/app/stats/page.tsx`
- `src/app/stats/layout.tsx`
- `src/app/admin/telemetry/page.tsx`
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

- The `.next/` render-mode / revalidate values in the Route matrix come from a **local, gitignored build** dated 15 Aug (`.next/prerender-manifest.json`, `.next/routes-manifest.json`). They reflect the local `.env.local` flag values at that time (notably `NEXT_PUBLIC_NOTES_ENABLED` was on, since note slugs are prerendered). A production build with different `NEXT_PUBLIC_*` values will prerender a different slug set; the segment-config columns (`instant`, `"use cache"`, `cacheLife`, `generateStaticParams`) are read from source and are not env-dependent.
- Whether `/articles/<slug>` entries that `redirect()` emit a prerendered artifact was not confirmed — several article slugs present in `generateStaticParams` have an `opengraph-image` entry in the prerender manifest but no page entry, which is consistent with the redirect path but not proven.
- (nothing further)

## Verified defect worth recording

`src/app/manifest.ts:19-34` declares two PWA `screenshots` at `/static/screenshot-desktop.png` (1280×800, `form_factor:"wide"`) and `/static/screenshot-mobile.png` (390×844, `form_factor:"narrow"`), but `public/static/` is an **empty directory** and no file matching `*screenshot*` exists anywhere under `public/` (verified by `find`). `.gitignore` does not exclude `public/static`. Both manifest screenshot URLs therefore resolve to 404 in every environment.
