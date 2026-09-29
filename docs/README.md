---
kind: schema-readme
---

# docs/ — durable knowledge

One file per **doc**: something you learned, analyzed, or decided that you want to be findable
later. If a signal is raw evidence, a doc is the worked-through version: an analysis, a writeup,
a decision and its rationale, a how-it-works note.

This README is the schema. See `ARCHITECTURE.md` for the model.

## Frontmatter

```yaml
---
kind: doc
domain: []                  # which loop(s) this belongs to
status: draft | adopted | superseded   # optional; use when a doc can be acted on or replaced
links: []                   # related artifacts, [[slug]] or paths
---
```

Optionally add a `type:` field (e.g. `analysis`, `decision`, `learning`) if you find yourself
wanting to filter docs by shape — but don't force it. Most docs are just knowledge.

## Body

Main text = *what's true now*. Append an optional `## Timeline` for *what happened*
(revisions, supersessions, when a decision was revisited). Link liberally with `[[slug]]`.

## Naming

`<short-kebab-slug>.md` or `<TOPIC>-<YYYY-MM>.md` — whatever reads well and sorts sensibly.

## Existing Docs

| File | Description |
|------|-------------|
| `configuration.md` | Environment variables, feature flags, and provider configuration |
| `index/` | Per-file/per-route codebase index. Describes `main` @ `a929932` (v3.6.0) plus five post-`a929932` behaviour changes; CI re-checks its `path:line` citations (`scripts/check-index-citations.mjs`). Start at `index/README.md` |
| `superpowers/plans/` | 17 dated implementation plans (one per shipped change) |
| `superpowers/specs/` | 6 dated design specs |
| `next-upgrade-plan-2026-09.md` | Draft (`status: draft`) upgrade plan synthesized from 10 research streams run 2026-09-18: model chain, prompt caching, Next/React/R3F currency, rate-limit resilience, bundle budget, CI tooling. Some items are already marked shipped |
