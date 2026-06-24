---
kind: schema-readme
---

# signals/ — evidence

One file per **signal**: a piece of feedback, an idea, or an observation worth remembering.
Signals are **deduped and frequency-counted** — when the same thing shows up again, you don't
make a new file, you add a Timeline entry to the existing one and bump `frequency`.

This README is the schema. See `ARCHITECTURE.md` for the model.

## Frontmatter

```yaml
---
kind: signal
category: feedback | idea | friction | observation   # what sort of signal
frequency: 1                # how many times seen; increment on recurrence
sources: []                 # where it came from (links, ticket IDs, urls)
domain: []                  # which loop(s) this feeds — a list of domain names
status: open | reviewed | closed
---
```

## Body

A short statement of the signal (what, and why it matters), then an optional append-only
`## Timeline` accumulating each sighting:

```
## Timeline
2026-06-24 | initial observation — noted during harness bootstrap
```

`frequency` = number of Timeline entries. Link related artifacts with `[[slug]]`.

## Naming

`<short-kebab-slug>.md`, or a stable id like `SIG-<n>.md` if you prefer running numbers.

## Anvilry Signal Domains

Signals in this repo map to the following domain loops:

- `content` — MDX freshness, missing case studies, stale metrics, authorship gaps
- `seo` — crawl issues, missing structured data, canonical gaps, llms.txt staleness
- `performance` — bundle regressions, slow routes, Core Web Vitals drops, LCP issues
