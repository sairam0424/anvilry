---
kind: doc
title: Components — Site Shell, Home Sections, View System & UI Kit
domain: [content]
status: current
version: v3.17.0
---

# Components — Site Shell, Home Sections, View System & UI Kit

> Part of the Anvilry v3.17.0 codebase index. Master entry point: [docs/index/README.md](./README.md)

> **Baseline.** Describes Anvilry v3.17.0 (`package.json` 3.17.0), i.e. `main` at a929932 plus twenty-seven post-a929932 changes in all, those that touch this section described by behaviour, starting with five fixes: notes hidden at the data layer when `NOTES_ENABLED` is off (`allNotes` is empty, so every consumer — nav link, cards, `/articles` note section — sees no notes); per-class rate-limit buckets; a shared admin-auth check; the command-palette talk-mode entry gated by `isVoiceViewActive`; and `MIN_ROUTES = 17` in the bundle-budget gate plus removal of dead components. Only the notes gating and the palette gate change how this section behaves; the dead-code removal deleted three components (an unused article card, an unused `ui/button`, an unused `ui/empty-state`) and the unused `ArticleJsonLd` export from `json-ld.tsx`, none of which is indexed here any more. v3.14.0 adds three files to this section: `src/components/home/stack.tsx` (the home Stack icon wall — the seventh home section, mounted between `FeaturedProjects` and `Achievements`), `src/components/stack-icons.tsx` (its 19 Simple Icons paths and 3 lucide glyphs) and `src/components/skill-chip.tsx` (the `/about` glyph chips); `ui/section.tsx`, `ui/reveal.tsx` and `ui/tooltip.tsx` each gain `Stack` as a consumer. v3.15.0 adds four files to this section: `src/components/mascot/mascot.tsx` (the page-mascot 0.1.0 head, vendored under MIT — `THIRD_PARTY_NOTICES.md`), `src/components/mascot/site-mascot.tsx` (registry pick + optional preload), `src/components/mascot/not-found-mascot.tsx` (the rotating 404 character) and `src/components/home/hero-mascot.tsx` (the `mascot` hero mode's glow backdrop and head); `home/hero.tsx`'s visual slot becomes a three-way branch on `NEXT_PUBLIC_HERO_MODE` (`graph` default, `avatar`, `mascot`), and the 28 sprite sheets under `src/assets/mascots/` plus `src/types/next-image-assets.d.ts` (the ambient `next/image-types/global` reference that types `.webp` imports for a bare `tsc`, since `next-env.d.ts` is gitignored) are carried in Coverage only. v3.16.0 adds no file to this section and changes three: `src/components/project-card.tsx` shows a "Private repository" marker in place of the GitHub link when `repoLink(project)` is `null` (`agent-forge`, `graph-forge`), `src/components/home/featured-projects.tsx` reads "View all {allProjects.length} projects" from the collection (20 at v3.16.0, 18 since v3.16.1; the label was a hardcoded 8) over a featured strip that grows from seven to eight projects (agent-forge, graph-forge, grpc-microservices and inkforge leave it, five new cards join), and `src/components/json-ld.tsx` makes `SoftwareSourceCodeJsonLd`'s `codeRepository` optional so a private project's block carries none. The hero's open-source repos metric changes in `src/lib/profile.ts` (`publicProjects.length`, 18 at v3.16.0, 16 since v3.16.1), not in `home/hero.tsx`. v3.16.1 changes no file in this scope; it only lowers the project count to 18 (16 public). In v3.17.0, change (26), the agent-readable surface, changes three files here and adds one: `src/components/site-footer.tsx` gains an "API docs" machine link to `/developers` (the link row now wraps) and Contact and Privacy links in the bottom strip; `src/components/json-ld.tsx` gains `OrganizationJsonLd` and its `ORGANIZATION_ID`, a `description` on `PersonJsonLd` and a `publisher` on `WebSiteJsonLd` that points at the Organization; and `src/components/ui/prose.tsx` is new, the typography kit the `/developers`, `/contact` and `/privacy` pages are built from (section 01). `src/app/layout.tsx` mounts `OrganizationJsonLd` between `PersonJsonLd` and `WebSiteJsonLd`. Change (27), the dependency security release, changes no file in this scope.

**Scope:** `src/components/*.tsx` (root level, excluding `ask-portfolio.tsx` and all `*.test.*` / `*.dom.test.*`), `src/components/home/**`, `src/components/ui/**`, `src/components/scroll/**`, `src/components/mascot/**` (v3.15.0), plus — Coverage-only, no detail section — the 28 sprite sheets in `src/assets/mascots/` that `src/lib/mascots.ts` imports and `src/types/next-image-assets.d.ts`. Explicitly excludes `src/components/chat/`, `src/components/game/`, `src/components/hero-avatar/`, `src/components/hero-graph/`. The `?scroll=` flag store (`src/lib/scroll/*`) is owned by [04](./04-lib-ai-voice-infra.md); the persisted theme store (`src/lib/theme-context.tsx`) is not indexed by any section (see the coverage reconciliation in the [README](./README.md)); this doc covers only their component touchpoints (`ThemeToggle`, `ScrollFlagsSync` in `Providers`).
**Files indexed:** 76 — 47 component files (the 42 of v3.14.0, the four v3.15.0 mascot files and `ui/prose.tsx`) and, Coverage-only, the 28 sprite sheets under `src/assets/mascots/` and `src/types/next-image-assets.d.ts`

## At a glance

| File | Role | Key exports |
|---|---|---|
| `src/components/view-context.tsx` | Module-level external store for the active view + View Transitions commit + `?view=` deep-link sync + router bridge for off-home switches | `View` (type), `ViewProvider`, `useView`, `VIEWS`, `DEFAULT_VIEW`, `isView`, `getServerSnapshot`, `setPendingChatQuery`, `consumePendingChatQuery` |
| `src/components/view-router.tsx` | Swaps the top-level experience; Classic hidden-not-unmounted, others lazily imported + unmounted | `ViewRouter` |
| `src/components/view-switcher.tsx` | Segmented control (Classic/Play/Chat/Dev + post-mount Voice) with a Motion sliding pill; each button wrapped in `Tooltip`; three instances live at once | `ViewSwitcher` |
| `src/components/view-hint.tsx` | Dismissible "try another view" nudge; 24 h-TTL localStorage timestamp, 7 s dwell, `/` + classic only | `ViewHint` |
| `src/components/view-escape-hatch.tsx` | First-focusable "Back to Classic" + "Résumé" pair rendered by four non-classic views | `ViewEscapeHatch` |
| `src/components/providers.tsx` | App-wide client providers: `MotionConfig` → `ViewProvider` → `TooltipProvider` → `ScrollFlagsSync`, plus lazy InkTransition + DiscoveryBadge | `Providers` |
| `src/components/site-nav.tsx` | Sticky header: logo, flag-filtered nav links, two ViewSwitcher instances, header orb, socials + résumé icon + theme toggle, MobileNav | `SiteNav` |
| `src/components/site-footer.tsx` | Footer + machine-readable link row (MCP server, llms.txt, resume.json, API docs) + `/decisions` link + 7 icon links + Contact, Privacy and RSS links + optional visitor counter; hides itself on full-height views | `SiteFooter` |
| `src/components/mobile-nav.tsx` | `< lg` portal drawer with focus trap, Escape close, focus restore; holds the drawer-scoped ViewSwitcher, socials and ThemeToggle | `MobileNav` |
| `src/components/theme-toggle.tsx` | Sun/Moon button over `useTheme()`; `aria-pressed` = light mode active | `ThemeToggle` |
| `src/components/command-palette.tsx` | 86-line eager shell: global ⌘K/Ctrl-K listener, trigger pill, lazy-loads the content module on first use | `CommandPalette` |
| `src/components/command-palette-content.tsx` | The palette itself (789 lines): cmdk groups, MRU recents, voice entries, résumé gate, AI-concierge empty state | `CommandPaletteContent` |
| `src/components/mdx-content.tsx` | Compiles the Velite `code` string into a React component via `new Function` (the CSP `unsafe-eval` driver) | `MDXContent` |
| `src/components/json-ld.tsx` | Eight schema.org JSON-LD blocks with `</`-escaping serialiser; `OrganizationJsonLd` describes the site with a contact point; `SoftwareSourceCode` omits `codeRepository` for a private repository | `PersonJsonLd`, `BreadcrumbJsonLd`, `SoftwareSourceCodeJsonLd`, `OrganizationJsonLd`, `ORGANIZATION_ID`, `WebSiteJsonLd`, `CreativeWorkJsonLd`, `FaqJsonLd`, `ProfilePageJsonLd` |
| `src/components/article-group-card.tsx` | Deduped multi-platform article card ("also on" badge buttons) | `ArticleGroupCard` |
| `src/components/note-card.tsx` | Note card with inkforge provenance badge | `NoteCard` |
| `src/components/project-card.tsx` | OSS project card (RSC) with commit count / group fallback; a private repository shows a "Private repository" marker instead of the GitHub link | `ProjectCard` |
| `src/components/related-writing.tsx` | Compact "Related writing" link list on a project detail page (RSC) | `RelatedWriting` |
| `src/components/platform-badge.tsx` | Tinted per-platform pill; 6 hardcoded brand colours | `ArticleSource` (type), `PlatformBadge` |
| `src/components/github-feed.tsx` | Server-rendered repo grid with relative "updated N ago" from `pushedAgo` | `GithubFeed` |
| `src/components/github-stats-strip.tsx` | Client fetch of `/api/github/stats` with skeleton → content crossfade; hides on zeros | `GithubStatsStrip` |
| `src/components/open-to-work-banner.tsx` | Hiring-signal strip under the nav (RSC; gated by caller) | `OpenToWorkBanner` |
| `src/components/reading-progress.tsx` | 2px compositor-driven scroll progress bar; null under reduced motion | `ReadingProgress` |
| `src/components/copy-button.tsx` | Copy-to-clipboard button with announced "Copied" state (used on `/mcp`) | `CopyButton` |
| `src/components/icons.tsx` | Six inline brand SVGs (lucide-react 1.x dropped brand glyphs) | `Github`, `Linkedin`, `Npm`, `Pypi`, `Devto`, `Substack` |
| `src/components/home/hero.tsx` | Above-the-fold hero; CSS `.hero-rise` entrance, visual slot switched by `NEXT_PUBLIC_HERO_MODE` — `graph` (default, WebGL) \| `avatar` (WebGL) \| `mascot` (v3.15.0, the drawn `HeroMascot` head in flow, no WebGL) | `Hero` |
| `src/components/home/featured-work.tsx` | All work case studies with `register` eyebrow + metrics `<dl>` | `FeaturedWork` |
| `src/components/home/featured-projects.tsx` | Featured OSS repos (the eight `featured` projects) + a "View all N projects" link where N is `allProjects.length` | `FeaturedProjects` |
| `src/components/home/achievements.tsx` | Recognition grid from `achievements` in `@/lib/profile` | `Achievements` |
| `src/components/home/writing-preview.tsx` | Two deduped article groups; returns null when articles disabled/empty | `WritingPreview` |
| `src/components/home/testimonials.tsx` | Flag-gated recommendations; empty-list placeholder branch | `Testimonials` |
| `src/components/home/contact.tsx` | Contact CTA card with copy-email → mailto fallback | `Contact` |
| `src/components/home/resume-view.tsx` | Print-optimised recruiter résumé; `<main>` and `<div>` variants | `ResumeView`, `ResumeViewInline` |
| `src/components/ui/section.tsx` | Page section with mono eyebrow label; `titleAs` h1/h2 escape for standalone pages | `Section` |
| `src/components/ui/prose.tsx` | Typography kit for the plain text pages (`/developers`, `/contact`, `/privacy`): the long-form MDX classes on the existing colour tokens | `ProseH2`, `ProseP`, `ProseList`, `InlineCode`, `CodeBlock` |
| `src/components/ui/reveal.tsx` | Scroll-into-view reveal with mount + reduced-motion static fallback | `Reveal` |
| `src/components/ui/tooltip.tsx` | Radix tooltip wrapper; `TooltipProvider` mounted once in `Providers` | `TooltipProvider`, `Tooltip` |
| `src/components/ui/skeleton.tsx` | Base skeleton + 4 composite shapes + full-viewport view-transition fallback | `Skeleton`, `SkeletonStatCard`, `SkeletonCard`, `SkeletonIframe`, `SkeletonMarkdownLine`, `SkeletonViewTransition` |
| `src/components/ui/ink-transition.tsx` | Raw WebGL2 fBm ink-burn overlay + module-level `inkTransitionRef` handle | `InkTransitionHandle` (type), `inkTransitionRef` (mutable let), `InkTransition` |
| `src/components/scroll/jump-to-latest.tsx` | Presentational "Jump to latest" pill (WCAG 2.2.2 resume control for autoscroll) | `JumpToLatest` |
| `src/components/home/stack.tsx` | Home "Stack" icon wall (v3.14.0), the seventh home section between `FeaturedProjects` and `Achievements`: server component (no `"use client"`), `Section id="stack"`, `Reveal`-wrapped `<ul aria-label="Tools and technologies">` of 22 tiles from `stackItems` (40 px `StackIcon` brand mark or `StackGlyph`), each external `<a>` inside a `Tooltip` with `aria-label` as its only accessible name and an `aria-hidden` mono caption on coarse-pointer devices; closes with a `Link` to `/about#skills` | `Stack` |
| `src/components/skill-chip.tsx` | `/about` "What I work with" chip (v3.14.0): a 14 px `StackIcon`/`StackGlyph` glyph (`aria-hidden`, `.skill-chip-glyph`) before the label when the skill has a `STACK_ENTRIES` record (22 of 34 chips), text only otherwise; brand colour on chip hover through `stackBrandVars()`; server-safe, not a link | `SkillChip` |
| `src/components/stack-icons.tsx` | 19 Simple Icons brand paths (simple-icons@16.35.0, 24×24 `viewBox`, `currentColor`, `aria-hidden`) + 3 lucide glyphs (`Cloud`/`Network`/`Database`) for AWS, gRPC and ChromaDB, whose marks have no usable licence; the CC0 package's three per-icon exceptions (Apache Kafka, OpenTelemetry, Angular) are credited in `THIRD_PARTY_NOTICES.md` | `STACK_ICON_PATHS`, `StackIconKey` (type), `StackGlyphKey` (type), `StackIcon`, `StackGlyph` |
| `src/components/mascot/mascot.tsx` | `Mascot` (v3.15.0, `"use client"`): the page-mascot 0.1.0 head vendored under MIT (Kamran Ahmed; credited in `THIRD_PARTY_NOTICES.md`; local changes: the sector maths moved to `src/lib/mascot-geometry.ts`, `element.animate` feature-detected, global timers, sheet URLs supplied by `SiteMascot`). Props `directions` / `reactions` (served sheet URLs), `size` (number or any CSS length, default 140), `label` (default `mascot`), `className`. Renders one `<button aria-label="Boop the {label}">` holding two absolutely positioned `background-image` layers (`background-size: 300% 300%`; the directions layer shows the current cell via `cellPosition`, the reactions layer is always mounted so its sheet is fetched up front and fades in on a click). Pointer tracking attaches only when `(hover: hover) and (pointer: fine)` matches — passive `pointermove` + `scroll` listeners feeding `aimSector` / `sectorDirection`. A click plays `blink` then `heart` / `sparkle` / `delighted` in turn (payoff at 120 ms, cleared at 560 ms); four boops inside 1.6 s give `dizzy` for 1.1 s. The squash is one Web Animations run (420 ms), skipped under `prefers-reduced-motion` (a sheet swap is not motion). Inline styles only — position it with a wrapper element, not `className`. Guarded by `mascot/mascot.dom.test.tsx`. | `MascotProps` (type), `Mascot` |
| `src/components/mascot/site-mascot.tsx` | `SiteMascot` (v3.15.0): server-safe (no hooks) wrapper that resolves a `MascotCharacter` from `src/lib/mascots.ts` through `mascotSheets()` and renders `Mascot` beneath it — the only client boundary; `priority` additionally emits `<link rel="preload" as="image" fetchPriority="high">` for the directions sheet (React 19 hoists it into `<head>` during SSR; background images are discovered when styles resolve, not by the preload scanner, and `ReactDOM.preload()` from a server component was observed not to reach the prerendered head). Used by `home/hero-mascot.tsx` (`gearbot`, `priority`), `src/app/about/page.tsx` (`gearbot`, 176 px) and `not-found-mascot.tsx`. Guarded by `mascot/site-mascot.dom.test.tsx`. | `SiteMascot` |
| `src/components/mascot/not-found-mascot.tsx` | `NotFoundMascot` (v3.15.0, `"use client"`): one of the thirteen `NOT_FOUND_MASCOTS` per view, picked **in the browser** — `useMounted` keeps the server/first-paint path static, `useMemo` on `mounted` picks once per instance via `pickNotFoundMascot(readLast())`, and an effect writes the pick to `sessionStorage["anvilry:404:mascot"]` (`NOT_FOUND_MASCOT_STORAGE_KEY`) so the next 404 in the tab never repeats it (storage errors fall back to a plain random pick). Renders a centred box with `minHeight: size` (default 120) before and after the pick, so the terminal below never shifts; the button's label comes from the registry. Loaded by `src/app/not-found.tsx:41-44` through `dynamic(..., { ssr: false })` with a same-size fallback, never imported statically. Guarded by `mascot/not-found-mascot.dom.test.tsx`. | `NOT_FOUND_MASCOT_STORAGE_KEY`, `NotFoundMascot` |
| `src/components/home/hero-mascot.tsx` | The `NEXT_PUBLIC_HERO_MODE=mascot` pieces (v3.15.0, server components): `HeroMascotBackdrop` is the same two glow blurs the WebGL slots fall back to, so switching modes never shifts layout or changes the hero's ambient colour; `HeroMascot` renders the `gearbot` head once through `<SiteMascot character="gearbot" size="var(--mascot-size)" priority />` inside a `hero-rise` wrapper that owns the positioning — in flow above the name eyebrow at 9rem below `lg`, `lg:absolute lg:right-0 lg:top-24` at 13rem, `xl:-right-6 xl:top-20` at 15rem (`hero-mascot.tsx:32`; one instance, so the accessibility tree never carries a hidden duplicate). Mounted from `home/hero.tsx:36` and `:41`. | `HeroMascotBackdrop`, `HeroMascot` |

---

## Six-view state machine

### The module-level store (`src/components/view-context.tsx`)

`View` is a 6-member union — not 4: `"classic" | "gamified" | "chat" | "developer" | "voice" | "resume"` (`view-context.tsx:24-25`), mirrored by the `VIEWS` array (`:27-34`) and a `VIEW_ORDER` rank map used only to compute slide direction (`:38-45`).

State lives in module-level bindings **outside React** (`:75-85`):

```ts
let current: View = DEFAULT_VIEW;          // :75
const listeners = new Set<() => void>();   // :76
const emit = () => { for (const l of listeners) l(); };  // :78
```

`subscribe` adds/removes from `listeners` (`:82-85`). `ViewProvider` reads via `useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)` (`:251-255`), then publishes `{ view, setView }` through a React context (`:256-259`). `useView()` throws `"useView must be used within <ViewProvider>"` when the context is null (`:270-274`).

**Why server + first client snapshot always return classic.** `getClientSnapshot` returns the live `current` (`:90`); `getServerSnapshot` returns the literal `DEFAULT_VIEW` (`:91`). Because `current` is initialised to `DEFAULT_VIEW` at module load (`:75`) and nothing mutates it before hydration, the server HTML and the first client render agree — no hydration mismatch, and crawlers/no-JS visitors always get Classic. The comment at `:87-89` states this contract. `src/components/view-context.test.ts:30-35` is the regression guard (asserts `DEFAULT_VIEW === "classic"` and `getServerSnapshot() === "classic"` no matter what `VIEWS` holds) — which is why `getServerSnapshot` and `isView` are re-exported at `:278`.

**How the deep link applies post-hydration.** `ViewQuerySync` (`:236-248`) is a render-nothing leaf that calls `useSearchParams()` and, in a `useEffect`, applies any valid `?view=` value with `setViewInternal(fromUrl, { updateUrl: false, transition: false })` (`:243-244`). Two deliberate flags: `updateUrl:false` avoids rewriting the URL it just read (and skips the off-home redirect below), `transition:false` makes the deep-linked view appear instantly rather than cross-fading on first paint. It is isolated behind its own `<Suspense fallback={null}>` inside `ViewProvider` (`:261-263`) because `useSearchParams` forces client rendering up to the nearest Suspense boundary — keeping it in this leaf lets the whole provider tree above still prerender (`:229-235`).

**No persistence by design.** `setViewInternal` writes only to the URL via `window.history.replaceState` (`:214-219`), deleting the `view` param when the target is `DEFAULT_VIEW` (`:216`). There is no cookie and no localStorage: a bare `/` is always Classic (`:169-173`).

**Off-home switches navigate.** The store is a module singleton that outlives client-side navigation, so `current` says nothing about what is visible on `/work` or `/about`. `ViewRouterBridge` (`:154-164`) publishes `{ push, pathname }` from `useRouter()` / `usePathname()` into a module `let routerBridge` (`:151-152`); `setViewInternal` then does `routerBridge.push("/" or "/?view=<v>")` and returns whenever `updateUrl` is true and `routerBridge.pathname !== "/"` (`:199-202`). This is how the palette's "Recruiter view" works from any route. Documented, accepted narrow race (`:189-198`): the bridge pathname is one render behind an in-flight `router.push`, so two back-to-back switches can push twice (an extra history entry, no lost state). Guarded by `src/components/view-context.dom.test.tsx:70-117` (navigates from a non-home route, and still navigates when `current` already equals the requested view); the race itself is untested.

**Chat query hand-off.** `setPendingChatQuery` / `consumePendingChatQuery` (`:58-66`) are a one-shot module `let` so the palette's "Ask the AI concierge" empty state can switch to chat and have `ChatView` auto-send the query; `consume` clears it so an unrelated later visit never re-fires it.

### The native `document.startViewTransition` path

`commitViewChange()` (`:105-142`) is the transition commit. Three branches:

1. **Snap (plain `emit()`)** when `prefers-reduced-motion: reduce` matches OR `document.startViewTransition` is not a function (`:106-117`).
2. **Ink-bleed** when `process.env.NEXT_PUBLIC_INK_TRANSITION === "true"` (`:123-126`): dynamically imports `@/components/ui/ink-transition` and calls `inkTransitionRef.transitionIn(() => flushSync(emit))`; falls back to `doc!.startViewTransition(() => flushSync(emit))` if the ref is null or the import rejects (`:127-138`).
3. **Default**: `doc.startViewTransition(() => flushSync(emit))` (`:141`).

The `flushSync` is load-bearing: `useSyncExternalStore` emits are batched/async, and `startViewTransition` snapshots the DOM before and after its callback — without `flushSync` the "after" snapshot is still the old view and nothing animates (`:96-100`).

Direction is stamped on `<html>` **before** the snapshot: `document.documentElement.dataset.viewDir = VIEW_ORDER[view] > VIEW_ORDER[current] ? "forward" : "backward"` (`:207-210`), and only when `transition` is true.

### The `::view-transition-*` CSS hooks

Two named transition groups exist in the tree:

- `view-router.tsx:56` — the wrapper `<div style={{ viewTransitionName: "view-body" }}>`
- `site-nav.tsx:68` — the sticky `<header style={{ viewTransitionName: "site-header" }}>`

`src/app/globals.css:389-430` drives them:

- Four slide keyframes `vt-slide-in-from-right` / `-from-left` / `vt-slide-out-to-left` / `-to-right` (`globals.css:395-398`).
- Forward: `[data-view-dir="forward"]::view-transition-new(view-body)` slides in from right, `::view-transition-old(view-body)` slides out left — `0.28s cubic-bezier(0.21, 0.47, 0.32, 0.98) both` (`globals.css:401-406`).
- Backward: mirrored, comment plus both rules (`globals.css:408-414`).
- `::view-transition-old(site-header), ::view-transition-new(site-header) { animation: none; mix-blend-mode: normal; }` pins the sticky nav so it does not fade with the body (`globals.css:415-420`).
- A belt-and-suspenders reduced-motion kill switch sets `animation: none !important` on `::view-transition-group(*)`, `-old(*)`, `-new(*)` (`globals.css:424-430`) — redundant with the JS gate at `view-context.tsx:106-117`, intentionally so.

### Surrounding machinery

**`view-router.tsx`** — Classic arrives as `children` (the server-rendered `page.tsx` tree, wired at `src/app/page.tsx:25-36`) and is **always mounted**, toggled with `hidden={view !== "classic"}` + matching `aria-hidden` (`:58`) so scroll position survives a round trip. Chat / Play / Developer / Voice / Resume are `next/dynamic` with `ssr: false` and a `SkeletonViewTransition` loading fallback each (`:25-50`), and are **unmounted** when inactive — the comment at `:9-24` records that unmounting (not hiding) the gamified view is what lets R3F dispose the WebGL context, since a hidden-but-live context leaks GPU memory on low-end mobile. Every optional view is additionally gated by `isViewEnabled(...)` (`:64-69`; `src/lib/enabled-views.ts:37` — Classic and Resume are always on, an unset `NEXT_PUBLIC_ENABLED_VIEWS` enables everything else), so `?view=chat` on a build with chat disabled silently stays on Classic. Voice receives `onClose={() => setView("classic")}` (`:67`).

**`view-switcher.tsx`** — `OPTIONS` holds only 4 entries: classic/gamified(label "Play")/chat/developer (`:25-60`), each carrying a `description` shown in a `Tooltip` around the button (`:127`). `VOICE_OPTION` (`:67-73`) is appended **only** when `mounted && !compact && isViewEnabled("voice")` (`:99-105`). The `useMounted()` gate (`src/lib/use-mounted.ts`, server snapshot `false` / client `true`) is described in-file as "the hydration contract; it is NOT a feature flag" (`:62-66`) — the switcher must render 4-way on the server to match the always-classic SSR snapshot, then upgrade to 5-way on the full (non-compact) instance. `resume` is **never** in the switcher; it is reachable only via ⌘K "Recruiter view" or `?view=resume`. **Three** instances can be in the DOM at once: full (`site-nav.tsx:102`, `lg:block`), compact (`site-nav.tsx:105`, `sm:block lg:hidden`), and a compact `scope="drawer"` one inside the open MobileNav (`mobile-nav.tsx:113`, `sm:hidden`). `layoutId` is `` `view-switcher-active-${compact ? "compact" : "full"}${scope ? `-${scope}` : ""}` `` (`:112`), with the `scope` prop (`:93`) needed because the top-row compact pill is always mounted (CSS-only visibility) and the drawer opens in the sm–lg range too; a shared `layoutId` would make Motion animate one pill between instances (`:106-111`). The pill content sits in a `relative z-10` wrapper, never a negative z-index (`:147-150`).

**`view-hint.tsx`** — its own tiny `useSyncExternalStore` over `localStorage["anvilry-hint-seen"]` (`:9`, `:23-55`). Dismissal stores `String(Date.now())` (`:26`) and sticks for `DISMISS_TTL_MS` = 24 h (`:13`); a legacy literal `"1"` is honoured as a permanent dismissal (`:45`); an unparseable value counts as dismissed (`:47`). Server snapshot is `() => true`, i.e. "dismissed", so SSR/no-JS never flashes the hint (`:53`); a `localStorage` throw also returns `true` ("can't persist → don't nag", `:50`). The hint additionally waits `SHOW_DELAY_MS` = 7 s after mount (`:18`, `:85-88`) and renders `null` unless `pathname === "/"` **and** `view === "classic"` (`:90-91`) — the pathname check matters because the view store defaults to classic on every standalone route. Placement is top-anchored under the nav below `sm`, bottom-right above it (`:94`), and the copy switches on `useMediaQuery("(min-width: 640px)")` between "use the … switcher up top" and "tap the menu" (`:83`, `:106-117`; guarded by `view-hint.dom.test.tsx:49-74`). Mounted once from `src/app/layout.tsx:164`.

**`view-escape-hatch.tsx`** — "Back to Classic" is a `<button>` calling `setView("classic")`; "Résumé" is a real `<a href="/resume">` so it survives a failed view bundle (`:6-12`, `:17-31`). Documented contract: it is rendered as the FIRST focusable element of each non-classic view so neither the gamified nor chat experience becomes a keyboard trap. Real importers: `chat/chat-view.tsx:85`, `chat/anvil-view.tsx:35`, `game/game-view.tsx:32`, `game/developer-view.tsx:45`. `view-router.tsx` does **not** render it, and neither does `home/resume-view.tsx` (its docblock at `:14-16` claims otherwise — stale), so the `?view=resume` view has no in-page "back to Classic" control.

**Discovery side effect:** any deliberate view switch calls `unlock("view-switch")` from `@/lib/discovery-store` (`view-context.tsx:213`), the first of 4 exploration badges.

---

## Detail

### `src/components/mdx-content.tsx`
- **Role:** Turns the Velite-compiled MDX function-body string into a React component, with a Tailwind-styled element map.
- **Exports:** `MDXContent` (component) — props `{ code: string }`.
- **Reads / depends on:** `react/jsx-runtime` (spread into the compiled factory).
- **Consumed by:** `src/app/projects/[slug]/page.tsx`, `src/app/articles/[slug]/page.tsx`, `src/app/notes/[slug]/page.tsx`, `src/app/work/[slug]/page.tsx`.
- **Behaviour notes:** `compileMDX` is literally `const fn = new Function(code); return fn({ ...runtime }).default;` (`:14-17`). `MDXContent` wraps it in `useMemo(..., [code])` (`:71`) and renders `<Component components={components} />` with an `eslint-disable react-hooks/static-components` on the line above (`:72-73`). The `components` map styles `h2, h3, p, ul, li, a, strong, blockquote, code` (`:20-64`).
- **Gotchas / invariants:**
  - **CSP consequence.** This `new Function` is the sole reason `'unsafe-eval'` is in the enforced CSP. `next.config.ts:43-49` documents it: *"'unsafe-eval' is required in BOTH dev AND production… Velite outputs a serialized `code` string; MDXContent deserialises it via `new Function` client-side on EVERY page with MDX body content (projects, work, notes). Removing 'unsafe-eval' crashes all project/work/note pages with a React render-error boundary."* The directive shipped is `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://va.vercel-scripts.com https://vercel.live` (`next.config.ts:51`), enforced (not Report-Only) via the `Content-Security-Policy` key at `next.config.ts:116`. (The file's top docblock at `next.config.ts:19-20` still says "shipped as Report-Only first" — stale.)
  - **Trust boundary** (`:6-13`): `code` must only ever be Velite output from the build-time `content/` directory. Passing any runtime/request-derived string here is arbitrary code execution.

### `src/components/providers.tsx`
- **Role:** The single client provider shell mounted from the root layout.
- **Exports:** `Providers` (component) — props `{ children, discoveryBadgesEnabled: boolean }`.
- **Reads / depends on:** `motion/react` `MotionConfig`, `@/components/view-context` `ViewProvider`, `@/components/ui/tooltip` `TooltipProvider`, `@/lib/scroll/scroll-flags` `ScrollFlagsSync`; lazily `@/components/ui/ink-transition` and `@/components/game/discovery-badge` (both `ssr: false`, `:13-24`).
- **Consumed by:** `src/app/layout.tsx:138`.
- **Behaviour notes:** Nesting order is `MotionConfig reducedMotion="user"` → `ViewProvider` → `TooltipProvider` → `ScrollFlagsSync` → `children` (`:52-56`), so every view inherits the same motion governance (`:26-32`) and every `Tooltip` (switcher pills, nav icons, `CopyButton`, `ThemeToggle`, the palette trigger) has its provider. `InkTransition` and the optional `DiscoveryBadgeComponent` are siblings of `TooltipProvider` inside `ViewProvider` (`:58-60`): `InkTransition` always mounts (hidden canvas), the badge only when `discoveryBadgesEnabled`. `ScrollFlagsSync` isolates `useSearchParams` behind its own Suspense (`:33-35`).
- **Gotchas / invariants:** `discoveryBadgesEnabled` is resolved **server-side** in `layout.tsx:90` via `getDiscoveryBadgesEnabled()` and threaded in as a prop, because this file is `"use client"` and cannot await server functions (`:41-43`).

### `src/components/site-nav.tsx`
- **Role:** Sticky site header.
- **Exports:** `SiteNav({ hasNotes, hasArticles }: SiteNavProps)` (`:38`). The root layout (a Server Component) imports the `hasNotes` / `hasArticles` constants from `@/lib/content` (`allNotes.length > 0` / `allArticles.length > 0`) and passes them down as plain props so this client component never imports `@/lib/content` — that module would pull every collection's compiled-MDX JSON into the client bundle (`:20-28`). `hasNotes` derives from `allNotes`, which is empty while `NOTES_ENABLED` is off.
- **Reads / depends on:** `usePathname`, `@/lib/profile` `profile`, `@/lib/writing-flags` `ARTICLES_ENABLED`/`NOTES_ENABLED`/`STATS_ENABLED`/`SEARCH_ENABLED`, `ViewSwitcher`, `chat/header-orb-trigger` `HeaderOrbTrigger`, `MobileNav`, `ThemeToggle`, `ui/tooltip` `Tooltip`, `icons`, lucide `FileText`.
- **Consumed by:** `src/app/layout.tsx:139` — `<SiteNav hasNotes={hasNotes} hasArticles={hasArticles} />`.
- **Behaviour notes:** `navLinks` is built inside the component body (`:42-55`): Work, Projects, Articles (flag **and** content), **Writing** (`/notes`, flag **and** content — the label is "Writing", not "Notes"), About, Résumé, then Stats / Search when their flags are on. `isActive` (`:31-36`) treats `/` exactly, `/#…` anchors as homepage-active, and everything else as prefix-match on `${href}/`; it drives both the accent class and `aria-current="page"` (`:85`, `:89`). Two `ViewSwitcher` instances render here — full at `lg:block` (`:101-103`), `compact` at `sm:block lg:hidden` (`:104-106`); below `sm` the switcher lives only in the MobileNav drawer (comment `:96-100`). `HeaderOrbTrigger` (`:110`) is the Anvil voice door on every viewport and route; it renders nothing when `NEXT_PUBLIC_ANVIL_ORB_MODE=off` or speech recognition is unsupported, and is disabled on the voice view. The desktop icon cluster (`lg:flex`, `:119-152`) is GitHub, LinkedIn, a Résumé file icon (all inside `Tooltip`) and `ThemeToggle` (`:151`); the full profile set (npm/PyPI/Dev.to/Substack) is deliberately kept out of the nav (comment `:112-118`). `<MobileNav links={navLinks} />` at `:155` receives the same filtered list.
- **Gotchas / invariants:** `style={{ viewTransitionName: "site-header" }}` (`:68`) is what `globals.css:415-420` pins; removing it would make the sticky nav fade on every view switch. `h-14` is set on the `<header>` itself, not just the inner `<nav>` (`:59-67`, `:70`), so the border-box height is exactly 3.5rem — every "header is 3.5rem" assumption (`scroll-padding-top`, the `h-[calc(100dvh-3.5rem)]` mains of chat/developer, `SkeletonViewTransition`, the drawer's `top-14`) depends on that; the comment records a 1px permanent overflow bug when only the inner nav had it.

### `src/components/site-footer.tsx`
- **Role:** Global footer, machine-readable link row, optional visitor counter, copyright/RSS strip.
- **Exports:** `SiteFooter` (component, no props). `VisitorBadge` is module-private.
- **Reads / depends on:** `useView`, `@/lib/profile`, env `NEXT_PUBLIC_VISITOR_COUNTER`, env `NEXT_PUBLIC_BUILD_YEAR`, `POST /api/visit`.
- **Consumed by:** `src/app/layout.tsx:148`.
- **Behaviour notes:** Returns `null` when `FULL_HEIGHT_VIEWS = new Set(["chat", "developer"])` contains the active view (`:116`, `:121`) — client-gated so the SSG Classic HTML still ships a footer for crawlers (`:110-115`). Left column: name, role · location, a `/decisions` "Decisions & rationale →" link (`:134-139`) and the counter when `showVisitorCounter` (`:119`, `:141-145`). `MACHINE_LINKS` are `/mcp`, `/llms.txt`, `/api/resume.json` and `/developers` labelled "API docs" (`:103-108`); the `// for AI:` row is a `flex-wrap` nav because it now has four links (`:150-153`). The icon row is seven links: GitHub, LinkedIn, npm, PyPI, Dev.to, Substack, `mailto:` (`:166-228`). The bottom strip carries the copyright year and, in its right-hand group, `next/link` links to `/contact` and `/privacy` and the `/feed.xml` RSS link (`:239-255`). `VisitorBadge` starts at `total = null` (skeleton, `:83-90`), seeds from `localStorage["anvilry:visits:total"]` (`:17`) in a mount effect, then POSTs `/api/visit`; only a **positive** total overwrites the cache (`:59-65`); a `0`/failed response with no cache sets `total = 0` (`:66-71`, `:75-78`) and `total === 0` hides the badge entirely (`:91`). Guarded by `site-footer.dom.test.tsx:25-113`, and by a later block that asserts `/developers`, `/contact` and `/privacy` are linked from the footer and that `/mcp`, `/llms.txt` and `/api/resume.json` still are.
- **Gotchas / invariants:** The localStorage seed is deliberately in `useEffect`, not the `useState` initialiser — doing it in the initialiser causes a hydration mismatch (`:33-36`), with a targeted `eslint-disable react-hooks/set-state-in-effect` at `:50`. The copyright year is `process.env.NEXT_PUBLIC_BUILD_YEAR ?? "2026"` (`:240`), **not** `new Date()`: under `cacheComponents` an in-render `new Date()` fails the prerender as an unstable value, and this footer is on nearly every route (`:234-238`; the env var is computed in `next.config.ts:129`).

### `src/components/mobile-nav.tsx`
- **Role:** `< lg` navigation drawer (the desktop link row is `hidden … lg:flex`; `sm`–`lg` is *not* served by the top row's links).
- **Exports:** `MobileNav` (component) — props `{ links: { href: string; label: string }[] }`.
- **Consumed by:** `src/components/site-nav.tsx:155`.
- **Behaviour notes:** The wrapper is `lg:hidden` (`:73`). The backdrop + panel render through `createPortal(…, document.body)` (`:88-89`, `:163`) because the header's `backdrop-blur-md` makes it the containing block for `position: fixed` descendants, which would collapse the `top-14` backdrop to zero height (`:22-29`). While open, a `keydown` listener handles Escape (close) and Tab/Shift-Tab wrap-around over `'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'` inside `panelRef` (`:37-63`); focus moves into the panel on open (`:61`). A second effect restores focus to `triggerRef` when the drawer closes, tracked by a `wasOpen` ref (`:66-70`). Panel is `role="dialog" aria-modal="true"` with `id="mobile-nav-panel"` wired to `aria-controls` (`:81`, `:96-101`). Drawer contents, top to bottom: a `sm:hidden` `<ViewSwitcher compact scope="drawer" />` (`:112-114`), the link list (`:115-126`), then GitHub, LinkedIn and `<ThemeToggle size={20} />` (`:127-160`). The toggle is wrapped in a `[&>button]` padding variant so its hit target matches the neighbouring icons (`:152-159`).
- **Gotchas / invariants:** The focus trap only queries inside `panelRef`; adding focusable chrome outside the panel while open would escape the trap. There is no Résumé icon in the drawer; Résumé is reached through the link list.

### `src/components/theme-toggle.tsx`
- **Role:** Light/dark switch used in the desktop nav and the drawer.
- **Exports:** `ThemeToggle({ size = 18 })`.
- **Reads / depends on:** `useTheme` from `@/lib/theme-context` (module-level external store persisted at `localStorage["anvilry:theme"]`, default `"dark"`; not indexed by any section), `ui/tooltip`.
- **Consumed by:** `site-nav.tsx:151`, `mobile-nav.tsx:158`.
- **Behaviour notes:** `aria-pressed` reflects light mode (the non-default state) and `aria-label` names the action the click performs (`:18-19`, `:26-27`). The no-flash inline script that applies the persisted `data-theme` before hydration lives in `src/app/layout.tsx:112-124`, not here.

### `src/components/command-palette.tsx` and `command-palette-content.tsx`
- **Role:** ⌘K command palette — the site's keyboard control surface, split into an eager shell and a lazy body so the ~140 KB of cmdk / Radix / voice UI stays off the initial bundle (`command-palette.tsx:8-18`).
- **Exports:** `CommandPalette` (shell) — props `{ discoveryBadgesEnabled: boolean }`; `CommandPaletteContent` — props `{ discoveryBadgesEnabled, open, onOpenChange, triggerRef }`. `Group` is module-private (`command-palette-content.tsx:753`).
- **Consumed by:** shell at `src/app/layout.tsx:149`; content only via the shell's `next/dynamic` (`ssr: false`, `command-palette.tsx:12-18`).
- **Shell behaviour:** The global hotkey is `e.key === "k" && (e.metaKey || e.ctrlKey)` (`command-palette.tsx:35`), and it is the reason the shell is mounted eagerly — most ⌘K presses precede any click (`:31-32`). The first press or trigger click sets `loaded` and mounts the content, which is then left mounted forever so its recents and dialogs behave as if always present (`:73-83`). The trigger pill sits `bottom-20 right-5 … sm:bottom-5` (`:59`) so it does not cover the chat composer's Send button on narrow screens (`:47-50`), wrapped in a `Tooltip`.
- **Content behaviour:** On open it reloads MRU recents and clears the query (`:130-135`); on close it restores focus to the trigger pill (`:138-141`). Recents live in `localStorage["anvilry:cmd:recent"]`, capped at `RECENT_MAX = 5` (`:81-82`, `:144-154`), and are shown **only** on an empty query so a recent never appears beside its canonical copy (`:626-629`). Groups rendered in order: Recent, Switch view, Navigate, Actions, Voice (only if non-empty), Work, Projects, Links (`:708-725`). `switchTo` closes the palette before calling `setView` (`:165-171`). Switch-view entries: Classic, Play, Developer mode, Chat, Recruiter view (→ `switchTo("resume")`, `:222-229`), plus "Unlock all discoveries" when badges are enabled (`:230-244`). Navigate includes Home, Work, Projects, **Decisions** (`/decisions`, `:263-270`), About, Résumé, Contact (`/#contact`). Links include GitHub, LinkedIn, npm, PyPI, Dev.to, Substack, Email and "Schedule a call" (Calendly, `:337-344`). `copyEmail` shows a 1500 ms "Copied!" and falls back to `mailto:` if the clipboard API throws (`:176-184`); the confirmation is announced via a separate `aria-live="polite"` region because flipping a cmdk item label is not a live region (`:683-688`). The Developer-mode entry fires `track("devmode_palette_open")` (`:209`). Résumé download entries derive from `profile.resumeVariants`, gated to `[resumeVariants[0]]` unless `NEXT_PUBLIC_RESUME_VARIANTS === "true"` (`:363-375`). Voice entries are feature-detected at render: `ttsSupported` = `"speechSynthesis" in window`, `sttSupported` = `"SpeechRecognition" in window || "webkitSpeechRecognition" in window` (`:390-394`). **The "Start voice conversation" (talk-mode) entry requires `sttSupported && settings.talkSurface === "modal" && !isVoiceViewActive(view)`** (`:437-456`): it is absent on the full-page voice view, which already owns the mic, so a second session cannot stack (`isVoiceViewActive` lives in `chat/voice-surface-mutex.ts:27`; the header orb applies the same guard). It opens the modal via `openTalkMode(triggerRef.current)` so focus returns to the pill (`:450`). Enabling the wake word also forces `setView("chat")` (`:584`). An empty-result search turns `Command.Empty` into an "Ask the AI concierge: …" button that calls `setPendingChatQuery` then `switchTo("chat")` (`:691-701`); guarded by `command-palette-content.dom.test.tsx:86-121` (redirect) and `:123-140` (talk-mode entry hidden on the voice view).
- **Gotchas / invariants:**
  - Actions whose **label mutates** must pin a stable `value` — cmdk re-scores on value change. See the `value:` fields on `copy-email` (`:361`), `voice-tts` (`:478`), `voice-engine` (`:506`), `voice-stt-engine` (`:534`), `voice-surface` (`:563`), `voice-wake` (`:588`).
  - `NEXT_PUBLIC_RESUME_VARIANTS` is read **inside the function body**, not module scope, so `vi.stubEnv` works in tests (`:363-364`).
  - `DialogTitle`/`DialogDescription` are imported from `@radix-ui/react-dialog` and only work because cmdk deduplicates to the same Radix instance (`:13-20`, `:655-661`).
  - Recent items get a `valuePrefix="recent"` so their cmdk values do not collide with the canonical copies (`:713`, `:772`).
  - `VoicePicker` and `VoiceSettingsDialog` are siblings of the palette dialog, opened only after it closes, to avoid two stacked Radix focus traps fighting (`:730-748`).

### `src/components/json-ld.tsx`
- **Role:** All schema.org structured-data blocks (RSC — no `"use client"`).
- **Exports:** `PersonJsonLd`, `BreadcrumbJsonLd({ items })`, `SoftwareSourceCodeJsonLd({ name, description, url, codeRepository?, tech, dateCreated?, license? })`, `OrganizationJsonLd` and `ORGANIZATION_ID` (`${SITE_URL}/#organization`, `:162`), `WebSiteJsonLd`, `CreativeWorkJsonLd({ name, description, url, keywords, image? })`, `FaqJsonLd`, `ProfilePageJsonLd`. There is no Article schema block.
- **Reads / depends on:** `@/lib/profile` (`profile`, `skills`), `@/lib/personal` `now`, `SITE_URL` from `@/lib/site-url` (`:3`).
- **Consumed by:** `src/app/layout.tsx:125-128` (Person, Organization, WebSite, Faq), `src/app/projects/[slug]/page.tsx` (SoftwareSourceCode, Breadcrumb), `src/app/articles/[slug]/page.tsx` and `src/app/notes/[slug]/page.tsx` (Breadcrumb only), `src/app/work/[slug]/page.tsx` (Breadcrumb, CreativeWork), `src/app/about/page.tsx` (ProfilePage).
- **Behaviour notes:** Every block emits through `safeJsonLd`, which is `JSON.stringify(data).replace(/<\//g, "<\\/")` (`:9-11`) — `JSON.stringify` alone does not escape `</script>`, which would break out of the script tag (`:5-8`). `isOpenToWork` is derived from `now.focus.some((f) => /open to (new )?roles?/i.test(f))` (`:17`) and conditionally adds a `seeks: { @type: "Demand" }` property (`:47-49`) — removing the "open to new roles" line from `personal.ts` drops the schema signal automatically. `PROGRAMMING_LANGUAGES` is a 19-member allowlist (`:91-111`); a `tech` entry outside it becomes a keyword rather than a `programmingLanguage` (`:135`). `codeRepository` is optional since v3.16.0 and is spread in only when truthy (`...(codeRepository && { codeRepository })`), so the block for a private project carries no repository URL ("advertising a URL that 404s helps no crawler"); `projects/[slug]/page.tsx` passes `repoLink(project) ?? undefined`, and `dateCreated` and `license` were already optional for the same reason. Guarded by `json-ld.dom.test.tsx`. `CreativeWorkJsonLd` deliberately omits `aggregateRating` (Google's self-serving-review policy, `:228-229`) and optionally emits `image` (`:235-242`, `:256`).
- **Agent-readiness blocks:** `PersonJsonLd` gained a `description` (`${profile.headline} ${profile.subhead}`, `:29`). `OrganizationJsonLd` (`:171-201`) describes the site itself, "Anvilry", run by one person: `@id` `ORGANIZATION_ID`, `name`, `url`, `description`, `founder` (the Person), `email`, a `PostalAddress` from `profile.locationCity` and `profile.locationCountry`, a `ContactPoint` (`contactType: "professional inquiries"`, the email, `${SITE_URL}/contact`, English) and `sameAs` of the GitHub and LinkedIn profiles. Its docblock (`:164-170`) records the scope: it models the site, not the employer, so `worksFor` on the Person stays a bare name, and only data already public in `profile.ts` appears; the phone number that sits in the résumé PDF does not. `WebSiteJsonLd` adds `publisher: { "@id": ORGANIZATION_ID }` (`:218`). `json-ld.dom.test.tsx` pins a descriptive Person (the headline in the description, more than 80 characters), the Organization's contact point and address, its stable `@id` that the WebSite publisher points at, and the absence of the phone number.
- **Gotchas / invariants:** The base URL `https://anvilry.vercel.app` is hardcoded in **six** places here: `:31`, `:146`, `:216`, `:253`, the `BASE_URL` constant at `:266` (used at `:337`), and `:312`, which sits inside FAQ answer prose so a find-and-replace on `BASE_URL` misses it. The new `OrganizationJsonLd` reads `SITE_URL` (`:162`, `:177`, `:190`) instead, so it is not one of the six. `CLAUDE.md` lists this file among those that must be edited when pointing a custom domain at the deployment; the authoritative repo-wide count lives in [15 § The hardcoded base URL](./15-invariants-and-gotchas.md#the-hardcoded-base-url). The `FaqJsonLd` answers embed real metrics and product names as literal strings (`:270-324`).

### `src/components/article-group-card.tsx`
- **Role:** Card for a deduplicated article group (same essay across platforms).
- **Exports:** `ArticleGroupCard` (component) — props `{ group: ArticleGroup }`.
- **Reads / depends on:** `@/lib/article-grouping` `ArticleGroup` (`{ canonical, platforms, externalPlatforms }`, defined at `src/lib/article-grouping.ts:32-39`), `PlatformBadge`, `NOTES_ENABLED`.
- **Consumed by:** `src/app/articles/page.tsx`, `src/components/home/writing-preview.tsx`.
- **Behaviour notes:** `resolveCanonicalHref` cascade (`:18-30`): `linkedNote` **only if `NOTES_ENABLED`** → `canonical.externalUrl` → first `externalPlatforms[].externalUrl` → `canonical.url`. Only external hrefs get `target="_blank" rel="noopener noreferrer"` (`:46`). Tags are sliced to 3 (`:91`). `fmt()` is a UTC en-US date formatter duplicated verbatim in `note-card.tsx`.
- **Gotchas / invariants:** Secondary platform badges are `<button>` elements calling `window.open` with `stopPropagation` + `preventDefault`, **not** `<a>` — nesting an anchor inside the card's outer `<Link>` would be invalid HTML (`:55-73`). `related-writing.tsx:12-18` re-implements the same linkedNote-if-`NOTES_ENABLED` → `externalUrl` → `url` rule independently for single articles.

### `src/components/note-card.tsx`
- **Role:** Note card.
- **Exports:** `NoteCard` — props `{ note: Note }`.
- **Consumed by:** `src/app/articles/page.tsx`, `src/app/notes/page.tsx`. `notes/page.tsx` maps `allNotes` directly and `articles/page.tsx` maps `inkforgeArticles` (a filter of `allNotes`, additionally gated by `INKFORGE_ARTICLES_ENABLED`), so with `NOTES_ENABLED` off no note card renders anywhere.
- **Behaviour notes:** Shows a `Sparkles` "inkforge" badge when `note.generatedBy === "inkforge"` (`:31-36`) — that field is optional in the Velite note schema (`velite.config.ts:128`), so hand-written notes simply omit the badge. `readingTime` likewise renders only when present (`:56`). Tags sliced to 3 (`:50`).

### `src/components/project-card.tsx`
- **Role:** OSS project card (server component — no `"use client"`); shows a "Private repository" marker instead of a repo link for a private project.
- **Exports:** `ProjectCard` — props `{ project: Project }`.
- **Consumed by:** `src/app/projects/page.tsx`, `src/components/home/featured-projects.tsx`.
- **Behaviour notes:** Footer shows `project.commits.toLocaleString()` when `commits != null`, otherwise falls back to `project.group` (`:57-66`). `tech` sliced to 5 with a trailing space text node between spans so Pagefind excerpts keep word boundaries (`:41-53`). Two separate links to `project.url` (title + "Details"). The repository link is resolved once, `const repo = repoLink(project)` (`:7`): when it is non-null the header carries the external GitHub icon link (`target="_blank"`, `aria-label` "{name} on GitHub", `:17-26`); when it is `null` (a project with `visibility: "private"`) that slot is a plain `<span>` with an `aria-hidden` lock icon and the text "Private repository" (`:27-31`), and the card never reads `project.repo` itself. The dossier page stays reachable through the title and "Details" links. Guarded by `project-card.dom.test.tsx` (v3.16.0).

### `src/components/related-writing.tsx`
- **Role:** "Related writing" list on a project detail page (RSC).
- **Exports:** `RelatedWriting` — props `{ articles: Article[] }`; returns `null` for an empty list (`:21`).
- **Consumed by:** `src/app/projects/[slug]/page.tsx:182`.
- **Behaviour notes:** `resolveHref` (`:12-18`): `/notes/<linkedNote>` only when `NOTES_ENABLED`, else `externalUrl` (new tab + `ExternalLink` icon), else `article.url`.

### `src/components/platform-badge.tsx`
- **Role:** Tinted per-platform pill.
- **Exports:** `ArticleSource` (type union: `medium | substack | linkedin | devto | hashnode | native`), `PlatformBadge` — props `{ source: ArticleSource }`.
- **Consumed by:** `src/app/articles/page.tsx`, `article-group-card.tsx`; the type is also imported by `src/lib/article-grouping.ts:2`.
- **Behaviour notes:** `SOURCE_CONFIG` hardcodes brand hex per platform with 0.08 bg / 0.2 border alpha (`:13-23`); `native` is labelled **"Essay"** with the accent cyan `#38e1ff`. Unknown sources fall back to `native` via `?? SOURCE_CONFIG.native` (`:26`).
- **Gotchas / invariants:** The union must stay in sync with the Velite article `source` enum (`velite.config.ts:150`).

### `src/components/github-feed.tsx`
- **Role:** Server-rendered first-party GitHub repo grid.
- **Exports:** `GithubFeed` — props `{ repos: GithubRepo[] }`.
- **Reads / depends on:** `@/lib/github` `pushedAgo` and the `GithubRepo` type.
- **Consumed by:** `src/app/projects/page.tsx`.
- **Behaviour notes:** Returns `null` on an empty array (`:14`) — documented as "empty-safe: with no resolved repos (token unset + all private, or rate-limited at build) the whole section renders nothing" (`:9-11`). The relative label comes from `pushedAgo` in `src/lib/github.ts:171` (module-level `Intl.RelativeTimeFormat`; buckets year ≤ −365 d / month ≤ −30 / week ≤ −7 / day; `""` for empty or unparseable input, which hides the label). Star/fork counts carry `sr-only` prefixes (`:35`, `:40`).
- **Gotchas / invariants:** Replaces third-party github-readme-stats `<img>` cards specifically so no external request sits in the visitor's path (`:4-8`).

### `src/components/github-stats-strip.tsx`
- **Role:** Client-fetched aggregate GitHub stat cards on the homepage.
- **Exports:** `GithubStatsStrip` (no props). `StatCard` is module-private.
- **Reads / depends on:** `GET /api/github/stats`, `motion/react` (`motion`, `AnimatePresence`), `ui/reveal` `Reveal`, `ui/skeleton` `SkeletonStatCard`, `pushedAgo` from `@/lib/github` (`:8`).
- **Consumed by:** `src/components/home/hero.tsx:175`, itself gated by `GITHUB_STATS_ENABLED` (`NEXT_PUBLIC_GITHUB_STATS_ENABLED === "true"`, default off, `hero.tsx:169`).
- **Behaviour notes:** Three-state machine `"loading" | "ready" | "empty"` (`:18`). Enters `ready` only when `data.followers > 0 || data.publicRepos > 0`; anything else (including a non-OK response or a network throw) becomes `empty` (`:44-56`). `empty` returns `null` entirely — "a strip showing 0/0/— is worse than nothing" (`:58-59`). `AnimatePresence mode="wait"` crossfades skeleton → content; the loading grid carries `role="status"` + an `sr-only` announcement (`:63-78`). Content is up to **five** cards: followers, public repos, stars, forks (zero stars/forks render as `"—"`, `:102-119`) and a "last shipped" card from `mostRecentPush` via `pushedAgo`, present only when the field is non-null (`:120-126`); the grid is `sm:grid-cols-3 lg:grid-cols-5` so a lone fifth card never orphans (`:87-91`). Guarded by `github-stats-strip.dom.test.tsx:18-89`.
- **Gotchas / invariants:** `stats!` non-null assertions at `:94-123` are only safe because `fetchState === "ready"` implies `stats` was set in the same `.then`.

### `src/components/open-to-work-banner.tsx`
- **Role:** Hiring-signal strip below the sticky nav (server component).
- **Exports:** `OpenToWorkBanner` (no props).
- **Consumed by:** `src/app/layout.tsx:140`, as `{OPEN_TO_WORK && <OpenToWorkBanner />}` — the flag check lives in the caller, not here.
- **Behaviour notes:** Hardcoded copy "Open to Backend, GenAI & Full-Stack roles · remote or Hyderabad" (`:16`) plus "Email me" (mailto) and "Schedule a call" (`profile.calendlyUrl`) CTAs (`:19-33`). A pulsing green dot is `aria-hidden` (`:15`). Its rendered height is `OPEN_TO_WORK_BANNER_HEIGHT_REM` (2.3125rem) in `src/lib/writing-flags.ts`; the exact-height chat and developer mains subtract it when the flag is on.
- **Gotchas / invariants:** The header docblock claims the banner is "hidden via CSS (h-0) when the flag is off so there is zero layout shift" (`:6-8`) — **the code does not do this**; `layout.tsx:140` conditionally omits the element entirely. Treat the comment as stale.

### `src/components/reading-progress.tsx`
- **Role:** Top-of-viewport scroll progress bar.
- **Exports:** `ReadingProgress` (no props).
- **Reads / depends on:** `motion/react` `useScroll` + `useReducedMotion` (Motion's own, not `@/lib/use-reduced-motion`).
- **Consumed by:** `src/app/notes/[slug]/page.tsx:70` only.
- **Behaviour notes:** Returns `null` under reduced motion (`:15`). Drives `scaleX` from `scrollYProgress` on a `fixed … h-[2px] origin-left` bar — compositor-only, zero React re-renders (`:5-9`, `:18-22`). `aria-hidden="true"`. Uses window scroll, not a shell scroll container.

### `src/components/copy-button.tsx`
- **Role:** Generic copy-to-clipboard button.
- **Exports:** `CopyButton` — props `{ value: string; label?: string }` (default label `"Copy"`).
- **Consumed by:** `src/app/mcp/page.tsx:88-108` (endpoint URL, Claude config, Cursor config).
- **Behaviour notes:** Wrapped in `Tooltip` (`:25`), so it needs the `TooltipProvider` from `Providers`. 1800 ms "Copied" window (`:18`); a clipboard rejection is silently swallowed as a documented no-op (`:19-21`) — unlike `Contact`, there is no mailto fallback — and the timeout is not cleared on unmount. `aria-label` flips to `"Copied"` and the visible text sits in an `aria-live="polite"` span (`:29`, `:37`).

### `src/components/icons.tsx`
- **Role:** Inline brand SVGs.
- **Exports:** `Github`, `Linkedin`, `Npm`, `Pypi`, `Devto`, `Substack` (`:7`, `:22`, `:38`, `:54`, `:70`, `:86`) — all take `{ size?: number; className?: string }`, default `size = 18`.
- **Consumed by:** `site-nav.tsx`, `site-footer.tsx`, `mobile-nav.tsx`, `command-palette-content.tsx`, `project-card.tsx`, `home/hero.tsx`, `home/contact.tsx`, `chat/chat-card.tsx`, `game/developer-rail.tsx`, `game/dossier-card.tsx`, `src/app/projects/[slug]/page.tsx`. (`site-nav` and `mobile-nav` use only Github + Linkedin; the other four appear in footer, hero, contact, palette.)
- **Behaviour notes:** `fill="currentColor"`, `aria-hidden="true"` hardcoded — callers must supply their own `aria-label` on the wrapping link (they all do). Exists because "lucide-react 1.x removed brand glyphs".

### `src/components/home/hero.tsx`
- **Role:** Above-the-fold hero (server component).
- **Exports:** `Hero` (no props).
- **Reads / depends on:** `@/lib/profile` (`profile`, `impactMetrics`; the third metric, open-source repos, is `publicProjects.length`, i.e. 16 of the 18 projects), `@/components/hero-graph` `HeroGraph`, `@/components/hero-avatar` `HeroAvatar`, `@/components/home/hero-mascot` `HeroMascot` + `HeroMascotBackdrop` (`:14`, v3.15.0), `GithubStatsStrip`, `GITHUB_STATS_ENABLED`, env `NEXT_PUBLIC_HERO_MODE`.
- **Consumed by:** `src/app/page.tsx:27`.
- **Behaviour notes:** the visual slot is a three-way branch on `heroMode` (`:33-39`): `"avatar"` → `<HeroAvatar />`, `"mascot"` (v3.15.0, opt-in) → `<HeroMascotBackdrop />` (the two glow blurs only) with `<HeroMascot />` mounted in flow above the name eyebrow at `:41` (9rem below `lg`, absolute in the right gutter at 13rem / 15rem from `lg` / `xl` through `--mascot-size`, `hero-mascot.tsx:32`), anything else → `<HeroGraph />` (default); `home/hero.dom.test.tsx` pins all three. Entrance is pure CSS `.hero-rise` with staggered inline `animationDelay` of `0.05s / 0.1s / 0.15s / 0.2s / 0.25s` (`:49`, `:59`, `:66`, `:149`, `:170`) — no JS/hydration gate, so the hero never flashes invisible and does not delay LCP (`:18-23`). `.hero-rise` is defined at `src/app/globals.css:116-125` and is neutralised (`opacity: 1; animation: none`) under reduced motion (`globals.css:125`). The headline copy is hardcoded JSX, not from `profile` (`:51-54`). The social row is six icons: GitHub, LinkedIn, npm, PyPI, Dev.to, Substack (`:84-139`).
- **Gotchas / invariants:** `NEXT_PUBLIC_HERO_MODE` is read inside the function body, not module scope, "required for `vi.stubEnv` in tests" (`:25-26`). The impact `<dl>` is `sm:grid-cols-3` to match exactly 3 `impactMetrics`; a 4th metric or a change to `impactMetrics.length` leaves a blank trailing cell — the comment records that this was previously `sm:grid-cols-4` and broke (`:142-148`).

### `src/components/home/resume-view.tsx`
- **Role:** The `?view=resume` recruiter surface and the `/resume` page body.
- **Exports:** `ResumeView` (wraps in `<main className={cn("min-h-screen bg-bg-base", WRAPPER_CLASS)}>`, `:321-327`), `ResumeViewInline` (wraps in `<div className={WRAPPER_CLASS}>`, without the opaque background so `/resume`'s decorative grid shows through, `:339-345`). `ResumeContent` is module-private.
- **Reads / depends on:** `@/lib/content` (`allWork`, `allProjects`), `@/lib/profile` (`profile`, `skills`, `achievements`, `resumeVariants`, `impactMetrics`), `@/lib/utils` `cn`, env `NEXT_PUBLIC_RESUME_VARIANTS`.
- **Consumed by:** `src/components/view-router.tsx:44-50` (dynamic, `ssr: false`) and `src/app/resume/page.tsx:225` (`ResumeViewInline`).
- **Behaviour notes:** Shared `WRAPPER_CLASS` includes `print:bg-white print:text-black` (`:41-42`); every text node carries a `print:` colour override so Cmd-P yields black-on-white with no extra tooling. Sections in order: Identity header, Production Work (`:143`), Open-Source Projects (`:180`), Skills (`:207`), Recognition (`:224`), PDF Downloads (`print:hidden`, `:241`), Contact CTA footer. No Three.js, no Motion, no animation by design.
- **Gotchas / invariants:** Two exports exist purely so `/resume` does not nest two `<main>` landmarks. `NEXT_PUBLIC_RESUME_VARIANTS` is read inside `ResumeContent`, not module scope, so `vi.stubEnv` works (`:45-47`); unset → master pill only. The docblock at `:14-16` claims `ViewEscapeHatch` is "auto-rendered by view-router for non-classic views" — **it is not**; `view-router.tsx` renders no escape hatch, and `ResumeView` does not render one either, so the resume view has no in-page "back to Classic" control.

### `src/components/home/featured-work.tsx` · `featured-projects.tsx` · `stack.tsx` · `achievements.tsx` · `writing-preview.tsx` · `testimonials.tsx` · `contact.tsx`
- **Role:** The seven homepage sections between `Hero` and the footer, rendered in `page.tsx` order — `FeaturedWork`, `FeaturedProjects`, `Stack`, `Achievements`, `WritingPreview`, `Testimonials`, `Contact` — from `src/app/page.tsx:27-34` inside a shared `<main className="flex-1">`. `Stack` (v3.14.0) is a server component: `Section id="stack"`, a `Reveal`-wrapped `<ul aria-label="Tools and technologies">` of 22 tiles from `stackItems` (40 px `StackIcon` brand mark or `StackGlyph`), each `<a target="_blank" rel="noopener noreferrer">` inside a `Tooltip` (name + skill group) with `aria-label` as the single accessible-name source and an `aria-hidden` mono caption shown only on coarse-pointer devices, then a closing `Link` to `/about#skills`; guarded by `home/stack.dom.test.tsx`.
- **Exports:** `FeaturedWork`, `FeaturedProjects`, `Stack`, `Achievements`, `WritingPreview`, `Testimonials`, `Contact` — all no-prop.
- **Behaviour notes:**
  - `FeaturedWork` iterates **all** `allWork` (not a slice), surfacing `w.register` in the `mono-label` eyebrow and `w.metrics` in a `<dl>` (`featured-work.tsx:12-33`). Reveal delay is `i * 0.08`.
  - `FeaturedProjects` iterates `featuredProjects` from `@/lib/content` and its CTA counts the whole collection, `View all {allProjects.length} projects` (`featured-projects.tsx:24`); it used to be a hardcoded `"View all 8 projects"` that had drifted from the collection (20 projects at v3.16.0 against a featured strip of eight: kelvran, toolwarrant, cost-guard-mcp, prompt-lift, ratecap, trelix, tombstone, mindforge), and `featured-projects.dom.test.tsx` pins both the count in the link and the featured order. The hero's `impactMetrics` repo count reads `publicProjects.length` instead (private repositories are listed but not counted).
  - `Achievements` staggers with `delay={(i % 3) * 0.06}` to match its 3-column grid (`achievements.tsx:11`).
  - `WritingPreview` returns `null` when `!ARTICLES_ENABLED || allArticles.length === 0` (`writing-preview.tsx:11`), then calls `groupArticles(allArticles)` and slices to 2 — deduping **before** slicing so you get 2 unique articles, not 2 platform variants of one (`:13-15`).
  - `Testimonials` returns `null` when `!TESTIMONIALS_ENABLED` (default off) (`testimonials.tsx:13`); when enabled with an empty `testimonials` array it renders a "coming soon" card linking to a hardcoded `https://linkedin.com/in/sairam0424` (`:15-38`); populated it renders `<figure>`/`<blockquote>`/`<figcaption>` with a "verify on LinkedIn" link per entry (`:46-67`).
  - `Contact` (`"use client"`) copies `profile.email` with a 2000 ms confirmation and falls back to `window.location.href = mailto:` on clipboard failure (`contact.tsx:20-29`); the section id is `contact` (`:33`), which is the `/#contact` anchor target used by the nav and palette. It links Calendly plus LinkedIn, GitHub, npm, PyPI, Dev.to and Substack.
- **Gotchas / invariants:** Only `contact.tsx` is a client component; the other six are RSC (`stack.tsx` deliberately so — its inline SVG path data ships as HTML + RSC payload, not client JS). All seven wrap their content in `<Section>` + `<Reveal>`, so both must stay SSR-safe or the homepage regresses to invisible content.

### `src/components/ui/section.tsx`
- **Role:** Standard page section wrapper.
- **Exports:** `Section` — props `{ id?, label?, title?, titleAs?: "h1" | "h2" (default "h2"), children, className? }`.
- **Consumed by:** 13 route files (`about`, `articles`, `contact`, `decisions`, `developers`, `mcp`, `notes`, `privacy`, `projects`, `resume`, `search`, `stats`, `work` — each `page.tsx`; the newest three are `contact`, `developers` and `privacy`) and all 7 home sections (`Stack` passes `id="stack"`).
- **Behaviour notes:** Base classes `mx-auto w-full max-w-5xl px-6 py-20 sm:py-24 scroll-reveal` (`:28`) — the `scroll-reveal` class is a CSS-only scroll-timeline reveal defined at `src/app/globals.css:463-467`, disabled under reduced motion (`globals.css:478-479`). The header block renders only when `label || title` (`:29`).
- **Gotchas / invariants:** Each standalone page must pass `titleAs="h1"` to its **first** section or the page's highest heading is an `h2`, leaving a screen-reader heading list with no top anchor (WCAG 1.3.1 / 2.4.6) (`:4-11`).

### `src/components/ui/prose.tsx`
- **Role:** typography for the plain text pages (`/contact`, `/privacy`, `/developers`), so they read like the case studies without a new visual language: the classes are the ones the MDX components map already uses for long-form text, on the existing colour tokens (dark and light).
- **Exports:** `ProseH2({ id?, children })` (`:10-16`, `mt-10 mb-3 scroll-mt-24 text-xl font-semibold tracking-tight text-fg`; `scroll-mt-24` is what lets an anchor such as `#errors` clear the sticky header), `ProseP({ children, className? })` (`:18-20`, merges `className` through `cn`), `ProseList({ items })` (`:22-33`, a `<ul>` whose items carry a decorative accent dot), `InlineCode({ children })` (`:35-37`) and `CodeBlock({ children: string })` (`:39-45`, a horizontally scrolling `<pre>`).
- **Reads / depends on:** `cn` from `@/lib/utils`. Server-safe: no hooks and no `"use client"`.
- **Consumed by:** `src/app/developers/page.tsx`, `src/app/contact/page.tsx` and `src/app/privacy/page.tsx` (section 01).
- **Gotchas / invariants:** `ProseList` keys its items by index, which is safe only for static lists like these. `CodeBlock` takes a string rather than nodes, which is what lets `/developers` hand the same string to `CopyButton`.

### `src/components/ui/reveal.tsx`
- **Role:** Scroll-into-view fade/rise wrapper.
- **Exports:** `Reveal` — props `{ children, delay?: number = 0, className? }`.
- **Reads / depends on:** `motion/react` `motion`, `@/lib/use-reduced-motion` `useReducedMotion`, `@/lib/use-mounted` `useMounted`.
- **Consumed by:** 11 route files (`about`, `articles`, `articles/[slug]`, `decisions`, `notes`, `notes/[slug]`, `projects`, `projects/[slug]`, `stats`, `work`, `work/[slug]`) + `github-stats-strip.tsx` + all 7 home sections.
- **Behaviour notes:** When `reduced || !mounted` it returns a plain `<div>` (`:28`) — so crawlers, JS-disabled visitors, pre-hydration paint, and a hydration failure all see fully visible content rather than `opacity: 0` (`:8-15`). Animated path: `initial={{ opacity: 0, y: 16 }}`, `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true, margin: "-80px" }}`, `0.5s cubic-bezier(0.21, 0.47, 0.32, 0.98)` (`:31-36`). `useReducedMotion` here is the native `matchMedia` hook (seeded from `matchMedia` in its `useState` initialiser), not Motion's.
- **Gotchas / invariants:** The `!mounted` branch is the no-JS safety net — removing it makes every below-fold section permanently invisible whenever hydration fails.

### `src/components/ui/tooltip.tsx`
- **Role:** Thin Radix tooltip primitive shared by icon buttons.
- **Exports:** `TooltipProvider` (`delayDuration={300}`, `:6-12`), `Tooltip({ content, children, side = "bottom" })` (`:14-40`). The trigger is `asChild`, so the child must accept a ref and props.
- **Consumed by:** `Providers` (provider), `view-switcher.tsx`, `site-nav.tsx`, `mobile-nav.tsx`, `theme-toggle.tsx`, `copy-button.tsx`, `command-palette.tsx`, `home/stack.tsx` (one per tile, v3.14.0), plus chat/game controls (`mic-button`, `read-aloud-button`, `voice-picker`, `voice-settings-dialog`, `developer-rail`, `terminal-overlay`).
- **Gotchas / invariants:** Any `Tooltip` rendered outside `Providers`' `TooltipProvider` throws in Radix; the provider sits inside `ViewProvider` and wraps only `children` (`providers.tsx:54-56`), not the sibling ink canvas or badge.

### `src/components/ui/skeleton.tsx`
- **Role:** Loading-state primitives.
- **Exports:** `Skeleton({ className? })`, `SkeletonStatCard()`, `SkeletonCard()`, `SkeletonIframe()`, `SkeletonMarkdownLine()`, `SkeletonViewTransition({ label? })`.
- **Reads / depends on:** `@/lib/use-reduced-motion`, `@/lib/utils` `cn`, `lucide-react` `FileText`.
- **Consumed by:** `src/app/resume/page.tsx`, `ask-portfolio.tsx`, `github-stats-strip.tsx`, `view-router.tsx`, `chat/chat-messages.tsx`, `chat/anvil-core-surface.tsx`.
- **Behaviour notes:** `Skeleton` applies `skeleton-shimmer rounded-md` and is `aria-hidden="true"` — decorative, so only the enclosing `role="status"` container is announced (`:9-11`); `.skeleton-shimmer` is defined at `src/app/globals.css:497-509` (static fallback under reduced motion, `:483-488`). `SkeletonStatCard` (`:28`) mirrors `GithubStatsStrip`'s `StatCard`; `SkeletonCard` (`:44`) mirrors the `card-surface` article/note/project shape; `SkeletonIframe` (`:76`) is absolutely positioned for the résumé PDF `h-[80vh]` frame; `SkeletonMarkdownLine` (`:88`) is 3 lines for streamed markdown. `SkeletonViewTransition` (`:102`) is `h-[calc(100dvh-3.5rem)]` (nav height subtracted, `:106`), `role="status"`, with a pulsing orb ring that drops `animate-pulse` under reduced motion (`:114`).
- **Gotchas / invariants:** `SkeletonViewTransition`'s `3.5rem` must track the `h-14` header in `site-nav.tsx:67`.

### `src/components/ui/ink-transition.tsx`
- **Role:** Opt-in WebGL2 ink-burn overlay for view switches.
- **Exports:** `InkTransitionHandle` (type: `{ transitionIn(onMidpoint: () => void): void }`), `inkTransitionRef` (module-level mutable `let`, initially `null`, `:116`), `InkTransition` (a `forwardRef` component taking no props).
- **Consumed by:** `providers.tsx:13-16` (dynamic, `ssr: false`, always mounted) and `view-context.tsx:127-137` (dynamic import inside `commitViewChange`).
- **Behaviour notes:** `DURATION_MS = 800` (`:33`), midpoint at 50% (`:184-187`) — the view store emits at midpoint so the burn consumes the old view and reveals the new one. Vertex/fragment GLSL ES 3.00 sources are inline string constants (`:39-91`); the fragment shader is 4-octave fBm noise (`:74-87`) that `discard`s where `n < uProgress * 1.3 - 0.15` and paints opaque black otherwise (`:89-90`). Geometry is a single fullscreen NDC triangle `[-1,-1, 3,-1, -1,3]` (`:139`), avoiding camera projection entirely so the burn composites over the R3F scene without projection fighting. Canvas is `position: fixed; inset: 0; display: none; pointer-events: none; z-index: 50; mix-blend-mode: multiply` (`:220-231`) — zero GPU cost while inactive. `transitionIn` resizes to `window.innerWidth/Height * devicePixelRatio` per fire (`:175-178`), and fires `onMidpoint()` immediately when WebGL is unavailable (`:165-166`) plus a safety fire at completion if 50% was skipped (`:199`). A failed shader compile is caught and swallowed so the rest of the app is unaffected (`:151-153`).
- **Gotchas / invariants:**
  - `inkTransitionRef` is a **module-level mutable export** set in an effect with **no dependency array** (`:213-216`), so it re-assigns on every render. `view-context.tsx` reads it directly because `commitViewChange` is a module-level function with no access to React context.
  - The ink path only runs when `NEXT_PUBLIC_INK_TRANSITION === "true"` (`view-context.tsx:123-126`); otherwise the component mounts but is never invoked.
  - The docblock lists a `prefers-reduced-motion: no-preference` gate (`:22`) but that check lives in `view-context.tsx:106-117`, not in this file.

### `src/components/scroll/jump-to-latest.tsx`
- **Role:** Presentational "Jump to latest" pill — the visible resume control for the autoscroll state machine (WCAG 2.2.2).
- **Exports:** `JumpToLatest({ show, onClick, label = "Jump to latest" })`.
- **Consumed by:** `ask-portfolio.tsx:227`, `chat/chat-messages.tsx:642`.
- **Behaviour notes:** Returns `null` when `!show` (`:28`). Floats bottom-centre of a `relative` parent (`pointer-events-none absolute inset-x-0 bottom-3`, `:30`); visibility and the snap-to-bottom are owned by the autoscroll hook, the caller supplies `onClick`. Target height `h-9` (36 px) with visible focus ring (`:34`).

## Coverage

- `src/components/article-group-card.tsx`
- `src/components/command-palette-content.tsx`
- `src/components/command-palette.tsx`
- `src/components/copy-button.tsx`
- `src/components/github-feed.tsx`
- `src/components/github-stats-strip.tsx`
- `src/components/icons.tsx`
- `src/components/json-ld.tsx`
- `src/components/mdx-content.tsx`
- `src/components/mobile-nav.tsx`
- `src/components/note-card.tsx`
- `src/components/open-to-work-banner.tsx`
- `src/components/platform-badge.tsx`
- `src/components/project-card.tsx`
- `src/components/providers.tsx`
- `src/components/reading-progress.tsx`
- `src/components/related-writing.tsx`
- `src/components/site-footer.tsx`
- `src/components/site-nav.tsx`
- `src/components/theme-toggle.tsx`
- `src/components/view-context.tsx`
- `src/components/view-escape-hatch.tsx`
- `src/components/view-hint.tsx`
- `src/components/view-router.tsx`
- `src/components/view-switcher.tsx`
- `src/components/home/achievements.tsx`
- `src/components/home/contact.tsx`
- `src/components/home/featured-projects.tsx`
- `src/components/home/featured-work.tsx`
- `src/components/home/hero.tsx`
- `src/components/home/resume-view.tsx`
- `src/components/home/testimonials.tsx`
- `src/components/home/writing-preview.tsx`
- `src/components/ui/ink-transition.tsx`
- `src/components/ui/prose.tsx`
- `src/components/ui/reveal.tsx`
- `src/components/ui/section.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/scroll/jump-to-latest.tsx`
- `src/components/home/stack.tsx`
- `src/components/skill-chip.tsx`
- `src/components/stack-icons.tsx`
- `src/components/mascot/mascot.tsx`
- `src/components/mascot/site-mascot.tsx`
- `src/components/mascot/not-found-mascot.tsx`
- `src/components/home/hero-mascot.tsx`
- `src/assets/mascots/gearbot-directions.webp`
- `src/assets/mascots/gearbot-reactions.webp`
- `src/assets/mascots/crt-directions.webp`
- `src/assets/mascots/crt-reactions.webp`
- `src/assets/mascots/tv-directions.webp`
- `src/assets/mascots/tv-reactions.webp`
- `src/assets/mascots/radio-directions.webp`
- `src/assets/mascots/radio-reactions.webp`
- `src/assets/mascots/toaster-directions.webp`
- `src/assets/mascots/toaster-reactions.webp`
- `src/assets/mascots/clockwork-directions.webp`
- `src/assets/mascots/clockwork-reactions.webp`
- `src/assets/mascots/cube-directions.webp`
- `src/assets/mascots/cube-reactions.webp`
- `src/assets/mascots/drone-directions.webp`
- `src/assets/mascots/drone-reactions.webp`
- `src/assets/mascots/knight-directions.webp`
- `src/assets/mascots/knight-reactions.webp`
- `src/assets/mascots/lantern-directions.webp`
- `src/assets/mascots/lantern-reactions.webp`
- `src/assets/mascots/postbot-directions.webp`
- `src/assets/mascots/postbot-reactions.webp`
- `src/assets/mascots/rocket-directions.webp`
- `src/assets/mascots/rocket-reactions.webp`
- `src/assets/mascots/scout-directions.webp`
- `src/assets/mascots/scout-reactions.webp`
- `src/assets/mascots/penguin-directions.webp`
- `src/assets/mascots/penguin-reactions.webp`
- `src/types/next-image-assets.d.ts`

**Excluded from this section (owned elsewhere):** `src/components/ask-portfolio.tsx`, `src/components/chat/**`, `src/components/game/**`, `src/components/hero-avatar/**`, `src/components/hero-graph/**`. Tests colocated with this section's files, not indexed individually: `view-context.test.ts`, `view-context.dom.test.tsx`, `view-hint.dom.test.tsx`, `site-footer.dom.test.tsx`, `github-stats-strip.dom.test.tsx`, `command-palette-content.dom.test.tsx`, `home/stack.dom.test.tsx`, `skill-chip.dom.test.tsx`, `home/hero.dom.test.tsx`, `mascot/mascot.dom.test.tsx`, `mascot/site-mascot.dom.test.tsx`, `mascot/not-found-mascot.dom.test.tsx` (and `ask-portfolio.dom.test.tsx`, owned elsewhere).

## UNVERIFIED

- Whether the stale comments noted above (`open-to-work-banner.tsx:6-8` "hidden via CSS (h-0)"; `home/resume-view.tsx:14-16` "ViewEscapeHatch auto-rendered by view-router"; `next.config.ts:19-20` "shipped as Report-Only first") reflect removed behaviour or were never accurate. The current code does none of these.
