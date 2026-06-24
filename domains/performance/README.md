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
Monitor for R3F twin-chunk dedup regression — turbopack emits two copies of R3F on dynamic()
boundary (known platform limitation, tracked as upstream blocker).

## Backlog
- [ ] Run `ANALYZE=true pnpm build` and check `.next/analyze/` for any new large chunks
- [ ] Verify AnvilCoreSurface lazy-load is still saving ~148KB per page (shipped v2.6.0-B)
- [ ] Track R3F twin-chunk dedup — blocked on turbopack chunk config API (upstream)
- [ ] Add web-vitals collection to Vercel Analytics dashboard (already has `@vercel/speed-insights`)
- [ ] Check LCP on `/?view=gamified` — 3D canvas should not be in critical path

## Evidence & analysis
*(link signals and docs here as they accumulate)*

## Metrics
- Bundle size: `.next/analyze/` (generated with `ANALYZE=true pnpm build`)
- Core Web Vitals: Vercel Speed Insights dashboard
- R3F chunk count: `find .next -name "*.js" | xargs grep -l "react-three" | wc -l`

## Known constraints (upstream blocked)
- **PPR/cacheComponents**: `runtime="nodejs"` incompatible on 9 API routes — waiting for Next.js fix
- **R3F twin-chunk**: turbopack emits one copy per `dynamic()` boundary — needs turbopack chunk config API
- **ESLint 10**: `eslint-config-next` uses removed `getFilename()` — waiting for Next.js fix

## Timeline
2026-06-24 | bootstrap — domain charter created; v2.6.0-B shipped AnvilCoreSurface lazy-load (~148KB saved)
