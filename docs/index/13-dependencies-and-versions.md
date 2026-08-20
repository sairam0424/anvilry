---
kind: doc
title: Dependency Inventory & Version Surface
domain: [content]
status: current
version: v3.4.2
---

# Dependency Inventory & Version Surface

> Part of the Anvilry v3.4.2 codebase index. Master entry point: [docs/index/README.md](./README.md)

**Scope:** `package.json` (`dependencies`, `devDependencies`, `pnpm.overrides`, `pnpm.onlyBuiltDependencies`), `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and every config / source file that consumes a declared dependency (`next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `velite.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.json`, `vercel.json`, `.github/dependabot.yml`, `.github/workflows/*.yml`, `Makefile`, and the `src/`, `e2e/`, `scripts/` import sites).
**Files indexed:** 46

**Declared counts (verified, not from the brief):** `dependencies` = **35**, `devDependencies` = **17**, `pnpm.overrides` = **10**, `pnpm.onlyBuiltDependencies` = **1**. Total declared = 52. (The task brief stated 39 + 18; the file at `package.json:19-53` and `:55-72` contains 35 + 17.)

## At a glance

| File | Role | Key exports |
|---|---|---|
| `package.json` | Manifest: 11 scripts, 35 prod deps, 17 dev deps, `pnpm.overrides` (10), `pnpm.onlyBuiltDependencies` (`esbuild`) | n/a (JSON) |
| `pnpm-lock.yaml` | lockfileVersion 9.0; `overrides:` block mirrored at `:7-17`; resolved versions for every importer | n/a |
| `pnpm-workspace.yaml` | `ignoredBuiltDependencies: [sharp, unrs-resolver]` — build scripts NOT run for those two natives | n/a |
| `next.config.ts` | Loads `@next/bundle-analyzer` via `createRequire`; dev-only `import("velite")` watcher; CSP; `optimizePackageImports: ["lucide-react","motion"]`; `cacheComponents: true` | `default` (wrapped `NextConfig`) |
| `vitest.config.ts` | Vitest 4 two-project config (`node` / `dom`), `resolve.tsconfigPaths`, forces `NODE_ENV=test` | `default` (config) |
| `playwright.config.ts` | Playwright 1.61 config; `webServer` runs `pnpm start`; single `chromium` project | `default` (config) |
| `velite.config.ts` | 4 Velite collections via `defineConfig/defineCollection/s` — uses Velite's bundled schema builder, NOT the `zod` dependency | `default` (config) |
| `postcss.config.mjs` | Sole plugin `@tailwindcss/postcss` (Tailwind v4 PostCSS entry) | `config` (default) |
| `eslint.config.mjs` | Flat config: `eslint/config` + `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`; ignores `scripts/**`, `.velite/**` | `default` (flat config array) |
| `tsconfig.json` | `strict`, `moduleResolution: bundler`, `plugins:[{name:"next"}]`, `@/*` → `./src/*` | n/a |
| `vercel.json` | 5 cron entries only — no build/install overrides | n/a |
| `.github/dependabot.yml` | 6 update groups + 3 `ignore` rules (postprocessing 3.0.5, typescript major, eslint major); `target-branch: develop` | n/a |
| `.github/workflows/ci.yml` | Node 22 + pnpm 10; `pnpm content` before tsc/vitest; separate `e2e` job pins Playwright browsers; non-blocking `security-alerts` job | n/a |
| `.github/workflows/bundle-analysis.yml` | Runs `npx next build` with `ANALYZE=true` to drive `@next/bundle-analyzer` | n/a |
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
| `src/components/hero-graph/index.tsx` | Flag-switched `next/dynamic` loader; comments on rapier being unimported | `HeroGraph` |
| `src/components/hero-graph/scene-physics.tsx` | Imports `@react-three/fiber` + `three` directly (bypasses the barrel); no rapier | `HeroGraphScenePhysics` |
| `src/components/chat/voice-orb-3d.tsx` | Only consumer of `postprocessing` and `@whatisjery/react-fluid-distortion` | `VoiceOrb3D` (see file) |
| `src/components/chat/markdown-message.tsx` | Only consumer of `react-markdown`, `remark-gfm`, `rehype-sanitize` | `MarkdownMessage`, `closeOpenMarkdown` |
| `src/components/chat/file-picker-button.tsx` | Only consumer of `pdfjs-dist` (dynamic import) | `FilePickerButton` |
| `src/components/command-palette.tsx` | Only consumer of `cmdk`; also `@radix-ui/react-dialog` + `@vercel/analytics` `track` | `CommandPalette` |
| `src/instrumentation-client.ts` | Only consumer of `web-vitals` (lazy `import("web-vitals")`) | side-effect module |
| `scripts/replay-trace.mjs` | CLI; imports `@upstash/redis` outside `src/` | n/a (script) |
| `e2e/views.spec.ts` | `@playwright/test` specs for the four views + SEO routes | test file |
| `e2e/resume.spec.ts` | `@playwright/test` specs for `/resume` (flag-OFF default + skipped flag-ON) | test file |
| `CHANGELOG.md` | Authoritative prose record of every version pin/hold in 3.4.0–3.4.2 | n/a |
| `CLAUDE.md` | Repo guidance; two dependency claims here are not backed by imports (see Gotchas) | n/a |
| `ARCHITECTURE.md` | Knowledge-base model; invariant "`.velite/` is gitignored" | n/a |
| `.gitignore` | Confirms `.velite`, `.vercel`, `next-env.d.ts`, `test-results/`, `playwright-report/` are untracked | n/a |

## Dependency map

### `dependencies` (35)

