# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **AGENTS.md warning applies here.** This is Next.js 16 — APIs, file conventions, and RSC behaviour differ from training data. Before writing any Next.js code, check `node_modules/next/dist/docs/` for the authoritative reference on whatever you are touching.

> **Snapshot.** This file describes Anvilry v3.9.0 (`package.json` version 3.9.0), i.e. `main` at `a929932` (`package.json` version 3.6.0) **plus ten post-`a929932` behavioural changes** (the first five shipped in v3.7.0, (6) and (7) in v3.8.0, (8) and (9) in v3.9.0; (10) is on `develop` and not yet released): (1) notes are hidden at the data layer while `NEXT_PUBLIC_NOTES_ENABLED` is off; (2) rate limiting is per-class (`chat` / `voice` / `beacon`) with a `CRON_SECRET` bypass for the eval cron; (3) admin auth is one shared `isAdminAuthorized` (proxy, `requireAdmin`, telemetry page) and cron auth is one shared `src/lib/cron-auth.ts`; (4) command-palette talk-mode is gated by `isVoiceViewActive`; (5) the bundle gate's `MIN_ROUTES` is 17 and verified-dead components were removed; and, added in v3.8.0, (6) an IAM-denied model (a 403 naming a per-model deny) falls through to the next rung instead of ending the chain, and (7) `LLM_USE_SONNET_5_5` opts in to Claude Sonnet 5.5 as the primary rung; and, added in v3.9.0, (8) the model and provider line under chat answers is removed, and (9) the Konami-code easter egg is removed (the optional discovery badge now counts to 4); and, unreleased, (10) the fallback chain puts Sonnet 4.6 behind a 5.x primary and makes Opus opt-in (`LLM_USE_OPUS_FALLBACK`), Sonnet 5.x streams a readable reasoning summary at effort `medium` (`LLM_THINKING_EFFORT`), and `cost_usd` comes from the verified per-model price table in `src/lib/llm-pricing.ts`. Source is the truth; when a number below disagrees with the code, fix this file. Prefer the symbol names and the `grep` recipes here over line numbers — `docs/index/` carries the line-level citations and is gated by `scripts/check-index-citations.mjs`.

---

## Commands

```bash
# Development
pnpm install
pnpm dev                   # starts Velite watch + Next.js dev @ localhost:3000

# Build (Velite + tests + Next.js + Pagefind, in that order)
pnpm build
# == velite --clean && vitest run && next build && pagefind ...  (package.json "build")
# a failing Vitest test therefore blocks the deploy; Pagefind is the LAST step

# Bundle attribution — LOCAL tool only, never in CI. `--webpack` is REQUIRED: a bare `next build`
# is Turbopack, which @next/bundle-analyzer cannot hook. Writes .next/analyze/{client,edge,nodejs}.html.
# NOTE: a --webpack build does NOT emit .next/diagnostics/route-bundle-stats.json, so
# `node scripts/bundle-budget.mjs` correctly fails after this — re-run `pnpm build` before the gate.
pnpm analyze               # velite --clean && ANALYZE=true next build --webpack

# Testing
pnpm test                  # vitest run once
pnpm test:watch            # vitest interactive watch mode
npx vitest run src/lib/llm.test.ts          # single file
npx vitest run -t "corpus"                  # single test by name

# Lint
pnpm lint                  # eslint (flat config, no --fix by default)

# Content regeneration (when MDX changes aren't picked up by watch)
pnpm content               # velite --clean

# Pagefind search index — already the last step of `pnpm build`; re-run it alone with:
# NOTE: this is a Makefile target only — there is NO `pnpm search-index` script.
make search-index          # == pnpm pagefind --site .next/server/app --output-path public/pagefind

# Cache wipe (all build artifacts)
pnpm clean

# Makefile convenience wrappers
make dev / make build / make test / make lint
make new-work SLUG=my-case-study     # scaffold work MDX
make new-project SLUG=my-oss-repo    # scaffold project MDX
make new-note SLUG=my-note           # scaffold note MDX
make new-article SLUG=my-post        # scaffold article MDX
make health                          # smoke-test PRODUCTION /api/chat (curl POST to PROD_URL, not localhost)
make trace TRACE_ID=abc123           # replay a request from Redis telemetry (scripts/replay-trace.mjs)
make deploy-prod                     # vercel deploy --prod
```

### Extended Makefile Targets

```bash
# Environment
make env-check             # audit which env vars are set (Bedrock, Redis, GCP TTS, admin, flags)
make env-setup             # step-by-step guide to bootstrap .env.local
make env-vercel            # pull Vercel production vars into local .env.local

# Feature flags
make flags-show            # print all NEXT_PUBLIC_* flags + current values
make flags-beast           # print unlock commands for all visual effects (orb bloom, ink, skill tree)
make flags-notes-on / flags-notes-off  # PRINT the vercel commands to enable/disable /notes (does not toggle anything itself)

# Observability
make logs                  # stream Vercel runtime logs
make logs-llm              # stream logs, grep LLM lines
make logs-flags            # stream logs, grep flag-resolution lines
make admin                 # open /admin/telemetry in browser

# Deployment / git
make deploy-preview        # trigger manual Vercel preview
make rollback              # rollback to previous Vercel deployment
make pr                    # open PR: current branch → develop
make pr-prod               # open PR: develop → main
make push                  # push current branch

# Content management
make resume-list / resume-open   # manage PDFs in public/resume/
```

---

## Branch Model & CI

**Branch topology:**
- `develop` — integration branch; all feature work targets this; Vercel Preview deploys
- `main` — production release branch; merged from `develop` via merge-commit PR; Vercel Production deploys. Not *strictly* develop-only: hotfix #109 landed on `main` directly, and Dependabot PRs #239/#240 were merged straight into it (`git log --first-parent main`). Both branches sit under one active repository ruleset (live GitHub read, 2026-09-29): no deletion, no force-push, PR required with 0 approvals, and **no required-status-checks rule**, so no CI job is a required check on either branch; classic branch protection is absent.

**Tag every merge to `main` that bumps `package.json`'s `version` field.** Tags and GitHub Releases silently stopped after v2.1.1 (2026-06-18) even though `package.json`/`CHANGELOG.md` kept advancing through v3.6.0 (2026-08-21) — an unnoticed process gap, not a deliberate policy change. Retroactively closed on 2026-09-17: `git tag vX.Y.Z <sha>` + `gh release create vX.Y.Z --generate-notes` for the 10 version-bump commits between v2.1.1 and v3.6.0 (confirmed via `git log -p -- package.json`, not from commit-message labels alone — several "chore(release): vX" commit messages in that range, e.g. v2.2.0 through v2.9.0, never actually changed `package.json`'s version field, so they were deliberately left untagged rather than fabricating tags for versions the codebase itself never called current). Going forward: the moment a merge to `main` changes `package.json`'s version, tag that exact commit and run `gh release create vX.Y.Z --generate-notes` before moving on — don't let it accumulate again.

