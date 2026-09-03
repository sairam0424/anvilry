---
kind: doc
title: Components — Site Shell, Home Sections, View System & UI Kit
domain: [content]
status: current
version: v3.6.0
---

# Components — Site Shell, Home Sections, View System & UI Kit

> Part of the Anvilry v3.6.0 codebase index. Master entry point: [docs/index/README.md](./README.md)

**Scope:** `src/components/*.tsx` (root level, excluding `ask-portfolio.tsx` and all `*.test.*` / `*.dom.test.*`), `src/components/home/**`, `src/components/ui/**`, `src/components/scroll/**`. Explicitly excludes `src/components/chat/`, `src/components/game/`, `src/components/hero-avatar/`, `src/components/hero-graph/`.
**Files indexed:** 38

## At a glance

| File | Role | Key exports |
|---|---|---|
| `src/components/view-context.tsx` | Module-level external store for the active view + View Transitions commit + `?view=` deep-link sync | `View` (type), `ViewProvider`, `useView`, `VIEWS`, `DEFAULT_VIEW`, `isView`, `getServerSnapshot` |
| `src/components/view-router.tsx` | Swaps the top-level experience; Classic hidden-not-unmounted, others lazily imported + unmounted | `ViewRouter` |
| `src/components/view-switcher.tsx` | Segmented control (Classic/Play/Chat/Dev + post-mount Voice) with a Motion sliding pill | `ViewSwitcher` |
| `src/components/view-hint.tsx` | One-time dismissible "try another view" nudge, localStorage-flagged, classic-only | `ViewHint` |
| `src/components/view-escape-hatch.tsx` | First-focusable "Back to Classic" + "Résumé" pair rendered by every non-classic view | `ViewEscapeHatch` |
| `src/components/providers.tsx` | App-wide client providers: `MotionConfig` → `ViewProvider` → `ScrollFlagsSync`, plus lazy InkTransition + DiscoveryBadge | `Providers` |
| `src/components/site-nav.tsx` | Sticky header: logo, flag-filtered nav links, both ViewSwitcher instances, header orb, socials, MobileNav | `SiteNav` |
| `src/components/site-footer.tsx` | Footer + machine-readable link row + optional visitor counter; hides itself on full-height views | `SiteFooter` |
| `src/components/mobile-nav.tsx` | `< sm` drawer with focus trap, Escape close, focus restore | `MobileNav` |
| `src/components/command-palette.tsx` | ⌘K/Ctrl-K cmdk palette: views, nav, actions, voice settings, work/project items, MRU recents | `CommandPalette` |
| `src/components/mdx-content.tsx` | Compiles the Velite `code` string into a React component via `new Function` (the CSP `unsafe-eval` driver) | `MDXContent` |
| `src/components/json-ld.tsx` | Eight schema.org JSON-LD blocks with `</`-escaping serialiser | `PersonJsonLd`, `BreadcrumbJsonLd`, `SoftwareSourceCodeJsonLd`, `WebSiteJsonLd`, `CreativeWorkJsonLd`, `FaqJsonLd`, `ArticleJsonLd`, `ProfilePageJsonLd` |
| `src/components/article-card.tsx` | Single-article card with `linkedNote` → external → internal href resolution. **No importers found.** | `ArticleCard` |
| `src/components/article-group-card.tsx` | Deduped multi-platform article card ("also on" badge buttons) | `ArticleGroupCard` |
| `src/components/note-card.tsx` | Note card with inkforge provenance badge | `NoteCard` |
| `src/components/project-card.tsx` | OSS project card (RSC) with commit count / group fallback | `ProjectCard` |
| `src/components/platform-badge.tsx` | Tinted per-platform pill; 6 hardcoded brand colours | `ArticleSource` (type), `PlatformBadge` |
| `src/components/github-feed.tsx` | Server-rendered repo grid with `Intl.RelativeTimeFormat` "updated N ago" | `GithubFeed` |
| `src/components/github-stats-strip.tsx` | Client fetch of `/api/github/stats` with skeleton → content crossfade; hides on zeros | `GithubStatsStrip` |
| `src/components/open-to-work-banner.tsx` | Hiring-signal strip under the nav (RSC; gated by caller) | `OpenToWorkBanner` |
| `src/components/reading-progress.tsx` | 2px compositor-driven scroll progress bar; null under reduced motion | `ReadingProgress` |
| `src/components/copy-button.tsx` | Copy-to-clipboard button with announced "Copied" state (used on `/mcp`) | `CopyButton` |
| `src/components/icons.tsx` | Inline GitHub + LinkedIn SVGs (lucide-react 1.x dropped brand glyphs) | `Github`, `Linkedin` |
| `src/components/home/hero.tsx` | Above-the-fold hero; CSS `.hero-rise` entrance, WebGL slot switched by `NEXT_PUBLIC_HERO_MODE` | `Hero` |
| `src/components/home/featured-work.tsx` | All work case studies with `register` eyebrow + metrics `<dl>` | `FeaturedWork` |
| `src/components/home/featured-projects.tsx` | Featured OSS repos + "View all 8 projects" link (hardcoded 8) | `FeaturedProjects` |
| `src/components/home/achievements.tsx` | Recognition grid from `profile.achievements` | `Achievements` |
| `src/components/home/writing-preview.tsx` | Two deduped article groups; returns null when articles disabled/empty | `WritingPreview` |
| `src/components/home/testimonials.tsx` | Flag-gated recommendations; empty-list placeholder branch | `Testimonials` |
| `src/components/home/contact.tsx` | Contact CTA card with copy-email → mailto fallback | `Contact` |
| `src/components/home/resume-view.tsx` | Print-optimised recruiter résumé; `<main>` and `<div>` variants | `ResumeView`, `ResumeViewInline` |
| `src/components/ui/section.tsx` | Page section with mono eyebrow label; `titleAs` h1/h2 escape for standalone pages | `Section` |
| `src/components/ui/reveal.tsx` | Scroll-into-view reveal with mount + reduced-motion static fallback | `Reveal` |
| `src/components/ui/skeleton.tsx` | Base skeleton + 4 composite shapes + full-viewport view-transition fallback | `Skeleton`, `SkeletonStatCard`, `SkeletonCard`, `SkeletonIframe`, `SkeletonMarkdownLine`, `SkeletonViewTransition` |
| `src/components/ui/ink-transition.tsx` | Raw WebGL2 fBm ink-burn overlay + module-level `inkTransitionRef` handle | `InkTransitionHandle` (type), `inkTransitionRef` (mutable let), `InkTransition` |
| `src/components/ui/button.tsx` | 3-variant × 3-size button primitive. **No importers found.** | `Button` |
| `src/components/ui/empty-state.tsx` | Centered empty-state card. **No importers found.** | `EmptyState` |
| `src/components/scroll/jump-to-latest.tsx` | Presentational "Jump to latest" pill (WCAG 2.2.2 resume control for autoscroll) | `JumpToLatest` |

