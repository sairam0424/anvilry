---
kind: doc
title: Docs, Knowledge Base & Agent Harness
domain: [content]
status: current
version: v3.5.0
---

# Docs, Knowledge Base & Agent Harness

> Part of the Anvilry v3.5.0 codebase index. Master entry point: [docs/index/README.md](./README.md)

**Scope:** `README.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `AGENTS.md`, `CHANGELOG.md`, `LOG.md`, `VOICE.md`,
`TELEMETRY.md`, `DEPLOY.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `docs/README.md`,
`docs/configuration.md`, `docs/superpowers/plans/*.md` (14), `docs/superpowers/specs/*.md` (5),
`domains/README.md`, `domains/{content,seo,performance}/README.md`, `signals/README.md`,
`.claude/skills/*/SKILL.md` (5), `.claude/skills/new-loop/references/*` (4),
`.claude/workflows/ship-change.js`, `.claude/proven-config.json`, `.claude/.proven-config-version`,
plus an appendix for the parent-directory wrappers `../PLAN.md`, `../RESEARCH.md`, `../.aava/`, `../.claude-flow/`.
**Files indexed:** 59

## At a glance

| File | Role | Key exports / anchors |
|---|---|---|
| `README.md` | Public-facing project pitch: "a beast with **four switchable experiences** over one canonical content source" (`README.md:5`) — marketing framing, not the store shape; the `View` union has **six** members and "four-view" describes only the default server-rendered pill set (`CLAUDE.md:98`). Plus highlights, stack table, develop/content/chat/voice/deploy quickstarts. Its terminal-command count was corrected to **31** on this branch (`README.md:10`). | §Highlights, §Stack, §Develop, §Chatbot configuration, §Voice, §Deploy |
| `CLAUDE.md` | Agent operating brief: commands, Makefile targets, branch/CI model, architecture overview, key-files table, env vars, testing notes, skills + knowledge-base pointers. | §Commands, §Branch Model & CI, §Architecture Overview, §Key Files, §Testing Notes, §Skills |
| `ARCHITECTURE.md` | Knowledge-base architecture decision record: the `signal`/`doc` kind model, domains-as-loops, repo map, key invariants. Frontmatter `kind: architecture`, `status: adopted`. Its `**Product:**` line was corrected on this branch — it used to say "4-view system"; it now records that the `View` union has **six** members and defers to `CLAUDE.md` → "The View System" (`ARCHITECTURE.md:17`). | §The model, §Kinds, §Domains (active loops), §Repo layout, §Key invariants |
| `AGENTS.md` | 5-line Next.js-version warning wrapped in `<!-- BEGIN:nextjs-agent-rules -->` markers; points agents at `node_modules/next/dist/docs/`. | (no headings beyond the single H1) |
| `CHANGELOG.md` | Keep-a-Changelog release history, **18** released version entries, newest first, plus a live `[Unreleased]` section (`CHANGELOG.md:7`) holding the pnpm 11 `allowBuilds` fix. The previous `[Unreleased]` block was cut as `[3.5.0] — 2026-08-21` (`CHANGELOG.md:41-143`). | `[3.5.0]`, `[3.4.2]` … `[1.0.0]`, link-ref footer |
| `LOG.md` | Append-only activity journal, newest first, with a strict entry grammar, tag vocabulary, and grep/awk retrieval recipes. | §Entry grammar, §Tags, §Retrieval recipes, 3 entries |
| `VOICE.md` | Canonical voice-layer reference (940 lines): architecture, 4 opt-in features, settings/flag tables, env+IAM+cost, privacy & a11y model, developer notes, v1.7 voice picker. | §1 Overview, §2 Features, §3 Flags/Settings, §4 Env/IAM/Cost, §5 Privacy & A11y, §6 Dev Notes, §7 Voice picker |
| `TELEMETRY.md` | Canonical observability reference (v1.8 header): dual-sink pipeline, `TelemetryEvent` schema, 7 span kinds, trace-ID correlation, PII policy, admin dashboard, replay CLI, debugging cookbook, file map. | §1–§9 |
| `DEPLOY.md` | Vercel production deploy guide: import, env-var table, Upstash rate-limit setup, verified Bedrock chain + IAM policy, custom domain, verify checklist, gotchas. | §0–§6 |
| `SECURITY.md` | Responsible-disclosure policy: in/out-of-scope list, private email reporting, 48h ack / 7-day critical SLA, no bounty. | §Scope, §Reporting |
| `CODE_OF_CONDUCT.md` | Contributor Covenant v2.1 verbatim, maintainer named as sole enforcer, scoped to Issues/PRs/Discussions. | §Our Pledge … §Attribution |
| `LICENSE` | MIT (2024–2026 Sairam Ugge) **plus** a CONTENT EXCLUSION carve-out reserving all rights on `content/`, `src/lib/profile.ts`, `public/resume/`, branding assets. | MIT body, `CONTENT EXCLUSION` |
| `docs/README.md` | Schema README for the `doc` kind — frontmatter shape, body convention (main text + optional `## Timeline`), naming. Frontmatter `kind: schema-readme`. | §Frontmatter, §Body, §Naming, §Existing Docs |
| `docs/configuration.md` | Single source of truth for every env var + feature flag (17 numbered sections), how-to-add-a-flag recipes, per-route CSP note, per-environment matrix, and a "files that read env vars" map. | §1–§17, §Security Headers, §Files That Read Environment Variables |
| `docs/superpowers/plans/2026-06-13-terminal-dev-mode.md` | 867-line task-by-task plan: promote the Play-view terminal into "Developer Mode" via a pure command registry, 5 phases / 15 tasks. | Phases 1–5, Tasks 1–15 |
| `docs/superpowers/plans/2026-06-18-vercel-flags-sdk.md` | Plan to migrate `NEXT_PUBLIC_DISCOVERY_BADGES` to the Vercel Flags SDK behind a `FLAG_DRIVER` switch; 6 tasks + post-merge dashboard wiring. | Tasks 1–6, §Post-merge |
| `docs/superpowers/plans/2026-06-23-c1-directional-transitions.md` | Plan: stamp `data-view-dir` on `<html>` before `startViewTransition`; directional slide keyframes in `globals.css`. 2 files, 3 tasks. | Tasks 1–3 |
| `docs/superpowers/plans/2026-06-23-c2-motion-audit.md` | Plan: audit the 140 KB `motion/react` bundle; replace `useReducedMotion` in shared primitives with a native hook. 3 tasks. | Tasks 1–3 |
| `docs/superpowers/plans/2026-06-23-c3-r3f-chunk-dedup.md` | Plan: collapse the twin 876 KB R3F chunks — Option A `optimizePackageImports`, Option B `src/lib/r3f.ts` barrel. 4 tasks. | Tasks 1–4 |
| `docs/superpowers/plans/2026-06-23-c4-r3f-physics.md` | Plan: add `@react-three/rapier` physics behind `NEXT_PUBLIC_GRAPH_PHYSICS`, via a separate `scene-physics.tsx`. 4 tasks. Unchanged history, and still accurate *about the plan* — but note the outcome: the dependency was installed, `scene-physics.tsx` shipped as plain sinusoidal `useFrame` maths instead, rapier was never imported, and the package was **removed in v3.5.0** (`CHANGELOG.md:139-143`). The flag and filename are the only residue. | Tasks 1–4 |
| `docs/superpowers/plans/2026-06-23-v2.3.0-ai-transparency.md` | 1034-line plan: Anthropic extended thinking — `THINKING_SENTINEL`, server-buffered `thinking_delta`, `reasoning` in the trace frame, `ThinkingBlock` UI. 6 tasks. | Tasks 1–6, §Self-Review |
| `docs/superpowers/plans/2026-06-23-v2.4.0-performance-ppr.md` | Plan: enable `cacheComponents: true` and migrate 5 page/special routes; 9 API routes explicitly untouched. 7 tasks. | Tasks 1–7 |
| `docs/superpowers/plans/2026-06-23-v2.6.0-a11y-bundle.md` | Plan: fix WCAG 4.1.2 on the terminal input (`role="combobox"` + always-rendered listbox) + a read-only bundle audit. 3 tasks. | Tasks 1–3 |
| `docs/superpowers/plans/2026-06-27-add-tombstone-trelix-inkforge.md` | Plan: add 3 project MDX files + 3 graph nodes + 3 `NODE_CONTENT` entries + 3 article cross-links; the bijection test is the gate. 7 tasks. | Tasks 1–7, §File Map Summary |
| `docs/superpowers/plans/2026-06-28-visitor-counter-redis-fallback.md` | Plan: localStorage-cached visitor badge so a Redis-unavailable `total: 0` falls back to the last-known count. 2 tasks, 6 DOM tests. | Tasks 1–2 |
| `docs/superpowers/plans/2026-06-30-resume-single-master-toggle.md` | 873-line plan: single "Sairam Resume" master default, PDF/Web toggle, `NEXT_PUBLIC_RESUME_VARIANTS` gate, `ResumeViewInline`, `e2e/resume.spec.ts`. 4 tasks. | Tasks 1–4, §Flag behaviour matrix |
| `docs/superpowers/plans/2026-07-01-hero-avatar-tier1.md` | 1227-line plan: cursor-reactive hero avatar — 6 new files under `src/components/hero-avatar/`, `computeGaze`/`computeIdle` pure fns, flag routing, GLB asset task. 8 tasks. | Tasks 1–8, §Self-Review |
| `docs/superpowers/plans/2026-07-06-content-refresh-trelix-tombstone-articles.md` | Plan: bump trelix/tombstone commit counts, add 3 article cross-links, fix the `/resume` PDF-iframe CSP `frame-ancestors` bug. 4 tasks + pre-computed dedup analysis. | §Dedup Analysis, Tasks 1–4 |
| `docs/superpowers/specs/2026-06-13-terminal-dev-mode-design.md` | Design spec behind the terminal plan: 4 locked owner decisions, why-not-xterm.js, ~14-command spec table, a11y non-negotiables, phased build, non-goals. | §Locked decisions, §Architecture, §Command spec, §Non-goals |
| `docs/superpowers/specs/2026-06-22-community-health-files-design.md` | 32-line spec for the community-health file set (LICENSE / SECURITY / CoC / CONTRIBUTING / templates) + the source-available license split. Status: Approved. | §Files to Create, §License Decision, §Out of Scope |
| `docs/superpowers/specs/2026-06-23-anvilry-v2.3-v2.5-upgrade-design.md` | Three-phase design: v2.3.0 AI transparency, v2.4.0 PPR, v2.5.0 discoverability (per-page `.md` routes + `DefinedTerm` JSON-LD). | Phases 1–3, §File Change Summary |
| `docs/superpowers/specs/2026-06-23-cycle-c-upgrades-design.md` | Cycle-C design: C-1 directional transitions, C-2 motion audit, C-3 R3F dedup, C-4 Rapier physics. Records the `VIEW_ORDER` 0–5 nav order. | Phases C-1…C-4 |
| `docs/superpowers/specs/2026-07-01-hero-avatar-design.md` | Hero-avatar design spec: two flags, 6-file architecture, ReadyPlayerMe GLB + ARKit morph-target requirements, gaze/idle algorithms, 3 layout wrappers, perf constraints. | §Feature Flags, §Architecture, §Model, §Component Interfaces, §Out of Scope |
| `domains/README.md` | Schema README for the `domain` kind: what a loop is, the domain README template, the Timeline-as-run-log rule, "don't create domains by hand — run `/new-loop`". | §Domain README template, §Anvilry Domains |
| `domains/content/README.md` | Content-freshness loop charter (`status: active`, `cadence: weekly`). 5 backlog items, 3 metrics, 1 Timeline entry. | §Current focus, §Backlog, §Metrics, §Timeline |
| `domains/seo/README.md` | Discoverability loop charter (weekly). Contains the 2026-08-12 correction removing llms.txt as an organic-reach mechanism, and a "no separate GEO/AEO discipline" ruling. | §llms.txt correction, §No separate GEO/AEO, §Backlog, §Timeline |
| `domains/performance/README.md` | Web-vitals loop charter (`cadence: on-pr`). The richest domain file: closed cacheComponents + R3F tracks, 4 silent-failure regression guards, 3 known constraints, verified-current CWV facts. | §Current focus, §Regression guards, §Known constraints, §Verified-current facts, §Timeline |
| `signals/README.md` | Schema README for the `signal` kind: frontmatter (`category`, `frequency`, `sources[]`, `domain[]`, `status`), `frequency` = Timeline-entry count, Anvilry signal domains. | §Frontmatter, §Body, §Naming, §Anvilry Signal Domains |
| `.claude/skills/dev-local/SKILL.md` | Anvilry-specific dev-stack launcher skill: port map, prerequisites, `up`/`verify`/`content`/`test`/`build` command blocks. `user_invocable: true`. | frontmatter `name: dev-local`, §Commands, §Notes |
| `.claude/skills/e2e-setup/SKILL.md` | Generic skill for standing up a trustworthy E2E gate: where it lives, the 4-step recipe, trust practices, failure triage, external-service sandbox rules. | frontmatter `name: e2e-setup`, §The recipe, §Practices, §When a test fails |
| `.claude/skills/pr/SKILL.md` | Verify-before-ship skill: fresh read-only verifier sub-agent drives the app, then regression sweep, then PR with a reviewable proof link. 5 numbered steps + rules. | frontmatter `name: pr`, §1–§5, §Rules |
| `.claude/skills/new-loop/SKILL.md` | Skill that scaffolds a new `domains/<name>/README.md`, does ONE real test run, and records it in the loop Timeline + `LOG.md`. 4-step procedure, 5 inputs. | frontmatter `name: new-loop`, §Inputs, §Procedure, §Notes |
| `.claude/skills/setup-codebase-harness/SKILL.md` | Master orchestrator skill: legible / executable / verifiable pillars, plus commit hygiene + entropy control; declares the sub-skill order 1a → 2 → 3 → 1b → 4. | frontmatter `name: setup-codebase-harness`, §0 Assess, §1–§4, §Order |
| `.claude/skills/new-loop/references/ARCHITECTURE.md` | The generic knowledge-base ADR template `new-loop` instantiates — includes the "earning a new kind" bar, deferred-features table, 6 rejected options, and a where-things-live map. | §The model, §Earning a new kind, §Deferred, §Options considered, §Map |
| `.claude/skills/new-loop/references/CLAUDE.template.md` | `{{PLACEHOLDER}}` CLAUDE.md scaffold for a fresh knowledge-base repo (identity, current state, voice, data/tooling, KB block, worktree discipline). | §What it is, §Knowledge base, §When spawning agents |
| `.claude/skills/new-loop/references/KNOWLEDGE_SETUP.md` | One-time idempotent bootstrap procedure + verbatim copy blocks for `signals/README.md`, `docs/README.md`, `domains/README.md`, and the CLAUDE.md knowledge-base section. | §Procedure, 3 verbatim README blocks, §CLAUDE.md section |
| `.claude/skills/new-loop/references/LOG.md` | Empty `LOG.md` seed template (grammar, tags, retrieval recipes). Says **"Newest at the BOTTOM"** — the repo's own `LOG.md` is newest-first. | header block |
| `.claude/workflows/ship-change.js` | The `ship-change` workflow — 6 declared phases driving `agent()` calls with JSON schemas; creates an isolated worktree, implements, simplifies, reviews, verifies, PRs. | `meta` (exported), `phases[]`, `SETUP_SCHEMA`, `IMPL_SCHEMA`, `SIMP_SCHEMA`, `REVIEW_SCHEMA`, `VERIFY_SCHEMA`, `PR_SCHEMA` |
| `.claude/proven-config.json` | Ruflo `proven-config/v1` manifest: adopted champion policy hash, 5 retrieval tuning weights, benchmark corpus hash, canary receipt. Not read by any app code. | `adoptedAt`, `championId`, `manifest.policy.value`, `manifest.receipt` |
| `.claude/.proven-config-version` | One-line pointer: the `sha256:6141a8…` champion id that `proven-config.json` currently holds. | (single line) |
| `../PLAN.md` | **Appendix (outside repo).** Original pre-build implementation plan for "sairam.dev" — Next.js **15**, M0→M5 milestones, 2 case studies / 8 OSS repos. Historical. | §0 Principles … §10, §Open choices |
| `../RESEARCH.md` | **Appendix.** The adversarially-verified research blueprint the plan was derived from (107 agents, 25 sources, 18 confirmed / 7 refuted), with ✅/❌/⚠️ vote annotations. | §TL;DR, §Architecture, §Design & UX, §Performance, §A11y, §Standout, §Research gaps |
| `../.aava/AAVA.md` | **Appendix.** 14-line "Aava Project Constitution": memory-first, atomic topics, atomic commits, lint guard. | §1 Architectural Integrity, §2 Development Workflow |
| `../.aava/AGENTS.md` | **Appendix.** Aava learned-patterns registry: memory-first protocol, 2 path/`NoneType` gotchas, Synthesize/Explore agent guidance. | §1–§3 |
| `../.aava/memory.md` | **Appendix.** Aava memory index — all three tiers recorded as empty ("No … topics recorded yet"). | §1–§3 |
| `../.aava/commands-skills/DISCOVERED_SKILLS.md` | **Appendix.** 197-line generated (24/06/2026) categorical index of workspace+system skills: `Skill \| Description \| Source \| Composes` tables per category. | §Advanced Development, §Advanced Workflows, §Build & Implementation, … |
| `../.aava/.gitignore` | **Appendix.** Two lines: `*` then `!.gitignore` — ignores the entire `.aava/` tree except itself. | — |
| `../.claude-flow/neural/stats.json` | **Appendix.** 4-key counter blob: `trajectoriesRecorded: 2`, `patternsLearned: 2`, `signalsProcessed: 2`, `lastAdaptation` epoch-ms. | — |
| `../.claude-flow/policy/state.json` | **Appendix.** Ruflo policy ledger, `"mode": "legacy"`, empty `rules`/`budgets`/`usage`/`approvals`, plus hash-chained `receipts[]` for `mcp.tool.call` decisions. | `version`, `mode`, `receipts[]` |