| package | version spec | prod/dev | purpose in THIS app | import sites (path:line) | notes |
|---|---|---|---|---|---|
| `@anthropic-ai/bedrock-sdk` | `^0.32.1` (resolved 0.32.4) | prod | `AnthropicBedrock` client for the default `LLM_PROVIDER=bedrock` chat path | `src/lib/llm.ts:2`; `src/lib/llm.test.ts:55` (vi.mock) | Server-only. Resolved with `(zod@3.25.76)` peer context |
| `@anthropic-ai/sdk` | `^0.116.0` | prod | Direct Anthropic API client + all message/stream types | `src/lib/llm.ts:1`; `src/app/api/chat/route.ts:1` (type-only); `src/lib/llm.test.ts:72` | Peer `zod: ^3.25.0 \|\| ^4.0.0` (optional). `llm.test.ts` pins snake_case usage fields |
| `@aws-sdk/client-polly` | `^3.1108.0` (resolved 3.1111.0) | prod | Polly Neural TTS behind the flag-gated `/api/tts` | `src/app/api/tts/route.ts:1` | Server-only, single import site |
| `@aws-sdk/client-transcribe-streaming` | `^3.1108.0` (resolved 3.1111.0) | prod | One-shot streaming STT for `/api/transcribe` | `src/app/api/transcribe/route.ts:1-5` | Server-only, single import site |
| `@modelcontextprotocol/sdk` | `1.26.0` (EXACT, no caret) | prod | Peer requirement of `mcp-handler` (`mcp-handler` peer is literally `1.26.0`) | **NO DIRECT IMPORT FOUND** | Searched `src/`, `e2e/`, `scripts/`, all root config files, and the whole repo excluding `node_modules`/`.next`/`.velite`/`.git` — the only matches are `package.json:23` and `CHANGELOG.md:21,38`. Declared because pnpm requires the peer be installed; consumed only through `mcp-handler` (`pnpm-lock.yaml:8546`). The exact pin is why Dependabot returned `security_update_not_possible` |
| `@radix-ui/react-dialog` | `^1.1.23` | prod | Accessible dialog primitives for 5 overlays | `src/components/command-palette.tsx:11`; `src/components/chat/talk-mode-overlay.tsx:3`; `src/components/chat/voice-picker.tsx:4`; `src/components/game/terminal/terminal-overlay.tsx:3` (also `chat/voice-settings-dialog.tsx:4`) | Client-bundled |
| `@react-three/drei` | `^10.7.8` | prod | R3F helpers (`useGLTF`, `Text`, `OrbitControls`, …) | `src/lib/r3f.ts:24` — **only** import site | Deliberately funnelled through the barrel. Declares `@types/three` as a transitive peer (`pnpm-lock.yaml:6197`) |
| `@react-three/fiber` | `^9.7.0` | prod | React renderer for three.js | `src/lib/r3f.ts:17-18`; `src/components/hero-graph/scene-physics.tsx:4-5` | `scene-physics.tsx` bypasses the barrel — the one exception |
| `@react-three/offscreen` | `^0.0.8` | prod | UNVERIFIED — no code path found | **NO DIRECT IMPORT FOUND** | Searched `src/`, `e2e/`, `scripts/`, root configs, then the whole repo (excl. `node_modules`/`.next`/`.velite`/`.git`) for both `@react-three/offscreen` and bare `offscreen`/`Offscreen`. Only hits: `package.json:27`, `CLAUDE.md:216`, and `docs/index/07-components-3d.md`. `CLAUDE.md:216` claims "`@react-three/offscreen` for worker offload" — unbacked at v3.4.2 |
| `@react-three/postprocessing` | `3.0.4` (EXACT, no caret) | prod | `EffectComposer`/`Bloom`/`Vignette`/`Noise`/`ChromaticAberration` for the voice orb | `src/lib/r3f.ts:27` — only import site | Pinned exact because 3.0.5 ships a types-only regression; a scoped Dependabot `ignore` for `["3.0.5"]` accompanies it (`.github/dependabot.yml`) |
| `@react-three/rapier` | `^2.2.0` | prod | UNVERIFIED — no physics code path | **NO DIRECT IMPORT FOUND** | Searched `src/`, `e2e/`, `scripts/`, root configs, whole repo. Only textual hits: `package.json:29`, the comment `src/components/hero-graph/index.tsx:12` ("when off (default) rapier is never imported"), `scene-physics.tsx:12` ("No RigidBody / Rapier needed"), and `docs/superpowers/plans/2026-06-23-c4-r3f-physics.md`. The `NEXT_PUBLIC_GRAPH_PHYSICS` variant uses plain `useFrame` sinusoids, not rapier |
| `@types/three` | `^0.185.4` | **prod** (not dev) | Type definitions for three.js — load-bearing for `tsc` | **NO DIRECT IMPORT FOUND** (types packages are never imported by specifier) | Verified necessary, not vestigial: `node_modules/three/package.json` has no `types`/`typings` field and no `.d.ts` in `build/`, so `import type * as THREE from "three"` (`src/components/hero-avatar/rig.ts:4`, `rig.test.ts:2`) and `src/lib/r3f.ts:21` only typecheck via `@types/three`. Also a transitive peer of `drei`, `maath`, `stats-gl` (`pnpm-lock.yaml:6179,6182,6197`). `CHANGELOG.md:77` explains the `^0.184.1 → ^0.185.4` bump: caret on `0.x` is restrictive so it could not follow `three@0.185.1` on its own |
| `@upstash/ratelimit` | `^2.0.8` | prod | Sliding-window per-IP limiter (8 req / 60 s, prefix `anvilry:chat`) | `src/lib/rate-limit.ts:1,20-27`; `src/app/api/visit/route.ts:3` | Server-only. `/api/visit` builds its own Ratelimit rather than reusing `rate-limit.ts` |
| `@upstash/redis` | `^1.38.0` | prod | REST Redis singleton for rate-limit + telemetry + admin dashboard | `src/lib/redis.ts:1,36`; `scripts/replay-trace.mjs:25` | Server-only. Construction is wrapped in try/catch because the SDK throws a sync `UrlError` (`src/lib/redis.ts:29-39`) |
| `@vercel/analytics` | `^2.0.1` | prod | `<Analytics/>` beacon + imperative `track()` events | `src/app/layout.tsx:16,123`; `src/components/command-palette.tsx:5`; `src/components/game/terminal/terminal.tsx:4`; `src/components/game/terminal/use-terminal.ts:6` | Client-bundled. `va.vercel-scripts.com` is allow-listed in `script-src`/`connect-src` (`next.config.ts`) |
| `@vercel/speed-insights` | `^2.0.0` | prod | `<SpeedInsights/>` RUM beacon | `src/app/layout.tsx:17,124` | Client-bundled. `*.vercel-insights.com` allow-listed in `connect-src` |
| `@whatisjery/react-fluid-distortion` | `^1.6.3` | prod | `<Fluid/>` post-effect on the 3D voice orb | `src/components/chat/voice-orb-3d.tsx:6` — only import site | Client-bundled. Peers are all `'*'` (`pnpm-lock.yaml:2220-2226`) — no version guard from the package itself |
| `clsx` | `^2.1.1` | prod | Conditional class strings inside `cn()` | `src/lib/utils.ts:1,6` — only import site | Isomorphic; ships in both server and client graphs via `cn` |
| `cmdk` | `^1.1.1` | prod | Command palette primitives (`Command.Dialog/Input/List/Group/Item`) | `src/components/command-palette.tsx:6,456,476,493,547,552` — only import site | Client-bundled |
| `flags` | `^4.2.0` | prod | Vercel Flags SDK — `flag()` declaration + `verifyAccess`/`getProviderData` | `src/lib/flags.ts:10`; `src/app/.well-known/vercel/flags/route.ts:1-2` | Server-only (`src/lib/flags.ts:33` — "never from client components"). Reads `FLAG_DRIVER`, `FLAGS_SECRET` |
| `lucide-react` | `^1.31.0` | prod | Icon set, ~52 files | `src/app/articles/[slug]/page.tsx:4`; `src/app/projects/[slug]/page.tsx:4`; `src/app/resume/page.tsx:4`; `src/app/articles/page.tsx:5` (+48 more) | Client+server. Listed in `experimental.optimizePackageImports` (`next.config.ts`) |
| `mcp-handler` | `^1.1.0` | prod | `createMcpHandler` — wires 9 MCP tools to the `[transport]` route | `src/app/api/mcp/[transport]/route.ts:1,28` — only import site | Server-only. Pulls `redis@4.7.1`, `chalk`, `commander` (`pnpm-lock.yaml:8547-8549`); `disableSse: true` avoids its Redis init path (`route.ts:120-126`) |
| `motion` | `^12.40.0` | prod | Animation primitives (`motion`, `AnimatePresence`, `useScroll`) — ~21 files | `src/app/resume/page.tsx:5`; `src/app/articles/page.tsx:6`; `src/components/article-group-card.tsx:5`; `src/components/view-switcher.tsx:3` (+17 more) | Client-bundled via `motion/react`. In `optimizePackageImports`. Its runtime inline style attributes are cited as a reason `'unsafe-inline'` stays in CSP (`next.config.ts`) |
| `next` | `16.3.0` (EXACT) | prod | The framework | `src/proxy.ts:1-2`; `src/app/robots.ts:1`; `src/app/icon.tsx:1`; `src/components/hero-graph/index.tsx:3` — subpaths used: `next`, `next/server`, `next/og`, `next/dynamic`, `next/link`, `next/navigation`, `next/cache`, `next/font/google` | Exact pin; `eslint-config-next` matches it exactly. Carries `sharp@0.35.3` as an optional dep (`pnpm-lock.yaml:9066`) |
| `pdfjs-dist` | `^6.2.108` | prod | Client-side PDF text extraction for chat attachments | `src/components/chat/file-picker-button.tsx:77,79-82,84` (dynamic `await import`) | Client-bundled but **lazy** — only pulled after a PDF is selected. This is the high-severity arbitrary-JS-execution advisory fixed in 3.4.2 by a direct bump (6.0.227 → 6.2.108) |
| `postprocessing` | `^6.39.4` | prod | `BlendFunction` enum (peer of `@react-three/postprocessing`) | `src/components/chat/voice-orb-3d.tsx:5` — only import site | Client-bundled. **Peer constraint `three: >= 0.168.0 < 0.186.0`** (`pnpm-lock.yaml:4033`) — this is the ceiling on the `three` bump |
| `react` | `19.2.8` (EXACT) | prod | UI runtime | `src/app/error.tsx:35`; `src/app/not-found.tsx:21`; `src/app/resume/page.tsx:3`; `src/components/chat/voice-orb-3d.tsx:3` (+most components) | Exact pin, matched by `react-dom` |
| `react-dom` | `19.2.8` (EXACT) | prod | DOM renderer; `flushSync` for the view store | `src/components/view-context.tsx:12`; `src/app/layout.hydration-proof.dom.test.tsx:2-3` (`react-dom/server`, `react-dom/client`) | Exact pin. `vitest.config.ts` forces `NODE_ENV=test` specifically so React does not load its production bundle and strip `act` |
| `react-markdown` | `^10.1.0` | prod | Renders assistant text as a React vdom (never `dangerouslySetInnerHTML`) | `src/components/chat/markdown-message.tsx:4,7` — only import site | Client-bundled, itself lazily imported by `ask-portfolio.tsx:18` and `chat-messages.tsx:262` |
| `rehype-sanitize` | `^6.0.0` | prod | Defence-in-depth sanitizer (GitHub `defaultSchema`) on chat markdown | `src/components/chat/markdown-message.tsx:6` — only import site | Cited in `next.config.ts` CSP rationale as what makes `'unsafe-inline'`/`'unsafe-eval'` an accepted risk |
| `remark-gfm` | `^4.0.1` | prod | GFM tables/strikethrough in chat markdown | `src/components/chat/markdown-message.tsx:5` — only import site | Separate from Velite's own `mdx: { gfm: true }` (`velite.config.ts:128`) |
| `tailwind-merge` | `^3.6.0` | prod | Tailwind class-conflict resolution inside `cn()` | `src/lib/utils.ts:2,6` — only import site | Isomorphic |
| `three` | `^0.185.1` | prod | WebGL engine | `src/lib/r3f.ts:21`; `src/components/hero-graph/scene-physics.tsx:6`; `src/components/hero-avatar/rig.ts:4` (type-only); `src/components/hero-avatar/rig.test.ts:2` (type-only) | Client-bundled. One 876 KB chunk after the 16.3.0 upgrade (`next.config.ts` measurement block). Effective upper bound is `<0.186.0` from `postprocessing` |
| `use-stick-to-bottom` | `^1.1.6` | prod | Third-party auto-scroll engine, A/B'd against a custom hook | `src/lib/scroll/use-stick-to-bottom-library.ts:3,23` — only import site; consumed by `src/lib/scroll/use-auto-scroll.ts:5` | Client-bundled. Configured `resize: "instant", initial: "instant"` to opt OUT of its headline spring animation |
| `zod` | `^3.25.76` | prod | Runtime validation: MCP tool input schemas, `/api/error` payload, telemetry schema | `src/app/api/error/route.ts:1`; `src/lib/mcp-tools.ts:1,29-36`; `src/lib/telemetry/schema.ts:2` | **Server-only** — no client component imports `zod`. Note `velite.config.ts` uses Velite's own `s` builder (`velite.config.ts:1`), NOT this dependency |

