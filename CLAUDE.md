# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **AGENTS.md warning applies here.** This is Next.js 16 — APIs, file conventions, and RSC behaviour differ from training data. Before writing any Next.js code, check `node_modules/next/dist/docs/` for the authoritative reference on whatever you are touching.

> **Snapshot.** This file describes Anvilry v3.17.0 (`package.json` version 3.17.0) plus one unreleased change, i.e. `main` at `a929932` (`package.json` version 3.6.0) **plus twenty-eight post-`a929932` behavioural changes**, twenty-seven of them released and the twenty-eighth not yet in any version (the first five shipped in v3.7.0, (6) and (7) in v3.8.0, (8) and (9) in v3.9.0, (10) and (11) in v3.10.0, (12) in v3.11.0, (13) in v3.12.0, (14) in v3.13.0, (15) and (16) in v3.14.0, (17), (18) and (19) in v3.15.0, (20), (21) and (22) in v3.16.0, (23), (24) and (25) in v3.16.1, (26) and (27) in v3.17.0): (1) notes are hidden at the data layer while `NEXT_PUBLIC_NOTES_ENABLED` is off; (2) rate limiting is per-class (`chat` / `voice` / `beacon`) with a `CRON_SECRET` bypass for the eval cron; (3) admin auth is one shared `isAdminAuthorized` (proxy, `requireAdmin`, telemetry page) and cron auth is one shared `src/lib/cron-auth.ts`; (4) command-palette talk-mode is gated by `isVoiceViewActive`; (5) the bundle gate's `MIN_ROUTES` is 17 and verified-dead components were removed; and, added in v3.8.0, (6) an IAM-denied model (a 403 naming a per-model deny) falls through to the next rung instead of ending the chain, and (7) `LLM_USE_SONNET_5_5` opts in to Claude Sonnet 5.5 as the primary rung; and, added in v3.9.0, (8) the model and provider line under chat answers is removed, and (9) the Konami-code easter egg is removed (the optional discovery badge now counts to 4); and, added in v3.10.0, (10) the fallback chain puts Sonnet 4.6 behind a 5.x primary and makes Opus opt-in (`LLM_USE_OPUS_FALLBACK`), Sonnet 5.x streams a readable reasoning summary at effort `medium` (`LLM_THINKING_EFFORT`), `cost_usd` comes from the verified per-model price table in `src/lib/llm-pricing.ts`, and the eval cron reads the answer with `answerFromBody` (every live chat body opens with the thinking sentinel while extended thinking is on), and (11) a neutral "AI assistant" cue (`src/components/chat/ai-disclosure.ts`) tells every visitor, phones included, that the answers are AI-generated without naming a model; and, added in v3.11.0, (12) `LLM_THINKING_EFFORT` accepts `low`, `medium`, `high`, `xhigh` and `max` (`xhigh` makes Sonnet 5.5 reason on every question; any model that is not Sonnet 5.x is sent `max` for it), the reasoning `max_tokens` floor follows the effort, and `/api/chat` may run for 60 s; and, added in v3.12.0, (13) the FAQ cache stores the reasoning summary beside its answer and an exact-tier hit replays it, so a repeated first-turn question shows its reasoning too (`EXTENDED_THINKING=false` stops it, and a semantic hit never carries it); and, added in v3.13.0, (14) the FAQ cache tags each entry with the id of the deployment that wrote it (`VERCEL_DEPLOYMENT_ID`), so a cached answer and the reasoning stored with it last until the next deploy or the 24 h TTL instead of until the next cold start of any function, and a preview or a rolled-back deployment never serves another deployment's answers (the first deploy flushes the cache once); and, added in v3.14.0, (15) the home page gains a Stack section after Featured Projects (`src/components/home/stack.tsx`, data in `src/lib/stack.ts`): 22 tool glyph tiles derived from `profile.skills` (19 Simple Icons brand marks and 3 neutral lucide glyphs for AWS, gRPC and ChromaDB), monochrome at rest and brand-coloured on hover or focus, one `aria-label` per link, a visible caption on coarse-pointer devices, and a closing link to `/about#skills`; and (16) `/about` renders a 14 px glyph on each "What I work with" chip that has a Stack entry (22 of its 34 chips, `src/components/skill-chip.tsx`) and its sections carry the ids `#skills` and `#uses`; and, added in v3.15.0, (17) a third `NEXT_PUBLIC_HERO_MODE` value, `mascot`, renders a drawn page-mascot head in the hero (opt-in), (18) `NEXT_PUBLIC_ABOUT_MASCOT=true` renders the same head beside the About intro (opt-in), and (19) the 404 page shows one of thirteen rotating mascot characters above its terminal (on by default, `NEXT_PUBLIC_404_MASCOT=false` removes it); and, added in v3.16.0, (20) the projects collection grows from 11 to 20 entries in four groups (nine new cards: Kelvran, toolwarrant, Cost Guard MCP, prompt-lift, RateCap, tracehub-mcp, Anvilry, Daily Dose and nh-deck), the new fourth group "Platform, Guardrails & Observability" is shown first on `/projects`, the featured set is eight (kelvran, toolwarrant, cost-guard-mcp, prompt-lift, ratecap, trelix, tombstone, mindforge), the home "View all N projects" link derives from the collection, the 3D graph has 25 nodes, `pinned` / `pinRank` mirror the six real GitHub pins (trelix, tombstone, anvilry, mindforge, ag-bash, commandvault), and the `REPO_ALLOWLIST` in `src/lib/github.ts` also accepts `owner/name` entries; (21) the Project schema gains `visibility` (`"public"` or `"private"`, default public; `agent-forge` and `graph-forge` are private), `repoLink()` in `src/lib/content.ts` returns `null` for a private project, and the project cards, `/projects/[slug]`, the chat card, the 3D dossier, the corpus, the MCP tools, the resume JSON and the JSON-LD drop the repo link (the project card, `/projects/[slug]` and the chat card say "Private repository"; the corpus says "private repository") (`publicProjects`, 18 of the 20, drives the hero repo metric, About and the terminal); and (22) compiled MDX is no longer a field of Project, Work, Note or Article: four body-only Velite collections (`projectBodies`, `workBodies`, `noteBodies`, `articleBodies`) hold `{slug, body}`, only `src/lib/content-bodies.ts` reads them and only the four `[slug]/page.tsx` detail pages import it, and the bundle gate asserts a fourth thing (no first-load chunk contains `_createMdxContent`), so first-load JS for `/` was 976,936 B at the v3.16.0 cut against 1,188,350 B at the v3.15.0 cut, and was 972,887 B after the later prune of three low-priority open-source items (#333) and 972,920 B at the v3.16.1 cut; and, added in v3.16.1, (23) three low-priority open-source items are removed from the portfolio: the `grpc-microservices` and `not-humans-lab` project cards (their pages now return 404) and Shop.this, three entries in all leaving the `REPO_ALLOWLIST` feed allowlist in `src/lib/github.ts` (22 to 19 entries), which leaves 18 projects (16 of them public) and a 3D graph of 23 nodes and 24 edges (#333); (24) a new production deployment is held off the production domain until the `Post-deploy smoke` commit status is green (a Vercel Deployment Check; `.github/workflows/deploy-smoke.yml` runs `scripts/post-deploy-smoke.mjs` against the built deployment), and a smoke step that does not succeed opens a GitHub issue (`scripts/deploy-gate-alert.mjs`) (#335, #340); and (25) the bundle gate's `MAX_FIRST_LOAD_BYTES` is 988,000 B (was 1,336,000 B) and the E2E browser install is bounded and retried (`scripts/ci-install-playwright.sh`) (#339, #340); and, added in v3.17.0, (26) the site is made readable by agents: `Accept: text/markdown` on `/` and on `/projects|work|articles|notes/<slug>` (note pages only while `NEXT_PUBLIC_NOTES_ENABLED` is on) returns Markdown with `Vary: Accept` (a conditional matcher in `src/proxy.ts`, the Accept rules in `src/lib/accept-negotiation.ts`, the per-path decision in `src/lib/markdown-routing.ts`; `/index.md` is the homepage twin, and an unknown path asked for as Markdown gets a real 404 with a Markdown body); API errors share one JSON shape `{error, code, status, hint, docs}` (`src/lib/api-error.ts`: the chat, voice, error-beacon and FAQ-purge routes, a JSON 404 catch-all at `src/app/api/[...path]/route.ts`, JSON 405 and OPTIONS handlers on the public routes that are not prerendered, and `ensureJsonError` plus a JSON-RPC parse error for a non-JSON POST on the MCP route; the MCP endpoint's JSON-RPC errors, the operator-only routes (cron, admin, flags) and uncaught exceptions keep their own answers); `/openapi.json` describes the public read-only API (`src/lib/openapi.ts`); `/developers`, `/contact` and `/privacy` are new pages (HTML-only until (28) gave them Markdown twins), listed in the sitemap; `llms.txt` gains "When to use this site" and "How to read this site" sections and four links; the JSON-LD gains an `Organization` block (a contact point and a postal address) and a `description` on `Person`, and `WebSite` names the Organization as its `publisher`; the footer links "API docs", Contact and Privacy; the homepage `Link` header also carries `rel="service-desc"` and `rel="service-doc"`; the deploy smoke runs 26 checks (was 20) and the E2E suite gains 6 tests; and (27) v3.17.0 is also a dependency security release: `next` 16.3.5 to 16.4.3 (it fixes two critical unauthenticated remote-code-execution advisories, in image optimization and in `use cache`, and a Server Actions denial of service), `@modelcontextprotocol/sdk` 1.26.0 to 1.32.0 (`mcp-handler` 1.1.0 still declares an exact 1.26.0 peer), 14 `pnpm-workspace.yaml` overrides for transitive advisories, `vite` declared as a devDependency, and a last `pnpm build` step that is now `scripts/build-search-index.mjs`, which indexes both the classic and the Vercel adapter output layout; and, unreleased and in no version yet (`package.json` is still 3.17.0), (28) the public API gets a published contract (`src/lib/api-policy.ts` is its source): API version 1 with an `API-Version` response header (an optional request header; any other value is a JSON 400) and a JSON API under `/api/v1` (14 read-only routes, lists as `{count, items}`, data from the functions the MCP tools use); every counted response carries `RateLimit-Policy` and `RateLimit` (and the earlier-draft `RateLimit-Limit`, `-Remaining`, `-Reset`; the 400, 405 and OPTIONS answers carry `API-Version` only), and a client over 300 requests per 60 seconds gets a JSON 429 with `Retry-After` (an in-memory per-IP counter in `src/proxy.ts`, per server instance; the Upstash limiter of chat, voice and beacon is unchanged); a deprecation mechanism (`Deprecation`, `Sunset` and `Link rel="successor-version"` headers; nothing is deprecated, the promised notice is 180 days); an RFC 9727 API catalog at `/.well-known/api-catalog`; an OpenAPI document that types the errors and headers of every operation (29 operations); Markdown twins for ten more pages (`/about.md`, `/projects.md` and so on; `/resume`, `/search` and `/stats` stay HTML-only, so `HTML_ONLY_PAGES` has 3 entries); 308 redirects from `/docs`, `/api-docs` and similar addresses to `/developers`; a "Developer resources" block in `llms.txt`; new `/developers` sections; an eighth error code, `internal_error`; and a `/privacy` paragraph on the in-memory counter; the deploy smoke grows to 30 checks (`api-v1-index`, `api-v1-item-404`, `api-catalog`, `about-markdown`). The 300 / 60 s budget and the 180-day notice are defaults that still await the owner, and a published CLI and CORS are not built. First-load JS for `/` is 966,794 B, measured by `node scripts/bundle-budget.mjs` after an incremental `next build` at 91381b5 (not on a wiped `.next`) and unchanged from the 966,794 B that v3.17.0 recorded (6,126 B less than the 972,920 B at the v3.16.1 cut: change (26) added 371 B and the Next.js bump of (27) took 6,497 B off). Source is the truth; when a number below disagrees with the code, fix this file. Prefer the symbol names and the `grep` recipes here over line numbers — `docs/index/` carries the line-level citations and is gated by `scripts/check-index-citations.mjs`.

---

## Commands

```bash
# Development
pnpm install
pnpm dev                   # starts Velite watch + Next.js dev @ localhost:3000

# Build (Velite + tests + Next.js + Pagefind, in that order)
pnpm build
# == velite --clean && vitest run && next build && node scripts/build-search-index.mjs  (package.json "build")
# a failing Vitest test therefore blocks the deploy; the search index (Pagefind) is the LAST step, a script and not the old `pagefind --site .next/server/app` one-liner because a Vercel build on Next >= 16.4 runs with a deployment adapter and writes the prerendered pages to .next/server/route-cache/APP_PAGE/<hash>/$/ instead, where the one-liner found 0 files and failed the build

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
make search-index          # == node scripts/build-search-index.mjs (indexes whichever layout exists, fails when it finds no HTML)

# Cache wipe (all build artifacts)
pnpm clean

# Makefile convenience wrappers
make dev / make build / make test / make lint
make new-work SLUG=my-case-study     # scaffold work MDX
make new-project SLUG=my-oss-repo    # scaffold project MDX
make new-note SLUG=my-note           # scaffold note MDX
make new-article SLUG=my-post        # scaffold article MDX
make health                          # smoke-test PRODUCTION /api/chat (curl POST to PROD_URL, not localhost; sends X-Chat-Skip-Cache, so it reaches the model and plants no cache entry)
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
- `main` — production release branch; merged from `develop` via merge-commit PR; Vercel Production deploys. Not *strictly* develop-only: hotfix #109 landed on `main` directly, and Dependabot PRs #239/#240 were merged straight into it (`git log --first-parent main`). Both branches sit under one active repository ruleset (live GitHub read, 2026-10-22): no deletion, no force-push, PR required with 0 approvals, and a **required-status-checks rule** (added 2026-10-22; before that there was none) naming `Lint · Type-check · Test` and `E2E (Playwright)`, bound to the GitHub Actions app and non-strict, with the repository-admin role allowed to bypass for pull requests only. `Install on pnpm 11` and the other jobs are not required. Classic branch protection is absent. Production is gated separately by a Vercel Deployment Check (`deploy-smoke.yml`, `DEPLOY.md` section 8).

**Tag every merge to `main` that bumps `package.json`'s `version` field.** Tags and GitHub Releases silently stopped after v2.1.1 (2026-06-18) even though `package.json`/`CHANGELOG.md` kept advancing through v3.6.0 (2026-08-21) — an unnoticed process gap, not a deliberate policy change. Retroactively closed on 2026-09-17: `git tag vX.Y.Z <sha>` + `gh release create vX.Y.Z --generate-notes` for the 10 version-bump commits between v2.1.1 and v3.6.0 (confirmed via `git log -p -- package.json`, not from commit-message labels alone — several "chore(release): vX" commit messages in that range, e.g. v2.2.0 through v2.9.0, never actually changed `package.json`'s version field, so they were deliberately left untagged rather than fabricating tags for versions the codebase itself never called current). Going forward: the moment a merge to `main` changes `package.json`'s version, tag that exact commit and run `gh release create vX.Y.Z --generate-notes` before moving on — don't let it accumulate again.

**CI pipeline (`.github/workflows/`) — six workflows (`ls .github/workflows`):**
- `ci.yml` — runs on every push (any branch) + PRs to `develop`/`main`, in **five jobs**:
  - `ci` ("Lint · Type-check · Test"; pnpm 10, Node 22): `pnpm install` → non-blocking `pnpm audit --audit-level high` → `pnpm content` (generates the gitignored `.velite/`; mirrors the production build order, required before typecheck and vitest) → `pnpm lint` → `tsc --noEmit` → `pnpm test` → **`Codebase index citations`** (`node scripts/check-index-citations.mjs`, the `docs/index/` freshness gate; a CI step, deliberately *not* part of `pnpm build`, so a stale index fails the PR and never a production deploy) → **`Claims integrity chain`** (`npx tsx scripts/seal-claims.ts` verifies `data/integrity-chain.json`; on drift run `npx tsx scripts/seal-claims.ts --write` locally and commit the chain).
  - `claims-integrity-autocommit` — opt-in (runs only when repo variable `SEAL_CLAIMS_AUTO_COMMIT == 'true'`, after `ci`): seals a new chain entry and pushes it.
  - `e2e` ("E2E (Playwright)"): installs chromium + webkit through `scripts/ci-install-playwright.sh` (3 attempts of 240 s each, with an apt repair between attempts), runs `pnpm build`, then the **bundle budget** gate (`node scripts/bundle-budget.mjs`, step "Bundle budget") on that same build — no second build — then `pnpm e2e`.
  - `install-pnpm-11` — `pnpm install --frozen-lockfile` under pnpm 11 must not modify a tracked file, and `pnpm-build-allowlist-consistency.test.ts` must pass (pnpm 11 replaced `onlyBuiltDependencies` with `allowBuilds`).
  - `security-alerts` — non-blocking Dependabot-alerts report; needs a PAT in the `SECURITY_ALERTS_TOKEN` secret to surface anything (the default `GITHUB_TOKEN` cannot read that API).
- `codeql.yml` — static JavaScript/TypeScript analysis on `develop` **and `main`** pushes/PRs + weekly.
  `main` is listed on purpose: a hotfix pushed straight to it used to deploy with no analysis.
- `dependency-review.yml` — dependency security check on PRs (blocks runtime-scoped high/critical CVEs *introduced in the diff* only; dev-only packages and pre-existing tree advisories do not fail it).
- `gitleaks.yml` — secret scan on `develop`/`main` pushes and PRs.
- `scorecard.yml` — OSSF Scorecard on `main` pushes + weekly + manual dispatch.
- `deploy-smoke.yml` — the production gate, not a PR check: on Vercel's `vercel.deployment.ready` dispatch it runs `scripts/post-deploy-smoke.mjs` (30 GET checks, ten of them added after v3.16.1: six by change (26) in v3.17.0, `developers`, `contact`, `privacy`, `openapi-json`, `home-markdown` (the homepage asked for Markdown must answer a Markdown body with `Vary: Accept`) and `api-json-404` (an unknown API path must answer a JSON `not_found` error), and four by change (28), not yet released: `api-v1-index` (`/api/v1` must report version "1" and carry `API-Version`, a well-formed `RateLimit-Policy` and a numeric `RateLimit-Remaining`), `api-v1-item-404` (an unknown v1 item must be a JSON `not_found` that carries `API-Version: 1`), `api-catalog` (`/.well-known/api-catalog` must be `application/linkset+json` with a `service-desc` link) and `about-markdown` (`/about.md` must be Markdown that names Sairam Ugge); no install, never the chat, voice or authenticated cron routes) against the exact built deployment with the Protection Bypass for Automation secret (`VERCEL_AUTOMATION_BYPASS_SECRET`), and reports the commit status `Post-deploy smoke` which the Vercel Deployment Check `Post-deploy smoke` (registered 2026-10-22, `blocks: deployment-alias`, production only) requires before Vercel assigns the production domain. After a smoke that does not succeed on a dispatch run (it failed, or it was skipped because an earlier step such as payload validation failed; the issue then says failure, cancelled or skipped), two best-effort steps (`continue-on-error`, placed before the final guard step so they can neither hide the failure nor turn it into a pass) check out `scripts/deploy-gate-alert.mjs` (a sparse checkout of the run's own default-branch commit, never the commit under test) and then run it, to open one GitHub issue per held commit (`Production deployment held: smoke failed for <7-char sha>`). Dedupe is best effort: it looks at the newest 100 open items (pull requests count toward the 100 and are then ignored) for an open issue with that title opened by `github-actions[bot]`; a same-title issue opened by anyone else does not count, a match outside that window or a create that was retried after its first attempt had already succeeded can leave a duplicate, and a closed issue never dedupes. It retries once after a network error, a 5xx or a 429, and the job holds `issues: write`. It does not announce a deployment that is held because no status ever arrives (a watchdog was considered and not built), closing the issue is manual, and the alert steps have run in Actions only twice, as controlled dispatches with an invalid payload on 2026-10-22 (the smoke step was skipped; the first run opened one issue, the second found it and opened nothing), never for a smoke step that ends `failure` or a real held deployment (`src/lib/deploy-gate-alert.test.ts` covers them with a mocked GitHub API). Both scripts' entry guards compare real paths: behind a symlink the old `post-deploy-smoke.mjs` guard made it exit 0 without running a single check, a false green. Setup, escape hatches (Force Promote) and limits: `DEPLOY.md` section 8.

**Bundle budget gate.** `scripts/bundle-budget.mjs` reads `.next/diagnostics/route-bundle-stats.json` — written by `next build` with no flag, but **only under Turbopack** — and asserts four things: (1) the artifact lists at least `MIN_ROUTES` (17, the 16 `page.tsx` routes + `/_not-found` of the time it was set; this tree has 19 pages and its build lists 20 route records, so it is a floor, not an exact count) route records, so a changed diagnostics format fails loudly instead of the gate passing on nothing — fix the script, never lower `MIN_ROUTES`; (2) every route's first-load JS stays under `MAX_FIRST_LOAD_BYTES` (`988_000` B; a ceiling, not a baseline — the largest route, `/`, measures 966,794 B first-load, read by the gate after an incremental `next build` at 91381b5 (not on a wiped `.next`) and unchanged from the 966,794 B that v3.17.0 recorded (972,920 B at the v3.16.1 cut, which was 972,887 B at #333 on CI (ubuntu-latest) and on a local macOS build alike, plus 33 B from the one-sentence rewrite in `content/projects/anvilry.mdx`; change (26) added 371 B, and change (27), the dependency security release (next 16.4.3 and others), then took 6,497 B off), which leaves 21,206 B (about 2.1%) of headroom. The headroom is a growth allowance, not jitter room: #333 shed 4,049 B with two project cards, their graph nodes and the Shop.this feed entry, so it covers a handful of cards, while any eager import of about 21 KB or more fails. Rebuilds of an unchanged tree have been byte-identical in CI, and CI and macOS agreed on the trees compared, so no jitter margin is added. The ceiling was raised four times (1,285,000 B at v3.6.0, then 1,290,000, 1,326,000, 1,332,000 and 1,336,000 B) and lowered once, to 988,000 B after v3.16.0 (shipped in v3.16.1, #340). `/` was 1,298,585 B before #329, which took it to 976,936 B at the v3.16.0 cut (about a quarter less), and 972,887 B at #333 (commit `a665991`, merge `0f65981`), the later prune of three low-priority open-source items; the ceiling had stayed at 1,336,000 B, leaving 363,113 B of slack. The script's own comment still quotes the 1,333,521 B dev-box figure from when it was last raised); (3) three.js stays **off** the first-load critical path (marker-based on `WebGLRenderer`, constant `LAZY_MARKER`); (4) compiled MDX bodies stay **off** it too (marker-based on `_createMdxContent`, constant `MDX_MARKER`), so a client module that reaches `src/lib/content-bodies.ts` fails here whatever the byte total. A missing or malformed artifact exits 1 by design. The CI step deliberately carries **no** `continue-on-error` and **no** `if-no-files-found` — unmeasurable must mean red. Raise the ceiling in its own commit, quoting measured before/after bytes.

**`bundle-analysis.yml` is DELETED — do not re-add it.** It was green and empty for its entire life: 222 runs, 211 green, zero artifacts across the 25 most recent. Three independent causes, each sufficient. (1) `next build` in Next 16 is **Turbopack**, not webpack (`node_modules/next/dist/lib/bundler.js`, the `bundlerFlags.size === 0` branch — "The default is turbopack when nothing is configured" — sets `TURBOPACK='auto'`), and `@next/bundle-analyzer` is webpack-only: it prints "not compatible with Turbopack builds, no report will be generated" and returns a config whose `.webpack` is undefined, so the `ANALYZE=true` build produced nothing. The workflow's own comment asserted the opposite; that assertion was **false**. (2) The `nextjs-bundle-analysis` compare step (last published 2023) reads the Pages-Router `build-manifest.json.pages`, which is `{"/_app": []}` in this App Router app — even fully wired it emits `{"raw":0,"gzip":0}`, i.e. "this PR introduced no changes to the JavaScript bundle" on every PR forever. (3) `if-no-files-found: warn` plus `continue-on-error: true` made both failures invisible. At the time no required-status-checks rule covered `develop` (one was added on 2026-10-22, see Branch topology above), so nothing required it.

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
/ (SSG → ViewRouter → Classic | Chat | Gamified | Developer | Voice | Resume — see the View table;
│    with `Accept: text/markdown` the proxy answers with the Markdown twin instead, see "Agent-Readable Surface")
├── /index.md                    Markdown twin of the homepage (`next.config.ts` rewrites() maps it to /api/md/home)
├── /projects                    `use cache` + cacheLife("hours") (3600 s revalidate); live GitHub feed server-side
│   └── /[slug]                  same `use cache` + cacheLife("hours") with a live fetchRepo
├── /articles                    cross-posted + native articles
│   └── /[slug]
├── /notes                       ships DARK in a default build: 404 unless NEXT_PUBLIC_NOTES_ENABLED=true (production serves /notes, observed 2026-11-01; see docs/configuration.md)
│   └── /[slug]
├── /work
│   └── /[slug]
├── /decisions                   architecture-decision ledger (client page; src/lib/decisions.ts)
├── /resume                      print-optimized recruiter view
├── /search                      Pagefind static search
├── /stats                       GitHub/writing aggregate stats
├── /mcp                         MCP server documentation (no segment config; only exports `metadata`); Markdown twin
├── /developers                  API documentation and developer guide (response-header table, deprecation summary and curl recipes from src/lib/developers-content.ts, endpoint and error tables from openapi.ts and api-error.ts; sections include authentication, versioning, rate-limits, sdk, cli); Markdown twin
├── /contact                     how to reach the owner; Markdown twin
├── /privacy                     what the site stores and sends (its figures live in src/lib/privacy-facts.ts); Markdown twin
├── /about
├── /<page>.md                   Markdown twins of ten pages (about, articles, contact, decisions, developers, mcp, notes, privacy, projects, work; `PAGE_TWINS` in src/lib/page-twins.ts); `next.config.ts` rewrites `/:page(...).md` to /api/md/pages/:page. /resume, /search and /stats stay HTML-only
├── /docs, /api-docs, /sdk, /cli …  308 redirects from `next.config.ts` `redirects()`: /docs, /docs/api, /api-docs, /api-reference, /developer → /developers; /sdk → /developers#sdk; /cli → /developers#cli; /mcp-server → /mcp
├── /admin/telemetry             HTTP Basic Auth (proxy + page re-check); reads Upstash Redis
├── /.well-known/vercel/flags    Vercel Flags SDK endpoint
├── /.well-known/api-catalog     RFC 9727 API catalog (`application/linkset+json`): lists /api/v1 and the MCP endpoint (src/lib/api-catalog.ts); GET only
├── /llms.txt, /llms-full.txt    AI model discovery index / full grounding corpus
├── /feed.xml                    RSS/Atom
├── /openapi.json                OpenAPI 3.1 description of the public read-only API, 29 operations (assembled in src/lib/openapi.ts from openapi-v1.ts, openapi-legacy.ts and the openapi-*schemas / openapi-parts modules)
├── /{articles,notes,projects,work}/[slug].md   raw-markdown pretty URLs (own route.ts each; `next.config.ts` rewrites() also maps them to /api/md)
├── /api/resume.json             unversioned alias of /api/v1/resume (same document)
├── /api/v1, /api/v1/**          the versioned JSON API, version 1 (`src/app/api/v1/**`, 14 GET routes: index, profile, work, work/{slug}, projects, projects/{slug}, articles, articles/{slug}, notes, notes/{slug}, decisions, search, resume, github/stats; lists are `{count, items}`). GET only, no request input (so they stay prerendered): index, profile, work, projects, articles, notes, resume. Dynamic (JSON 405 stubs + OPTIONS): the four `[slug]` routes, decisions, search, github/stats
├── /api/chat                    LLM streaming; rate-limited (`chat` bucket); FAQ cache; telemetry (Node, 60s)
├── /api/mcp/[transport]         MCP server — GET/POST/DELETE; use /api/mcp/mcp (Node, 30s); HEAD/PUT/PATCH answer a JSON 405, OPTIONS answers 204, and every error response leaves as JSON (`ensureJsonError`)
├── /api/tts                     AWS Polly TTS caching; rate-limited (`voice` bucket)
├── /api/tts-google              Google Cloud TTS caching; rate-limited (`voice` bucket)
├── /api/transcribe              AWS Transcribe STT; rate-limited (`voice` bucket)
├── /api/visit                   page visit tracking (own 1-per-IP-per-30-min limiter)
├── /api/error                   client-side error beaconing; rate-limited (`beacon` bucket)
├── /api/github/stats            GitHub aggregate feed; 1h cache is fetch-level `next.revalidate` (no segment `revalidate`); /api/v1/github/stats is answered by this route's own handler
├── /api/md/{articles,notes,projects,work}/[slug]   Markdown twins of the four content kinds (4 handlers, all through `markdownForContent`)
├── /api/md/home                 Markdown twin of the homepage (the proxy rewrites `/` to it for Markdown clients)
├── /api/md/pages/[page]         Markdown twin of one of the ten PAGE_TWINS pages (`markdownForPage`, wrapped in `withJsonErrors`; reached through the `/<page>.md` rewrite and the proxy)
├── /api/md/not-found            404 with a Markdown body; the proxy rewrites an unknown path to it when the client asked for Markdown, and passes the requested path in `?p=`
├── /api/[...path]               JSON 404 catch-all for any /api path no route owns (all five methods); never echoes the path
├── /api/admin/faq-cache/purge   POST; `requireAdmin` (Basic Auth) inside the handler — OUTSIDE the proxy's `/admin/:path*` gate (the proxy sees it through `/api/:path*` but it is not a public-API path, so it passes through untouched); not rate-limited (Node, 10s)
└── /api/cron/{eval,health-check,github-sync,seo-audit,content-audit}
                                 5 crons, ALL fail-closed on CRON_SECRET (vercel.json:3-7)
                                 (each route guards with `unauthorizedUnlessCron` from src/lib/cron-auth.ts)
```

47 `route.ts` handlers (37 under `src/app/api`, 10 elsewhere) and 19 `page.tsx` pages at this tree (`find src -name route.ts` / `-name page.tsx`); they were 31 (22 / 9) and 19 at v3.17.0.

All content routes generate per-route `opengraph-image.tsx` images.

**Runtime & duration — do not add `export const runtime`.** No route exports `runtime` anywhere in `src/`; the export was removed because `cacheComponents: true` (`experimental.cacheComponents` in `next.config.ts`) rejects its mere *presence* (see the note at the top of `src/app/api/mcp/[transport]/route.ts`). Routes therefore run on Next's default Node.js runtime. `maxDuration` is **per-route, not a uniform 30s**:

| maxDuration | Routes |
|---|---|
| 60 | `chat`, `cron/eval`, `cron/seo-audit`, `cron/content-audit` |
| 30 | `mcp/[transport]`, `cron/github-sync` |
| 25 | `cron/health-check` |
| 20 | `transcribe` |
| 15 | `tts`, `tts-google` |
| 10 | `admin/faq-cache/purge` |
| 5 | `error` |
| — (no export) | `visit`, `github/stats`, `resume.json`, `md/*` (incl. `md/home`, `md/not-found`, `md/pages/[page]`), `v1/*`, the `[...path]` catch-all, `.well-known/api-catalog`, `.well-known/vercel/flags`, and outside `api/`: `openapi.json`, `llms.txt`, `llms-full.txt`, `feed.xml` and the four `/<kind>/[slug].md` routes |

### Content Layer

All content (work case studies, OSS projects, notes, articles) lives in `content/` as MDX files. **Velite** processes them at build time into typed TypeScript collections in `.velite/`. The access layer is `src/lib/content.ts`.

```
content/{work,projects,notes,articles}/*.mdx
  → velite (Zod-validated schemas)
  → .velite/ (TypeScript + JSON)
  → src/lib/content.ts (typed access)
  → consumed by every view
```

No view owns its own copy of content. Every view derives from the same Velite output. Compiled MDX is the one exception to "one output for everyone": each collection has a body-only sibling (`projectBodies`, `workBodies`, `noteBodies`, `articleBodies`) that only `src/lib/content-bodies.ts` reads and only the four `[slug]/page.tsx` detail pages import, because `content.ts` is imported by client modules and a bundler cannot tree-shake a JSON module (bodies on the metadata cost about 300 KB of first-load JS). The `game-model.ts` derivation layer builds the 3D graph; `corpus.ts` builds the chatbot grounding document. `decisions.ts` derives the architecture-decision ledger (`/decisions` page and the `list_decisions` MCP tool) from Project `decisions` and Work `constraints`/`tradeoffs` frontmatter. A build-time bijection test (`game-model.test.ts`) fails the deploy if any graph node is orphaned from real content.

**Velite quirk:** `predev` runs Velite synchronously before `next dev` starts; do not pass `--clean` in dev mode or you'll get a race where Turbopack tries to resolve a momentarily deleted `.velite/projects.json`. The `build` script passes `--clean` explicitly for a pristine production build.

**Notes accept both `.md` and `.mdx`** — the Velite schema makes the extended Inkforge frontmatter (`tone`, `format`, `length`, `wordCount`, `readingTime`, `generatedBy`, `platforms`) optional, so a hand-written note that omits those fields still compiles.

Note that **the extension does not indicate provenance**: there are 7 note files, and only 5 carry `generatedBy: inkforge` (`how-dns-works.mdx` and `how-i-traced-one-browser-request-…mdx` are `.mdx` *and* Inkforge; `trelix-code-intelligence-engine.mdx` and `tombstone-v1-2-release.mdx` are `.mdx` with no `generatedBy` field, so they do not count as Inkforge). Check with `grep -c "generatedBy: inkforge" content/notes/*`. Do not infer provenance from the extension.

**Notes are hidden at the data layer, not only at the routes.** `NOTES_ENABLED` (`NEXT_PUBLIC_NOTES_ENABLED`, default **off** in a default build; production and the Vercel build serve notes (observed 2026-11-01, see `docs/configuration.md`), `src/lib/writing-flags.ts`) makes `allNotes` in `src/lib/content.ts` an empty array, so `llms.txt`, `feed.xml`, the sitemap, the chat corpus, the MCP tools and the `.md` handlers cannot list notes the `/notes` pages would 404. `publishedNotes` is the unconditional list and is used **only** by the `/notes` route files (`generateStaticParams` must return >=1 entry under `cacheComponents`); every other consumer reads `allNotes`. `inkforgeNotes` / `inkforgeArticles` derive from `allNotes`, so they are empty while notes are dark. While notes are dark, articles whose only destination is a note (`linkedNote` set and either no external URL or one pointing at our own `/notes/`) are dropped too.

**Articles support a `linkedNote` field** — when set to a note slug, the article card (`article-group-card.tsx`, grouping in `src/lib/article-grouping.ts`) links to the `/notes/[slug]` page instead of the external URL while `NOTES_ENABLED` is on (while notes are dark it falls back to the external URL). Use this for cross-posted content to avoid duplicate body rendering.

### LLM / Chat Architecture

`src/lib/llm.ts` is the single source of truth for the chatbot's AI layer:

- **Provider toggle:** `LLM_PROVIDER=bedrock` (default) or `LLM_PROVIDER=anthropic` (direct API).
- **Bedrock model chain** (`bedrockChain()`, built by `buildChain()`): `[primary, Opus if opted in, Sonnet 4.6, Haiku]` with repeats dropped. With no flags that is `us.anthropic.claude-sonnet-4-6` → `us.anthropic.claude-haiku-4-5-20251001-v1:0`; with a Sonnet 5.x primary, Sonnet 4.6 is the rung behind it, so a failing 5.x falls to the model it replaced (reachable on this account, with its own quota) before the weaker Haiku. **Opus is opt-in** (`LLM_USE_OPUS_FALLBACK=true`, `isOpusFallbackEnabled()`, exact string `"true"`): `us.anthropic.claude-opus-4-6-v1` then sits right behind the primary, where it used to be. It is off by default because this account IAM-denies the whole Opus family, so the rung could only ever answer 403 and cost a round trip on every fallback. Note: Opus 4.6 **requires** the `-v1` suffix — the bare ID 400s. `isFallbackEligible` advances on connection errors/timeouts, 429/404/5xx, a 400 whose message carries one of the `MODEL_UNAVAILABLE_MARKERS`, or a 403 whose message names a per-model deny — one of those markers or a `MODEL_DENIED_MARKERS` entry (`is not authorized to perform`, `explicit deny`: the IAM identity-policy wording). A credential/signature 403 (invalid or expired token) is not a per-model deny and still ends the chain with the apology tail. When the *primary* is the denied rung (for example the global Sonnet 5.5 profile when the IAM policy lacks it), expect the next allowed rung to answer with `fellBack: true` instead of an apology; the `llm.attempt` telemetry (`fell_back`, `attrs.status` 403) is the signal.
- **Direct-API chain** (`anthropicChain()`, `LLM_PROVIDER=anthropic`): the same shape with `claude-sonnet-4-6`, `claude-opus-4-7` (opt-in) and `claude-haiku-4-5`, i.e. `claude-sonnet-4-6` → `claude-haiku-4-5` by default.
- **`LLM_USE_SONNET_5=true`** (`isSonnet5PrimaryEnabled()`, default off) makes Sonnet 5 the primary rung on both chains (`us.anthropic.claude-sonnet-5` / `claude-sonnet-5`), with Sonnet 4.6 behind it. Sonnet 5 runs adaptive thinking *on by default* when `thinking` is omitted, so `streamWithFallback` always sends an explicit `thinking: {type: "disabled"}` (`{type: "between_tools"}` on the Sonnet 5.5 rung, next bullet) or, when extended thinking is on, `adaptiveThinking()` + `output_config.effort` from `thinkingEffort()` (see the reasoning bullet below); Haiku gets no `thinking` key. Extended thinking is on unless `EXTENDED_THINKING=false` (server, read in the chat route) / `NEXT_PUBLIC_EXTENDED_THINKING=false` (build-time, UI only: hides the reasoning panel in `chat-messages.tsx`; it does not change the model request).
- **`LLM_USE_SONNET_5_5=true`** (`isSonnet55PrimaryEnabled()`, default off, wins over `LLM_USE_SONNET_5`) makes Sonnet 5.5 the primary rung, with Sonnet 4.6 behind it: `global.anthropic.claude-sonnet-5-5` on Bedrock, `claude-sonnet-5-5` on the direct chain. Bedrock has **no `us.` profile** for it, and a `us.` id would 400 "model identifier is invalid", which `isFallbackEligible` reads as model-unavailable, so it would silently skip the primary instead of failing; the global profile also means requests may be processed outside the US regions, and IAM must allow it. 5.5 rejects `thinking: {type: "disabled"}` (400), so the thinking-off shape is per model (`thinkingOff()`): `{type: "between_tools"}` for 5.5, `{type: "disabled"}` for the rest; adaptive thinking is accepted (next bullet). Verified live against Bedrock on 2026-09-30 and again on 2026-10-01 through the app's own call path; the direct-API chain is unverified.
- **Reasoning on Sonnet 5.x** (`adaptiveThinking()`, `thinkingEffort()`): Sonnet 5 and 5.5 return a `thinking` block with EMPTY text unless the request says `display: "summarized"` (the default is `"omitted"`; the thinking tokens are billed either way), and at `effort: "low"` Sonnet 5.5 did not think on any of 8 recruiter questions in the first probe (0 thinking tokens each, 2026-10-01; the later 90-call matrix saw it reason once in 15 calls), so the reasoning panel stayed empty. Sonnet 5.x therefore sends `{type: "adaptive", display: "summarized"}` + `effort: "medium"` and reasons on the harder questions only, for about $0.0006 more per question on average. Live, through the app's own call path: no reasoning on "What is your current role?" (2 s), a 383-character summary on a pitch-to-a-bank's-risk-team question (7.5 s, its longer answer included). Every other thinking-capable rung keeps `{type: "adaptive"}` + `effort: "low"`, exactly the request it has always sent. `LLM_THINKING_EFFORT` (one of `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`, lower case, exact; anything else is ignored) overrides the effort on every thinking-capable rung. Bedrock's own 400 on the streaming action lists what each model takes (read 2026-10-01): Sonnet 5 and 5.5 accept all five, Sonnet 4.6 accepts `low`, `medium`, `high` and `max` and answers 400 to `xhigh`, and a 400 is not fallback-eligible, so `thinkingEffort()` sends `"max"` instead of `"xhigh"` to any model that is not Sonnet 5.x. The floor on `max_tokens` (shared by reasoning and answer) follows the effort (`thinkingTokenFloor()`): 2048 (4096 on Sonnet 5.x) at `low` and `medium`, 8192 at `high`, 16000 at `xhigh`, 32000 at `max`; a larger caller value is never lowered (16000 applies on Sonnet 5.x; a model that gets `xhigh` clamped to `max`, such as Sonnet 4.6, uses 32000). Measured on Sonnet 5.5 (`global.` profile, the production prompt, 90 calls over 15 questions, recruiter-style ones plus a greeting, an injection attempt and nonsense, 2026-10-01): `low` reasoned on 1 of 15 calls, `medium` on 3 of 15, `high` on 16 of 25 (never on "hi", "What is your current role?" or "What is Pensieve?"), `xhigh` on 30 of 30 (first answer text after 4.1 s on average, 7.6 s at most) and `max` on 5 of 5 (10 s on average, 20.5 s at most, up to 2,902 output tokens). So `medium`, the default, reasons mostly on the hard questions (2 of its 3 reasoned calls), and `LLM_THINKING_EFFORT=xhigh` shows reasoning on every question (a repeated first-turn question is answered from the FAQ cache, which replays the summary stored with its answer on an exact-tier hit; a semantic-tier hit and an entry stored without one carry none). It has no effect while `EXTENDED_THINKING=false`. A `thinking_delta` that arrives after the answer has started is dropped, so a late reasoning block can never be shown as answer text. A server-side reader of the response body (the eval cron) must parse it with `answerFromBody` (`src/lib/llm-trace.ts`): the thinking sentinel starts with the same byte as the trace delimiter and opens every live body while extended thinking is on (the default), reasoning or not, so a cut at the first such byte read every answer as empty. (The eval cron's parser did exactly that; its requests are currently refused before they reach the app, by Vercel's deployment-protection wall on `VERCEL_URL`, see `DEPLOY.md` section 7.)
- **Per-attempt timeout:** `PER_ATTEMPT_TIMEOUT_MS` = 15 s to the response headers of each HTTP try, not to the end of the stream (a `max`-effort stream took 20.5 s through the app's own client). The SDK makes up to three tries per rung (its default `maxRetries` is 2), so a rung that never answers costs about 46 s before the next one starts; once headers are in, only the route's `maxDuration` (60 s) ends a stalled stream.
- **Fallback invariant:** Streaming errors surface inside the `for await` loop (never at `.stream()`). The only reliable guard for "can we still fall back?" is whether bytes have already been sent to the client. Once `emittedAny = true`, any subsequent error appends an apology and closes the stream — no retry.
- **Credential handling:** `BEDROCK_ACCESS_KEY_ID` / `BEDROCK_SECRET_ACCESS_KEY` are stored base64-encoded. `decodeSecret()` performs a round-trip equality check to detect base64 vs. raw keys without false-positives. Use `BEDROCK_REGION` (not `AWS_REGION` — Vercel mangles the reserved name in production).
- **Telemetry:** Each model attempt emits an `LlmAttempt` span via `onAttempt` callback. The chat route uses this to write structured `llm.attempt` events for the dashboard. A success that streamed answer text also carries `answerText` and, when the model reasoned, `reasoningText` (exactly the `thinking_delta` bytes sent to the client); the route hands both to the FAQ cache write-through (primary-rung successes only) and never emits them.
- **Cost telemetry** (`src/lib/llm-pricing.ts`): `cost_usd` on each `llm.attempt` event comes from `costUsd(model, usage)`, a table of AWS's own on-demand list prices (AWS Price List offer `AmazonBedrockFoundationModels`, version 20260930001912, us-east-1, USD per million tokens) keyed by exact model id. `us.` ids are billed at the Regional CRIS rate (10% over Global) and `global.` ids at the Global rate, which is why Sonnet 5.5 (`global.`, $2 / $10) is not dearer than Sonnet 4.6 (`us.`, $3.30 / $16.50) even though the same prompt is 45% more tokens (5247 vs 3618 cached tokens): measured 2026-10-01, a turn cost 14% / 21% less (cold / warm cache) on 8 questions at effort `low`, and from 17% less to 4% more on 3 questions at `medium`. Cache writes are priced at the 1 h rate because `CACHE_WRITE_TTL`, which the route also uses for its `cache_control`, is `"1h"`. A model with no row (every direct-API id) returns `null` and the event carries no `cost_usd` rather than a figure at another model's rate; `src/lib/llm-pricing.test.ts` fails if any model id `modelChain()` can produce under any flag combination on the Bedrock chain has no row (the direct-API ids are deliberately unpriced). The dashboard's "saved by caching" sums `cacheReadSavingsUsd()` per attempt (full input price minus the cache-read price, before the cache-write premium).
- **Prompt caching:** the chat route sends up to two system blocks — the byte-stable corpus prompt (`staticSystemPrompt(corpus)`, `cache_control` ephemeral with a 1 h TTL) and, when the stats fetch succeeds, after the cache breakpoint and uncached, the hourly live GitHub stats. Keep live data OUT of the static block or every refresh invalidates the cached prefix.

**FAQ response cache** (`src/lib/chat-cache.ts`, `src/lib/faq-embeddings.ts`): first-turn `/api/chat` questions are served from Upstash with zero Bedrock spend. Exact tier (normalized-question hash, default on; `FAQ_CACHE_ENABLED=false` kills it) then an optional semantic tier (`FAQ_CACHE_SEMANTIC_MATCH=true`; Titan embeddings v2, cosine `SIMILARITY_THRESHOLD` 0.92, index capped at `FAQ_CACHE_INDEX_CAP` = 500). TTL `FAQ_CACHE_TTL_SECONDS` = 24 h; only clean `end_turn` completions ≤ `MAX_CACHEABLE_ANSWER_CHARS` (4000) answered by the primary rung are stored (a `fell_back` answer is never written through, so a transient Sonnet outage is not replayed for 24 h); entries are tagged with the id of the deployment that wrote them (`VERCEL_DEPLOYMENT_ID`, read in-process by `ownDeploymentTag()`), so a deploy or a rollback never serves another deployment's answers, a preview and production never serve each other's entries (a question has one slot, so the later write replaces the earlier one, and a rolled-back deployment regains only the questions nobody has answered since), and a cold start or a new instance of the same deployment changes nothing (the first deploy of this scheme flushes the cache once); a host that gives no deployment id falls back to `anvilry:corpus:built_at`, which `register()` in `src/instrumentation.ts` rewrites with the current time on every production process start. Requests with an `X-Chat-Skip-Cache` header (the weekly eval cron sends it) bypass it; every lookup emits a `chat.cache` telemetry event (a hit also carries the boolean `reasoning_replayed`, never the text), and a hit is returned as answer + U+001E + a trace frame with `cacheHit: true` (header `X-Chat-Cache: hit`). An entry also stores the reasoning summary its answer was written with (optional `reasoning`: control bytes stripped, trimmed, at most `MAX_CACHEABLE_REASONING_CHARS` = 4000, written only with a cacheable answer to a question of at most `MAX_REASONING_QUESTION_CHARS` = 200 normalized characters, because the summary of a long question is the likeliest to carry what the visitor typed; dropped, not rejected, when empty or over its own bound, and the answer is cached either way). An **exact-tier** hit with `EXTENDED_THINKING` not `"false"` replays it in the framing a live stream has (`THINKING_SENTINEL` + summary + `THINKING_END` before the answer), so the Chat view shows a collapsed "Thought for a moment" toggle (the whole body arrives at once); a semantic-tier hit never does (its type leaves the field out, because the summary paraphrases the question it was written for), and an entry stored without reasoning is served as a plain answer. Purge one question with `POST /api/admin/faq-cache/purge` (Basic Auth, `{"question": "<=2000 chars>"}`). Known accepted gap: the gate checks completion cleanliness, not content safety; the stored summary is model text that can quote the question, kept 24 h and shown only to an identical question.

The chatbot grounding is the **in-context corpus** (`src/lib/corpus.ts` `buildCorpus()`; 16,476 chars measured with default flags/notes dark, 18,780 with notes on — the `~4KB` in the `corpus.ts` docblock is stale). No vector DB at this scale. The model can emit `[[card:work:slug]]` intent tokens; the client validates slugs against a build-time allowlist before rendering — this is the structural zero-fabrication guard.

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

Every error response leaves this route as JSON: `ensureJsonError` (`src/lib/api-error.ts`) wraps the transport library's bare-text 404/405 in the shared error shape (a JSON-RPC body is only labelled `application/json`, never rewritten). HEAD, PUT and PATCH answer a JSON 405 with `Allow: GET, POST, DELETE, OPTIONS`, and OPTIONS answers 204 with the same `Allow`. The transport library never settles a POST whose body is not JSON (it raises inside a stream and the request stays open until `maxDuration`), so the route answers that itself with the JSON-RPC parse error (`-32700`, HTTP 400, `id` null). As a public path it is stamped with the API headers by `src/proxy.ts` and its requests count against the public-API budget (OPTIONS does not, and reaches the route's own handler).

### Agent-Readable Surface

Change (26), shipped in v3.17.0, as extended by change (28), which is unreleased (the public API contract, the page twins, `/api/v1`, the eighth error code, the 3-entry `HTML_ONLY_PAGES`). Absolute URLs in this output come from `SITE_URL` (`src/lib/site-url.ts`), never from the request host, so a preview deployment does not advertise itself as canonical.

- **Markdown content negotiation** (`src/proxy.ts`). Its `has` matcher entry (`/:path*` with `has: [{ type: "header", key: "accept", value: "(.*)[Tt][Ee][Xx][Tt]/[Mm][Aa][Rr][Kk][Dd][Oo][Ww][Nn](.*)" }]`, spelled letter by letter because a matcher value is a flagless regular expression and media type names are case-insensitive) wakes the proxy for requests whose Accept header mentions `text/markdown` in any letter case; its other entries wake it for `/admin`, `/api/*`, the discovery files and the `.md` URLs (see "Public API contract" below), so an ordinary page request that does not ask for Markdown never invokes it. The proxy's routing module (`markdown-routing.ts`) imports `CONTENT_KINDS` from `src/lib/content-kinds.ts`, a module with no imports, so the proxy's bundle carries neither the content layer nor `node:fs`. `classifyPath` (`src/lib/markdown-routing.ts`) then decides per path: `rewrite` (`/` to `/api/md/home`, `/projects|work|articles|notes/<slug>` to `/api/md/<kind>/<slug>`, and each of the ten `PAGE_TWINS` pages `/<page>` to `/api/md/pages/<page>`), `pass` (`/api/`, `/_next/`, `/_vercel/`, `/.well-known/`, `/admin`, any path ending in a file extension (letters, digits and underscores, up to 16 characters, so Pagefind's `.pf_fragment` files pass), metadata images, and the 3 pages in `HTML_ONLY_PAGES`: `/resume`, `/search`, `/stats`) or `not-found` (everything else: rewritten to `/api/md/not-found?p=<path>`, a real 404 with a Markdown body and `X-Robots-Tag: noindex`). `negotiate` (`src/lib/accept-negotiation.ts`) applies the RFC 9110 rules (q-values, the most specific range wins, `q=0` excludes, a missing header or `*/*` means HTML); a negotiated page whose Accept rules out both HTML and Markdown gets `406`, and when HTML wins the page is served with `Vary: Accept` appended. Markdown replies are built by `markdownResponse` (`src/lib/markdown-response.ts`: `text/markdown; charset=utf-8`, `Vary: Accept`, `Cache-Control: public, max-age=0, must-revalidate`, `Link: <…>; rel="canonical"` pointing at the HTML page) and the 404 body echoes only a sanitised requested path, cut to 80 characters and labelled "(text copied from the request)". `markdownForContent` (`src/lib/markdown-content.ts`) checks the slug against the content layer before any file is read, ends the front-matter block only at a closing `---` on a line of its own (a value that merely contains `---` must not close it early), and gives an article whose file has no body a short description instead of an empty page. `next.config.ts` `headers()` also sets `Vary: Accept` and `Link: <…>; rel="alternate"; type="text/markdown"` on `/`, on the four `/<kind>/<slug>` page families and on each of the ten twin pages for crawlers that never send Accept (the homepage `Link` also carries `rel="service-desc"` for `/openapi.json`, `rel="service-doc"` for `/developers` and `rel="api-catalog"` for `/.well-known/api-catalog`). **A new page must be added to `PAGE_TWINS` (and get a twin) or to `HTML_ONLY_PAGES`**, otherwise a Markdown client gets a 404 for it; `markdown-routing.test.ts` compares the lists with the real `src/app` tree and fails the build, and `next-config.test.ts` fails if the rewrite pattern in `next.config.ts` and `PAGE_TWINS` disagree.
- **One JSON error shape** (`src/lib/api-error.ts`). `apiError(status, code, message, { hint, headers })` returns `{ error, code, status, hint, docs }` with `Cache-Control: no-store`; the eight codes in `API_ERROR_CODES` (`invalid_request` 400, `not_found` 404, `method_not_allowed` 405, `payload_too_large` 413, `rate_limited` 429, `internal_error` 500, `upstream_error` 502, `not_configured` 503) are the one catalogue that `/developers#errors` and `/openapi.json` render from, and `apiError` throws on a code/status pair the catalogue does not list. `api-error.test.ts` fails on a catalogue code that no source file emits. `error` keeps its old name, so a client that reads `body.error` is unaffected. The shape covers the failures the public routes raise themselves, and deliberately not the MCP endpoint's JSON-RPC errors, the operator-only routes (the cron and admin 401s and the flags endpoint keep their own bodies) or an uncaught exception outside the wrapped handlers, which Next answers itself. `withJsonErrors(handler)` wraps the seven dynamic `/api/v1` routes and `/api/md/pages/[page]`: an uncaught exception there becomes the 500 `internal_error` body, and only the error name is logged. `methodNotAllowed(allowed)` backs the JSON 405 (with `Allow`) on the 24 public routes that are not prerendered (chat, tts, tts-google, transcribe, error, visit, github/stats, MCP, the four `/api/md/<kind>/[slug]`, the four `/<kind>/[slug].md`, `/api/md/pages/[page]` and the seven dynamic `/api/v1` routes), and each of them exports an `OPTIONS` made by `optionsFor(allowed)` (204 with the same `Allow`, because Next would otherwise list the stubs as if they worked). The prerendered routes (`llms.txt`, `llms-full.txt`, `feed.xml`, `api/resume.json`, `api/md/home`, `openapi.json`, `.well-known/api-catalog` and the seven `/api/v1` routes that take no request input) export `GET` only: Next treats a route module that exports POST, PUT, PATCH or DELETE as dynamic; `method-not-allowed.test.ts` pins the first six and 15 of the stubbed routes (9 GET-only, 6 POST-only); the MCP route, the seven `/api/v1` stubs (and the GET-only export of the seven static `/api/v1` routes) and `/api/md/pages/[page]` are pinned by their own tests (`mcp/[transport]/route.test.ts`, `v1-contract.test.ts`, `md/pages/[page]/route.test.ts`), and the API catalog's GET-only export by its own `.well-known/api-catalog/route.test.ts`. For the public paths among them, `src/proxy.ts` answers an unsupported method with the JSON 405 itself, so the file is never reached. `src/app/api/[...path]/route.ts` answers any other `/api/*` path with a JSON 404.
- **OpenAPI and the new pages.** `buildOpenApiDocument()` (`src/lib/openapi.ts`, served by `src/app/openapi.json/route.ts`) describes only what an outside agent can call for free and without credentials; the chat, voice, error-beacon, visit, admin and cron routes are deliberately absent, and `openapi.test.ts` pins that, plus every documented path to a real route file and the `Error` schema's `code` enum to `API_ERROR_CODES`. The document has 29 operations, the 14 `/api/v1` ones first, built from `openapi-v1.ts` and `openapi-legacy.ts` (the pre-v1 operations) with the named schemas in `openapi-schemas.ts` and `openapi-v1-schemas.ts` and the shared pieces in `openapi-parts.ts`. Every operation except `/` carries inline the optional `API-Version` header parameter, the version and `RateLimit` headers on each 2xx response, and typed error responses that reference the `Error` schema (the Markdown twins keep their Markdown 404); `default` still references `#/components/responses/Error`, and `McpError` for the MCP endpoint. `v1-contract.test.ts` validates the real response of each v1 route against its schema (`src/lib/json-schema-lite.ts`). `/developers` renders its tables from that same object. `/contact` and `/privacy` use the prose helpers in `src/components/ui/prose.tsx`; every figure `/privacy` prints as a number lives in `src/lib/privacy-facts.ts`, and `privacy-facts.test.ts` checks each against the source that enforces it.
- **Public API contract** (unreleased; `src/lib/api-policy.ts` is the source; the OpenAPI description, `/developers`, `llms.txt` and the headers read it, and `src/lib/privacy-facts.ts` keeps a copy of the budget that `privacy-facts.test.ts` pins to it). `API_VERSION` is `"1"`: responses carry `API-Version: 1`, a request may send the header and any other value is a JSON 400, `/api/v1` is the base path, and the unversioned `/api/resume.json` and `/api/github/stats` are aliases. `src/proxy.ts` serves the contract for every path that `isPublicApiPath` (`src/lib/public-api-paths.ts`, no imports) accepts: `/api/v1`, `/api/v1/*`, `/api/mcp/*`, `/api/resume.json`, `/api/github/stats`, `/.well-known/api-catalog`, `/llms.txt`, `/llms-full.txt`, `/openapi.json`, `/feed.xml`, `/sitemap.xml`, `/robots.txt` and the `.md` twins (`/<page>.md`, `/<kind>/<slug>.md`); `/` and the HTML pages are not public-API paths. The order in `servePublicApi`: a wrong `API-Version` gets a JSON 400; OPTIONS gets 204 with `Allow: GET, HEAD, OPTIONS` and is never counted (the MCP path passes through to its own handler); a method outside GET, HEAD and OPTIONS on a non-MCP path gets a JSON 405 (those three answers carry `API-Version`, and a deprecation's headers, but no RateLimit fields); otherwise the request is counted, and a client over budget gets a JSON 429 `rate_limited` with `Retry-After`; otherwise Markdown negotiation runs. A counted response (a normal answer or the 429) is stamped with `API-Version`, `RateLimit-Policy: "default";q=300;w=60`, `RateLimit: "default";r=<remaining>;t=<seconds>`, the earlier-draft `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`, and, for a path under an entry of `DEPRECATIONS` (empty today), `Deprecation` (RFC 9745), `Sunset` (RFC 8594) and `Link rel="successor-version"` (RFC 5829); `DEPRECATION_NOTICE_DAYS` is 180 and `givesEnoughNotice()` checks an entry against it. The matcher in `config` must list every path the predicate accepts, and `public-api-paths.test.ts` fails if they disagree. The budget (`RATE_LIMIT_POLICY`: 300 requests per 60 s) is a fixed window per client IP held in memory (`createWindowLimiter` in `src/lib/public-api-limit.ts`, at most 10,000 tracked clients; expired entries are swept at most once per window, at the first request after a window has passed since the previous sweep, not on a timer, so an idle instance keeps them; the table is gone on a restart), counted per server instance and deliberately not in Redis, so a crawler cannot spend the Upstash quota that the chat cost guard needs; the Upstash limiter (8 per 60 s) is unchanged. `public-api-limit.ts` keeps its own `clientIp`, the fourth copy listed in `client-ip-consistency.test.ts`. `/.well-known/api-catalog` (`src/lib/api-catalog.ts`) is the RFC 9727 Linkset (`application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"`) that lists `/api/v1` (service-desc `/openapi.json`, service-doc `/developers`, status `/api/v1`) and the MCP endpoint (service-doc `/mcp`). The `/api/v1` routes read the functions the MCP tools use (`src/lib/mcp-tools.ts`), with their shared helpers in `src/lib/content-api.ts`.
- **Markdown twins of pages (unreleased).** Ten pages (`PAGE_TWINS` in `src/lib/page-twins.ts`: about, articles, contact, decisions, developers, mcp, notes, privacy, projects, work) have a `/<page>.md` URL and answer `Accept: text/markdown`; `/<page>` sends `Vary: Accept` and `Link: </<page>.md>; rel="alternate"; type="text/markdown"`. The route is `src/app/api/md/pages/[page]/route.ts` (`markdownForPage` in `src/lib/page-markdown.ts`, wrapped in `withJsonErrors`). The list pages (about, projects, work, decisions, articles, notes) are built from the data their pages read (`page-markdown-lists.ts`). The prose pages (contact, developers, mcp, privacy) are the page's own React elements converted to Markdown by `element-markdown.ts` (`page-markdown-prose.ts`), because `react-dom/server` is not supported in the layer a route handler runs in; `page-markdown.dom.test.tsx` renders the real pages and fails when a heading, paragraph, list item, table cell, code block or link of the HTML is missing from the twin. The articles and notes twins are the Markdown 404 while those views have nothing to show (notes are off in a default build; production serves the /notes page itself, observed 2026-11-01, but not its twin until this change is released). Table cells in the converted pages go through `escapeCellPipes` in `element-markdown.ts`, which adds a backslash only to a pipe preceded by an even run of backslashes (an odd run is already escaped).
- **Discovery.** `llms.txt` has "When to use this site" and "How to read this site" sections, a "Developer resources" block (every line starts "Anvilry ...": documentation, OpenAPI, the `/api/v1` base URL, the API catalog, MCP, authentication, versioning, rate limits, errors, SDK and CLI) and a "Pages" list of the `.md` twins, and links the developer guide, the OpenAPI document, contact and privacy; `OrganizationJsonLd` (`src/components/json-ld.tsx`, `@id` `https://anvilry.vercel.app/#organization`) carries a `ContactPoint` and a `PostalAddress`, `WebSite` names it as `publisher`, and `Person` has a `description`; the footer's machine-readable nav links "API docs" and its bottom strip links Contact and Privacy.

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

- `src/lib/rate-limit.ts` `checkRateLimit(req, cls)` keeps **three independent Upstash sliding-window buckets** — `chat`, `voice`, `beacon` — each 8 requests / 60 s per IP (key prefixes `anvilry:chat`, `anvilry:voice`, `anvilry:beacon`), so one class cannot starve another. `/api/chat` uses `chat`; `/api/tts`, `/api/tts-google`, `/api/transcribe` use `voice`; `/api/error` uses `beacon`; `/api/visit` has its own separate 1-per-IP-per-30-min limiter; the admin purge route is deliberately unlimited. `cls` is a required argument so a route can never silently share another class's bucket. This is the cost guard for the routes that spend money; the free public API has a second, separate limiter in `src/proxy.ts` (unreleased: 300 requests per 60 s per IP, in memory, see "Public API contract" under "Agent-Readable Surface") that never touches Redis.
- **Fail-open:** no limiter when Upstash is unconfigured, and any limiter error lets the request through. A request bearing a valid `CRON_SECRET` bearer (`hasValidCronSecret`) bypasses the limiter — the weekly eval cron fires 12 sequential chats and would otherwise self-throttle. Production without Upstash logs a loud warning at module load.
- Cron auth is one helper, `src/lib/cron-auth.ts` (`hasValidCronSecret` / `unauthorizedUnlessCron`): SHA-256 digests compared with `timingSafeEqual`, fail-closed when `CRON_SECRET` is unset. All five cron routes use it.
- Telemetry uses a dual-sink strategy: Vercel Runtime Logs (permanent) + Upstash Redis sorted sets (7-day retention, queryable; the retention trim runs on ~1-in-20 emits). Event kinds (`KIND_LITERALS` in `src/lib/telemetry/schema.ts`): `http.request`, `llm.attempt`, `tts.request`, `transcribe.request`, `client.error`, `server.error`, `budget.tick`, `chat.cache`. The `/admin/telemetry` dashboard is HTTP Basic Auth–protected via `ADMIN_PASSWORD`.
- `src/proxy.ts` has three jobs and a matcher that lists `/admin/:path*`, `/api/:path*`, the discovery files (`/.well-known/api-catalog`, `/llms.txt`, `/llms-full.txt`, `/openapi.json`, `/feed.xml`, `/sitemap.xml`, `/robots.txt`), the `.md` URLs and a `has` entry for an Accept header that mentions `text/markdown`. The first job, for `/admin/:path*`, is the first-filter auth gate for `/admin/*`. Next 16 proxies run on the **Node.js runtime** by default, so it shares `isAdminAuthorized` from `src/lib/admin-auth.ts` (SHA-256 digests compared with `timingSafeEqual`) with `requireAdmin` (route handlers — currently the FAQ-cache purge route, which sits *outside* that gate) and the `/admin/telemetry` page, which re-checks auth itself and calls `notFound()` when unauthorized. An unset `ADMIN_PASSWORD` denies everything. The second job, unreleased, is the public API contract (version, rate limit and deprecation headers, the JSON 400, 405 and 429 answers) for the paths `isPublicApiPath` accepts, and the third is Markdown content negotiation for the rest; both are described under "Agent-Readable Surface". An `/api/*` path that is not public (chat, voice, cron, the admin purge, the Markdown helpers) leaves the proxy untouched, and a request for `/admin/*` meets the auth check first whatever its Accept header says.

### Feature Flags

Two mechanisms — choose based on how fast you need the toggle:

| Mechanism | How | Latency |
|---|---|---|
| `NEXT_PUBLIC_*` env vars | Build-time; set in Vercel dashboard → redeploy | Minutes |
| Vercel Flags SDK | Runtime; set `FLAG_DRIVER=vercel` → instant | Seconds |

Key flags: `NEXT_PUBLIC_DISCOVERY_BADGES`, `NEXT_PUBLIC_OPEN_TO_WORK`, `NEXT_PUBLIC_GITHUB_STATS_ENABLED`, `NEXT_PUBLIC_ANVIL_ORB_MODE`, `NEXT_PUBLIC_INK_TRANSITION`, `NEXT_PUBLIC_SKILL_TREE`, `NEXT_PUBLIC_NOTES_ENABLED` (default off; production serves notes, observed 2026-11-01 — gates the whole notes corpus, see Content Layer), `NEXT_PUBLIC_ENABLED_VIEWS`. Run `make flags-show` to see all current values.

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
| `src/lib/chat-cache.ts`, `src/lib/faq-embeddings.ts` | FAQ response cache for `/api/chat` (exact + optional semantic tier; an entry also stores the reasoning summary and only the exact tier replays it) |
| `src/lib/decisions.ts` | Architecture-decision ledger derived from project/work frontmatter (`/decisions`, `list_decisions`) |
| `src/lib/claims-integrity.ts`, `data/integrity-chain.json`, `scripts/seal-claims.ts` | Hash-chained resume claims; verified in CI, surfaced by the `integrity` terminal command |
| `src/lib/agent-trace.ts` | Glass-box agent demo; `PLACEHOLDER_SENTINEL` shipping gate |
| `src/lib/voice-settings-context.tsx` | Persisted voice prefs (external store, localStorage) |
| `src/lib/voice-catalog.ts` | Authoritative voice catalog for all engines |
| `src/lib/rate-limit.ts` | Per-IP Upstash rate limiter: `chat` / `voice` / `beacon` buckets, `CRON_SECRET` bypass (fails open). The free public API has its own in-memory limiter, `src/lib/public-api-limit.ts` |
| `src/lib/cron-auth.ts` | Shared fail-closed `CRON_SECRET` bearer check used by every cron route and the rate limiter |
| `src/lib/admin-auth.ts` | `isAdminAuthorized` / `requireAdmin` — the one Basic Auth compare (proxy, purge route, telemetry page) |
| `src/lib/redis.ts` | Upstash Redis singleton (shared by rate-limit, telemetry, admin) |
| `src/lib/flags.ts` | Feature flag resolver (build-time env vs. Vercel Flags SDK runtime) |
| `src/proxy.ts` | Node-runtime proxy with three jobs: the HTTP Basic Auth gate for /admin/* (shares `isAdminAuthorized` with `src/lib/admin-auth.ts`), the public API contract (version / RateLimit / deprecation headers, JSON 400, 405, 429) for the paths `isPublicApiPath` accepts, and Markdown content negotiation |
| `src/lib/api-policy.ts` | The published API contract in one place: `API_VERSION`, `API_V1_BASE`, `RATE_LIMIT_POLICY` (300 per 60 s), `DEPRECATION_NOTICE_DAYS` (180), `DEPRECATIONS` (empty), `deprecationHeaders()`, `givesEnoughNotice()` and the policy prose that OpenAPI and `/developers` print |
| `src/lib/public-api-limit.ts`, `src/lib/public-api-paths.ts` | The in-memory per-IP window limiter (`createWindowLimiter`, `rateLimitHeaders`, its own `clientIp`) and the import-free `isPublicApiPath` predicate the proxy uses |
| `src/lib/api-catalog.ts`, `src/lib/content-api.ts`, `src/lib/json-schema-lite.ts` | The RFC 9727 API catalog (served at `/.well-known/api-catalog`); the helpers the `src/app/api/v1/**` routes share (response shape, slug rule, 400 / 404 answers); the small JSON-schema validator the v1 contract tests use |
| `src/lib/accept-negotiation.ts` | `negotiate()` / `appendVary()` — the one place that decides HTML vs Markdown from an Accept header (RFC 9110 q-values and specificity; no substring tests) |
| `src/lib/markdown-routing.ts` | `classifyPath()` + `HTML_ONLY_PAGES` (`/resume`, `/search`, `/stats`) — what the proxy does per path for a Markdown request (`rewrite` / `pass` / `not-found`); a new page must be listed in `HTML_ONLY_PAGES` or in `PAGE_TWINS` |
| `src/lib/page-twins.ts`, `src/lib/page-markdown*.ts`, `src/lib/element-markdown.ts` | `PAGE_TWINS` (the ten pages with a `/<page>.md` twin; import-free) and the builders behind `/api/md/pages/[page]`: list pages from their data, prose pages by converting the page's own React elements |
| `src/lib/home-markdown.ts` | `buildHomeMarkdown()` — the Markdown twin of the homepage, built from the data the Classic page renders (served at `/index.md` and by `Accept: text/markdown` on `/`) |
| `src/lib/markdown-response.ts`, `src/lib/markdown-content.ts` | Shared Markdown response shape (`markdownResponse`, `markdownNotFound`, path sanitiser) and `markdownForContent(kind, slug)` behind every `.md` route |
| `src/lib/content-kinds.ts` | `CONTENT_KINDS` / `ContentKind`, in a module with no imports so `markdown-routing.ts` (and through it `src/proxy.ts`) can use the list without pulling the content layer or `node:fs` into the proxy bundle (`markdown-content.ts` re-exports it) |
| `src/lib/api-error.ts` | `apiError()` / `methodNotAllowed()` / `optionsFor()` / `ensureJsonError()` / `withJsonErrors()` and the eight-code `API_ERROR_CODES` catalogue — the one JSON error shape `{error, code, status, hint, docs}` for the failures the public routes raise themselves |
| `src/lib/openapi.ts` | `buildOpenApiDocument()` — the OpenAPI 3.1 description served at `/openapi.json` and rendered by `/developers`; types and assembly only, the operations live in `openapi-v1.ts` and `openapi-legacy.ts`, the schemas in `openapi-schemas.ts` / `openapi-v1-schemas.ts`, the shared header and error pieces in `openapi-parts.ts` |
| `src/lib/site-url.ts` | `SITE_URL`, the canonical origin used by the machine-readable output above |
| `velite.config.ts` | Content schemas (Zod) — Work, Project, Note, Article |
| `next.config.ts` | CSP headers (enforced), security, Turbopack, experimental flags; the export is wrapped in `@next/bundle-analyzer` (`withBundleAnalyzer`) — inert unless `pnpm analyze` (`ANALYZE=true` + `--webpack`), do not delete as dead code. The top docblock still says the CSP "shipped as Report-Only first"; that is stale — `securityHeaders` sets the enforced `Content-Security-Policy` |
| `src/app/api/chat/route.ts` | LLM streaming endpoint |
| `src/app/api/mcp/[transport]/route.ts` | MCP server (10 read-only tools); every transport response passes through `ensureJsonError`, and a non-JSON POST gets a JSON-RPC parse error |
| `src/instrumentation.ts` | Next.js instrumentation hook (config snapshot on cold start; stamps `anvilry:corpus:built_at`: the dashboard's Corpus age, and the FAQ cache's tag only where the host gives no deployment id) |
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
| `LLM_THINKING_EFFORT` | one of `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"` overrides the reasoning effort on every thinking-capable rung (`"xhigh"` is sent as `"max"` to any model that is not Sonnet 5.x; Sonnet 4.6 has no `xhigh`); unset → `medium` for Sonnet 5.x, `low` for the rest; any other value is ignored; no effect while `EXTENDED_THINKING=false`; `xhigh` makes Sonnet 5.5 reason on every question (first answer text after about 4 s; an exact FAQ-cache hit replays the stored summary instead) |
| `EXTENDED_THINKING` / `NEXT_PUBLIC_EXTENDED_THINKING` | `EXTENDED_THINKING="false"` (server, per request) sends `thinking: {type: "disabled"}` (`between_tools` on the Sonnet 5.5 rung); `NEXT_PUBLIC_EXTENDED_THINKING="false"` (build-time) only hides the reasoning panel — independent, so set both to switch reasoning off end to end; the server flag also stops an exact FAQ-cache hit from replaying its stored summary |
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
| `VERCEL_DEPLOYMENT_ID` | Vercel system variable: the FAQ cache's corpus tag (an entry is served only by the deployment that wrote it; empty or unset falls back to the `anvilry:corpus:built_at` stamp); only its presence is logged |
| `NEXT_PUBLIC_GRAPH_PHYSICS` | loads the (non-physics) `scene-physics.tsx` hero variant; not in `.env.example` |

Pull production env vars with: `vercel env pull .env.local`

**Critical gotcha:** Never use `AWS_REGION` — Vercel corrupts it to `s-east-1` in production (missing the `u`). Always use `BEDROCK_REGION`.

**Custom domain:** `https://anvilry.vercel.app` is hardcoded across `src/` and the `Makefile` — **38 files / 65 occurrences** at this tree (the `grep` below, `Makefile` included), of which 16 files are tests that assert against the same host (among them `src/lib/mcp-tools.test.ts`, `notes-dark.test.ts`, `rate-limit.test.ts`, `health-expectations.test.ts` and the Markdown, `llms.txt` and JSON-LD tests), so they must change with the rest or the suite goes red. The Markdown twins, the OpenAPI document, the API error `docs` link, the API catalog, the `/api/v1` index, the Organization JSON-LD and `/developers` take the origin from one constant, `SITE_URL` in `src/lib/site-url.ts`; the older sites still carry their own copy. Not all occurrences are a "base URL" constant (some are prose or comments); the load-bearing ones are the base-URL constants (`SITE_URL`, `const BASE` / `BASE_URL` / `base` / `siteUrl`, `ENDPOINT` in `mcp/page.tsx`, `OWN_NOTES_URL_PREFIX` in `content.ts`, an inline string in `robots.ts`) — `layout.tsx`, `sitemap.ts`, `robots.ts`, `mcp/page.tsx`, the four `[slug]/page.tsx`, `feed.xml/route.ts`, `src/components/json-ld.tsx`, and `src/lib/{llms-txt,resume-json,mcp-tools,content}.ts` — plus `PROD_URL` in the `Makefile`; the root and `articles`/`notes`/`work` `[slug]` `opengraph-image.tsx` files only print the bare hostname as visible text, and `health-expectations.ts` mentions it in a comment. Find every site with:

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

- `game-model.test.ts` asserts a bijection between graph nodes and content items — it **blocks deploys** if orphaned. Run it whenever you add or rename content. One node ID intentionally differs from its slug: `aava` → `aava-code` — this is by design, not a bug.
- **The prompt-injection / XSS guard is `src/components/chat/parse-cards.test.ts`** — do not weaken or skip it. It pins the fail-closed behaviour of the card-token path: an unknown/hallucinated slug is dropped entirely (`DROPS an unknown/hallucinated slug`), a malformed token kind is ignored, an injected URL or path can never become an `href` because the slug charset is locked, and raw HTML/`<script>` stays inert text.
  (`src/components/ask-portfolio.dom.test.tsx` — note the `.tsx` extension — is **not** this guard. It has exactly five tests — shared-transport streaming (`streams an assistant answer through the shared transport`), the 503 not-configured message, and three pinning the neutral AI disclosure (the caption, the greeting, the caption surviving an answer) — and contains zero injection or XSS assertions.)
- `llm.test.ts` pins the snake_case usage field names from the Anthropic SDK (`input_tokens`, not `inputTokens`). A future SDK update that returns camelCase would silently zero out token telemetry; this test is the regression guard.
- `agent-trace.test.ts` does **not** block shipping — it is a *consistency* check. The assertion is `expect(traceApproved).toBe(!hasSentinel)` (`src/lib/agent-trace.test.ts:56`), which passes in both states: sentinel present ⇔ not approved. `src/lib/agent-trace.ts:118` says so outright ("NOT a hard build failure"), and the file's header banner now says the same — it previously claimed the test "BLOCKS shipping", which is what sent this doc wrong in the first place.
  What actually happens: `PLACEHOLDER_SENTINEL` (`"[DRAFT — owner to approve]"`) is currently present, so `traceApproved === false` and `src/components/game/glass-box-demo.tsx:40` returns `null` — the demo ships **dark**, nothing is blocked. Replacing the draft prose lights it up; the test keeps the flag honest either way.
- **Vitest runs two projects:** `node` (default, `src/**/*.test.{ts,tsx}` except `*.dom.test.*`) and `dom` (happy-dom environment, all `*.dom.test.*`). At this tree: 149 test files under `src/` (105 `node`, 44 `dom`; none elsewhere), 1955 tests, all passing (Vitest 5.0.5); they were 131 files (88 / 43) and 1572 tests at v3.17.0. `e2e/` holds 2 Playwright specs that Vitest does not run. `NODE_ENV` is forced to `"test"` to prevent React's missing `act()` warning in the production-default Node environment.
- Tests run as part of `pnpm build` — a failing test blocks deployment. Vercel's build runs `vitest run` in an environment that serves notes (its build env carries `NEXT_PUBLIC_NOTES_ENABLED=true`, observed 2026-11-01, see `docs/configuration.md`), while a default build and GitHub CI have notes dark, so a test must not assume the default flags: pin a flag with `vi.resetModules()` + `vi.stubEnv()` + a dynamic import, as `notes-dark.test.ts` and `v1-notes.test.ts` do.
- The `vitest run` step sits between `velite --clean` and `next build` in the `build` script, so a red test also skips the Next build and the Pagefind index.
- Regression guards for the recent hardening, all in the Vitest suite: `src/lib/notes-dark.test.ts` (no surface lists notes while `NOTES_ENABLED` is off), `src/lib/rate-limit.test.ts` (per-class buckets, `CRON_SECRET` bypass, fail-open), `src/lib/cron-auth.test.ts` and `src/lib/admin-auth.test.ts` (fail-closed / constant-time compares), `src/lib/llm-pricing.test.ts` (every Bedrock model id the chain can produce under any flag combination has a verified price row), `src/lib/deploy-gate-alert.test.ts` (36 tests: the alert script against a mocked GitHub API, its entry by real path and through a symlink, and eight text-level tests over `deploy-smoke.yml`: every step is named, the guard step stays last, every step has a `timeout-minutes` and the limits sum below the job limit, nothing cancels a run, runs are serialised per environment and commit, the alert steps are best effort and sit before the guard, the alert script comes from the default branch, and the permissions stay least-privilege) and `src/lib/deploy-smoke.test.ts` (36 tests, two of which start the smoke script by its real path and through a symlink and expect usage-error exit 2; four of the 36 fail the smoke when the Markdown homepage is HTML or lacks `Vary: Accept`, when `/openapi.json` is thin, and when an unknown API path answers HTML).
- Guards for the agent-readable surface (change (26)): `src/lib/markdown-routing.test.ts` (the proxy's path classification against the real `src/app` tree, so a page missing from both `PAGE_TWINS` and `HTML_ONLY_PAGES` fails), `src/lib/accept-negotiation.test.ts` (q-values, specificity, `q=0`), `src/proxy.test.ts` (the `/admin/*` gate plus the Markdown matcher and decisions), `src/next-config.test.ts` (the `Vary: Accept` and `Link` headers and the `/index.md` rewrite, with the security headers kept on every path), `src/lib/api-error.test.ts` (the error shape, and a failure on any catalogue code that no source file emits), `src/app/api/method-not-allowed.test.ts` (the JSON 405 and an accurate OPTIONS on 15 stubbed routes, 9 GET-only and 6 POST-only, and `GET` only on six prerendered ones), `src/app/api/mcp/[transport]/route.test.ts` (JSON errors on the MCP route, including the parse error for a non-JSON POST), `src/lib/openapi.test.ts` (every documented path is a real route and the document names no chat, voice, beacon, admin or cron route), `src/lib/privacy-facts.test.ts` (each figure `/privacy` prints as a number against the source that enforces it) and `src/app/agent-pages.dom.test.tsx` (the three new pages).
- Guards for the public API contract (change (28)): `src/lib/api-policy.test.ts` (the deprecation headers and the 180-day notice check), `src/lib/public-api-limit.test.ts` (the window limiter, the RateLimit headers, the client key), `src/lib/public-api-paths.test.ts` (the proxy matcher wakes the proxy for every path `isPublicApiPath` accepts and for every documented operation), `src/proxy.test.ts` (version, OPTIONS, 405, 429 and Markdown decisions), `src/lib/client-ip-consistency.test.ts` (the four reviewed `clientIp` copies, each reading the last forwarded-for segment), `src/app/api/v1/v1-contract.test.ts` (every v1 response validates strictly against its OpenAPI schema; the seven static v1 routes export GET only and the seven dynamic ones answer a JSON 405 and an accurate OPTIONS), `src/app/api/md/pages/[page]/route.test.ts` (the page twin route, its 500 body and its own JSON 405 and OPTIONS) and `v1-behaviour.test.ts` (envelopes, 400 / 404 answers, search and tag limits), `src/lib/openapi-v1.test.ts`, `src/lib/api-catalog.test.ts`, `src/lib/developers-content.test.ts`, `src/lib/page-twins.test.ts` and `src/lib/page-markdown.dom.test.tsx` (the twin of each prose page contains everything the HTML shows), and `src/lib/privacy-facts.test.ts` (the 300 / 60 s printed on `/privacy` is the one the proxy enforces, and the limiter never touches Redis), `src/app/api/v1/v1-notes.test.ts` (the v1 notes routes with the flag off and on) and `src/lib/element-markdown.test.tsx` (table-cell pipe escaping by backslash parity), and the `runSmoke pins the public API contract` describe in `src/lib/deploy-smoke.test.ts` (the four new smoke checks fail when `/api/v1` loses `API-Version` or the rate-limit state or reports another version, when an unknown v1 item is not a typed JSON 404, when the API catalog is missing or is not a linkset, and when `/about.md` is HTML or has no top-level heading).

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

E2E specs live in `e2e/` (`views.spec.ts` with 32 tests, `resume.spec.ts`); the config runs two projects, `chromium` (Desktop Chrome) and `mobile-safari` (iPhone 13). The suite covers the classic, chat, developer and gamified views, the home Stack wall's external tool links (`#stack a[target=_blank]`) and the anchored `/about#skills` grid with its glyph chips, the `/decisions`, `/mcp` and `/resume` pages, SEO routes (llms.txt, sitemap.xml, robots.txt), the `resume.json` API smoke test, and the AI disclosure as a phone renders it (the Chat view intro and caption, the widget caption and greeting), and asserts that the About mascot portrait is absent on a flag-less build (no `NEXT_PUBLIC_ABOUT_MASCOT=true`) and that the 404 page shows one of the rotating mascots and that it reacts to a click, that the home featured-projects list shows its "View all N projects" link with at least six cards and no "Private repository" marker, and that `/projects` shows its four group headings and marks a private repository instead of linking it (no "Agent-Forge on GitHub" link, a "Kelvran on GitHub" link), and, in the six tests added by change (26), that `/developers`, `/contact` and `/privacy` each render one `h1`, that the homepage footer links all three, that `/openapi.json` is a 3.1 document which lists its own path, that `/` answers `Accept: text/markdown` with a Markdown body and `Vary: Accept` while `Accept: text/html` still gets HTML, that a missing page answers a real 404 in Markdown to a client that asked for Markdown, and that an unknown `/api/` path answers a JSON error with code `not_found`. In CI it runs in the `e2e` job after the build and the bundle-budget gate.

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