**CI pipeline (`.github/workflows/`) — five workflows (`ls .github/workflows`):**
- `ci.yml` — runs on every push (any branch) + PRs to `develop`/`main`, in **five jobs**:
  - `ci` ("Lint · Type-check · Test"; pnpm 10, Node 22): `pnpm install` → non-blocking `pnpm audit --audit-level high` → `pnpm content` (generates the gitignored `.velite/`; mirrors the production build order, required before typecheck and vitest) → `pnpm lint` → `tsc --noEmit` → `pnpm test` → **`Codebase index citations`** (`node scripts/check-index-citations.mjs`, the `docs/index/` freshness gate; a CI step, deliberately *not* part of `pnpm build`, so a stale index fails the PR and never a production deploy) → **`Claims integrity chain`** (`npx tsx scripts/seal-claims.ts` verifies `data/integrity-chain.json`; on drift run `npx tsx scripts/seal-claims.ts --write` locally and commit the chain).
  - `claims-integrity-autocommit` — opt-in (runs only when repo variable `SEAL_CLAIMS_AUTO_COMMIT == 'true'`, after `ci`): seals a new chain entry and pushes it.
  - `e2e` ("E2E (Playwright)"): installs chromium + webkit, runs `pnpm build`, then the **bundle budget** gate (`node scripts/bundle-budget.mjs`, step "Bundle budget") on that same build — no second build — then `pnpm e2e`.
  - `install-pnpm-11` — `pnpm install --frozen-lockfile` under pnpm 11 must not modify a tracked file, and `pnpm-build-allowlist-consistency.test.ts` must pass (pnpm 11 replaced `onlyBuiltDependencies` with `allowBuilds`).
  - `security-alerts` — non-blocking Dependabot-alerts report; needs a PAT in the `SECURITY_ALERTS_TOKEN` secret to surface anything (the default `GITHUB_TOKEN` cannot read that API).
- `codeql.yml` — static JavaScript/TypeScript analysis on `develop` **and `main`** pushes/PRs + weekly.
  `main` is listed on purpose: a hotfix pushed straight to it used to deploy with no analysis.
- `dependency-review.yml` — dependency security check on PRs (blocks runtime-scoped high/critical CVEs *introduced in the diff* only; dev-only packages and pre-existing tree advisories do not fail it).
- `gitleaks.yml` — secret scan on `develop`/`main` pushes and PRs.
- `scorecard.yml` — OSSF Scorecard on `main` pushes + weekly + manual dispatch.

**Bundle budget gate.** `scripts/bundle-budget.mjs` reads `.next/diagnostics/route-bundle-stats.json` — written by `next build` with no flag, but **only under Turbopack** — and asserts three things: (1) the artifact lists at least `MIN_ROUTES` (17 = the 16 `page.tsx` routes + `/_not-found`) route records, so a changed diagnostics format fails loudly instead of the gate passing on nothing — fix the script, never lower `MIN_ROUTES`; (2) every route's first-load JS stays under `MAX_FIRST_LOAD_BYTES` (`1_336_000` B; a ceiling, not a baseline — the script's own comment measured `/` at 1,333,521 B on a dev box when it was last raised, ~2.5 KB of headroom, so even small additions to global UI can trip it); (3) three.js stays **off** the first-load critical path (marker-based on `WebGLRenderer`, constant `LAZY_MARKER`). A missing or malformed artifact exits 1 by design. The CI step deliberately carries **no** `continue-on-error` and **no** `if-no-files-found` — unmeasurable must mean red. Raise the ceiling in its own commit, quoting measured before/after bytes.

**`bundle-analysis.yml` is DELETED — do not re-add it.** It was green and empty for its entire life: 222 runs, 211 green, zero artifacts across the 25 most recent. Three independent causes, each sufficient. (1) `next build` in Next 16 is **Turbopack**, not webpack (`node_modules/next/dist/lib/bundler.js`, the `bundlerFlags.size === 0` branch — "The default is turbopack when nothing is configured" — sets `TURBOPACK='auto'`), and `@next/bundle-analyzer` is webpack-only: it prints "not compatible with Turbopack builds, no report will be generated" and returns a config whose `.webpack` is undefined, so the `ANALYZE=true` build produced nothing. The workflow's own comment asserted the opposite; that assertion was **false**. (2) The `nextjs-bundle-analysis` compare step (last published 2023) reads the Pages-Router `build-manifest.json.pages`, which is `{"/_app": []}` in this App Router app — even fully wired it emits `{"raw":0,"gzip":0}`, i.e. "this PR introduced no changes to the JavaScript bundle" on every PR forever. (3) `if-no-files-found: warn` plus `continue-on-error: true` made both failures invisible. No required-status-checks rule covers `develop` (see Branch topology above), so nothing required it.

---

## Architecture Overview

### The View System

The entire site is one Next.js App Router app that presents client-side switchable experiences from the same URL (`/`). The `View` union has **six** members (`type View` in `src/components/view-context.tsx`) and `ViewRouter` branches on all six (`src/components/view-router.tsx`; each optional view is additionally gated by `isViewEnabled`) — "four-view" describes the switcher's default *server-rendered* pill set, not the store:

| View | Switcher pill? | Description |
|---|---|---|
| `classic` | yes | SSG-rendered, SEO default — what crawlers and first-paint serve |
| `gamified` | yes | 3D WebGL graph explorer (React Three Fiber, lazy-imported) |
| `chat` | yes | AI chatbot grounded on the MDX content corpus |
| `developer` | yes | Keyboard-driven terminal with **32** commands in the `COMMANDS` registry (`src/components/game/terminal/commands.ts`): 28 visible (incl. `integrity`, the claims-integrity ledger) + 4 hidden eggs (`secret`, `personal` [alias of `secret`], `uses`, `now`). `COMMAND_NAMES` (autocomplete/`help`) lists visible commands only |
| `voice` | desktop only, post-hydration | Optional full-page two-way talk surface; normally unused (the default talk UI is a modal overlay). One-mic mutex (`src/components/chat/voice-surface-mutex.ts`): while this view is active (`isVoiceViewActive`) the overlay entry points stay inert — the header orb does nothing and the palette's "Start voice conversation" entry is not offered |
| `resume` | never | Recruiter view. Reached via Cmd+K → "Recruiter view" (`command-palette-content.tsx` calls `switchTo("resume")`; `command-palette.tsx` is only the thin dialog shell) or `?view=resume`. **Distinct from the standalone `/resume` page**, which renders `ResumeViewInline` and never touches the view store |