---

## Four-view state machine

### The module-level store (`src/components/view-context.tsx`)

`View` is a 6-member union — not 4: `"classic" | "gamified" | "chat" | "developer" | "voice" | "resume"` (`view-context.tsx:24`), mirrored by the `VIEWS` array (`:26`) and a `VIEW_ORDER` rank map used only to compute slide direction (`:30-37`).

State lives in three module-level bindings **outside React** (`:49-59`):

```ts
let current: View = DEFAULT_VIEW;          // :49
const listeners = new Set<() => void>();   // :50
const emit = () => { for (const l of listeners) l(); };  // :52
```

`subscribe` adds/removes from `listeners` (`:56-59`). `ViewProvider` reads via `useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)` (`:176`), then publishes `{ view, setView }` through a React context (`:152-153`, `:180`). `useView()` throws `"useView must be used within <ViewProvider>"` when the context is null (`:190-194`).

**Why server + first client snapshot always return classic.** `getClientSnapshot` returns the live `current` (`:64`); `getServerSnapshot` returns the literal `DEFAULT_VIEW` (`:65`). Because `current` is initialised to `DEFAULT_VIEW` at module load (`:49`) and nothing mutates it before hydration, the server HTML and the first client render agree — no hydration mismatch, and crawlers/no-JS visitors always get Classic. The comment at `:61-63` states this contract explicitly. `src/components/view-context.test.ts:30-34` is the regression guard (asserts `DEFAULT_VIEW === "classic"` and `getServerSnapshot() === "classic"` no matter what `VIEWS` holds) — which is why `getServerSnapshot` and `isView` are re-exported at `:198`.

**How the deep link applies post-hydration.** `ViewQuerySync` (`:162-173`) is a render-nothing leaf that calls `useSearchParams()` and, in a `useEffect`, applies any valid `?view=` value with `setViewInternal(fromUrl, { updateUrl: false, transition: false })` (`:169`). Two deliberate flags: `updateUrl:false` avoids rewriting the URL it just read, `transition:false` makes the deep-linked view appear instantly rather than cross-fading on first paint. It is isolated behind its own `<Suspense fallback={null}>` inside `ViewProvider` (`:181-183`) because `useSearchParams` forces client rendering up to the nearest Suspense boundary — keeping it in this leaf lets the whole provider tree above still prerender (`:155-160`).

**No persistence by design.** `setViewInternal` writes only to the URL via `window.history.replaceState` (`:140-145`), deleting the `view` param when the target is `DEFAULT_VIEW` (`:142`). There is no cookie and no localStorage: a bare `/` is always Classic (`:118-125`).

### The native `document.startViewTransition` path

`commitViewChange()` (`:79-116`) is the transition commit. Three branches:

1. **Snap (plain `emit()`)** when `prefers-reduced-motion: reduce` matches OR `document.startViewTransition` is not a function (`:80-92`).
2. **Ink-bleed** when `process.env.NEXT_PUBLIC_INK_TRANSITION === "true"` (`:97-100`): dynamically imports `@/components/ui/ink-transition` and calls `inkTransitionRef.transitionIn(() => flushSync(emit))`; falls back to `doc!.startViewTransition(() => flushSync(emit))` if the ref is null or the import rejects (`:101-112`).
3. **Default**: `doc.startViewTransition(() => flushSync(emit))` (`:115`).

The `flushSync` is load-bearing: `useSyncExternalStore` emits are batched/async, and `startViewTransition` snapshots the DOM before and after its callback — without `flushSync` the "after" snapshot is still the old view and nothing animates (`:70-77`).

Direction is stamped on `<html>` **before** the snapshot: `document.documentElement.dataset.viewDir = VIEW_ORDER[view] > VIEW_ORDER[current] ? "forward" : "backward"` (`:133-136`), and only when `transition` is true.

### The `::view-transition-*` CSS hooks

Two named transition groups exist in the tree:

- `view-router.tsx:56` — the wrapper `<div style={{ viewTransitionName: "view-body" }}>`
- `site-nav.tsx:40` — the sticky `<header style={{ viewTransitionName: "site-header" }}>`

`src/app/globals.css:257-299` drives them:

- Four slide keyframes `vt-slide-in-from-right` / `-from-left` / `vt-slide-out-to-left` / `-to-right` (`globals.css:264-267`).
- Forward: `[data-view-dir="forward"]::view-transition-new(view-body)` slides in from right, `::view-transition-old(view-body)` slides out left — `0.28s cubic-bezier(0.21, 0.47, 0.32, 0.98) both` (`globals.css:270-275`).
- Backward: mirrored (`globals.css:278-283`).
- `::view-transition-old(site-header), ::view-transition-new(site-header) { animation: none; mix-blend-mode: normal; }` pins the sticky nav so it does not fade with the body (`globals.css:284-289`).
- A belt-and-suspenders reduced-motion kill switch sets `animation: none !important` on `::view-transition-group(*)`, `-old(*)`, `-new(*)` (`globals.css:293-299`) — redundant with the JS gate at `view-context.tsx:89`, intentionally so.

### Surrounding machinery

**`view-router.tsx`** — Classic arrives as `children` (the server-rendered `page.tsx` tree, wired at `src/app/page.tsx:26`) and is **always mounted**, toggled with `hidden={view !== "classic"}` + matching `aria-hidden` (`:58`) so scroll position survives a round trip. Chat / Play / Developer / Voice / Resume are `next/dynamic` with `ssr: false` and a `SkeletonViewTransition` loading fallback each (`:25-50`), and are **unmounted** when inactive — the comment at `:9-24` records that unmounting (not hiding) the gamified view is what lets R3F dispose the WebGL context, since a hidden-but-live context leaks GPU memory on low-end mobile. Every optional view is additionally gated by `isViewEnabled(...)` (`:64-69`), so `?view=chat` on a build with chat disabled silently stays on Classic. Voice receives `onClose={() => setView("classic")}` (`:67`).