### `devDependencies` (17)

| package | version spec | prod/dev | purpose in THIS app | import sites (path:line) | notes |
|---|---|---|---|---|---|
| `@next/bundle-analyzer` | `^16.3.0` (resolved 16.3.1) | dev | Wraps the exported Next config; emits `.next/analyze/` when `ANALYZE=true` | `next.config.ts:5`, applied at `next.config.ts` final line `export default withBundleAnalyzer(nextConfig)` | Loaded via `createRequire(import.meta.url)` because the package is CJS-only. Driven by `.github/workflows/bundle-analysis.yml:57-59` |
| `@playwright/test` | `^1.61.1` | dev | E2E runner | `playwright.config.ts:1`; `e2e/views.spec.ts:1`; `e2e/resume.spec.ts:1` | CI pins the browser download to the installed version (`ci.yml`: `pnpm exec playwright install --with-deps chromium`) to avoid the "Executable doesn't exist" mismatch |
| `@tailwindcss/postcss` | `^4` (resolved 4.3.0) | dev | The only PostCSS plugin | `postcss.config.mjs:3` | Tailwind v4 entry point; there is no `tailwind.config.*` file in the repo |
| `@testing-library/dom` | `^10.4.1` | dev | Required (non-optional) peer of `@testing-library/react` | **NO DIRECT IMPORT FOUND** | Searched `src/`, `e2e/`, `scripts/`, root configs for `from "@testing-library/dom"` — zero matches. Declared to satisfy the peer at `pnpm-lock.yaml:1833` |
| `@testing-library/react` | `^16.3.2` | dev | `render`/`screen`/`renderHook`/`act` in the `dom` vitest project | `src/app/layout.hydration-proof.dom.test.tsx:4`; `src/components/ask-portfolio.dom.test.tsx:2`; `src/components/chat/use-chat-stream.dom.test.tsx:2`; `src/components/site-footer.dom.test.tsx:2` (+more `*.dom.test.tsx`) | Its `renderHook` is the exact reason `vitest.config.ts` forces `NODE_ENV=test` |
| `@types/node` | `^26` (resolved 26.2.0) | dev | Node type definitions (`node:crypto`, `process`, `__dirname`) | **NO DIRECT IMPORT FOUND** (ambient) | Consumed ambiently by `tsconfig.json`. Bumped `^20 → ^26` in 3.4.1 (`CHANGELOG.md:82`) |
| `@types/react` | `^19` (resolved 19.2.17) | dev | React type definitions | **NO DIRECT IMPORT FOUND** (ambient) | Also an optional peer threaded through `drei`/`cmdk`/`radix` resolutions |
| `@types/react-dom` | `^19` (resolved 19.2.3) | dev | react-dom type definitions | **NO DIRECT IMPORT FOUND** (ambient) | Optional peer of `@testing-library/react` (`pnpm-lock.yaml:1835`) |
| `eslint` | `^9` (resolved 9.39.4) | dev | Linter; `pnpm lint` = bare `eslint` | `eslint.config.mjs:1` (`eslint/config`); inline directives e.g. `src/components/site-footer.tsx:36`, `src/app/work/[slug]/page.tsx:112` | Major upgrade explicitly blocked — see `.github/dependabot.yml` ignore + `CHANGELOG.md:104-108` |
| `eslint-config-next` | `16.3.0` (EXACT) | dev | Next core-web-vitals + TS rule sets | `eslint.config.mjs:2-3` | Exact pin held in lockstep with `next` |
| `happy-dom` | `^20.11.2` | dev | DOM environment for the `dom` vitest project | **NO DIRECT IMPORT FOUND** | Referenced by name only: `vitest.config.ts:43` (`environment: "happy-dom"`). Prose references in `src/components/chat/voice-pitfalls.test.ts:14`, `use-chat-stream.dom.test.tsx:25` are comments, not imports |
| `pagefind` | `^1.5.2` | dev | Builds the static search index consumed by `/search` | **NO npm-level import** — invoked as a CLI at `Makefile:66` (`pnpm pagefind --site .next/server/app --output-path public/pagefind`) | `src/app/search/page.tsx:20,25` loads `/pagefind/pagefind-ui.css` + `.js` by injected tag, from `public/`, not from `node_modules`. There is **no `search-index` npm script** — `CLAUDE.md` line "After build: generate Pagefind search index / `pnpm search-index`" is stale; the real entry point is `make search-index` |
| `tailwindcss` | `^4` (resolved 4.3.0) | dev | CSS framework | `src/app/globals.css:1` (`@import "tailwindcss"`) | v4 CSS-first: no JS config file exists. `experimental.inlineCss` in `next.config.ts` is described there as targeting exactly this case |
| `typescript` | `^5` (resolved 5.9.3) | dev | Type checker (`npx tsc --noEmit` in CI) | `tsconfig.json`; `next-env.d.ts:7`; inline `@typescript-eslint` directives e.g. `src/lib/llm.ts:322`, `src/lib/telemetry/with-trace.ts:10` | Major (7.x) held back — `@typescript-eslint/typescript-estree@8.61.0` crashes on load under 7.0.2 while `tsc --noEmit` itself is clean (`.github/dependabot.yml`; `CHANGELOG.md:98-103`) |
| `velite` | `^0.4.0` | dev | MDX → typed `.velite/` collections | `velite.config.ts:1`; `next.config.ts:15` (`import("velite").then(({ build }) => build({ watch: true, clean: false }))`); referenced by the `predev`/`build`/`content` scripts | Pulls `esbuild@0.25.12` + `sharp@0.35.3` + `terser` (`pnpm-lock.yaml:10044-10049`). `src/lib/content.ts:14` imports the **generated output** `"../../.velite"`, not the package |
| `vitest` | `^4.1.10` | dev | Unit/DOM test runner; chained into `pnpm build` | `vitest.config.ts:1` (`vitest/config`); `src/lib/llm.test.ts`, `src/app/api/error/route.test.ts:1`, `src/app/api/tts/cache.test.ts:1`, `src/app/layout.hydration-proof.dom.test.tsx:1` (+all `*.test.*`) | Vitest 4.1.10 resolves **Vite 8.0.16** (`pnpm-lock.yaml:176`) |
| `web-vitals` | `^5.3.0` | dev | LCP/INP/CLS field reporting to Vercel Runtime Logs | `src/instrumentation-client.ts:50` (`import("web-vitals").then(({ onLCP, onINP, onCLS }) => …)`) | **Notable:** this is a `devDependency` that is dynamically imported from a file Next bundles into the CLIENT runtime. It resolves because pnpm installs dev deps at build time on Vercel, but it is not a production dependency by declaration |