The switcher renders **4 pills server-side, then upgrades to 5 on desktop after hydration** on a default build — an unset `NEXT_PUBLIC_ENABLED_VIEWS` enables every optional view (`ALL_OPTIONAL` / `enabledSet` in `src/lib/enabled-views.ts`), and Voice is appended only when `mounted && !compact && isViewEnabled("voice")` (`src/components/view-switcher.tsx`; `src/components/view-router.tsx` is the view *renderer*, not the switcher). The compact/mobile instance stays at 4.

View state is managed via a **module-level external store** (`src/components/view-context.tsx`) using `useSyncExternalStore`. State lives outside React so it can be read synchronously on first render (prevents Classic→other flash on deep-linked `?view=` URLs). The server and first-client snapshot always return `classic` — SSR is always Classic for crawlers; the deep-link applies post-hydration via `<ViewQuerySync>`.

View switches reflect in `?view=` query params (no localStorage/cookie persistence — first load is always Classic by owner design).

### Route Tree

```
/ (SSG → ViewRouter → Classic | Chat | Gamified | Developer | Voice | Resume — see the View table)
├── /projects                    `use cache` + cacheLife("hours") (3600 s revalidate); live GitHub feed server-side
│   └── /[slug]                  same `use cache` + cacheLife("hours") with a live fetchRepo
├── /articles                    cross-posted + native articles
│   └── /[slug]
├── /notes                       ships DARK: 404 unless NEXT_PUBLIC_NOTES_ENABLED=true
│   └── /[slug]
├── /work
│   └── /[slug]
├── /decisions                   architecture-decision ledger (client page; src/lib/decisions.ts)
├── /resume                      print-optimized recruiter view
├── /search                      Pagefind static search
├── /stats                       GitHub/writing aggregate stats
├── /mcp                         MCP server documentation (no segment config; only exports `metadata`)
├── /about
├── /admin/telemetry             HTTP Basic Auth (proxy + page re-check); reads Upstash Redis
├── /.well-known/vercel/flags    Vercel Flags SDK endpoint
├── /llms.txt, /llms-full.txt    AI model discovery index / full grounding corpus
├── /feed.xml                    RSS/Atom
├── /{articles,notes,projects,work}/[slug].md   raw-markdown pretty URLs (own route.ts each; `next.config.ts` rewrites() also maps them to /api/md)
├── /api/resume.json
├── /api/chat                    LLM streaming; rate-limited (`chat` bucket); FAQ cache; telemetry (Node, 30s)
├── /api/mcp/[transport]         MCP server — GET/POST/DELETE; use /api/mcp/mcp (Node, 30s)
├── /api/tts                     AWS Polly TTS caching; rate-limited (`voice` bucket)
├── /api/tts-google              Google Cloud TTS caching; rate-limited (`voice` bucket)
├── /api/transcribe              AWS Transcribe STT; rate-limited (`voice` bucket)
├── /api/visit                   page visit tracking (own 1-per-IP-per-30-min limiter)
├── /api/error                   client-side error beaconing; rate-limited (`beacon` bucket)
├── /api/github/stats            GitHub aggregate feed; 1h cache is fetch-level `next.revalidate` (no segment `revalidate`)
├── /api/md/{articles,notes,projects,work}/[slug]   raw-markdown passthrough (4 handlers)
├── /api/admin/faq-cache/purge   POST; `requireAdmin` (Basic Auth) inside the handler — OUTSIDE the proxy matcher; not rate-limited (Node, 10s)
└── /api/cron/{eval,health-check,github-sync,seo-audit,content-audit}
                                 5 crons, ALL fail-closed on CRON_SECRET (vercel.json:3-7)
                                 (each route guards with `unauthorizedUnlessCron` from src/lib/cron-auth.ts)
```

27 `route.ts` handlers (19 under `src/app/api`, 8 elsewhere) and 16 `page.tsx` pages at this tree (`find src -name route.ts` / `-name page.tsx`).

All content routes generate per-route `opengraph-image.tsx` images.

**Runtime & duration — do not add `export const runtime`.** No route exports `runtime` anywhere in `src/`; the export was removed because `cacheComponents: true` (`experimental.cacheComponents` in `next.config.ts`) rejects its mere *presence* (see the note at the top of `src/app/api/mcp/[transport]/route.ts`). Routes therefore run on Next's default Node.js runtime. `maxDuration` is **per-route, not a uniform 30s**:

| maxDuration | Routes |
|---|---|
| 60 | `cron/eval`, `cron/seo-audit`, `cron/content-audit` |
| 30 | `chat`, `mcp/[transport]`, `cron/github-sync` |
| 25 | `cron/health-check` |
| 20 | `transcribe` |
| 15 | `tts`, `tts-google` |
| 10 | `admin/faq-cache/purge` |
| 5 | `error` |
| — | `visit`, `github/stats`, `md/*`, `resume.json` (no export) |

### Content Layer

All content (work case studies, OSS projects, notes, articles) lives in `content/` as MDX files. **Velite** processes them at build time into typed TypeScript collections in `.velite/`. The access layer is `src/lib/content.ts`.

```
content/{work,projects,notes,articles}/*.mdx
  → velite (Zod-validated schemas)
  → .velite/ (TypeScript + JSON)
  → src/lib/content.ts (typed access)
  → consumed by every view
```

No view owns its own copy of content. Every view derives from the same Velite output. The `game-model.ts` derivation layer builds the 3D graph; `corpus.ts` builds the chatbot grounding document. `decisions.ts` derives the architecture-decision ledger (`/decisions` page and the `list_decisions` MCP tool) from Project `decisions` and Work `constraints`/`tradeoffs` frontmatter. A build-time bijection test (`game-model.test.ts`) fails the deploy if any graph node is orphaned from real content.

**Velite quirk:** `predev` runs Velite synchronously before `next dev` starts; do not pass `--clean` in dev mode or you'll get a race where Turbopack tries to resolve a momentarily deleted `.velite/projects.json`. The `build` script passes `--clean` explicitly for a pristine production build.

**Notes accept both `.md` and `.mdx`** — the Velite schema makes the extended Inkforge frontmatter (`tone`, `format`, `length`, `wordCount`, `readingTime`, `generatedBy`, `platforms`) optional, so a hand-written note that omits those fields still compiles.

Note that **the extension does not indicate provenance**: there are 7 note files, and only 5 carry `generatedBy: inkforge` (`how-dns-works.mdx` and `how-i-traced-one-browser-request-…mdx` are `.mdx` *and* Inkforge; `trelix-code-intelligence-engine.mdx` and `tombstone-v1-2-release.mdx` are `.mdx` with no `generatedBy` field, so they do not count as Inkforge). Check with `grep -c "generatedBy: inkforge" content/notes/*`. Do not infer provenance from the extension.

