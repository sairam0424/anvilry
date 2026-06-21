# Community Health Files — Design Spec

**Date:** 2026-06-22  
**Project:** Anvilry (`github.com/sairam0424/anvilry`)  
**Status:** Approved

---

## Context

Anvilry is a personal engineering portfolio — not a library or reusable template. It is public on GitHub so recruiters and other engineers can read the code, but the content (work history, metrics, identity) is not intended for reuse. The goal of these files is to complete GitHub's Community Standards checklist, communicate clearly what kinds of contributions are welcome, and protect the owner's content and identity.

## Files to Create

| File | Notes |
|---|---|
| `LICENSE` | MIT for code + explicit carve-out for all personal content |
| `SECURITY.md` | Private disclosure via email, 48h ack SLA |
| `CODE_OF_CONDUCT.md` | Contributor Covenant v2.1 |
| `.github/CONTRIBUTING.md` | Personal-portfolio tone — bugs welcome, content PRs not |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Structured form: URL, browser, steps, expected/actual |
| `.github/PULL_REQUEST_TEMPLATE.md` | Minimal: what it fixes, which views tested |

## License Decision

**Source-available split:**
- MIT applies to code structure, components, and configuration files
- Explicit exclusion: all content in `content/`, `src/lib/profile.ts`, all résumé PDFs in `public/resume/`, and all personal branding assets

## Out of Scope

No `FUNDING.yml`, no feature request template, no discussion templates.