**`view-switcher.tsx`** — `OPTIONS` holds only 4 entries: classic/gamified(label "Play")/chat/developer (`:16-21`). `VOICE_OPTION` (`:28`) is appended **only** when `mounted && !compact && isViewEnabled("voice")` (`:38`). The `useMounted()` gate (`src/lib/use-mounted.ts`, server snapshot `false` / client `true`) is described in-file as "the hydration contract; it is NOT a feature flag" (`:22-28`) — the switcher must render 4-way on the server to match the always-classic SSR snapshot, then upgrade to 5-way. `resume` is **never** in the switcher; it is reachable only via ⌘K "Recruiter view" or `?view=resume`. `layoutId` is scoped per instance — `` `view-switcher-active-${compact ? "compact" : "full"}` `` (`:42`) — because both the desktop and compact instances are in the DOM simultaneously (`site-nav.tsx:66-71`) and a shared `layoutId` would make Motion animate one pill between them (`:39-41`). The pill content sits in a `relative z-10` wrapper, never a negative z-index (`:77-80`).

**`view-hint.tsx`** — its own tiny `useSyncExternalStore` over `localStorage["anvilry-hint-seen"]` (`:7`, `:21-36`). Server snapshot is `() => true` i.e. "dismissed", so SSR/no-JS never flashes the hint (`:34`); a `localStorage` throw also returns `true` ("can't persist → don't nag", `:33`). Renders `null` unless `view === "classic"` (`:48`).

**`view-escape-hatch.tsx`** — "Back to Classic" is a `<button>` calling `setView("classic")`; "Résumé" is a real `<a href="/resume">` so it survives a failed view bundle (`:9-11`). Documented contract: it is rendered as the FIRST focusable element of each non-classic view so neither the gamified nor chat experience becomes a keyboard trap (`:6-12`). Real importers: `chat/anvil-view.tsx`, `chat/chat-view.tsx`, `game/game-view.tsx`, `game/developer-view.tsx` — note that despite `home/resume-view.tsx:11-14`'s comment claiming view-router auto-renders it, `view-router.tsx` does not; each view imports it itself.

**Discovery side effect:** any deliberate view switch calls `unlock("view-switch")` from `@/lib/discovery-store` (`view-context.tsx:139`), the first of 5 exploration badges.

---

## Detail

### `src/components/mdx-content.tsx`
- **Role:** Turns the Velite-compiled MDX function-body string into a React component, with a Tailwind-styled element map.
- **Exports:** `MDXContent` (component) — props `{ code: string }`.
- **Reads / depends on:** `react/jsx-runtime` (spread into the compiled factory).
- **Consumed by:** `src/app/projects/[slug]/page.tsx`, `src/app/articles/[slug]/page.tsx`, `src/app/notes/[slug]/page.tsx`, `src/app/work/[slug]/page.tsx`.
- **Behaviour notes:** `compileMDX` is literally `const fn = new Function(code); return fn({ ...runtime }).default;` (`:14-17`). `MDXContent` wraps it in `useMemo(..., [code])` (`:53`) and renders `<Component components={components} />` with an `eslint-disable react-hooks/static-components` on the line above (`:54`). The `components` map styles `h2, h3, p, ul, li, a, strong, blockquote, code` (`:20-47`).
- **Gotchas / invariants:**
  - **CSP consequence.** This `new Function` is the sole reason `'unsafe-eval'` is in the enforced CSP. `next.config.ts:43-51` documents it: *"'unsafe-eval' is required in BOTH dev AND production… Velite outputs a serialized `code` string; MDXContent deserialises it via `new Function` client-side on EVERY page with MDX body content (projects, work, notes). Removing 'unsafe-eval' crashes all project/work/note pages with a React render-error boundary."* The directive shipped is `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://va.vercel-scripts.com https://vercel.live` (`next.config.ts:51`), enforced (not Report-Only) via the `Content-Security-Policy` key at `next.config.ts:94`.
  - **Trust boundary** (`:8-13`): `code` must only ever be Velite output from the build-time `content/` directory. Passing any runtime/request-derived string here is arbitrary code execution.

### `src/components/providers.tsx`
- **Role:** The single client provider shell mounted from the root layout.
- **Exports:** `Providers` (component) — props `{ children, discoveryBadgesEnabled: boolean }`.
- **Reads / depends on:** `motion/react` `MotionConfig`, `@/components/view-context` `ViewProvider`, `@/lib/scroll/scroll-flags` `ScrollFlagsSync`; lazily `@/components/ui/ink-transition` and `@/components/game/discovery-badge` (both `ssr: false`).
- **Consumed by:** `src/app/layout.tsx:97`.
- **Behaviour notes:** Nesting order is `MotionConfig reducedMotion="user"` → `ViewProvider` → `ScrollFlagsSync` (`:51-53`) so every view inherits the same motion governance (`:26-30`). `InkTransition` always mounts (hidden canvas); `DiscoveryBadgeComponent` mounts only when `discoveryBadgesEnabled` (`:55-57`).
- **Gotchas / invariants:** `discoveryBadgesEnabled` is resolved **server-side** in `layout.tsx:66` via `getDiscoveryBadgesEnabled()` and threaded in as a prop, because this file is `"use client"` and cannot await server functions (`:40-42`).

### `src/components/site-nav.tsx`
- **Role:** Sticky site header.
- **Exports:** `SiteNav` (component, no props).
- **Reads / depends on:** `usePathname`, `@/lib/profile` `profile`, `@/lib/content` `hasNotes`/`hasArticles`, `@/lib/writing-flags` `ARTICLES_ENABLED`/`NOTES_ENABLED`/`STATS_ENABLED`/`SEARCH_ENABLED`, `ViewSwitcher`, `chat/header-orb-trigger` `HeaderOrbTrigger`, `MobileNav`, `icons`.
- **Consumed by:** `src/app/layout.tsx:98`.
- **Behaviour notes:** `navLinks` is built at module scope; Articles and Notes appear only when **both** the flag and real content exist (`:14-24`). `isActive` treats `/` exactly, `/#…` anchors as homepage-active, and everything else as prefix-match on `${href}/` (`:27-32`); it drives both the accent class and `aria-current="page"` (`:58`). Two `ViewSwitcher` instances render simultaneously — full at `sm:block`, `compact` at `sm:hidden` (`:66-71`).
- **Gotchas / invariants:** `style={{ viewTransitionName: "site-header" }}` (`:40`) is what `globals.css:284-289` pins; removing it would make the sticky nav fade on every view switch. Header row is a fixed `h-14` (`:42`) — the same 3.5rem the `SkeletonViewTransition` and full-height views subtract.