**Notes are hidden at the data layer, not only at the routes.** `NOTES_ENABLED` (`NEXT_PUBLIC_NOTES_ENABLED`, default **off**, `src/lib/writing-flags.ts`) makes `allNotes` in `src/lib/content.ts` an empty array, so `llms.txt`, `feed.xml`, the sitemap, the chat corpus, the MCP tools and the `.md` handlers cannot list notes the `/notes` pages would 404. `publishedNotes` is the unconditional list and is used **only** by the `/notes` route files (`generateStaticParams` must return >=1 entry under `cacheComponents`); every other consumer reads `allNotes`. `inkforgeNotes` / `inkforgeArticles` derive from `allNotes`, so they are empty while notes are dark. While notes are dark, articles whose only destination is a note (`linkedNote` set and either no external URL or one pointing at our own `/notes/`) are dropped too.

**Articles support a `linkedNote` field** — when set to a note slug, the article card (`article-group-card.tsx`, grouping in `src/lib/article-grouping.ts`) links to the `/notes/[slug]` page instead of the external URL while `NOTES_ENABLED` is on (while notes are dark it falls back to the external URL). Use this for cross-posted content to avoid duplicate body rendering.

### LLM / Chat Architecture

`src/lib/llm.ts` is the single source of truth for the chatbot's AI layer:

- **Provider toggle:** `LLM_PROVIDER=bedrock` (default) or `LLM_PROVIDER=anthropic` (direct API).
- **Bedrock model chain** (`bedrockChain()`, built by `buildChain()`): `[primary, Opus if opted in, Sonnet 4.6, Haiku]` with repeats dropped. With no flags that is `us.anthropic.claude-sonnet-4-6` → `us.anthropic.claude-haiku-4-5-20251001-v1:0`; with a Sonnet 5.x primary, Sonnet 4.6 is the rung behind it, so a failing 5.x falls to the model it replaced (reachable on this account, with its own quota) before the weaker Haiku. **Opus is opt-in** (`LLM_USE_OPUS_FALLBACK=true`, `isOpusFallbackEnabled()`, exact string `"true"`): `us.anthropic.claude-opus-4-6-v1` then sits right behind the primary, where it used to be. It is off by default because this account IAM-denies the whole Opus family, so the rung could only ever answer 403 and cost a round trip on every fallback. Note: Opus 4.6 **requires** the `-v1` suffix — the bare ID 400s. `isFallbackEligible` advances on connection errors/timeouts, 429/404/5xx, a 400 whose message carries one of the `MODEL_UNAVAILABLE_MARKERS`, or a 403 whose message names a per-model deny — one of those markers or a `MODEL_DENIED_MARKERS` entry (`is not authorized to perform`, `explicit deny`: the IAM identity-policy wording). A credential/signature 403 (invalid or expired token) is not a per-model deny and still ends the chain with the apology tail. When the *primary* is the denied rung (for example the global Sonnet 5.5 profile when the IAM policy lacks it), expect the next allowed rung to answer with `fellBack: true` instead of an apology; the `llm.attempt` telemetry (`fell_back`, `attrs.status` 403) is the signal.
- **Direct-API chain** (`anthropicChain()`, `LLM_PROVIDER=anthropic`): the same shape with `claude-sonnet-4-6`, `claude-opus-4-7` (opt-in) and `claude-haiku-4-5`, i.e. `claude-sonnet-4-6` → `claude-haiku-4-5` by default.
- **`LLM_USE_SONNET_5=true`** (`isSonnet5PrimaryEnabled()`, default off) makes Sonnet 5 the primary rung on both chains (`us.anthropic.claude-sonnet-5` / `claude-sonnet-5`), with Sonnet 4.6 behind it. Sonnet 5 runs adaptive thinking *on by default* when `thinking` is omitted, so `streamWithFallback` always sends an explicit `thinking: {type: "disabled"}` (`{type: "between_tools"}` on the Sonnet 5.5 rung, next bullet) or, when extended thinking is on, `adaptiveThinking()` + `output_config.effort` from `thinkingEffort()` (see the reasoning bullet below); Haiku gets no `thinking` key. Extended thinking is on unless `EXTENDED_THINKING=false` (server, read in the chat route) / `NEXT_PUBLIC_EXTENDED_THINKING=false` (build-time, UI only: hides the reasoning panel in `chat-messages.tsx`; it does not change the model request).
- **`LLM_USE_SONNET_5_5=true`** (`isSonnet55PrimaryEnabled()`, default off, wins over `LLM_USE_SONNET_5`) makes Sonnet 5.5 the primary rung, with Sonnet 4.6 behind it: `global.anthropic.claude-sonnet-5-5` on Bedrock, `claude-sonnet-5-5` on the direct chain. Bedrock has **no `us.` profile** for it, and a `us.` id would 400 "model identifier is invalid", which `isFallbackEligible` reads as model-unavailable, so it would silently skip the primary instead of failing; the global profile also means requests may be processed outside the US regions, and IAM must allow it. 5.5 rejects `thinking: {type: "disabled"}` (400), so the thinking-off shape is per model (`thinkingOff()`): `{type: "between_tools"}` for 5.5, `{type: "disabled"}` for the rest; adaptive thinking is accepted (next bullet). Verified live against Bedrock on 2026-09-30 and again on 2026-10-01 through the app's own call path; the direct-API chain is unverified.
- **Reasoning on Sonnet 5.x** (`adaptiveThinking()`, `thinkingEffort()`): Sonnet 5 and 5.5 return a `thinking` block with EMPTY text unless the request says `display: "summarized"` (the default is `"omitted"`; the thinking tokens are billed either way), and at `effort: "low"` Sonnet 5.5 never thinks on this app's prompts (0 thinking tokens in 8 of 8 recruiter questions, measured 2026-10-01), so the reasoning panel stayed empty. Sonnet 5.x therefore sends `{type: "adaptive", display: "summarized"}` + `effort: "medium"` and reasons on the harder questions only, for about $0.0006 more per question on average. Live, through the app's own call path: no reasoning on "What is your current role?", a 383-character summary (and 7.5 s instead of 2 s) on a pitch-to-a-bank's-risk-team question. Every other thinking-capable rung keeps `{type: "adaptive"}` + `effort: "low"`, exactly the request it has always sent. `LLM_THINKING_EFFORT` (`"low"` or `"medium"`, lower case, exact; anything else is ignored) overrides the effort on every thinking-capable rung. `"high"` is refused on purpose: the 2048-token floor on `max_tokens` (shared by reasoning and answer) was sized for low and medium.
- **Per-attempt timeout:** `PER_ATTEMPT_TIMEOUT_MS` = 15 s per model attempt.
- **Fallback invariant:** Streaming errors surface inside the `for await` loop (never at `.stream()`). The only reliable guard for "can we still fall back?" is whether bytes have already been sent to the client. Once `emittedAny = true`, any subsequent error appends an apology and closes the stream — no retry.
- **Credential handling:** `BEDROCK_ACCESS_KEY_ID` / `BEDROCK_SECRET_ACCESS_KEY` are stored base64-encoded. `decodeSecret()` performs a round-trip equality check to detect base64 vs. raw keys without false-positives. Use `BEDROCK_REGION` (not `AWS_REGION` — Vercel mangles the reserved name in production).
- **Telemetry:** Each model attempt emits an `LlmAttempt` span via `onAttempt` callback. The chat route uses this to write structured `llm.attempt` events for the dashboard.
- **Cost telemetry** (`src/lib/llm-pricing.ts`): `cost_usd` on each `llm.attempt` event comes from `costUsd(model, usage)`, a table of AWS's own on-demand list prices (AWS Price List offer `AmazonBedrockFoundationModels`, version 20260930001912, us-east-1, USD per million tokens) keyed by exact model id. `us.` ids are billed at the Regional CRIS rate (10% over Global) and `global.` ids at the Global rate, which is why Sonnet 5.5 (`global.`, $2 / $10) is not dearer than Sonnet 4.6 (`us.`, $3.30 / $16.50) even though the same prompt is 45% more tokens (5247 vs 3618 cached tokens): measured 2026-10-01, a turn cost 14% / 21% less (cold / warm cache) on 8 questions at effort `low`, and from 17% less to 4% more on 3 questions at `medium`. Cache writes are priced at the 1 h rate because `CACHE_WRITE_TTL`, which the route also uses for its `cache_control`, is `"1h"`. A model with no row (every direct-API id) returns `null` and the event carries no `cost_usd` rather than a figure at another model's rate; `src/lib/llm-pricing.test.ts` fails if any model id `modelChain()` can produce under any flag combination has no row. The dashboard's "saved by caching" sums `cacheReadSavingsUsd()` per attempt (full input price minus the cache-read price, before the cache-write premium).
- **Prompt caching:** the chat route sends up to two system blocks — the byte-stable corpus prompt (`staticSystemPrompt(corpus)`, `cache_control` ephemeral with a 1 h TTL) and, when the stats fetch succeeds, after the cache breakpoint and uncached, the hourly live GitHub stats. Keep live data OUT of the static block or every refresh invalidates the cached prefix.