## Runtime split

**Server-only (never in a client chunk).** Every one of these is reached exclusively from a Route Handler, a Server Component, a non-`"use client"` lib module, or a build step:

- `@anthropic-ai/sdk`, `@anthropic-ai/bedrock-sdk` — entered only through `src/lib/llm.ts` (no `"use client"`; first line is the SDK import), which is imported by `/api/chat`, `/api/tts` and `/api/transcribe`.
- `@aws-sdk/client-polly` (`src/app/api/tts/route.ts:1`), `@aws-sdk/client-transcribe-streaming` (`src/app/api/transcribe/route.ts:1-5`). `next.config.ts` states this explicitly in the CSP rationale: *"Bedrock/Polly/Transcribe are called SERVER-side, so the browser never connects to AWS"* — which is why `connect-src` contains no AWS host.
- `@upstash/redis` / `@upstash/ratelimit` — `src/lib/redis.ts:1` and `src/lib/rate-limit.ts:1` (both plain modules), plus `src/app/api/visit/route.ts:3` and the standalone `scripts/replay-trace.mjs:25`.
- `mcp-handler` + `@modelcontextprotocol/sdk` — only `src/app/api/mcp/[transport]/route.ts`. The route comment at `:4-8` states the SDK "transitively needs Node (express/hono) — never edge". `disableSse: true` (`:126`) is what keeps `mcp-handler`'s Redis init (and `redis@4.7.1`) off the executed path.
- `flags` — `src/lib/flags.ts:10` and `src/app/.well-known/vercel/flags/route.ts:1-2`. `src/lib/flags.ts:33` documents "Call from a Server Component or a Route Handler (never from client components)".
- `zod` — three sites (`api/error/route.ts:1`, `lib/mcp-tools.ts:1`, `lib/telemetry/schema.ts:2`). `telemetry/schema.ts:1` also imports `node:crypto`, so it can never be client-bundled; its only non-route consumer is the async Server Component `src/app/admin/telemetry/page.tsx:14`.
- `velite` — build/dev only (`velite.config.ts`, and the dev-guarded dynamic import at `next.config.ts:12-16`). `next.config.ts:13` gates it on `process.argv.includes("dev")`.
- `@next/bundle-analyzer`, `@playwright/test`, `@tailwindcss/postcss`/`tailwindcss`, `typescript`, `eslint*`, `happy-dom`, `@testing-library/*`, `@types/*`, `pagefind` — tooling; never in any app graph.