## Doc-purpose map

`mtime` is a weak signal here — a large block of files shares `28 Jun 01:31` (a bulk move), so the in-document
version marker is the better freshness cue. Both are given.

The mtimes below were read at `release/v3.4.2`. The correctness pass on this branch rewrote
`CLAUDE.md`, `ARCHITECTURE.md`, `DEPLOY.md`, `README.md`, `CHANGELOG.md` and `docs/README.md`, so those six
rows' mtimes are now newer than listed — and their *content* is what §Doc-vs-code drift below describes as
corrected. The version markers are unchanged.

| File | Kind | Authoritative for | Last-updated signal |
|---|---|---|---|
| `README.md` | public readme | The outward-facing pitch, stack table, voice cost table | mtime 28 Jun; no version marker |
| `CLAUDE.md` | agent brief | Command surface, branch/CI model, key-files map, testing invariants, skills index | mtime 15 Aug |
| `ARCHITECTURE.md` | ADR (`kind: architecture`, `status: adopted`) | The knowledge-base model (kinds, domains, invariants) — **not** app architecture | in-doc `**Version:** v1.0.0 — bootstrapped 2026-06-24`; mtime 28 Jun |
| `AGENTS.md` | agent rule block | Only the "this is not the Next.js you know" warning | mtime 11 Jun (oldest file in scope) |
| `CHANGELOG.md` | release log | Per-release narrative; 18 tags | latest entry `[3.5.0] — 2026-08-21` (`CHANGELOG.md:41`); rewritten in v3.5.0 |
| `LOG.md` | activity journal | Finished-work feed + its own entry grammar | newest entry 2026-08-15; mtime 15 Aug |
| `VOICE.md` | feature reference | Voice architecture, settings keys, IAM, privacy/a11y model, voice catalog | in-doc `v1.7 update` banner; mtime 28 Jun |
| `TELEMETRY.md` | feature reference | Span kinds, PII policy, dashboard tiles, replay CLI | in-doc title `(v1.8)`; mtime 28 Jun |
| `DEPLOY.md` | runbook | Vercel env-var table, IAM policy JSON, Upstash setup, region gotcha | mtime 28 Jun; no version marker |
| `SECURITY.md` | policy | Disclosure channel + SLA + scope | mtime 28 Jun |
| `CODE_OF_CONDUCT.md` | policy | Contributor Covenant v2.1 adoption + enforcement contact | mtime 28 Jun |
| `LICENSE` | legal | MIT for code; all-rights-reserved carve-out for content/identity/résumés/branding | copyright range `2024–2026`; mtime 28 Jun |
| `docs/README.md` | schema readme | The `doc` frontmatter schema | rewritten on this branch; `§Existing Docs` now tables the four real entries (`docs/README.md:36-43`) — it used to say "none yet" |
| `docs/configuration.md` | config reference | Every env var + flag, defaults, add-a-flag recipes, CSP override | mtime 15 Aug; flags tagged up to `v3.3` |
| `docs/superpowers/plans/*` (14) | point-in-time plans | What was *intended* on the plan's date — **not** current-state assertions | filename dates 2026-06-13 → 2026-07-06 |
| `docs/superpowers/specs/*` (5) | point-in-time design specs | Locked decisions + rejected alternatives for their feature | filename dates 2026-06-13 → 2026-07-01 |
| `domains/README.md` | schema readme | The `domain` frontmatter + README template | mtime 28 Jun |
| `domains/content/README.md` | loop charter | Content-freshness goal, backlog, metrics | Timeline ends 2026-06-24; mtime 28 Jun |
| `domains/seo/README.md` | loop charter | SEO goal + the llms.txt and GEO/AEO rulings | Timeline ends 2026-08-12; mtime 15 Aug |
| `domains/performance/README.md` | loop charter | Bundle/CWV baselines, regression guards, tooling constraints | Timeline ends 2026-08-15; mtime 15 Aug |
| `signals/README.md` | schema readme | The `signal` frontmatter + dedup/frequency rule | mtime 28 Jun; **zero signal files exist** |
| `.claude/skills/*/SKILL.md` (5) | agent skills | Their own trigger phrases + procedures | all mtime 28 Jun |
| `.claude/skills/new-loop/references/*` (4) | skill templates | The generic KB substrate `new-loop` copies in | all mtime 28 Jun |
| `.claude/workflows/ship-change.js` | workflow script | Phase order + per-phase agent prompts/schemas | mtime 28 Jun |
| `.claude/proven-config.json` + `.proven-config-version` | tool state | Ruflo champion retrieval policy | mtime 20 Aug (newest in scope) |
| `../PLAN.md`, `../RESEARCH.md` | pre-build artifacts | The original brief + its verified research basis | mtime 11 Jun; both predate the shipped stack |
| `../.aava/*`, `../.claude-flow/*` | third-party tool state | Aava/Ruflo agent scaffolding — no app coupling | `.aava` generated 24 Jun; `.claude-flow` 20 Aug |

