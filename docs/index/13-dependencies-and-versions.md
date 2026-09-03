---
kind: doc
title: Dependency Inventory & Version Surface
domain: [content]
status: current
version: v3.6.0
---

# Dependency Inventory & Version Surface

> Part of the Anvilry v3.6.0 codebase index. Master entry point: [docs/index/README.md](./README.md)

**Scope:** `package.json` (`dependencies`, `devDependencies`, `engines`), `pnpm-workspace.yaml` (`overrides`, `onlyBuiltDependencies`, `ignoredBuiltDependencies` — these moved out of `package.json` in v3.5.0), `pnpm-lock.yaml`, `.nvmrc`, and every config / source file that consumes a declared dependency (`next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `velite.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.json`, `vercel.json`, `.github/dependabot.yml`, `.github/workflows/*.yml`, `Makefile`, and the `src/`, `e2e/`, `scripts/` import sites). One in-scope file imports **no** declared dependency and is indexed anyway: `scripts/bundle-budget.mjs` (`node:fs` only), because it is what now enforces the `three` one-chunk / first-load invariant this section documents. `.github/workflows/bundle-analysis.yml` was in this scope until this branch **deleted** it.
**Files indexed:** 47 (unchanged — `scripts/bundle-budget.mjs` replaces the deleted `.github/workflows/bundle-analysis.yml` one-for-one)

**Declared counts (verified, not from the brief):** `dependencies` = **33**, `devDependencies` = **17**, `overrides` = **10**, `onlyBuiltDependencies` = **1**. Total declared = 50. The two `dependencies` blocks are at `package.json:23-55` and `:57-74`; the pnpm settings blocks are no longer in `package.json` at all — they live in `pnpm-workspace.yaml` (see **Version pins & overrides** below).

**What changed at v3.5.0 (dependency surface only):** `@react-three/rapier` and `@react-three/offscreen` were **removed** (35 → 33 prod deps, `CHANGELOG.md:164-201`); `flags` `^4.2.0 → ^4.3.0`, `@upstash/redis` `^1.38.0 → ^1.38.2`, `web-vitals` `^5.3.0 → ^6.1.1`; the `pnpm` field of `package.json` was deleted and its **two** blocks (`overrides`, `onlyBuiltDependencies`) moved to `pnpm-workspace.yaml`, joining the `ignoredBuiltDependencies` that already lived there; and `engines.node` (`">=22 <23"`) plus `.nvmrc` (`22`) were added.

**What changed on this branch (dependency surface only): nothing was added or removed — one dependency changed *status*.** Counts still read 33 prod / 17 dev. `@next/bundle-analyzer` is **still a declared `devDependency`** (`package.json:58`) and `next.config.ts:5` still wraps the exported config with it; what changed is its reachability. It was **CI-wired** — `.github/workflows/bundle-analysis.yml` ran an `ANALYZE=true` build on every push to `develop`/`main` — and that workflow is now **deleted**. It is now a **local attribution tool, opt-in only**, invoked solely by the new `analyze` script and requiring an explicit `--webpack` flag to produce anything at all. Two knock-on effects on citations in this file: the manifest now has **12** scripts, not 11, and because `analyze` was inserted at `package.json:12`, **every `package.json` line below `:11` shifted +1** (both dependency blocks, all six caret-less pins). Every `package.json:N` in this section has been re-read against the current file, not arithmetically adjusted.

## At a glance

| File | Role | Key exports |
|---|---|---|
| `package.json` | Manifest: **12** scripts (was 11 — `analyze` added at `:12`), 33 prod deps, 17 dev deps, `engines.node` (`">=22 <23"`, `package.json:5-7`). **No `pnpm` field** — its `overrides` and `onlyBuiltDependencies` moved to `pnpm-workspace.yaml` in v3.5.0 | n/a (JSON) |
| `pnpm-lock.yaml` | lockfileVersion 9.0; `overrides:` block mirrored at `:7-17`; resolved versions for every importer | n/a |
| `pnpm-workspace.yaml` | **The single source of truth for every pnpm setting since v3.5.0:** `overrides` (10, `:18-28`), `onlyBuiltDependencies: [esbuild]` (`:44-45`), `ignoredBuiltDependencies: [sharp, unrs-resolver]` (`:48-50`), `allowBuilds` (`:55-58`). Its own header (`:1-12`) records why — pnpm 11 stops reading `package.json`'s `pnpm` field | n/a |
| `.nvmrc` | Single line `22` — pins the local/contributor Node major to the CI pin and to `engines.node` | n/a |
| `next.config.ts` | Loads `@next/bundle-analyzer` via `createRequire` — the wrap is unconditional but the analyzer is a **no-op unless the build is `--webpack`**; dev-only `import("velite")` watcher; CSP; `optimizePackageImports: ["lucide-react","motion"]`; `cacheComponents: true` | `default` (wrapped `NextConfig`) |
| `vitest.config.ts` | Vitest 4 two-project config (`node` / `dom`), `resolve.tsconfigPaths`, forces `NODE_ENV=test` | `default` (config) |
| `playwright.config.ts` | Playwright 1.61 config; `webServer` runs `pnpm start`; single `chromium` project | `default` (config) |
| `velite.config.ts` | 4 Velite collections via `defineConfig/defineCollection/s` — uses Velite's bundled schema builder, NOT the `zod` dependency | `default` (config) |
| `postcss.config.mjs` | Sole plugin `@tailwindcss/postcss` (Tailwind v4 PostCSS entry) | `config` (default) |
| `eslint.config.mjs` | Flat config: `eslint/config` + `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`; ignores `scripts/**`, `.velite/**` | `default` (flat config array) |
| `tsconfig.json` | `strict`, `moduleResolution: bundler`, `plugins:[{name:"next"}]`, `@/*` → `./src/*` | n/a |
| `vercel.json` | 5 cron entries only — no build/install overrides | n/a |
| `.github/dependabot.yml` | 6 update groups + 3 `ignore` rules (postprocessing 3.0.5, typescript major, eslint major); `target-branch: develop` | n/a |
| `.github/workflows/ci.yml` | Node 22 + pnpm 10; `pnpm content` before tsc/vitest; separate `e2e` job pins Playwright browsers **and now carries the blocking `Bundle budget` step** (`:110-111`) straight after its `Build` step (`:101-102`); non-blocking `security-alerts` job | n/a |
| `scripts/bundle-budget.mjs` | **New on this branch; replaces the deleted `.github/workflows/bundle-analysis.yml`.** Reads `.next/diagnostics/route-bundle-stats.json` (`:32`) — an artifact `next build` writes with no flag but **only under Turbopack** — and asserts every route's first-load JS stays under `MAX_FIRST_LOAD_BYTES` (`:45`) and that three.js stays off the first-load critical path via the `WebGLRenderer` marker (`:57`). Imports nothing but `node:fs` — no declared dependency | n/a (CLI; exit 0 / exit 1) |
| `Makefile` | `search-index` target is the ONLY invoker of `pagefind` (`Makefile:66`) | n/a |
| `src/lib/r3f.ts` | Single-module barrel for the whole R3F/three universe (load-bearing for one-copy chunking) | 21 named value re-exports + 3 type re-exports + the `THREE` namespace (`src/lib/r3f.ts:17-27`) |
| `src/lib/llm.ts` | Imports both Anthropic SDKs; Bedrock/direct model chains | `getProvider`, `bedrockCreds`, streaming helpers |
| `src/lib/utils.ts` | `clsx` + `tailwind-merge` merge helper | `cn` |
| `src/lib/redis.ts` | `@upstash/redis` singleton, null when env absent | `redis` |
| `src/lib/rate-limit.ts` | `@upstash/ratelimit` sliding window 8/60s, fails open | `isRateLimitEnabled`, `checkRateLimit` |
| `src/lib/flags.ts` | `flags/next` `flag()` declaration, driver switch | `getDiscoveryBadgesEnabled` |
| `src/lib/mcp-tools.ts` | Raw-shape `zod` input schemas + pure tool logic | `RESUME_ROLES`, `*Schema`, `*Data` fns |
| `src/lib/scroll/use-stick-to-bottom-library.ts` | Adapter over `use-stick-to-bottom` | `useStickToBottomLibrary` |
| `src/app/api/mcp/[transport]/route.ts` | `mcp-handler` `createMcpHandler`; registers 9 tools | `GET`, `POST`, `DELETE`, `maxDuration` |
| `src/app/api/tts/route.ts` | `@aws-sdk/client-polly` consumer | `POST`, `maxDuration = 15` |
| `src/app/api/transcribe/route.ts` | `@aws-sdk/client-transcribe-streaming` consumer | `POST`, `maxDuration = 20` |
| `src/app/api/visit/route.ts` | Second direct `@upstash/ratelimit` construction site | `POST` |
| `src/app/api/error/route.ts` | `zod` payload validation | `POST`, `maxDuration = 5` |
| `src/app/.well-known/vercel/flags/route.ts` | `flags` + `flags/next` provider-data endpoint | `GET` |
| `src/app/layout.tsx` | Mounts `@vercel/analytics/next` + `@vercel/speed-insights/next` | `default`, `metadata`, `viewport` |
| `src/app/search/page.tsx` | Loads the Pagefind UI bundle from `/public/pagefind/` by script tag — no npm import | `default` |
| `src/app/globals.css` | `@import "tailwindcss"` (v4 CSS-first entry) | n/a (CSS) |
| `src/components/hero-graph/index.tsx` | Flag-switched `next/dynamic` loader. Its comment at `:13` still reads "`@react-three/rapier` is declared in package.json but imported nowhere in src/" — accurate at v3.4.2, now **stale**: the package is gone from `package.json`. Only "the flag and filename are historical" still holds | `HeroGraph` |
| `src/components/hero-graph/scene-physics.tsx` | Imports `@react-three/fiber` + `three` directly (bypasses the barrel); "No RigidBody / Rapier needed for this effect" (`:12`) | `HeroGraphScenePhysics` |
| `src/components/chat/voice-orb-3d.tsx` | Only consumer of `postprocessing` and `@whatisjery/react-fluid-distortion` | `VoiceOrb3D` (see file) |
| `src/components/chat/markdown-message.tsx` | Only consumer of `react-markdown`, `remark-gfm`, `rehype-sanitize` | `MarkdownMessage`, `closeOpenMarkdown` |
| `src/components/chat/file-picker-button.tsx` | Only consumer of `pdfjs-dist` (dynamic import) | `FilePickerButton` |
| `src/components/command-palette.tsx` | Only consumer of `cmdk`; also `@radix-ui/react-dialog` + `@vercel/analytics` `track` | `CommandPalette` |
| `src/instrumentation-client.ts` | Only consumer of `web-vitals` (lazy `import("web-vitals")`) | side-effect module |
| `scripts/replay-trace.mjs` | CLI; imports `@upstash/redis` outside `src/` | n/a (script) |
| `e2e/views.spec.ts` | `@playwright/test` specs for the four views + SEO routes | test file |
| `e2e/resume.spec.ts` | `@playwright/test` specs for `/resume` (flag-OFF default + skipped flag-ON) | test file |
| `CHANGELOG.md` | Authoritative prose record of every version pin/hold in 3.4.0–3.5.0. The v3.5.0 `### Removed` entry (`:104-109`) is the citation of record for the two deleted R3F packages, including the measured impact ("3 packages removed, 0 added, 1 version change") | n/a |
| `CLAUDE.md` | Repo guidance. **Current on this subject:** `CLAUDE.md:259-260` heads "**Two dependencies were declared but never imported — both removed in v3.5.0:**" and names `@react-three/offscreen` and `@react-three/rapier`, neither of which is declared any more. An earlier version of this row claimed CLAUDE.md still called them merely "not actually used"; that phrase appears nowhere in `CLAUDE.md` at any point in this branch’s history (`grep -c` returns 0), so the staleness was in this index, not in CLAUDE.md | n/a |
| `ARCHITECTURE.md` | Knowledge-base model; invariant "`.velite/` is gitignored" | n/a |
| `.gitignore` | Confirms `.velite`, `.vercel`, `next-env.d.ts`, `test-results/`, `playwright-report/` are untracked | n/a |

## Dependency map

### `dependencies` (33)

| package | version spec | prod/dev | purpose in THIS app | import sites (path:line) | notes |
|---|---|---|---|---|---|
| `@anthropic-ai/bedrock-sdk` | `^0.33.3` (resolved 0.33.3) | prod | `AnthropicBedrock` client for the default `LLM_PROVIDER=bedrock` chat path | `src/lib/llm.ts:2`; `src/lib/llm.test.ts:55` (vi.mock) | Server-only. Resolved with `(zod@3.25.76)` peer context |
| `@anthropic-ai/sdk` | `^0.116.0` | prod | Direct Anthropic API client + all message/stream types | `src/lib/llm.ts:1`; `src/app/api/chat/route.ts:1` (type-only); `src/lib/llm.test.ts:72` | Peer `zod: ^3.25.0 \|\| ^4.0.0` (optional). `llm.test.ts` pins snake_case usage fields |
| `@aws-sdk/client-polly` | `^3.1108.0` (resolved 3.1111.0) | prod | Polly Neural TTS behind the flag-gated `/api/tts` | `src/app/api/tts/route.ts:1` | Server-only, single import site |
| `@aws-sdk/client-transcribe-streaming` | `^3.1108.0` (resolved 3.1111.0) | prod | One-shot streaming STT for `/api/transcribe` | `src/app/api/transcribe/route.ts:1-5` | Server-only, single import site |
| `@modelcontextprotocol/sdk` | `1.26.0` (EXACT, no caret) | prod | Peer requirement of `mcp-handler` (`mcp-handler` peer is literally `1.26.0`) | **NO DIRECT IMPORT FOUND** | Searched `src/`, `e2e/`, `scripts/`, all root config files, and the whole repo excluding `node_modules`/`.next`/`.velite`/`.git` — the only matches are `package.json:27` and `CHANGELOG.md:217,229`. Declared because pnpm requires the peer be installed; consumed only through `mcp-handler` (`pnpm-lock.yaml:8785`). The exact pin is why Dependabot returned `security_update_not_possible` |
| `@radix-ui/react-dialog` | `^1.1.23` | prod | Accessible dialog primitives for 5 overlays | `src/components/command-palette-content.tsx:18`; `src/components/chat/talk-mode-overlay.tsx:3`; `src/components/chat/voice-picker.tsx:4`; `src/components/game/terminal/terminal-overlay.tsx:3` (also `chat/voice-settings-dialog.tsx:4`) | Client-bundled |
| `@react-three/drei` | `^10.7.8` | prod | R3F helpers (`useGLTF`, `Text`, `OrbitControls`, …) | `src/lib/r3f.ts:24` — **only** import site | Deliberately funnelled through the barrel. Carries `@types/three` as a transitive peer (`pnpm-lock.yaml:6080`) |
| `@react-three/fiber` | `^9.7.0` | prod | React renderer for three.js | `src/lib/r3f.ts:17-18`; `src/components/hero-graph/scene-physics.tsx:4-5` | `scene-physics.tsx` bypasses the barrel — the one exception |
| `@react-three/postprocessing` | `3.0.4` (EXACT, no caret) | prod | `EffectComposer`/`Bloom`/`Vignette`/`Noise`/`ChromaticAberration` for the voice orb | `src/lib/r3f.ts:27` — only import site | Pinned exact because 3.0.5 ships a types-only regression; a scoped Dependabot `ignore` for `["3.0.5"]` accompanies it (`.github/dependabot.yml`) |
| `@types/three` | `^0.185.4` | **prod** (not dev) | Type definitions for three.js — load-bearing for `tsc` | **NO DIRECT IMPORT FOUND** (types packages are never imported by specifier) | Verified necessary, not vestigial: `node_modules/three/package.json` has no `types`/`typings` field and no `.d.ts` in `build/`, so `import type * as THREE from "three"` (`src/components/hero-avatar/rig.ts:4`, `rig.test.ts:2`) and `src/lib/r3f.ts:21` only typecheck via `@types/three`. Also required as a peer by `maath` (`pnpm-lock.yaml:3553,3559`) and `stats-gl` (`:4306`), and threaded as a transitive peer through `drei` (`:6165`) and `@react-three/postprocessing` (`:6197`). `CHANGELOG.md:273-275` explains the `^0.184.1 → ^0.185.4` bump: caret on `0.x` is restrictive so it could not follow `three@0.185.1` on its own. **Since v3.5.0 it is also the sole consumer of `@dimforge/rapier3d-compat`**, which it pulls at `0.12.0` (`pnpm-lock.yaml:6709-6711`); removing `@react-three/rapier` dropped the second copy (0.19.2) from the graph |
| `@upstash/ratelimit` | `^2.0.8` | prod | Sliding-window per-IP limiter (8 req / 60 s, prefix `anvilry:chat`) | `src/lib/rate-limit.ts:1,20-27`; `src/app/api/visit/route.ts:3` | Server-only. `/api/visit` builds its own Ratelimit rather than reusing `rate-limit.ts` |
| `@upstash/redis` | `^1.38.2` | prod | REST Redis singleton for rate-limit + telemetry + admin dashboard | `src/lib/redis.ts:1,36`; `scripts/replay-trace.mjs:25` | Server-only. Construction is wrapped in try/catch because the SDK throws a sync `UrlError` (`src/lib/redis.ts:29-39`) |
| `@vercel/analytics` | `^2.0.1` | prod | `<Analytics/>` beacon + imperative `track()` events | `src/app/layout.tsx:16,123`; `src/components/command-palette-content.tsx:11`; `src/components/game/terminal/terminal.tsx:4`; `src/components/game/terminal/use-terminal.ts:6` | Client-bundled. `va.vercel-scripts.com` is allow-listed in `script-src`/`connect-src` (`next.config.ts`) |
| `@vercel/speed-insights` | `^2.0.0` | prod | `<SpeedInsights/>` RUM beacon | `src/app/layout.tsx:17,124` | Client-bundled. `*.vercel-insights.com` allow-listed in `connect-src` |
| `@whatisjery/react-fluid-distortion` | `^1.6.3` | prod | `<Fluid/>` post-effect on the 3D voice orb | `src/components/chat/voice-orb-3d.tsx:6` — only import site | Client-bundled. Peers are all `'*'` (`pnpm-lock.yaml:2359-2365`) — no version guard from the package itself |
| `clsx` | `^2.1.1` | prod | Conditional class strings inside `cn()` | `src/lib/utils.ts:1,6` — only import site | Isomorphic; ships in both server and client graphs via `cn` |
| `cmdk` | `^1.1.1` | prod | Command palette primitives (`Command.Dialog/Input/List/Group/Item`) | `src/components/command-palette-content.tsx:12,610,633,650,713,718` — only import site | Client-bundled |
| `flags` | `^4.3.0` | prod | Vercel Flags SDK — `flag()` declaration + `verifyAccess`/`getProviderData` | `src/lib/flags.ts:10`; `src/app/.well-known/vercel/flags/route.ts:1-2` | Server-only (`src/lib/flags.ts:33` — "never from client components"). Reads `FLAG_DRIVER`, `FLAGS_SECRET` |
| `lucide-react` | `^1.31.0` | prod | Icon set, ~52 files | `src/app/articles/[slug]/page.tsx:4`; `src/app/projects/[slug]/page.tsx:9`; `src/app/resume/page.tsx:4`; `src/app/articles/page.tsx:5` (+48 more) | Client+server. Listed in `experimental.optimizePackageImports` (`next.config.ts`) |
| `mcp-handler` | `^1.1.0` | prod | `createMcpHandler` — wires 9 MCP tools to the `[transport]` route | `src/app/api/mcp/[transport]/route.ts:1,28` — only import site | Server-only. Pulls `redis@4.7.1`, `chalk`, `commander` (`pnpm-lock.yaml:8498-8500`); `disableSse: true` avoids its Redis init path (`route.ts:120-126`) |
| `motion` | `^12.40.0` | prod | Animation primitives (`motion`, `AnimatePresence`, `useScroll`) — ~21 files | `src/app/resume/page.tsx:5`; `src/app/articles/page.tsx:6`; `src/components/article-group-card.tsx:5`; `src/components/view-switcher.tsx:3` (+17 more) | Client-bundled via `motion/react`. In `optimizePackageImports`. Its runtime inline style attributes are cited as a reason `'unsafe-inline'` stays in CSP (`next.config.ts`) |
| `next` | `16.3.3` (EXACT) | prod | The framework | `src/proxy.ts:1-2`; `src/app/robots.ts:1`; `src/app/icon.tsx:1`; `src/components/hero-graph/index.tsx:3` — subpaths used: `next`, `next/server`, `next/og`, `next/dynamic`, `next/link`, `next/navigation`, `next/cache`, `next/font/google` | Exact pin; `eslint-config-next` matches it exactly. Carries `sharp@0.35.4` as an optional dep (`pnpm-lock.yaml:8903`) |
| `pdfjs-dist` | `^6.2.108` | prod | Client-side PDF text extraction for chat attachments | `src/components/chat/file-picker-button.tsx:77,79-82,84` (dynamic `await import`) | Client-bundled but **lazy** — only pulled after a PDF is selected. This is the high-severity arbitrary-JS-execution advisory fixed in 3.4.2 by a direct bump (6.0.227 → 6.2.108) |
| `postprocessing` | `^6.39.4` | prod | `BlendFunction` enum (peer of `@react-three/postprocessing`) | `src/components/chat/voice-orb-3d.tsx:5` — only import site | Client-bundled. **Peer constraint `three: >= 0.168.0 < 0.186.0`** (`pnpm-lock.yaml:4003`) — this is the ceiling on the `three` bump |
| `react` | `19.2.8` (EXACT) | prod | UI runtime | `src/app/error.tsx:35`; `src/app/not-found.tsx:21`; `src/app/resume/page.tsx:3`; `src/components/chat/voice-orb-3d.tsx:3` (+most components) | Exact pin, matched by `react-dom` |
| `react-dom` | `19.2.8` (EXACT) | prod | DOM renderer; `flushSync` for the view store | `src/components/view-context.tsx:12`; `src/app/layout.hydration-proof.dom.test.tsx:2-3` (`react-dom/server`, `react-dom/client`) | Exact pin. `vitest.config.ts` forces `NODE_ENV=test` specifically so React does not load its production bundle and strip `act` |
| `react-markdown` | `^10.1.0` | prod | Renders assistant text as a React vdom (never `dangerouslySetInnerHTML`) | `src/components/chat/markdown-message.tsx:4,7` — only import site | Client-bundled, itself lazily imported by `ask-portfolio.tsx:18` and `chat-messages.tsx:262` |
| `rehype-sanitize` | `^6.0.0` | prod | Defence-in-depth sanitizer (GitHub `defaultSchema`) on chat markdown | `src/components/chat/markdown-message.tsx:6` — only import site | Cited in `next.config.ts` CSP rationale as what makes `'unsafe-inline'`/`'unsafe-eval'` an accepted risk |
| `remark-gfm` | `^4.0.1` | prod | GFM tables/strikethrough in chat markdown | `src/components/chat/markdown-message.tsx:5` — only import site | Separate from Velite's own `mdx: { gfm: true }` (`velite.config.ts:128`) |
| `tailwind-merge` | `^3.6.0` | prod | Tailwind class-conflict resolution inside `cn()` | `src/lib/utils.ts:2,6` — only import site | Isomorphic |
| `three` | `^0.185.1` | prod | WebGL engine | `src/lib/r3f.ts:21`; `src/components/hero-graph/scene-physics.tsx:6`; `src/components/hero-avatar/rig.ts:4` (type-only); `src/components/hero-avatar/rig.test.ts:2` (type-only) | Client-bundled. **One** chunk after the 16.3.0 upgrade — `897,249` B (876.2 KiB), and a **Turbopack** measurement, not a webpack one (`next.config.ts:127-149`). Since this branch that is CI-asserted rather than merely recorded: `scripts/bundle-budget.mjs:62` fails the build if `WebGLRenderer` reaches any route's first-load set (0 of 16 routes today). Effective upper bound is `<0.186.0` from `postprocessing` |
| `use-stick-to-bottom` | `^1.1.6` | prod | Third-party auto-scroll engine, A/B'd against a custom hook | `src/lib/scroll/use-stick-to-bottom-library.ts:3,23` — only import site; consumed by `src/lib/scroll/use-auto-scroll.ts:5` | Client-bundled. Configured `resize: "instant", initial: "instant"` to opt OUT of its headline spring animation |
| `zod` | `^3.25.76` | prod | Runtime validation: MCP tool input schemas, `/api/error` payload, telemetry schema | `src/app/api/error/route.ts:1`; `src/lib/mcp-tools.ts:1,29-36`; `src/lib/telemetry/schema.ts:2` | **Server-only** — no client component imports `zod`. Note `velite.config.ts` uses Velite's own `s` builder (`velite.config.ts:1`), NOT this dependency |

### Removed in v3.5.0

**The two entries that took the prod count from 35 to 33.** Both were declared at v3.4.2 with **zero imports anywhere** and were deleted in v3.5.0 (`CHANGELOG.md:164-201`). They are kept here because several observations attached to them outlived the packages — do not read these rows as current dependencies, and note that **neither has a `package.json` line to cite any more**.

The removal was deliberately deferred until the `overrides` migration made lockfile regeneration safe, and it landed in the same commit (`ceae0d1`). Measured graph impact: **3 packages removed** (the two above plus `mitt`, which only `@react-three/rapier` pulled), 0 added, and exactly 1 version change — `@dimforge/rapier3d-compat` `0.19.2 → 0.12.0`, which is correct rather than drift, because `@types/three@0.185.4` requires 0.12.0 and is now its only consumer. The other ~60 lockfile entries that moved are peer-suffix rewrites at identical versions.

| package (removed) | was | prod/dev | what it was believed to do | verdict at v3.4.2 | what survives the removal |
|---|---|---|---|---|---|
| `@react-three/offscreen` | `^0.0.8` | prod | Worker/`OffscreenCanvas` offload for the hero graph — a claim that came from the declaration alone | **NO DIRECT IMPORT FOUND.** Searched `src/`, `e2e/`, `scripts/`, root configs, then the whole repo (excl. `node_modules`/`.next`/`.velite`/`.git`) for both `@react-three/offscreen` and bare `offscreen`/`Offscreen` | **The CSP outlived the dependency.** `next.config.ts:68` still emits `worker-src 'self' blob:` for a worker this app never created — the directive is now backed by nothing at all, not merely by an unimported package. Also: `CLAUDE.md:259-260` still files it under "**Two declared dependencies are not actually used**", which is stale twice over — it is not declared |
| `@react-three/rapier` | `^2.2.0` | prod | Physics for the `NEXT_PUBLIC_GRAPH_PHYSICS` hero-graph variant | **NO DIRECT IMPORT FOUND.** The flag-on path (`scene-physics.tsx`) is plain `useFrame` sinusoids, never a physics engine; `scene-physics.tsx:12` says so itself ("No RigidBody / Rapier needed for this effect") | **The flag name and filename are still historical**, and `src/components/hero-graph/index.tsx:13` still describes the package as "declared in package.json but imported nowhere in src/" — the *declared* half is no longer true. Graph effect: `@dimforge/rapier3d-compat` dropped from two copies to one, `0.12.0`, whose only remaining consumer is `@types/three` (`pnpm-lock.yaml:6709-6711`) |

### `devDependencies` (17)

| package | version spec | prod/dev | purpose in THIS app | import sites (path:line) | notes |
|---|---|---|---|---|---|
| `@next/bundle-analyzer` | `^16.3.3` (resolved 16.3.3) | dev | Wraps the exported Next config; emits `.next/analyze/{client,edge,nodejs}.html` — but **only on a `--webpack` build**, not on `ANALYZE=true` alone | `next.config.ts:5`, applied at `next.config.ts` final line `export default withBundleAnalyzer(nextConfig)` | Loaded via `createRequire(import.meta.url)` because the package is CJS-only. **STATUS CHANGE on this branch: CI-wired → local opt-in tool. Still a declared devDependency (`package.json:58`) — do not read it as removed.** Its sole invoker is now `pnpm analyze` (`package.json:12` = `velite --clean && ANALYZE=true next build --webpack`); `.github/workflows/bundle-analysis.yml`, which used to drive it, is deleted. The `--webpack` flag is load-bearing: a bare `next build` is Turbopack in Next 16 (`node_modules/next/dist/lib/bundler.js:142`, `:144`), and when `process.env.TURBOPACK` is set the analyzer warns "not compatible with Turbopack builds, no report will be generated" and returns `nextConfig` **untouched** — it never adds the `webpack` key (`node_modules/@next/bundle-analyzer/index.js:7-15`). So the deleted workflow's `ANALYZE=true` build emitted nothing for its entire life. The two code citations above are verified against the installed packages; the accompanying `CI=true pnpm analyze` run (exit 0, three HTML files) is the change author's measurement and **was not re-run here** — re-running it would overwrite `.next/`, and a `--webpack` build deliberately does not emit the diagnostics artifact `scripts/bundle-budget.mjs` needs |
| `@playwright/test` | `^1.61.1` | dev | E2E runner | `playwright.config.ts:1`; `e2e/views.spec.ts:1`; `e2e/resume.spec.ts:1` | CI pins the browser download to the installed version (`ci.yml`: `pnpm exec playwright install --with-deps chromium`) to avoid the "Executable doesn't exist" mismatch |
| `@tailwindcss/postcss` | `^4` (resolved 4.3.3) | dev | The only PostCSS plugin | `postcss.config.mjs:3` | Tailwind v4 entry point; there is no `tailwind.config.*` file in the repo |
| `@testing-library/dom` | `^10.4.1` | dev | Required (non-optional) peer of `@testing-library/react` | **NO DIRECT IMPORT FOUND** | Searched `src/`, `e2e/`, `scripts/`, root configs for `from "@testing-library/dom"` — zero matches. Declared to satisfy the peer at `pnpm-lock.yaml:1809` |
| `@testing-library/react` | `^16.3.3` | dev | `render`/`screen`/`renderHook`/`act` in the `dom` vitest project | `src/app/layout.hydration-proof.dom.test.tsx:4`; `src/components/ask-portfolio.dom.test.tsx:2`; `src/components/chat/use-chat-stream.dom.test.tsx:2`; `src/components/site-footer.dom.test.tsx:2` (+more `*.dom.test.tsx`) | Its `renderHook` is the exact reason `vitest.config.ts` forces `NODE_ENV=test` |
| `@types/node` | `^26` (resolved 26.4.0) | dev | Node type definitions (`node:crypto`, `process`, `__dirname`) | **NO DIRECT IMPORT FOUND** (ambient) | Consumed ambiently by `tsconfig.json`. Bumped `^20 → ^26` in 3.4.1 (`CHANGELOG.md:276`) |
| `@types/react` | `^19` (resolved 19.2.18) | dev | React type definitions | **NO DIRECT IMPORT FOUND** (ambient) | Also an optional peer threaded through `drei`/`cmdk`/`radix` resolutions |
| `@types/react-dom` | `^19` (resolved 19.2.5) | dev | react-dom type definitions | **NO DIRECT IMPORT FOUND** (ambient) | Optional peer of `@testing-library/react` (`pnpm-lock.yaml:1811,1817-1818`) |
| `eslint` | `^9` (resolved 9.39.4) | dev | Linter; `pnpm lint` = bare `eslint` | `eslint.config.mjs:1` (`eslint/config`); inline directives e.g. `src/components/site-footer.tsx:36`, `src/app/work/[slug]/page.tsx:130` | Major upgrade explicitly blocked — see `.github/dependabot.yml` ignore + `CHANGELOG.md:296-299` |
| `eslint-config-next` | `16.3.3` (EXACT) | dev | Next core-web-vitals + TS rule sets | `eslint.config.mjs:2-3` | Exact pin held in lockstep with `next` |
| `happy-dom` | `^20.12.0` | dev | DOM environment for the `dom` vitest project | **NO DIRECT IMPORT FOUND** | Referenced by name only: `vitest.config.ts:43` (`environment: "happy-dom"`). Prose references in `src/components/chat/voice-pitfalls.test.ts:14`, `use-chat-stream.dom.test.tsx:25` are comments, not imports |
| `pagefind` | `^1.5.2` | dev | Builds the static search index consumed by `/search` | **NO npm-level import** — invoked as a CLI at `Makefile:66` (`pnpm pagefind --site .next/server/app --output-path public/pagefind`) | `src/app/search/page.tsx:20,25` loads `/pagefind/pagefind-ui.css` + `.js` by injected tag, from `public/`, not from `node_modules`. There is **no `search-index` npm script**; the real entry point is `make search-index`. `CLAUDE.md` used to print `pnpm search-index` under "After build: generate Pagefind search index" — **FIXED**: `CLAUDE.md:37-39` now carries the explicit note "this is a Makefile target only — there is NO `pnpm search-index` script" and shows the `make search-index` line instead |
| `tailwindcss` | `^4` (resolved 4.3.3) | dev | CSS framework | `src/app/globals.css:1` (`@import "tailwindcss"`) | v4 CSS-first: no JS config file exists. `experimental.inlineCss` in `next.config.ts` is described there as targeting exactly this case |
| `typescript` | `^5` (resolved 5.9.3) | dev | Type checker (`npx tsc --noEmit` in CI) | `tsconfig.json`; `next-env.d.ts:7`; inline `@typescript-eslint` directives e.g. `src/lib/llm.ts:322`, `src/lib/telemetry/with-trace.ts:10` | Major (7.x) held back — `@typescript-eslint/typescript-estree@8.61.0` crashes on load under 7.0.2 while `tsc --noEmit` itself is clean (`.github/dependabot.yml`; `CHANGELOG.md:291-295`) |
| `velite` | `^0.4.0` | dev | MDX → typed `.velite/` collections | `velite.config.ts:1`; `next.config.ts:15` (`import("velite").then(({ build }) => build({ watch: true, clean: false }))`); referenced by the `predev`/`build`/`content` scripts | Pulls `esbuild@0.25.12` + `sharp@0.35.3` + `terser` (`pnpm-lock.yaml:9905-9910`). `src/lib/content.ts:14` imports the **generated output** `"../../.velite"`, not the package |
| `vitest` | `^4.1.11` | dev | Unit/DOM test runner; chained into `pnpm build` | `vitest.config.ts:1` (`vitest/config`); `src/lib/llm.test.ts`, `src/app/api/error/route.test.ts:1`, `src/app/api/tts/cache.test.ts:1`, `src/app/layout.hydration-proof.dom.test.tsx:1` (+all `*.test.*`) | Vitest 4.1.11 resolves **Vite 8.0.16** (`pnpm-lock.yaml:172`) |
| `web-vitals` | `^6.1.1` (resolved 6.1.1, `pnpm-lock.yaml:4703`) | dev | LCP/INP/CLS field reporting to Vercel Runtime Logs | `src/instrumentation-client.ts:50` (`import("web-vitals").then(({ onLCP, onINP, onCLS }) => …)`) | **Notable (1):** a `devDependency` dynamically imported from a file Next bundles into the CLIENT runtime. It resolves because pnpm installs dev deps at build time on Vercel, but it is not a production dependency by declaration. **Notable (2):** v3.5.0 took this across a **semver major** (`^5.3.0 → ^6.1.1`) via Dependabot — the only major in the release. The call site still destructures the v5 names `onLCP`/`onINP`/`onCLS`, and `tsc --noEmit` plus `vitest` passed the release gate, so the three-export surface survived; **UNVERIFIED** beyond that, because a full v6 API review was not part of the bump |

## Runtime split

**Server-only (never in a client chunk).** Every one of these is reached exclusively from a Route Handler, a Server Component, a non-`"use client"` lib module, or a build step:

- `@anthropic-ai/sdk`, `@anthropic-ai/bedrock-sdk` — entered only through `src/lib/llm.ts` (no `"use client"`; first line is the SDK import), which is imported by `/api/chat`, `/api/tts` and `/api/transcribe`.
- `@aws-sdk/client-polly` (`src/app/api/tts/route.ts:1`), `@aws-sdk/client-transcribe-streaming` (`src/app/api/transcribe/route.ts:1-5`). `next.config.ts` states this explicitly in the CSP rationale: *"Bedrock/Polly/Transcribe are called SERVER-side, so the browser never connects to AWS"* — which is why `connect-src` contains no AWS host.
- `@upstash/redis` / `@upstash/ratelimit` — `src/lib/redis.ts:1` and `src/lib/rate-limit.ts:1` (both plain modules), plus `src/app/api/visit/route.ts:3` and the standalone `scripts/replay-trace.mjs:25`.
- `mcp-handler` + `@modelcontextprotocol/sdk` — only `src/app/api/mcp/[transport]/route.ts`. The route comment at `:4-8` states the SDK "transitively needs Node (express/hono) — never edge". `disableSse: true` (`:126`) is what keeps `mcp-handler`'s Redis init (and `redis@4.7.1`) off the executed path.
- `flags` — `src/lib/flags.ts:10` and `src/app/.well-known/vercel/flags/route.ts:1-2`. `src/lib/flags.ts:33` documents "Call from a Server Component or a Route Handler (never from client components)".
- `zod` — three sites (`api/error/route.ts:1`, `lib/mcp-tools.ts:1`, `lib/telemetry/schema.ts:2`). `telemetry/schema.ts:1` also imports `node:crypto`, so it can never be client-bundled; its only non-route consumer is the async Server Component `src/app/admin/telemetry/page.tsx:14`.
- `velite` — build/dev only (`velite.config.ts`, and the dev-guarded dynamic import at `next.config.ts:12-16`). `next.config.ts:13` gates it on `process.argv.includes("dev")`.
- `@next/bundle-analyzer`, `@playwright/test`, `@tailwindcss/postcss`/`tailwindcss`, `typescript`, `eslint*`, `happy-dom`, `@testing-library/*`, `@types/*`, `pagefind` — tooling; never in any app graph. `@next/bundle-analyzer` is the one whose *reach* narrowed on this branch: it is still `require`d on every build (`next.config.ts:5`) but only does work under `pnpm analyze`'s `--webpack`.

**Client-bundled.**

- The R3F/WebGL cluster — `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `postprocessing`, `@whatisjery/react-fluid-distortion`. All funnel through `src/lib/r3f.ts` (the one exception is `hero-graph/scene-physics.tsx:4-6`, which imports `@react-three/fiber` and `three` directly). Every consumer is `"use client"` and mounted behind `next/dynamic(..., { ssr: false })` (`src/components/hero-graph/index.tsx:16-18` — the `HeroGraphScene` flag-switched loader). `next.config.ts:133-144` records that after the 16.3.0 upgrade three.js occupies exactly ONE 876 KB chunk (down from two) — `897,249` B, measured under **Turbopack** — and `:149` that `src/lib/r3f.ts` "is load-bearing for the single-copy outcome"; `:127-131` that `three`/`fiber`/`drei` are deliberately **excluded** from `optimizePackageImports`. **New on this branch: that "one copy, and off the critical path" claim is now a CI gate, not just a comment.** `scripts/bundle-budget.mjs:124-127` greps every deduplicated first-load chunk for `WebGLRenderer` and fails if it appears — today it appears in exactly one chunk and in **0 of the 16 routes'** first-load sets. This is the assertion a total-byte budget cannot make: an eager `import * as THREE` in a shell component would move ~876 KB onto every route's critical path while total emitted bytes barely moved (`scripts/bundle-budget.mjs:47-62`).
- `motion`, `lucide-react`, `cmdk`, `@radix-ui/react-dialog`, `react-markdown`, `remark-gfm`, `rehype-sanitize`, `use-stick-to-bottom`, `@vercel/analytics`, `@vercel/speed-insights`.
- Lazy client chunks (declared prod/dev but loaded on demand, never in first-load JS): `pdfjs-dist` (`file-picker-button.tsx:77`), `web-vitals` (`instrumentation-client.ts:50`, guarded by `typeof window !== "undefined"` at `:46`).
- Isomorphic: `clsx` + `tailwind-merge` via `cn()` (`src/lib/utils.ts`), `react`/`react-dom`, `next`.

**Edge runtime.** `src/proxy.ts:1-2` imports only `next/server`. Per `CLAUDE.md`, it is the Edge auth gate for `/admin/*` and uses Web Crypto rather than `node:crypto` — no third-party dependency is reachable from it.

**Declared but unreachable.** `@modelcontextprotocol/sdk` (peer-only), `@types/three` / `@types/node` / `@types/react` / `@types/react-dom` (ambient), `@testing-library/dom` (peer-only), `happy-dom` (config string), `pagefind` (CLI). **The "declared but imported nowhere at all" category is now empty** — `@react-three/offscreen` and `@react-three/rapier` were its only two members and both were removed in v3.5.0 (`CHANGELOG.md:164-201`). Every remaining entry above is unreachable *by import* but load-bearing by some other mechanism (peer resolution, ambient types, a config string, or a CLI invocation), so none of them is a deletion candidate.

**`@next/bundle-analyzer` does NOT belong in the list above, and this branch is the moment someone is most likely to file it there wrongly.** Deleting `.github/workflows/bundle-analysis.yml` removed its only *automated* caller, not its import site: `next.config.ts:5` `require`s it and `withBundleAnalyzer(nextConfig)` runs on **every** `next build` and `next dev`, CI included. It is reachable by import and executed unconditionally; what is opt-in is only its *effect*, gated on `--webpack` via `pnpm analyze`. So the correct classification is **declared, imported, executed, and inert by default** — a fourth category this section did not previously need. It is not a deletion candidate either, but for a different reason from the peer-only and ambient-type entries: removing it breaks `next.config.ts` at module load.

## Version pins & overrides

> **Two of the four blocks in this section moved in v3.5.0, and a fourth was added after it.** `overrides` and `onlyBuiltDependencies` used to live in `package.json`'s `pnpm` field; that field is gone and `pnpm-workspace.yaml` is now the only place pnpm reads them from. `ignoredBuiltDependencies` was already there. `allowBuilds` is the pnpm 11 successor to the two build-script lists; it shipped in v3.6.0 (`CHANGELOG.md:11-51`), so `package.json:3` reads `3.6.0`. The move was security-motivated, not cosmetic — see the `overrides` subsection below.

### `onlyBuiltDependencies` (`pnpm-workspace.yaml:60-61`)

`["esbuild"]` — pnpm 10 refuses to run install scripts unless a package is on this allowlist. `esbuild@0.25.12` is a **direct dependency of `velite@0.4.0`** (`pnpm-lock.yaml:9905-9908`) and needs its postinstall to fetch/link the platform binary, so content generation would fail without it. `vite@8.0.16` declares `esbuild: ^0.27.0 || ^0.28.0` as an *optional* peer (`pnpm-lock.yaml:4797,4811`) — that peer is unsatisfied by 0.25.12 and is not being relied on.

### `ignoredBuiltDependencies` (`pnpm-workspace.yaml:64-66`)

`[sharp, unrs-resolver]` — the inverse list; these two natives are installed *without* running their build scripts. Two `sharp` versions are in the graph: `next@16.3.3` pulls `sharp@0.35.4` (optional dep, `pnpm-lock.yaml:8903`) and `velite@0.4.0` pulls its own `sharp@0.35.3` (`:9909`); `unrs-resolver@1.12.2` comes from `eslint-import-resolver-typescript@3.10.1` (`:7561,7570`). This is the one block that always lived in `pnpm-workspace.yaml` — introduced in the repo's initial commit (`git log -S ignoredBuiltDependencies` → `ee0fc1e Initial commit from Create Next App`), which is also why the file already existed for the other two to move into.

### `allowBuilds` (`pnpm-workspace.yaml:71-74`) — pnpm 11's replacement for both lists above

`{esbuild: true, sharp: false, unrs-resolver: false}` — a boolean map that supersedes the two list-based keys. **The allowlist is deliberately spelled twice, once per pnpm major**, because CI pins pnpm 10 (`.github/workflows/ci.yml`) while `pnpm install` on a contributor machine resolves to pnpm 11; dropping either spelling breaks one of them. The two must be kept in sync, which is the one place in this repo where duplication is the correct answer.

pnpm 11 still *reads* the old keys — `pnpm config get onlyBuiltDependencies` returns `["esbuild"]` — but `allowBuilds` takes precedence, and when it is **absent pnpm 11 writes it into this tracked file itself**, seeded with the literal placeholder `set this to true or false`. That string is neither `true` nor `false`, so every listed package is treated as denied and the install aborts:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.25.12, unrs-resolver@1.12.2
```

Measured before the fix: `pnpm install --frozen-lockfile` **exit 1 on pnpm 11.17.0** from a clean clone (and it dirtied `pnpm-workspace.yaml`), **exit 0 on pnpm 10.34.5**. Because CI pins pnpm 10 the failure was invisible to every green run and reached only contributors on the current default pnpm — the same shape of blind spot as the `pnpm`-field migration one release earlier, and a reminder that *CI passing* and *the repo installing* are different claims.

### `overrides` (`pnpm-workspace.yaml:18-28`) — 10 entries, added in v3.4.2, relocated in v3.5.0

Every override exists to resolve a Dependabot advisory on a **transitive, lockfile-pinned** package. Root cause per commit `2f309d2`: `@modelcontextprotocol/sdk` is pinned exactly to `1.26.0` while 1.30.0 exists, so Dependabot could not walk the chain and reported `security_update_not_possible`; `pnpm update --depth Infinity` also could not move them. All ten are mirrored into `pnpm-lock.yaml:7-17`.

**Why they moved in v3.5.0, and why it counts as a security fix.** pnpm 11 no longer reads the `pnpm` field of `package.json` — it prints "The \"pnpm\" field in package.json is no longer read by pnpm" and skips it. So on pnpm 11 these ten security-load-bearing pins were being **ignored**. Nothing had broken yet: CI pins pnpm 10 and `pnpm-lock.yaml` already encoded the resolutions, so the resolved graph was correct — but a single `pnpm install` on pnpm 11 would have regenerated the lockfile *without* the `overrides:` block and silently reverted v3.4.2, signalled only by a warning line that reads like boilerplate. Both pnpm 10 and 11 read `pnpm-workspace.yaml`, so it is now the single source of truth that works on either. `CHANGELOG.md:184-188,190-194` records the verification: the lockfile was regenerated with each pnpm major (**byte-identical** both times) and all ten pins confirmed applied in the resolved graph rather than merely declared. The file's own header (`pnpm-workspace.yaml:1-12`) carries the same rationale, and `:15-17` marks the block "SECURITY-LOAD-BEARING. Do not remove one without confirming the advisory is closed by the resolved graph".

| Override key | Spec | Resolved | Severity & advisory (per `2f309d2` / `0bff457` / `CHANGELOG.md:206-231`) | Reachability as assessed in-repo |
|---|---|---|---|---|
| `hono` | `^4.12.34` | 4.13.2 | medium ×3 + low ×1 — `memo()` retained SSR output across requests (cross-user data disclosure); ReDoS in CORS middleware; algorithmic-complexity DoS in Language middleware; Proxy Helper leaks `Connection`-listed headers | MCP route only. **Minor** bump (4.12.25 → 4.13.2), the largest jump in the batch, so it was tested live: `tools/list` returned all 9 tools over Streamable HTTP |
| `@hono/node-server` | `^1.19.15` | 1.19.17 | medium — `serve-static` path traversal via `%5C` | MCP route only; Windows-specific, production is Linux on Vercel |
| `ip-address` | `^10.3.1` | 10.5.0 | **high** — `Address4` decodes leading-zero octets as decimal while resolvers decode octal → SSRF / trust-boundary bypass | `mcp-handler` → `@modelcontextprotocol/sdk` → `express-rate-limit`. Server-side only; commit notes "0 client chunks contain ip-address". `express-rate-limit` already declared `ip-address: ^10.2.0`, so the override only re-resolves inside a blessed range |
| `fast-uri` | `^3.1.5` | 3.1.5 | **high** — host confusion via backslash authority introducer | Transitive under the MCP/validation chain |
| `js-yaml` | `^4.3.1` | 4.3.1 | **high** — quadratic CPU consumption (DoS) in `!!omap` resolution | devDependency chain (build-time) |
| `postcss` | `^8.5.23` | both instances converged to 8.5.26 (`pnpm-lock.yaml:4158,9448`) | medium/high — attacker-controlled `sourceMappingURL` reads arbitrary `.map` files when `from` is unset | Build-time; resolved above the override floor, single version now |
| `brace-expansion@1` | `^1.1.16` | 1.1.18 | **high** — advisory scope `<1.1.16` | eslint tooling chain (dev). Version-scoped on purpose |
| `brace-expansion@>=3` | `^5.0.7` | 5.0.9 | **high** — advisory scope `>=3.0.0 <5.0.7` | Same chain. Split into two keys because a blanket `^5.0.7` would force `minimatch@3` (which requires the 1.x line) onto 5.x and break eslint. Verified: 1.1.18 and 5.0.9 coexist |
| `sharp` | `^0.35.0` | 0.35.3 | **high** | Two instances existed; `next@16.3.0` already carried patched 0.35.3, only `velite`'s 0.34.5 was vulnerable — build-time image processing of the repo's own content. Because it is a native module, `.velite` was wiped and regenerated to prove it: exit 0, work=5 / projects=11 / articles=15 / notes=5 |
| `body-parser` | `^2.3.0` | 2.3.0 | low | `express@5.2.1` via `@modelcontextprotocol/sdk` — MCP route only |

**Not an override, but part of the same fix:** `pdfjs-dist` was raised as a **direct** dependency bump `6.0.227 → ^6.2.108` (**high**, arbitrary JS execution on opening a malicious PDF) because it is genuinely client-reachable at `file-picker-button.tsx:77`.

**Advisory-count correction recorded in the log.** Commit `2f309d2` claimed "10 open advisories"; `0bff457` corrects it — the API query used `per_page=10` and silently capped, and the true figure is **23 alerts across 10 unique packages**. The v3.4.2 release commit (`a848117`) is titled "security patch, ships 23 advisory fixes to production", and `CHANGELOG.md:208-209` states production had been serving the vulnerable versions because the fixes sat on `develop` (Preview only).

### Exact (caret-less) pins, and why

| Package | Pin | Reason (cited) |
|---|---|---|
| `next` / `eslint-config-next` | `16.3.0` | Held in lockstep so the lint ruleset matches the framework |
| `react` / `react-dom` | `19.2.8` | Kept identical to each other; bumped as a pair in 3.4.1 (`CHANGELOG.md:263`) |
| `@react-three/postprocessing` | `3.0.4` | 3.0.5 types-only regression: `ChromaticAberration` props are `Omit<Partial<ConstructorParameters<...>[0]>, 'offset'>`, the ctor param is optional so the type includes `\| undefined`, `keyof` of that union collapses to `never`, and every real prop is erased. Runtime is fine — only `tsc` catches it. A version-scoped Dependabot `ignore` for `["3.0.5"]` accompanies the pin so 3.0.6+ still flows |
| `@modelcontextprotocol/sdk` | `1.26.0` | `mcp-handler@1.1.0`'s peer range is the single literal version `1.26.0` (`pnpm-lock.yaml:3580`). This pin is the direct cause of the `security_update_not_possible` failures |

## Framework version notes

**Next 16.3.0.** `CLAUDE.md` opens with a standing warning that Next 16 APIs differ from training data and to consult `node_modules/next/dist/docs/`. Version-sensitive code found:

- `experimental.viewTransition` was **removed** in the 16.3.0 upgrade (`next.config.ts`): it no longer exists in Next's `ExperimentalConfig` (absent from `config-schema.js` and the types), so leaving it was a hard typecheck failure. The comment records it as a no-op for this app — the four-view transition uses native `document.startViewTransition` + `::view-transition-*` CSS, not React's `<ViewTransition>`.
- `experimental.cacheComponents: true` supersedes `experimental.ppr` / `experimental_ppr` / `dynamicIO` / `useCache`. Enabling it failed the build with exactly **26 errors** across 22 files: 13 × `runtime`, 4 × `revalidate`, 9 × `dynamic = "force-dynamic"`. The RSC transform rejects the mere *presence* of `export const runtime` (the `"runtime" =>` arm never inspects `decl.init`), so `"nodejs"` and `"edge"` are indistinguishable to it — and since `nodejs` is already the default, the remedy was deletion. `maxDuration` and `preferredRegion` are **not** rejected, which is why `maxDuration = 30` survives at `src/app/api/mcp/[transport]/route.ts:9` (and 15 / 20 / 5 on tts / transcribe / error).
- Two constraints `cacheComponents` imposes: `generateStaticParams` must return ≥1 result, and synchronous IO (`new Date()`, `Date.now()`) fails prerender and cannot be deferred with `instant = false`. Hence the build-time constant `env: { NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()) }` in `next.config.ts` for the footer.
- `turbopack: { root: __dirname }` pins the workspace root because multiple lockfiles exist on the machine. **RETRACTED on this branch — this entry previously asserted the exact opposite of the truth.** It recorded, sourced to `.github/workflows/bundle-analysis.yml`'s own comment and flagged **UNVERIFIED**, that "`next build` still uses **webpack** by default in Next 16 (Turbopack being opt-in via `--turbopack`, dev-only), which is what lets `@next/bundle-analyzer` hook the build at all". That is **false**, and it is now verified false against the installed Next rather than left unverified: with no bundler flag set, `next build` sets `process.env.TURBOPACK = 'auto'` — `node_modules/next/dist/lib/bundler.js:142` comments "The default is turbopack when nothing is configured" and `:144` performs it. In Next 16 **webpack is the opt-in** (`next build --webpack`), not Turbopack. The workflow that carried the false comment is deleted, so the claim is retracted rather than re-cited. It mattered in three directions, all now settled: (a) the `turbopack:` key above applies to `next build`, not merely to `next dev`; (b) `@next/bundle-analyzer` produced nothing at all under that workflow and needed `--webpack` added to `pnpm analyze` to work — see its `devDependencies` row; (c) `.next/diagnostics/route-bundle-stats.json`, the artifact `scripts/bundle-budget.mjs` gates on, exists **because** the shipping build is Turbopack, and would vanish if anyone "fixed" the build back to webpack.
- `experimental.optimizePackageImports: ["lucide-react", "motion"]` only — `three`/`fiber`/`drei` are deliberately excluded, with the comment recording that the C-3 investigation disproved the flag for the R3F twin-chunk and that the `src/lib/r3f.ts` barrel is the correct fix. **The retraction above does not touch any of this.** `next.config.ts:128-129` already attributes the C-3 finding to Turbopack in so many words ("confirmed this flag does NOT collapse / the R3F twin-chunk in Turbopack"), so the 876 KB measurement block at `:133-144` was always a genuine Turbopack measurement — independently confirmed at `897,249` B by `scripts/bundle-budget.mjs`. Only the *bundler attribution* in the retracted entry was wrong; the one-copy chunk invariant and `src/lib/r3f.ts`'s load-bearing role both **stand**, and are now enforced rather than merely documented.

**React 19.2.8.** Exact-pinned with `react-dom`. Two version-sensitive spots: `src/components/view-context.tsx:12` imports `flushSync` from `react-dom` for the external-store view switch, and `vitest.config.ts` forces `NODE_ENV=test` because on Vercel the build shell sets `NODE_ENV=production`, which makes React load its production bundle, strip `act`, and crash `@testing-library/react`'s `renderHook` with "React.act is not a function" — failing the deploy.

**Tailwind v4.** No `tailwind.config.*` file exists. The entry point is CSS-first: `src/app/globals.css:1` is `@import "tailwindcss"`, and `postcss.config.mjs:3` lists `@tailwindcss/postcss` as the sole plugin (both `tailwindcss` and `@tailwindcss/postcss` resolve to 4.3.0). `next.config.ts` notes `experimental.inlineCss: true` because "Tailwind v4 is the exact use case this flag targets". One v4 consequence is recorded in source: `src/components/game/easter-eggs.tsx:133` — "Tailwind v4 here has no `tailwindcss-animate`, so those silently no-op".

**Zod v3 (`^3.25.76`).** Both consumers that constrain it accept v4 as well: `@anthropic-ai/sdk`'s peer is `zod: ^3.25.0 || ^4.0.0` (optional) and `@modelcontextprotocol/sdk@1.26.0`'s is `zod: ^3.25 || ^4.0` (`pnpm-lock.yaml:911`). `src/lib/mcp-tools.ts:29-36` exports **raw-shape** schemas (plain objects of `z.*` fields, not `z.object(...)`) because that is what `mcp-handler`'s `registerTool` takes. Whether a v4 migration would break that raw-shape handoff is **UNVERIFIED**. Note the content pipeline does *not* use this dependency: `velite.config.ts:1` imports Velite's own `s` builder.

**Vitest 4.1.11.** Resolves **Vite 8.0.16** (`pnpm-lock.yaml:172`). Two version-gated config choices: `resolve: { tsconfigPaths: true }` (`vitest.config.ts:17`) is documented as "native in Vite 6+" and is what resolves both `@/*` and the relative `.velite` import so tests exercise the real shipping modules; and `test.projects` (`:27`) is the modern replacement for the old workspace file. The `node` project excludes `**/*.dom.test.{ts,tsx}` so happy-dom globals never leak into pure tests. `pnpm build` = `velite --clean && vitest run && next build`, so a failing test blocks the deploy.

**Playwright 1.61.1.** `playwright.config.ts` declares one `chromium` project and a `webServer` block running `pnpm start` with `reuseExistingServer: !process.env.CI` and a 120 s timeout. The comment records the failure mode this fixed: previously a stale server on `:3000` meant Playwright "silently tested whatever was listening — an older build", producing 5 spurious failures during a release audit. CI installs the browser with `pnpm exec playwright install --with-deps chromium` and comments that a version/browser mismatch fails with "Executable doesn't exist at .../chromium_headless_shell-<rev>".

**Blocked majors (Dependabot `ignore`, `.github/dependabot.yml`).**
- `typescript` semver-major — `@typescript-eslint/typescript-estree@8.61.0` crashes on load under `typescript@7.0.2` with `TypeError: Cannot read properties of undefined (reading 'Cjs')` at `typescript-estree/dist/create-program/shared.js:59`. Reproduced with `eslint` pinned at 9.39.4, so it is not the ESLint 10 issue; `tsc --noEmit` under 7.0.2 is clean, so only the lint toolchain fails.
- `eslint` semver-major — `eslint-plugin-react` calls APIs removed in 10 (`sourceCode.getJSDocComment`, no replacement), and `eslint-config-next`'s vendored Babel 7 `@babel/eslint-parser` lacks `ScopeManager#addGlobals` with Babel having ruled out ESLint 10 support in 7. Re-check trigger recorded as `jsx-eslint/eslint-plugin-react#4022`.
- Both ignores were initially added on `develop` and were **inert**, because Dependabot reads `dependabot.yml` from the default branch only; commit `6cbff5d` propagated them to `main`.

**Three.js ceiling.** `three` is `^0.185.1`, but `postprocessing@6.39.4` declares `three: >= 0.168.0 < 0.186.0` (`pnpm-lock.yaml:4003`). A bump to 0.186.x therefore breaks that peer, and the `three-webgl` Dependabot group batches `three`, `@react-three/*`, `@types/three`, and `postprocessing` together so the constraint is reviewed as a unit.

**Node / package-manager versions.** New in v3.5.0: `package.json` now declares `engines: { node: ">=22 <23" }` (`package.json:5-7`) and a `.nvmrc` containing the single line `22`. Both match the CI pin — `.github/workflows/ci.yml:27` and `:89` set `node-version: 22`, and `pnpm/action-setup` is pinned to `version: 10` (`:22`, `:84`). There is still **no `packageManager` field** and **no `.npmrc`** — the `packageManager` omission is deliberate per the migration commit `ceae0d1`, which records that adding it would make every local command resolve a specific pnpm through corepack (a workflow change, not part of this fix).

`CHANGELOG.md:178-181` records why the pin was added: without it a contributor on Node 26 got 9 failing tests and a red `pnpm build` with no explanation — Node exposes a native `localStorage` that is unavailable without `--localstorage-file`, and it collides with vitest's happy-dom global injection. So `engines.node` here is a **test-suite** constraint, not a runtime one.

**The CI/production Node split still exists, and `engines` now contradicts production.** The (gitignored) `.vercel/project.json` records `"nodeVersion": "24.x"` for the deployment — outside the declared `>=22 <23` range. This does not fail anything: `engine-strict` is not set anywhere, so pnpm **warns** rather than errors on a range violation, and the migration commit `ceae0d1` says so explicitly ("`engines` warns rather than errors (no `engine-strict`), so it informs without blocking"). The consequence is narrower but real — before v3.5.0 the manifest was silent about Node; it now states a range that production is outside of, so the declaration should not be read as describing the deployment.

## Detail

### `package.json`
- **Role:** the manifest under index. As of v3.5.0 it carries **no** pnpm control blocks — it is scripts + `engines` + the two dependency maps and nothing else.
- **Exports:** n/a.
- **Reads / depends on:** nothing (data file).
- **Consumed by:** pnpm, all **12** npm scripts, `next.config.ts` (indirectly via `ANALYZE`, which since this branch only the `analyze` script sets — `:12`), Dependabot.
- **Behaviour notes:** the `build` script is ordered `velite --clean && vitest run && next build` (`package.json:11`) — content generation, then tests as a deploy gate, then compile, and it ends in a **bare** `next build`, i.e. Turbopack. `predev` runs bare `velite` (no `--clean`) at `:9`; `CLAUDE.md` explains that passing `--clean` in dev races **Turbopack** against a momentarily deleted `.velite/projects.json` (`next.config.ts:11`'s own comment still says "races webpack" — the race is real, the bundler name is stale there). `lint` is bare `eslint` with no `--fix` (`:14`). `analyze` is new at `:12` — `velite --clean && ANALYZE=true next build --webpack` — and is the only script that does **not** run the shipping bundler. `engines.node` is `">=22 <23"` (`:5-7`).
- **Gotchas / invariants:** (1) There is **no `search-index` npm script**; the real target is `make search-index` (`Makefile:64-66`). `CLAUDE.md` previously documented a non-existent `pnpm search-index` here — **FIXED**: `CLAUDE.md` now states "this is a Makefile target only — there is NO `pnpm search-index` script". (2) `@types/three` sits in `dependencies` (`:32`), not `devDependencies` — moving it would not break the build (Vercel installs dev deps) but is a deliberate-looking placement, and since v3.5.0 it is the only reason `@dimforge/rapier3d-compat` is still in the graph. (3) `web-vitals` sits in `devDependencies` (`:74`) yet is dynamically imported from client-bundled `src/instrumentation-client.ts:50`. (4) The caret-less pins at `:27,31,44,47,48,67` are load-bearing — six lines, four rows in the pins table above. (5) **Do not add settings back to a `pnpm` field here.** The field was deleted in v3.5.0 and pnpm 11 would not read it; `pnpm-workspace.yaml` is the only location both pnpm 10 and 11 honour. A settings block re-introduced in this file would be silently ignored on pnpm 11, which is exactly the failure mode v3.5.0 closed. (6) **Do not drop `--webpack` from the `analyze` script (`:12`).** Without it the script is a slow no-op: `ANALYZE=true` sets the analyzer's `enabled`, but Turbopack makes it bail with a warning and no report (`node_modules/@next/bundle-analyzer/index.js:7-15`), which is precisely how the deleted `bundle-analysis.yml` stayed ran 222 times (211 green, 11 red) and produced zero artifacts, ever. Conversely, **do not add `--webpack` to `build` (`:11`)**: a webpack build does not emit `.next/diagnostics/route-bundle-stats.json`, so `scripts/bundle-budget.mjs` would fail the `e2e` job — by design, with a message naming `--webpack` as the cause (`scripts/bundle-budget.mjs:73-77`). The two flags are mutually exclusive on purpose; keep the tool and the gate on separate scripts.

### `next.config.ts`
- **Role:** the only place the **two** build-wired dev deps are hooked up (`@next/bundle-analyzer`, `velite`) plus every framework-version decision. (This line previously said "three" while naming two; two is what the file actually imports.)
- **Exports:** `default` — `withBundleAnalyzer(nextConfig)`.
- **Reads / depends on:** `@next/bundle-analyzer` (CJS, loaded via `createRequire(import.meta.url)` at `:4-7`), `velite` (dynamic, dev-only, `:12-16`); env `ANALYZE`, `VELITE_STARTED`. `ANALYZE` now has exactly one setter in the repo — the `analyze` script (`package.json:12`); nothing in CI sets it any more.
- **Consumed by:** `next build` / `next dev` — both Turbopack by default (`node_modules/next/dist/lib/bundler.js:142`, `:144`) — and `pnpm analyze` (`package.json:12`), which is the only invocation that reaches the webpack branch. The former third consumer, `.github/workflows/bundle-analysis.yml`, is **deleted**.
- **Behaviour notes:** the Velite watcher is double-guarded — `process.argv.includes("dev")` **and** a `VELITE_STARTED` sentinel so it starts once. `optimizePackageImports` is restricted to `["lucide-react", "motion"]`. `cacheComponents: true` is the single key superseding the older PPR/dynamicIO flags.
- **Gotchas / invariants:** the CSP keeps `'unsafe-eval'` in **both** dev and production because `MDXContent` evaluates Velite-generated MDX function-body strings with `new Function(code)` on every MDX page — the comment states removing it "crashes all project/work/note pages with a React render-error boundary". `'unsafe-inline'` is attributed in part to Motion's runtime style attributes, which nonces cannot cover. Re-adding `three`/`@react-three/*` to `optimizePackageImports` is explicitly called out as re-introducing a disproven optimization against the live `src/lib/r3f.ts` barrel. Also: **the `withBundleAnalyzer` wrap at `:5-7` is not evidence that this build is analysed.** The wrap runs on every build, but under Turbopack the analyzer returns the config unchanged (`node_modules/@next/bundle-analyzer/index.js:7-15`), so `ANALYZE=true` without `--webpack` is a silent no-op. Do not delete the wrap to "clean up" — it is what makes `pnpm analyze` work at all.

### `src/lib/r3f.ts`
- **Role:** single-module barrel so the bundler sees one module-graph node for the entire R3F universe.
- **Exports:** from `@react-three/fiber` — `Canvas`, `useFrame`, `useThree`, `useLoader`, `useGraph`, `extend`, plus types `ThreeEvent`, `RootState`, `RenderCallback`; `export * as THREE from "three"`; from `@react-three/drei` — `OrbitControls`, `Billboard`, `Text`, `Html`, `useTexture`, `useGLTF`, `useAnimations`, `Float`, `MeshDistortMaterial`, `GradientTexture`; from `@react-three/postprocessing` — `EffectComposer`, `Bloom`, `Vignette`, `Noise`, `ChromaticAberration`.
- **Reads / depends on:** four prod deps: `@react-three/fiber`, `three`, `@react-three/drei`, `@react-three/postprocessing`.
- **Consumed by:** `src/components/chat/voice-orb-3d.tsx:4`, `src/components/hero-graph/scene.tsx:4`, `src/components/game/build-graph-scene.tsx:4,6`, `src/components/hero-avatar/{avatar-mesh,avatar-scene,avatar-controls,use-avatar-gaze,use-avatar-idle}.tsx|ts`.
- **Behaviour notes:** named exports only (`:12-13`) to avoid collisions between fiber / drei / postprocessing.
- **Gotchas / invariants:** `next.config.ts:149` records that this barrel "is load-bearing for the single-copy outcome" of the 876 KB three.js chunk — `897,249` B, a **Turbopack** measurement. Since this branch that is enforced, not just asserted: `scripts/bundle-budget.mjs` (run by `.github/workflows/ci.yml:115-116`) fails if `WebGLRenderer` reaches any route's first-load chunk set, so breaking this barrel's laziness now turns CI red instead of quietly costing ~876 KB on every route. `src/components/hero-graph/scene-physics.tsx:4-6` imports `@react-three/fiber` and `three` **directly**, bypassing the barrel — the only such file found. It is also the only import site for `@react-three/drei` and `@react-three/postprocessing` in the whole repo, so deleting a re-export here silently breaks consumers with no other path to the symbol.

### `src/app/api/mcp/[transport]/route.ts`
- **Role:** the sole consumer of `mcp-handler` (and therefore the sole reason `@modelcontextprotocol/sdk` is declared).
- **Exports:** `maxDuration = 30` (`:9`); `handler as GET`, `handler as POST`, `handler as DELETE` (`:129`).
- **Reads / depends on:** `mcp-handler` (`:1`), `@/lib/mcp-tools` (`:2`, which brings `zod`).
- **Consumed by:** external MCP clients at `https://anvilry.vercel.app/api/mcp/mcp`.
- **Behaviour notes:** registers **9** tools (`:30-117`): `get_profile`, `list_projects`, `get_project`, `list_work`, `get_work`, `search_experience`, `get_resume_variant`, `list_all_content`, `get_content_item`. `wrap()` (`:12-19`) sets `isError: true` when a tool result contains a `notFound` key. `{ basePath: "/api/mcp", disableSse: true }` (`:126`).
- **Gotchas / invariants:** `disableSse: true` is a dependency-level guard — without it a GET to `/api/mcp/sse` "falls through to mcp-handler's Redis init, which throws `redisUrl is required` → an unhandled 500 in prod (this project uses Upstash REST, not REDIS_URL/KV_URL)" (`:120-126`). Also: the doc/code tool-count drift here is **FIXED** on this branch. `CLAUDE.md` used to document **7** tools while this route registered **9** — `list_all_content` and `get_content_item` were live but undocumented. `CLAUDE.md:212` ("**9 tools**") and `CLAUDE.md:303` ("MCP server (9 read-only tools)") now both agree with the code, and the route's own docblock says "9 read-only tools" (`:22`). Regression is guarded, not just corrected: `src/app/mcp/tools-documented.test.ts` compares the `/mcp` page's `TOOLS` table against this route's `registerTool` calls and, because `vitest run` is chained into `pnpm build`, fails the build if they disagree (`CLAUDE.md:226-230`). The `export const runtime = "nodejs"` line was deleted for `cacheComponents` (`:6-8`); Node is still what runs, being the default.

### `src/lib/scroll/use-stick-to-bottom-library.ts`
- **Role:** thin adapter that maps the `use-stick-to-bottom` instance onto the repo's engine-agnostic `UseAutoScroll` shape.
- **Exports:** `useStickToBottomLibrary(opts?: UseAutoScrollOptions): UseAutoScroll`.
- **Reads / depends on:** `use-stick-to-bottom` (`:3`), `./types`.
- **Consumed by:** `src/lib/scroll/use-auto-scroll.ts:5`; tested by `src/lib/scroll/use-stick-to-bottom-library.dom.test.tsx:3`.
- **Behaviour notes:** instantiated with `{ resize: "instant", initial: "instant" }` (`:23`), deliberately opting OUT of the library's velocity-spring smooth follow because "a per-token chase animation lags behind the stream". `enabled: false` makes both ref callbacks attach nothing (`:28-33`).
- **Gotchas / invariants:** `message-top` mode is **not** supported by this adapter (`:16-19`) — the library pins the bottom and exposes no `anchorRef`; the adapter silently falls back to bottom-pin. A caller expecting message-top must use the custom engine.

### `src/components/chat/file-picker-button.tsx` (dependency-relevant portion)
- **Role:** only consumer of `pdfjs-dist`; extracts PDF text client-side.
- **Exports:** `FilePickerButton` (component).
- **Reads / depends on:** `pdfjs-dist` via `await import("pdfjs-dist")` at `:77`; worker resolved with `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)` at `:79-82`.
- **Consumed by:** the chat composer.
- **Behaviour notes:** PDFs take the `readAsArrayBuffer` path, are paged with `getDocument(...).promise` / `getPage` / `getTextContent`, and are sent as `pdfText` with `data: ""` — no base64 (`:84-104`). Extraction failure resolves `null` rather than throwing (`:105-107`). Size caps: `MAX_PDF_SIZE` (10 MB) vs `MAX_IMAGE_SIZE` (2 MB) at `:61`.
- **Gotchas / invariants:** this is the one **client-reachable** advisory surface in the v3.4.2 batch (arbitrary JS execution on a malicious PDF), which is why `pdfjs-dist` got a direct bump rather than an override. Commit `2f309d2` records that actual PDF text extraction under 6.2.108 was **NOT** verified — only build/typecheck passed — so a manual upload smoke test remains outstanding.

### `.github/dependabot.yml`
- **Role:** governs how dependency PRs arrive; encodes three long-lived version holds.
- **Exports:** n/a.
- **Reads / depends on:** nothing.
- **Consumed by:** GitHub Dependabot.
- **Behaviour notes:** `target-branch: develop`, weekly Monday 09:00 America/Chicago. Six first-match-wins groups: `next-react-core`, `aws-bedrock`, `three-webgl`, `testing`, `dev-tooling`, and a `security-patches` group scoped `applies-to: security-updates` with pattern `"*"`.
- **Gotchas / invariants:** (1) Dependabot reads this file **only from the default branch** — `CHANGELOG.md:252-253` records that the `typescript`/`eslint` ignores added on `develop` were inert until commit `6cbff5d` landed them on `main`. (2) Security updates ignore `target-branch` entirely and are routed to the default branch — commit `2f309d2` corrects an earlier mistaken read that PR #114 (pdfjs-dist) was "anomalous" for targeting `main`. (3) The `@react-three/postprocessing` ignore is scoped to the single version `["3.0.5"]` so 3.0.6+ still flows.

### `.github/workflows/ci.yml`
- **Role:** the gate that makes the dependency graph reproducible.
- **Exports:** n/a.
- **Reads / depends on:** pnpm 10, Node 22, secret `SECURITY_ALERTS_TOKEN`.
- **Consumed by:** every push (`branches: ["**"]`) and PRs to `develop`/`main`.
- **Behaviour notes:** four jobs. `ci` — install → `pnpm content` → `pnpm lint` → `npx tsc --noEmit` → `pnpm test`; the `pnpm content` step exists because `.velite/` is gitignored and must be generated before tsc/vitest, mirroring the production build order. `e2e` — installs Chromium pinned to the installed `@playwright/test`, runs `pnpm build` (`:101-102`), then the **`Bundle budget`** step (`:110-111`, `node scripts/bundle-budget.mjs`), then `pnpm e2e` (needed because `webServer` runs `pnpm start`). The budget step was placed here deliberately so it rides on the build that already happens rather than adding a second one — and it can only work here, because the artifact it reads is written by that bare-`next build` Turbopack run. `install-pnpm-11` — the only job on a pnpm other than the pinned 10: cold `pnpm install --frozen-lockfile` on pnpm 11, then `git diff --exit-code` so a silent rewrite of a tracked file is itself a failure, then the build-script allowlist test. `security-alerts` — prints open advisory counts into the job summary.
- **Gotchas / invariants:** `security-alerts` is `continue-on-error: true` **by design** and the comment documents a hard platform limit: the default `GITHUB_TOKEN` cannot read the Dependabot alerts API even with `security-events: read` declared — the restriction is on token *type*, so a fine-grained PAT with `Dependabot alerts: Read-only` must be stored as `SECURITY_ALERTS_TOKEN` or the step prints setup instructions and exits 0. Commit `08935fa` ("security-alerts job was passing while reporting NOTHING") is the fix for the earlier silent-green version. **The new `Bundle budget` step is the deliberate opposite of that pattern and must stay that way:** it carries **no** `continue-on-error` and **no** `if-no-files-found`, and a missing or malformed `.next/diagnostics/route-bundle-stats.json` exits 1 rather than passing (`scripts/bundle-budget.mjs:73-77`). That is the entire lesson of the workflow it replaced — `.github/workflows/bundle-analysis.yml` combined `if-no-files-found: warn` with `continue-on-error: true` and so was green with **zero artifacts for its whole life** (222 runs, 211 green). `develop` is not branch-protected, so deleting it broke no required check. Unmeasurable must mean red — the second time this repo has paid for that lesson in CI, after `08935fa`, and the two are worth reading together: one job needs `continue-on-error` because of a platform limit it cannot fix, the other must never have it.

## Coverage

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `.nvmrc`
- `next.config.ts`
- `vitest.config.ts`
- `playwright.config.ts`
- `velite.config.ts`
- `postcss.config.mjs`
- `eslint.config.mjs`
- `tsconfig.json`
- `vercel.json`
- `.gitignore`
- `Makefile`
- `CHANGELOG.md`
- `CLAUDE.md`
- `ARCHITECTURE.md`
- `.github/dependabot.yml`
- `.github/workflows/ci.yml`
- `src/lib/r3f.ts`
- `src/lib/llm.ts`
- `src/lib/utils.ts`
- `src/lib/redis.ts`
- `src/lib/rate-limit.ts`
- `src/lib/flags.ts`
- `src/lib/mcp-tools.ts`
- `src/lib/scroll/use-stick-to-bottom-library.ts`
- `src/app/api/mcp/[transport]/route.ts`
- `src/app/api/tts/route.ts`
- `src/app/api/transcribe/route.ts`
- `src/app/api/visit/route.ts`
- `src/app/api/error/route.ts`
- `src/app/.well-known/vercel/flags/route.ts`
- `src/app/layout.tsx`
- `src/app/search/page.tsx`
- `src/app/globals.css`
- `src/components/hero-graph/index.tsx`
- `src/components/hero-graph/scene-physics.tsx`
- `src/components/chat/voice-orb-3d.tsx`
- `src/components/chat/markdown-message.tsx`
- `src/components/chat/file-picker-button.tsx`
- `src/components/command-palette.tsx`
- `src/instrumentation-client.ts`
- `scripts/replay-trace.mjs`
- `scripts/bundle-budget.mjs`
- `e2e/views.spec.ts`
- `e2e/resume.spec.ts`