**Client-bundled.**

- The R3F/WebGL cluster — `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `postprocessing`, `@whatisjery/react-fluid-distortion`. All funnel through `src/lib/r3f.ts` (the one exception is `hero-graph/scene-physics.tsx:4-6`, which imports `@react-three/fiber` and `three` directly). Every consumer is `"use client"` and mounted behind `next/dynamic(..., { ssr: false })` (`src/components/hero-graph/index.tsx:14-15`). `next.config.ts` records that after the 16.3.0 upgrade three.js occupies exactly ONE 876 KB chunk (down from two), and that `src/lib/r3f.ts` "is load-bearing for the single-copy outcome" — and that `three`/`fiber`/`drei` are deliberately **excluded** from `optimizePackageImports`.
- `motion`, `lucide-react`, `cmdk`, `@radix-ui/react-dialog`, `react-markdown`, `remark-gfm`, `rehype-sanitize`, `use-stick-to-bottom`, `@vercel/analytics`, `@vercel/speed-insights`.
- Lazy client chunks (declared prod/dev but loaded on demand, never in first-load JS): `pdfjs-dist` (`file-picker-button.tsx:77`), `web-vitals` (`instrumentation-client.ts:50`, guarded by `typeof window !== "undefined"` at `:46`).
- Isomorphic: `clsx` + `tailwind-merge` via `cn()` (`src/lib/utils.ts`), `react`/`react-dom`, `next`.

**Edge runtime.** `src/proxy.ts:1-2` imports only `next/server`. Per `CLAUDE.md`, it is the Edge auth gate for `/admin/*` and uses Web Crypto rather than `node:crypto` — no third-party dependency is reachable from it.

**Declared but unreachable.** `@modelcontextprotocol/sdk` (peer-only), `@react-three/offscreen` and `@react-three/rapier` (no import anywhere), `@types/three` / `@types/node` / `@types/react` / `@types/react-dom` (ambient), `@testing-library/dom` (peer-only), `happy-dom` (config string), `pagefind` (CLI).

## Version pins & overrides

### `pnpm.onlyBuiltDependencies` (`package.json:75-77`)

`["esbuild"]` — pnpm 10 refuses to run install scripts unless a package is on this allowlist. `esbuild@0.25.12` is a **direct dependency of `velite@0.4.0`** (`pnpm-lock.yaml:10044-10047`) and needs its postinstall to fetch/link the platform binary, so content generation would fail without it. `vite@8.0.16` declares `esbuild: ^0.27.0 || ^0.28.0` as an *optional* peer (`pnpm-lock.yaml:4656,4671`) — that peer is unsatisfied by 0.25.12 and is not being relied on.

### `pnpm-workspace.yaml` (companion, same subject)

`ignoredBuiltDependencies: [sharp, unrs-resolver]` — the inverse list; these two natives are installed *without* running their build scripts. `sharp@0.35.3` is pulled by both `next@16.3.0` (optional dep, `pnpm-lock.yaml:9066`) and `velite@0.4.0` (`:10048`); `unrs-resolver@1.12.2` comes from `eslint-import-resolver-typescript@3.10.1` (`:7619`). Introduced in the repo's initial commit (`git log -S ignoredBuiltDependencies` → `ee0fc1e Initial commit from Create Next App`).

### `pnpm.overrides` (`package.json:78-89`) — 10 entries, all added in v3.4.2

Every override exists to resolve a Dependabot advisory on a **transitive, lockfile-pinned** package. Root cause per commit `2f309d2`: `@modelcontextprotocol/sdk` is pinned exactly to `1.26.0` while 1.30.0 exists, so Dependabot could not walk the chain and reported `security_update_not_possible`; `pnpm update --depth Infinity` also could not move them. All ten are mirrored into `pnpm-lock.yaml:7-17`.

| Override key | Spec | Resolved | Severity & advisory (per `2f309d2` / `0bff457` / `CHANGELOG.md:14-35`) | Reachability as assessed in-repo |
|---|---|---|---|---|
| `hono` | `^4.12.34` | 4.13.2 | medium ×3 + low ×1 — `memo()` retained SSR output across requests (cross-user data disclosure); ReDoS in CORS middleware; algorithmic-complexity DoS in Language middleware; Proxy Helper leaks `Connection`-listed headers | MCP route only. **Minor** bump (4.12.25 → 4.13.2), the largest jump in the batch, so it was tested live: `tools/list` returned all 9 tools over Streamable HTTP |
| `@hono/node-server` | `^1.19.15` | 1.19.17 | medium — `serve-static` path traversal via `%5C` | MCP route only; Windows-specific, production is Linux on Vercel |
| `ip-address` | `^10.3.1` | 10.5.0 | **high** — `Address4` decodes leading-zero octets as decimal while resolvers decode octal → SSRF / trust-boundary bypass | `mcp-handler` → `@modelcontextprotocol/sdk` → `express-rate-limit`. Server-side only; commit notes "0 client chunks contain ip-address". `express-rate-limit` already declared `ip-address: ^10.2.0`, so the override only re-resolves inside a blessed range |
| `fast-uri` | `^3.1.5` | 3.1.5 | **high** — host confusion via backslash authority introducer | Transitive under the MCP/validation chain |
| `js-yaml` | `^4.3.1` | 4.3.1 | **high** — quadratic CPU consumption (DoS) in `!!omap` resolution | devDependency chain (build-time) |
| `postcss` | `^8.5.23` | 8.5.23 **and** 8.5.26 both present (`pnpm-lock.yaml:4022,4026`) | medium/high — attacker-controlled `sourceMappingURL` reads arbitrary `.map` files when `from` is unset | Build-time; one instance was a devDependency |
| `brace-expansion@1` | `^1.1.16` | 1.1.18 | **high** — advisory scope `<1.1.16` | eslint tooling chain (dev). Version-scoped on purpose |
| `brace-expansion@>=3` | `^5.0.7` | 5.0.9 | **high** — advisory scope `>=3.0.0 <5.0.7` | Same chain. Split into two keys because a blanket `^5.0.7` would force `minimatch@3` (which requires the 1.x line) onto 5.x and break eslint. Verified: 1.1.18 and 5.0.9 coexist |
| `sharp` | `^0.35.0` | 0.35.3 | **high** | Two instances existed; `next@16.3.0` already carried patched 0.35.3, only `velite`'s 0.34.5 was vulnerable — build-time image processing of the repo's own content. Because it is a native module, `.velite` was wiped and regenerated to prove it: exit 0, work=5 / projects=11 / articles=15 / notes=5 |
| `body-parser` | `^2.3.0` | 2.3.0 | low | `express@5.2.1` via `@modelcontextprotocol/sdk` — MCP route only |

**Not an override, but part of the same fix:** `pdfjs-dist` was raised as a **direct** dependency bump `6.0.227 → ^6.2.108` (**high**, arbitrary JS execution on opening a malicious PDF) because it is genuinely client-reachable at `file-picker-button.tsx:77`.

**Advisory-count correction recorded in the log.** Commit `2f309d2` claimed "10 open advisories"; `0bff457` corrects it — the API query used `per_page=10` and silently capped, and the true figure is **23 alerts across 10 unique packages**. The v3.4.2 release commit (`a848117`) is titled "security patch, ships 23 advisory fixes to production", and `CHANGELOG.md:8-9` states production had been serving the vulnerable versions because the fixes sat on `develop` (Preview only).

### Exact (caret-less) pins, and why

| Package | Pin | Reason (cited) |
|---|---|---|
| `next` / `eslint-config-next` | `16.3.0` | Held in lockstep so the lint ruleset matches the framework |
| `react` / `react-dom` | `19.2.8` | Kept identical to each other; bumped as a pair in 3.4.1 (`CHANGELOG.md:70`) |
| `@react-three/postprocessing` | `3.0.4` | 3.0.5 types-only regression: `ChromaticAberration` props are `Omit<Partial<ConstructorParameters<...>[0]>, 'offset'>`, the ctor param is optional so the type includes `\| undefined`, `keyof` of that union collapses to `never`, and every real prop is erased. Runtime is fine — only `tsc` catches it. A version-scoped Dependabot `ignore` for `["3.0.5"]` accompanies the pin so 3.0.6+ still flows |
| `@modelcontextprotocol/sdk` | `1.26.0` | `mcp-handler@1.1.0`'s peer range is the single literal version `1.26.0` (`pnpm-lock.yaml:3607`). This pin is the direct cause of the `security_update_not_possible` failures |

## Framework version notes

**Next 16.3.0.** `CLAUDE.md` opens with a standing warning that Next 16 APIs differ from training data and to consult `node_modules/next/dist/docs/`. Version-sensitive code found:

- `experimental.viewTransition` was **removed** in the 16.3.0 upgrade (`next.config.ts`): it no longer exists in Next's `ExperimentalConfig` (absent from `config-schema.js` and the types), so leaving it was a hard typecheck failure. The comment records it as a no-op for this app — the four-view transition uses native `document.startViewTransition` + `::view-transition-*` CSS, not React's `<ViewTransition>`.
- `experimental.cacheComponents: true` supersedes `experimental.ppr` / `experimental_ppr` / `dynamicIO` / `useCache`. Enabling it failed the build with exactly **26 errors** across 22 files: 13 × `runtime`, 4 × `revalidate`, 9 × `dynamic = "force-dynamic"`. The RSC transform rejects the mere *presence* of `export const runtime` (the `"runtime" =>` arm never inspects `decl.init`), so `"nodejs"` and `"edge"` are indistinguishable to it — and since `nodejs` is already the default, the remedy was deletion. `maxDuration` and `preferredRegion` are **not** rejected, which is why `maxDuration = 30` survives at `src/app/api/mcp/[transport]/route.ts:9` (and 15 / 20 / 5 on tts / transcribe / error).
- Two constraints `cacheComponents` imposes: `generateStaticParams` must return ≥1 result, and synchronous IO (`new Date()`, `Date.now()`) fails prerender and cannot be deferred with `instant = false`. Hence the build-time constant `env: { NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()) }` in `next.config.ts` for the footer.
- `turbopack: { root: __dirname }` pins the workspace root because multiple lockfiles exist on the machine. `.github/workflows/bundle-analysis.yml:54-56` asserts that `next build` still uses **webpack** by default in Next 16 (Turbopack being opt-in via `--turbopack`, dev-only), which is what lets `@next/bundle-analyzer` hook the build at all — **UNVERIFIED** by me against the installed Next docs; recorded as the repo's own claim.
- `experimental.optimizePackageImports: ["lucide-react", "motion"]` only — `three`/`fiber`/`drei` are deliberately excluded, with the comment recording that the C-3 investigation disproved the flag for the R3F twin-chunk and that the `src/lib/r3f.ts` barrel is the correct fix.

**React 19.2.8.** Exact-pinned with `react-dom`. Two version-sensitive spots: `src/components/view-context.tsx:12` imports `flushSync` from `react-dom` for the external-store view switch, and `vitest.config.ts` forces `NODE_ENV=test` because on Vercel the build shell sets `NODE_ENV=production`, which makes React load its production bundle, strip `act`, and crash `@testing-library/react`'s `renderHook` with "React.act is not a function" — failing the deploy.

**Tailwind v4.** No `tailwind.config.*` file exists. The entry point is CSS-first: `src/app/globals.css:1` is `@import "tailwindcss"`, and `postcss.config.mjs:3` lists `@tailwindcss/postcss` as the sole plugin (both `tailwindcss` and `@tailwindcss/postcss` resolve to 4.3.0). `next.config.ts` notes `experimental.inlineCss: true` because "Tailwind v4 is the exact use case this flag targets". One v4 consequence is recorded in source: `src/components/game/easter-eggs.tsx:133` — "Tailwind v4 here has no `tailwindcss-animate`, so those silently no-op".

**Zod v3 (`^3.25.76`).** Both consumers that constrain it accept v4 as well: `@anthropic-ai/sdk`'s peer is `zod: ^3.25.0 || ^4.0.0` (optional) and `@modelcontextprotocol/sdk@1.26.0`'s is `zod: ^3.25 || ^4.0` (`pnpm-lock.yaml:920`). `src/lib/mcp-tools.ts:29-36` exports **raw-shape** schemas (plain objects of `z.*` fields, not `z.object(...)`) because that is what `mcp-handler`'s `registerTool` takes. Whether a v4 migration would break that raw-shape handoff is **UNVERIFIED**. Note the content pipeline does *not* use this dependency: `velite.config.ts:1` imports Velite's own `s` builder.

**Vitest 4.1.10.** Resolves **Vite 8.0.16** (`pnpm-lock.yaml:176`). Two version-gated config choices: `resolve: { tsconfigPaths: true }` (`vitest.config.ts:17`) is documented as "native in Vite 6+" and is what resolves both `@/*` and the relative `.velite` import so tests exercise the real shipping modules; and `test.projects` (`:27`) is the modern replacement for the old workspace file. The `node` project excludes `**/*.dom.test.{ts,tsx}` so happy-dom globals never leak into pure tests. `pnpm build` = `velite --clean && vitest run && next build`, so a failing test blocks the deploy.

**Playwright 1.61.1.** `playwright.config.ts` declares one `chromium` project and a `webServer` block running `pnpm start` with `reuseExistingServer: !process.env.CI` and a 120 s timeout. The comment records the failure mode this fixed: previously a stale server on `:3000` meant Playwright "silently tested whatever was listening — an older build", producing 5 spurious failures during a release audit. CI installs the browser with `pnpm exec playwright install --with-deps chromium` and comments that a version/browser mismatch fails with "Executable doesn't exist at .../chromium_headless_shell-<rev>".

**Blocked majors (Dependabot `ignore`, `.github/dependabot.yml`).**
- `typescript` semver-major — `@typescript-eslint/typescript-estree@8.61.0` crashes on load under `typescript@7.0.2` with `TypeError: Cannot read properties of undefined (reading 'Cjs')` at `typescript-estree/dist/create-program/shared.js:59`. Reproduced with `eslint` pinned at 9.39.4, so it is not the ESLint 10 issue; `tsc --noEmit` under 7.0.2 is clean, so only the lint toolchain fails.
- `eslint` semver-major — `eslint-plugin-react` calls APIs removed in 10 (`sourceCode.getJSDocComment`, no replacement), and `eslint-config-next`'s vendored Babel 7 `@babel/eslint-parser` lacks `ScopeManager#addGlobals` with Babel having ruled out ESLint 10 support in 7. Re-check trigger recorded as `jsx-eslint/eslint-plugin-react#4022`.
- Both ignores were initially added on `develop` and were **inert**, because Dependabot reads `dependabot.yml` from the default branch only; commit `6cbff5d` propagated them to `main`.