## Version history

Read in full from `CHANGELOG.md`. **18 released version tags** are present, plus a live `[Unreleased]`
section at `CHANGELOG.md:7`. The previous `[Unreleased]` block was cut as `[3.5.0] — 2026-08-21`
(`CHANGELOG.md:41-143`), covering six live defects and the documentation corrections listed in
§Doc-vs-code drift; the current one holds the pnpm 11 `allowBuilds` fix, which is deliberately
unversioned. **Count version tags with `grep -c '^## \[[0-9]'` (18) — a bare `grep -c '^## \['`
returns 19, because it also matches `[Unreleased]`.**

**Do not trust a stated line-shift here; re-derive it.** Prepending a release entry moves every line
below it, and the offset compounds across releases — `## [3.4.2]` has sat at line 7, then 111, then
145 across three index generations. A previous version of this paragraph carried a `+56` that could
not be reproduced from any two of those. The reliable check is
`node scripts/check-index-citations.mjs`, which fingerprints each cited line's content; the arithmetic
is not documentation, it is a stale intermediate. Note the gap: no `2.x` entry and no
`3.1.x`–`3.3.x` entry exists at all — `LOG.md:33` records that the 3.4.0 entry was "added after a
**13-release gap**", so the changelog is not a complete release ledger.

| Version | Theme |
|---|---|
| 3.5.0 (2026-08-21) | **Current.** Correctness pass, not a feature release: six live defects (dead MCP transport in `llms.txt`, two 404 PWA screenshots, `/mcp` documenting 7 of 9 tools, the health-check cron probing a Vercel SSO wall, `mcp_get`'s wrong expected status, `/api/visit`'s spoofable client IP); the per-file codebase index; pnpm settings migrated out of `package.json` into `pnpm-workspace.yaml`; `@react-three/rapier` + `@react-three/offscreen` removed. |
| 3.4.2 (2026-08-15) | Security patch: 23 Dependabot advisories across 10 packages (11 high) resolved; E2E wired into CI; Playwright made self-managing. |
| 3.4.1 (2026-08-15) | Patch: dependency bumps (react 19.2.8, Anthropic SDK ^0.116.0, lucide ^1.31.0, @types/three ^0.185.4) + repaired the permanently-red E2E suite; TS 7 / ESLint 10 held back. |
| 3.4.0 (2026-08-15) | Minor: Next 16.3.0, `cacheComponents: true` (26 segment configs migrated), hero avatar (ships dark), chat-streaming coalescing, GLB −59%, R3F twin-chunk resolved. |
| 3.0.1 (2026-06-25) | Patch: `/api/cron/health-check` (13 endpoints, 5am UTC) + "Site health" dashboard tile; Hobby-plan cron schedule fix; WARN-01 swallowed-warn fix. |
| 3.0.0 (2026-06-24) | Self-maintaining portfolio: 4-cron automation suite, observability dashboard expansion, AI-era SEO (`/llms-full.txt`, `safeJsonLd()`), 12 golden pairs, MCP 7→9 tools, perf pass. |
| 1.9.0 (2026-06-17) | "Beast Mode": terminal 404 page, `[[cmd:…]]` agent tokens, orb post-processing, persona-aware prompt, live GitHub stats, `?view=resume`, SVG skill tree, eval cron, web-vitals RUM. |
| 1.8.0 (2026-06-17) | Structured telemetry + AI request tracing + prompt-cache verification: `src/lib/telemetry/`, `llm.attempt` spans, `/api/error`, `/admin/telemetry`, `replay-trace.mjs`, `TELEMETRY.md`. |
| 1.7.0 (2026-06-16) | Voice-quality upgrade: voice catalog + `VoicePicker` + settings dialog, Polly Generative tier, Google Cloud TTS engine, character knobs, 16 platform pitfalls, voice-keyed TTS cache fix. |
| 1.6.0 (2026-06-16) | "Anvil" voice surface: always-on 5th voice view, in-place Siri header orb, "core" minimal mode, one-mic mutex, beast-while-speaking shader. |
| 1.5.0 (2026-06-15) | Streaming voice: speak-as-it-streams, audio-reactive R3F orb, captions toggle; fixed silent talk mode + per-answer speech counter + caption markdown leak. |
| 1.4.1 (2026-06-15) | Security: CSP promoted from `Report-Only` to enforced with an unchanged policy string. |
| 1.4.0 (2026-06-15) | The voice release (mic, read-aloud, talk mode, wake word, optional Polly/Transcribe, `VOICE.md`) + production hardening (security headers, payload prechecks, rate-limit guard). |
| 1.3.1 (2026-06-14) | Responsive console fixes + a full editorial spelling/grammar audit of user-facing copy. |
| 1.3.0 (2026-06-14) | Engineering-visible release: command-palette upgrades, notes scaffolding, view-transition polish, first-party GitHub feed, MCP endpoint fixes. |
| 1.2.0 (2026-06-14) | Developer-Mode layout upgrade + the subtle-delight easter-egg system. |
| 1.1.0 (2026-06-14) | Developer Mode view (full-page keyboard-native terminal) + autoscroll engine fix. |
| 1.0.0 (2026-06-13) | Initial public portfolio: four switchable views over one content source + the Bedrock "Ask my portfolio" chat. |

