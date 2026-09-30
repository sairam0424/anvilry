---
kind: doc
title: Config, Build, CI/CD & Infrastructure
domain: [content]
status: current
version: v3.8.0
---

# Config, Build, CI/CD & Infrastructure

> Part of the Anvilry v3.8.0 codebase index. Master entry point: [docs/index/README.md](./README.md)

**Verified against:** Anvilry v3.8.0 (`package.json` version `3.8.0`), i.e. `main` @ `a929932` (`package.json` version `3.6.0`) **plus five post-`a929932` fixes**:
(1) notes are hidden at the data layer when `NEXT_PUBLIC_NOTES_ENABLED` is off
(`src/lib/content.ts`); (2) rate limiting has three per-class buckets — `chat`, `voice`, `beacon` — and a valid
`CRON_SECRET` bearer (shared `src/lib/cron-auth.ts`) bypasses it so the eval cron does not self-throttle; (3) admin
auth is one compare, `isAdminAuthorized` (`src/lib/admin-auth.ts`), shared by `src/proxy.ts`, `requireAdmin` and the
telemetry page; (4) the command-palette talk-mode entry is gated by `isVoiceViewActive`; (5) `MIN_ROUTES = 17` in
`scripts/bundle-budget.mjs` and removal of dead components. Fixes 1-3 and 5 change facts on this page; fix 4 does not
touch this scope. Everything below was re-read from the `a929932`-plus-fixes tree, not carried over from the previous edition; `package.json`'s own version, bumped at the release cut, is `3.8.0`.

**Scope:** `package.json`, `.nvmrc`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
`postcss.config.mjs`, `pnpm-workspace.yaml`, `patches/`, `vercel.json`, `Makefile`, `next-env.d.ts`, `.gitignore`,
`.env.example`, `.coderabbit.yaml`, `scripts/replay-trace.mjs`, `scripts/bundle-budget.mjs`, `.github/**` (**5**
workflows, dependabot, PR + issue templates, CONTRIBUTING), `public/**` (asset tree), plus the untracked agent-tooling
root artifacts `ruvector.db`, `agentdb.rvf`, `agentdb.rvf.lock`, `.swarm/`, `.claude-flow/` (**gitignored**).
**Files indexed:** 25 config/CI files + 7 tracked public assets, plus the never-tracked `public/static/` directory and
the 5 untracked agent-tooling artifacts (neither exists in a clean checkout or a fresh worktree). Versus the previous
edition the config/CI count went 21 → 25: `.github/workflows/gitleaks.yml`, `.github/workflows/scorecard.yml`,
`patches/@react-three__fiber@9.7.0.patch` and `.coderabbit.yaml` were added, so the workflow count is now **5**
(`ls .github/workflows/` → `ci.yml`, `codeql.yml`, `dependency-review.yml`, `gitleaks.yml`, `scorecard.yml`), and
`ci.yml` itself grew from 4 jobs to 5.

## At a glance

| File | Role | Key exports |
|---|---|---|
| `package.json` | name `anvilry`, version `3.8.0`, `private: true`, `engines.node: ">=22 <23"`. 13 scripts (`analyze` and `seal-claims` are the newest), 35 deps, 18 devDeps. **Carries no `pnpm` field** — every pnpm setting lives in `pnpm-workspace.yaml`. Runtime pins: `next 16.3.5`, `react`/`react-dom 19.3.0`, `@modelcontextprotocol/sdk 1.26.0`, `@react-three/postprocessing 3.1.1` (all exact) | n/a (JSON) |
| `.nvmrc` | Single line, `22`. Matches `engines.node` and the CI pin (`.github/workflows/ci.yml:26-29`) | n/a |
| `next.config.ts` | 252-line Next config: enforced CSP + 6 other security headers (7 total, including COOP/CORP), `upgrade-insecure-requests` only when `process.env.VERCEL` is set, per-route `/resume` header override, 4 `.md` rewrites, `cacheComponents`, `inlineCss`, Turbopack root pin, dev-only Velite watch, bundle-analyzer wrapper (**local-only** — inert unless `pnpm analyze` supplies both `ANALYZE=true` *and* `--webpack`) | `default` — `withBundleAnalyzer(nextConfig)` |
| `tsconfig.json` | `strict`, `noEmit`, `allowJs`, `moduleResolution: "bundler"`, `target: ES2017`, `@/*` → `./src/*`, `next` TS plugin. `include` is `**/*.ts`, `**/*.tsx`, `**/*.mts` plus `.next/types` and `.next/dev/types`; `exclude` is only `node_modules` — so `scripts/`, `e2e/` and tests are all type-checked | n/a (JSON) |
| `eslint.config.mjs` | Flat config: `eslint-config-next/core-web-vitals` + `/typescript`, then `globalIgnores` re-declares the defaults plus `.vercel/ .velite/ scratch-pad/ public/static/ public/pagefind/ scripts/` (`:9-22`) | `default` — `eslintConfig` |
| `postcss.config.mjs` | Single plugin `@tailwindcss/postcss` (Tailwind v4, no `autoprefixer`, no `tailwind.config`) | `default` — `config` |
| `pnpm-workspace.yaml` | Not a workspace root. **The single source of truth for all pnpm settings**: 12 security `overrides` (`:18-44`), one `patchedDependencies` entry (`:49-54`), legacy `onlyBuiltDependencies: [esbuild]` (`:70-71`), legacy `ignoredBuiltDependencies: [sharp, unrs-resolver]` (`:74-76`), and `allowBuilds` (`:81-84`) — the boolean map that is the live control on pnpm >=10.28 and 11. The 12-line header comment (`:1-12`) records why the settings left `package.json` | n/a (YAML) |
| `patches/@react-three__fiber@9.7.0.patch` | 42-line `pnpm patch` output: adds `if (!target) return;` to `connect()` in three `dist/events-*` bundles (esm, cjs.prod, cjs.dev) — upstream pmndrs/react-three-fiber#3754. Keyed to exactly `@react-three/fiber@9.7.0`; the lockfile records it at `pnpm-lock.yaml:21-24` | n/a (patch) |
| `vercel.json` | Only key is `crons` — 5 cron schedules mapped to `/api/cron/*` routes. No `buildCommand`, `framework`, `regions`, `functions` or Node setting | n/a (JSON) |
| `Makefile` | 371-line, 36-target ops runbook (`.DEFAULT_GOAL := help`, self-documenting `##` awk renderer) | n/a (make) |
| `next-env.d.ts` | Generated Next ambient types + imports `.next/types/routes.d.ts` and `root-params.d.ts`. **Untracked and gitignored** (`.gitignore:42`, confirmed via `git check-ignore -v`) — written by `next dev`/`next build` (`node_modules/next/dist/lib/typescript/writeAppTypeDeclarations.js`), so it is absent from a fresh worktree until one of them runs; carries a "should not be edited" notice. Listed first in `tsconfig.json:26` `include` | n/a (d.ts) |
| `.gitignore` | 69 lines. Ignores `.env*` except `.env.example` (`:34-35`), `.vercel` (`:38`), `next-env.d.ts` (`:42`), `.velite` (`:45`), `.gstack/`, the generated Pagefind index `/public/pagefind/` (`:50`), `scratch-pad/`, Playwright output (`test-results/`, `playwright-report/`, `.playwright-mcp/`, `:56-58`), and the agent-tooling block `ruvector.db` / `agentdb.rvf` / `agentdb.rvf.*` / `.swarm/` / `.claude-flow/` / `.claude/proven-config.json` / `.claude/.proven-config-version` (`:60-69`) | n/a |
| `.env.example` | 225-line annotated env template — the only committed env file; documents the core variables with rationale, but several real ones are absent (see the env table) | n/a |
| `.coderabbit.yaml` | CodeRabbit review config: `quiet` profile, auto-review only for base branch `^develop$`, `dependabot[bot]` ignored, auto-pause after 5 reviewed commits, eslint + gitleaks tools on (`:6-14`, `:24-28`) | n/a (YAML) |
| `scripts/replay-trace.mjs` | Node CLI: reads 7 telemetry span kinds from Upstash Redis, filters by `traceId`, prints a chronological waterfall. The schema now defines **8** kinds — `chat.cache` is not in its list | n/a (top-level script) |
| `scripts/bundle-budget.mjs` | The bundle gate that replaced `bundle-analysis.yml`. Reads `.next/diagnostics/route-bundle-stats.json` (Turbopack-only, no flag) and asserts a per-route first-load JS ceiling (`MAX_FIRST_LOAD_BYTES = 1_336_000`) **plus** that three.js stays off the first-load critical path. Exits 1 when it cannot measure (fewer than `MIN_ROUTES = 17` records) | n/a (top-level script) |
| `.github/workflows/ci.yml` | 5 jobs: `ci` (lint/tsc/test **+ non-blocking `pnpm audit` + codebase-index citation check + claims-integrity verify**), `claims-integrity-autocommit` (opt-in, `needs: ci`, the only `contents: write` job), `e2e` (Playwright chromium + webkit, build → **bundle budget** → run), `install-pnpm-11` (cold `--frozen-lockfile` install on the *other* pnpm major), `security-alerts` (non-blocking Dependabot report) | n/a |
| `.github/workflows/codeql.yml` | CodeQL Advanced, `javascript-typescript`, `build-mode: none`, push/PR on `develop` **and `main`**, weekly cron `35 1 * * 1` | n/a |
| `.github/workflows/dependency-review.yml` | `actions/dependency-review-action` (SHA-pinned, `# v4`), `fail-on-severity: high`, `fail-on-scopes: runtime`, PRs into `develop`/`main` | n/a |
| `.github/workflows/gitleaks.yml` | Secret scan (`gitleaks/gitleaks-action` v3.0.0), `fetch-depth: 0`, push + PR on `develop`/`main`, `pull-requests: write` for leak comments | n/a |
| `.github/workflows/scorecard.yml` | OSSF Scorecard: push to `main`, weekly cron `30 2 * * 1`, `workflow_dispatch`; `publish_results: true`, SARIF uploaded to code scanning | n/a |
| `.github/dependabot.yml` | Weekly updates → `develop` for **two ecosystems**: `npm` (6 groups, 3 `ignore` entries with root-cause comments) and `github-actions` (bumps the SHA pins) | n/a |
| `.github/PULL_REQUEST_TEMPLATE.md` | Issue link + "Views tested" checklist (Classic, Play, Chat, Developer, Voice) + lint/test/no-content-changes checklist | n/a |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | GitHub Forms bug report: URL, affected view (multi-select), repro, expected/actual, browser, OS | n/a |
| `.github/CONTRIBUTING.md` | Contribution policy: bugs + a11y welcome; content/`profile.ts`/`public/resume` PRs closed (`:19`) | n/a |
| `public/avatar/sairam.glb` | 1,105,768-byte glTF 2.0 binary, AVATURN export. Hero avatar; pinned by an invariant test | n/a (binary) |
| `public/resume/Sairam_Resume_MX_E.pdf` | The canonical (and only) résumé PDF, 30,831 B — `resumeVariants` in `src/lib/profile.ts:136-142` has exactly one entry | n/a |
| `public/file.svg` | create-next-app scaffold SVG — **no referrer anywhere in the repo** (grep-verified) | n/a |
| `public/globe.svg` | create-next-app scaffold SVG — unreferenced | n/a |
| `public/next.svg` | create-next-app scaffold SVG — unreferenced | n/a |
| `public/vercel.svg` | create-next-app scaffold SVG — unreferenced | n/a |
| `public/window.svg` | create-next-app scaffold SVG — unreferenced | n/a |
| `public/static/` | Never tracked and absent from a clean checkout (git does not track empty directories). Intended root for case-study `diagram` assets (`src/lib/case-study-depth.test.ts:27`) and ESLint-ignored (`eslint.config.mjs:19`) | n/a |
| `ruvector.db` | ~1.5 MB binary at the repo root on the `sairam-dev` checkout (`redb` magic in the first 4 bytes). Untracked; **gitignored** (`.gitignore:63`, confirmed with `git check-ignore -v`). Agent-tooling artifact (Ruflo / claude-flow vector store), not an application file; no file under `src/`, `scripts/`, or the root configs reads it | n/a (binary) |
| `agentdb.rvf` | 162-byte binary, `SFVR`/`FLVR` framing with an internal `agentdb.rvf` label. Untracked; gitignored (`.gitignore:64`). Agent-tooling artifact | n/a (binary) |
| `agentdb.rvf.lock` | 104-byte lock sidecar for `agentdb.rvf`. Untracked; gitignored by the wildcard `agentdb.rvf.*` (`.gitignore:65`). Agent-tooling artifact | n/a (binary) |
| `.swarm/` | One file, `.swarm/agentdb-memory.db` (1,105,920 B on 2026-09-29, mode `0600`; the earlier edition recorded ~456 KB). Untracked; gitignored (`.gitignore:66`). Agent-tooling artifact, live-mutating | n/a |
| `.claude-flow/` | Four JSON files (sizes on 2026-09-29; the earlier edition recorded ~750 KB, 121 B and ~1.1 MB for the last three) — `harness-active-policy.json` (349 B), `neural/patterns.json` (11,826,972 B), `neural/stats.json` (126 B), `policy/state.json` (14,682,558 B, mode `0600`), plus a leftover write-temp `policy/state.json.<pid>.<uuid>.tmp` (13,562,835 B). Untracked; gitignored (`.gitignore:67`). Agent-tooling artifact, live-mutating | n/a (JSON) |