**Three.js ceiling.** `three` is `^0.185.1`, but `postprocessing@6.39.4` declares `three: >= 0.168.0 < 0.186.0` (`pnpm-lock.yaml:4033`). A bump to 0.186.x therefore breaks that peer, and the `three-webgl` Dependabot group batches `three`, `@react-three/*`, `@types/three`, and `postprocessing` together so the constraint is reviewed as a unit.

**Node / package-manager versions.** `package.json` declares **no** `engines` and no `packageManager` field, and there is no `.nvmrc` or `.npmrc`. CI uses `pnpm/action-setup` version 10 and `actions/setup-node` with `node-version: 22`. The (gitignored) `.vercel/project.json` records `"nodeVersion": "24.x"` for the deployment — so CI and production run different Node majors.

## Detail

### `package.json`
- **Role:** the manifest under index; also carries the two pnpm control blocks.
- **Exports:** n/a.
- **Reads / depends on:** nothing (data file).
- **Consumed by:** pnpm, all npm scripts, `next.config.ts` (indirectly via `ANALYZE`), Dependabot.
- **Behaviour notes:** the `build` script is ordered `velite --clean && vitest run && next build` (`package.json:8`) — content generation, then tests as a deploy gate, then compile. `predev` runs bare `velite` (no `--clean`) at `:6`; `CLAUDE.md` explains that passing `--clean` in dev races webpack against a momentarily deleted `.velite/projects.json`. `lint` is bare `eslint` with no `--fix` (`:10`).
- **Gotchas / invariants:** (1) There is **no `search-index` script** — `CLAUDE.md`'s `pnpm search-index` does not exist; the real target is `make search-index` (`Makefile:64-66`). (2) `@types/three` sits in `dependencies` (`:30`), not `devDependencies` — moving it would not break the build (Vercel installs dev deps) but is a deliberate-looking placement. (3) `web-vitals` sits in `devDependencies` (`:72`) yet is dynamically imported from client-bundled `src/instrumentation-client.ts:50`. (4) The four exact pins at `:23,28,42,45,46,65` are load-bearing — see the pins table above.