**Current version:** `3.5.0` (`package.json:3`). **What v3.5.0 shipped** (`CHANGELOG.md:41-143`): the six
defect fixes tabled above, the pnpm-settings migration to `pnpm-workspace.yaml` (`CHANGELOG.md:126` — pnpm 11
stopped reading `package.json`'s `pnpm` field, so v3.4.2's ten security `overrides` were being silently
ignored; the `pnpm` field is now **gone** from `package.json`), a `.nvmrc` of `22` with `engines.node` pinned
to `">=22 <23"` (`CHANGELOG.md:120`, `package.json:5-7`), and the removal of `@react-three/rapier` +
`@react-three/offscreen` (`CHANGELOG.md:139-143`: 3 packages removed, 0 added, and one version change —
`@dimforge/rapier3d-compat` 0.19.2 → 0.12.0, because `@types/three` (`package.json:31`, `^0.185.4`) was its
only remaining consumer). Dependency counts are now **33 prod / 17 dev**, down from 35 / 17.

**What v3.4.2 shipped** (`CHANGELOG.md:145-195`): a
security-only promotion of fixes that had sat on `develop` while production served vulnerable versions —
`pdfjs-dist` 6.0.227→6.2.108 (high, reachable via `file-picker-button.tsx`'s `await import("pdfjs-dist")`),
`ip-address` 10.2.0→10.5.0 (high, SSRF via `mcp-handler` → MCP SDK → `express-rate-limit`), `hono`
4.12.25→4.13.2, `js-yaml` 4.2.0→4.3.1, `fast-uri` 3.1.2→3.1.5, `brace-expansion` 1.1.18 **and** 5.0.9 via
version-scoped overrides, `sharp` 0.34.5→0.35.3, `@hono/node-server` 1.19.17, `postcss` 8.5.23+,
`body-parser` 2.2.2→2.3.0. Six were lockfile-pinned transitives fixed with `pnpm.overrides` because
`@modelcontextprotocol/sdk` is pinned exactly to 1.26.0. Also added: the E2E CI gate, a non-blocking
`security-alerts` job needing a `SECURITY_ALERTS_TOKEN` secret (the default `GITHUB_TOKEN` cannot read the
Dependabot alerts API), a Playwright `webServer` block, five repaired E2E selectors, and moving the
Dependabot `ignore` entries onto `main` (Dependabot only reads `dependabot.yml` from the default branch).

## Knowledge-base model

From `ARCHITECTURE.md:21-47`. Two ideas only, and they are deliberately minimal:

1. **Artifacts are global, foldered by *kind*; `domain:` is a frontmatter *field* (a list), never a folder**
   (`ARCHITECTURE.md:25-27`). Cross-cutting is handled by tags + `[[slug]]` links — never by duplication or
   by nesting an artifact inside a domain.
2. **Domains are "loops"** — a thread of work with a charter, cadence, metrics. A domain folder holds only
   its README (charter) + machinery (metrics, collectors); it **links** artifacts and never contains them
   (`ARCHITECTURE.md:28-30`).

| kind | what it is | folder | key frontmatter |
|---|---|---|---|
| `signal` | evidence: feedback / idea / observation, deduped + frequency-counted | `signals/` | `category, frequency, sources[], domain[], status` |
| `doc` | durable knowledge: an analysis, a decision, a thing learned | `docs/` | `domain[], status?, links` |

Each folder's README *is* its schema (`ARCHITECTURE.md:39`). **Earning a new kind** requires all three of:
its own status machine AND queryable frontmatter fields AND a distinct body shape — otherwise it stays a
`doc`/`signal` with a tag, or a backlog line in a domain README (`ARCHITECTURE.md:43-47`). Body convention is
two layers: main text = *what's true now*; an optional append-only `## Timeline` = *what happened*
(`docs/README.md:29-30`, `signals/README.md:28-36`). `frequency` on a signal is defined as the number of
Timeline entries (`signals/README.md:36`).

**Active domains** (`ARCHITECTURE.md:53-57`, restated in `domains/README.md:55-59`):

| Domain | Goal | Cadence | Collector |
|---|---|---|---|
| `content` | Keep the portfolio content fresh, consistent, and discoverable | `weekly` | MDX files + Velite output |
| `seo` | Maximize organic reach via llms.txt, structured data, sitemap, canonical URLs | `weekly` | Vercel Analytics + Google Search Console |
| `performance` | Keep Core Web Vitals green; catch bundle regressions before they ship | `on PR` (frontmatter: `cadence: on-pr`) | `pnpm build` bundle analysis + web-vitals |

Two structural facts a maintainer should know:

- **`signals/` is empty; `docs/` no longer is.** `signals/` contains only its schema README (zero signal
  files). ~~`docs/README.md` lists "*(none yet — add docs here as they accumulate)*"~~ — **corrected on this
  branch:** `§Existing Docs` is now a real table of four entries — `configuration.md`, `index/`,
  `superpowers/plans/` (14), `superpowers/specs/` (5) (`docs/README.md:36-43`). Every domain's
  `## Evidence & analysis` section is still the literal placeholder "*(link signals and docs here as they
  accumulate)*", so the *linking* half of the model remains unused: accumulated knowledge still lives inline
  in the three domain READMEs rather than as linked `docs/`/`signals/` artifacts.