**Agent-tooling artifacts — the accidental-commit hole is closed.** At v3.4.2 none of the five entries above was
matched by any `.gitignore` pattern, so a `git add -A` would have committed several MB of regenerable agent
state. The block at `.gitignore:63-69` now covers them (`ruvector.db`, `agentdb.rvf`, `agentdb.rvf.*`, `.swarm/`,
`.claude-flow/`); the three comment lines above it (`.gitignore:60-62`) record the magnitude ("~5.9 MB of regenerable binaries at last measure, and
growing — never commit") and the reason there are stray copies at all: the tooling writes into the **current working
directory**, so a `cd` into any subdirectory drops a second set there. The same block now also ignores
`.claude/proven-config.json` and `.claude/.proven-config-version` (`.gitignore:68-69`) — the two local harness files
the previous edition listed as still un-ignored. Verified per path with `git check-ignore -v`: every one resolves to a
rule.

The five agent-tooling artifacts and their byte sizes were measured on the `sairam-dev` checkout; none of them exists
in a fresh worktree. The `.swarm/` and `.claude-flow/` sizes above were re-read there with `stat` (read-only) on
2026-09-29 and had grown a lot since the first edition (`patterns.json` and `state.json` by more than 10x) — the five artifacts now total about 29 MB (excluding the leftover `.tmp`), against the
"~5.9 MB" that the `.gitignore` comment recorded "at last measure"; `ruvector.db` (1,589,248 B), `agentdb.rvf` and its lock
were unchanged. They are live-mutating tool state and grow between runs (`policy/state.json` was re-measured twice while
the first edition of this page was written and differed both times) — treat the magnitudes as approximate and re-measure
rather than citing them.

[README § Repo layout](./README.md#repo-layout) lists `ruvector.db` and `.claude-flow/` under the parent
`Anvilry/` wrapper; copies also exist at the `sairam-dev` root, inside this git repo. No file under `src/`,
`scripts/` or the root configs reads any of them.

## npm scripts

| Script | Command | When to use | Ordering constraints |
|---|---|---|---|
| `predev` | `velite` | Auto-runs before `dev` | pnpm lifecycle hook. Runs **without** `--clean` on purpose — see gotchas |
| `dev` | `next dev` | Local development @ :3000 | Velite *also* starts in watch mode from inside `next.config.ts:12-16` when `process.argv` contains `"dev"` |
| `build` | `velite --clean && vitest run && next build && pagefind --site .next/server/app --output-path public/pagefind` | Production build (Vercel runs this). The bare `next build` is a **Turbopack** build, which is what writes `.next/diagnostics/route-bundle-stats.json` | **Order is load-bearing — see below** |
| `analyze` | `velite --clean && ANALYZE=true next build --webpack` | **Local bundle attribution only** — writes the treemap HTML to `.next/analyze/`. Never runs in CI | `--webpack` is mandatory, not stylistic: without it the build is Turbopack and `@next/bundle-analyzer` produces nothing. Conversely a `--webpack` build emits **no** `route-bundle-stats.json`, so `pnpm build` must be re-run before the bundle-budget gate — see below |
| `start` | `next start` | Serve a built app; also what Playwright's `webServer` runs (`playwright.config.ts:38`) | Requires a prior `pnpm build` |
| `lint` | `eslint` | Lint (no `--fix`, no path arg — flat config resolves the target set) | Not part of `build`; CI-only gate (`ci.yml:57-58`) |
| `test` | `vitest run` | One-shot test run (both `node` + `dom` projects) | Needs `.velite/` present first |
| `test:watch` | `vitest` | Interactive TDD | — |
| `content` | `velite --clean` | Force-regenerate `.velite/` when watch misses an MDX change | Also the exact command CI uses to materialize gitignored types — in **one** place only (`ci.yml:54-55`) |
| `seal-claims` | `tsx scripts/seal-claims.ts` | Verify (default) or seal (`--write`) the Claims Integrity Ledger, `data/integrity-chain.json` | Must run under `tsx`, never bare `node` — it imports `src/lib/profile.ts` through the `@/*` alias. CI runs the verify form in `ci` (`ci.yml:83-84`) |
| `clean` | `rm -rf .next .turbo node_modules/.cache .velite` | Nuke all build artifacts | After this, `pnpm content` is mandatory before `test`/`tsc`. Does **not** remove `public/pagefind/` |
| `e2e` | `playwright test` | Playwright suite (`e2e/`) | `playwright.config.ts` carries a `webServer` block (`:37-44`), so no manual server step; needs a build for `pnpm start` |
| `e2e:ui` | `playwright test --ui` | Interactive Playwright | — |

**Why `build` is `velite --clean && vitest run && next build && pagefind …`:**

1. **`velite --clean` must come first.** `.velite/` is gitignored (`.gitignore:45`), and `src/lib/content.ts:14`
   imports the generated collections via a relative `../../.velite` path. Without a prior Velite run, *both*
   `vitest` and `next build` fail at module resolution. `--clean` is used here (unlike `predev`) so a production
   build starts from a pristine output directory.
2. **`vitest run` sits between generation and compilation so a failing test blocks the deploy** — the `&&` chain
   means a non-zero exit never reaches `next build`. This is what makes the repo's build-time invariants real
   gates rather than advisory: the graph↔content bijection (`game-model.test.ts`), the
   `PLACEHOLDER_SENTINEL` consistency check (`agent-trace.test.ts`), the MCP tool-documentation contract
   (`src/app/mcp/tools-documented.test.ts`), the pnpm build-allowlist consistency check
   (`src/lib/pnpm-build-allowlist-consistency.test.ts`), and the 1.5 MB avatar budget + compression/rig assertions
   (`src/lib/avatar-glb.test.ts:21,58-95,101-131`).
3. **`next build` last-but-one**, consuming both the fresh `.velite/` output and a green test suite.
4. **`pagefind` closes the chain.** It indexes the just-built `.next/server/app` into `public/pagefind/`, which is
   gitignored (`.gitignore:50`) and never committed. So `/search` needs **no** separate manual step after a build any
   more; `make search-index` is now only a way to regenerate the index without a full rebuild (`Makefile:64-66`). A
   failing `pagefind` fails `pnpm build` — the deploy.

`vitest.config.ts:26` pins `env: { NODE_ENV: "test" }` specifically because this chain runs inside `pnpm build`,
where Vercel's build shell exports `NODE_ENV=production` — which would load React's production bundle, strip
`act`, and fail every DOM test.

**`build` and `analyze` run two different bundlers, and that is the whole design.** A bare `next build` in
Next 16 is **Turbopack** — `node_modules/next/dist/lib/bundler.js:142-144` comments that "the default is
turbopack when nothing is configured" and sets `process.env.TURBOPACK='auto'`. `@next/bundle-analyzer` is
webpack-only, and it **short-circuits on sight of that variable**: `node_modules/@next/bundle-analyzer/index.js:7`
tests `if (process.env.TURBOPACK)`, warns *"not compatible with Turbopack builds, no report will be generated"*
(`:9`), and returns the config **unmodified** (`:14`) — never reaching the `webpack(config, options)` hook at
`:20` that installs the plugin. Its own warning text names the remedy: "To run this analysis pass the
`--webpack` flag to `next build`" (`:12`). So `ANALYZE=true` on a bare build is a **no-op**, which is why
`analyze` passes `--webpack` explicitly. The two builds produce disjoint artifacts and neither substitutes for
the other:

| Command | Bundler | Emits | Consumed by |
|---|---|---|---|
| `pnpm build` | Turbopack | `.next/diagnostics/route-bundle-stats.json` (no flag needed) | `scripts/bundle-budget.mjs`, the CI gate |
| `pnpm analyze` | webpack (`--webpack`) | `.next/analyze/{client,edge,nodejs}.html` — the three `reportFilename` values at `node_modules/@next/bundle-analyzer/index.js:27-31` | a human, locally |

The deliberate consequence: running the gate straight after `pnpm analyze` **fails**, because a `--webpack`
build never writes `route-bundle-stats.json` — and the script's error message names `--webpack` as the likely
cause (`scripts/bundle-budget.mjs:96-98`). Re-run `pnpm build` before the gate.

Every citation in this paragraph points into `node_modules/`, so all of them are version-bound and **not**
machine-checked by `scripts/check-index-citations.mjs` (its citable set is first-party source and the listed root
files; see the CI section). Re-verify them after any Next or analyzer upgrade.

**Not in `package.json`:** there is **no `search-index` script**. `CLAUDE.md` (§ Commands) documents that there
is none and that `make search-index` is the Makefile target; the Pagefind command itself is inlined in the `build`
script (`package.json:11`) and in the Makefile (`Makefile:66`). Likewise `lint` and `tsc --noEmit` are **not** part
of `pnpm build` — they run only in CI, as does the bundle-budget gate. There is also no `packageManager` field, so a
contributor's local pnpm version is unpinned; the pnpm major is pinned only by CI — `pnpm/action-setup` `version: 10`
in the `ci`, `claims-integrity-autocommit` and `e2e` jobs (`.github/workflows/ci.yml:24`, `:108`, `:155`) and
`version: 11` in `install-pnpm-11` (`:230`).

**Node version is pinned three ways, and the pin is load-bearing.** `package.json:5-7` declares
`engines: { node: ">=22 <23" }`, `.nvmrc:1` is `22` and every `setup-node` step in `ci.yml` uses `node-version: 22`
(`:29`, `:113`, `:160`, `:235`) — deliberately a *ceiling*, not just a floor. `CHANGELOG.md:354-357` records the
failure that motivated it: a contributor on Node 26 saw **9 failing tests and a red `pnpm build` with no explanation**,
because Node 26 exposes a native `localStorage` global (unavailable without `--localstorage-file`) that collides with
vitest's happy-dom global injection. Widening the range re-opens that trap. Limits: `engines` **warns rather than
errors** (there is no `engine-strict` setting anywhere), so it informs without blocking; `devDependencies` carries
`"@types/node": "^26"` (`package.json:66`), so the type surface describes Node 26 APIs while the runtime is capped at
22; and none of the three pins reaches production — `vercel.json` has no Node setting, so the deployment Node major is
whatever the Vercel project is configured for (not visible from the repo).

## Makefile targets

`SHELL := /bin/bash`, `.SHELLFLAGS := -euo pipefail -c` (`Makefile:7-8`), `.DEFAULT_GOAL := help` (`Makefile:9`).
`PROD_URL := https://anvilry.vercel.app` (`Makefile:19`). Every target carries a `##` comment that `help`
renders via awk (`Makefile:28-34`). Section banners (`## Development`, etc.) are printed by the `/^## /` awk rule.

| Target | Command | Purpose |
|---|---|---|
| `help` | awk over `$(MAKEFILE_LIST)` | Default goal; renders every `##`-annotated target + scaffold usage examples (`Makefile:26-40`) |
| `dev` | `pnpm dev` | Dev server with Velite watch |
| `test` | `pnpm test` | Full vitest suite once |
| `test-watch` | `pnpm test:watch` | Vitest watch mode |
| `lint` | `pnpm lint` | ESLint across the project |
| `build` | `pnpm build` | Full production build (velite + vitest + next + pagefind) |
| `search-index` | `pnpm pagefind --site .next/server/app --output-path public/pagefind` | Regenerate the Pagefind static index consumed by `/search` (`src/app/search/page.tsx:24,35` load `/pagefind/pagefind-ui.css` + `.js`). `pnpm build` already runs this; the target is only for re-indexing without a rebuild, and still needs a prior build for `.next/server/app` (`Makefile:64-66`) |
| `start` | `pnpm start` | Serve the production build locally |
| `clean` | `pnpm clean` | Wipe `.next .velite .turbo node_modules/.cache` |
| `install` | `pnpm install` | Install/sync deps |
| `content` | `pnpm content` | Force-regenerate all Velite collections |
| `new-article` | `printf` frontmatter → `content/articles/$(SLUG).mdx` | Scaffold an article stub with `draft: true`, `source` (default `native`), optional `URL`, `date` from `date +%Y-%m-%d`. Errors if `SLUG` unset; skips if the file exists (`Makefile:86-103`) |
| `new-note` | `printf` frontmatter → `content/notes/$(SLUG).mdx` | Scaffold an Inkforge-compatible note (`tone: senior`, `format: explainer`, `length: comprehensive`). Prints the `NEXT_PUBLIC_NOTES_ENABLED=true` reminder (`Makefile:105-120`) |
| `new-project` | `printf` frontmatter → `content/projects/$(SLUG).mdx` | Scaffold a project with `group: "Tooling & Lab"`, `repo: https://github.com/sairam0424/$(SLUG)`, `order: 100` (`Makefile:122-135`) |
| `new-work` | `printf` frontmatter → `content/work/$(SLUG).mdx` | Scaffold a case study with a placeholder `register` and one `metrics` row (`Makefile:137-150`) |
| `flags-show` | `printf` of `$${VAR:-default}` | Print all `NEXT_PUBLIC_*` flags + `FLAG_DRIVER` with their documented defaults, grouped Writing / Views / Beast-Mode / Flags SDK (`Makefile:154-180`) |
| `flags-notes-on` | prints commands | Prints `vercel env add NEXT_PUBLIC_NOTES_ENABLED production` + redeploy instructions (does not execute) |
| `flags-notes-off` | prints commands | Prints `vercel env rm NEXT_PUBLIC_NOTES_ENABLED production` + redeploy instructions |
| `flags-beast` | prints commands | Prints all 6 beast-mode flag names with one-line descriptions (`Makefile:208-222`) |
| `push` | `git push origin HEAD` | Push current branch |
| `pr` | `gh pr create --base develop` | PR: current branch → `develop` |
| `pr-prod` | `gh pr create --base main --head develop` | Release PR: `develop` → `main` |
| `deploy-preview` | `vercel deploy` | Manual Vercel preview deployment |
| `deploy-prod` | `vercel deploy --prod` | Manual Vercel production deployment |
| `rollback` | `vercel rollback` | Roll back to the previous production deployment |
| `logs` | `vercel logs --tail` | Stream all runtime logs |
| `logs-flags` | `vercel logs --tail 2>&1 \| grep '\[flags\]'` | Filter to flag-resolution lines emitted by `src/lib/flags.ts:44,59` |
| `logs-llm` | `vercel logs --tail 2>&1 \| grep '\[llm\]'` | Filter to LLM lines |
| `trace` | `node scripts/replay-trace.mjs $(TRACE_ID)` | Replay a request trace. Errors if `TRACE_ID` unset, with the hint that it comes from the `x-anvilry-trace-id` response header (`Makefile:264-269`) |
| `health` | `curl -s -o /dev/null -w …` POST to `$(PROD_URL)/api/chat` | Smoke-test the live chat endpoint; prints HTTP status + total time (`Makefile:271-280`) |
| `admin` | `open $(PROD_URL)/admin/telemetry` | Open the Basic-Auth telemetry dashboard |
| `env-check` | `printf` with `$(if $(VAR),SET (masked),…)` | Audit which env vars are set, secrets masked, grouped LLM Provider (now including `LLM_USE_SONNET_5` and `LLM_USE_SONNET_5_5`) / Rate Limiting / FAQ Cache (`FAQ_CACHE_ENABLED`, `FAQ_CACHE_SEMANTIC_MATCH`) / Voice / Telemetry / Flags SDK (`Makefile:288-319`) |
| `env-setup` | prints a guide | Step-by-step `.env.local` bootstrap, including `TELEMETRY_IP_SALT=$$(openssl rand -base64 16)` |
| `env-vercel` | `vercel env pull .env.local` | Pull Vercel env vars into `.env.local` |
| `resume-list` | `ls -lh public/resume/*.pdf \| awk …` | List resume PDFs with sizes; reminds you to update `src/lib/profile.ts resumeVariants` (`Makefile:360-367`) |
| `resume-open` | `open public/resume/` | Open the resume directory in Finder |

**Gotcha:** there is **no `make e2e` target** — the Playwright suite is reachable only via `pnpm e2e` /
`pnpm e2e:ui` or the CI job. `env-check` / `flags-show` use make's `$(if $(VAR),…)` and shell
`$${VAR:-default}` forms, which read the **make/shell environment**, not `.env.local` — so they report
`UNSET` for values that Next would happily load from the dotenv file.

## Security headers & CSP

All defined in `next.config.ts`. `securityHeaders` (`next.config.ts:89-115`) has **7 entries** and is applied to
`/:path*` (`next.config.ts:234`), with a `/resume` + `/resume/:path*` variant (`next.config.ts:236-237`).

| Header | Value | Reason (from the inline comments) | Cite |
|---|---|---|---|
| `X-Frame-Options` | `DENY` (→ `SAMEORIGIN` on `/resume*`) | Clickjacking defense, paired with `frame-ancestors 'none'` | `next.config.ts:90`, override `:219-220` |
| `X-Content-Type-Options` | `nosniff` | — | `next.config.ts:91` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | — | `next.config.ts:92` |
| `Cross-Origin-Opener-Policy` | `same-origin` | "No OAuth popups or cross-origin postMessage flows on this auth-less site, so same-origin isolation costs nothing"; external links already open with `noopener,noreferrer` | `next.config.ts:97`, rationale `:93-96` |
| `Cross-Origin-Resource-Policy` | `same-origin` | Same rationale block. Applies to **every** route, including `/api/*` and static assets — it blocks cross-origin `no-cors` embedding of the site's own resources | `next.config.ts:98` |
| `Permissions-Policy` | `microphone=(self), camera=(), geolocation=(), browsing-topics=()` | "Voice requests the mic — scope it to same-origin and deny camera/geo/etc." | `next.config.ts:99-103` (comment `:99`, entry `:100-103`) |
| `Content-Security-Policy` | the `csp` string below (**enforced**, not Report-Only) | Shipped Report-Only in v1.4.0; flipped to enforce after a live Playwright sweep across all four views (incl. the WebGL Play view) logged zero violations and a per-directive audit covered every browser-loadable resource. Only the header key changed — the policy string is byte-identical to the proven Report-Only version | `next.config.ts:104-114` |
| **HSTS** | *intentionally absent* | "HSTS is already set by Vercel's platform default, so it is intentionally omitted here (avoids a weaker duplicate)" | `next.config.ts:87-88` |

**CSP, directive by directive** (`next.config.ts:37-85`, joined with `"; "`):

| Directive | Value | Reason | Cite |
|---|---|---|---|
| `default-src` | `'self'` | Baseline deny-by-default | `:38` |
| `base-uri` | `'self'` | — | `:39` |
| `object-src` | `'none'` | — | `:40` |
| `frame-ancestors` | `'none'` | Clickjacking defense; pairs with `X-Frame-Options: DENY`. **Rewritten to `'self'` for `/resume*`** so the site can embed its own resume PDF in an iframe | `:41`, override `:218-230` |
| `form-action` | `'self'` | — | `:42` |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://va.vercel-scripts.com https://vercel.live` | See `'unsafe-eval'` note below. `'unsafe-inline'` covers Next's inline bootstrap, the `inlineCss` experiment, and Motion's runtime style attributes "which nonces can't cover" | `:43-51`, `:111-113` |
| `style-src` | `'self' 'unsafe-inline'` | Next inline bootstrap + `inlineCss` + R3F/Vercel inline styles | `:52`, rationale `:30-32` |
| `img-src` | `'self' data: blob: https://img.shields.io` | `data:` for WebGL textures, `blob:` for object URLs; `img.shields.io` matches the sole `images.remotePatterns` entry (`:210`) | `:53`, rationale `:33-34` |
| `media-src` | `'self' blob:` | The Polly `<audio>` `blob:` URL created by `URL.createObjectURL` in `use-speech-synthesis.ts` | `:54`, rationale `:33-34` |
| `font-src` | `'self' data:` | — | `:55` |
| `connect-src` | `'self' https://*.vercel-insights.com https://vitals.vercel-insights.com https://va.vercel-scripts.com wss://speech.googleapis.com wss://speech.platform.bing.com https://www.gstatic.com` | `'self'` covers every `/api/*` route — Bedrock/Polly/Transcribe are called **server-side**, so the browser never connects to AWS. The Vercel hosts are for the injected analytics/insights beacons | `:67`, rationale `:22-29`, `:56-66` |
| `worker-src` | `'self' blob:` | `'self'` covers the one real worker in the app: pdf.js spawns a Web Worker from the same-origin bundled URL that `file-picker-button.tsx` assigns to `GlobalWorkerOptions.workerSrc` (`src/components/chat/file-picker-button.tsx:79-82`), on the `NEXT_PUBLIC_PDF_ATTACHMENTS` path. **`blob:` has no identified consumer** — see the note below | `:68` |
| `manifest-src` | `'self'` | — | `:69` |
| `upgrade-insecure-requests` | (flag) | **Vercel-only**: appended only when `process.env.VERCEL` is set (`...(process.env.VERCEL ? ["upgrade-insecure-requests"] : [])`). Locally the app is plain HTTP and WebKit obeys the directive literally, rewriting every script/font/manifest request to `https://localhost:PORT`, so no client JS loads at all (no hydration, no `?view=` sync). Chromium special-cases `localhost` and ignores it, which is why only the Playwright `mobile-safari` project exposed it. Production posture is unchanged | `:84`, rationale `:70-83` |

**`worker-src` outlived the package it was written for.** The directive was added for an R3F
`@react-three/offscreen` worker/`OffscreenCanvas` offload that **never existed in `src/`** — that package was
declared but imported nowhere, and it was **removed from `package.json` in v3.5.0** (`CHANGELOG.md:373-377`). The
directive itself is still correct and still needed, but for a different reason than the one it was written for:
`'self'` is what lets pdf.js start its worker. `blob:` is the residue — a repo-wide grep finds **no
`new Worker(` and no `OffscreenCanvas` anywhere under `src/`**, and the only `URL.createObjectURL` call sites are
audio (`src/components/chat/use-speech-synthesis.ts:406`, covered by `media-src`) and image previews
(`src/components/chat/file-picker-button.tsx:126`, covered by `img-src`) — never a worker. Dropping `blob:` from
this directive is therefore believed safe, but it is untested and the payoff is nil, so it is left alone. The
lesson is the general one: a CSP directive whose stated justification is a dependency can outlive the
dependency, and nothing in the toolchain notices.

**Why `'unsafe-eval'` is required** (`next.config.ts:43-50`): `MDXContent` uses `new Function(code)` to evaluate
the Velite-generated MDX function-body string **in the browser at runtime**, on every page with MDX body content
(projects, work, notes). The comment explicitly records that a previous version of this comment claiming "Velite
pre-compiles MDX at build time" was **incorrect** — Velite emits a serialized `code` string that `MDXContent`
deserialises client-side. Removing `'unsafe-eval'` crashes all project/work/note pages with a React
render-error boundary. Accepted risk on the stated grounds: no auth, no untrusted user input, and
`rehype-sanitize` guarding chat markdown, so the eval surface is author-controlled MDX only.

**Speech / WebSocket allowlist — which host, which browser** (`next.config.ts:56-66`, restated at `:22-29`):

- `wss://speech.googleapis.com` — **Chrome / Chromium-based Edge.** The browser `SpeechRecognition` API opens a
  cross-origin WebSocket to Google's cloud, and that connection is subject to `connect-src` as of Chrome 63.
  Without this entry every recognition attempt fails with `onerror.error === "network"` and the voice loop goes
  straight to "paused" — i.e. voice is permanently broken in production.
- `wss://speech.platform.bing.com` — **Edge on Windows**, which routes to Microsoft's speech service instead of
  Google's; same WebSocket model, different host.
- `https://www.gstatic.com` — **Chrome's online `SpeechSynthesis` voices** (e.g. "Google US English") stream from
  gstatic. Omitting it is non-breaking (falls back to local voices) but degrades talk-mode voice quality.
- Recorded browser matrix: Safari uses on-device processing (no external connect); Firefox disables the API by
  default (`:59-61`).
- Recorded blind spot: "The Playwright zero-violation audit never exercised live mic input, so this was invisible
  until the CSP was enforced in production" (`next.config.ts:60-61`).

## Environment variables

Sources: `.env.example` (the only committed env file; `.gitignore:34-35` allows exactly `!.env.example`) plus a
grep of every `process.env.*` read under `src/`. "Required?" reflects what the code does when the value is absent.

| Name | Required? | Consumed by (path:line) | Purpose | Gotchas |
|---|---|---|---|---|
| `LLM_PROVIDER` | No (default `bedrock`) | `src/lib/llm.ts:148` | `"anthropic"` → direct API, anything else → Bedrock | Provider switch is an env change, not a code change (`.env.example:2-4`) |
| `LLM_USE_SONNET_5` | No (default off) | `src/lib/llm.ts:44` (`isSonnet5PrimaryEnabled()`, `=== "true"`) | Moves **only the primary rung** of whichever chain `LLM_PROVIDER` selects to Claude Sonnet 5; the Opus and Haiku rungs are unchanged | Sonnet 5 rejects the old `thinking.enabled` + `budget_tokens` request shape (400), so the flag depends on the adaptive-thinking shape in `llm.ts`. |
| `LLM_USE_SONNET_5_5` | No (default off) | `src/lib/llm.ts:64-66` (`isSonnet55PrimaryEnabled()`, `=== "true"`) | Moves **only the primary rung** of whichever chain `LLM_PROVIDER` selects to Claude Sonnet 5.5, and wins over `LLM_USE_SONNET_5`; the Opus and Haiku rungs are unchanged | On Bedrock 5.5 exists only as the **global** inference profile `global.anthropic.claude-sonnet-5-5` (there is no `us.` profile), so requests may be processed outside the US regions and IAM must allow the profile. 5.5 rejects `thinking: {type: "disabled"}` (400), so `llm.ts` sends `{type: "between_tools"}` when thinking is off (`thinkingOff()`, `llm.ts:119-125`). No `BEDROCK_PRICE` row, so `cost_usd` is approximate |
| `BEDROCK_ACCESS_KEY_ID` | Yes for chat | `src/lib/llm.ts:175`; presence logged `src/instrumentation.ts:65` | Bedrock creds | Stored **base64-encoded**; `decodeSecret()` round-trip-equality-checks so raw keys pass through unchanged (`.env.example:6-12`) |
| `BEDROCK_SECRET_ACCESS_KEY` | Yes for chat | `src/lib/llm.ts:176` | Bedrock creds | Same base64/raw handling |
| `BEDROCK_SESSION_TOKEN` | No | `src/lib/llm.ts:177-178` | Temporary STS creds only | `.env.example:15` |
| `BEDROCK_REGION` | No (default `us-east-1`) | `src/lib/llm.ts:183` | Bedrock region | **Use this, never `AWS_REGION`** — see the corruption note below |
| `AWS_REGION` | No | `src/lib/llm.ts:183` (2nd fallback); `src/instrumentation.ts:43` (region label) | Legacy region fallback | **CORRUPTION:** `AWS_REGION` is a reserved var on Vercel/Lambda and was observed in production as `"s-east-1"` — the leading `u` stripped (`.env.example:16-18`; `CLAUDE.md:390`, "Critical gotcha"). Resolution order is `BEDROCK_REGION \|\| AWS_REGION \|\| "us-east-1"`, so a corrupted `AWS_REGION` is only reached when `BEDROCK_REGION` is unset. **`.env.example:20` nonetheless sets `AWS_REGION=us-east-1` uncommented**, directly under its own warning |
| `ANTHROPIC_API_KEY` | Only when `LLM_PROVIDER=anthropic` | `src/lib/llm.ts:193` | Direct Anthropic API key | `.env.example:24` (commented) |
| `UPSTASH_REDIS_REST_URL` | No | `src/lib/redis.ts:26`; `scripts/replay-trace.mjs:27` | Redis singleton for rate-limit + FAQ cache + telemetry + admin | **Fails open:** unset → limiter is a no-op and chat still works (`.env.example:36-38`). `src/lib/rate-limit.ts:62` logs a warning when unset *and* `NODE_ENV === "production"`. Rate limiting is **three independent sliding-window buckets** — `chat` (`/api/chat`), `voice` (`/api/tts`, `/api/tts-google`, `/api/transcribe`), `beacon` (`/api/error`) — each 8 requests / 60 s per IP with its own prefix `anvilry:chat` / `anvilry:voice` / `anvilry:beacon` (`src/lib/rate-limit.ts:19-29`), so TTS traffic cannot 429 the user's chat. `.env.example:35` (and the production warning at `rate-limit.ts:64-66`) name only `/api/chat`, `/api/tts` and `/api/transcribe`, omitting `/api/tts-google` and `/api/error` |
| `UPSTASH_REDIS_REST_TOKEN` | No | `src/lib/redis.ts:27`; `scripts/replay-trace.mjs:28` | Redis auth | Both must be set together; `replay-trace.mjs:30-37` hard-exits(1) if either is missing |
| `GOOGLE_TTS_API_KEY` | No | `src/app/api/tts-google/route.ts:39` | Google Cloud TTS (Chirp 3 HD) | Unset → `/api/tts-google` answers 503 and the client speaks the rest of the answer with the browser voice (there is no Google → Polly hop). Nothing client-side reads the key, so the Google voices and the engine option **stay** in the picker (`voice-settings-dialog.tsx` lists every `TtsEngine`); the `.env.example:112-120` comment saying they are hidden is stale, as the `GOOGLE_TTS_API_KEY` row of `docs/configuration.md` notes |
| `ADMIN_PASSWORD` | No | `src/lib/admin-auth.ts:25` (`isAdminAuthorized`) — shared by `src/proxy.ts:26`, `requireAdmin` (`admin-auth.ts:48`; used by `src/app/api/admin/faq-cache/purge/route.ts:32`) and the `/admin/telemetry` page (`src/app/admin/telemetry/page.tsx:472`) | HTTP Basic Auth for `/admin/telemetry` and the FAQ-cache purge route | **One implementation now**: SHA-256 digests compared with `timingSafeEqual`. `src/proxy.ts` runs on Next 16's default **Node.js** runtime (matcher `/admin/:path*`, `:22`), not Edge; the page re-checks auth itself and calls `notFound()` when unauthorized. Unset → deny-all, with a `console.warn` (`admin-auth.ts:29`): the proxy answers 401 + `WWW-Authenticate`, and the page would `notFound()`. **No code path renders "auth setup instructions"**; `.env.example:139-140` and `Makefile:313` used to say it does and were corrected together with this index (they now say an unset password locks `/admin/*` out with a 401), as was the `ADMIN_PASSWORD` row of `docs/configuration.md` |
| `TELEMETRY_ENABLED` | No (default on) | `src/app/api/error/route.ts:92` | `"false"` short-circuits to 204 with no emit | **Scope is the browser beacon only:** the only read in `src/` is the `/api/error` beacon route — `/api/chat`, `/api/tts`, etc. do not check it. `.env.example:135` used to say it "disables all event emission"; it and the `TELEMETRY_ENABLED` row of `docs/configuration.md` were corrected to say so |
| `TELEMETRY_IP_SALT` | No | `src/lib/telemetry/with-trace.ts:157` | Salt for SHA-256 IP hashing | Unset → IPs stored as `"anonymous"` (`.env.example:136-138`) |
| `CRON_SECRET` | Yes for crons | `src/lib/cron-auth.ts:16` (`hasValidCronSecret`), applied in all 5 cron routes via `unauthorizedUnlessCron` — `eval:103`, `github-sync:19`, `health-check:152`, `seo-audit:17`, `content-audit:20` (all `src/app/api/cron/*/route.ts`) | Bearer-token auth for all 5 cron routes; **also bypasses the rate limiter** (`src/lib/rate-limit.ts:100`) | **Fail-closed:** unset or empty → `hasValidCronSecret` is false → 401 `{error: "Unauthorized"}` (`cron-auth.ts:25`), so an unset secret means every cron endpoint 401s rather than being public. The compare hashes both sides with SHA-256 before `timingSafeEqual` (constant time, length-blind). The eval cron forwards the same bearer to `/api/chat` (`src/app/api/cron/eval/route.ts:127`) so its 12 sequential chats do not exhaust the 8/min `chat` bucket; it also sends `X-Chat-Skip-Cache: 1` (`src/app/api/cron/eval/route.ts:124`) and so never participates in the FAQ cache (`src/lib/chat-cache.ts:56-62`). `.env.example:122-127` documents the fail-closed contract |
| `FAQ_CACHE_ENABLED` | No (default on) | `src/lib/chat-cache.ts:130` (`isFaqCacheEnabled()`, `!== "false"`) | Kill switch for the **whole** FAQ response cache (both tiers) on `/api/chat` first-turn questions, independent of Redis config | Only mentioned in a comment (`.env.example:46`), never as a variable line; `make env-check` prints it (`Makefile:306`). Telemetry kind `chat.cache` records hits and misses (`src/lib/telemetry/schema.ts:37-50`) |
| `FAQ_CACHE_SEMANTIC_MATCH` | No (default off) | `src/lib/chat-cache.ts:122` (`isSemanticMatchEnabled()`, `=== "true"`) | Adds a second lookup tier: a Bedrock Titan Embeddings V2 (`amazon.titan-embed-text-v2:0`, 512 dims, 5 s timeout — `src/lib/faq-embeddings.ts:20-28`) similarity scan, threshold 0.92 (`chat-cache.ts:223`) | One extra Bedrock `InvokeModel` per cache miss when on (`.env.example:43-53`). Exact-match tier constants: TTL 24 h (`chat-cache.ts:63`), index cap 500 (`:66`), answers over 4,000 chars are never cached (`:79`) |
| `GITHUB_TOKEN` | No | `src/lib/github.ts:96`; `src/app/api/github/stats/route.ts:19` | Raises the GitHub API rate limit for the `/projects` + `/stats` feeds | **Not documented in `.env.example` at all.** Server-only — `src/lib/github.ts:9` notes it must never reach the client (no `server-only` package; the single server-component import site is the guarantee) |
| `FLAG_DRIVER` | No (default `local`) | `src/lib/flags.ts:13` | `"vercel"` → runtime Flags SDK; anything else → build-time env read | Evaluated **once at process start**; changing it without a restart has no effect (`src/lib/flags.ts:12`) |
| `FLAGS_SECRET` | Required iff `FLAG_DRIVER=vercel` | `src/lib/flags.ts:51` (presence only, logged) | Signs Flags SDK override cookies | Presence-checked, never used directly outside the log line (`.env.example:223-225`) |
| `FLAGS` | No | `src/instrumentation.ts:49` (presence only) | The **Vercel Flags SDK's own** connection string (not a project concept) | Undocumented in `.env.example`; only surfaced as `flags_sdk_configured` in the `[config]` cold-start log |
| `EXTENDED_THINKING` | No (default on) | `src/app/api/chat/route.ts:385` | Server-side toggle; `"false"` disables extended thinking | Undocumented in `.env.example`. Distinct from the client-side `NEXT_PUBLIC_EXTENDED_THINKING` |
| `NEXT_PUBLIC_BUILD_YEAR` | Set by build | written `next.config.ts:127`; read `src/components/site-footer.tsx:239` (`?? "2026"`) | Stable footer copyright year | Exists because under `cacheComponents`, `new Date()` during render fails the prerender and cannot be deferred with `instant = false` (`next.config.ts:121-126`) |
| `NEXT_PUBLIC_DISCOVERY_BADGES` | No (default off) | `src/lib/flags.ts:58,65` | ★ N/4 discovery badge | The only flag routed through the two-driver resolver |
| `NEXT_PUBLIC_ARTICLES_ENABLED` | No (**default TRUE**) | `src/lib/writing-flags.ts:20` | `/articles` route + nav + sitemap + RSS | Inverted polarity: `!== "false"` |
| `NEXT_PUBLIC_NOTES_ENABLED` | No (default false) | `src/lib/writing-flags.ts:22`; data-layer gate `src/lib/content.ts:56` (`allNotes = NOTES_ENABLED ? publishedNotes : []`, import at `:15`) | `/notes` section | `=== "true"` opt-in. **Hidden at the data layer, not only in the UI:** with the flag off, `allNotes` is empty for every consumer — llms.txt, the feed, MCP, the chat corpus and the `.md` handlers — so nothing can publish a note the `/notes` pages would 404. Only the `/notes` route files read `publishedNotes` (`content.ts:50`), because `cacheComponents` needs `generateStaticParams` to return at least one entry even while the section is dark |
| `NEXT_PUBLIC_OPEN_TO_WORK` | No (default false) | `src/lib/writing-flags.ts:24` | "Open to work" banner | — |
| `NEXT_PUBLIC_STATS_ENABLED` | No | `src/lib/writing-flags.ts:38` | `/stats` in nav | — |
| `NEXT_PUBLIC_SEARCH_ENABLED` | No | `src/lib/writing-flags.ts:40` | `/search` in nav | Needs the Pagefind index, which `pnpm build` now generates |
| `NEXT_PUBLIC_TESTIMONIALS_ENABLED` | No | `src/lib/writing-flags.ts:45` | Recommendations section | — |
| `NEXT_PUBLIC_INKFORGE_ARTICLES_ENABLED` | No | `src/lib/writing-flags.ts:50` | Inkforge-pipeline articles | Undocumented in `.env.example` |
| `NEXT_PUBLIC_GITHUB_STATS_ENABLED` | No | `src/lib/writing-flags.ts:55` | Homepage GitHub stats strip | — |
| `NEXT_PUBLIC_ARTICLE_DEDUP_KEY` | No (default `linkedNote`) | `src/lib/writing-flags.ts:78` | Cross-platform article dedup key; alt value `canonicalUrl` | `.env.example:209-214` |
| `NEXT_PUBLIC_CHROME_TTS_BANNER` | No | `src/lib/writing-flags.ts:93` | Chrome TTS bug warning in talk mode | Default off — Chrome fixed the `paused_` guard bug (`.env.example:207`) |
| `NEXT_PUBLIC_ENABLED_VIEWS` | No (unset = all) | `src/lib/enabled-views.ts:23` | CSV of views beyond Classic | **Empty string ≠ unset**: `""` means Classic-only, unset means all (`.env.example:82-89`) |
| `NEXT_PUBLIC_ANVIL_ORB_MODE` | No (default `inplace`) | `src/components/chat/header-orb-trigger.tsx:36` | `inplace` \| `modal` \| `off` | — |
| `NEXT_PUBLIC_ENABLE_ANVIL_ORB` | No (legacy) | `src/components/chat/header-orb-trigger.tsx:38` | `"false"` maps to `off` | Legacy alias retained for back-compat (`.env.example:79-80`) |
| `NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE` | No (default `classic`) | `src/components/chat/header-orb-trigger.tsx:46` | `classic` \| `core` panel chrome | Orthogonal to `ORB_MODE` |
| `NEXT_PUBLIC_VOICE_PICKER_MODE` | No (default `descriptor`) | `src/lib/voice-picker-mode.ts:20` | `descriptor` \| `gender` picker shape | — |
| `NEXT_PUBLIC_LLM_SDK` | No (default `anthropic-bedrock`) | `src/lib/llm-sdk-mode.ts:26`; logged `src/instrumentation.ts:75-79` | Resolves to the literal `anthropic-bedrock` or `aws-sdk-bedrock`, else `DEFAULT_MODE` (`src/lib/llm-sdk-mode.ts:24,28-29`), exposed as `getLlmSdkMode()` / `LLM_SDK_MODE` (`:34-40`) | **Currently INERT** — declared and unit-tested, zero runtime consumers. `grep -rn llm-sdk-mode src/` returns only `src/lib/llm-sdk-mode.test.ts:2`; `src/app/api/chat/route.ts:1-16` does not import it, and `src/instrumentation.ts:75-79` snapshots the raw env value directly rather than via this module. There is **no `console.warn` anywhere** in `src/lib/llm-sdk-mode.ts:22-40` — the "falls through with a warning log" claim exists only in prose (`src/lib/llm-sdk-mode.ts:13-15`, `.env.example:154-159`; the variable itself is `.env.example:161`) |
| `NEXT_PUBLIC_ORB_POSTPROCESSING` | No (default off) | `src/components/chat/voice-orb-3d.tsx:300` | Bloom + Vignette + Noise + CA + Fluid on the 3D orb | Gated to high-tier devices (≥4 GB RAM, ≥4 cores) per `.env.example:167-168` |
| `NEXT_PUBLIC_INK_TRANSITION` | No (default off) | `src/components/view-context.tsx:125` | Opt-in WebGL2 ink-bleed on view switch; the default is the plain View Transitions crossfade (`src/components/view-context.tsx:120-124`) | `prefers-reduced-motion` short-circuits before either path and swaps the view instantly (`src/components/view-context.tsx:106-117`) |
| `NEXT_PUBLIC_SKILL_TREE` | No (default off) | `src/components/game/game-view.tsx:57` | SVG RPG skill tree in the Play view | — |
| `NEXT_PUBLIC_404_ORB` | No (default off) | `src/app/not-found.tsx:34` | Distressed orb on the 404 page | — |
| `NEXT_PUBLIC_VISITOR_COUNTER` | No (default off) | `src/components/site-footer.tsx:118` | Footer visitor-count badge | Requires both Upstash vars (`.env.example:177-178`) |
| `NEXT_PUBLIC_VOICE_TEST_AUDIO` | No (default off) | `src/components/chat/talk-mode.tsx:493` | "🔊 Test audio" button (dev/QA only) | — |
| `NEXT_PUBLIC_RESUME_VARIANTS` | No (default off) | `src/app/resume/page.tsx:29`; `src/components/home/resume-view.tsx:46`; `src/components/command-palette-content.tsx:365`; `src/components/game/terminal/commands.ts:297` | Show every `resumeVariants` entry vs only `resumeVariants[0]` | **Undocumented in `.env.example`** despite 4 call sites. Currently a **no-op in effect**: `resumeVariants` has a single entry (`src/lib/profile.ts:136-142`), so "all" and "first" are the same list |
| `NEXT_PUBLIC_HERO_MODE` | No | `src/components/home/hero.tsx:25`; `src/components/hero-avatar/index.tsx:50` | Selects hero treatment (`"avatar"` puts the 1.05 MB GLB on the hero path) | Undocumented in `.env.example`; referenced by `src/lib/avatar-glb.test.ts:18-20` |
| `NEXT_PUBLIC_AVATAR_POSITION` | No (default `hero-side`) | `src/components/hero-avatar/index.tsx:51` | Avatar placement | Undocumented in `.env.example` |
| `NEXT_PUBLIC_GRAPH_PHYSICS` | No (default off) | `src/components/hero-graph/index.tsx:10` | `"true"` swaps the lazy hero-graph chunk from `./scene` to `./scene-physics`'s `HeroGraphScenePhysics` (`src/components/hero-graph/index.tsx:18-23`) | **Not Rapier physics — and there is no longer a Rapier dependency at all.** `scene-physics.tsx` wraps `HeroGraphInner` in a `<group>` and *sets* `position.x/y/z` from `Math.sin`/`Math.cos(clock.elapsedTime)` each `useFrame` (`src/components/hero-graph/scene-physics.tsx:37-45`); its own header says "No RigidBody / Rapier needed for this effect" (`:10-16`). `@react-three/rapier` was declared but imported nowhere; **removed from `package.json` in v3.5.0** (`CHANGELOG.md:373-377`) — measured impact 3 packages removed, 0 added, and `@dimforge/rapier3d-compat` 0.19.2 → 0.12.0, correct because `@types/three` was its only remaining consumer. Neither package appears in the current dependency set; both are documented as deleted in [13 § Removed in v3.5.0](./13-dependencies-and-versions.md#removed-in-v350) — a count-free anchor, deliberately, because the earlier link embedded the prod-dependency count and died the moment that count moved. The call-site comment (`src/components/hero-graph/index.tsx:13-17`) is now accurate: it says "a drift variant is loaded instead of the static scene", "despite the flag name, there is no physics engine involved", and that `@react-three/rapier` "was declared in package.json but imported nowhere, and was removed in v3.5.0". Only the flag name and the filename remain historical (the stale comment was corrected in v3.5.0, `CHANGELOG.md:336-338`). Undocumented in `.env.example` (listed in `ARCHITECTURE.md:99`) |
| `NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS` | No (default off) | `src/components/chat/chat-view.tsx:255` | Image/file attachments in chat | Undocumented in `.env.example` |
| `NEXT_PUBLIC_PDF_ATTACHMENTS` | No (default off) | `src/components/chat/file-picker-button.tsx:7` | PDF attachments (client-side `pdfjs-dist` parse) | Undocumented in `.env.example`. This is the code path the v3.4.2 `pdfjs-dist` advisory was reachable through (`CHANGELOG.md:388-390`), and the only thing on the site that starts a Web Worker — so it is what `worker-src 'self'` actually covers |
| `NEXT_PUBLIC_EXTENDED_THINKING` | No (default on) | `src/components/chat/chat-messages.tsx:165` | Client-side thinking-block rendering (`!== "false"`) | Undocumented in `.env.example` |
| `VERCEL` | Platform | `next.config.ts:84` | Set only by Vercel's own infrastructure (Preview and Production); gates `upgrade-insecure-requests` in the CSP | Never set by `next dev` or `next start`, even in production mode — this is what keeps local WebKit/Playwright `mobile-safari` runs working (see the CSP table) |
| `VERCEL_URL` | Platform | `src/app/api/chat/route.ts:80-81`; `cron/{eval:106-107, github-sync:32-33, seo-audit:20-21}`; `src/lib/health-expectations.ts:56` | Self-referential base URL | Set by Vercel; absent locally. **`cron/health-check` never reads it directly** — it resolves its base through `probeBase()` (`src/app/api/cron/health-check/route.ts:155`), where `VERCEL_URL` is only the *fallback* (`src/lib/health-expectations.ts:56`). `VERCEL_URL` is the per-deployment host, which is SSO-protected on this project; `src/lib/health-expectations.test.ts:140-145` asserts the route never reads `process.env.VERCEL_URL` directly |
| `VERCEL_PROJECT_PRODUCTION_URL` | Platform | `src/lib/health-expectations.ts:52` (via `probeBase()`, `:51`) | Preferred probe base for the health-check cron — the production alias as a bare hostname | Preferred over `VERCEL_URL` because the deployment host 302s to Vercel SSO; `probe()` sets `redirect: "manual"` and fails any 3xx, naming Vercel SSO when it sees one. Falls back to `VERCEL_URL`, then `http://localhost:3000` (`src/lib/health-expectations.ts:56-58`) |
| `VERCEL_ENV` | Platform | `src/instrumentation.ts:41,91` | Environment tier; gates the production-only corpus timestamp write | Preview deploys also run `NODE_ENV=production`, so `VERCEL_ENV === "production"` is the only safe discriminator (`src/instrumentation.ts:87-92`) |
| `VERCEL_REGION` | Platform | `src/instrumentation.ts:43` | Region label in the `[config]` log | Falls back to `AWS_REGION`, then `"unknown"` |
| `VERCEL_GIT_COMMIT_SHA` | Platform | `src/app/api/cron/health-check/route.ts:195` | `release_id` in the health-check payload (typed `release_id: string \| null` at `:44`) | Cite the `process.env` read itself, not an offset — it moved from `:192` to `:197` to `:195` as the route changed |
| `NEXT_RUNTIME` | Platform | `src/instrumentation.ts:35` | `"edge"` → `register()` returns early (Edge has no access to the secrets) | — |
| `NODE_ENV` | Platform/tooling | `src/instrumentation.ts:42,92`; `src/lib/rate-limit.ts:62` | Env tier | Forced to `"test"` for the vitest worker (`vitest.config.ts:26`) |
| `CI` | Platform | `playwright.config.ts:6,7,8,40` | `forbidOnly`, `retries: 2`, `workers: 1`, `reuseExistingServer: false` | — |
| `ANALYZE` | Tooling | `next.config.ts:6` | `"true"` enables `@next/bundle-analyzer` | **No workflow sets this.** Its only setter is the local `analyze` script (`package.json:12`) — `bundle-analysis.yml`, which used to set it in CI, is deleted. **`ANALYZE=true` alone does nothing:** the analyzer is webpack-only, so the same command must also pass `--webpack` or the build is Turbopack and no report is written |
| `VELITE_STARTED` | Internal | `next.config.ts:13-14` | Re-entrancy guard so the dev Velite watcher starts exactly once | Written by the config itself, never by a user |

Two CI-only names are not process environment reads in `src/`: the repository **variable** `SEAL_CLAIMS_AUTO_COMMIT`
(the job-level `if:` of the claims auto-commit job, `:98`) and the repository **secret** `SECURITY_ALERTS_TOKEN`
(read by the `security-alerts` job, `ci.yml:285-286`).

## CI pipelines

Every third-party action in every workflow is **pinned by full commit SHA with a version comment** (checkout
`11d5960a…` `# v4`, `pnpm/action-setup` `ea17c68d…` `# v6.1.0`, `setup-node` `82076278…` `# v7.0.0`, `actions/cache`
`55cc8345…` `# v6.1.0`, `upload-artifact` `ea165f8d…` `# v4`, `codeql-action` `b96794f0…` `# v4.38.0`,
`dependency-review-action` `2031cfc0…` `# v4`, `gitleaks-action` `e0c47f4f…` `# v3.0.0`, `scorecard-action`
`2d114668…` `# v2.4.4`); the only `uses:` line without a SHA is a commented-out example in `codeql.yml:83`. The
`github-actions` Dependabot ecosystem is what moves those pins (`dependabot.yml:103-116`). No workflow declares a
`concurrency:` group.

| Workflow | Triggers | Jobs / steps | What it blocks |
|---|---|---|---|
| `ci.yml` — **CI** | `push` on `branches: ["**"]` (every branch); `pull_request` → `develop`, `main` (`ci.yml:3-7`). No `concurrency` group, so a PR branch runs CI twice (push + PR) | **`ci`** (`ubuntu-latest`, 15 min, `permissions: contents: read`, `:10-84`): checkout → `pnpm/action-setup` version 10 → `setup-node` Node 22 (`cache: pnpm`) → restore `~/.local/share/pnpm/store` keyed on `hashFiles('**/pnpm-lock.yaml')` → **bare `pnpm install`** (not `--frozen-lockfile`, `:41`) → **`pnpm audit --audit-level high`** (`continue-on-error: true`, report-only, `:48-50`) → **`pnpm content`** (`:54-55`) → `pnpm lint` (`:57-58`) → `npx tsc --noEmit` (`:60-61`) → `pnpm test` (`ci.yml:63-64`) → **`node scripts/check-index-citations.mjs`** (`:76-77`) → **`npx tsx scripts/seal-claims.ts`** (`:83-84`, verifies `data/integrity-chain.json`) | Fails the PR check. This is the **only** place `lint`, `tsc --noEmit`, the index-citation check and the claims-integrity verify run — none of the four is in `pnpm build`. Whether it is a *required* check is a repo setting not visible from source (`develop` was reported unprotected at the time `bundle-analysis.yml` was deleted) |
| | | **`claims-integrity-autocommit`** (5 min, `permissions: contents: write`, `:86-135`): `needs: ci` (`:97`) and `if: vars.SEAL_CLAIMS_AUTO_COMMIT == 'true'` (`:98`) → pnpm 10 / Node 22 / `pnpm install` → `npx tsx scripts/seal-claims.ts --write` (`:119-120`) → if `data/integrity-chain.json` changed, commit as `github-actions[bot]` with `[skip ci]` and `git push` (`:125-135`) | **Off by default** — skipped unless a maintainer sets the repo variable. `[skip ci]` is what prevents a push → CI → commit → CI loop (`:122-124`). `git push` has no explicit refspec, so it pushes the checked-out ref of whichever event triggered the run (behaviour on a `pull_request` event's detached merge ref was not exercised); it is the only write-scoped job in `ci.yml` |
| | | **`e2e`** (20 min, `contents: read`, `:137-202`): checkout → pnpm 10 / Node 22 → `pnpm install` → `pnpm exec playwright install --with-deps chromium webkit` (`:172-173`) → `pnpm build` (`:176-177`) → **`node scripts/bundle-budget.mjs`** (`:190-191`) → `pnpm e2e` (`:193-194`) → on failure upload `playwright-report/` (7-day retention, `:196-202`). The comment (`:143-146`) records that `pnpm e2e` was previously referenced by **no** workflow, so the suite rotted until 5 of 19 tests failed on selectors that could never match | Same. Notes: `pnpm build` here re-runs vitest, so the test suite executes twice per CI run; the bundle-budget gate deliberately **rides on that same build** rather than adding a second one, which is why it lives in `e2e` and not `ci`; and **webkit is installed on purpose** — `playwright.config.ts` has two projects (`chromium`, `mobile-safari` on `devices["iPhone 13"]`, `:15-24`) and a chromium-only install passed silently while every mobile-safari spec failed at browser launch (`ci.yml:166-171`) |
| | | **`install-pnpm-11`** (10 min, `contents: read`, `:204-253`): checkout → `pnpm/action-setup` **version 11** (`ci.yml:230`) → Node 22, **no store cache** (a cold resolve is the point) → `pnpm install --frozen-lockfile` (`:238-239`) → `git diff --exit-code` after the install (`:244-250`) → `npx vitest run src/lib/pnpm-build-allowlist-consistency.test.ts` (`:252-253`) | Same. The only job that runs a pnpm other than the pinned 10 — see [10 § install-pnpm-11](./10-tests-and-quality-gates.md) for the defect that motivated it and the pnpm settings section below for the `allowBuilds` mechanics |
| | | **`security-alerts`** (5 min, job-level `continue-on-error: true` at `:279`, `permissions: contents: read`): one step reading the Dependabot alerts API with `secrets.SECURITY_ALERTS_TOKEN`, writing a severity table + affected-package list to `$GITHUB_STEP_SUMMARY` (`:284-331`) | **Nothing — non-blocking by design.** Without the secret it prints setup instructions and `exit 0`. Documented token limitation: the default `GITHUB_TOKEN` **cannot** read that endpoint even with `security-events: read` — the restriction is on the token *type*, and a fine-grained PAT with `Dependabot alerts: Read-only` is required (`ci.yml:266-270`). Promotion criterion (`:277-278`): drop `continue-on-error` and exit 1 on high/critical once a token is wired **and** the existing backlog is at zero |
| `codeql.yml` — **CodeQL Advanced** | `push` → `develop`, `main`; `pull_request` → `develop`, `main`; `schedule: '35 1 * * 1'` (weekly, Mondays 01:35 UTC) (`codeql.yml:33-39`). **`main` was added deliberately** — it looks redundant because everything reaches production via `develop` → `main`, but a hotfix pushed straight to `main`, or a PR opened from a feature branch directly into `main`, previously deployed with no analysis until the weekly cron (up to 7 days). Cost of listing it: one duplicate scan per release (`:14-26`) | `analyze` matrix, one entry: `language: javascript-typescript`, `build-mode: none` (`:62-66`). `permissions: security-events: write, packages: read, actions: read, contents: read` (`:50-59`). `github/codeql-action/init` → conditional manual-build step (inert, `build-mode != manual`) → `analyze` with `category: "/language:javascript-typescript"`. No `timeout-minutes` | Code-scanning alerts on `develop` **and `main`**. `fail-fast: false` |
| `dependency-review.yml` — **Dependency Review** | `pull_request` → `develop`, `main` | `dependency-review` (5 min): checkout → `actions/dependency-review-action` with `fail-on-severity: high`, `fail-on-scopes: runtime`, `comment-summary-in-pr: always` (`:26-31`). Workflow-level `permissions: contents: read, pull-requests: write` (`:7-9`) | PRs introducing **high/critical** CVEs in **runtime**-scoped deps. Low/moderate are warnings; dev-only packages (vitest, eslint) are exempt by scope (`:27-29`). It only sees a PR's diff — the non-blocking `pnpm audit` step in `ci` is what covers packages already in the tree |
| `gitleaks.yml` — **Gitleaks** | `push` and `pull_request` on `develop`, `main` (`gitleaks.yml:14-18`) | `scan` (5 min, `contents: read` + `pull-requests: write`): checkout with `fetch-depth: 0` (`:37`) → `gitleaks/gitleaks-action` v3.0.0 (`:40`). No `GITLEAKS_LICENSE` — free for personal-account repos | Runs unconditionally on every PR regardless of CodeRabbit's free-tier star gate (`:3-13`). Complements GitHub's native secret scanning + push protection and CodeRabbit's own gitleaks tool |
| `scorecard.yml` — **OSSF Scorecard** | `push` → `main` only, weekly cron `30 2 * * 1`, `workflow_dispatch` (`scorecard.yml:12-17`). **Main only on purpose:** `ossf/scorecard-action` hard-rejects any non-default branch, so listing `develop` just guarantees a red X on every push (`:3-11`) | `analyze` (10 min): workflow-level `permissions: read-all` (`:19`); job-level `security-events: write`, `id-token: write`, `contents: read`, `actions: read` (`:26-32`) → scorecard-action v2.4.4 with `publish_results: true` (`:47`) → SARIF as an artifact (7 days) → `codeql-action/upload-sarif` | Nothing on `develop` — no Scorecard signal there. Supply-chain health signal only |

**Job display names** (what a branch-protection rule would name): `Lint · Type-check · Test`, `Claims integrity
auto-commit (opt-in)`, `E2E (Playwright)`, `Install on pnpm 11`, `Security alerts (report)`, `Analyze
(javascript-typescript)`, `Dependency review`, `Secret scan`, `Scorecard analysis`. The `codeql.yml` and `scorecard.yml` jobs both use the job
id `analyze`; they are in different workflows, so it is harmless, but the status-check names differ by workflow. A push to a feature branch gets `ci`, `e2e`, `install-pnpm-11` and `security-alerts`, but no
CodeQL, gitleaks or dependency-review until a PR targets `develop`/`main`.

**Cross-cutting CI invariant:** `ci.yml:54-55` runs `pnpm content` before anything that compiles, with the
comment "`.velite/` is gitignored — must be generated before tsc or vitest runs. Mirrors the production build
order" (the comment omits `pagefind` from the chain it quotes). Deleting that step breaks every downstream step at
module resolution. This used to be a *cross-cutting* invariant spelled in two workflows — `bundle-analysis.yml`
carried the same step — and the second copy went with that file, so the `ci` job is now the only place it appears.
(The `e2e` and `install-pnpm-11` jobs do not need it: `e2e` gets `.velite/` from `pnpm build`, whose first link is
`velite --clean`, and `install-pnpm-11` only runs the allowlist test, which does not import `.velite`.)

**The "Bundle budget" step (`ci.yml:190-191`) — what replaced `bundle-analysis.yml`.** It runs
`node scripts/bundle-budget.mjs` inside the **existing** `e2e` job, immediately after that job's `Build` step,
so it consumes the build that already happens rather than paying for a second one. Its comment
(`ci.yml:179-189`) records the two settings it deliberately does **not** carry — `continue-on-error` and
`if-no-files-found` — because those are precisely what made its predecessor unable to fail on a missing
measurement. The design rule is one sentence: *unmeasurable must mean red.* Full mechanics in the
`scripts/bundle-budget.mjs` entry under **§ Detail** below (deliberately a plain pointer, not an anchor link — see
UNVERIFIED on fragile fragments).

**`bundle-analysis.yml` is DELETED — and the reason is a case study in a gate that cannot fail.** It ran
**222 times, 211 green, 11 red, and produced ZERO artifacts** — verified across the 25 most recent runs, every
one reporting `total_count: 0` from the artifacts API (older runs cannot be distinguished from expired ones —
see UNVERIFIED). Be precise about the failure mode: its install/build failures *did* go red (9 of the 11); what it
could never do was fail on a bundle **size**, because it had no threshold, and a **missing** measurement passed
silently (`ci.yml:184-189`, `scripts/bundle-budget.mjs:5-21`). Three independent causes, each on its own
sufficient:

1. **The build it ran produced nothing to upload.** `ANALYZE=true npx next build` is a **Turbopack** build in
   Next 16, and `@next/bundle-analyzer` is webpack-only — see the two-bundler note in the npm-scripts section
   above for the mechanism and the `node_modules` citations. No `--webpack`, no report.
2. **The `compare` step could never have worked even so.** `nextjs-bundle-analysis` is stuck at `0.5.0`, last
   published 2023-04-13 (`npm view nextjs-bundle-analysis time.modified`), and reads the **Pages-Router**
   `build-manifest.json.pages`, which in this App Router app is `{"/_app": []}`.
   Fully wired it emits `{"raw":0,"gzip":0}` — i.e. it would have posted *"This PR introduced no changes to the
   JavaScript bundle"* on every PR forever. That is worse than silence, because silence does not manufacture
   confidence. Two further nails: the workflow never ran the `report` step that writes `__bundle_analysis.json`,
   and `package.json` has no `nextBundleAnalysis` config block, both of which the compare step requires.
3. **Every measurement failure was suppressed.** `if-no-files-found: warn` on the upload plus `continue-on-error: true` on
   both PR-comparison steps meant a missing measurement could never turn a check red.

**`develop` is not branch-protected** (`gh api repos/:owner/:repo/branches/develop` → `"protected": false`, read
when the workflow was deleted; not re-read for this edition), **so no required check broke when it went.** The run
counts above are a live counter read from the Actions API at deletion time, not a stable fact — treat them the way
this page treats the agent-tooling byte sizes, and re-read rather than re-quote.

**Correction carried forward:** the deleted workflow's own comment asserted that "`next build` uses webpack by
default in Next 16 (Turbopack is opt-in, dev-only)". That was **false**, and because this index sourced the
claim to that comment, the error propagated into the index. The three.js single-chunk / 876 KB numbers in
`next.config.ts:147-169` are genuine **Turbopack** measurements — `next.config.ts:149` says "in Turbopack"
outright, and the chunk was re-confirmed at 897,249 B while wiring the new gate. So that invariant and
`src/lib/r3f.ts`'s load-bearing role both **stand**; only the bundler attribution was ever wrong.

**The "Codebase index citations" step (`ci.yml:76-77`)** runs
`node scripts/check-index-citations.mjs`, which re-fingerprints every machine-resolvable `path:line` citation in
`docs/index/` against `docs/index/.citations.json`, names the file, the recorded line, the current line, and which
index page cites it, and exits non-zero on a **blocking** finding. Blocking is deliberately narrower than "any drift":
the script asks where the recorded text lives *now* — nowhere (or duplicated with no matching line shift) is an
error, exactly one other position is only a relocation warning, and `--strict` restores all-or-nothing. Properties
recorded in the 10-line comment above it (`ci.yml:66-75`):

- **It is a CI step and NOT part of `pnpm build`.** It was briefly wired into a vitest test, which put it inside
  `vitest run` — which `pnpm build` chains — so a stale index would have failed the **Vercel production build**.
  The stated rule: "Documentation freshness must gate a merge, never a deploy: otherwise a stale doc blocks
  shipping a hotfix." This is the one gate in the repo that intentionally sits *outside* the build chain, and
  it is the mirror image of the `vitest run`-inside-`build` decision two sections up.
- **Re-fingerprint with `node scripts/check-index-citations.mjs --write`** after reviewing drift (`ci.yml:75`;
  `--write` refuses while any blocking finding is open, and a verified re-point of warnings needs
  `--accept-warnings`). Because `--write` accepts whatever the source now says, a green run proves the fingerprints
  match the tree — not that the surrounding prose is still true. The script also reports its own coverage limit:
  citable paths are fully-qualified ones under `src/ e2e/ scripts/ content/ domains/ signals/ docs/ .github/` **plus an
  explicit allowlist of root files** (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `CHANGELOG.md`,
  `CLAUDE.md`, `ARCHITECTURE.md`, `DEPLOY.md`, `README.md`, `VOICE.md`, `TELEMETRY.md`, `SECURITY.md`, `Makefile`,
  `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `velite.config.ts`, `eslint.config.mjs`,
  `postcss.config.mjs`, `tsconfig.json`, `vercel.json`, `.env.example`, `.gitignore`, `.nvmrc` —
  `scripts/check-index-citations.mjs:63-88`). Root-level citations in this file are therefore checked; what stays
  unchecked is anything under `node_modules/`, `.coderabbit.yaml`, `.claude/`, and context-relative `(:NN)` forms.

**Dependabot** (`.github/dependabot.yml`): weekly updates, Mondays 09:00 `America/Chicago`,
`target-branch: develop`, reviewer `sairam0424`, two ecosystems. The **`npm`** ecosystem has six groups, ordered
most-specific-first because matching is first-match-wins (`:14-16`): `next-react-core` (`next`, `react`, `react-dom`,
`@next/*`), `aws-bedrock` (`@aws-sdk/*`, `@anthropic-ai/*`), `three-webgl` (`three`, `@react-three/*`,
`@types/three`, `postprocessing`), `testing` (`vitest`, `@vitest/*`, `@testing-library/*`, `happy-dom`),
`dev-tooling` (`eslint`, `eslint-*`, `typescript`, `tailwindcss`, `@tailwindcss/*`, `velite`, `postcss*`, `@types/*`),
and `security-patches` (`applies-to: security-updates`, pattern `*`) (`:17-71`). The **`github-actions`** ecosystem
(`:103-116`, same schedule, target and reviewer) exists because every action is SHA-pinned and a pinned SHA never
moves on its own — Dependabot bumps both the SHA and its version comment.

Three `ignore` entries on the npm ecosystem, each with a recorded root cause:
- `@react-three/postprocessing` **exactly `["3.0.5"]`** — a types-only regression: `ChromaticAberration` props are
  `Omit<Partial<ConstructorParameters<typeof ChromaticAberrationEffect>[0]>, 'offset'>`, but that constructor
  param is optional, so `ConstructorParameters[0]` includes `| undefined`; `keyof` of a union is the
  intersection, `keyof undefined` is `never`, and `Omit` collapses the prop set to `{}`. Runtime is unaffected —
  only `tsc` catches it. Scoped to the single broken version so 3.0.6+ still flows through (`:72-84`). **Now
  effectively dead config:** the comment still says "Pinned to 3.0.4 in package.json" (`:80`), but `package.json:34`
  pins `3.1.1`, which is above the ignored version.
- `typescript` `semver-major` — TS 7.0.2 crashes `@typescript-eslint/typescript-estree@8.61.0` on load with
  `TypeError: Cannot read properties of undefined (reading 'Cjs')`. Notably `tsc --noEmit` under TS 7.0.2 is
  clean, so **the source is already TS7-ready; only linting fails** (`:85-94`).
- `eslint` `semver-major` — ESLint 10 blocked upstream: `eslint-plugin-react` calls removed APIs
  (`sourceCode.getJSDocComment`, no replacement), and `eslint-config-next`'s vendored Babel 7
  `@babel/eslint-parser` lacks `ScopeManager#addGlobals`. Re-check trigger: `jsx-eslint/eslint-plugin-react#4022`
  (`:95-101`).

**Gotcha:** `CHANGELOG.md:428-429` records that Dependabot reads `dependabot.yml` from the **default branch
only**, so these ignores were inert while they lived on `develop`.

**CodeRabbit** (`.coderabbit.yaml`): `quiet` profile, auto-review only when the PR base is `^develop$`
(`:8-10`), drafts skipped, `dependabot[bot]` ignored, auto-pause after 5 reviewed commits (`:11-14`), path filters
excluding `dist/ build/ .next/ *.lock` and generated files (`:15-20`), eslint + gitleaks tools on (`:24-28`).
Consequence: `develop` → `main` release PRs get **no** auto-review. The config also lives only on branches that carry
it — `gitleaks.yml`'s header records it "currently lives only on develop" (`gitleaks.yml:6-8`).

## pnpm settings (all in `pnpm-workspace.yaml`)

**`package.json` has no `pnpm` field at all.** Every setting group lives in `pnpm-workspace.yaml`, the single source
of truth: two groups moved there in v3.5.0, one was already there, `allowBuilds` was added in v3.6.0 (see
`CHANGELOG.md:187-227`). The `patchedDependencies` entry, the exact `fast-uri` pin and the `browserslist` / `qs` overrides landed later and have
no CHANGELOG entry (`grep -n "browserslist\|patchedDependencies" CHANGELOG.md` finds nothing):

| Setting | Location | Reads it | Value |
|---|---|---|---|
| `overrides` | `pnpm-workspace.yaml:18-44` | pnpm 10 + 11 | the 12 security pins tabled below |
| `patchedDependencies` | `pnpm-workspace.yaml:49-54` | pnpm 10 + 11 | `'@react-three/fiber@9.7.0': patches/@react-three__fiber@9.7.0.patch` |
| `onlyBuiltDependencies` | `pnpm-workspace.yaml:70-71` | pnpm <=10.27 only (legacy) | `[esbuild]` — only esbuild may run install lifecycle scripts |
| `ignoredBuiltDependencies` | `pnpm-workspace.yaml:74-76` | pnpm <=10.27 only (legacy) | `[sharp, unrs-resolver]` — explicitly denied so pnpm stops prompting |
| `allowBuilds` | `pnpm-workspace.yaml:81-84` | pnpm >=10.28 and 11 (the live control) | `{esbuild: true, sharp: false, unrs-resolver: false}` — same allowlist, boolean form |

**The build-script allowlist is spelled twice on purpose, and the two must stay in sync — but only one of them is
live.** The header at `pnpm-workspace.yaml:57-69` records a measurement on a one-install-script fixture with
`allowBuilds` alone: pnpm 11.17.0 ok · 10.34.5 ok · 10.28.0 ok · **10.27.1 exit 1, binary not built**. CI's
`version: 10` resolves to the latest 10 (10.34.5), so the two legacy lists are dead config for CI and survive only for
pnpm <=10.27. pnpm 11 does not read them at all, and `pnpm config get onlyBuiltDependencies` **echoes any key present
in the file, including one that does not exist** — non-evidence, not confirmation.
Before `allowBuilds` existed, pnpm 11 seeded it into this tracked file itself with the placeholder string
`set this to true or false` — neither `true` nor `false`, so every package counted as denied and
`pnpm install --frozen-lockfile` exited 1 with `[ERR_PNPM_IGNORED_BUILDS]`. Measured: **exit 1 on pnpm
11.17.0 from a clean clone, exit 0 on pnpm 10.34.5.** CI never saw it. Every dependency declaring an install script
must appear in `allowBuilds` explicitly; `src/lib/pnpm-build-allowlist-consistency.test.ts` derives that set from the
resolved tree and runs both inside `pnpm build` (via `vitest run`) and in the `install-pnpm-11` job. See
`13-dependencies-and-versions.md`.

**Why it moved out of `package.json`, and why this counts as a security fix** (`pnpm-workspace.yaml:1-12`,
`CHANGELOG.md:360-370` — filed under `### Security`, not `### Changed`): **pnpm v11 no longer reads the `pnpm` field of
`package.json`**. It prints `The "pnpm" field in package.json is no longer read by pnpm` and skips it — a warning line
that reads like boilerplate. Nothing was broken yet, because `pnpm-lock.yaml` already encoded the resolved graph and CI
pins pnpm 10 (`ci.yml:24`) — but **one `pnpm install` on pnpm 11 would have regenerated the lockfile without the
`overrides:` block and silently reverted v3.4.2's entire security release.** Both pnpm 10 and 11 read
`pnpm-workspace.yaml`, so the new location works on either. The migration was verified in a stated order
(commit `ceae0d1`): `install --lockfile-only` under pnpm 11 → lockfile **byte-identical** to baseline (the proof
the overrides are now read on 11, where the same command would previously have dropped them); the same under
pnpm 10 → byte-identical again (the proof CI's resolution does not move); then `--frozen-lockfile` on both →
exit 0. The ten pins that existed at the time were re-confirmed **applied in the resolved graph, not merely declared**:
`hono` 4.13.2 · `@hono/node-server` 1.19.17 · `ip-address` 10.5.0 · `fast-uri` 3.1.5 · `js-yaml` 4.3.1 ·
`postcss` 8.5.23/8.5.26 · `sharp` 0.35.3 · `body-parser` 2.3.0 · `brace-expansion` 1.1.18 and 5.0.9
(`CHANGELOG.md:366-370`).

This is also what unblocked the v3.5.0 dependency removals: pruning `@react-three/rapier` and
`@react-three/offscreen` requires regenerating the lockfile, which was unsafe until the overrides lived somewhere
both pnpm majors read — `CHANGELOG.md:373-374` records the removal as "deferred until the overrides migration
made lockfile regeneration safe". Both landed in the same commit (`ceae0d1`), which also added `.nvmrc` and
`engines.node`. The third package the lockfile lost was `mitt`, a transitive of the two removed packages.

**There are now 12 overrides, not 10.** The original ten (from v3.4.2) are unchanged in range except `fast-uri`;
`pnpm-workspace.yaml:14-17` marks the whole block **SECURITY-LOAD-BEARING** and names the references for removing
one (`pnpm why <pkg>` plus the 3.4.2 CHANGELOG entry). The YAML carries those comments; `package.json` never could.
Its header at `:5` still says "the ten security `overrides` shipped in v3.4.2" — historically accurate, because it
is talking about that release. The lockfile mirrors all twelve ranges verbatim at `pnpm-lock.yaml:7-19`. The advisories
for the first ten are transcribed from `CHANGELOG.md:382-411` (release 3.4.2, "resolves all 23 open Dependabot
advisories across 10 packages, 11 of them high severity", `:325-326`); the last two are transcribed from the YAML
comments, because no CHANGELOG entry covers them.

| Override | Range pinned | Advisory / reason as stated in the source |
|---|---|---|
| `hono` | `^4.12.34` | 4.12.25 → 4.13.2 (medium ×3, low ×1): `memo()` retained SSR output across requests (cross-user data disclosure), ReDoS in CORS middleware, algorithmic-complexity DoS in Language middleware, Proxy Helper header leak (`CHANGELOG.md:394-396`) |
| `@hono/node-server` | `^1.19.15` | → 1.19.17 (medium): `serve-static` path traversal via `%5C` on Windows (`CHANGELOG.md:404`) |
| `ip-address` | `^10.3.1` | 10.2.0 → 10.5.0 (high): `Address4` decodes leading-zero octets as decimal while resolvers decode them as octal → SSRF / trust-boundary bypass. Reached via `mcp-handler` → `@modelcontextprotocol/sdk` → `express-rate-limit`; server-side only (`CHANGELOG.md:391-393`) |
| `fast-uri` | **exact** `3.1.6` (was `^3.1.5`) | 3.1.2 → 3.1.5 (high): host confusion via backslash authority introducer (`CHANGELOG.md:398`). Now an exact pin: pnpm 11's default `minimumReleaseAge` check rejected a lockfile entry resolved to a version published too recently (it caught 3.1.7, published <24 h before a CI run, on the `Install on pnpm 11` job), and a caret range would re-resolve to whatever is newest at install time and fail again (`pnpm-workspace.yaml:22-27`) |
| `js-yaml` | `^4.3.1` | 4.2.0 → 4.3.1 (high): quadratic CPU consumption in `!!omap` resolution (`CHANGELOG.md:397`) |
| `postcss` | `^8.5.23` | (medium/high): attacker-controlled `sourceMappingURL` read arbitrary `.map` files when `from` is unset (`CHANGELOG.md:405-406`) |
| `brace-expansion@1` | `^1.1.16` | (high) — the 1.x line, patched **within its line** |
| `brace-expansion@>=3` | `^5.0.7` | (high) — the 5.x line. Two version-scoped overrides instead of one blanket override: "A blanket override would have forced `minimatch@3` onto 5.x and broken the eslint chain" (`CHANGELOG.md:399-401`) |
| `sharp` | `^0.35.0` | 0.34.5 → 0.35.3 (high): "only velite's build-time instance was affected; Next 16.3.0 already carried the patched 0.35.3" (`CHANGELOG.md:402-403`) |
| `body-parser` | `^2.3.0` | 2.2.2 → 2.3.0 (low) (`CHANGELOG.md:407`) |
| `browserslist` | **exact** `4.28.8` | GHSA-covered crash/prototype-write + OOM (Dependabot #54/#55), transitive via `next` → `styled-jsx` and `eslint-config-next` → `@babel/core`. Exact for the same `minimumReleaseAge` reason as `fast-uri`: 4.28.8 (2026-08-08) has aged past the gate (`pnpm-workspace.yaml:34-38`) |
| `qs` | **exact** `6.16.0` | GHSA-covered DoS + array-limit bypass (Dependabot #53/#56), transitive via `body-parser` → `express` → `@modelcontextprotocol/sdk`. 6.16.0 (2026-08-29) is the only patched version so far — newer than the usual aged-pin margin, but with no older patched release to fall back to; if pnpm 11's release-age gate rejects it, "that's the CI signal to wait and retry, not a reason to skip the fix" (`pnpm-workspace.yaml:39-44`) |

Root cause for needing overrides at all: "Six were transitive and lockfile-pinned, so `pnpm update` could not
move them — `@modelcontextprotocol/sdk` is pinned exactly to `1.26.0`, which is why Dependabot reported
`security_update_not_possible`" (`CHANGELOG.md:409-411`). `package.json:29` does indeed pin
`"@modelcontextprotocol/sdk": "1.26.0"` with no range operator. `pdfjs-dist` was fixable by a direct bump
(`^6.2.108`, `package.json:48`) rather than an override. The exact pins (`fast-uri`, `browserslist`, `qs`) trade
that away: they stop floating, so a later patch release is missed until someone bumps them deliberately.

**The `@react-three/fiber` patch.** `patchedDependencies` (`pnpm-workspace.yaml:49-54`) keeps the fix separate from
`overrides` — a version pin selects *which* version resolves, a patch edits a specific resolved version's own files.
pmndrs/react-three-fiber#3754: `connect()` called `addEventListener` on a null/undefined target with no guard, unlike
`disconnect()`'s matching check, which crashed the hero graph's WebGL canvas on unmount/remount races. The patch
(`patches/@react-three__fiber@9.7.0.patch`, 42 lines) adds `if (!target) return;` at the top of `connect` in the three
`dist/events-*` bundles. The comment says to drop it when an upstream release fixes the bug. It is bound to exactly
`@react-three/fiber@9.7.0` — the lockfile entry (`pnpm-lock.yaml:21-24`) and the resolved snapshot both carry that
version and a `patch_hash` — while `package.json:33` declares the range `^9.7.0`, so a bump past 9.7.0 no longer
matches the patch key. What pnpm does then (drop silently, or fail the install) was not exercised here.

## Detail

### `next.config.ts`
- **Role:** The single Next.js configuration surface — security headers/CSP, experimental flags, image config,
  rewrites, a build-time env constant, and a dev-only Velite watcher side effect.
- **Exports:** `default` — `withBundleAnalyzer(nextConfig)` (`:252`).
- **Reads / depends on:** `@next/bundle-analyzer` via `createRequire(import.meta.url)` (`:4-7`, because the file
  is ESM), dynamic `import("velite")` (`:15`), env `ANALYZE` and `VERCEL`; writes env `NEXT_PUBLIC_BUILD_YEAR` and
  `VELITE_STARTED`. The analyzer wrapper and the `ANALYZE` read both **survive** the deletion of
  `bundle-analysis.yml` — the dependency is still a devDependency (`package.json:61`) and `:252` still wraps the
  config — but they are now reachable only from the local `pnpm analyze` script, and only because that script
  also passes `--webpack`. On every other build the wrapper is a pass-through.
- **Consumed by:** the Next.js CLI (`next dev`, `next build`). Not imported by any `src/` module.
- **Behaviour notes:**
  - **Dev-only Velite watcher** (`:12-16`): `isDev = process.argv.includes("dev")`; guarded by `VELITE_STARTED`
    so it fires once. Started with `{ watch: true, clean: false }` — the comment states that running Velite
    here during `build` "races webpack and can wipe `.velite` mid-compile", which is why the build script owns
    the `--clean` run. **The race is real; the bundler name in that comment is not** — `next build` is Turbopack
    (`node_modules/next/dist/lib/bundler.js:142-144`), so read "webpack" as "the bundler". Quoted verbatim here
    because it is still the source text at `next.config.ts:11`; the reasoning is unaffected.
  - **`turbopack: { root: __dirname }`** (`next.config.ts:119`) — pins the workspace root "(multiple lockfiles exist on the
    machine)".
  - **`experimental.inlineCss: true`** (`:132`) — inlines critical CSS to remove a render-blocking stylesheet
    request; the comment conditions keeping it on a before/after Lighthouse showing an FCP/LCP win without a
    TTFB regression.
  - **`experimental.viewTransition` was removed in the 16.3.0 upgrade** (`:133-145`): the key no longer exists in
    Next's `ExperimentalConfig` (leaving it was a hard typecheck failure) because view transitions now work in the
    App Router with no configuration. It was a no-op for this app regardless — the four-view transition is the native
    `document.startViewTransition` + `::view-transition-*` CSS path, not React's `<ViewTransition>`.
  - **`experimental.optimizePackageImports: ["lucide-react", "motion"]`** (`:170`) — `three`,
    `@react-three/fiber`, `@react-three/drei` are **deliberately excluded**: investigation C-3 (commit
    `6246ed9`) showed the flag does not collapse the R3F twin-chunk under Turbopack; the `src/lib/r3f.ts`
    barrel (commit `f7c5110`) is the live fix (`:146-151`). The wider comment block (`:153-169`) records the
    single-copy outcome — `WebGLRenderer` in exactly **one** chunk (37 occurrences, all in the one 876 KB chunk;
    2036 KB across 5 chunks on 16.2.9 → 1160 KB across 4 on 16.3.0, i.e. −876 KB / −43%) — and that outcome now has
    a **CI gate**: `scripts/bundle-budget.mjs:84` asserts it by marker, so re-adding an eager `three` import fails a
    check instead of quietly doubling the critical path. The block also says **not** to adopt
    `experimental.turbopackChunking` / `turbopackSharedRuntime` (doc-labelled "not recommended for production", the
    latter shipped a hydration-breaking race) — the win is already banked.
  - **`experimental.cacheComponents: true`** (`:203`) — supersedes `experimental.ppr` / `experimental_ppr` /
    `dynamicIO` / `useCache`. The comment records the migration as **26 segment configs across 22 files**
    (measured, not estimated — enabling the flag failed with exactly `26 errors`): 13× `runtime` deleted (nodejs
    is already the default and Cache Components requires it), 4× `revalidate` handled per data source
    (`/projects` → `"use cache"` + `cacheLife("hours")` = `{ stale: 300, revalidate: 3600, expire: 86400 }`,
    preserving the prior 3600 s exactly; `/work` + `/notes` deleted as pure build-time Velite data;
    `api/github/stats` already had fetch-level revalidate), 9× `force-dynamic` deleted. `maxDuration` (11 uses
    at the time) and `preferredRegion` are **not** rejected, so streaming timeouts survive (`:171-203`). Two
    constraints only a real build surfaces: `generateStaticParams` must return ≥1 result (the flag-gated `/notes`
    routes are now prerendered *as 404s*), and synchronous IO (`new Date()`, `Date.now()`) fails prerender and
    cannot be deferred with `instant = false` — hence `NEXT_PUBLIC_BUILD_YEAR` and `await connection()` +
    `instant = false` on `/admin/telemetry`.
  - **`headers()`** (`:213-239`): returns 3 entries — `/:path*` with `securityHeaders`, then `/resume` and
    `/resume/:path*` with `resumeHeaders`, which maps over the base list flipping `X-Frame-Options` to
    `SAMEORIGIN` and string-replacing `frame-ancestors 'none'` → `frame-ancestors 'self'` inside the CSP.
  - **`rewrites()`** (`:240-249`): `/work/:slug.md`, `/projects/:slug.md`, `/articles/:slug.md`,
    `/notes/:slug.md` → `/api/md/<collection>/:slug`, "so that AI crawlers can fetch raw markdown via canonical
    pretty-URLs".
  - **`images`** (`:205-212`): `formats: ["image/avif", "image/webp"]`; exactly one `remotePatterns` entry,
    `https://img.shields.io`. The comment records that github-readme-stats was removed because `/projects` is
    now a first-party server-fetched feed (`src/lib/github.ts`).
- **Gotchas / invariants:**
  - The `frame-ancestors` override is a **literal string replace** (`:224-227`). Editing `next.config.ts:41`
    (e.g. reordering the directive or changing its quoting) silently makes the `/resume` override a no-op, and
    the resume PDF iframe stops rendering.
  - The header-block comment at `:19-20` still says "shipped as Report-Only first … to be promoted to enforced";
    the header is **already enforced** (`:114` uses the `Content-Security-Policy` key). `:104-113` is the current,
    accurate note.
  - `NEXT_PUBLIC_BUILD_YEAR` is computed with `new Date().getFullYear()` **in the Node config at build time**
    (`:127`). Moving that computation into a component re-triggers the `cacheComponents` unstable-value
    prerender failure.
  - `upgrade-insecure-requests` is conditional on `process.env.VERCEL` (`:84`). Making it unconditional again
    breaks WebKit-based local runs (the Playwright `mobile-safari` project) because no TLS listener exists locally.
  - Removing `'unsafe-eval'` from `script-src` breaks every MDX-bodied page (see the CSP section).
  - COOP and CORP are `same-origin` on **all** routes (`:97-98`); anything that relies on cross-origin embedding of
    this origin's resources or a popup that needs `window.opener` would be affected (none is known).

### `package.json`
- **Role:** Package manifest, script surface, dependency set, and the Node-version pin. **No longer the
  security-override layer** — that is `pnpm-workspace.yaml`.
- **Reads / depends on:** n/a (declarative).
- **Behaviour notes:** `private: true` (`:4`) — never published. `engines.node` `">=22 <23"` (`:5-7`). 13 scripts
  (`:8-22`), 35 `dependencies` (`:23-59`) and 18 `devDependencies` (`:60-79`). Runtime pins worth knowing:
  `next 16.3.5` is **exact** (no caret, `:47`) and `eslint-config-next 16.3.4` is exact (`:70`); `react`/`react-dom`
  are exact `19.3.0` (`:50-51`); `@modelcontextprotocol/sdk` exact `1.26.0` (`:29`);
  `@react-three/postprocessing` exact `3.1.1` (`:34`). Other versions: `three ^0.186.0`, `vitest ^5.0.0`,
  `@playwright/test ^1.62.1`, `tailwindcss ^4`, `typescript ^5`, `velite ^0.4.0`, `pagefind ^1.5.2`. `zod` is `^3.25.76`
  — v3, not v4 (`:58`). `web-vitals` `^6.1.1` is a **dev**Dependency (`:78`), not a prod one, and so is
  `@next/bundle-analyzer` `^16.3.5` (`:61`) — which **stays** even though no workflow uses it any more, because
  the local `analyze` script (`:12`) still does. `tsx ^4.23.13` (`:74`) is also a devDependency: it runs
  `scripts/seal-claims.ts` in CI and locally.
- **Gotchas / invariants:**
  - **Every `package.json:NN` citation in the wider index shifts whenever this file's top changes.** v3.5.0 removed
    the `pnpm` field (17 lines) and two dependencies; the `analyze` script (`:12`), the `seal-claims` script (`:18`) and
    later dependency bumps moved things again. Root-level files **are** covered by `scripts/check-index-citations.mjs`
    now (see the CI section), but a relocation there is only a warning, so re-read the line after any edit to this
    file rather than trusting a green run.
  - **Do not drop `@next/bundle-analyzer` as dead weight.** It looks unreferenced now that
    `bundle-analysis.yml` is gone, but `next.config.ts:5-7` still wraps the exported config with it and
    `pnpm analyze` is the local attribution tool. Removing it breaks `next.config.ts` at require time for
    *every* build, not just analyzed ones.
  - The `build` chain's `&&` sequencing is the deploy gate. Reordering it, or splitting the steps into
    independent commands, removes the "failing test blocks deployment" property. It now ends in `pagefind`, so a
    Pagefind failure also blocks the deploy.
  - **Do not re-add a `pnpm` field.** pnpm 11 silently ignores it, which would put the 12 security overrides back
    in a location that one `pnpm install` can drop from the lockfile. `pnpm-workspace.yaml` is the only location
    both pnpm 10 and 11 read.
  - `@react-three/postprocessing` is pinned exact at `3.1.1`; the `.github/dependabot.yml:83-84` ignore of `3.0.5` was
    written as a matched pair with a `3.0.4` pin (`dependabot.yml:80`) and is now moot — the pin moved past the broken
    version, so the entry is stale config rather than an active guard.
  - `@types/node` is `^26` (`:66`) while `engines.node` caps the runtime below 23.
  - `clean` deletes `.velite`, so `pnpm clean` must always be followed by `pnpm content` before `test`/`tsc`. It leaves
    `public/pagefind/` (gitignored, regenerated by the next build) alone.

### `Makefile`
- **Role:** Operator runbook wrapping pnpm, `vercel`, `gh`, `git`, and content scaffolding into 36 named targets.
- **Behaviour notes:** `.SHELLFLAGS := -euo pipefail -c` (`:8`) makes every recipe line fail fast — including on
  unset variables, which is why the `flags-show`/`env-check` recipes consistently use `$${VAR:-default}` rather
  than bare `$$VAR`. The scaffold targets use `ifndef SLUG` + `$(error …)` guards (`:88-90`, `:107-109`,
  `:124-126`, `:139-141`) and are idempotent — each checks `if [ -f … ]` and skips rather than overwriting.
  `$(eval TODAY := $(shell date +%Y-%m-%d))` stamps the frontmatter date.
- **Gotchas / invariants:**
  - `search-index` (`:64-66`) writes to `public/pagefind`, which is gitignored (`.gitignore:50`) and absent from a
    clean checkout; `pnpm build` now generates it, so `/search` 404s on its Pagefind assets only if you run the app
    without a full build. The target's `--site .next/server/app` input only exists post-`pnpm build`.
  - `new-project` hardcodes the GitHub org/user `sairam0424` into the scaffolded `repo:` field (`:131`).
  - `env-check`/`flags-show` read the **process** environment, not `.env.local`, so they under-report locally.
  - `resume-list` (`Makefile:360-367`) parses `ls -lh` columns 9 and 5 (`Makefile:364`) — filenames containing spaces would misalign.

### `scripts/replay-trace.mjs`
- **Role:** Standalone Node CLI that reconstructs a single request's telemetry waterfall from Upstash Redis.
- **Exports:** none — top-level script with side effects (invoked as `node scripts/replay-trace.mjs <traceId>`).
- **Reads / depends on:** `@upstash/redis` (`:25`), env `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
  (`:27-28`).
- **Consumed by:** `make trace TRACE_ID=…` (`Makefile:269`). Not imported by any module; excluded from linting
  (`eslint.config.mjs:21` ignores `scripts/**`).
- **Behaviour notes:** exits 1 with an `export …` hint if either Redis var is missing (`:30-37`) and 1 if no
  `traceId` argv (`:39-43`). Scans 7 fixed span kinds — `http.request`, `llm.attempt`, `tts.request`,
  `transcribe.request`, `client.error`, `server.error`, `budget.tick` (`:47-55`) — issuing one
  `zrange(key, since, "+inf", { byScore: true })` per kind against `anvilry:trace:<kind>`, where `since` is
  `Date.now() - 7 days` (the retention window, `:64`). Per-kind failures are caught and warned, not fatal
  (`:75-77`). Events are filtered client-side by `event.traceId === traceId`, sorted by `ts`, and printed as
  `+NNNs NNNms  LEVEL  kind  route  msg=…` with an indented `attrs` JSON block (`:87-109`). Zero matches exits 0
  with a retention-window hint.
- **Gotchas / invariants:** `:65-68` documents a fixed bug — `@upstash/redis` has
  `automaticDeserialization=true`, so members come back as **objects**; a `JSON.parse(m)` would coerce them to
  `"[object Object]"` and throw `SyntaxError`, silently dropping every event. Do not reintroduce a parse. The
  `KINDS` array is hardcoded and has **already drifted**: `KIND_LITERALS` in `src/lib/telemetry/schema.ts:37-50` now
  has 8 kinds, and `chat.cache` (FAQ-cache hit/miss on `/api/chat`) is missing from `KINDS`, so `make trace` never
  shows a cache event. A new span kind is invisible here until listed.

### `scripts/bundle-budget.mjs`
- **Role:** The repo's bundle-size gate, and the direct replacement for `.github/workflows/bundle-analysis.yml`.
  Asserts two things about the build that is *actually shipping*: a per-route first-load JS ceiling, and that
  three.js stays **off** the first-load critical path.
- **Exports:** none — top-level script with side effects (`node scripts/bundle-budget.mjs`, run after
  `next build` / `pnpm build`, `:33`).
- **Reads / depends on:** only `node:fs` (`:35`) and `.next/diagnostics/route-bundle-stats.json` (`:37`). No
  dependencies, no network, no second build.
- **Consumed by:** the `Bundle budget` step of `ci.yml`'s `e2e` job (`.github/workflows/ci.yml:190-191`). Not
  imported by any module; excluded from linting (`eslint.config.mjs:21` ignores `scripts/**`).
- **Why this artifact:** `next build` writes `route-bundle-stats.json` with **no flag**, but **only under
  Turbopack** — the header records that Next gates `writeRouteBundleStats` on `bundler === Bundler.Turbopack`
  (`:24-26`). Since `pnpm build` ends in a bare (therefore Turbopack) `next build`, the file measures exactly
  what ships. Records carry the keys `route` / `firstLoadUncompressedJsBytes` / `firstLoadChunkPaths`; the header
  (`:26-28`) records that when written the on-disk sum of `/`'s `firstLoadChunkPaths` equalled its reported
  `firstLoadUncompressedJsBytes` exactly, so the number is a measurement, not a model. **Not re-measured for this
  edition** (no build was run) — the header's "16 routes" and "`/` is 1220794" are authoring-time figures that have
  since moved (see below).
- **The two assertions:**
  - **First-load ceiling** `MAX_FIRST_LOAD_BYTES = 1_336_000` (`:72`) — a ceiling, not a baseline, that has been
    **raised repeatedly**: 1,285,000 (initial) → 1,290,000 → 1,326,000 → 1,332,000 → 1,336,000 (`git log -p -- scripts/bundle-budget.mjs`; the docblock only narrates the later steps). The docblock (`:42-71`) tells the story:
    the global theme toggle, hero name line and `Tooltip` rollout on the nav components; a lazy `Tooltip` was tried and
    **reverted** because swapping between a bare-children fallback and the Radix-wrapped tree remounts the focusable
    child and broke a WCAG 2.4.3 focus-restoration test (`:48-55`); the `integrity` terminal command plus the
    `data/integrity-chain.json` re-export (`:57-59`); and four new profile-link brand icons on the homepage hero. It
    quotes `/` at **1,333,521 B** after the last change (`:61-64`), leaving **~2,479 B of headroom (~0.19%)**
    (`:66-67`) — the earlier "~5% headroom" figure is gone. The same docblock still opens with an older figure for `/`
    (1,322,132 B, `:43`), so it is internally inconsistent; the quoted post-change number is the current one. Its
    tolerance rationale — chunk-boundary jitter and unverified byte-exact determinism between macOS (local) and
    `ubuntu-latest` (CI), with cross-OS variance of ~1,500 B seen once — still holds. Raising it is expected, in its
    own commit, quoting measured before/after bytes (`:69-71`).
  - **three.js stays lazy**, checked by marker `LAZY_MARKER = "WebGLRenderer"` (`:84`) rather than by size. The
    docblock (`:74-83`) explains why a total-bytes guard cannot make this assertion: an eager
    `import * as THREE` in a shell component moves ~876 KB onto every route's critical path while total emitted
    bytes barely move — the bytes were always shipped, they just stopped being deferred. Recorded as exactly **one**
    chunk containing the marker, at **897,249 B** (876.2 KiB, matching the `next.config.ts` twin-chunk block), and it
    appears in none of the routes' first-load sets (`:76-77`). The failure message names `next/dynamic(…, { ssr: false })`,
    a `next.config.ts` line range (127-149) and `src/lib/r3f.ts` (`:146-154`) — **that range is stale**; the block is
    now at `next.config.ts:147-169` (the docblock at `:70` and `:75` repeats the stale range).
- **Gotchas / invariants:**
  - **A missing or malformed artifact EXITS 1 — that is the feature, not an oversight.** The predecessor's defining
    flaw was reporting success while measuring nothing, so "I could not measure" must be red. Four
    separate `fail()` paths enforce it: unreadable/unparseable JSON (`:91-100`), fewer than `MIN_ROUTES = 17`
    records (`:40`, `:102-107`), missing expected keys (`:108-113`), and first-load chunk paths that do not exist on
    disk (`:135-144`).
  - **Do not add `continue-on-error` to the CI step**, and do not add `if-no-files-found`-style leniency. The
    script's own closing message says so (`:159-162`), and the step's comment (`ci.yml:179-189`) records why
    the predecessor's runs were green while uploading nothing.
  - **`pnpm analyze` breaks it, by design.** A `--webpack` build emits no `route-bundle-stats.json`, so the gate
    fails after one — with a message naming `--webpack` as the likely cause (`:96-98`). Re-run `pnpm build`.
  - `MIN_ROUTES` is a **format tripwire, not a route-count assertion.** Its comment (`:39`) explains the current
    value, **17**: the 16 `src/app` `page.tsx` routes plus `/_not-found`; it was raised from 16 to match, because the
    stats file lists `/_not-found` too. Fewer records means "Next changed the artifact's shape and this gate is lying",
    and the failure text says to fix the script rather than lower the constant (`:105`). Adding routes only ever
    raises the real count; a *drop* means the diagnostics contract moved. Same for the key check at `:108` — an
    upgrade that renames `firstLoadUncompressedJsBytes` turns the gate red rather than vacuously green. One comment
    in the script (the header at `:27`) still says "16 routes" from before that change; the three.js docblock at `:76` was
    updated to "17 routes".

### `.github/workflows/ci.yml`
- **Role:** The merge gate — lint/typecheck/test, the codebase-index citation check, the claims-integrity verify,
  Playwright E2E, the **bundle budget**, a cold pnpm-11 install check, and a non-blocking security report. Since
  `bundle-analysis.yml` was deleted it is also the repo's **only** build-running workflow, so it is the only
  place a bundle regression can be caught.
- **Behaviour notes:** Five jobs. Four run in parallel with no `needs:`; `claims-integrity-autocommit` is the exception
  (`needs: ci`, `:97`) and is normally skipped. Every action is SHA-pinned with a version comment (`:19`, `:22`, `:27`,
  `:33`), including `pnpm/action-setup` (`ea17c68d…`, v6.1.0, in `ci`, `claims-integrity-autocommit`, `e2e` and
  `install-pnpm-11`). `ci`, `claims-integrity-autocommit`, `e2e` and `install-pnpm-11` all pin `node-version: 22`
  (`:29`, `:113`, `:160`, `:235`) — `security-alerts` needs no Node at all — which `.nvmrc` and `engines.node` mirror.
  Playwright browsers are installed with `pnpm exec playwright install --with-deps chromium webkit` specifically to
  pin the download to the installed `@playwright/test` version, because a mismatch fails with `Executable doesn't
  exist at .../chromium_headless_shell-<rev>` (`:166-173`); webkit is there because of the `mobile-safari` project.
  Permissions are set per job — `ci`, `e2e`, `install-pnpm-11` and `security-alerts` are `contents: read`, only the
  opt-in auto-commit job is `contents: write` (`:14-15`, `:99-100`, `:141-142`, `:208-209`, `:280-281`).
- **Gotchas / invariants:**
  - The `e2e` job's `pnpm build` step re-runs `vitest run` (it is inside the build chain), so tests execute
    twice per CI run — once in `ci`, once inside `e2e`.
  - **`ci` installs with a bare `pnpm install`**, not `--frozen-lockfile` (`:41`); only `install-pnpm-11` is frozen
    (`:239`). Lockfile drift is therefore not caught by the main job. Together with the missing `concurrency` group,
    every PR branch pays for two full runs.
  - **The `Bundle budget` step (`:190-191`) depends on step *order* inside `e2e`, not just on membership.** It
    reads `.next/diagnostics/route-bundle-stats.json`, so it must sit after `Build` (`:176-177`) and it must not
    be moved into `ci`, which never builds. It has **no `continue-on-error`** and the job does not upload the
    artifact anywhere, deliberately: the check is the output. Adding `--webpack` to the build would silently
    starve it — and then correctly fail it.
  - `security-alerts` will always show green whether or not `SECURITY_ALERTS_TOKEN` exists; the comment states
    the promotion criteria explicitly: "drop `continue-on-error`, exit 1 on high/critical … once a token is
    wired AND the existing backlog is at zero" (`:277-278`).
  - `pnpm audit` in `ci` is `continue-on-error` too (`:48-50`): it reports the full installed tree but never blocks.
    The only blocking dependency check is `dependency-review` (PR diff, runtime scope, high+).
  - The `Codebase index citations` step (`:76-77`) must stay **out** of `pnpm build`. Its comment (`:66-75`)
    records that it was briefly inside `vitest run`, where a stale doc would have failed the production build.
    Moving it back re-couples documentation freshness to deploys.
  - The `Claims integrity chain` step (`:83-84`) runs `scripts/seal-claims.ts` in **verify** mode: it fails if the
    current `impactMetrics`/`achievements` in `src/lib/profile.ts` do not match the last entry sealed into
    `data/integrity-chain.json`, or if the chain's own hash linkage is broken. The fix is
    `npx tsx scripts/seal-claims.ts --write` locally, then commit the chain file (`:79-82`). The opt-in auto-commit job
    exists only so a maintainer can hand that step to CI.

### `vercel.json`
- **Role:** The entire Vercel project config — nothing but cron schedules.
- **Behaviour notes:** 5 crons (`:3-7`), all matched by a real route under `src/app/api/cron/`:
  `/api/cron/health-check` `0 5 * * *`, `/api/cron/eval` `0 9 * * 1`, `/api/cron/github-sync` `0 8 * * *`,
  `/api/cron/seo-audit` `0 6 * * 1`, `/api/cron/content-audit` `0 7 * * 1`. Per-route `maxDuration`:
  `eval`/`seo-audit`/`content-audit` 60 s, `github-sync` 30 s, `health-check` 25 s.
- **Gotchas / invariants:** No `buildCommand`, `framework`, `regions`, `functions` or Node-version keys — build
  behaviour is entirely Vercel's Next.js auto-detection plus `package.json`'s `build` script. Every cron target is
  fail-closed on `CRON_SECRET` through the shared `unauthorizedUnlessCron` guard (`src/lib/cron-auth.ts:23-26`), so
  with that secret unset all five schedules fire and immediately 401. (`CLAUDE.md`'s environment example used to
  annotate `CRON_SECRET` as protecting only `/api/cron/eval`; it now says all five routes fail closed, matching the code.)

### `public/avatar/sairam.glb`
- **Role:** The hero avatar 3D model, loaded when `NEXT_PUBLIC_HERO_MODE` selects the avatar treatment.
- **Consumed by:** `src/components/hero-avatar/avatar-mesh.tsx:10,27,54` — the path `"/avatar/sairam.glb"` is
  **hardcoded** in `useGLTF.preload()`, `useGLTF()`, and `useGLTF.clear()`.
- **Behaviour notes / invariants (all asserted by `src/lib/avatar-glb.test.ts`, which runs inside `pnpm build`):**
  file must exist at that exact path (`:53-56`); must be < `1.5 * 1024 * 1024` bytes (current 1,105,768 B,
  down from 2.549 MB — `:18-21,58-61`); must be a glTF 2.0 container (`:63-66`); must retain
  `EXT_meshopt_compression`, `KHR_mesh_quantization`, and `EXT_texture_webp` with **every** image
  `mimeType === "image/webp"` and well-formed `RIFF`/`WEBP` payloads (`:70-95`); must contain bones whose
  lowercased names include `head`, `neck`, `chest`-or-`spine1`, and a `spine` distinct from `spine1`, plus at
  least one skin (`:101-131`) — because `resolveRig()` in `src/components/hero-avatar/rig.ts` matches on
  lowercased substrings and a rename would leave the avatar loading but never moving, with no error anywhere.
  A test also **pins the current absence** of morph targets (`expect(targets.length).toBe(0)`, `:133-149`):
  this is an AVATURN export (`avaturn_body`, `avaturn_hair_0`, …) with no blendshapes, so the 8 ARKit eye-gaze
  morphs `avatar-mesh.tsx` drives are inert. Flipping that assertion to `toBeGreaterThan(0)` is the documented
  signal that eye gaze has become live. Swapping in a differently-exported GLB fails the build.

### `public/resume/*.pdf`
- **Role:** The résumé PDF served as a static asset. Exactly **one** file exists, `Sairam_Resume_MX_E.pdf`.
- **Consumed by:** `src/lib/profile.ts:136-142` — `resumeVariants` has a single entry, `Sairam_Resume_MX_E.pdf` →
  "Sairam Resume" / "Backend & GenAI". Earlier editions of this page documented five role-targeted variants
  (`_BE`, `_FS`, `_FE`, `_GAI`); those files are not in the tree and not in `resumeVariants`. Whether all entries or
  only `resumeVariants[0]` render is gated by `NEXT_PUBLIC_RESUME_VARIANTS` (`src/app/resume/page.tsx:29`,
  `src/components/home/resume-view.tsx:46`, `src/components/command-palette-content.tsx:365`,
  `src/components/game/terminal/commands.ts:297`) — with one entry the flag currently changes nothing. The MCP
  `get_resume_variant` tool exposes the same set (`CLAUDE.md:252`, § MCP Server).
- **Gotchas / invariants:** Filenames are hardcoded strings in `src/lib/profile.ts` — renaming a PDF produces a
  404 with no type error. `/resume` is the one route with a relaxed `frame-ancestors 'self'` CSP so the PDF can
  be iframed (`next.config.ts:213-239`; the override itself is `next.config.ts:218-230`). `.github/CONTRIBUTING.md:19` declares `public/resume/` closed to
  outside PRs, and `.github/PULL_REQUEST_TEMPLATE.md:25` has a checkbox asserting it was not touched.

## Coverage

- `package.json`
- `.nvmrc`
- `next.config.ts`
- `tsconfig.json`
- `eslint.config.mjs`
- `postcss.config.mjs`
- `pnpm-workspace.yaml`
- `patches/@react-three__fiber@9.7.0.patch`
- `vercel.json`
- `Makefile`
- `next-env.d.ts`
- `.gitignore`
- `.env.example`
- `.coderabbit.yaml`
- `scripts/replay-trace.mjs`
- `scripts/bundle-budget.mjs`
- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/gitleaks.yml`
- `.github/workflows/scorecard.yml`
- `.github/dependabot.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/CONTRIBUTING.md`
- `public/avatar/sairam.glb`
- `public/resume/Sairam_Resume_MX_E.pdf`
- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`
- `public/static/` (never tracked, absent from a clean checkout)
- `ruvector.db` (untracked, gitignored)
- `agentdb.rvf` (untracked, gitignored)
- `agentdb.rvf.lock` (untracked, gitignored)
- `.swarm/` (untracked, gitignored)
- `.claude-flow/` (untracked, gitignored)

## Out of scope (cross-references)

Read alongside, but indexed elsewhere: `velite.config.ts` (content schemas), `vitest.config.ts` (two-project
test setup; the `NODE_ENV: "test"` pin at `:26` is what keeps `pnpm build` from failing DOM tests on Vercel),
`playwright.config.ts` (the `webServer` block at `:37-44` that makes the `e2e` CI job self-contained, and the two
projects at `:15-24`), `scripts/seal-claims.ts` + `data/integrity-chain.json` + `src/lib/claims-integrity.ts` (the
Claims Integrity Ledger that `ci.yml` verifies and optionally auto-seals), `scripts/check-index-citations.mjs` (the
citation gate), `src/instrumentation.ts` (the `[config]` cold-start env snapshot), `src/proxy.ts` (Node-runtime
`/admin/*` gate sharing `isAdminAuthorized`), `src/lib/cron-auth.ts` and `src/lib/rate-limit.ts` (cron bearer auth
and the per-class limiter), and `DEPLOY.md` / `TELEMETRY.md` / `VOICE.md` (operator prose; `DEPLOY.md` § "Import the
project" now quotes the full `build` chain, including `vitest run` and `pagefind`).

## UNVERIFIED

- **Cross-page anchors that embed a count are structurally fragile.** The `NEXT_PUBLIC_GRAPH_PHYSICS` row linked
  `#dependencies-35`; removing two dependencies in v3.5.0 killed that anchor. It is now re-pointed at
  `#removed-in-v350` (13's `### Removed in v3.5.0` heading), which both documents the removal directly and carries
  no count to rot — re-pointing it at `#dependencies-33` would only have reset the same fuse. Nothing verifies
  intra-index links — `scripts/check-index-citations.mjs` only checks `path:line` citations into source, not
  Markdown fragments — so a heading whose text embeds a changing number silently breaks every deep link to it on
  each change.
- Whether dropping `blob:` from `worker-src` (`next.config.ts:68`) is actually safe. Grep finds no `new Worker(`,
  no `OffscreenCanvas`, and no worker-bound `URL.createObjectURL` under `src/`, but this was not exercised
  against a live browser with `NEXT_PUBLIC_PDF_ATTACHMENTS=true`, and the bundler could in principle hand pdf.js
  a `blob:` worker URL. Left in place.
- Whether the CSP was ever actually deployed in `Content-Security-Policy-Report-Only` form, and the contents of
  the Playwright zero-violation sweep referenced at `next.config.ts:104-108` — the sweep is described in comments
  but no such audit script or spec exists in `e2e/` that I located.
- Whether the repo secret `SECURITY_ALERTS_TOKEN` (or the repo variable `SEAL_CLAIMS_AUTO_COMMIT`) is currently
  configured — not inspectable from the working tree, so whether the `security-alerts` job reports anything today, or
  the auto-commit job ever runs, is unknown.
- **The Vercel project's Node major.** Nothing in the repo sets it (`vercel.json` has only `crons`; no `.vercel/`
  directory exists in this worktree). A local `.vercel/project.json` on the `sairam-dev` checkout carries
  `"nodeVersion": "24.x"` (read 2026-09-29; it is a gitignored local copy, so it evidences the Vercel project setting only
  indirectly), which would put production on a different major than the `22` that `.nvmrc`, `engines.node` and every CI
  job use — the live project setting itself was not checked.
- **Whether `MAX_FIRST_LOAD_BYTES = 1_336_000` (`scripts/bundle-budget.mjs:72`) is still comfortably above the
  largest route.** This edition did not run a build; the ~2,479 B headroom is the docblock's own arithmetic against its
  quoted `/` measurement (`:61-67`). Every byte count in that docblock was measured on macOS locally; the gate also
  runs on `ubuntu-latest`, and the script states byte-exact determinism between the two is **not** verified. With
  ~0.19% margin, small global additions can turn CI red.
- **Whether `bundle-analysis.yml` ever produced an artifact earlier in its life.** Zero artifacts is verified for
  the 25 most recent runs only (artifacts API, `total_count: 0` for each); GitHub expires artifacts, so older runs
  cannot be distinguished from "expired". The three structural causes are independently sufficient regardless, but
  "zero artifacts across all 222 runs" is an inference, not a measurement.
- What pnpm does when `@react-three/fiber` resolves to a version other than the `9.7.0` the patch is keyed to
  (silently unpatched, or a failed install) — not exercised.
- The claim that Vercel sets HSTS by default (`next.config.ts:87-88`) — asserted in the comment, not verifiable
  from this repo. On non-Vercel hosting the site would have no HSTS.
- What generates or populates `public/static/`. It does not exist in a clean checkout; the only references are
  `src/lib/case-study-depth.test.ts:27` (treating `/static/foo.svg` as a `diagram` frontmatter target) and
  `eslint.config.mjs:19` (ignore entry). No script writes to it.
- Whether `eslint.config.mjs`'s `globalIgnores` fully replaces `eslint-config-next`'s built-in ignores or merges
  with them. The comment at `:8` says "Override default ignores", and the list re-declares the four defaults
  (`.next/**`, `out/**`, `build/**`, `next-env.d.ts`) alongside six project-specific ones — implying a replace,
  but I did not verify the flat-config merge semantics against the installed package.