### `next.config.ts`
- **Role:** the only place three declared dev deps are wired into the build (`@next/bundle-analyzer`, `velite`) plus every framework-version decision.
- **Exports:** `default` — `withBundleAnalyzer(nextConfig)`.
- **Reads / depends on:** `@next/bundle-analyzer` (CJS, loaded via `createRequire(import.meta.url)` at `:3-7`), `velite` (dynamic, dev-only, `:12-16`); env `ANALYZE`, `VELITE_STARTED`.
- **Consumed by:** `next build` / `next dev`; `.github/workflows/bundle-analysis.yml`.
- **Behaviour notes:** the Velite watcher is double-guarded — `process.argv.includes("dev")` **and** a `VELITE_STARTED` sentinel so it starts once. `optimizePackageImports` is restricted to `["lucide-react", "motion"]`. `cacheComponents: true` is the single key superseding the older PPR/dynamicIO flags.
- **Gotchas / invariants:** the CSP keeps `'unsafe-eval'` in **both** dev and production because `MDXContent` evaluates Velite-generated MDX function-body strings with `new Function(code)` on every MDX page — the comment states removing it "crashes all project/work/note pages with a React render-error boundary". `'unsafe-inline'` is attributed in part to Motion's runtime style attributes, which nonces cannot cover. Re-adding `three`/`@react-three/*` to `optimizePackageImports` is explicitly called out as re-introducing a disproven optimization against the live `src/lib/r3f.ts` barrel.