### `src/components/site-footer.tsx`
- **Role:** Global footer, machine-readable link row, optional visitor counter, copyright/RSS strip.
- **Exports:** `SiteFooter` (component, no props). `VisitorBadge` is module-private.
- **Reads / depends on:** `useView`, `@/lib/profile`, env `NEXT_PUBLIC_VISITOR_COUNTER`, env `NEXT_PUBLIC_BUILD_YEAR`, `POST /api/visit`.
- **Consumed by:** `src/app/layout.tsx:103`.
- **Behaviour notes:** Returns `null` when `FULL_HEIGHT_VIEWS = new Set(["chat", "developer"])` contains the active view (`:91`, `:96`) — client-gated so the SSG Classic HTML still ships a footer for crawlers (`:85-92`). `MACHINE_LINKS` are `/mcp`, `/llms.txt`, `/api/resume.json` (`:79-83`). `VisitorBadge` starts at `total = null` (skeleton), seeds from `localStorage["anvilry:visits:total"]` in a mount effect, then POSTs `/api/visit`; only a **positive** total overwrites the cache — a `0` means Redis was down and is ignored (`:41-53`). `total === 0` hides the badge entirely (`:67`).
- **Gotchas / invariants:** The localStorage seed is deliberately in `useEffect`, not the `useState` initialiser — doing it in the initialiser causes a hydration mismatch (`:22-25`), with a targeted `eslint-disable react-hooks/set-state-in-effect` at `:36`. The copyright year is `process.env.NEXT_PUBLIC_BUILD_YEAR ?? "2026"` (`:171`), **not** `new Date()`: under `cacheComponents` an in-render `new Date()` fails the prerender as an unstable value, and this footer is on nearly every route (`:165-169`; the env var is computed in `next.config.ts:107`).

### `src/components/mobile-nav.tsx`
- **Role:** `< sm` navigation drawer.
- **Exports:** `MobileNav` (component) — props `{ links: { href: string; label: string }[] }`.
- **Consumed by:** `src/components/site-nav.tsx:103`.
- **Behaviour notes:** While open, a `keydown` listener handles Escape (close) and Tab/Shift-Tab wrap-around over `'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'` inside `panelRef` (`:24-50`); focus moves into the panel on open (`:48`). A second effect restores focus to `triggerRef` when the drawer closes, tracked by a `wasOpen` ref (`:53-57`). Panel is `role="dialog" aria-modal="true"` with `id="mobile-nav-panel"` wired to `aria-controls` (`:66`, `:82-85`). Backdrop is offset `top-14` to sit below the header (`:76`).
- **Gotchas / invariants:** The focus trap only queries inside `panelRef`; adding focusable chrome outside the panel while open would escape the trap.

### `src/components/command-palette.tsx`
- **Role:** ⌘K command palette — the site's keyboard control surface.
- **Exports:** `CommandPalette` (component) — props `{ discoveryBadgesEnabled: boolean }`. `Group` is module-private (`:535`).
- **Reads / depends on:** `cmdk` `Command`, `@radix-ui/react-dialog` `Title`/`Description`, `@vercel/analytics` `track`, `useRouter`, `@/lib/profile` (`profile`, `resumeVariants`), `@/lib/discovery-store` `unlockAll`, `@/lib/content` (`allProjects`, `allWork`), `useView`, `useVoiceSettings`, `chat/talk-overlay-store` `openTalkMode`, `@/lib/voice-catalog` (`CURATED_VOICES`, `getDefaultVoiceId`, `getVoiceById`), `chat/voice-picker` `VoicePicker`, `chat/voice-settings-dialog` `VoiceSettingsDialog`.
- **Consumed by:** `src/app/layout.tsx:104`.
- **Behaviour notes:** Global hotkey is `e.key === "k" && (e.metaKey || e.ctrlKey)` (`:107`). On open it reloads MRU recents and clears the query (`:118-123`); on close it restores focus to the trigger pill (`:126-129`). Recents live in `localStorage["anvilry:cmd:recent"]`, capped at `RECENT_MAX = 5` (`:67-68`, `:132-142`), and are shown **only** on an empty query so a recent never appears beside its canonical copy (`:440`). Groups rendered in order: Recent, Switch view, Navigate, Actions, Voice, Work, Projects, Links (`:499-507`). `switchTo` closes the palette before calling `setView` (`:153-159`). `copyEmail` shows a 1500 ms "Copied!" and falls back to `mailto:` if the clipboard API throws (`:164-172`); the confirmation is announced via a separate `aria-live="polite"` region because flipping a cmdk item label is not a live region (`:487-492`). The Developer-mode entry fires `track("devmode_palette_open")` (`:177`). Résumé download entries derive from `profile.resumeVariants`, gated to `[resumeVariants[0]]` unless `NEXT_PUBLIC_RESUME_VARIANTS === "true"` (`:219`). Voice entries are feature-detected at render: `ttsSupported` = `"speechSynthesis" in window`, `sttSupported` = `"SpeechRecognition" in window || "webkitSpeechRecognition" in window` (`:234-237`); the talk-mode entry additionally requires `settings.talkSurface === "modal"` (`:293`); enabling the wake word also forces `setView("chat")` (`:407`).
- **Gotchas / invariants:**
  - Actions whose **label mutates** must pin a stable `value` — cmdk re-scores on value change. See the `value:` fields on `copy-email` (`:213-215`), `voice-tts` (`:323-324`), `voice-engine`, `voice-stt-engine`, `voice-surface`, `voice-wake`.
  - `NEXT_PUBLIC_RESUME_VARIANTS` is read **inside the function body**, not module scope, so `vi.stubEnv` works in tests (`:217-219`).
  - `DialogTitle`/`DialogDescription` are imported from `@radix-ui/react-dialog` and only work because cmdk deduplicates to the same Radix instance (`:7-11`, `:465-468`).
  - Recent items get a `valuePrefix="recent"` so their cmdk values do not collide with the canonical copies (`:499`, `:554`).
  - `VoicePicker` and `VoiceSettingsDialog` are siblings of the palette dialog, opened only after it closes, to avoid two stacked Radix focus traps fighting (`:512-515`).

