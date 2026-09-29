---
kind: domain
domain: content
status: active
goal: Keep the portfolio content fresh, consistent, and discoverable
cadence: weekly
---

# content — portfolio freshness loop

Monitors and improves MDX content across work case studies, OSS projects, notes, and articles.
Consumes the Velite content output, the bijection test results and the weekly `/api/cron/content-audit` report. Produces updated MDX files,
new case studies, and signals flagging stale or incomplete entries.

## Current focus
All five Work entries now carry `constraints` and `tradeoffs` (`register` and `metrics` are required by the Velite schema).
The remaining hiring-manager-depth gap is `diagram` / `diagramAlt`, which no Work entry has yet.

## Backlog
- [ ] Audit `content/work/*.mdx` for thin or stale `metrics` arrays (the field is required, so the risk is content rot, not absence)
- [ ] Audit `content/projects/*.mdx` for stale optional `commits` / `dateCreated` / `license` values (`excerpt` and `repo` are required; there is no `description` or `url` field, `url` is derived from the slug)
- [ ] Check for orphaned graph nodes (run `pnpm test` — `game-model.test.ts` catches these)
- [ ] Add `diagram` / `diagramAlt` to at least 2 Work entries
- [ ] Write note on extended thinking / THINKING_SENTINEL protocol (new in v2.3.0)

## Evidence & analysis
*(link signals and docs here as they accumulate)*

## Metrics
- Content item counts: `work`, `projects`, `notes`, `articles` (via `pnpm content`)
- Bijection test: `game-model.test.ts` pass/fail
- Fields completeness: Work items with `diagram` + `diagramAlt` filled (0 of 5 today); `constraints` / `tradeoffs` are complete
- `/api/cron/content-audit` (weekly): articles and notes older than 18 months, surfaced on the dashboard's Stale content tile. Notes ship dark (`NEXT_PUBLIC_NOTES_ENABLED`), so while they are hidden the audit cannot flag a stale note (`allNotes` is empty)

## Timeline
2026-06-24 | bootstrap — domain charter created, backlog seeded from known gaps
2026-09-29 | docs drift pass — checked against main @ a929932 + five fixes: constraints/tradeoffs done on all 5 Work entries, diagram/diagramAlt on none; Project frontmatter fields corrected (`excerpt`/`repo`, no `description`/`url`); notes are hidden at the data layer while dark, so the audit skips them
