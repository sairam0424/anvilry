---
kind: domain
domain: performance
status: active
goal: Keep Core Web Vitals green and catch bundle regressions before they ship
cadence: on-pr
---

# performance — web vitals loop

Monitors and improves runtime performance and bundle health. Consumes the `@next/bundle-analyzer`
output (`ANALYZE=true pnpm build`) and web-vitals measurements. Produces bundle reduction
PRs, lazy-loading improvements, and signals flagging regressions.

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
- [ ] Run `ANALYZE=true pnpm build` and check `.next/analyze/` for any new large chunks
- [ ] Verify AnvilCoreSurface lazy-load is still saving ~148KB per page (shipped v2.6.0-B)
- [ ] **Compress `public/avatar/sairam.glb`** — 2.5 MB uncompressed (no Draco / meshopt / KTX2),
      larger than the entire JS bundle, and on the hero path once `NEXT_PUBLIC_HERO_MODE=avatar`.
      Ships dark by default so not urgent, but should land before that flag is flipped.
- [ ] Add web-vitals collection to Vercel Analytics dashboard (already has `@vercel/speed-insights`)
- [ ] Check LCP on `/?view=gamified` — 3D canvas should not be in critical path
- [x] ~~A/B the R3F twin-chunk lever on 16.3.0~~ — cancelled; resolved by the upgrade alone (#120)
- [x] ~~Coalesce per-chunk writes in `src/components/chat/use-chat.ts`~~ — done in **#122**

## Regression guards (cheap checks, silent failures otherwise)
Each of these fails *silently* — nothing type-checks or test-fails when they regress, the bundle
just quietly doubles.

- **R3F dedup depends on ONE resolved `three` version.** After any `three`/fiber/drei bump:
  `find node_modules/.pnpm -maxdepth 1 -name "three@*"` should show a single live version, and
  `WebGLRenderer` should grep to exactly one chunk. (Checked for Dependabot #118 → `three` 0.185.1
  preserves it: 1160 → 1164 KB, one copy.)
- **`src/lib/r3f.ts` is load-bearing.** The barrel gives the bundler one module-graph node for the
  R3F universe, which is the precondition 16.3.0's chunking exploits. Do not delete it on the
  theory that "16.3 handles this now" — that combination was never tested.
- **Each new `dynamic()` R3F boundary added a copy pre-16.3.0.** Measured on the avatar branch
  (#103): a third boundary took 16.2.9 from 2 copies / 2036 KB to 3 copies / 2988 KB, while the
  same branch on 16.3.0 collapses to 1 copy / 1236 KB.

## Evidence & analysis
*(link signals and docs here as they accumulate)*

## Metrics
- Bundle size: `.next/analyze/` (generated with `ANALYZE=true pnpm build`)
- Core Web Vitals: Vercel Speed Insights dashboard
- R3F chunk count: `find .next -name "*.js" | xargs grep -l "react-three" | wc -l`

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