### `src/lib/r3f.ts`
- **Role:** single-module barrel so the bundler sees one module-graph node for the entire R3F universe.
- **Exports:** from `@react-three/fiber` — `Canvas`, `useFrame`, `useThree`, `useLoader`, `useGraph`, `extend`, plus types `ThreeEvent`, `RootState`, `RenderCallback`; `export * as THREE from "three"`; from `@react-three/drei` — `OrbitControls`, `Billboard`, `Text`, `Html`, `useTexture`, `useGLTF`, `useAnimations`, `Float`, `MeshDistortMaterial`, `GradientTexture`; from `@react-three/postprocessing` — `EffectComposer`, `Bloom`, `Vignette`, `Noise`, `ChromaticAberration`.
- **Reads / depends on:** four prod deps: `@react-three/fiber`, `three`, `@react-three/drei`, `@react-three/postprocessing`.
- **Consumed by:** `src/components/chat/voice-orb-3d.tsx:4`, `src/components/hero-graph/scene.tsx:4`, `src/components/game/build-graph-scene.tsx:4,6`, `src/components/hero-avatar/{avatar-mesh,avatar-scene,avatar-controls,use-avatar-gaze,use-avatar-idle}.tsx|ts`.
- **Behaviour notes:** named exports only (`:12-13`) to avoid collisions between fiber / drei / postprocessing.
- **Gotchas / invariants:** `next.config.ts` records that this barrel "is load-bearing for the single-copy outcome" of the 876 KB three.js chunk. `src/components/hero-graph/scene-physics.tsx:4-6` imports `@react-three/fiber` and `three` **directly**, bypassing the barrel — the only such file found. It is also the only import site for `@react-three/drei` and `@react-three/postprocessing` in the whole repo, so deleting a re-export here silently breaks consumers with no other path to the symbol.

### `src/app/api/mcp/[transport]/route.ts`
- **Role:** the sole consumer of `mcp-handler` (and therefore the sole reason `@modelcontextprotocol/sdk` is declared).
- **Exports:** `maxDuration = 30` (`:9`); `handler as GET`, `handler as POST`, `handler as DELETE` (`:129`).
- **Reads / depends on:** `mcp-handler` (`:1`), `@/lib/mcp-tools` (`:2`, which brings `zod`).
- **Consumed by:** external MCP clients at `https://anvilry.vercel.app/api/mcp/mcp`.
- **Behaviour notes:** registers **9** tools (`:30-117`): `get_profile`, `list_projects`, `get_project`, `list_work`, `get_work`, `search_experience`, `get_resume_variant`, `list_all_content`, `get_content_item`. `wrap()` (`:12-19`) sets `isError: true` when a tool result contains a `notFound` key. `{ basePath: "/api/mcp", disableSse: true }` (`:126`).
- **Gotchas / invariants:** `disableSse: true` is a dependency-level guard — without it a GET to `/api/mcp/sse` "falls through to mcp-handler's Redis init, which throws `redisUrl is required` → an unhandled 500 in prod (this project uses Upstash REST, not REDIS_URL/KV_URL)" (`:120-126`). Also: `CLAUDE.md` documents **7** tools; the code registers **9** — the two content tools are undocumented there. The `export const runtime = "nodejs"` line was deleted for `cacheComponents` (`:6-8`); Node is still what runs, being the default.

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
- **Gotchas / invariants:** (1) Dependabot reads this file **only from the default branch** — `CHANGELOG.md:57-58` records that the `typescript`/`eslint` ignores added on `develop` were inert until commit `6cbff5d` landed them on `main`. (2) Security updates ignore `target-branch` entirely and are routed to the default branch — commit `2f309d2` corrects an earlier mistaken read that PR #114 (pdfjs-dist) was "anomalous" for targeting `main`. (3) The `@react-three/postprocessing` ignore is scoped to the single version `["3.0.5"]` so 3.0.6+ still flows.

### `.github/workflows/ci.yml`
- **Role:** the gate that makes the dependency graph reproducible.
- **Exports:** n/a.
- **Reads / depends on:** pnpm 10, Node 22, secret `SECURITY_ALERTS_TOKEN`.
- **Consumed by:** every push (`branches: ["**"]`) and PRs to `develop`/`main`.
- **Behaviour notes:** three jobs. `ci` — install → `pnpm content` → `pnpm lint` → `npx tsc --noEmit` → `pnpm test`; the `pnpm content` step exists because `.velite/` is gitignored and must be generated before tsc/vitest, mirroring the production build order. `e2e` — installs Chromium pinned to the installed `@playwright/test`, runs `pnpm build`, then `pnpm e2e` (needed because `webServer` runs `pnpm start`). `security-alerts` — prints open advisory counts into the job summary.
- **Gotchas / invariants:** `security-alerts` is `continue-on-error: true` **by design** and the comment documents a hard platform limit: the default `GITHUB_TOKEN` cannot read the Dependabot alerts API even with `security-events: read` declared — the restriction is on token *type*, so a fine-grained PAT with `Dependabot alerts: Read-only` must be stored as `SECURITY_ALERTS_TOKEN` or the step prints setup instructions and exits 0. Commit `08935fa` ("security-alerts job was passing while reporting NOTHING") is the fix for the earlier silent-green version.

## Coverage

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
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
- `.github/workflows/bundle-analysis.yml`
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
- `e2e/views.spec.ts`
- `e2e/resume.spec.ts`
