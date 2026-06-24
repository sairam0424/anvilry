---
kind: domain
domain: content
status: active
goal: Keep the portfolio content fresh, consistent, and discoverable
cadence: weekly
---

# content — portfolio freshness loop

Monitors and improves MDX content across work case studies, OSS projects, notes, and articles.
Consumes the Velite content output and the bijection test results. Produces updated MDX files,
new case studies, and signals flagging stale or incomplete entries.

## Current focus
Ensure all Work entries have `register`, `metrics`, and `constraints`/`tradeoffs` fields filled —
these render hiring-manager depth and are currently optional but incomplete on older entries.

## Backlog
- [ ] Audit all `content/work/*.mdx` for missing `metrics` fields
- [ ] Audit all `content/projects/*.mdx` for missing `description` or `url` fields
- [ ] Check for orphaned graph nodes (run `pnpm test` — `game-model.test.ts` catches these)
- [ ] Add `diagram` / `diagramAlt` to at least 2 Work entries
- [ ] Write note on extended thinking / THINKING_SENTINEL protocol (new in v2.3.0)

## Evidence & analysis
*(link signals and docs here as they accumulate)*

## Metrics
- Content item counts: `work`, `projects`, `notes`, `articles` (via `pnpm content`)
- Bijection test: `game-model.test.ts` pass/fail
- Fields completeness: % of Work items with `metrics` and `register` filled

## Timeline
2026-06-24 | bootstrap — domain charter created, backlog seeded from known gaps