**FAQ response cache** (`src/lib/chat-cache.ts`, `src/lib/faq-embeddings.ts`): first-turn `/api/chat` questions are served from Upstash with zero Bedrock spend. Exact tier (normalized-question hash, default on; `FAQ_CACHE_ENABLED=false` kills it) then an optional semantic tier (`FAQ_CACHE_SEMANTIC_MATCH=true`; Titan embeddings v2, cosine `SIMILARITY_THRESHOLD` 0.92, index capped at `FAQ_CACHE_INDEX_CAP` = 500). TTL `FAQ_CACHE_TTL_SECONDS` = 24 h; only clean `end_turn` completions ≤ `MAX_CACHEABLE_ANSWER_CHARS` (4000) answered by the primary rung are stored (a `fell_back` answer is never written through, so a transient Sonnet outage is not replayed for 24 h); entries are tagged with `anvilry:corpus:built_at` so a content deploy invalidates them. Requests with an `X-Chat-Skip-Cache` header (the weekly eval cron sends it) bypass it; every lookup emits a `chat.cache` telemetry event, and a hit is returned as answer + U+001E + a trace frame with `cacheHit: true` (header `X-Chat-Cache: hit`). Purge one question with `POST /api/admin/faq-cache/purge` (Basic Auth, `{"question": "<=2000 chars>"}`). Known accepted gap: the gate checks completion cleanliness, not content safety.

The chatbot grounding is the **in-context corpus** (`src/lib/corpus.ts` `buildCorpus()`; 9,133 chars measured with default flags/notes dark, ~11 KB with notes on — the `~4KB` in the `corpus.ts` docblock is stale). No vector DB at this scale. The model can emit `[[card:work:slug]]` intent tokens; the client validates slugs against a build-time allowlist before rendering — this is the structural zero-fabrication guard.

### MCP Server

`/api/mcp/[transport]` exposes the portfolio as a read-only MCP server (HTTP Streamable, legacy SSE disabled). Public endpoint: `https://anvilry.vercel.app/api/mcp/mcp`.

**10 tools** (all sourced from `src/lib/mcp-tools.ts`, transport-agnostic pure functions):

| Tool | Description |
|---|---|
| `get_profile` | Identity, headline, links, skills, achievements |
| `list_projects` | All OSS projects |
| `get_project` | Single project by slug |
| `list_work` | All case studies |
| `get_work` | Single case study by slug |
| `search_experience` | Keyword search across work, projects, skills |
| `get_resume_variant` | The canonical résumé PDF URL (`master`) |
| `list_all_content` | Flat list of every work item, project, article and note — slug, name, summary, URL |
| `get_content_item` | One content item by `type` (`work \| project \| article \| note`) and slug |
| `list_decisions` | Architecture-decision entries across all projects/work, optionally filtered by tag |

`src/app/mcp/page.tsx` renders the public `TOOLS` table — the documentation contract for
this server. It is hand-maintained, but **enforced**: `src/app/mcp/tools-documented.test.ts`
asserts the documented set and the route's `registerTool` calls are identical, and because
`vitest run` is chained into `pnpm build`, adding a tool without documenting it fails the build
with the missing names in the message. So the count above is safe to quote.

Deliberately excludes `personal.ts` (hobbies) — professional-only surface. Tools return `isError: true` with valid options on not-found rather than fabricating.

**Configuration:**
```
# Claude Desktop
npx -y mcp-remote https://anvilry.vercel.app/api/mcp/mcp

# Cursor (direct HTTP)
https://anvilry.vercel.app/api/mcp/mcp
```

### Voice Layer

Voice is pure progressive enhancement — all capabilities default off and fail closed to the browser baseline:

- **STT path:** Web Speech API (browser, free, default) → optional AWS Transcribe (flag-gated)
- **TTS path:** `speechSynthesis` (browser, free, per-sentence) → optional AWS Polly Neural → optional Google Cloud TTS
- Settings live in `src/lib/voice-settings-context.tsx` (there is no `voice-settings.ts`); the voice catalog is `src/lib/voice-catalog.ts`; the full voice reference is `VOICE.md`

### 3D Graph

