---
kind: doc
title: Docs, Knowledge Base & Agent Harness
domain: [content]
status: current
version: v3.13.0
---

# Docs, Knowledge Base & Agent Harness

> Part of the Anvilry v3.13.0 codebase index. Master entry point: [docs/index/README.md](./README.md)
>
> **Pin:** this file describes Anvilry v3.13.0 (package.json `3.13.0`), i.e. `main` at a929932 (package.json `3.6.0`) plus five later behavioural fixes: notes are hidden at the data layer when `NOTES_ENABLED` is off; the rate limiter has per-class buckets (chat, voice, beacon) with an eval-cron bypass via `src/lib/cron-auth.ts`; admin auth goes through one shared `isAdminAuthorized` (proxy, `requireAdmin`, telemetry page); the command palette gates talk mode on `isVoiceViewActive`; and the bundle gate's route floor (`MIN_ROUTES`) is 17 and verified-dead components were removed. Numbers below were re-measured against that tree (worktree head 8e9e73e; `package.json`'s own version, bumped at the release cut, is `3.13.0`), not copied from older docs. Statements about what the other root docs say describe those docs as they stand in v3.7.0, after their own drift fixes; the §Doc-vs-code drift ledger marks which rows that closed.

**Scope:** `README.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `AGENTS.md`, `CHANGELOG.md`, `LOG.md`, `VOICE.md`,
`TELEMETRY.md`, `DEPLOY.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `docs/README.md`,
`docs/configuration.md`, `docs/next-upgrade-plan-2026-09.md`, `docs/superpowers/plans/*.md` (17), `docs/superpowers/specs/*.md` (6),
`domains/README.md`, `domains/{content,seo,performance}/README.md`, `signals/README.md`,
`.claude/skills/*/SKILL.md` (5), `.claude/skills/new-loop/references/*` (4),
`.claude/workflows/ship-change.js`, `.claude/proven-config.json`, `.claude/.proven-config-version`,
plus an appendix for the parent-directory wrappers `../PLAN.md`, `../RESEARCH.md`, `../.aava/`, `../.claude-flow/`.
**Files indexed:** 64

## At a glance