- **`domains/seo/README.md` carries a self-correction, not just a charter.** Its `goal:` frontmatter was
  rewritten to "*NOT llms.txt — see below*" (line 5), and lines 19-47 record the evidence: Google Search
  Central's own statement that AI text files "neither harm nor help … Google Search ignores them"; a
  137,210-domain log census where 28% publish a 200-returning llms.txt and 97% of those saw zero requests;
  AI *retrieval* bots at 1.1% of that traffic. The retained justification is coding/agentic infrastructure
  (10.5% of AI fetches, Claude-Code ranked #2). It also flags an **unresolved** question: the per-route
  `.md` endpoints are ordinary crawlable documents, so `/work/[slug].md` vs `/work/[slug]` duplicate content
  is open (`domains/seo/README.md:45-47`).
- **`domains/performance/README.md` is the closest thing to a live perf contract.** Lines 62-66 pin the
  current baseline — "exactly 1 three.js copy, 1248 KB total across R3F chunks, 113/113 static pages" — and
  warn that `grep -l "react-three" | wc -l` returns 5 (chunks *referencing* R3F) which is **not** the copy
  count; the copy count is `grep -l "WebGLRenderer" | wc -l`, which must be 1. Lines 48-61 list four
  regression guards that all fail *silently*, including "`src/lib/r3f.ts` is load-bearing … do not delete it
  on the theory that '16.3 handles this now'".

## Agent harness

Five skills live under `.claude/skills/`, each with YAML frontmatter (`name`, `description`,
`user_invocable: true`). Triggers below are the literal phrases from each `description`.

| Skill | Trigger (from frontmatter) | What it does |
|---|---|---|
| `dev-local` | "dev-local up", "start the stack", "bring up Anvilry locally", "start dev server" | The only Anvilry-*specific* skill. Port map (Next.js dev = 3000, single service), prerequisites (Node 22+, pnpm, `.env.local` via `vercel env pull`), then `up`/`verify`/`content`/`test`/`build` command blocks with absolute paths. `verify` greps the homepage for "Sairam" and POSTs a 5s-capped `/api/chat` probe (`SKILL.md:34-40`). |
| `e2e-setup` | "set up e2e", "add end-to-end tests", "scaffold a test gate" | Generic. System E2E belongs in a dedicated top-level package (it spans all apps, so belongs to none); the suite **never boots the app itself** (`SKILL.md:25-26`). Practices: real flow not bypass (read OTP from a local mail server), verify auth *itself* once then bypass everywhere else via a session helper, layered client → server → product assertions, stable role/label selectors, fresh data per run. Failure triage = real bug / stale test / flaky-env, and "never weaken or delete an assertion just to go green" (`SKILL.md:60`). |
| `pr` | "open a PR", "ship this", "raise a PR", "/pr" — "Never opens a PR until the feature is verified" | Splits verification by who's best at it: the subjective "does the feature do what was intended?" goes to a **fresh read-only verifier sub-agent** that drives the real app and returns a fixed `FEATURE: works \| broken` block; objective checks (type-check, lint, unit, e2e) are run by the orchestrator afterwards as a regression sweep (`SKILL.md:14-23`). Verifier loop capped at ~3 rounds, then escalate. The PR body leads with the feature proof and a reviewable video URL (a `pr-evidence` GitHub prerelease, a bucket, or CI artifacts) because GitHub cannot play video inline via automation (`SKILL.md:68-70`). |
| `new-loop` | "set up a new loop", "create a domain", "start a new beat/workstream", or naming a recurring job | Gathers 5 inputs (name, goal, cadence, what-it-does, tools/data), bootstraps the KB substrate only if `ARCHITECTURE.md`+`LOG.md`+a CLAUDE.md knowledge-base section are missing (via `references/KNOWLEDGE_SETUP.md`, idempotent), scaffolds `domains/<name>/README.md`, then **does ONE real test run at small scale**. Producing an artifact is optional; two outputs are mandatory — a dated line in the loop's `## Timeline` and one `LOG.md` entry (`SKILL.md:68-77`). Stops and asks if `domains/<name>/` already exists. |
| `setup-codebase-harness` | "set up the harness", "make this repo agent-ready", "harness this codebase" | Master orchestrator over `dev-local-setup`, `e2e-setup`, `crabbox-setup`, `pr`. Three pillars: **Legible** (shrink the root agent doc to a ~100-line table of contents; promote prose golden rules into mechanical lints whose error messages *inject the fix*), **Executable** (one-command stack; per-agent cloud box when loops run concurrently, because one laptop can't host N stacks), **Verifiable** (E2E gate + `pr`). Declared order: `1a (map) → 2 (dev-local) → 3 (e2e + /pr)`, then `1b (lints)` and `4` (`SKILL.md:91`). |

### `ship-change.js` workflow phases

`meta.phases` (`ship-change.js:7-14`) declares six titles: **Setup → Implement → Simplify → Review →
Verify → PR**. Read from the actual control flow:

| Phase | Gate / behaviour | Output schema |
|---|---|---|
| **Setup** | Always runs. Requires `args.task` + `args.repo` or throws (`:21-25`). Defaults: `baseBranch = 'main'` (`:26`), `openPr` true unless `false` (`:29`), review on unless `runReview === false` **or** `runCodex === false` (`:31`, back-compat). Creates a worktree at a sibling `<repo>-worktrees/<branch-slug>` — explicitly **outside** the main checkout (`:62`). Two non-obvious steps: (6) copies gitignored `.env`/`.env.*` files into the worktree, because `git worktree add` only populates version-controlled files and a missing `.env` "silently blocks later verification" (`:65-69`); (7) warms `node_modules` — fast path `cp -c -R` (APFS clonefile, copy-on-write) valid only when the lockfile diff is identical, else `pnpm install --prefer-offline`, recorded as `depsWarmed: clone \| install \| skipped \| none` (`:70-74`). Also probes `<worktree>/.claude/skills/pr/SKILL.md` → `hasPrSkill` (`:75`). Aborts the whole run if no `worktreePath` comes back (`:81-84`). | `worktreePath`, `branch`, `baseRef`, `hasPrSkill`, `envFilesCopied[]`, `depsWarmed`, `notes` |
| **Implement** | Works only inside the worktree; **does not commit** — a later stage commits once (`:119`). Instructed to investigate first, prefer new pure logic in its own framework-free module, and not gold-plate. | `filesChanged[]`, `summary`, `decisions[]`, `openConcerns[]` |
| **Simplify** | "SIMPLIFY ONLY — do not hunt for bugs, do not change behavior, do not expand scope" over `git --no-pager diff`; reuse/dedup, readability, efficiency, correct altitude. Behaviour must stay identical (`:151-156`). | `changesMade[]`, `summary` |
| **Review** | Skipped when `runReview: false` (`:204-206`). Blocking issues only — correctness, runtime/env incompatibility, security (injection/escaping/authz), regressions, pathological regex/perf, type errors; style nits are out (Simplify already ran). Uses Codex CLI/MCP for an independent second opinion when authenticated and sets `usedCodex` accordingly; otherwise reviews itself "just as rigorously" (`:193-195`). Fixes what it confirms, does not commit. | `usedCodex`, `blockingIssues[{issue,severity,file,fixed}]`, `fixesApplied[]`, `verdict` |
| **Verify** | **Skipped entirely** when `openPr && hasPrSkill` — the repo's own `/pr` skill runs its heavier app-driving verification instead (`:211-218`). Otherwise: discover commands from package.json/turbo.json/Makefile, prefer scoped fast checks over full builds, apply minimal fixes and re-run a few times, and honestly populate `couldNotVerify`. `passed` may only be true if the relevant checks for the changed code pass (`:249`). | `passed`, `commands[{cmd,ok,note}]`, `couldNotVerify[]`, `summary` |
| **PR** | Three branches. `openPr: false` → stop, changes left uncommitted in the worktree (`:270-271`). `hasPrSkill` → commit with a Conventional Commit message, then read `<worktree>/.claude/skills/pr/SKILL.md` and follow it EXACTLY, letting that skill gate the PR (`:272-288`). Else → only if `verify.passed`: commit, `git push -u origin <branch>`, `gh pr create --base <base> --head <branch>` (`:289-304`). If verification fails, no commit and no PR (`:305-309`). Any push/`gh` auth failure returns `prUrl: ''` with the reason in `summary` rather than forcing anything. | `prUrl`, `branch`, `commit`, `summary` |

Final return value is `{ setup, impl, simp, review, verify, pr, worktree, branch }` (`:311`). Every later
phase operates inside the worktree, never the original checkout (`:104`).

### Harness tool state

`.claude/proven-config.json` is a Ruflo `ruflo.proven-config/v1` manifest, not app config: `championId`
`sha256:6141a8ea…` with policy values `{alpha: 0.3, subjectWeight: 1, mmrLambda: 0.5, bodyWeight: 1.5,
typePenaltyFactor: 0.5}`, `layer: "framework/node-cli"`, `compatibility.ruflo: ">=3.24.0"`, benchmark corpus
`ADR-081-labelled-v1`, and a receipt (`heldOutDelta` 0.0738, `redblue: "PASS"`, `drift: 0`,
`canary.rollbackRate: 0`, `latencyP95` ≈ 244.6 ms, `receiptCoverage: 1`). `.claude/.proven-config-version`
holds the same hash as its only line. No Anvilry source file references either.

## Doc-vs-code drift

Each item cites the doc line and the code that disproves it. Conservative — plan/spec files are excluded as
drift because they are dated point-in-time artifacts, except where called out as such.

**Not every item below is live.** Seven of the fifteen were closed by the correctness pass on this branch
(items 1, 2, 3, 4, 6, 9, 10). Those keep their entry — they are the claims that misled earlier readings of
this repo — but their stale heading is **struck through** and marked *corrected on this branch*, same
convention as [README § By the numbers](./README.md) and
[15 § Documented-but-unconfirmed](./15-invariants-and-gotchas.md). A struck-through heading is history; the
citations beside it point at the **corrected** text, and where a test now prevents regression it is named.
Items **5, 7, 8, 11, 12, 13, 14, 15** are still live and still need fixing.

1. ~~**Model-chain order in `DEPLOY.md` is inverted.**~~ — **corrected on this branch, both chains.**
   `DEPLOY.md` used to table Primary = `us.anthropic.claude-opus-4-6-v1`, Secondary =
   `us.anthropic.claude-sonnet-4-6`, and to say the `anthropic` chain becomes
   `claude-opus-4-7 → claude-sonnet-4-6 → claude-haiku-4-5` — both inverted relative to the code. Current
   state: `DEPLOY.md:94` = Primary `us.anthropic.claude-sonnet-4-6`, `:95` = Secondary
   `us.anthropic.claude-opus-4-6-v1`, `:96` = Fallback `us.anthropic.claude-haiku-4-5-20251001-v1:0`, and
   `:99` = `claude-sonnet-4-6 → claude-opus-4-7 → claude-haiku-4-5`. Both now match
   `src/lib/llm.ts:32-34` (`BEDROCK_CHAIN`) and `src/lib/llm.ts:38` (`ANTHROPIC_CHAIN` =
   `["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5"]`). The same edit added a standing rule at
   `DEPLOY.md:101-103` — "Both chains are **Sonnet-primary**, not Opus-primary … that file is authoritative
   if this table ever disagrees with it" — with the source citations inline. `CLAUDE.md:191` and
   `docs/configuration.md:43-46` always stated the correct order. No test guards this; the anchor is the
   pointer at `DEPLOY.md:102-103`. (`CHANGELOG.md:519-521` records fixing the same inversion once already,
   in a `streamWithFallback` docblock at v1.8.0 — so this is the second recurrence, which is why the
   authoritative-source note was added rather than just the numbers.)
2. ~~**MCP tool count is 9, not 7.**~~ — **corrected on this branch, and guarded.** `CLAUDE.md` used to say
   "**7 tools** (all sourced from `src/lib/mcp-tools.ts`)" with a seven-row table, and to repeat "MCP server
   (7 read-only tools)" in the Key Files table. `src/app/api/mcp/[transport]/route.ts` calls
   `server.registerTool` **nine** times — the seven plus `list_all_content` (`:98-99`) and
   `get_content_item` (`:108-109`); `src/lib/mcp-tools.ts` exports nine data functions. Current state: the
   prose says **9 tools** with all nine tabled (`CLAUDE.md:202`), the Key Files row says "MCP server (9
   read-only tools)" (`CLAUDE.md:293`), the route's own docblock says "9 read-only tools"
   (`src/app/api/mcp/[transport]/route.ts:22`), and the public `/mcp` page tables all nine
   (`src/app/mcp/page.tsx:35-45`). **Guard:** `src/app/mcp/tools-documented.test.ts` asserts set equality
   between the page's `TOOLS` rows and the route's `registerTool` calls (`:92`, with the missing names in the
   failure message at `:85`); `vitest run` is chained into `pnpm build`, so adding a tool without
   documenting it fails the build. `CLAUDE.md:216-220` records that this is why the count is safe to quote.
   `CHANGELOG.md:398` records the 7 → 9 growth at v3.0.0, and `CHANGELOG.md:62-64` records this doc fix
   landing in v3.5.0.
3. ~~**"Every API route runs on the Node.js runtime … with a 30s max duration" is doubly stale.**~~ —
   **corrected on this branch.** `CLAUDE.md` now leads the section with "**Runtime & duration — do not add
   `export const runtime`.** No route exports `runtime` anywhere in `src/`" and states that `maxDuration` is
   "**per-route, not a uniform 30s**" (`CLAUDE.md:152`), followed by the real per-route table
   (`CLAUDE.md:154-162`: 60 for `cron/{eval,seo-audit,content-audit}`, 30 for `chat`/`mcp`/`cron/github-sync`,
   25 for `cron/health-check`, 20 `transcribe`, 15 `tts`/`tts-google`, 5 `error`, none for
   `visit`/`github/stats`/`md/*`/`resume.json`). The only `runtime` string left in `src/` is the comment
   noting its removal (`src/app/api/mcp/[transport]/route.ts:6-8`), consistent with `CHANGELOG.md:267-269`
   (13 `runtime` exports deleted for Cache Components).
4. ~~**`pnpm search-index` does not exist.**~~ — **corrected on this branch.** `CLAUDE.md` used to list
   `pnpm search-index` under "After build". `package.json:8-20` has no `search-index` script; the target is
   `make search-index` (`Makefile:65-66`, which runs
   `pnpm pagefind --site .next/server/app --output-path public/pagefind`). Current state: `CLAUDE.md:32`
   carries the explicit warning "**NOTE:** this is a Makefile target only — there is NO `pnpm search-index`
   script" immediately above the `make search-index` line at `:33`. `docs/configuration.md:132` always said
   `make search-index`.
5. **Velite does not run in watch mode during `pnpm dev`.** *(Still live.)* `CLAUDE.md:14` ("starts Velite
   watch + Next.js dev"), `README.md:45` ("Velite runs in watch mode via predev") and
   `.claude/skills/dev-local/SKILL.md:29` ("This runs `velite --watch & next dev`") all claim a watcher.
   `package.json:9-10` is `"predev": "velite"` (one-shot) + `"dev": "next dev"` — no `--watch` anywhere.
   `CLAUDE.md:178` separately and correctly describes `predev` as running "Velite synchronously before
   `next dev` starts", and `.claude/skills/dev-local/SKILL.md:30-31` says the same two lines later — so each
   of the two files contradicts itself. The correctness pass on this branch did **not** touch this one.
6. ~~**The route tree in `CLAUDE.md` lists one cron route; there are five.**~~ — **corrected on this branch.**
   The tree used to show only `/api/cron/eval` and to omit the `.md` handlers. Current state: `CLAUDE.md:146`
   is `└── /api/cron/{eval,health-check,github-sync,seo-audit,content-audit}` with `CLAUDE.md:147` recording
   "5 crons, ALL fail-closed on CRON_SECRET (`vercel.json:3-7`)", and `CLAUDE.md:145` lists
   `/api/md/{articles,notes,projects,work}/[slug]   raw-markdown passthrough (4 handlers)`. Both now match
   `src/app/api/cron/` (`content-audit`, `eval`, `github-sync`, `health-check`, `seo-audit`) and the four
   `src/app/api/md/*/[slug]/route.ts` files.
7. **`SECURITY.md` under-states the attack surface.** *(Still live.)* `SECURITY.md:5` — "a Next.js frontend with three API
   routes (`/api/chat`, `/api/tts`, `/api/transcribe`)". `src/app/api/` has eleven entries: `chat`, `cron`
   (×5), `error`, `github`, `mcp`, `md` (×4), `resume.json`, `transcribe`, `tts`, `tts-google`, `visit`.
8. **`VOICE.md`'s settings tables omit the Google TTS engine.** *(Still live.)* `VOICE.md:156` ("TTS engines |
   `"browser"` … | `"polly"`") and `VOICE.md:373` (`ttsEngine` type `"browser" | "polly"`) contradict
   `src/lib/voice-settings-context.tsx:29`: `export type TtsEngine = "browser" | "polly" | "google";`.
   `VOICE.md`'s own §7 (line 873) and `docs/configuration.md:240` both describe the `google` engine, so
   only §1/§3 are stale. Same section: `VOICE.md:162` calls the Polly voice "Joanna" a fixed property,
   which §7's catalog (`src/lib/voice-catalog.ts`, 6 curated + 12 extended voices) supersedes.
9. ~~**Terminal command count is understated.**~~ — **corrected on this branch, all three places.**
   `CLAUDE.md` used to say "~16 commands", `ARCHITECTURE.md` "16 commands", and `README.md` "~16 commands".
   `src/components/game/terminal/commands.ts:503-508` registers **31**: 27 visible (`help, whoami, neofetch,
   ls, cat, tree, grep, find, top, stats, stack, awards, summary, career, about, resume, open, contact,
   email, social, chat, theme, classic, developer, cd, clear, sudo`) plus 4 hidden eggs (`secret, personal,
   uses, now`) that are dispatchable but filtered out of `COMMAND_NAMES` (`:525-527`). Current state:
   `CLAUDE.md:105` = "Keyboard-driven terminal with **31** commands (27 visible + 4 hidden eggs)",
   `ARCHITECTURE.md:74` = "Developer terminal view (31 commands, combobox)", `README.md:10` = "31 commands".
   No test guards the count; re-derive it from `commands.ts:503-508` if it looks stale again.
10. ~~**`docs/README.md` still claims there are no docs.**~~ — **corrected on this branch.** It used to say
    "*(none yet — add docs here as they accumulate)*". Current state: `§Existing Docs` is a real table
    (`docs/README.md:36-43`) listing `configuration.md`, `index/` ("Per-file/per-route codebase index,
    version-pinned. Start at `index/README.md`"), `superpowers/plans/` (14) and `superpowers/specs/` (5).
    `docs/index/` itself holds 17 markdown files — this index.
11. **`CLAUDE.md`'s CI description omits two jobs.** *(Still live.)* `CLAUDE.md:87` describes `ci.yml` as
    "lint → typecheck (`tsc --noEmit`) → `pnpm test`". `.github/workflows/ci.yml` defines three jobs:
    `ci:` (`:10`), `e2e:` "E2E (Playwright)" (`:55-56`) running `pnpm e2e` (`:92`), and `security-alerts:`
    (`:102`) — both added in v3.4.2 per `CHANGELOG.md:180-184`.
12. **`DEPLOY.md`'s build command drops the test step.** *(Still live.)* `DEPLOY.md:20` — "Build command:
    `pnpm build` (runs `velite --clean && next build`)". `package.json:11` is
    `"build": "velite --clean && vitest run && next build"`. `README.md:46` and `CLAUDE.md:16-17` both state
    the three-step form, and `CLAUDE.md:362` relies on it ("a failing test blocks deployment"). Note this
    branch *did* rewrite `DEPLOY.md` (§3 model chains, §4 base-URL count) without touching `:20`.
13. **Plan-vs-shipped, flags package (informational, plan is dated).** *(Still live.)*
    `docs/superpowers/plans/2026-06-18-vercel-flags-sdk.md:51,76` prescribes `pnpm add @vercel/flags` and
    `import { flag } from "@vercel/flags/next"`. The shipped code is `import { flag } from "flags/next"`
    (`src/lib/flags.ts:10`) with `"flags": "^4.3.0"` in `package.json:39` — the renamed package.
    `docs/configuration.md:215-223` documents `FLAG_DRIVER`/`FLAGS`/`FLAGS_SECRET` without naming a package,
    so it is not itself wrong.
14. **Template-vs-instantiation, LOG ordering.** *(Still live.)* `.claude/skills/new-loop/references/LOG.md:4` seeds
    "Newest at the **BOTTOM**". The repo's `LOG.md:4` states "Newest first. Append an entry **above** older
    entries", and its three entries are ordered newest-first (2026-08-15, 2026-08-15, 2026-06-24). Anyone
    following the reference template verbatim would append in the wrong direction.
15. **Version-marker skew (not a code contradiction, but a freshness trap).** *(Still live.)*
    `ARCHITECTURE.md:8` is stamped "`**Version:** v1.0.0 — knowledge base bootstrapped 2026-06-24`" while the
    project is at `3.5.0`; the marker versions the knowledge-base model, not the app. Likewise
    `CHANGELOG.md:801-809` has link references only for `1.0.0`–`1.6.0`; `1.7.0` and everything after — now
    including `[3.5.0]` — have no link-ref footer entry.

## Coverage

- `README.md`
- `CLAUDE.md`
- `ARCHITECTURE.md`
- `AGENTS.md`
- `CHANGELOG.md`
- `LOG.md`
- `VOICE.md`
- `TELEMETRY.md`
- `DEPLOY.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `LICENSE`
- `docs/README.md`
- `docs/configuration.md`
- `docs/superpowers/plans/2026-06-13-terminal-dev-mode.md`
- `docs/superpowers/plans/2026-06-18-vercel-flags-sdk.md`
- `docs/superpowers/plans/2026-06-23-c1-directional-transitions.md`
- `docs/superpowers/plans/2026-06-23-c2-motion-audit.md`
- `docs/superpowers/plans/2026-06-23-c3-r3f-chunk-dedup.md`
- `docs/superpowers/plans/2026-06-23-c4-r3f-physics.md`
- `docs/superpowers/plans/2026-06-23-v2.3.0-ai-transparency.md`
- `docs/superpowers/plans/2026-06-23-v2.4.0-performance-ppr.md`
- `docs/superpowers/plans/2026-06-23-v2.6.0-a11y-bundle.md`
- `docs/superpowers/plans/2026-06-27-add-tombstone-trelix-inkforge.md`
- `docs/superpowers/plans/2026-06-28-visitor-counter-redis-fallback.md`
- `docs/superpowers/plans/2026-06-30-resume-single-master-toggle.md`
- `docs/superpowers/plans/2026-07-01-hero-avatar-tier1.md`
- `docs/superpowers/plans/2026-07-06-content-refresh-trelix-tombstone-articles.md`
- `docs/superpowers/specs/2026-06-13-terminal-dev-mode-design.md`
- `docs/superpowers/specs/2026-06-22-community-health-files-design.md`
- `docs/superpowers/specs/2026-06-23-anvilry-v2.3-v2.5-upgrade-design.md`
- `docs/superpowers/specs/2026-06-23-cycle-c-upgrades-design.md`
- `docs/superpowers/specs/2026-07-01-hero-avatar-design.md`
- `domains/README.md`
- `domains/content/README.md`
- `domains/seo/README.md`
- `domains/performance/README.md`
- `signals/README.md`
- `.claude/skills/dev-local/SKILL.md`
- `.claude/skills/e2e-setup/SKILL.md`
- `.claude/skills/pr/SKILL.md`
- `.claude/skills/new-loop/SKILL.md`
- `.claude/skills/setup-codebase-harness/SKILL.md`
- `.claude/skills/new-loop/references/ARCHITECTURE.md`
- `.claude/skills/new-loop/references/CLAUDE.template.md`
- `.claude/skills/new-loop/references/KNOWLEDGE_SETUP.md`
- `.claude/skills/new-loop/references/LOG.md`
- `.claude/workflows/ship-change.js`
- `.claude/proven-config.json`
- `.claude/.proven-config-version`
- `../PLAN.md` (appendix — outside `sairam-dev/`)
- `../RESEARCH.md` (appendix)
- `../.aava/AAVA.md` (appendix)
- `../.aava/AGENTS.md` (appendix)
- `../.aava/memory.md` (appendix)
- `../.aava/commands-skills/DISCOVERED_SKILLS.md` (appendix)
- `../.aava/.gitignore` (appendix)
- `../.claude-flow/neural/stats.json` (appendix)
- `../.claude-flow/policy/state.json` (appendix)
