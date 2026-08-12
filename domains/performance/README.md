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
Two tracks, both unblocked as of the 2026-08-12 correction below:
1. **cacheComponents migration** — reclassified from "upstream blocked" to ours-to-do (26 segment
   configs / 22 files). Gated on a 16.3.0 upgrade.
2. **R3F twin-chunk** — still genuinely unresolved upstream, but there is now an untestable-until-16.3.0
   lever worth an A/B. Measured baseline: 2 × 876 KB chunks, ~1.75 MB duplicated.

## Backlog
- [ ] Run `ANALYZE=true pnpm build` and check `.next/analyze/` for any new large chunks
- [ ] Verify AnvilCoreSurface lazy-load is still saving ~148KB per page (shipped v2.6.0-B)
- [ ] A/B the R3F twin-chunk lever on 16.3.0 (`turbopackChunking: { minChunkSize: 0 }` +
      `turbopackSharedRuntime: true`) — record before/after even if it produces no win
- [ ] Coalesce per-chunk writes in `src/components/chat/use-chat.ts` (~L146-188) — currently re-parses
      the whole accumulated string and re-renders per network chunk, so cost grows with message length
- [ ] Add web-vitals collection to Vercel Analytics dashboard (already has `@vercel/speed-insights`)
- [ ] Check LCP on `/?view=gamified` — 3D canvas should not be in critical path

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

- **PPR / `cacheComponents`** — *not upstream-blocked; ours to do.* The RSC transform rejects the
  **presence** of `export const runtime`, never its value (`react_server_components.rs`, verified at tag
  v16.2.9; Next's own e2e test asserts the build fails). `nodejs` is already the default and Cache
  Components *requires* it — only `edge` is unsupported. So the exports are redundant and the fix is
  **deletion**. No per-route escape hatch exists or is planned (`cacheComponents` is a plain boolean);
  `instant = false` defers validation, not this check. Real scope is **26 configs / 22 files**
  (13 `runtime` → delete · 4 `revalidate` → need `"use cache"` + `cacheLife` · 9 `force-dynamic` →
  investigate first, they work around the `[param].ext` params gap, not caching). `maxDuration` survives.
  Prerequisite: **16.3.0**.

- **R3F twin-chunk** — *genuinely unresolved upstream.* Confirmed real by measurement: two chunks of
  **876 KB each** both containing `react-three`/`THREE.` (~1.75 MB duplicated) across **16 `dynamic()`
  boundaries**. `experimental.turbopackChunking` did ship in stable **16.3.0**, but it is a set of
  size/merge thresholds, **not** a dedup primitive — zero mentions of three/R3F across the PR's 29
  changed files, and neither it nor `turbopackSharedRuntime` exists in the installed 16.2.9.
  Upstream request is [vercel/next.js#96040](https://github.com/vercel/next.js/discussions/96040)
  (still OPEN; reproductions at 2.08 copies/module vs webpack's 1.00). Untested lever worth an A/B:
  `turbopackChunking: { minChunkSize: 0 }` + `turbopackSharedRuntime: true` — never tested against
  three.js, and the `src/lib/r3f.ts` barrel (commit `f7c5110`) may already have captured most of the win.
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
