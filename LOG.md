# Anvilry — Activity Log

Append-only journal of finished work, so anyone (human or agent) can catch up fast.
Newest first. Append an entry above older entries whenever a bulk of work wraps (ideally right
before the commit that ships it). Keep entries SHORT: header line + What + Refs, nothing else.

**Entry grammar** (strict, one header line per entry):
```
## YYYY-MM-DD · Short title · #tag1 #tag2
What: 1-2 lines, outcome first.
Refs: [doc](path) (new|updated), repo PR/commit links.
```

**Tags** (reuse before inventing):
#feature #fix #content #seo #performance #a11y #harness #loop #research #release #docs

**Retrieval recipes** (macOS; entry headers always start `## 20`):
```bash
# index of all entries (one line each)
grep '^## 20' LOG.md
# last 5 entries, full
tail -r LOG.md | awk '{print} /^## 20/{c++; if(c==5) exit}' | tail -r
# all entries about a topic
awk '/^## 20/{p=/#seo/} p' LOG.md
# entries from a month
awk '/^## 20/{p=/^## 2026-06/} p' LOG.md
```

---

## 2026-08-15 · v3.4.0 released to production · #release #performance
What: Promoted 64 commits to main as v3.4.0 (Next 16.3.0, cacheComponents, hero avatar, chat streaming coalescing, GLB -59%). The direct develop→main promotion was UNMERGEABLE — a binary add/add on public/avatar/sairam.glb, because the merge-base contains no GLB (main got the 2.55 MB original via #115, develop the 1.055 MB compressed one via #124); resolved on release/v3.4.0 in develop's favour. Production verified: all routes 200, correct content types, HIT/PRERENDER on statics, /notes still 404 (flag off), hero renders HeroGraph (production default), GLB etag matches the compressed asset.
Refs: PR #126 (release/v3.4.0 → main, 67 commits), commit 02d1ba7. Version 3.3.0 → 3.4.0; CHANGELOG entry added after a 13-release gap. A pre-release audit (5 dimensions, adversarially verified) refuted 12 of 14 findings and confirmed 2 — the unmergeable promotion, and that c6fd3e2's doc closure never landed before #119 merged.

---

## 2026-08-15 · cacheComponents enabled; Next 16.3.0 resolves R3F twin-chunk (−876 KB) · #performance #docs
What: Enabled `cacheComponents` by migrating all 26 rejected route segment configs — the long-standing "upstream blocked, needs a per-route escape hatch" claim was false, and the inventory said 9 configs when the real count was 26 (confirmed empirically: the build failed with exactly 26 errors). The 16.3.0 upgrade separately resolved the R3F twin-chunk with no experimental flags: 2036 KB / 5 chunks (two 876 KB copies) → 1160 KB / 4 chunks (one copy), −876 KB (−43%), verified by `WebGLRenderer` appearing in exactly one chunk.
Refs: PRs #119 (docs correction), #120 (16.3.0, supersedes Dependabot #113), #121 (cacheComponents, stacked on #120); commits be9105f, 89cbba1, 91dbdc9. Rationale for rejecting `turbopackChunking`/`turbopackSharedRuntime` recorded in `next.config.ts`.

---

## 2026-06-24 · Loop-engineer harness bootstrapped · #harness #loop
What: Added AI-Builder-Club loop-engineer skills (.claude/skills/), ship-change.js workflow, Playwright E2E suite (e2e/views.spec.ts), and knowledge base (ARCHITECTURE.md, LOG.md, signals/, docs/, domains/).
Refs: feat/loop-engineer-skills branch, commit bf2038d (skills + e2e).

---