### `src/components/json-ld.tsx`
- **Role:** All schema.org structured-data blocks (RSC — no `"use client"`).
- **Exports:** `PersonJsonLd`, `BreadcrumbJsonLd({ items })`, `SoftwareSourceCodeJsonLd({ name, description, url, codeRepository, tech })`, `WebSiteJsonLd`, `CreativeWorkJsonLd({ name, description, url, keywords })`, `FaqJsonLd`, `ArticleJsonLd({ title, description, url, datePublished, dateModified?, tags? })`, `ProfilePageJsonLd`.
- **Reads / depends on:** `@/lib/profile` (`profile`, `skills`), `@/lib/personal` `now`.
- **Consumed by:** `src/app/layout.tsx` (Person, WebSite, Faq), `src/app/projects/[slug]/page.tsx`, `src/app/articles/[slug]/page.tsx`, `src/app/notes/[slug]/page.tsx`, `src/app/work/[slug]/page.tsx`, `src/app/about/page.tsx`.
- **Behaviour notes:** Every block emits through `safeJsonLd`, which is `JSON.stringify(data).replace(/<\//g, "<\\/")` (`:8-10`) — `JSON.stringify` alone does not escape `</script>`, which would break out of the script tag (`:4-7`). `isOpenToWork` is derived from `now.focus.some((f) => /open to (new )?roles?/i.test(f))` (`:16`) and conditionally adds a `seeks: { @type: "Demand" }` property (`:38`) — removing the "open to new roles" line from `personal.ts` drops the schema signal automatically. `PROGRAMMING_LANGUAGES` is a 19-member allowlist (`:73-76`); a `tech` entry outside it becomes a keyword rather than a `programmingLanguage` (`:93`, `:102-103`). `CreativeWorkJsonLd` deliberately omits `aggregateRating` (Google's self-serving-review policy, `:141-142`).
- **Gotchas / invariants:** The base URL `https://anvilry.vercel.app` is hardcoded in **seven** places here (`:29`, `:101`, `:125`, `:131`, `:160`, `:168` `BASE_URL`, `:214`) — `:214` sits inside FAQ answer prose, so a find-and-replace on the `BASE_URL` constant misses it. `CLAUDE.md:302` lists this file as one of exactly four that must be edited when pointing a custom domain at the deployment; the authoritative repo-wide count lives in [15 § The hardcoded base URL](./15-invariants-and-gotchas.md#the-hardcoded-base-url). The `FaqJsonLd` answers embed real metrics and product names as literal strings (`:176-217`).

### `src/components/article-group-card.tsx`
- **Role:** Card for a deduplicated article group (same essay across platforms).
- **Exports:** `ArticleGroupCard` (component) — props `{ group: ArticleGroup }`.
- **Reads / depends on:** `@/lib/article-grouping` `ArticleGroup` (`{ canonical, platforms, externalPlatforms }`, defined at `src/lib/article-grouping.ts:32-39`), `PlatformBadge`, `NOTES_ENABLED`.
- **Consumed by:** `src/app/articles/page.tsx`, `src/components/home/writing-preview.tsx`.
- **Behaviour notes:** `resolveCanonicalHref` cascade (`:18-30`): `linkedNote` **only if `NOTES_ENABLED`** → `canonical.externalUrl` → first `externalPlatforms[].externalUrl` → `canonical.url`. Only external hrefs get `target="_blank" rel="noopener noreferrer"` (`:46`). Tags are sliced to 3 (`:91`).
- **Gotchas / invariants:** Secondary platform badges are `<button>` elements calling `window.open` with `stopPropagation` + `preventDefault`, **not** `<a>` — nesting an anchor inside the card's outer `<Link>` would be invalid HTML (`:55-73`).

### `src/components/article-card.tsx`
- **Role:** Single-article card (not the group variant).
- **Exports:** `ArticleCard` (component) — props `{ article: Article }`.
- **Consumed by:** **No importers found** — grep for `ArticleCard` across `src/` and `e2e/` returns only its own definition and a stale mention in `platform-badge.tsx:3`. Currently dead-but-compiled.
- **Behaviour notes:** `resolveHref` (`:17-21`): `linkedNote` → `/notes/${linkedNote}` (internal, **no** `NOTES_ENABLED` check, unlike the group card) → non-native + `externalUrl` → external → `a.url`. `fmt` formats dates with `timeZone: "UTC"` to avoid relative drift (`:10-15`).

### `src/components/note-card.tsx`
- **Role:** Note card.
- **Exports:** `NoteCard` — props `{ note: Note }`.
- **Consumed by:** `src/app/articles/page.tsx`, `src/app/notes/page.tsx`.
- **Behaviour notes:** Shows a `Sparkles` "inkforge" badge when `note.generatedBy === "inkforge"` (`:31-36`) — that field is optional in the Velite note schema (`velite.config.ts:79`), so hand-written `.mdx` notes simply omit the badge. `readingTime` likewise renders only when present (`:56`).

### `src/components/project-card.tsx`
- **Role:** OSS project card (server component — no `"use client"`).
- **Exports:** `ProjectCard` — props `{ project: Project }`.
- **Consumed by:** `src/app/projects/page.tsx`, `src/components/home/featured-projects.tsx`.
- **Behaviour notes:** Footer shows `project.commits.toLocaleString()` when `commits != null`, otherwise falls back to `project.group` (`:39-46`). `tech` sliced to 5 (`:28`). Two separate links to `project.url` (title + "Details") plus one external to `project.repo`.

### `src/components/platform-badge.tsx`
- **Role:** Tinted per-platform pill.
- **Exports:** `ArticleSource` (type union: `medium | substack | linkedin | devto | hashnode | native`), `PlatformBadge` — props `{ source: ArticleSource }`.
- **Consumed by:** `src/app/articles/page.tsx`, `article-card.tsx`, `article-group-card.tsx`; the type is also referenced by `src/lib/article-grouping.ts`.
- **Behaviour notes:** `SOURCE_CONFIG` hardcodes brand hex per platform with 0.08 bg / 0.2 border alpha (`:13-23`); `native` is labelled **"Essay"** with the accent cyan `#38e1ff`. Unknown sources fall back to `native` via `?? SOURCE_CONFIG.native` (`:26`).
- **Gotchas / invariants:** The union must stay in sync with the Velite article `source` enum (`velite.config.ts:109`).

### `src/components/github-feed.tsx`
- **Role:** Server-rendered first-party GitHub repo grid.
- **Exports:** `GithubFeed` — props `{ repos: GithubRepo[] }`.
- **Reads / depends on:** `@/lib/github` `GithubRepo` (type only).
- **Consumed by:** `src/app/projects/page.tsx`.
- **Behaviour notes:** Returns `null` on an empty array (`:28`) — documented as "empty-safe: with no resolved repos (token unset + all private, or rate-limited at build) the whole section renders nothing" (`:8-10`). `pushedAgo` uses a module-level `Intl.RelativeTimeFormat("en", { numeric: "auto" })` and buckets by year (≤ −365 d) / month (≤ −30) / week (≤ −7) / day, returning `""` for unparseable input, which hides the label (`:13-25`). Star/fork counts carry `sr-only` prefixes (`:47`, `:52`).
- **Gotchas / invariants:** Replaces third-party github-readme-stats `<img>` cards specifically so no external request sits in the visitor's path (`:4-7`).

### `src/components/github-stats-strip.tsx`
- **Role:** Client-fetched aggregate GitHub stat cards on the homepage.
- **Exports:** `GithubStatsStrip` (no props). `StatCard` is module-private.
- **Reads / depends on:** `GET /api/github/stats`, `motion/react` (`motion`, `AnimatePresence`), `ui/reveal` `Reveal`, `ui/skeleton` `SkeletonStatCard`.
- **Consumed by:** `src/app/page.tsx:31`, itself gated by `GITHUB_STATS_ENABLED` (`NEXT_PUBLIC_GITHUB_STATS_ENABLED === "true"`, default off).
- **Behaviour notes:** Three-state machine `"loading" | "ready" | "empty"` (`:16`). Enters `ready` only when `data.followers > 0 || data.publicRepos > 0`; anything else (including a non-OK response or a network throw) becomes `empty` (`:37-45`). `empty` returns `null` entirely — "a strip showing 0/0/— is worse than nothing" (`:48-49`). `AnimatePresence mode="wait"` crossfades skeleton → content; the loading grid carries `role="status"` + an `sr-only` announcement (`:60-66`). Zero stars/forks render as `"—"` (`:79-80`).
- **Gotchas / invariants:** `stats!` non-null assertions at `:77-80` are only safe because `fetchState === "ready"` implies `stats` was set in the same `.then`.

### `src/components/open-to-work-banner.tsx`
- **Role:** Hiring-signal strip below the sticky nav (server component).
- **Exports:** `OpenToWorkBanner` (no props).
- **Consumed by:** `src/app/layout.tsx:99`, as `{OPEN_TO_WORK && <OpenToWorkBanner />}` — the flag check lives in the caller, not here.
- **Behaviour notes:** Hardcoded copy "Open to Backend, GenAI & Full-Stack roles · remote or Hyderabad" (`:16`) plus mailto and `profile.calendlyUrl` CTAs. A pulsing green dot is `aria-hidden` (`:15`).
- **Gotchas / invariants:** The header docblock claims the banner is "hidden via CSS (h-0) when the flag is off so there is zero layout shift" (`:6-8`) — **the code does not do this**; `layout.tsx:99` conditionally omits the element entirely. Treat the comment as stale.

### `src/components/reading-progress.tsx`
- **Role:** Top-of-viewport scroll progress bar.
- **Exports:** `ReadingProgress` (no props).
- **Reads / depends on:** `motion/react` `useScroll` + `useReducedMotion` (Motion's own, not `@/lib/use-reduced-motion`).
- **Consumed by:** `src/app/notes/[slug]/page.tsx:86` only.
- **Behaviour notes:** Returns `null` under reduced motion (`:15`). Drives `scaleX` from `scrollYProgress` on a `fixed … h-[2px] origin-left` bar — compositor-only, zero React re-renders (`:6-9`, `:18-22`). `aria-hidden="true"`.

### `src/components/copy-button.tsx`
- **Role:** Generic copy-to-clipboard button.
- **Exports:** `CopyButton` — props `{ value: string; label?: string }` (default label `"Copy"`).
- **Consumed by:** `src/app/mcp/page.tsx`.
- **Behaviour notes:** 1800 ms "Copied" window (`:17`); a clipboard rejection is silently swallowed as a documented no-op (`:19`). `aria-label` flips to `"Copied"` and the visible text sits in an `aria-live="polite"` span (`:27`, `:35`).

### `src/components/icons.tsx`
- **Role:** Inline brand SVGs.
- **Exports:** `Github`, `Linkedin` — both take `{ size?: number; className?: string }`, default `size = 18`.
- **Consumed by:** `site-nav.tsx`, `site-footer.tsx`, `mobile-nav.tsx`, `command-palette.tsx`, `project-card.tsx`, `home/hero.tsx`, `home/contact.tsx`, `chat/chat-card.tsx`, `game/developer-rail.tsx`, `game/dossier-card.tsx`, `src/app/projects/[slug]/page.tsx`.
- **Behaviour notes:** `fill="currentColor"`, `aria-hidden="true"` hardcoded — callers must supply their own `aria-label` on the wrapping link (they all do). Exists because "lucide-react 1.x removed brand glyphs" (`:1-4`).

### `src/components/home/hero.tsx`
- **Role:** Above-the-fold hero (server component).
- **Exports:** `Hero` (no props).
- **Reads / depends on:** `@/lib/profile` (`profile`, `impactMetrics`), `@/components/hero-graph` `HeroGraph`, `@/components/hero-avatar` `HeroAvatar`, env `NEXT_PUBLIC_HERO_MODE`.
- **Consumed by:** `src/app/page.tsx:28`.
- **Behaviour notes:** `heroMode === "avatar" ? <HeroAvatar /> : <HeroGraph />` (`:21`). Entrance is pure CSS `.hero-rise` with staggered inline `animationDelay` of `0.05s / 0.1s / 0.15s / 0.2s` (`:27`, `:34`, `:38`, `:67`) — no JS/hydration gate, so the hero never flashes invisible and does not delay LCP (`:8-13`). `.hero-rise` is defined at `src/app/globals.css:76-85` and is neutralised (`opacity: 1; animation: none`) under reduced motion (`globals.css:85`). The headline copy is hardcoded JSX, not from `profile` (`:29-32`).
- **Gotchas / invariants:** `NEXT_PUBLIC_HERO_MODE` is read inside the function body, not module scope, "required for `vi.stubEnv` in tests" (`:15-16`). The impact `<dl>` is `sm:grid-cols-3` to match exactly 3 `impactMetrics`; a 4th metric or a change to `impactMetrics.length` leaves a blank trailing cell — the comment records that this was previously `sm:grid-cols-4` and broke (`:62-64`).

### `src/components/home/resume-view.tsx`
- **Role:** The `?view=resume` recruiter surface and the `/resume` page body.
- **Exports:** `ResumeView` (wraps in `<main className={"min-h-screen " + WRAPPER_CLASS}>`), `ResumeViewInline` (wraps in `<div>`). `ResumeContent` is module-private.
- **Reads / depends on:** `@/lib/content` (`allWork`, `allProjects`), `@/lib/profile` (`profile`, `skills`, `achievements`, `resumeVariants`, `impactMetrics`), env `NEXT_PUBLIC_RESUME_VARIANTS`.
- **Consumed by:** `src/components/view-router.tsx:44-50` (dynamic, `ssr: false`) and `src/app/resume/page.tsx`.
- **Behaviour notes:** Shared `WRAPPER_CLASS` includes `print:bg-white print:text-black` (`:37-38`); every text node carries a `print:` colour override so Cmd-P yields black-on-white with no extra tooling (`:3-25`). Sections in order: Identity, Production Work, Open-Source Projects, Skills, Recognition, PDF Downloads (`print:hidden`, `:201`), Contact CTA. No Three.js, no Motion, no animation by design.
- **Gotchas / invariants:** Two exports exist purely so `/resume` does not nest two `<main>` landmarks (`:253-256`). `NEXT_PUBLIC_RESUME_VARIANTS` is read inside `ResumeContent`, not module scope, so `vi.stubEnv` works (`:41-43`); unset → master pill only. The docblock at `:12-14` claims `ViewEscapeHatch` is "auto-rendered by view-router for non-classic views" — **it is not**; `view-router.tsx` renders no escape hatch, and `ResumeView` does not render one either, so the resume view has no in-page "back to Classic" control.

### `src/components/home/featured-work.tsx` · `featured-projects.tsx` · `achievements.tsx` · `writing-preview.tsx` · `testimonials.tsx` · `contact.tsx`
- **Role:** The six homepage sections between `Hero` and the footer, all rendered from `src/app/page.tsx:28-35`.
- **Exports:** `FeaturedWork`, `FeaturedProjects`, `Achievements`, `WritingPreview`, `Testimonials`, `Contact` — all no-prop.
- **Behaviour notes:**
  - `FeaturedWork` iterates **all** `allWork` (not a slice), surfacing `w.register` in the `mono-label` eyebrow and `w.metrics` in a `<dl>` (`featured-work.tsx:12-33`). Reveal delay is `i * 0.08`.
  - `FeaturedProjects` iterates `featuredProjects` from `@/lib/content` but the CTA text is the hardcoded string `"View all 8 projects"` (`featured-projects.tsx:24`) — it does not read `allProjects.length`.
  - `Achievements` staggers with `delay={(i % 3) * 0.06}` to match its 3-column grid (`achievements.tsx:11`).
  - `WritingPreview` returns `null` when `!ARTICLES_ENABLED || allArticles.length === 0` (`writing-preview.tsx:11`), then calls `groupArticles(allArticles)` and slices to 2 — deduping **before** slicing so you get 2 unique articles, not 2 platform variants of one (`:13-15`).
  - `Testimonials` returns `null` when `!TESTIMONIALS_ENABLED` (default off) (`testimonials.tsx:13`); when enabled with an empty `testimonials` array it renders a "coming soon" card linking to a hardcoded `https://linkedin.com/in/sairam0424` (`:15-38`); populated it renders `<figure>`/`<blockquote>`/`<figcaption>` with a "verify on LinkedIn" link per entry (`:46-67`).
  - `Contact` (`"use client"`) copies `profile.email` with a 2000 ms confirmation and falls back to `window.location.href = mailto:` on clipboard failure (`contact.tsx:13-22`); the section id is `contact`, which is the `/#contact` anchor target used by the nav and palette.
- **Gotchas / invariants:** Only `contact.tsx` is a client component; the other five are RSC. All six wrap their content in `<Section>` + `<Reveal>`, so both must stay SSR-safe or the homepage regresses to invisible content.

### `src/components/ui/section.tsx`
- **Role:** Standard page section wrapper.
- **Exports:** `Section` — props `{ id?, label?, title?, titleAs?: "h1" | "h2" (default "h2"), children, className? }`.
- **Consumed by:** 9 route files (`projects`, `resume`, `articles`, `mcp`, `about`, `search`, `notes`, `work`, `stats`) and all 6 home sections.
- **Behaviour notes:** Base classes `mx-auto w-full max-w-5xl px-6 py-20 sm:py-24 scroll-reveal` (`:28`) — the `scroll-reveal` class is a CSS-only reveal defined at `src/app/globals.css:332-353`, disabled under reduced motion. The header block renders only when `label || title` (`:29`).
- **Gotchas / invariants:** Each standalone page must pass `titleAs="h1"` to its **first** section or the page's highest heading is an `h2`, leaving a screen-reader heading list with no top anchor (WCAG 1.3.1 / 2.4.6) (`:4-11`).

### `src/components/ui/reveal.tsx`
- **Role:** Scroll-into-view fade/rise wrapper.
- **Exports:** `Reveal` — props `{ children, delay?: number = 0, className? }`.
- **Reads / depends on:** `motion/react` `motion`, `@/lib/use-reduced-motion` `useReducedMotion`, `@/lib/use-mounted` `useMounted`.
- **Consumed by:** 10 route files + `github-stats-strip.tsx` + all 6 home sections.
- **Behaviour notes:** When `reduced || !mounted` it returns a plain `<div>` (`:28`) — so crawlers, JS-disabled visitors, pre-hydration paint, and a hydration failure all see fully visible content rather than `opacity: 0` (`:8-15`). Animated path: `initial={{ opacity: 0, y: 16 }}`, `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true, margin: "-80px" }}`, `0.5s cubic-bezier(0.21, 0.47, 0.32, 0.98)` (`:32-36`).
- **Gotchas / invariants:** The `!mounted` branch is the no-JS safety net — removing it makes every below-fold section permanently invisible whenever hydration fails.

### `src/components/ui/skeleton.tsx`
- **Role:** Loading-state primitives.
- **Exports:** `Skeleton({ className? })`, `SkeletonStatCard()`, `SkeletonCard()`, `SkeletonIframe()`, `SkeletonMarkdownLine()`, `SkeletonViewTransition({ label? })`.
- **Reads / depends on:** `@/lib/use-reduced-motion`, `@/lib/utils` `cn`, `lucide-react` `FileText`.
- **Consumed by:** `src/app/resume/page.tsx`, `ask-portfolio.tsx`, `github-stats-strip.tsx`, `view-router.tsx`, `chat/chat-messages.tsx`.
- **Behaviour notes:** `Skeleton` applies `skeleton-shimmer rounded-md` and is `aria-hidden="true"` — decorative, so only the enclosing `role="status"` container is announced (`:7-17`); `.skeleton-shimmer` is defined at `src/app/globals.css:357-381`. `SkeletonStatCard` mirrors `GithubStatsStrip`'s `StatCard`; `SkeletonCard` mirrors the `card-surface` article/note/project shape; `SkeletonIframe` is absolutely positioned for the résumé PDF `h-[80vh]` frame; `SkeletonMarkdownLine` is 3 lines for streamed markdown. `SkeletonViewTransition` is `h-[calc(100dvh-3.5rem)]` (nav height subtracted), `role="status"`, with a pulsing orb ring that drops `animate-pulse` under reduced motion (`:102-126`).
- **Gotchas / invariants:** `SkeletonViewTransition`'s `3.5rem` must track the `h-14` nav row in `site-nav.tsx:42`.

### `src/components/ui/ink-transition.tsx`
- **Role:** Opt-in WebGL2 ink-burn overlay for view switches.
- **Exports:** `InkTransitionHandle` (type: `{ transitionIn(onMidpoint: () => void): void }`), `inkTransitionRef` (module-level mutable `let`, initially `null`), `InkTransition` (a `forwardRef` component taking no props).
- **Consumed by:** `providers.tsx:12-15` (dynamic, `ssr: false`, always mounted) and `view-context.tsx:101-108` (dynamic import inside `commitViewChange`).
- **Behaviour notes:** `DURATION_MS = 800`, midpoint at 50% (`:33`, `:184-187`) — the view store emits at midpoint so the burn consumes the old view and reveals the new one. Vertex/fragment GLSL ES 3.00 sources are inline string constants (`:39-91`); the fragment shader is 4-octave fBm noise that `discard`s where `n < uProgress * 1.3 - 0.15` and paints opaque black otherwise (`:74-91`). Geometry is a single fullscreen NDC triangle `[-1,-1, 3,-1, -1,3]` (`:139`), avoiding camera projection entirely so the burn composites over the R3F scene without projection fighting (`:13-15`). Canvas is `position: fixed; inset: 0; display: none; pointer-events: none; z-index: 50; mix-blend-mode: multiply` (`:218-232`) — zero GPU cost while inactive. `transitionIn` resizes to `window.innerWidth/Height * devicePixelRatio` per fire (`:175-178`), and fires `onMidpoint()` immediately when WebGL is unavailable (`:164-168`) plus a safety fire at `progress === 1` if 50% was skipped (`:199`). A failed shader compile is caught and swallowed so the rest of the app is unaffected (`:151-153`).
- **Gotchas / invariants:**
  - `inkTransitionRef` is a **module-level mutable export** set in an effect with **no dependency array** (`:213-216`), so it re-assigns on every render. `view-context.tsx` reads it directly because `commitViewChange` is a module-level function with no access to React context (`:114-116`).
  - The ink path only runs when `NEXT_PUBLIC_INK_TRANSITION === "true"` (`view-context.tsx:99`); otherwise the component mounts but is never invoked.
  - The docblock lists a `prefers-reduced-motion: no-preference` gate (`:22`) but that check lives in `view-context.tsx:80-92`, not in this file.

### `src/components/ui/button.tsx`
- **Role:** Button primitive.
- **Exports:** `Button` — props `ComponentPropsWithoutRef<"button"> & { variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg" }`. Defaults: `variant = "secondary"`, `size = "md"` (`:28-29`).
- **Consumed by:** **No importers found** — grep for `ui/button`, `<Button` and `from "@/components/ui/button"` across `src/` and `e2e/` returns only this file.
- **Behaviour notes:** Variant classes (`:7-14`): `primary` = `bg-accent text-bg-base hover:bg-accent-strong`; `secondary` = `border border-border-strong text-fg hover:bg-bg-elevated`; `ghost` = `text-fg-muted hover:text-fg hover:bg-bg-surface`. All three set `focus-visible:ring-accent`. Size classes (`:16-20`): `sm` = `px-3 py-1.5 text-xs`, `md` = `px-4 py-2 text-sm`, `lg` = `px-6 py-3 text-base`. Always-on base: `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors`, a `focus-visible:ring-2 ring-offset-1 ring-offset-bg-base` block, and `disabled:pointer-events-none disabled:opacity-40` (`:40-42`). Merged with `cn` (clsx + tailwind-merge), so a caller `className` wins conflicts.

### `src/components/ui/empty-state.tsx`
- **Role:** Centered empty-state card.
- **Exports:** `EmptyState` — props `{ icon?: ReactNode; heading: string; body?: string; action?: ReactNode; className?: string }`.
- **Consumed by:** **No importers found** — grep for `EmptyState` across `src/` returns only this file.
- **Behaviour notes:** Base `card-surface flex flex-col items-center gap-3 px-8 py-12 text-center` (`:16`). `icon` is wrapped `aria-hidden="true"` (`:20-24`); `heading` renders as an `<h3>`; `body` is capped at `max-w-xs`; `action` gets an `mt-2` wrapper. All three optionals render only when truthy.

### `src/components/scroll/jump-to-latest.tsx`
- **Role:** Presentational "Jump to latest" pill for the autoscroll state machine.
- **Exports:** `JumpToLatest` — props `{ show: boolean; onClick: () => void; label?: string }` (default label `"Jump to latest"`).
- **Consumed by:** `src/components/ask-portfolio.tsx`, `src/components/chat/chat-messages.tsx`.
- **Behaviour notes:** Returns `null` when `!show` (`:28`). Outer wrapper is `pointer-events-none absolute inset-x-0 bottom-3 z-10`, with the button re-enabling `pointer-events-auto` (`:30-31`) so the surrounding strip never eats transcript clicks.
- **Gotchas / invariants:** Purely presentational — visibility and the snap are owned by the autoscroll hook; the caller's `onClick` is expected to call `scrollToBottom()` **and** move focus back to the transcript/input (`:19-27`). Documented as the WCAG 2.2.2 (Pause, Stop, Hide, Level A) resume mechanism for the auto-updating transcript, with a 36px height + 44px tap area via padding (2.5.8 AA) — the parent must be `relative` (`:5-18`).

---

## Coverage

- `src/components/article-card.tsx`
- `src/components/article-group-card.tsx`
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
- `src/components/site-footer.tsx`
- `src/components/site-nav.tsx`
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
- `src/components/ui/button.tsx`
- `src/components/ui/empty-state.tsx`
- `src/components/ui/ink-transition.tsx`
- `src/components/ui/reveal.tsx`
- `src/components/ui/section.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/scroll/jump-to-latest.tsx`

**Excluded from this section (owned elsewhere):** `src/components/ask-portfolio.tsx`, `src/components/chat/**`, `src/components/game/**`, `src/components/hero-avatar/**`, `src/components/hero-graph/**`, and the tests `ask-portfolio.dom.test.tsx`, `site-footer.dom.test.tsx`, `view-context.test.ts`.

## UNVERIFIED

- Whether `ArticleCard`, `Button`, and `EmptyState` are intentionally-retained primitives or dead code — grep finds no importers, but intent is not recorded anywhere in the repo.
- Whether the stale comments noted above (`open-to-work-banner.tsx:6-8` "hidden via CSS (h-0)"; `home/resume-view.tsx:12-14` "ViewEscapeHatch auto-rendered by view-router") reflect removed behaviour or were never accurate. The current code does neither.