| File | Role | Key exports / anchors |
|---|---|---|
| `README.md` | Public-facing project pitch: "a beast with **four switchable experiences** over one canonical content source" (`README.md:5`) — marketing framing, not the store shape; the `View` union has **six** members and "four-view" describes only the default server-rendered pill set (`CLAUDE.md` → "The View System"). Plus highlights, stack table, develop/content/chat/voice/deploy quickstarts. Its *View architecture* bullet now describes all six views, and its terminal-command count now matches the registry's 32 (28 visible + 4 hidden; see Doc-vs-code drift, items 9 and 23). | §Highlights, §Stack, §Develop, §Content, §Chatbot configuration, §Voice, §Deploy |
| `CLAUDE.md` | Agent operating brief: commands, Makefile targets, branch/CI model, architecture overview, key-files table, env vars, testing notes, skills + knowledge-base pointers. | §Commands, §Branch Model & CI, §Architecture Overview, §Key Files, §Testing Notes, §Skills |
| `ARCHITECTURE.md` | Knowledge-base architecture decision record: the `signal`/`doc` kind model, domains-as-loops, repo map, key invariants. Frontmatter `kind: architecture`, `status: adopted`. Its `**Product:**` line records that the `View` union has **six** members and defers to `CLAUDE.md` → "The View System" (`ARCHITECTURE.md:17`); it used to say "4-view system". A `> **Scope:**` blockquote (`ARCHITECTURE.md:9`) now pins the app state that its domain table, layout map and invariants describe. | §The model, §Kinds, §Domains (active loops), §Repo layout, §Key invariants |
| `AGENTS.md` | 9-line Next.js-version warning wrapped in `<!-- BEGIN:nextjs-agent-rules -->` markers; points agents at `node_modules/next/dist/docs/`. States that `next dev` writes and re-adds this block (`node_modules/next/dist/server/lib/generate-agent-files.js`), so deleting it from a diff only recreates the change. `CLAUDE.md` restates the warning in its first callout. | (no headings beyond the single H1) |
| `CHANGELOG.md` | Keep-a-Changelog release history, **26** released version entries, newest first (`[3.13.0] — 2026-10-02` on top, then `[3.12.0] — 2026-10-02` and `[3.11.0] — 2026-10-01`), and NO live `[Unreleased]` section — the pnpm 11 `allowBuilds` fix and the bundle gate both shipped as `[3.6.0] — 2026-08-21` (`CHANGELOG.md:418-508`). `[3.7.0]` covers what changed after `a929932` (#279–#284), `[3.8.0]` covers #287, `[3.9.0]` covers #291 and #292, `[3.10.0]` covers #296 and #297, `[3.11.0]` covers #300, `[3.12.0]` covers #303 and `[3.13.0]` covers #307 and #308; the 297 commits between the `v3.6.0` tag and `a929932` (FAQ response cache, claims-integrity ledger, decisions ledger) still have no entry. | `[3.13.0]`, `[3.12.0]`, `[3.11.0]`, `[3.10.0]`, `[3.9.0]`, `[3.8.0]`, `[3.7.0]`, `[3.6.0]`, `[3.5.0]` … `[1.0.0]`, link-ref footer |
| `LOG.md` | Append-only activity journal, newest first, with a strict entry grammar, tag vocabulary, and grep/awk retrieval recipes. Newest entry is 2026-08-15, so it has nothing for v3.5/v3.6 or later work. | §Entry grammar, §Tags, §Retrieval recipes, 3 entries |
| `VOICE.md` | Canonical voice-layer reference (940 lines): architecture, 4 opt-in features, settings/flag tables, env+IAM+cost, privacy & a11y model, developer notes, v1.7 voice picker. | §1 Overview, §2 Features, §3 Flags/Settings, §4 Env/IAM/Cost, §5 Privacy & A11y, §6 Dev Notes, §7 Voice picker |
| `TELEMETRY.md` | Canonical observability reference (v1.8 header): dual-sink pipeline, `TelemetryEvent` schema, all 8 span kinds (`KIND_LITERALS` in `src/lib/telemetry/schema.ts`; `tts.request`, `transcribe.request` and `budget.tick` are declared but never emitted), trace-ID correlation, PII policy, admin dashboard, replay CLI, debugging cookbook, file map. | §1–§9 |
| `DEPLOY.md` | Vercel production deploy guide: import, env-var table, Upstash rate-limit setup, verified Bedrock chain + IAM policy, custom domain, verify checklist, gotchas, and (§7) the cron, admin and optional-feature variables. | §0–§7 |
| `SECURITY.md` | Responsible-disclosure policy: in/out-of-scope list, private email reporting, 48h ack / 7-day critical SLA, no bounty. | §Scope, §Reporting |
| `CODE_OF_CONDUCT.md` | Contributor Covenant v2.1 verbatim, maintainer named as sole enforcer, scoped to Issues/PRs/Discussions. | §Our Pledge … §Attribution |
| `LICENSE` | MIT (2024–2026 Sairam Ugge) **plus** a CONTENT EXCLUSION carve-out reserving all rights on `content/`, `src/lib/profile.ts`, `public/resume/`, branding assets. | MIT body, `CONTENT EXCLUSION` |
| `docs/README.md` | Schema README for the `doc` kind — frontmatter shape, body convention (main text + optional `## Timeline`), naming. Frontmatter `kind: schema-readme`. Its §Existing Docs table (`docs/README.md:36-44`) lists `configuration.md`, `index/`, the 17 plans, the 6 specs and `next-upgrade-plan-2026-09.md`, matching the disk (see Doc-vs-code drift, item 10). | §Frontmatter, §Body, §Naming, §Existing Docs |
| `docs/configuration.md` | Env var + feature flag reference (17 numbered sections plus an unnumbered "Server Toggles, Caches & Crons" section), how-to-add-a-flag recipes, per-route CSP note, per-environment matrix, and a "files that read env vars" map. It opens by calling itself the single source of truth, and now documents the 11 variables an earlier pass found missing (see Doc-vs-code drift, item 21). | §1–§17, §Server Toggles, Caches & Crons, §Security Headers, §Files That Read Environment Variables |
| `docs/superpowers/plans/2026-06-13-terminal-dev-mode.md` | 867-line task-by-task plan: promote the Play-view terminal into "Developer Mode" via a pure command registry, 5 phases / 15 tasks. | Phases 1–5, Tasks 1–15 |
| `docs/superpowers/plans/2026-06-18-vercel-flags-sdk.md` | Plan to migrate `NEXT_PUBLIC_DISCOVERY_BADGES` to the Vercel Flags SDK behind a `FLAG_DRIVER` switch; 6 tasks + post-merge dashboard wiring. | Tasks 1–6, §Post-merge |
| `docs/superpowers/plans/2026-06-23-c1-directional-transitions.md` | Plan: stamp `data-view-dir` on `<html>` before `startViewTransition`; directional slide keyframes in `globals.css`. 2 files, 3 tasks. | Tasks 1–3 |
| `docs/superpowers/plans/2026-06-23-c2-motion-audit.md` | Plan: audit the 140 KB `motion/react` bundle; replace `useReducedMotion` in shared primitives with a native hook. 3 tasks. | Tasks 1–3 |
| `docs/superpowers/plans/2026-06-23-c3-r3f-chunk-dedup.md` | Plan: collapse the twin 876 KB R3F chunks — Option A `optimizePackageImports`, Option B `src/lib/r3f.ts` barrel. 4 tasks. | Tasks 1–4 |
| `docs/superpowers/plans/2026-06-23-c4-r3f-physics.md` | Plan: add `@react-three/rapier` physics behind `NEXT_PUBLIC_GRAPH_PHYSICS`, via a separate `scene-physics.tsx`. 4 tasks. Unchanged history, and still accurate *about the plan* — but note the outcome: the dependency was installed, `scene-physics.tsx` shipped as plain sinusoidal `useFrame` maths instead, rapier was never imported, and the package was **removed in v3.5.0** (`CHANGELOG.md:608-612`). The flag and filename are the only residue. | Tasks 1–4 |
| `docs/superpowers/plans/2026-06-23-v2.3.0-ai-transparency.md` | 1034-line plan: Anthropic extended thinking — `THINKING_SENTINEL`, server-buffered `thinking_delta`, `reasoning` in the trace frame, `ThinkingBlock` UI. 6 tasks. | Tasks 1–6, §Self-Review |
| `docs/superpowers/plans/2026-06-23-v2.4.0-performance-ppr.md` | Plan: enable `cacheComponents: true` and migrate 5 page/special routes; 9 API routes explicitly untouched. 7 tasks. | Tasks 1–7 |
| `docs/superpowers/plans/2026-06-23-v2.6.0-a11y-bundle.md` | Plan: fix WCAG 4.1.2 on the terminal input (`role="combobox"` + always-rendered listbox) + a read-only bundle audit. 3 tasks. | Tasks 1–3 |
| `docs/superpowers/plans/2026-06-27-add-tombstone-trelix-inkforge.md` | Plan: add 3 project MDX files + 3 graph nodes + 3 `NODE_CONTENT` entries + 3 article cross-links; the bijection test is the gate. 7 tasks. | Tasks 1–7, §File Map Summary |
| `docs/superpowers/plans/2026-06-28-visitor-counter-redis-fallback.md` | Plan: localStorage-cached visitor badge so a Redis-unavailable `total: 0` falls back to the last-known count. 2 tasks, 6 DOM tests. | Tasks 1–2 |
| `docs/superpowers/plans/2026-06-30-resume-single-master-toggle.md` | 870-line plan: single "Sairam Resume" master default, PDF/Web toggle, `NEXT_PUBLIC_RESUME_VARIANTS` gate, `ResumeViewInline`, `e2e/resume.spec.ts`. 4 tasks. | Tasks 1–4, §Flag behaviour matrix |
| `docs/superpowers/plans/2026-07-01-hero-avatar-tier1.md` | 1227-line plan: cursor-reactive hero avatar — 6 new files under `src/components/hero-avatar/`, `computeGaze`/`computeIdle` pure fns, flag routing, GLB asset task. 8 tasks. | Tasks 1–8, §Self-Review |
| `docs/superpowers/plans/2026-07-06-content-refresh-trelix-tombstone-articles.md` | Plan: bump trelix/tombstone commit counts, add 3 article cross-links, fix the `/resume` PDF-iframe CSP `frame-ancestors` bug. 4 tasks + pre-computed dedup analysis. | §Dedup Analysis, Tasks 1–4 |
| `docs/superpowers/plans/2026-09-07-phase-1-last-shipped-stat-and-ai-usage-signals.md` | 511-line plan: surface the GitHub last-push timestamp as a homepage stat card, and add a Cloudflare Content Signals AI-usage policy to `robots.txt` plus a matching paragraph in `llms.txt`. Pure additions, no new route or dependency. | Tasks 1-4 (Task 4 is the ship step) |
| `docs/superpowers/plans/2026-09-07-phase-2-claims-integrity-ledger.md` | 707-line plan: hash-chain `impactMetrics` + `achievements` from `src/lib/profile.ts`. Shared module `src/lib/claims-integrity.ts`, CLI `scripts/seal-claims.ts` (run via `tsx`), client-safe `src/lib/integrity-chain.ts`, committed `data/integrity-chain.json`, a terminal `integrity` command, and a CI verify step. | Tasks, §Global Constraints |
| `docs/superpowers/plans/2026-09-07-phase-3-decisions-ledger.md` | 1021-line plan: add a `decisions[]` field to the Velite `Project` collection, derive one `LedgerEntry[]` in `src/lib/decisions.ts` from projects and work, and expose it at `/decisions` and as the `list_decisions` MCP tool. Zero new authored content. | Tasks, §Global Constraints |
| `docs/next-upgrade-plan-2026-09.md` | 642-line `status: draft`, `domain: []` upgrade plan from 10 research streams (2026-09-18). Mixes shipped and open items (several are marked `✅ SHIPPED`), so read it as a snapshot, not a backlog. Listed in `docs/README.md` (`docs/README.md:44`). | §Scope & Method |
| `docs/superpowers/specs/2026-06-13-terminal-dev-mode-design.md` | Design spec behind the terminal plan: 4 locked owner decisions, why-not-xterm.js, ~14-command spec table, a11y non-negotiables, phased build, non-goals. | §Locked decisions, §Architecture, §Command spec, §Non-goals |
| `docs/superpowers/specs/2026-06-22-community-health-files-design.md` | 32-line spec for the community-health file set (LICENSE / SECURITY / CoC / CONTRIBUTING / templates) + the source-available license split. Status: Approved. | §Files to Create, §License Decision, §Out of Scope |
| `docs/superpowers/specs/2026-06-23-anvilry-v2.3-v2.5-upgrade-design.md` | Three-phase design: v2.3.0 AI transparency, v2.4.0 PPR, v2.5.0 discoverability (per-page `.md` routes + `DefinedTerm` JSON-LD). | Phases 1–3, §File Change Summary |
| `docs/superpowers/specs/2026-06-23-cycle-c-upgrades-design.md` | Cycle-C design: C-1 directional transitions, C-2 motion audit, C-3 R3F dedup, C-4 Rapier physics. Records the `VIEW_ORDER` 0–5 nav order. | Phases C-1…C-4 |
| `docs/superpowers/specs/2026-07-01-hero-avatar-design.md` | Hero-avatar design spec: two flags, 6-file architecture, ReadyPlayerMe GLB + ARKit morph-target requirements, gaze/idle algorithms, 3 layout wrappers, perf constraints. | §Feature Flags, §Architecture, §Model, §Component Interfaces, §Out of Scope |
| `docs/superpowers/specs/2026-09-07-feature-phase-decisions-integrity-design.md` | 200-line design spec behind the three 2026-09-07 plans: decisions ledger, claims-integrity ledger, AI-usage signals, last-shipped stat. Records which 4 of 8 researched candidates were built and why the other 4 (e.g. a live systems-pulse badge) were not. Status: Approved. | §Background, Phase 1-3 sections |
| `domains/README.md` | Schema README for the `domain` kind: what a loop is, the domain README template, the Timeline-as-run-log rule, "don't create domains by hand — run `/new-loop`". | §Domain README template, §Anvilry Domains |
| `domains/content/README.md` | Content-freshness loop charter (`status: active`, `cadence: weekly`). 5 backlog items, 4 metrics, 2 Timeline entries (the second is the 2026-09-29 drift pass). | §Current focus, §Backlog, §Metrics, §Timeline |
| `domains/seo/README.md` | Discoverability loop charter (weekly). Contains the 2026-08-12 correction removing llms.txt as an organic-reach mechanism, and a "no separate GEO/AEO discipline" ruling. | §llms.txt correction, §No separate GEO/AEO, §Backlog, §Timeline |
| `domains/performance/README.md` | Web-vitals loop charter (`cadence: on-pr`). The richest domain file, rewritten when `bundle-analysis.yml` was deleted: closed cacheComponents + R3F tracks, **5** regression guards — the first now **✅ ENFORCED** in CI via `scripts/bundle-budget.mjs`, the other four still silent — **4** known constraints (two of them marked RESOLVED), a §Metrics section that now splits "what actually ships" from webpack "module attribution", verified-current CWV facts. | §Current focus, §Regression guards, §Metrics, §Known constraints, §Verified-current facts, §Timeline |
| `signals/README.md` | Schema README for the `signal` kind: frontmatter (`category`, `frequency`, `sources[]`, `domain[]`, `status`), `frequency` = Timeline-entry count, Anvilry signal domains. | §Frontmatter, §Body, §Naming, §Anvilry Signal Domains |
| `.claude/skills/dev-local/SKILL.md` | Anvilry-specific dev-stack launcher skill: port map, prerequisites, `up`/`verify`/`content`/`test`/`build` command blocks. `user_invocable: true`. | frontmatter `name: dev-local`, §Commands, §Notes |
| `.claude/skills/e2e-setup/SKILL.md` | Generic skill for standing up a trustworthy E2E gate: where it lives, the 4-step recipe, trust practices, failure triage, external-service sandbox rules. | frontmatter `name: e2e-setup`, §The recipe, §Practices, §When a test fails |
| `.claude/skills/pr/SKILL.md` | Verify-before-ship skill: fresh read-only verifier sub-agent drives the app, then regression sweep, then PR with a reviewable proof link. 5 numbered steps + rules. | frontmatter `name: pr`, §1–§5, §Rules |
| `.claude/skills/new-loop/SKILL.md` | Skill that scaffolds a new `domains/<name>/README.md`, does ONE real test run, and records it in the loop Timeline + `LOG.md`. 4-step procedure, 5 inputs. | frontmatter `name: new-loop`, §Inputs, §Procedure, §Notes |
| `.claude/skills/setup-codebase-harness/SKILL.md` | Master orchestrator skill: legible / executable / verifiable pillars, plus commit hygiene + entropy control; declares the sub-skill order 1a → 2 → 3 → 1b → 4. Names sub-skills `dev-local-setup` and `crabbox-setup` that do not exist in `.claude/skills/` (the local launcher is `dev-local`). | frontmatter `name: setup-codebase-harness`, §0 Assess, §1–§4, §Order |
| `.claude/skills/new-loop/references/ARCHITECTURE.md` | The generic knowledge-base ADR template `new-loop` instantiates — includes the "earning a new kind" bar, deferred-features table, 6 rejected options, and a where-things-live map. | §The model, §Earning a new kind, §Deferred, §Options considered, §Map |
| `.claude/skills/new-loop/references/CLAUDE.template.md` | `{{PLACEHOLDER}}` CLAUDE.md scaffold for a fresh knowledge-base repo (identity, current state, voice, data/tooling, KB block, worktree discipline). | §What it is, §Knowledge base, §When spawning agents |
| `.claude/skills/new-loop/references/KNOWLEDGE_SETUP.md` | One-time idempotent bootstrap procedure + verbatim copy blocks for `signals/README.md`, `docs/README.md`, `domains/README.md`, and the CLAUDE.md knowledge-base section. | §Procedure, 3 verbatim README blocks, §CLAUDE.md section |
| `.claude/skills/new-loop/references/LOG.md` | Empty `LOG.md` seed template (grammar, tags, retrieval recipes). Says **"Newest at the BOTTOM"** — the repo's own `LOG.md` is newest-first. | header block |
| `.claude/workflows/ship-change.js` | The `ship-change` workflow — 6 declared phases driving `agent()` calls with JSON schemas; creates an isolated worktree, implements, simplifies, reviews, verifies, PRs. | `meta` (exported), `phases[]`, `SETUP_SCHEMA`, `IMPL_SCHEMA`, `SIMP_SCHEMA`, `REVIEW_SCHEMA`, `VERIFY_SCHEMA`, `PR_SCHEMA` |
| `.claude/proven-config.json` | Ruflo `proven-config/v1` manifest: adopted champion policy hash, 5 retrieval tuning weights, benchmark corpus hash, canary receipt. Not read by any app code. Gitignored (`.gitignore:68`), so it exists only in the primary checkout, not in a fresh clone or worktree. | `adoptedAt`, `championId`, `manifest.policy.value`, `manifest.receipt` |
| `.claude/.proven-config-version` | One-line pointer: the `sha256:6141a8…` champion id that `proven-config.json` held when read. Gitignored (`.gitignore:69`), same caveat. | (single line) |
| `../PLAN.md` | **Appendix (outside repo).** Original pre-build implementation plan for "sairam.dev" — Next.js **15**, M0→M5 milestones, 2 case studies / 8 OSS repos. Historical. | §0 Principles … §10, §Open choices |
| `../RESEARCH.md` | **Appendix.** The adversarially-verified research blueprint the plan was derived from (107 agents, 25 sources, 18 confirmed / 7 refuted), with ✅/❌/⚠️ vote annotations. | §TL;DR, §Architecture, §Design & UX, §Performance, §A11y, §Standout, §Research gaps |
| `../.aava/AAVA.md` | **Appendix.** 14-line "Aava Project Constitution": memory-first, atomic topics, atomic commits, lint guard. | §1 Architectural Integrity, §2 Development Workflow |
| `../.aava/AGENTS.md` | **Appendix.** Aava learned-patterns registry: memory-first protocol, 2 path/`NoneType` gotchas, Synthesize/Explore agent guidance. | §1–§3 |
| `../.aava/memory.md` | **Appendix.** Aava memory index — all three tiers recorded as empty ("No … topics recorded yet"). | §1–§3 |
| `../.aava/commands-skills/DISCOVERED_SKILLS.md` | **Appendix.** 197-line generated (24/06/2026) categorical index of workspace+system skills: `Skill \| Description \| Source \| Composes` tables per category. | §Advanced Development, §Advanced Workflows, §Build & Implementation, … |
| `../.aava/.gitignore` | **Appendix.** Two lines: `*` then `!.gitignore` — ignores the entire `.aava/` tree except itself. | — |
| `../.claude-flow/neural/stats.json` | **Appendix.** 4-key counter blob: `trajectoriesRecorded`, `patternsLearned`, `signalsProcessed` (all 3 when last read; they were 2 in the previous pass, so treat the values as live tool state), `lastAdaptation` epoch-ms. | — |
| `../.claude-flow/policy/state.json` | **Appendix.** Ruflo policy ledger, `"mode": "legacy"`, empty `rules`/`budgets`/`usage`/`approvals`, plus hash-chained `receipts[]` for `mcp.tool.call` decisions. | `version`, `mode`, `receipts[]` |

## Doc-purpose map

File mtimes are not a usable freshness signal here (a bulk move stamped a large block of files on 28 Jun,
and a fresh worktree resets all of them), so the in-document version marker is the freshness cue.

| File | Kind | Authoritative for | Last-updated signal |
|---|---|---|---|
| `README.md` | public readme | The outward-facing pitch, stack table, voice cost table | no version marker; the pitch line still says "four switchable experiences" (the headline count) while the *View architecture* bullet describes six views |
| `CLAUDE.md` | agent brief | Command surface, branch/CI model, key-files map, testing invariants, skills index | opens with a `> **Snapshot.**` callout stating it describes v3.13.0, i.e. `main` at `a929932` (3.6.0) plus fourteen changes (the five v3.7.0 fixes, two in v3.8.0, two in v3.9.0, two in v3.10.0, one in v3.11.0, one in v3.12.0 and one in v3.13.0); § Branch Model & CI records the 2026-09-17 retroactive tagging up to v3.6.0 |
| `ARCHITECTURE.md` | ADR (`kind: architecture`, `status: adopted`) | The knowledge-base model (kinds, domains, invariants) — **not** app architecture | in-doc `**Version:** v1.0.0 — knowledge base bootstrapped 2026-06-24` (`ARCHITECTURE.md:8`), which versions the model, plus a `**Scope:**` note naming the app state it describes, v3.13.0 (`ARCHITECTURE.md:9`) |
| `AGENTS.md` | agent rule block | Only the "this is not the Next.js you know" warning | no version marker |
| `CHANGELOG.md` | release log | Per-release narrative; 26 version entries | latest entry `[3.13.0] — 2026-10-02`, then `[3.12.0] — 2026-10-02`, `[3.11.0] — 2026-10-01`, `[3.10.0] — 2026-10-01`, `[3.9.0] — 2026-10-01`, `[3.8.0] — 2026-09-30`, `[3.7.0] — 2026-09-30` and `[3.6.0] — 2026-08-21` (`CHANGELOG.md:418`); rewritten in v3.5.0; the 297 commits between the `v3.6.0` tag and `a929932` are still unrecorded |
| `LOG.md` | activity journal | Finished-work feed + its own entry grammar | newest entry 2026-08-15 |
| `VOICE.md` | feature reference | Voice architecture, settings keys, IAM, privacy/a11y model, voice catalog | in-doc `v1.7 update` banner |
| `TELEMETRY.md` | feature reference | Span kinds, PII policy, dashboard tiles, replay CLI | in-doc title `(v1.8)`, which dates the design, plus a `> **Scope:**` note that it describes v3.13.0, i.e. `a929932` plus the five v3.7.0 fixes, the two v3.8.0 changes, the two v3.9.0 removals, the v3.10.0 per-model price table, the v3.11.0 note that the effort levels change no span shape, the v3.12.0 `reasoning_replayed` attribute and the v3.13.0 note that nothing changes in a span (`TELEMETRY.md:7`) |
| `DEPLOY.md` | runbook | Vercel env-var table, IAM policy JSON, Upstash setup, region gotcha | no version marker of its own; the intro says it describes v3.13.0, i.e. `main` @ `a929932` plus the five v3.7.0 fixes, the two v3.8.0 changes, the two v3.9.0 removals, the two v3.10.0 changes (Sonnet 4.6 backs up a 5.x primary, Opus is opt-in; a neutral AI cue), the v3.11.0 effort levels, the v3.12.0 reasoning replay and the v3.13.0 deployment-id cache tag (`DEPLOY.md:5`) |
| `SECURITY.md` | policy | Disclosure channel + SLA + scope | no version marker |
| `CODE_OF_CONDUCT.md` | policy | Contributor Covenant v2.1 adoption + enforcement contact | v2.1 |
| `LICENSE` | legal | MIT for code; all-rights-reserved carve-out for content/identity/résumés/branding | copyright range `2024–2026` |
| `docs/README.md` | schema readme | The `doc` frontmatter schema | §Existing Docs (`docs/README.md:36-44`) matches the disk: 17 plans, 6 specs, plus the upgrade plan |
| `docs/configuration.md` | config reference | Env vars + flags, defaults, add-a-flag recipes, CSP override | flags tagged up to `v3.3`; a `> **Scope:**` note that it describes v3.13.0 (`docs/configuration.md:5`); now covers the FAQ-cache, Sonnet-5, Sonnet-5.5, Opus-fallback, thinking-effort and extended-thinking toggles |
| `docs/next-upgrade-plan-2026-09.md` | draft plan | Point-in-time upgrade research; mixed shipped/open items | frontmatter `status: draft`, 2026-09-18 |
| `docs/superpowers/plans/*` (17) | point-in-time plans | What was *intended* on the plan's date — **not** current-state assertions | filename dates 2026-06-13 → 2026-09-07 |
| `docs/superpowers/specs/*` (6) | point-in-time design specs | Locked decisions + rejected alternatives for their feature | filename dates 2026-06-13 → 2026-09-07 |
| `domains/README.md` | schema readme | The `domain` frontmatter + README template | §Anvilry Domains table names the real collectors (`scripts/bundle-budget.mjs`, the cron audits) |
| `domains/content/README.md` | loop charter | Content-freshness goal, backlog, metrics | Timeline ends 2026-09-29 (previous entry 2026-06-24) |
| `domains/seo/README.md` | loop charter | SEO goal + the llms.txt and GEO/AEO rulings | Timeline ends 2026-09-29 (previous entry 2026-08-12) |
| `domains/performance/README.md` | loop charter | Bundle/CWV baselines, regression guards (one CI-enforced), tooling constraints | Timeline ends 2026-09-29 (previous entry 2026-08-21); quotes the current budget (1,336,000 B, 1,285,000 B at v3.6.0) |
| `signals/README.md` | schema readme | The `signal` frontmatter + dedup/frequency rule | **zero signal files exist** |
| `.claude/skills/*/SKILL.md` (5) | agent skills | Their own trigger phrases + procedures | no version marker |
| `.claude/skills/new-loop/references/*` (4) | skill templates | The generic KB substrate `new-loop` copies in | no version marker |
| `.claude/workflows/ship-change.js` | workflow script | Phase order + per-phase agent prompts/schemas | no version marker |
| `.claude/proven-config.json` + `.proven-config-version` | tool state | Ruflo champion retrieval policy | gitignored, primary checkout only |
| `../PLAN.md`, `../RESEARCH.md` | pre-build artifacts | The original brief + its verified research basis | both predate the shipped stack |
| `../.aava/*`, `../.claude-flow/*` | third-party tool state | Aava/Ruflo agent scaffolding — no app coupling | `.aava` generated 24 Jun 2026 |

## Version history

Read in full from `CHANGELOG.md`. **26 released version entries** are present, and NO live `[Unreleased]`
section — the last one was cut as `[3.13.0] — 2026-10-02`; the one before it was `[3.12.0] — 2026-10-02`, then `[3.11.0] — 2026-10-01`, `[3.10.0] — 2026-10-01`, `[3.9.0] — 2026-10-01` and `[3.8.0] — 2026-09-30`, then `[3.7.0] — 2026-09-30` and `[3.6.0] — 2026-08-21` (`CHANGELOG.md:418-508`). The release before that,
`[3.5.0]` (`CHANGELOG.md:510-612`), covered six live defects and the documentation corrections listed in
§Doc-vs-code drift. Count entries with `grep -c '^## \[[0-9]' CHANGELOG.md` (26).

**Do not trust a stated line-shift; re-derive it.** Prepending a release entry moves every line below it
and the offset compounds across releases. The reliable check is `node scripts/check-index-citations.mjs`,
which fingerprints each cited line's content. Note the gap: no `2.x` entry and no `3.1.x`–`3.3.x` entry
exists at all — `LOG.md:33` records that the 3.4.0 entry was "added after a 13-release gap", so the
changelog is not a complete release ledger. It is also behind the code: `package.json` says `3.13.0`; `[3.7.0]` covers what changed after `a929932`, `[3.8.0]` covers #287, `[3.9.0]` covers #291 and #292, `[3.10.0]` covers #296 and #297, `[3.11.0]` covers #300, `[3.12.0]` covers #303 and `[3.13.0]` covers #307 and #308, but
the source still contains work from the 297 commits between the `v3.6.0` tag and `a929932` with no entry (the FAQ response cache, the claims-integrity chain, the
decisions ledger and `list_decisions`); per-class rate limits are recorded in `[3.7.0]`.

| Version | Theme |
|---|---|
| 3.13.0 (2026-10-02) | **Newest entry.** The FAQ cache tags each entry with the id of the deployment that wrote it (`VERCEL_DEPLOYMENT_ID`), so a cached answer and the reasoning stored with it last until the next deploy or the 24 h TTL instead of the next cold start of any function; a preview or a rollback never serves another deployment's answers; the first deploy flushes the cache once (#307). The `/api/error` suite mocks Redis, so a build no longer pushes fake client errors into the real list (#308). |
| 3.12.0 (2026-10-02) | The FAQ cache stores the reasoning summary beside its answer and an exact-tier hit replays it (so a repeated first-turn question shows its reasoning too; a semantic hit never does, and `EXTENDED_THINKING=false` stops it), the `chat.cache` hit event gains the boolean `reasoning_replayed`, the Upstash `, command was:` echo is cut from the cache's error events and the purge result, and the docs now say the corpus stamp is re-written on every production process start (#303). |
| 3.11.0 (2026-10-01) | `LLM_THINKING_EFFORT` takes `high`, `xhigh` and `max` next to `low` and `medium` (`xhigh` makes Sonnet 5.5 reason on every question; any model that is not Sonnet 5.x is sent `max` for it), the reasoning `max_tokens` floor follows the effort, and `/api/chat` may run for 60 s (#300). |
| 3.10.0 (2026-10-01) | Sonnet 5.x streams a reasoning summary (`display: "summarized"`, effort `medium`, `LLM_THINKING_EFFORT`); Opus leaves the default fallback chain (`LLM_USE_OPUS_FALLBACK`) and Sonnet 4.6 backs up a 5.x primary; `cost_usd` comes from a verified per-model price table; the weekly eval cron reads the answer with `answerFromBody`; phone visitors get a neutral "AI assistant" cue again (#296, #297). |
| 3.9.0 (2026-10-01) | Two removals a visitor could see, and one label: the `Answered by <model> · <provider>` line under chat answers is gone (#291); the Konami-code easter egg is gone (#292), so the optional discovery badge counts to 4; and the streaming reasoning block's `aria-label` no longer names the model; the docs index relabelled. |
| 3.8.0 (2026-09-30) | One behaviour fix and one opt-in setting: a 403 that names an IAM deny now falls through to the next rung instead of ending the chain (so a failing primary answers from Haiku, not the apology, and that fallback answer is not written to the FAQ cache); `LLM_USE_SONNET_5_5` makes Claude Sonnet 5.5 the primary (global Bedrock profile only, `between_tools` as its thinking-off shape); the docs index relabelled. |
| 3.7.0 (2026-09-30) | Hardening and correctness pass, no new features: one constant-time `isAdminAuthorized` (proxy, `requireAdmin`, telemetry page) and one fail-closed constant-time `CRON_SECRET` check for all five crons; three independent `chat` / `voice` / `beacon` rate-limit buckets with an eval-cron bypass; notes hidden at the data layer while `NEXT_PUBLIC_NOTES_ENABLED` is off; command-palette talk mode gated by `isVoiceViewActive`; bundle-gate `MIN_ROUTES` 16 → 17 and four unreferenced pieces of code removed; documentation re-derived against the code. |
| 3.6.0 (2026-08-21) | Correctness and CI-integrity pass: `pnpm install --frozen-lockfile` fixed for pnpm 11 (`allowBuilds` in `pnpm-workspace.yaml`); OG label maps keyed by `ArticleSource`; new `install-pnpm-11` CI job and `src/lib/pnpm-build-allowlist-consistency.test.ts`; `scripts/bundle-budget.mjs` and its `Bundle budget` step added, `bundle-analysis.yml` removed; `pnpm analyze` kept as a local tool. |
| 3.5.0 (2026-08-21) | Correctness pass, not a feature release: six live defects (dead MCP transport in `llms.txt`, two 404 PWA screenshots, `/mcp` documenting 7 of 9 tools, the health-check cron probing a Vercel SSO wall, `mcp_get`'s wrong expected status, `/api/visit`'s spoofable client IP); the per-file codebase index; pnpm settings migrated out of `package.json` into `pnpm-workspace.yaml`; `@react-three/rapier` + `@react-three/offscreen` removed. |
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

**Current version:** `3.13.0` (`package.json:3`). **What v3.5.0 shipped** (`CHANGELOG.md:510-612`): the six
defect fixes tabled above, the pnpm-settings migration to `pnpm-workspace.yaml` (`CHANGELOG.md:595` — pnpm 11
stopped reading `package.json`'s `pnpm` field, so v3.4.2's ten security `overrides` were being silently
ignored; the `pnpm` field is now **gone** from `package.json`), a `.nvmrc` of `22` with `engines.node` pinned
to `">=22 <23"` (`CHANGELOG.md:589`, `package.json:5-7`), and the removal of `@react-three/rapier` +
`@react-three/offscreen` (`CHANGELOG.md:608-612`: 3 packages removed, 0 added, and one version change —
`@dimforge/rapier3d-compat` 0.19.2 → 0.12.0, because `@types/three` (`package.json:35`, `^0.186.0`) was its
only remaining consumer). At v3.5.0 the dependency counts were 33 prod / 17 dev; re-count from
`package.json` before quoting them.

**What v3.4.2 shipped** (`CHANGELOG.md:614-664`): a
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

**Active domains** (`ARCHITECTURE.md` § Domains (active loops), restated with shorter collector wording in `domains/README.md` § Anvilry Domains):

| Domain | Goal | Cadence | Collector |
|---|---|---|---|
| `content` | Keep the portfolio content fresh, consistent, and discoverable | `weekly` | MDX files + Velite output; `/api/cron/content-audit` (18-month staleness flags) |
| `seo` | Maximize organic reach via structured data, sitemap, and canonical URLs (`llms.txt` stays as a coding-agent surface, not a search lever) | `weekly` | `/api/cron/seo-audit` (route 200-checks + missing summaries); Vercel Analytics and Search Console are read by hand |
| `performance` | Keep Core Web Vitals green; catch bundle regressions before they ship | `on PR` (frontmatter: `cadence: on-pr`) | `pnpm build` per-route first-load stats, gated by `scripts/bundle-budget.mjs` in the CI `e2e` job; local `pnpm analyze` for module attribution; Vercel Speed Insights dashboard for web-vitals |

**The `performance` row's Collector is the one whose meaning changed — and its Goal became true for the
first time.** Both sources (the `performance` row of the two domain tables) used to say "`pnpm build` bundle
analysis" and now name the real collector; the `content` and `seo` rows were likewise rewritten to name their
cron audits (`seo` also dropped `llms.txt` from its goal). The old wording meant `@next/bundle-analyzer`
driven by `.github/workflows/bundle-analysis.yml`, a workflow that produced **zero artifacts across its
entire 222-run life (211 green, 11 red)** — so nothing was ever caught "before it ships". That workflow is
**deleted**. The collector is now `.next/diagnostics/route-bundle-stats.json`, which a bare `next build`
writes with no flag but **only under Turbopack**, read by `scripts/bundle-budget.mjs` in the "Bundle
budget" step of `ci.yml`'s `e2e` job (`.github/workflows/ci.yml:190-191`) — placed immediately after that
job's Build step (`ci.yml:177`) so it rides the build that already happens rather than adding a
second one. It carries no `continue-on-error` and no `if-no-files-found`, and a missing or malformed
artifact exits 1 by design. `cadence: on-pr` is now honest too: `ci.yml` triggers on every push and on PRs
into `develop`/`main` (`.github/workflows/ci.yml:3-7`). `@next/bundle-analyzer` survives as a **local
attribution tool only** — `pnpm analyze` (`package.json:12`), which needs an explicit `--webpack`
precisely because a bare `next build` is Turbopack and the analyzer is webpack-only.

Three structural facts a maintainer should know:

- **`signals/` is empty; `docs/` no longer is.** `signals/` contains only its schema README (zero signal
  files). `docs/` holds `configuration.md`, `next-upgrade-plan-2026-09.md`, `index/`, and
  `superpowers/plans/` (17) + `superpowers/specs/` (6), and `docs/README.md` §Existing Docs
  (`docs/README.md:36-44`) lists all five. Every domain's
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
- **`domains/performance/README.md` is a documented perf contract with one executable guard.** Its §Regression
  guards list has five entries and the first is marked **✅ ENFORCED** (the first bullet of that section).
  `ci.yml:190-191` runs `node scripts/bundle-budget.mjs`, which fails the job if (a) any route's
  `firstLoadUncompressedJsBytes` exceeds `MAX_FIRST_LOAD_BYTES` = **1,336,000 B**
  (`scripts/bundle-budget.mjs:72`), (b) fewer than `MIN_ROUTES` = **17** route records are present
  (`scripts/bundle-budget.mjs:40`, the 16 `page.tsx` routes plus `/_not-found`), or (c) the `WebGLRenderer`
  marker (`LAZY_MARKER`, `scripts/bundle-budget.mjs:84`) turns up in any route's first-load chunk set. The
  comment above the ceiling records `/` at 1,333,521 B after the last raise, leaving about 2,479 B of
  headroom, so the budget is now tight. The single three.js chunk is 897,249 B, present in 0 of the 17 route
  records' first-load sets (the script's own comment says "17 routes"). The remaining **four** guards still fail *silently*, including "`src/lib/r3f.ts`
  is load-bearing … do not delete it on the theory that '16.3 handles this now'"
  (`domains/performance/README.md:78-80`). The enforced guard explicitly does **not** cover a duplicate
  `three` copy that stays off the critical path, which remains a manual grep. The baseline in that README
  (`domains/performance/README.md:84-94`) — "exactly 1 three.js copy, 1248 KB total across R3F chunks,
  113/113 static pages" — is a Turbopack measurement, so the 876 KB single-chunk three.js number was never
  a webpack number. The copy count is `grep -l "WebGLRenderer" | wc -l`, which must be 1; the looser `grep -lE "react-three|THREE\." | wc -l`
  returns 5 (chunks *referencing* R3F, **not** the copy count) and the narrower `grep -l "react-three"`
  returns 2 and would read as a phantom regression. That README's own gate numbers were re-pointed at the
  current constants in the same pass — see Doc-vs-code drift, item 16.

### CI-enforced gates (all in `.github/workflows/ci.yml`)

`ci.yml` has **five** jobs and the repo has **five** workflow files (`ci.yml`, `codeql.yml`,
`dependency-review.yml`, `gitleaks.yml`, `scorecard.yml`).

| gate | where | what it enforces |
|---|---|---|
| Codebase index citations | job `ci`, step at `ci.yml:76-77` | `node scripts/check-index-citations.mjs`: cited text still exists; fails a PR, never a deploy (rationale in the comment at `ci.yml:67-71`) |
| Claims integrity chain | job `ci`, `ci.yml:83-84` | `npx tsx scripts/seal-claims.ts` verifies `data/integrity-chain.json`'s hash chain and that `impactMetrics`/`achievements` in `src/lib/profile.ts` still match the last seal (`src/lib/claims-integrity.ts`, `src/lib/integrity-chain.ts`) |
| Claims integrity auto-commit | job `claims-integrity-autocommit`, `ci.yml:86-135` | Opt-in: runs only when repo variable `SEAL_CLAIMS_AUTO_COMMIT == 'true'`; re-seals and commits with `[skip ci]` |
| E2E + bundle budget | job `e2e`, from `ci.yml:137` | Playwright suite, "wired in deliberately" because `pnpm e2e` was referenced by no workflow before (`ci.yml:143`); `node scripts/bundle-budget.mjs` after `pnpm build` (`ci.yml:190-191`) |
| pnpm 11 install | job `install-pnpm-11`, from `ci.yml:204` | Cold install on pnpm 11 must not modify tracked files; runs `src/lib/pnpm-build-allowlist-consistency.test.ts` (`ci.yml:253`) |
| Security alerts | job `security-alerts`, from `ci.yml:255` | Non-blocking Dependabot-alert report; needs `SECURITY_ALERTS_TOKEN` |

`pnpm build` also chains `vitest run`, so a failing test blocks a production build; the build script then
runs `pagefind` (`package.json:11`), which is why `make search-index` is only a manual re-run.

**How the citation gate decides.** `docs/index/.citations.json` maps each `path:line` key to a 12-hex SHA-256
fingerprint of the trimmed line, the list of index files that cite it, and a 100-char preview. The script
re-extracts citations from `docs/index/*.md` in three forms (fully qualified path, unique partial path,
unique bare basename), re-fingerprints, and on a mismatch searches the file for the recorded preview:

| outcome | meaning | exit |
|---|---|---|
| ERROR "text gone" | the recorded text is nowhere in the file, or is duplicated and matches no line shift seen elsewhere in that file | 1 |
| ERROR structural | file missing, line past EOF, inverted range (`a-b` with b < a), or a blank target | 1 |
| warning "moved" | the text now sits at exactly one other line; the offset is printed | 0 (1 with `--strict`) |
| warning "ambiguous" | duplicated text, but one position matches an offset seen elsewhere in the file | 0 (1 with `--strict`) |
| warning "re-pointed" | a formerly cited key is no longer cited, and its text is at one line nothing cites | 0 (1 with `--strict`) |

Limits worth knowing: only the cited *text* is enforced, not its position; context-relative citations such as
`(:44)` and ambiguous bare filenames are counted but never checked; and files under `.claude/` (skills, the
`ship-change.js` workflow) and `LOG.md` are not citable, so line numbers quoted from them in this file are
unchecked. `--write` re-fingerprints but refuses while any error (or, without `--accept-warnings`, any warning)
is open. Because the snapshot is regenerated in the same commit as the prose it validates, a green run is not
independent evidence that the prose is right.

## Agent harness

Five skills live under `.claude/skills/`, each with YAML frontmatter (`name`, `description`,
`user_invocable: true`). Triggers below are the literal phrases from each `description`.

| Skill | Trigger (from frontmatter) | What it does |
|---|---|---|
| `dev-local` | "dev-local up", "start the stack", "bring up Anvilry locally", "start dev server" | The only Anvilry-*specific* skill. Port map (Next.js dev = 3000, single service), prerequisites (Node 22+, pnpm, `.env.local` via `vercel env pull`), then `up`/`verify`/`content`/`test`/`build` command blocks with absolute paths — the `up` block `cd`s into the primary `sairam-dev` checkout, so run from a worktree it would start the wrong tree. `verify` greps the homepage for "Sairam" and POSTs a 5s-capped `/api/chat` probe (`SKILL.md:34-40`). |
| `e2e-setup` | "set up e2e", "add end-to-end tests", "scaffold a test gate" | Generic. System E2E belongs in a dedicated top-level package (it spans all apps, so belongs to none); the skill says the suite **never boots the app itself** (`SKILL.md:24-25`), although the repo's own `playwright.config.ts` declares a `webServer` (`playwright.config.ts:37`) and v3.4.2 added it (`CHANGELOG.md:654`). Practices: real flow not bypass (read OTP from a local mail server), verify auth *itself* once then bypass everywhere else via a session helper, layered client → server → product assertions, stable role/label selectors, fresh data per run. Failure triage = real bug / stale test / flaky-env, and "never weaken or delete an assertion just to go green" (`SKILL.md:60`). |
| `pr` | "open a PR", "ship this", "raise a PR", "/pr" — "Never opens a PR until the feature is verified" | Splits verification by who's best at it: the subjective "does the feature do what was intended?" goes to a **fresh read-only verifier sub-agent** that drives the real app and returns a fixed `FEATURE: works \| broken` block; objective checks (type-check, lint, unit, e2e) are run by the orchestrator afterwards as a regression sweep (`SKILL.md:14-23`). Verifier loop capped at ~3 rounds, then escalate. The PR body leads with the feature proof and a reviewable video URL (a `pr-evidence` GitHub prerelease, a bucket, or CI artifacts) because GitHub cannot play video inline via automation (`SKILL.md:68-70`). |
| `new-loop` | "set up a new loop", "create a domain", "start a new beat/workstream", or naming a recurring job | Gathers 5 inputs (name, goal, cadence, what-it-does, tools/data), bootstraps the KB substrate only if `ARCHITECTURE.md`+`LOG.md`+a CLAUDE.md knowledge-base section are missing (via `references/KNOWLEDGE_SETUP.md`, idempotent), scaffolds `domains/<name>/README.md`, then **does ONE real test run at small scale**. Producing an artifact is optional; two outputs are mandatory — a dated line in the loop's `## Timeline` and one `LOG.md` entry (`SKILL.md:68-77`). Stops and asks if `domains/<name>/` already exists. |
| `setup-codebase-harness` | "set up the harness", "make this repo agent-ready", "harness this codebase" | Master orchestrator over `dev-local-setup`, `e2e-setup`, `crabbox-setup`, `pr`. Three pillars: **Legible** (shrink the root agent doc to a ~100-line table of contents; promote prose golden rules into mechanical lints whose error messages *inject the fix*), **Executable** (one-command stack; per-agent cloud box when loops run concurrently, because one laptop can't host N stacks), **Verifiable** (E2E gate + `pr`). Declared order: `1a (map) → 2 (dev-local) → 3 (e2e + /pr)`, then `1b (lints)` and `4` (`SKILL.md:91`). |

### `ship-change.js` workflow phases

`meta.phases` (`ship-change.js:7-14`) declares six titles: **Setup → Implement → Simplify → Review →
Verify → PR**. Read from the actual control flow:

| Phase | Gate / behaviour | Output schema |
|---|---|---|
| **Setup** | Always runs. Requires `args.task` + `args.repo` or throws (`:21-25`). Defaults: `baseBranch = 'develop'` (`:26`), `openPr` true unless `false` (`:29`), review on unless `runReview === false` **or** `runCodex === false` (`:31`, back-compat). Creates a worktree at a sibling `<repo>-worktrees/<branch-slug>` — explicitly **outside** the main checkout (`:62`). Two non-obvious steps: (6) copies gitignored `.env`/`.env.*` files into the worktree, because `git worktree add` only populates version-controlled files and a missing `.env` "silently blocks later verification" (`:65-69`); (7) warms `node_modules` — fast path `cp -c -R` (APFS clonefile, copy-on-write) valid only when the lockfile diff is identical, else `pnpm install --prefer-offline`, recorded as `depsWarmed: clone \| install \| skipped \| none` (`:70-74`). Also probes `<worktree>/.claude/skills/pr/SKILL.md` → `hasPrSkill` (`:75`). Aborts the whole run if no `worktreePath` comes back (`:81-84`). | `worktreePath`, `branch`, `baseRef`, `hasPrSkill`, `envFilesCopied[]`, `depsWarmed`, `notes` |
| **Implement** | Works only inside the worktree; **does not commit** — a later stage commits once (`:119`). Instructed to investigate first, prefer new pure logic in its own framework-free module, and not gold-plate. | `filesChanged[]`, `summary`, `decisions[]`, `openConcerns[]` |
| **Simplify** | "SIMPLIFY ONLY — do not hunt for bugs, do not change behavior, do not expand scope" over `git --no-pager diff`; reuse/dedup, readability, efficiency, correct altitude. Behaviour must stay identical (`:151-156`). | `changesMade[]`, `summary` |
| **Review** | Skipped when `runReview: false` (`:204-206`). Blocking issues only — correctness, runtime/env incompatibility, security (injection/escaping/authz), regressions, pathological regex/perf, type errors; style nits are out (Simplify already ran). Uses Codex CLI/MCP for an independent second opinion when authenticated and sets `usedCodex` accordingly; otherwise reviews itself "just as rigorously" (`:193-195`). Fixes what it confirms, does not commit. | `usedCodex`, `blockingIssues[{issue,severity,file,fixed}]`, `fixesApplied[]`, `verdict` |
| **Verify** | **Skipped entirely** when `openPr && hasPrSkill` — the repo's own `/pr` skill runs its heavier app-driving verification instead (`:211-218`). Otherwise: discover commands from package.json/turbo.json/Makefile, prefer scoped fast checks over full builds, apply minimal fixes and re-run a few times, and honestly populate `couldNotVerify`. `passed` may only be true if the relevant checks for the changed code pass (`:249`). | `passed`, `commands[{cmd,ok,note}]`, `couldNotVerify[]`, `summary` |
| **PR** | Three branches. `openPr: false` → stop, changes left uncommitted in the worktree (`:270-271`). `hasPrSkill` → commit with a Conventional Commit message, then read `<worktree>/.claude/skills/pr/SKILL.md` and follow it EXACTLY, letting that skill gate the PR (`:272-288`). Else → only if `verify.passed`: commit, `git push -u origin <branch>`, `gh pr create --base <base> --head <branch>` (`:289-304`). If verification fails, no commit and no PR (`:305-309`). Any push/`gh` auth failure returns `prUrl: ''` with the reason in `summary` rather than forcing anything. | `prUrl`, `branch`, `commit`, `summary` |

Final return value is `{ setup, impl, simp, review, verify, pr, worktree, branch }` (`:311`). Every later
phase operates inside the worktree, never the original checkout (`:104`). The rules that no phase commits early,
that nothing force-pushes, and that a failed push returns `prUrl: ''` are prompt instructions to the agents, not
sandbox enforcement.

### Harness tool state

`.claude/proven-config.json` is a Ruflo `ruflo.proven-config/v1` manifest, not app config: `championId`
`sha256:6141a8ea…` with policy values `{alpha: 0.3, subjectWeight: 1, mmrLambda: 0.5, bodyWeight: 1.5,
typePenaltyFactor: 0.5}`, `layer: "framework/node-cli"`, `compatibility.ruflo: ">=3.24.0"`, benchmark corpus
`ADR-081-labelled-v1`, and a receipt (`heldOutDelta` 0.0738, `redblue: "PASS"`, `drift: 0`,
`canary.rollbackRate: 0`, `latencyP95` ≈ 244.6 ms, `receiptCoverage: 1`). `.claude/.proven-config-version`
holds the same hash as its only line. No Anvilry source file references either. Both are listed in
`.gitignore` (`.gitignore:68-69`), so they exist only in the primary checkout.

The rest of the local agent state is also gitignored and machine-local (`.gitignore:46`, `.gitignore:53`,
`.gitignore:63-67`): `.gstack/` (a gstack browse audit log, `browse-audit.jsonl`),
`scratch-pad/` (daily logs, backlog, one-off scripts), `.claude-flow/` and `.swarm/` (Ruflo policy, neural and
AgentDB state; tens of MB), `ruvector.db` and `agentdb.rvf*`. These are written into the *current working
directory*, so a `cd` into a subdirectory such as `docs/index/` can drop a second stray copy there; the
ignore patterns are unanchored, so it stays uncommitted, but it is dead weight. `.superpowers/sdd/` (a
`<plan>/` directory per recent plan; older plans' files sit flat) holds the subagent-driven-development
ledgers (`progress.md`, `task-N-brief.md`, `task-N-report.md`, and `review-<sha>..<sha>.diff` files); the
directory ignores itself (`.superpowers/sdd/.gitignore` is `*`) and is
where real plan status lives, since no plan file has a ticked checkbox.

## Doc-vs-code drift

Each item cites the doc line and the code that disproves it. Conservative — plan/spec files are excluded as
drift because they are dated point-in-time artifacts, except where called out as such. Most root docs were
corrected in the same change set as this index, so items about `CLAUDE.md`, `README.md`, `TELEMETRY.md` and
`docs/configuration.md` cite those files mostly by section heading rather than line number: they move with
every edit, and a stale line number is worse than none. Re-derive a reference from its heading.

**Not every item below is live.** Status by item:

- **Corrected, kept as history** (heading struck through): 1, 2, 3, 4, 6, 7, 9, 10, 11, 12, 16, 17, 19, 21,
  22, 23. The citations beside a struck heading point at the **corrected** text, and where a test now prevents
  regression it is named. Items 9 and 10 had been corrected once before and went stale again as the code
  grew; items 16, 17, 19 and 21-23 were found in this pass and closed by the same change set; item 7 was
  closed by the final cross-document consistency pass, which also fixed `VOICE.md`'s "shared with chat"
  rate-limit wording (a row of the table in [15](./15-invariants-and-gotchas.md)).
- **Still live**: 5 (reframed: only the dev-local skill is still wrong), 8, 13, 14, 15 (the CHANGELOG
  half), 18, 20.

1. ~~**Model-chain order in `DEPLOY.md` is inverted.**~~ — **corrected, both chains.**
   `DEPLOY.md` used to table Primary = `us.anthropic.claude-opus-4-6-v1`, Secondary =
   `us.anthropic.claude-sonnet-4-6`, and to say the `anthropic` chain becomes
   `claude-opus-4-7 → claude-sonnet-4-6 → claude-haiku-4-5` — both inverted relative to the code. Current
   state (Opus became an opt-in rung on 2026-10-01): `DEPLOY.md:94` = Primary `us.anthropic.claude-sonnet-4-6`, `:95` = Behind a 5.x primary,
   `:96` = Opt-in `us.anthropic.claude-opus-4-6-v1`, `:97` = Last resort `us.anthropic.claude-haiku-4-5-20251001-v1:0`, and
   `:100` = `claude-sonnet-4-6 → claude-haiku-4-5` (Opus behind the primary when `LLM_USE_OPUS_FALLBACK=true`). Both match `bedrockChain()`
   (`src/lib/llm.ts:118-126`, Haiku at `:124`) and `anthropicChain()` (`src/lib/llm.ts:129-137`), built by `buildChain()` (`:102-110`). They
   are functions rather than module-level consts because the primary rung is conditional on
   `isSonnet5PrimaryEnabled()` (`src/lib/llm.ts:46`), i.e. `LLM_USE_SONNET_5 === "true"`, which swaps the
   primary to `us.anthropic.claude-sonnet-5` / `claude-sonnet-5` (`LLM_USE_SONNET_5_5 === "true"` wins over it and swaps in `global.anthropic.claude-sonnet-5-5` / `claude-sonnet-5-5`). The same edit added a standing rule at
   `DEPLOY.md:103-107` — "Both chains are **Sonnet-primary**, not Opus-primary … that file is
   authoritative if this table ever disagrees with it". `CLAUDE.md` § LLM / Chat Architecture and
   `docs/configuration.md` §1 (the "Model fallback chain" block) always stated the correct order. The earlier residual gaps are closed too:
   that rule's source pointer now names `bedrockChain()` / `anthropicChain()` instead of the old
   `BEDROCK_CHAIN` `:31-35` / `ANTHROPIC_CHAIN` `:38` pointers, and the `LLM_USE_SONNET_5` toggle is
   documented in `DEPLOY.md` §7, `CLAUDE.md`, `README.md` and `docs/configuration.md`. No test guards the
   chain tables; the anchor is that pointer. (`CHANGELOG.md:988-990` records fixing the same
   inversion once already, in a `streamWithFallback` docblock at v1.8.0 — so this is the second
   recurrence, which is why the authoritative-source note was added rather than just the numbers.)
2. ~~**MCP tool count is 9, not 7.**~~ — **corrected, and guarded; the count has since grown to 10.**
   `CLAUDE.md` used to say "**7 tools**" with a seven-row table. The route
   `src/app/api/mcp/[transport]/route.ts` now calls `server.registerTool` **ten** times — the original seven,
   `list_all_content`, `get_content_item`, and a tenth, `list_decisions`, added with the decisions ledger.
   Current state: `CLAUDE.md` § MCP Server says **10 tools** with all ten tabled, its Key Files row says
   "MCP server (10 read-only tools)", the route's own docblock says "10 read-only tools", and the public
   `/mcp` page (`TOOLS` in `src/app/mcp/page.tsx:40-60`) tables all ten. **Guard:**
   `src/app/mcp/tools-documented.test.ts` asserts set equality between the page's `TOOLS` rows and the
   route's `registerTool` calls (`:92`; the "documents every tool the route registers" case names the
   missing tools in its failure message). `vitest run` is chained into `pnpm build`, so adding a tool
   without documenting it fails the build. That is why the count is safe to quote (`CLAUDE.md` § MCP
   Server says the same). `CHANGELOG.md:867` records the 7 → 9 growth at v3.0.0, and `CHANGELOG.md:531-533`
   records the doc fix landing in v3.5.0.
3. ~~**"Every API route runs on the Node.js runtime … with a 30s max duration" is doubly stale.**~~ —
   **corrected.** `CLAUDE.md` § Route Tree now leads with "**Runtime & duration — do not add
   `export const runtime`.** No route exports `runtime` anywhere in `src/`" and states that `maxDuration` is
   "**per-route, not a uniform 30s**", followed by the real per-route table. Measured from
   `export const maxDuration` in each `route.ts`: 60 for `cron/{eval,seo-audit,content-audit}`, 30 for
   `mcp/[transport]`/`cron/github-sync` (`chat` moved from 30 to 60 in v3.11.0), 25 for `cron/health-check`, 20 `transcribe`, 15
   `tts`/`tts-google`, 10 `admin/faq-cache/purge`, 5 `error`, none for `visit`/`github/stats`/`md/*`/
   `resume.json`. The table now has the row for the purge route's 10 as well. The only
   `export const runtime` text left in `src/` is the comment noting its removal in the MCP route
   (`src/app/api/mcp/[transport]/route.ts:6-8`), consistent with `CHANGELOG.md:736-738` (13 `runtime`
   exports deleted for Cache Components).
4. ~~**`pnpm search-index` does not exist.**~~ — **corrected.** `CLAUDE.md` used to list
   `pnpm search-index` under "After build". The `scripts` block of `package.json` has no `search-index`
   entry; the target is `make search-index` (`Makefile:65-66`, which runs
   `pnpm pagefind --site .next/server/app --output-path public/pagefind`). Current state: `CLAUDE.md`
   § Commands carries the explicit warning "**NOTE:** this is a Makefile target only — there is NO
   `pnpm search-index` script" immediately above the `make search-index` line. `docs/configuration.md`
   always said `make search-index`. Since then `pnpm build` itself chains `pagefind` (`package.json:11`), so
   the make target is only for regenerating the index without a full rebuild (its own help text says so).
5. **Velite watch in `pnpm dev`: the claim is right in effect; one skill still gets the mechanism wrong.**
   *(Still live for one file, and the earlier version of this item was itself wrong.)* This item used to say
   Velite does not watch during `pnpm dev`. It does: `next.config.ts` starts `build({ watch: true, clean:
   false })` from `velite` at module load when `process.argv` includes `dev`, guarded by `VELITE_STARTED`
   (`next.config.ts:9-16`). So `CLAUDE.md` § Commands ("starts Velite watch + Next.js dev") was always
   accurate, and `README.md` § Develop, which used to credit `predev` with the watch mode, now says
   "predev runs Velite once; next.config.ts then keeps it in watch mode". What is still inaccurate is
   `.claude/skills/dev-local/SKILL.md:29` ("This runs `velite --watch & next dev`"): `package.json:9-10` is
   `"predev": "velite"` (a one-shot build) + `"dev": "next dev"` — no `--watch` and no `&`. The same skill
   says two lines later (`:30-31`) that `predev` runs Velite once, and `CLAUDE.md` § Content Layer likewise
   describes `predev` as running "Velite synchronously before `next dev` starts". The watcher is keyed on
   `process.argv.includes("dev")` (`next.config.ts:12-13`), so it starts for `next dev` however it is
   invoked and never for `next build`.
6. ~~**The route tree in `CLAUDE.md` lists one cron route; there are five.**~~ — **corrected.**
   The tree used to show only `/api/cron/eval` and to omit the `.md` handlers. Current state: `CLAUDE.md`
   § Route Tree lists `/api/cron/{eval,health-check,github-sync,seo-audit,content-audit}` with "5 crons, ALL
   fail-closed on CRON_SECRET (`vercel.json:3-7`)", `/api/md/{articles,notes,projects,work}/[slug]
   raw-markdown passthrough (4 handlers)`, and now also `/api/admin/faq-cache/purge` and the `/decisions`
   page. All of it matches `src/app/api/cron/` and the four `src/app/api/md/*/[slug]/route.ts` files.
7. ~~**`SECURITY.md` under-states the attack surface.**~~ — **corrected.** `SECURITY.md:5` used to say "a
   Next.js frontend with three API routes (`/api/chat`, `/api/tts`, `/api/transcribe`)". `src/app/api/` has
   twelve route entries: `admin` (`faq-cache/purge`), `chat`, `cron` (×5), `error`, `github`, `mcp`, `md` (×4),
   `resume.json`, `transcribe`, `tts`, `tts-google`, `visit` — 19 `route.ts` handlers under `src/app/api`.
   Only `chat`, `tts`, `tts-google`, `transcribe` and `error` call `checkRateLimit` (classes `chat`,
   `voice`, `voice`, `voice`, `beacon`); the five cron routes are gated fail-closed on `CRON_SECRET` by
   `unauthorizedUnlessCron` in `src/lib/cron-auth.ts`, and the purge route by `requireAdmin`
   (`src/lib/admin-auth.ts`). The sentence at `SECURITY.md:5` now names the four cost-bearing routes plus the
   error beacon behind per-class rate limiting, the public read-only MCP server, the Basic-auth admin routes
   and the `CRON_SECRET`-gated crons, with no hard-coded route count.
8. **`VOICE.md`'s settings tables omit the Google TTS engine.** *(Still live.)* `VOICE.md:156` ("TTS engines |
   `"browser"` … | `"polly"`") and `VOICE.md:373` (`ttsEngine` type `"browser" | "polly"`) contradict
   `src/lib/voice-settings-context.tsx:29`: `export type TtsEngine = "browser" | "polly" | "google";`.
   `VOICE.md`'s own §7 (line 873) and `docs/configuration.md` §15 both describe the `google` engine, so
   only §1/§3 are stale. Same section: `VOICE.md:162` calls the Polly voice "Joanna" a fixed property,
   which §7's catalog (`src/lib/voice-catalog.ts`, curated plus extended voices) supersedes. (`CLAUDE.md`
   § Voice Layer used to name a non-existent `src/lib/voice-settings.ts`; it now names
   `src/lib/voice-settings-context.tsx`.)
9. ~~**Terminal command count is understated.**~~ — **corrected, again.** *(It had been corrected to 31
   once and went stale when the code grew.)* `README.md`, `ARCHITECTURE.md` and `CLAUDE.md` used to say
   **31** commands. The `COMMANDS` registry in `src/components/game/terminal/commands.ts:689-722` has
   **32** entries: **28** visible (`help, whoami, neofetch, ls, cat, tree, grep, find, top, stats, stack,
   awards, integrity, summary, career, about, resume, open, contact, email, social, chat, theme, classic,
   developer, cd, clear, sudo`) plus **4** hidden eggs (`secret, personal, uses, now`) that are
   dispatchable but filtered out of `COMMAND_NAMES` (`src/components/game/terminal/commands.ts:745`) by
   `hidden: true`. The extra visible command is `integrity` (added with the claims-integrity ledger).
   Current state: `README.md` § Highlights (the Developer bullet: "32 commands (28 visible + 4 hidden easter
   eggs …)"), `ARCHITECTURE.md` § Repo layout (the `terminal/` line: "32 commands: 28 visible + 4 hidden, combobox") and `CLAUDE.md` § The
   View System (the `developer` row) all say 32. No test pins the count; re-derive it from the `COMMANDS`
   object if it looks stale again.
10. ~~**`docs/README.md`'s inventory is stale.**~~ — **corrected, again.** *(It first claimed no docs, was
    fixed to a four-row table, and fell behind again.)* `docs/README.md` §Existing Docs
    (`docs/README.md:36-44`) now tables `configuration.md`, `index/`, `superpowers/plans/` "17 dated
    implementation plans", `superpowers/specs/` "6 dated design specs" and `next-upgrade-plan-2026-09.md`,
    matching the disk: 17 plans and 6 specs (the 2026-09-07 phase 1-3 plans and the decisions/integrity
    design spec are the additions). `docs/index/` itself holds 17 markdown files (`README.md`, `01`..`13`,
    `14`, `14b`, `15`) plus `.citations.json`.
11. ~~**`CLAUDE.md`'s CI description is out of date on jobs, workflows and line refs.**~~ — **corrected.**
    `.github/workflows/ci.yml` defines **five** jobs: `ci` (`:10`), `claims-integrity-autocommit` (`:86`),
    `e2e` "E2E (Playwright)" (`:137`), `install-pnpm-11` (`:204`), and `security-alerts` (`:255`), and the
    directory has **five** workflows (`ci.yml`, `codeql.yml`, `dependency-review.yml`, `gitleaks.yml`,
    `scorecard.yml`). `CLAUDE.md` § Branch Model & CI used to describe `ci.yml` as "lint → typecheck
    (`tsc --noEmit`) → `pnpm test`" plus one sentence on the `e2e` job's bundle-budget step; it omitted the
    codebase-index-citations step (`ci.yml:76-77`), the claims-integrity step (`ci.yml:83-84`) and three of
    the five jobs, said "**three workflows**", and cited the bundle-budget step as `ci.yml` lines 110-111
    (it is at `ci.yml:190-191`). It now lists all five jobs and all five workflows and refers to the
    bundle-budget step by name. `e2e` and `security-alerts` arrived in v3.4.2 (`CHANGELOG.md:649-653`);
    `install-pnpm-11` shipped in `[3.6.0]` (`CHANGELOG.md:464-482`).
12. ~~**`DEPLOY.md`'s build command drops the test and search steps.**~~ — **corrected.** `DEPLOY.md` §1
    used to say "Build command: `pnpm build` (runs `velite --clean && next build`)". `package.json:11` is
    `"build": "velite --clean && vitest run && next build && pagefind --site .next/server/app --output-path
    public/pagefind"`. `DEPLOY.md` §1 now spells out all four steps and says a failing test aborts the
    deploy; `README.md` § Develop (`pnpm build  # velite --clean && vitest run && next build && pagefind`)
    and `CLAUDE.md` § Commands (the `pnpm build` comment) match. A failing test also blocks the search
    index, and `pagefind` runs on every build even though the search flag defaults off.
13. **Plan-vs-shipped, flags package (informational, plan is dated).** *(Still live.)*
    `docs/superpowers/plans/2026-06-18-vercel-flags-sdk.md:51,76` prescribes `pnpm add @vercel/flags` and
    `import { flag } from "@vercel/flags/next"`. The shipped code is `import { flag } from "flags/next"`
    (`src/lib/flags.ts:10`) with `"flags": "^4.3.0"` in `package.json:43` — the renamed package.
    `docs/configuration.md` §14 documents `FLAG_DRIVER`/`FLAGS`/`FLAGS_SECRET` without naming a package,
    so it is not itself wrong.
14. **Template-vs-instantiation mismatches in the knowledge base.** *(Still live.)*
    `.claude/skills/new-loop/references/LOG.md:4` seeds "Newest at the **BOTTOM**". The repo's `LOG.md:4`
    states "Newest first. Append an entry **above** older entries", and its three entries are ordered
    newest-first (2026-08-15, 2026-08-15, 2026-06-24). Anyone following the reference template verbatim
    would append in the wrong direction. Two more of the same kind: `new-loop/SKILL.md:73` writes its LOG
    entry with tag `#ops`, which is not in `LOG.md`'s tag vocabulary (`LOG.md:14-15`, "reuse before
    inventing"); and the signal `status` values differ — `signals/README.md:22` says
    `open | reviewed | closed`, while `.claude/skills/new-loop/references/KNOWLEDGE_SETUP.md:56` copies a
    template with `open | triaged | actioned | closed`. `LOG.md` itself has no entry after 2026-08-15, so
    it is silent on v3.5/v3.6 and all later work.
15. **Version-marker skew (not a code contradiction, but a freshness trap).** *(Half closed.)*
    `ARCHITECTURE.md:8` is stamped "`**Version:** v1.0.0 — knowledge base bootstrapped 2026-06-24`" while
    the project is at `3.13.0`; the marker versions the knowledge-base model, not the app, and the new
    `**Scope:**` line at `ARCHITECTURE.md:9` now says so. Still live: `CHANGELOG.md:1270-1278` has link
    references only for `1.0.0`–`1.6.0`; `1.7.0` and everything after it, through `[3.13.0]`, have no
    link-ref footer entry.
16. ~~**Bundle-budget numbers are stale in `domains/performance/README.md` and `CLAUDE.md`.**~~ —
    **corrected.** The live gate is `MAX_FIRST_LOAD_BYTES = 1_336_000` (`scripts/bundle-budget.mjs:72`),
    `MIN_ROUTES = 17` (`:40`), marker `LAZY_MARKER = "WebGLRenderer"` (`:84`). `domains/performance/README.md`
    used to quote a **1,285,000 B** ceiling, `/` at 1,220,794 B and ~5% headroom, and `CLAUDE.md` § Branch
    Model & CI the same 1,220,794 B / ~5% figures plus `bundle-budget.mjs` line citations. Both now quote
    1,336,000 B and `MIN_ROUTES` = 17: the performance README tells the reader to re-measure with
    `pnpm build && node scripts/bundle-budget.mjs` rather than quote a percentage, and `CLAUDE.md` calls the
    figure a ceiling with about 2.5 KB of headroom. The comment above the constant records `/` at
    1,333,521 B after the last raise, about 2,479 B of headroom, so treat the headroom as thin. `CHANGELOG.md:474` (v3.6.0) records 1,285,000 B, correct for that release and
    superseded since; `docs/next-upgrade-plan-2026-09.md` (a draft) records another live run, `/` at
    1,330,764 B with 5,236 B (~0.39%) of headroom.
17. ~~**Other stale facts in `CLAUDE.md`.**~~ — **corrected.** Seven claims were stale and are now right.
    (a) § Environment Variables said the base URL is hardcoded in "**19 files / 25 occurrences**";
    `grep -rn 'anvilry\.vercel\.app' src Makefile` returns 33 lines in 24 files (including tests), which is
    what it now says. (b) § Content Layer said "at v3.4.2 all five notes carry `generatedBy: inkforge`" and
    that `inkforgeNotes` equals every note; `content/notes/` has 7 notes and two
    (`tombstone-v1-2-release.mdx`, `trelix-code-intelligence-engine.mdx`) have no `generatedBy`, which it now
    says. (c) § Rate Limiting & Telemetry said `/api/chat`, `/api/tts`, `/api/transcribe` share "8 req/min per
    IP"; the limiter (`src/lib/rate-limit.ts`) has three independent 8-per-60s sliding windows keyed by
    `RateLimitClass` (`chat`, `voice`, `beacon` → prefixes `anvilry:chat`, `anvilry:voice`,
    `anvilry:beacon`), `/api/error` uses `beacon`, `tts-google` is also `voice`, and a valid `CRON_SECRET`
    bearer bypasses (eval cron). It fails open when Upstash is unconfigured or the limiter throws. (d)
    § Environment Variables labelled `CRON_SECRET` as "/api/cron/eval protection"; all five cron routes use
    it. (e) § Key Files called `view-context.tsx` a "4-view external store" (the `View` union has six
    members) and `view-router.tsx` the "View switcher component" (the pill switcher is
    `view-switcher.tsx`). (f) § Runtime & duration cited `next.config.ts` line 183 for `cacheComponents` (it
    is at `next.config.ts:203`). (g) § MCP Server sent readers to `src/app/mcp/page.tsx` lines 35-45 for the
    `TOOLS` table (it is at lines 40-60). `CLAUDE.md` no longer cites those line numbers.
18. **Skills point at sub-skills that do not exist.** *(Still live.)* `setup-codebase-harness/SKILL.md` (lines 26-27,
    57-60), `pr/SKILL.md` (lines 24, 30), `e2e-setup/SKILL.md` (lines 15, 24-26) and `new-loop/SKILL.md`
    (line 89) name `dev-local-setup` and `crabbox-setup`; `.claude/skills/` contains only `dev-local`,
    `e2e-setup`, `pr`, `setup-codebase-harness` and `new-loop`. `e2e-setup` also states the suite never boots
    the app, while `playwright.config.ts:37` declares `webServer: { command: "pnpm start", … }` with
    `reuseExistingServer: !process.env.CI`, which needs a prior `pnpm build` (`pnpm start` serves the production
    build).
19. ~~**`TELEMETRY.md` lists seven span kinds; the schema has eight.**~~ — **corrected.** `TELEMETRY.md`
    § Span kinds used to end at `budget.tick`; `KIND_LITERALS` in `src/lib/telemetry/schema.ts` also contains
    `chat.cache` (the FAQ response-cache hit/miss event). Its "Upstash command budget" note ("~5
    commands/request", "move `zremrangebyscore` from per-emit to a daily Vercel cron") was also stale:
    `emit()` in `src/lib/telemetry/emit.ts` runs the retention trim on roughly 1 in `TRIM_SAMPLE_EVERY` (20)
    events (`event.ts % TRIM_SAMPLE_EVERY === 0`, `emit.ts:85`), for exactly the quota reason the note
    worried about. `TELEMETRY.md` now tables all eight kinds, marks `tts.request`, `transcribe.request` and
    `budget.tick` as declared but never emitted (nothing in `src/` writes them), and describes the sampled
    trim.
20. **`next.config.ts` still carries a "Report-Only" comment for an enforced CSP.** *(Still live.)* The doc-comment at
    `next.config.ts:19-20` says the policy "shipped as Report-Only first … to be promoted to enforced". The
    header list at `next.config.ts:114` emits `Content-Security-Policy` (enforced), as `CHANGELOG.md`
    1.4.1 records. Only the comment is stale.
21. ~~**`docs/configuration.md` is not the complete reference it claims to be.**~~ — **corrected.** Its
    opening line calls it the "single source of truth for every environment variable, feature flag, and
    build-time config", but its 17 numbered sections had no entry for `LLM_USE_SONNET_5`,
    `FAQ_CACHE_ENABLED`, `FAQ_CACHE_SEMANTIC_MATCH`, `EXTENDED_THINKING`, `NEXT_PUBLIC_EXTENDED_THINKING`,
    `NEXT_PUBLIC_GRAPH_PHYSICS`, `NEXT_PUBLIC_MULTIMODAL_ATTACHMENTS`, `NEXT_PUBLIC_PDF_ATTACHMENTS`,
    `NEXT_PUBLIC_CHROME_TTS_BANNER`, `NEXT_PUBLIC_ENABLE_ANVIL_ORB` or `NEXT_PUBLIC_BUILD_YEAR`. All eleven
    are now documented, mostly in the new "Server Toggles, Caches & Crons" section. Extended thinking is two
    separate switches: the chat route reads the unprefixed `EXTENDED_THINKING` and the client reads
    `NEXT_PUBLIC_EXTENDED_THINKING`, each on unless set to `"false"` (the server one also gates replaying a stored reasoning summary on an exact-tier FAQ-cache hit); `ARCHITECTURE.md` (the feature-flags
    bullet under Key invariants) used to list it only as a `NEXT_PUBLIC_*` flag and now describes both.
22. ~~**Subsystems added after the index was pinned are not described in the root docs.**~~ —
    **corrected.** The FAQ response cache (`src/lib/chat-cache.ts`, `src/lib/faq-embeddings.ts`, and the
    admin-only `src/app/api/admin/faq-cache/purge/route.ts`), the claims-integrity chain
    (`scripts/seal-claims.ts`, `src/lib/claims-integrity.ts`, `data/integrity-chain.json`; its CI wiring is
    in §CI-enforced gates) and the decisions ledger (`src/lib/decisions.ts`, `/decisions`, `list_decisions`)
    appeared in `CLAUDE.md` only in passing or not at all, and in `docs/configuration.md` not at all.
    `CLAUDE.md` (LLM / Chat Architecture, MCP Server, Route Tree, Key Files), `README.md` (Highlights,
    Chatbot configuration), `ARCHITECTURE.md` (repo layout), `DEPLOY.md` §7, `TELEMETRY.md` and
    `docs/configuration.md` ("Server Toggles, Caches & Crons") now describe them. Their line-level detail
    belongs in the API, lib and subsystem index files, not here.
23. ~~**`README.md`'s content counts and architecture line lag the code.**~~ — **corrected.** `README.md`
    § Content said `content/projects/*.mdx` holds "**8 open-source repos**" (the directory has 11 files) and
    § Highlights sold a "4-view architecture" switching "Classic / Play / Chat / Developer" while the `View`
    union has six members. It now says 11 repos and describes six views (the four headline experiences plus
    Voice and the Recruiter view); its `31 commands` and predev-watch claims were fixed as items 9 and 5.
    The pitch line (`README.md:5`) still says "four switchable experiences", which is the headline count,
    not the store shape.

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
- `docs/next-upgrade-plan-2026-09.md`
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
- `docs/superpowers/plans/2026-09-07-phase-1-last-shipped-stat-and-ai-usage-signals.md`
- `docs/superpowers/plans/2026-09-07-phase-2-claims-integrity-ledger.md`
- `docs/superpowers/plans/2026-09-07-phase-3-decisions-ledger.md`
- `docs/superpowers/specs/2026-06-13-terminal-dev-mode-design.md`
- `docs/superpowers/specs/2026-06-22-community-health-files-design.md`
- `docs/superpowers/specs/2026-06-23-anvilry-v2.3-v2.5-upgrade-design.md`
- `docs/superpowers/specs/2026-06-23-cycle-c-upgrades-design.md`
- `docs/superpowers/specs/2026-07-01-hero-avatar-design.md`
- `docs/superpowers/specs/2026-09-07-feature-phase-decisions-integrity-design.md`
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
