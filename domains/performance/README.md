---
kind: domain
domain: performance
status: active
goal: Keep Core Web Vitals green and catch bundle regressions before they ship
cadence: on-pr
---

# performance — web vitals loop

Monitors and improves runtime performance and bundle health. Consumes the per-route first-load
measurement a bare `next build` already emits (`.next/diagnostics/route-bundle-stats.json`, gated in
CI by `scripts/bundle-budget.mjs`), the local `@next/bundle-analyzer` treemap (`pnpm analyze` —
webpack *attribution* only, **not** what ships; see Metrics), and web-vitals measurements. Produces
bundle reduction PRs, lazy-loading improvements, and signals flagging regressions.

## Current focus
Both long-standing tracks are **DONE** — implemented in the PRs below, not merely reclassified.
Neither needed an upstream fix; the original "upstream blocked" diagnosis was wrong on both.

1. **cacheComponents migration** — ✅ implemented in **#121**. All 26 segment configs migrated
   (scope confirmed empirically: enabling the flag failed with exactly `26 errors`). Verified on
   the live Vercel preview, including `x-vercel-cache: PRERENDER` on the routes that should be
   static and a preserved `404` on the flag-gated `/notes/[slug]`.
2. **R3F twin-chunk** — ✅ resolved by the Next **16.3.0** upgrade itself (**#120**), with *no*
   experimental flags. `2036 KB / 5 chunks (two 876 KB copies)` → `1160 KB / 4 chunks (one copy)`
   = **−876 KB (−43%)**, confirmed by the `WebGLRenderer` symbol appearing in exactly one chunk
   rather than by chunk count alone.

The planned `turbopackChunking` / `turbopackSharedRuntime` A/B was **cancelled, not skipped**: the
win is already banked without them, both are doc-labeled "not recommended for production", and
`turbopackSharedRuntime` shipped with a hydration-breaking race. Rationale is recorded in
`next.config.ts` so it isn't relitigated.

## Backlog
- [ ] Run `pnpm analyze` and check `.next/analyze/` for any newly-heavy *modules* — webpack
      attribution only, so never quote its byte counts as shipped sizes (see Metrics). Shipped
      per-route bytes come from the CI budget gate, which needs no manual step.
- [x] ~~Replace the no-op `bundle-analysis.yml` workflow with a gate that can actually fail~~ — done:
      `scripts/bundle-budget.mjs` + the "Bundle budget" step in `ci.yml` (see Regression guards).
- [ ] Verify AnvilCoreSurface lazy-load is still saving ~148KB per page (shipped v2.6.0-B)
- [x] ~~Compress `public/avatar/sairam.glb`~~ — done in **#124**: 2.55 MB -> 1.055 MB (-59%).
      NOTE the original diagnosis in this backlog was WRONG and is corrected here: the asset was
      never "uncompressed (no Draco/meshopt/KTX2)" — `extensionsUsed` already carried
      EXT_meshopt_compression + KHR_mesh_quantization, so geometry was the SMALL part (~190 KB for
      24,370 triangles). The weight was TEXTURES (~2.28 MB of the 2.52 MB BIN chunk, ~90%), one
      1024x1024 PNG alone being 925 KB. Fixed by re-encoding all 13 textures to WebP via
      EXT_texture_webp at UNCHANGED resolution. Draco would not have helped.
- [ ] Add web-vitals collection to Vercel Analytics dashboard (already has `@vercel/speed-insights`)
- [ ] Check LCP on `/?view=gamified` — 3D canvas should not be in critical path. The *bundle* half of
      this is now proven every CI run (`WebGLRenderer` in 0 of 16 routes' first-load sets); what is
      left is the runtime measurement after the view switch.
- [x] ~~A/B the R3F twin-chunk lever on 16.3.0~~ — cancelled; resolved by the upgrade alone (#120)
- [x] ~~Coalesce per-chunk writes in `src/components/chat/use-chat.ts`~~ — done in **#122**

## Regression guards (cheap checks, silent failures otherwise)
The first guard is now **ENFORCED in CI**. Each of the rest still fails *silently* — nothing
type-checks or test-fails when they regress, the bundle just quietly doubles.

- **✅ ENFORCED: per-route first-load budget + three.js-stays-lazy.** `.github/workflows/ci.yml:110-111`
  runs `node scripts/bundle-budget.mjs` immediately after the "Build" step inside the existing `e2e`
  job, so it rides the build that already happens — no second build. It reads
  `.next/diagnostics/route-bundle-stats.json`, which `next build` writes with no flag but **only under
  Turbopack**, and fails the job if either: (a) any route's `firstLoadUncompressedJsBytes` exceeds
  **1,285,000 B** (`scripts/bundle-budget.mjs:45`; largest today is `/` at **1,220,794 B** — ~5%
  headroom, and the on-disk sum of that route's chunk paths is the same 1,220,794 B, so it is a
  measurement not a model); or (b) the `WebGLRenderer` marker (`scripts/bundle-budget.mjs:57`) turns up
  in any route's first-load chunk set — today it sits in exactly one chunk, **897,249 B**, present in
  **0 of 16** routes' first-load sets. A missing or malformed artifact **exits 1 by design**: "I could
  not measure" must be RED, which is exactly what the deleted `bundle-analysis.yml` got wrong for its
  entire 222-run life (211 green, 11 red). There is deliberately no `continue-on-error` and no `if-no-files-found` — do not
  add them. **This does NOT catch a duplicate `three` copy that stays off the critical path** — that
  remains the manual grep below.
- **R3F dedup depends on ONE resolved `three` version.** After any `three`/fiber/drei bump:
  `find node_modules/.pnpm -maxdepth 1 -name "three@*"` should show a single live version, and
  `WebGLRenderer` should grep to exactly one chunk. (Checked for Dependabot #118 → `three` 0.185.1
  preserves it: 1160 → 1164 KB, one copy.)
- **`src/lib/r3f.ts` is load-bearing.** The barrel gives the bundler one module-graph node for the
  R3F universe, which is the precondition 16.3.0's chunking exploits. Do not delete it on the
  theory that "16.3 handles this now" — that combination was never tested.
- **Each new `dynamic()` R3F boundary added a copy pre-16.3.0.** Measured on the avatar branch
  (#103): a third boundary took 16.2.9 from 2 copies / 2036 KB to 3 copies / 2988 KB, while the
  same branch on 16.3.0 collapses to 1 copy.
- **CURRENT BASELINE (integrated, post-#121/#123/#124, measured with production hero defaults):
  exactly 1 three.js copy, 1248 KB total across R3F chunks, 113/113 static pages.** Use these
  numbers, not the per-branch figures above, when checking for regression. Note the raw
  `grep -lE "react-three|THREE\." | wc -l` metric below returns 5 (chunks REFERENCING R3F) — that is
  not the copy count. **Use that exact two-alternative pattern**, which is the one every KB figure
  here was counted with (`next.config.ts:136-138`); the narrower `grep -l "react-three"` returns 2 on
  a current build and will read as a phantom regression. The copy count is
  `grep -l "WebGLRenderer" | wc -l`, which must be 1.
  **Every KB figure in this section is a TURBOPACK measurement** — Turbopack is what `next build`
  runs and therefore what ships. None of them came from the `@next/bundle-analyzer` treemap, and the
  two are not comparable: the shipped single three.js chunk is **897,249 B** (876.2 KiB, matching
  `next.config.ts:127-149`), which the CI gate re-verifies every run.

## Evidence & analysis
*(link signals and docs here as they accumulate)*

## Metrics
- **Bundle size — what actually ships (authoritative):** `.next/diagnostics/route-bundle-stats.json`,
  written by a bare `pnpm build` with no flag and no analyzer. Per-route records keyed
  `route` / `firstLoadUncompressedJsBytes` / `firstLoadChunkPaths`; 16 routes today. Read by
  `scripts/bundle-budget.mjs`, which prints every route sorted descending, so `pnpm build && node
  scripts/bundle-budget.mjs` *is* the metric. Emitted **only under Turbopack** — a `--webpack` build
  produces no such file.
- **Bundle size — module attribution (LOCAL tool, not a metric):** `pnpm analyze` (`package.json:12`
  = `velite --clean && ANALYZE=true next build --webpack`) writes
  `.next/analyze/{client,edge,nodejs}.html`. The `--webpack` flag is **required, not optional**:
  `next build` in Next 16 is Turbopack, and `@next/bundle-analyzer` is webpack-only — under Turbopack
  it prints "not compatible with Turbopack builds, no report will be generated" and produces nothing
  while still exiting 0. (This is why the old `ANALYZE=true pnpm build` instruction was worse than
  no instruction: it looked like it worked.) The analyzer is still wired at `next.config.ts:5-7` and
  still a devDependency purely for this. Treat the treemap as "**which modules are heavy**", never as
  shipped bytes — webpack chunks differently from Turbopack, and the three.js chunk Turbopack really
  emits is 897,249 B in exactly one chunk.
- Core Web Vitals: Vercel Speed Insights dashboard
- R3F chunk count: `find .next -name "*.js" | xargs grep -lE "react-three|THREE\." | wc -l`
  (chunks REFERENCING R3F, currently 5 — **not** the copy count; for that swap the pattern for
  `WebGLRenderer`, which must return 1)

## Known constraints

> **Corrected 2026-08-12.** All three entries below previously misdiagnosed their own cause. Two were
> not "waiting for a Next.js fix" at all. Verified against the compiler source at the pinned version,
> the installed `node_modules`, and upstream issue/PR state — not from memory.
>
> **Updated 2026-08-15: the first two are now RESOLVED**, not just reclassified. Their diagnostic
> detail is kept below because the *mechanism* explanations remain correct and useful — only the
> "still blocked" framing was stale. Exactly one real constraint remains (ESLint 10).

- ✅ **RESOLVED in #121** — **PPR / `cacheComponents`** — *not upstream-blocked; ours to do.* The RSC transform rejects the
  **presence** of `export const runtime`, never its value (`react_server_components.rs`, verified at tag
  v16.2.9; Next's own e2e test asserts the build fails). `nodejs` is already the default and Cache
  Components *requires* it — only `edge` is unsupported. So the exports are redundant and the fix is
  **deletion**. No per-route escape hatch exists or is planned (`cacheComponents` is a plain boolean);
  `instant = false` defers validation, not this check. Real scope is **26 configs / 22 files**
  (13 `runtime` → delete · 4 `revalidate` → need `"use cache"` + `cacheLife` · 9 `force-dynamic` →
  investigate first, they work around the `[param].ext` params gap, not caching). `maxDuration` survives.
  Prerequisite: **16.3.0** — satisfied in #120. All 26 migrated in #121; the `26 errors` the
  build reported on enabling the flag matched this inventory exactly. Two constraints only a real
  build surfaced: `generateStaticParams` must return >=1 result (collided with the flag-gated
  `/notes` ship-dark pattern), and synchronous IO (`new Date()`, `Date.now()`) fails prerender and
  is NOT deferrable via `instant = false`.

- ✅ **RESOLVED in #120** — **R3F twin-chunk.** The framing below (*"genuinely unresolved upstream"*)
  was accurate when written and is now obsolete: upgrading to **16.3.0 fixed it outright**, with no
  experimental flags and no upstream change. Post-fix: `1160 KB / 4 chunks`, `WebGLRenderer` in
  exactly ONE chunk. The measurement and mechanism notes below are retained as the historical record.
  Confirmed real by measurement: two chunks of
  **876 KB each** both containing `react-three`/`THREE.` (~1.75 MB duplicated) across **16 `dynamic()`
  boundaries**. `experimental.turbopackChunking` did ship in stable **16.3.0**, but it is a set of
  size/merge thresholds, **not** a dedup primitive — zero mentions of three/R3F across the PR's 29
  changed files, and neither it nor `turbopackSharedRuntime` exists in the installed 16.2.9.
  Upstream request is [vercel/next.js#96040](https://github.com/vercel/next.js/discussions/96040)
  (still OPEN; reproductions at 2.08 copies/module vs webpack's 1.00) — now moot for us.
  The proposed A/B (`turbopackChunking: { minChunkSize: 0 }` + `turbopackSharedRuntime: true`) was
  **CANCELLED, not skipped**: unnecessary once 16.3.0 fixed this, and actively risky — both are
  doc-labeled "not recommended for production" and `turbopackSharedRuntime` shipped with a
  hydration-breaking race. Do **not** adopt them for this. The `src/lib/r3f.ts` barrel (commit
  `f7c5110`) stays: it is load-bearing for the single-copy outcome and was never tested absent.
  Do **not** re-try `optimizePackageImports` — already disproven here (commit `6246ed9`).

- **TypeScript 7** — *NEW 2026-08-15: blocks the lint toolchain, not our code.* Dependabot #128
  proposed `typescript ^7` (with eslint ^10, @types/node ^26, velite ^0.4.0 grouped in). CI failed
  at `pnpm lint`: `@typescript-eslint/typescript-estree@8.61.0` crashes on load under
  typescript@7.0.2 with `TypeError: Cannot read properties of undefined (reading 'Cjs')`
  (create-program/shared.js:59). **Reproduced with eslint pinned at 9.39.4**, which proves this is
  NOT the ESLint 10 issue below — it is @typescript-eslint lacking TS7 support. Importantly
  `tsc --noEmit` under TS 7.0.2 is **CLEAN**, so our own source is already TS7-ready; only linting
  breaks. Blocked via a semver-major dependabot ignore (minors/patches still flow). Re-check when
  @typescript-eslint announces TypeScript 7 support.
  *Triage result:* velite ^0.4.0 and @types/node ^26 from that same group are SAFE — verified
  independently (velite content-gen ok, tsc clean, lint 0 errors, 531/531 tests, build 113/113).
  Merging them separately unblocks 2 of the 4 bumps instead of leaving all four stuck.

- **ESLint 10** — *hard-blocked upstream, and the recorded cause was wrong.* `eslint-config-next` does
  **not** call `getFilename()` (grep of the installed package returns zero hits). Two stacked failures:
  (1) `eslint-plugin-react` calls removed APIs (`context.getFilename()`, `sourceCode.getJSDocComment` —
  the latter has *no* replacement), pulled in only because Next ships `settings.react.version = 'detect'`;
  (2) `eslint-config-next`'s vendored Babel 7 `@babel/eslint-parser` lacks `ScopeManager#addGlobals`, and
  Babel has ruled out ever supporting ESLint 10 in Babel 7 ([babel#17934](https://github.com/babel/babel/issues/17934)).
  No ESLint-10-compatible `eslint-plugin-react` release exists (latest 7.37.5 peers `<=^9.7`). The popular
  `settings.react.version` pin workaround does **not** unblock it — it clears only the first crash.
  **Decision: stay on ESLint 9** (see the SEO/tooling note below). Accepted risk: ESLint 9 reached **EOL
  2026-08-06**, so we are on an unsupported linter major. Personal site, no compliance driver.
  **Re-check trigger:** [jsx-eslint/eslint-plugin-react#4022](https://github.com/jsx-eslint/eslint-plugin-react/pull/4022).
  Escape hatch if it stalls: drop `eslint-config-next` and consume `@next/eslint-plugin-next` directly —
  the officially documented composition path and the only route that removes both blockers at once.

## Verified-current facts (2026-08-12)

- **Core Web Vitals are unchanged in 2026**: three metrics — LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 — all
  lifecycle "Stable", assessed at p75 across mobile/desktop. Nothing added, retired (since FID, Sept 2024),
  or re-thresholded; nothing in the pending queue. Google's policy caps stable-CWV changes at once per year
  with prior notice, and holds candidate metrics in "pending" ≥ 6 months. **Every article claiming a 2026
  threshold change is SEO content marketing** — they mutually contradict each other and none is from
  chromium.org / developer.chrome.com / web.dev.
- **Do not use `isInputPending()`** — Chrome DevRel explicitly withdrew the recommendation (the section
  heading is literally "Don't use isInputPending()"). Superseded by `scheduler.postTask()`/`yield()`.
- **`scheduler.yield()` is not Baseline** — Chrome/Edge 129, Firefox 142, **Safari unsupported** through
  Safari 27 / iOS 26.5 (~72% global); WebKit has never filed a standards position. Needs
  `globalThis.scheduler?.yield` detection + `setTimeout(…, 0)` fallback if ever used.
- **LoAF is Chromium-only, not Baseline** (Chrome/Edge 123+, ~71%) — a diagnostic instrument, not a feature.
- **Token-streaming is a *smoothness* problem, not an INP problem.** N per-token DOM writes each under
  50 ms yield `blockingDuration ≈ 0` with high `duration`; such frames "cannot be solved by breaking up
  work, but instead must **reduce** work." → **coalesce writes; yielding will not help.**
- **Lower TTFT is not a free perceived-quality win** — CHI 2026 controlled experiment (N=240): 2 s TTFT
  rated *less* thoughtful than 9 s and 20 s (M 5.76 vs 6.09 vs 6.11; F(2,234)=5.12, p=.007). Small effect
  and not a licence to slow anything down, but retire "lower TTFT = better UX" as a goal.

## Timeline
2026-06-24 | bootstrap — domain charter created; v2.6.0-B shipped AnvilCoreSurface lazy-load (~148KB saved)
2026-08-12 | corrected all three "upstream blocked" entries after a 2-pass adversarial research audit
            (218 agents, 50 claims verified / 20 refuted) + direct compiler-source and node_modules
            inspection. PPR reclassified from upstream-blocked to ours-to-do; R3F confirmed real by
            measurement; ESLint cause corrected and a stay-on-9 decision recorded.
2026-08-15 | both long-standing "upstream blocked" tracks CLOSED. #120 (Next 16.3.0) resolved the R3F
            twin-chunk outright with no experimental flags (2036 -> 1160 KB, two copies -> one, verified
            by symbol count); #121 migrated all 26 cacheComponents segment configs and was verified on
            the live Vercel preview; #122 coalesced chat streaming writes to one commit per frame.
            The turbopackChunking/turbopackSharedRuntime A/B was cancelled as unnecessary and risky.
            #103 (avatar) unblocked — its GLB had landed on develop; measured that a third dynamic()
            boundary costs a third three.js copy pre-16.3.0, so #120 must merge first.
2026-08-21 | bundle guard REBUILT. Deleted bundle-analysis.yml: 222 runs, 211 green, ZERO artifacts
            across the 25 most recent — its ANALYZE=true build produced nothing because `next build`
            in Next 16 is Turbopack and @next/bundle-analyzer is webpack-only, its compare step read
            a Pages-Router manifest that is `{"/_app": []}` here, and if-no-files-found: warn +
            continue-on-error made all of it invisible. Replaced by scripts/bundle-budget.mjs on the
            existing e2e build (ci.yml:110-111): per-route first-load budget from
            .next/diagnostics/route-bundle-stats.json plus a three.js-stays-lazy assertion, no
            continue-on-error, hard-fails when it cannot measure. Analyzer demoted to the local
            `pnpm analyze` (--webpack required). Corrected here too: the "next build uses webpack"
            claim was FALSE — the 876 KB single-chunk three.js figure is and always was a Turbopack
            measurement (897,249 B, re-confirmed), so the chunk invariant and src/lib/r3f.ts's
            load-bearing role both STAND; only the bundler attribution was wrong.