Two separate R3F canvases, both lazy (`dynamic(..., { ssr: false })`), both `frameloop="demand"`, neither in the LCP critical path:
- `src/components/hero-graph/` — the **Classic hero backdrop** (mounted from `home/hero.tsx` only while Classic is active and motion is not reduced). Every node is one `InstancedMesh` (one draw call).
- `src/components/game/build-graph.tsx` → `build-graph-scene.tsx` — the **Play (`gamified`) view** canvas (`OrbitControls`, hover ease that `invalidate()`s only while animating). `hero-graph/` is *not* the Play view.
- `src/lib/r3f.ts` is a single barrel for the whole R3F/three surface — it is load-bearing for keeping three.js to **one** copy in the bundle; import R3F/three through it, never directly. (Known exception: the flag-gated `hero-graph/scene-physics.tsx` imports `@react-three/fiber` / `three` directly and sets `frameloop="always"`, so it does not share the barrel's single-copy guarantee or the demand loop.) The single-copy measurement in the "R3F TWIN-CHUNK" comment in `next.config.ts` (876 KB) is a genuine **Turbopack** measurement — 897,249 B exactly (comment above `LAZY_MARKER` in `scripts/bundle-budget.mjs`); only the old attribution to webpack was wrong. CI now asserts it stays lazy: `scripts/bundle-budget.mjs` fails if `WebGLRenderer` appears in any route's first-load chunk set

**Two dependencies were declared but never imported — both removed in v3.5.0:**
- `@react-three/offscreen` — no worker/OffscreenCanvas ever existed; the "worker offload" this file previously claimed was never real. The CSP still carries `worker-src 'self' blob:` (`next.config.ts`) for a worker that was never there.
- `@react-three/rapier` — `NEXT_PUBLIC_GRAPH_PHYSICS=true` loads `hero-graph/scene-physics.tsx`, which is plain sinusoidal `useFrame` maths (position set from `Math.sin`/`Math.cos` each frame), not a physics engine. **The flag and filename remain and are historical** — the flag still works, it just never involved a physics engine.

### Rate Limiting & Telemetry

- `src/lib/rate-limit.ts` `checkRateLimit(req, cls)` keeps **three independent Upstash sliding-window buckets** — `chat`, `voice`, `beacon` — each 8 requests / 60 s per IP (key prefixes `anvilry:chat`, `anvilry:voice`, `anvilry:beacon`), so one class cannot starve another. `/api/chat` uses `chat`; `/api/tts`, `/api/tts-google`, `/api/transcribe` use `voice`; `/api/error` uses `beacon`; `/api/visit` has its own separate 1-per-IP-per-30-min limiter; the admin purge route is deliberately unlimited. `cls` is a required argument so a route can never silently share another class's bucket.
- **Fail-open:** no limiter when Upstash is unconfigured, and any limiter error lets the request through. A request bearing a valid `CRON_SECRET` bearer (`hasValidCronSecret`) bypasses the limiter — the weekly eval cron fires 12 sequential chats and would otherwise self-throttle. Production without Upstash logs a loud warning at module load.
- Cron auth is one helper, `src/lib/cron-auth.ts` (`hasValidCronSecret` / `unauthorizedUnlessCron`): SHA-256 digests compared with `timingSafeEqual`, fail-closed when `CRON_SECRET` is unset. All five cron routes use it.
- Telemetry uses a dual-sink strategy: Vercel Runtime Logs (permanent) + Upstash Redis sorted sets (7-day retention, queryable; the retention trim runs on ~1-in-20 emits). Event kinds (`KIND_LITERALS` in `src/lib/telemetry/schema.ts`): `http.request`, `llm.attempt`, `tts.request`, `transcribe.request`, `client.error`, `server.error`, `budget.tick`, `chat.cache`. The `/admin/telemetry` dashboard is HTTP Basic Auth–protected via `ADMIN_PASSWORD`.
- `src/proxy.ts` (matcher `/admin/:path*`) is the first-filter auth gate for `/admin/*`. Next 16 proxies run on the **Node.js runtime** by default, so it shares `isAdminAuthorized` from `src/lib/admin-auth.ts` (SHA-256 digests compared with `timingSafeEqual`) with `requireAdmin` (route handlers — currently the FAQ-cache purge route, which sits *outside* the proxy matcher) and the `/admin/telemetry` page, which re-checks auth itself and calls `notFound()` when unauthorized. An unset `ADMIN_PASSWORD` denies everything.

### Feature Flags

Two mechanisms — choose based on how fast you need the toggle:

| Mechanism | How | Latency |
|---|---|---|
| `NEXT_PUBLIC_*` env vars | Build-time; set in Vercel dashboard → redeploy | Minutes |
| Vercel Flags SDK | Runtime; set `FLAG_DRIVER=vercel` → instant | Seconds |

Key flags: `NEXT_PUBLIC_DISCOVERY_BADGES`, `NEXT_PUBLIC_OPEN_TO_WORK`, `NEXT_PUBLIC_GITHUB_STATS_ENABLED`, `NEXT_PUBLIC_ANVIL_ORB_MODE`, `NEXT_PUBLIC_INK_TRANSITION`, `NEXT_PUBLIC_SKILL_TREE`, `NEXT_PUBLIC_NOTES_ENABLED` (default off — gates the whole notes corpus, see Content Layer), `NEXT_PUBLIC_ENABLED_VIEWS`. Run `make flags-show` to see all current values.

---

## Key Files

| File | Role |
|---|---|
| `src/lib/llm.ts` | LLM provider abstraction, model chain, streaming fallback loop |
| `src/lib/llm-pricing.ts` | Verified per-model price table: `costUsd()` for `llm.attempt.cost_usd`, `cacheReadSavingsUsd()` for the dashboard tile, `CACHE_WRITE_TTL` |
| `src/components/view-context.tsx` | 6-view external store (`View` union) + view transitions |
| `src/components/view-router.tsx` | Renders the active view (branches on all six, gated by `isViewEnabled`) |
| `src/components/view-switcher.tsx` | The view switcher pills (4 server-side, +Voice on desktop after hydration) |
| `src/lib/corpus.ts` | Chatbot grounding corpus (built from Velite output) |
| `src/lib/game-model.ts` | 3D graph derivation layer + content-coverage assertions |
| `src/lib/content.ts` | Velite typed-access layer (`allNotes` is empty while `NOTES_ENABLED` is off; `publishedNotes` is unconditional, `/notes` routes only) |
| `src/lib/mcp-tools.ts` | Pure MCP tool implementations (transport-agnostic) |
| `src/lib/chat-cache.ts`, `src/lib/faq-embeddings.ts` | FAQ response cache for `/api/chat` (exact + optional semantic tier) |
| `src/lib/decisions.ts` | Architecture-decision ledger derived from project/work frontmatter (`/decisions`, `list_decisions`) |
| `src/lib/claims-integrity.ts`, `data/integrity-chain.json`, `scripts/seal-claims.ts` | Hash-chained resume claims; verified in CI, surfaced by the `integrity` terminal command |
| `src/lib/agent-trace.ts` | Glass-box agent demo; `PLACEHOLDER_SENTINEL` shipping gate |
| `src/lib/voice-settings-context.tsx` | Persisted voice prefs (external store, localStorage) |
| `src/lib/voice-catalog.ts` | Authoritative voice catalog for all engines |
| `src/lib/rate-limit.ts` | Per-IP Upstash rate limiter: `chat` / `voice` / `beacon` buckets, `CRON_SECRET` bypass (fails open) |
| `src/lib/cron-auth.ts` | Shared fail-closed `CRON_SECRET` bearer check used by every cron route and the rate limiter |
| `src/lib/admin-auth.ts` | `isAdminAuthorized` / `requireAdmin` — the one Basic Auth compare (proxy, purge route, telemetry page) |
| `src/lib/redis.ts` | Upstash Redis singleton (shared by rate-limit, telemetry, admin) |
| `src/lib/flags.ts` | Feature flag resolver (build-time env vs. Vercel Flags SDK runtime) |
| `src/proxy.ts` | Node-runtime HTTP Basic Auth gate for /admin/* (shares `isAdminAuthorized` with `src/lib/admin-auth.ts`) |
| `velite.config.ts` | Content schemas (Zod) — Work, Project, Note, Article |
| `next.config.ts` | CSP headers (enforced), security, Turbopack, experimental flags; the export is wrapped in `@next/bundle-analyzer` (`withBundleAnalyzer`) — inert unless `pnpm analyze` (`ANALYZE=true` + `--webpack`), do not delete as dead code. The top docblock still says the CSP "shipped as Report-Only first"; that is stale — `securityHeaders` sets the enforced `Content-Security-Policy` |
| `src/app/api/chat/route.ts` | LLM streaming endpoint |
| `src/app/api/mcp/[transport]/route.ts` | MCP server (10 read-only tools) |
| `src/instrumentation.ts` | Next.js instrumentation hook (config snapshot on cold start; stamps `anvilry:corpus:built_at` for the FAQ cache) |
| `src/instrumentation-client.ts` | Browser error beaconing + web-vitals reporting |

---

## Environment Variables

Minimum for local chat to work:

```bash
LLM_PROVIDER=bedrock
BEDROCK_ACCESS_KEY_ID=<base64 or raw>
BEDROCK_SECRET_ACCESS_KEY=<base64 or raw>
BEDROCK_REGION=us-east-1
```

Optional (voice, rate limiting, telemetry, caching):

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
GOOGLE_TTS_API_KEY=...
ADMIN_PASSWORD=...                    # /admin/telemetry dashboard + /api/admin/faq-cache/purge (unset = locked out)
NEXT_PUBLIC_ANVIL_ORB_MODE=inplace    # build-time feature flags
CRON_SECRET=...                       # ALL five /api/cron/* routes fail closed on it (401 when unset); also the rate-limit bypass for the eval cron
```

Other variables the code reads (full commentary is in `.env.example`; `make env-check` reports which are set):

| Variable | Effect |
|---|---|
| `LLM_USE_SONNET_5` | `"true"` → Sonnet 5 becomes the primary rung on both chains (default off) |
| `LLM_USE_SONNET_5_5` | `"true"` → Sonnet 5.5 becomes the primary rung on both chains and wins over `LLM_USE_SONNET_5` (default off; on Bedrock it is the global profile) |
| `LLM_USE_OPUS_FALLBACK` | `"true"` → adds Opus (`us.anthropic.claude-opus-4-6-v1` / `claude-opus-4-7`) to the chain right behind the primary (default off: this account IAM-denies Opus, so the rung could only answer 403) |
| `LLM_THINKING_EFFORT` | `"low"` or `"medium"` overrides the reasoning effort on every thinking-capable rung; unset → `medium` for Sonnet 5.x, `low` for the rest; any other value (`"high"` too) is ignored |
| `EXTENDED_THINKING` / `NEXT_PUBLIC_EXTENDED_THINKING` | `EXTENDED_THINKING="false"` (server, per request) sends `thinking: {type: "disabled"}` (`between_tools` on the Sonnet 5.5 rung); `NEXT_PUBLIC_EXTENDED_THINKING="false"` (build-time) only hides the reasoning panel — independent, so set both to switch reasoning off end to end |
| `ANTHROPIC_API_KEY` | required when `LLM_PROVIDER=anthropic` |
| `BEDROCK_SESSION_TOKEN` | optional STS session token (base64-decoded like the other Bedrock creds) |
| `FAQ_CACHE_ENABLED` | `"false"` kills the `/api/chat` FAQ cache |
| `FAQ_CACHE_SEMANTIC_MATCH` | `"true"` adds the Titan-embedding semantic tier (one extra `InvokeModel` per exact-tier miss for the lookup, plus one more when the clean answer is written through) |
| `GITHUB_TOKEN` | optional GitHub API auth for `/api/github/stats` and the `src/lib/github.ts` repo feed behind `/projects` (raises the rate limit); the chat prompt's live-stats block degrades to omitted when the fetch fails (fail-open) |
| `TELEMETRY_ENABLED` | `"false"` makes `/api/error` return 204 before it records the client error (the `withTrace` wrapper still emits that request's `http.request` span); server-side `emit()` does not read it |
| `TELEMETRY_IP_SALT` | salt for hashing client IPs in telemetry; unset → IPs are recorded as `"anonymous"` |
| `FLAG_DRIVER`, `FLAGS_SECRET`, `FLAGS` | Vercel Flags SDK driver (`vercel` \| `local`), override-cookie signing secret, SDK connection string |
| `NEXT_PUBLIC_LLM_SDK` | Bedrock SDK selector (`anthropic-bedrock` default) |
| `VERCEL_PROJECT_PRODUCTION_URL` | production host used by the health-check cron's probe base |
| `NEXT_PUBLIC_GRAPH_PHYSICS` | loads the (non-physics) `scene-physics.tsx` hero variant; not in `.env.example` |

Pull production env vars with: `vercel env pull .env.local`

**Critical gotcha:** Never use `AWS_REGION` — Vercel corrupts it to `s-east-1` in production (missing the `u`). Always use `BEDROCK_REGION`.

**Custom domain:** `https://anvilry.vercel.app` is hardcoded across `src/` and the `Makefile` — **24 files / 33 occurrences** at this tree, of which 4 files (`src/lib/mcp-tools.test.ts`, `notes-dark.test.ts`, `rate-limit.test.ts`, `health-expectations.test.ts`) are tests that assert against the same host, so they must change with the rest or the suite goes red. Not all occurrences are a "base URL" constant (some are prose or comments); the load-bearing ones are the base-URL constants (`const BASE` / `BASE_URL` / `base` / `siteUrl`, `ENDPOINT` in `mcp/page.tsx`, `OWN_NOTES_URL_PREFIX` in `content.ts`, an inline string in `robots.ts`) — `layout.tsx`, `sitemap.ts`, `robots.ts`, `mcp/page.tsx`, the four `[slug]/page.tsx`, `feed.xml/route.ts`, `src/components/json-ld.tsx`, and `src/lib/{llms-txt,resume-json,mcp-tools,content}.ts` — plus `PROD_URL` in the `Makefile`; the root and `articles`/`notes`/`work` `[slug]` `opengraph-image.tsx` files only print the bare hostname as visible text, and `health-expectations.ts` mentions it in a comment. Find every site with:

```bash
grep -rn 'anvilry\.vercel\.app' src Makefile
```

Run the grep rather than trusting any list here — it is the only thing that cannot go stale.

---

## Content Authorship Rules

Every content file must reflect honest contribution registers. The `register` field on Work items (e.g. `"Co-built · architected the backend"`) is the canonical source for contribution attribution — never fabricate ownership claims. Metrics must be real; the corpus test fails if required fields are missing.

Work frontmatter supports optional `constraints`, `tradeoffs`, and `diagram`/`diagramAlt` fields for hiring-manager depth — these render only when present, so existing case studies are unchanged until filled.

---

## Testing Notes

- `game-model.test.ts` asserts a bijection between graph nodes and content items — it **blocks deploys** if orphaned. Run it whenever you add or rename content. Three node IDs intentionally differ from their slugs: `aava` → `aava-code`, `grpc` → `grpc-microservices`, `nhl` → `not-humans-lab` — this is by design, not a bug.
- **The prompt-injection / XSS guard is `src/components/chat/parse-cards.test.ts`** — do not weaken or skip it. It pins the fail-closed behaviour of the card-token path: an unknown/hallucinated slug is dropped entirely (`DROPS an unknown/hallucinated slug`), a malformed token kind is ignored, an injected URL or path can never become an `href` because the slug charset is locked, and raw HTML/`<script>` stays inert text.
  (`src/components/ask-portfolio.dom.test.tsx` — note the `.tsx` extension — is **not** this guard. It has exactly two tests — shared-transport streaming (`streams an assistant answer through the shared transport`) and the 503 not-configured message — and contains zero injection or XSS assertions.)
- `llm.test.ts` pins the snake_case usage field names from the Anthropic SDK (`input_tokens`, not `inputTokens`). A future SDK update that returns camelCase would silently zero out token telemetry; this test is the regression guard.
- `agent-trace.test.ts` does **not** block shipping — it is a *consistency* check. The assertion is `expect(traceApproved).toBe(!hasSentinel)` (`src/lib/agent-trace.test.ts:56`), which passes in both states: sentinel present ⇔ not approved. `src/lib/agent-trace.ts:118` says so outright ("NOT a hard build failure"), and the file's header banner now says the same — it previously claimed the test "BLOCKS shipping", which is what sent this doc wrong in the first place.
  What actually happens: `PLACEHOLDER_SENTINEL` (`"[DRAFT — owner to approve]"`) is currently present, so `traceApproved === false` and `src/components/game/glass-box-demo.tsx:40` returns `null` — the demo ships **dark**, nothing is blocked. Replacing the draft prose lights it up; the test keeps the flag honest either way.
- **Vitest runs two projects:** `node` (default, `src/**/*.test.{ts,tsx}` except `*.dom.test.*`) and `dom` (happy-dom environment, all `*.dom.test.*`). At this tree: 95 test files under `src/` (none elsewhere), 917 tests, all passing (Vitest 5.0.0, ~28 s); `e2e/` holds 2 Playwright specs that Vitest does not run. `NODE_ENV` is forced to `"test"` to prevent React's missing `act()` warning in the production-default Node environment.
- Tests run as part of `pnpm build` — a failing test blocks deployment.
- The `vitest run` step sits between `velite --clean` and `next build` in the `build` script, so a red test also skips the Next build and the Pagefind index.
- Regression guards for the recent hardening, all in the Vitest suite: `src/lib/notes-dark.test.ts` (no surface lists notes while `NOTES_ENABLED` is off), `src/lib/rate-limit.test.ts` (per-class buckets, `CRON_SECRET` bypass, fail-open), `src/lib/cron-auth.test.ts` and `src/lib/admin-auth.test.ts` (fail-closed / constant-time compares), `src/lib/llm-pricing.test.ts` (every model id the chain can produce under any flag combination has a verified price row).

---

## Skills (Loop-Engineer Harness)

Skills live in `.claude/skills/` and are available as slash commands in Claude Code.

| Skill | Command | When to use |
|---|---|---|
| **dev-local** | `/dev-local` | Start/stop/verify the local dev stack — Anvilry-specific launcher |
| **pr** | `/pr` | Prove a feature works (fresh verifier sub-agent drives the app) then open PR |
| **e2e-setup** | `/e2e-setup` | Add or extend the Playwright E2E suite (`e2e/` package) |
| **new-loop** | `/new-loop` | Bootstrap the knowledge base and create a new compounding agent loop |
| **setup-codebase-harness** | `/setup-codebase-harness` | Master harness skill — orchestrates the others |

### E2E Tests
```bash
pnpm e2e          # run Playwright tests — `playwright.config.ts` starts its own server via `pnpm start`,
                  # so a PRODUCTION BUILD (`pnpm build`) must exist first; no dev server needed
pnpm e2e:ui       # interactive Playwright UI mode
```

E2E specs live in `e2e/` (`views.spec.ts`, `resume.spec.ts`); the config runs two projects, `chromium` (Desktop Chrome) and `mobile-safari` (iPhone 13). The suite covers the classic, chat, developer and gamified views, the `/decisions`, `/mcp` and `/resume` pages, SEO routes (llms.txt, sitemap.xml, robots.txt) and the `resume.json` API smoke test. In CI it runs in the `e2e` job after the build and the bundle-budget gate.

### ship-change workflow
The most powerful addition — ships a scoped change end-to-end with worktree isolation:
```javascript
Workflow({ name: 'ship-change', args: { task: 'what to build', repo: '/abs/path/to/repo' } })
```
Phases: **Setup** (isolated git worktree + env copy + deps) → **Implement** → **Simplify** →
**Review** (Codex if available) → **Verify** → **PR** (delegates to `/pr` skill).
Multiple ship-change runs can run in parallel — each gets its own worktree, no collisions.

### Knowledge Base
Already bootstrapped at the repo root:
- `ARCHITECTURE.md` — system map: repo layout, invariants, active domain loops
- `LOG.md` — append-only journal of finished work (newest first)
- `signals/` — evidence: feedback, ideas, observations (deduped, frequency-counted)
- `docs/` — durable knowledge: decisions, analyses, learnings. `docs/index/` is the citation-gated codebase index (`node scripts/check-index-citations.mjs`, CI step "Codebase index citations"); `docs/configuration.md` is the env-var reference
- `domains/content/` — content freshness loop (MDX quality, metrics completeness)
- `domains/seo/` — discoverability loop (llms.txt, structured data, sitemap)
- `domains/performance/` — web vitals loop (CI bundle budget, local `pnpm analyze` attribution, LCP, R3F chunk tracking)

Add new loops with `/new-loop`. Append to `LOG.md` after any significant work session.
