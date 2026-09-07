# Feature Development Phase — Decisions Ledger, Claims Integrity Ledger, AI Usage Signals, Last-Shipped Stat — Design Spec

**Date:** 2026-09-07
**Status:** Approved — ready for implementation plan
**Feature:** Four independent features selected from an 8-way parallel deep-research pass over the "high-value new features" backlog (Tier 1 + Tier 2 candidates). Sequenced into 3 phases by effort/value, not by dependency — phases 2 and 3 have zero shared code and could be built in either order.

---

## Background

An earlier 4-track `/deep-research` pass (UI/UX, typography, color/design-system, new features) surfaced 10 candidate new features for Anvilry. Typography and color/design-system tracks have already shipped (separate PRs). The UI/UX track shipped separately too. This spec covers the "new features" track's Tier 1 (4 candidates) + Tier 2 (4 candidates), each independently deep-researched end-to-end (grounded in the real codebase, then externally researched against 2026 sources). Full reports live in this session's transcript; key findings are summarized per-phase below.

Of the 8 researched, 4 are recommended to build now (this spec) and 4 are explicitly **not** being built:
- **Live Systems Pulse** — 2 of 13 tracked repos are failing CI right now; would ship a red badge on day one.
- **Referrer-aware content emphasis** — real but unmeasured hypothesis; low urgency, nice-to-have polish.
- **AI-Agent Visit Signal** — `checkBotId()` structurally cannot see most real AI traffic (only JS-executing agents like ChatGPT Operator); likely near-zero volume for a personal portfolio.
- **Agent Digest endpoint** — the research's own conclusion was not to build as scoped: the entire `llms.txt`/`llms-full.txt` corpus is 8–11KB, smaller than the token cost of fetching one average web page. Delta-fetch economics don't pay for their own complexity at this size.
- Also excluded: 4 of 5 "verified achievement links" (Google Code Jam's platform confirmed dead since 2023; Meta Hacker Cup and InterviewBit are login-walled / `robots.txt`-blocked) and any WakaTime-style coding-activity tracker (real privacy risk — would leak client/employer project data by default, and requires an ongoing owner habit-change, not a code change).

None of this is a hard rejection — each could be revisited if circumstances change (e.g. Live Systems Pulse once the two failing repos are green).

---

## Phase 1 (Bounded) — Last-Shipped Stat + AI Usage Signals

Both items are small, well-scoped changes to existing flows — no new subsystems, no spec detail beyond this section (per the Bounded path, this section *is* the design).

### 1a. Last-shipped stat card

**Finding**: `mostRecentPush` (GitHub last-commit timestamp, aggregated across all `REPO_ALLOWLIST` repos) is already computed by `src/app/api/github/stats/route.ts` and already returned in that route's JSON response — it is simply never rendered anywhere. `src/components/github-stats-strip.tsx` fetches this exact route today but only reads `followers`/`publicRepos`/`totalStars`/`totalForks`, dropping `mostRecentPush` on the floor.

**Change**:
- `src/components/github-stats-strip.tsx`: extend the local `GitHubStats` type with `mostRecentPush: string | null`; add a 5th `StatCard` using the already-imported `pushedAgo()` helper (from `@/lib/github`).
- Label: **"last shipped"** or **"last commit"** — never "currently coding" or any live/real-time framing. GitHub's own docs are explicit that even their purpose-built Events API is not real-time (30s–6h latency); the repo-metadata `pushed_at` path used here is simpler but carries the same non-realtime nature.

**Files touched**: `src/components/github-stats-strip.tsx` only. Zero new fetch, zero new caching decision, zero new dependency.

**Testing**: extend existing test coverage for this component (check for a `.test.tsx`/`.dom.test.tsx` first) with a case asserting the new card renders `pushedAgo(mostRecentPush)` correctly, including the null case (hide the card, don't render "unknown"). Visual check in both light and dark theme since it sits in the homepage hero strip.

### 1b. AI Usage Signals in robots.txt

**Finding**: `src/app/robots.ts` today is a bare `{ userAgent: "*", allow: "/" }` — no usage-rights signal anywhere. The root `LICENSE` file already has a real `CONTENT EXCLUSION` clause (all rights reserved on `content/`, `profile.ts`, résumé files) that is *invisible* to any crawler hitting the live domain, since nothing links or surfaces it there. Cloudflare's Content Signals Policy (`search`/`ai-input`/`ai-train` directives, CC0-licensed convention) is the closest 2026 mechanism for expressing this at the one place a crawler actually looks — **with the caveat, confirmed via Google's John Mueller (July 2026, on-record), that no crawler or LLM currently acts on this directive.** It must ship as a stated preference, never as "this blocks AI training."

**Change**:
- `src/app/robots.ts`: add `other: { "Content-Signal": "search=yes, ai-input=yes, ai-train=no" }` to the existing rule, using Next.js 16's typed `RobotsRuleBase.other` field (verified: renders as `key: value` lines inside the `User-Agent` block, no raw-Response route rewrite needed for the directive itself).
  - `ai-input=yes` is deliberate: it protects the MCP server / `llms.txt` / `llms-full.txt` investment's entire purpose (being cited/grounded-against by a recruiter's AI agent) — do not naively default to `ai-input` unset (the common public example) or this would quietly undermine that investment.
  - `ai-train=no` guards the personal narrative from bulk training absorption, matching the LICENSE's existing declared intent.
- `src/lib/llms-txt.ts`: one new `## AI Usage Policy` section inside `buildLlmsTxt()` (3–4 sentences, hedged tone matching the file's existing "omit rather than guess" house style — e.g. "this is a stated preference under Cloudflare's Content Signals convention, not a technical block; it reflects the terms already in this repo's LICENSE"). No new route or file — reuses the existing template-section pattern.

**Files touched**: `src/app/robots.ts`, `src/lib/llms-txt.ts`.

**Testing**: one new unit test pinning the exact `Content-Signal` string value, mirroring `llms-txt.test.ts`'s existing pattern of guarding a machine-readable contract against silent regression. No e2e change needed — the existing `robots.txt is accessible` smoke test only checks HTTP 200.

**Explicitly deferred, not this phase**: the full Cloudflare `#`-comment legal preamble (would require forking `robots.ts` into a raw-`Response` route like `llms.txt/route.ts` — only worth it if the EU Article 4 framing becomes something worth leaning on); named-crawler `Disallow` rules (GPTBot, CCBot, Bytespider, etc. — a blunter, better-precedented complement per some vendor docs, but a separate, deliberate decision, not a default add).

---

## Phase 2 (Architectural) — Claims Integrity Ledger

### Goal

Apply a simplified version of Tombstone's own Merkle-chain pattern (real code at `/Users/sairamugge/Desktop/Not-Humans-World/Tombstone/services/flag-api/internal/audit/`) to Anvilry's own resume claims — hash `impactMetrics` + `achievements` (from `src/lib/profile.ts`) at each deploy, chain to the previous hash + parent commit SHA, so a skeptical recruiter or AI agent can verify a claim hasn't been silently edited since a specific commit.

**What this proves, precisely, and what it does not**: a hash-chain entry proves "this specific string has not been silently edited since commit X." It does **not** prove the number was ever accurate — there is no independent issuer, unlike the W3C Verifiable Credentials issuer/holder/verifier model. Every user-facing surface of this feature (terminal command output, any future page) must state this distinction explicitly and plainly, in the same register as `src/lib/agent-trace.ts`'s existing honest-disclosure header banner. Overclaiming here would read as security theater to exactly the audience sophisticated enough to notice the gap.

**Scope**: `impactMetrics` + `achievements` only — not the whole `profile` object. Sigstore Rekor submission (making the chain externally, permanently checkable) is explicitly **out of scope for this phase** — Rekor entries are undeletable forever, so enabling it needs its own later, fully-informed decision, not a bundled default.

### Data model

Reuse Tombstone's exact canonical encoding: length-prefixed `<len>:<value>` per field (never delimiter-joined — an unescaped value in a delimiter-joined scheme could forge a hash collision), over the two scoped arrays only. Plain SHA-256, **no HMAC**: Tombstone's HMAC key exists to defend against a threat model Anvilry doesn't have (multiple app-server instances racing to extend the same chain via direct DB access). Anvilry has exactly one writer — the owner, locally, before a commit — so git-push access is already the trust boundary.

Each chain entry (one JSON object per line in `data/integrity-chain.jsonl`):

```json
{
  "seq": 1,
  "prevHash": null,
  "hash": "sha256:...",
  "parentCommitSha": "6e58bf0...",
  "sealedAt": "2026-09-07T12:00:00Z",
  "fields": { "impactMetrics": [...], "achievements": [...] }
}
```

- `prevHash: null` marks the genesis entry.
- `parentCommitSha` binds the entry to the **parent HEAD** commit — the commit the claims were true as of, *before* sealing — sidestepping the chicken-and-egg problem of an entry citing its own not-yet-created commit SHA. Same convention CHANGELOGs use implicitly.
- Storage is a plain git-committed file, not Redis (wrong retention model — existing telemetry is 7-day TTL) and not a database (none exists in this stack). Git's own history is the append-only ledger; no new infrastructure.

### Components

**1. `scripts/seal-claims.mjs`** — the only new script.
- `--write` mode (local, developer-run): reads current `impactMetrics`/`achievements` from `profile.ts`, canonical-encodes them, computes the hash, reads the chain file's last entry (or treats the file as empty/genesis), appends a new JSONL line with the current parent commit SHA (`git rev-parse HEAD`).
- Bare-run mode (CI default, no `--write`): recomputes the expected hash from the *current* `profile.ts` on disk and compares it to the chain's last entry; separately re-verifies the whole chain's internal `prevHash` linkage (matching `scripts/check-index-citations.mjs`'s comprehensive-verify pattern, not just the head). Any mismatch exits non-zero with an actionable message: "profile.ts changed since last seal — run `node scripts/seal-claims.mjs --write` locally and commit the updated chain."

**2. `.github/workflows/ci.yml`** — new step, structured exactly like the existing "Codebase index citations" step: its own job step, **not** chained into `pnpm build` (which stays `velite && vitest && next build && pagefind`). Bare-run (verify-only) is the default behavior.

**3. Dual-mode seal trigger (explicit design decision from brainstorming)**: local `--write` is the always-available, default path. A **second, opt-in-only** CI step exists alongside the verify step, gated behind a repo variable (e.g. `vars.SEAL_CLAIMS_AUTO_COMMIT`, unset/false by default) — when explicitly enabled, this step runs `--write` in CI and commits the updated chain file back to the branch (bot commit, needs a `[skip ci]`-tagged message to avoid a commit loop, and an explicit workflow permission grant for write access). This satisfies wanting both modes available without forcing a bot-commit-to-main pattern to be the default — local-only stays the safe, zero-new-risk default; auto-commit is a deliberate later toggle, not a day-one requirement.

**4. Terminal command** — new entry in `src/components/game/terminal/commands.ts` (mirroring the existing flat `Command` registry shape: `{ name, description, usage, run(args, ctx) }`), reading the git-committed JSONL directly (small file, safe to import/read at build or request time). Output:

```
$ integrity
Claims Integrity Ledger
  Entries: 3
  Head:    a1b2c3d4... (sha256, truncated)
  Sealed:  2026-09-07 (commit 6e58bf0)
  First:   2026-08-12 (commit 3bbbfdb)

This proves the claims below have not been silently edited since
their sealing commit. It does NOT prove the numbers were ever
accurate — there is no independent issuer, unlike a verifiable
credential. Treat it as a tamper-evidence log, not a certification.
```

### Error handling

The genesis entry is created in the *same* PR that introduces the CI check, so there is no "chain file missing in production" runtime edge case post-launch. A CI hash mismatch always fails loudly with the exact remediation command — never silently passes, matching the fail-loud discipline `check-index-citations.mjs` already established in this repo.

### Testing

`scripts/seal-claims.test.mjs` (or `.test.ts`, matching whichever this repo's script-testing convention turns out to be) — unit tests for the canonical encoding function and the chain-linking/verification logic, deterministic, no git/filesystem side effects needed for the core logic tests. The CI verify step itself is the integration check — mirrors how `check-index-citations.mjs` has no separate test beyond the CI step running for real.

### Explicitly deferred, not this phase

- Sigstore Rekor submission — a separate, later, fully human-gated decision given its permanence.
- Any `/integrity` page — the terminal command is sufficient for v1; a page is only worth it once Rekor (or another external checkability layer) gives it something to link out to.
- Any MCP tool surface for claim verification — wait until the chain has run long enough to be worth exposing to an automated due-diligence agent.
- Widening the hashed field set beyond `impactMetrics`/`achievements` — each addition changes the privacy profile and reseal frequency; not a default expansion.

---

## Phase 3 (Architectural) — Decisions Ledger

### Goal

Surface the architecture-decision-record-style prose that already exists across the codebase — all 11 project MDX files already have a real `## Key Decisions` section (~30 total decision narratives), all 5 work items already have `constraints`/`tradeoffs` populated — as one browsable, taggable, cross-project feed. The content already exists and is strong; the gap is purely structural: none of it is exposed via the MCP server (`src/lib/mcp-tools.ts`) or the chatbot's grounding corpus (`src/lib/corpus.ts`) today.

### Schema (Path A — confirmed during brainstorming)

Add to the Velite **Project** collection only (`velite.config.ts`):

```ts
const decision = s.object({
  title: s.string(),
  body: s.string(),
  tags: s.array(s.string()).default([]),
});
// on Project:
decisions: s.array(decision).default([]),
```

Work items keep their existing, separate `constraints`/`tradeoffs` fields exactly as they are today — no schema change on Work, no migration risk on content that already ships and is tested. Unification happens only at the derivation layer (see below), not in the content schema.

### Content migration

Rewrite the `## Key Decisions` section out of all 11 `content/projects/*.mdx` files into the new `decisions` frontmatter array — one file at a time, by hand, preserving the exact existing prose and voice (this is genuinely distinctive writing — real bug numbers, real incident language — and a bulk regex-based migration risks flattening it). This is the majority of this phase's real effort; the code changes are small by comparison.

### Derivation module

New `src/lib/decisions.ts`, mirroring `src/lib/game-model.ts`'s existing "no view owns its own copy of content" pattern:
- Iterates `allProjects` (reading `project.decisions[]`) and `allWork` (reading `work.constraints`/`work.tradeoffs`, each work item contributing up to 2 entries).
- Normalizes both into one `LedgerEntry` type: `{ id, sourceKind: "work" | "project", sourceSlug, sourceName, title, body, tags, href }`.
- Exports `allDecisions: LedgerEntry[]`, `decisionsByTag()`, and a coverage export (mirroring `CONTENT_COUNTS`) for the bijection test below.
- `href` always points at the entry's canonical source page (`/work/[slug]` or `/projects/[slug]`) — the ledger never mints a second canonical URL for the same content.

### Route

`src/app/decisions/page.tsx` — a flat, tag-filterable list (client-side filter chips on `tags`), **no dynamic `[slug]` route**: every entry deep-links to its own canonical source page via `href`. This avoids duplicate-content SEO/GEO risk (two indexable URLs serving materially the same prose), matching how `game-model.ts`'s own `hrefFor()` already behaves for the 3D graph.

**Nav placement (default, adjustable)**: reachable via cross-links from work/project pages plus a subtle link near the existing project/work listing pages — not a prominent top-level nav pill for v1, matching the site's understated tone elsewhere. Easy to promote to a top-level nav item later if more visibility is wanted.

### MCP tool

`list_decisions` — the 10th tool in `src/lib/mcp-tools.ts`. This is the single highest-leverage piece of this phase: an AI agent evaluating engineering judgment (the entire point of a decisions ledger) currently gets zero access to this content via the MCP server. Requires:
- Adding the tool function (transport-agnostic, matching the existing 9 tools' shape).
- Updating `src/app/mcp/page.tsx`'s documented tools table — enforced 1:1 against registered tools by `src/app/mcp/tools-documented.test.ts`, which is chained into `pnpm build`, so this cannot silently drift.
- Extending `mcp-tools.test.ts` with coverage for the new tool, including its `isError`-not-fabricate behavior on a not-found query, matching the existing 9 tools' convention.

### Testing

- `src/lib/decisions.test.ts` — a bijection test mirroring `game-model.test.ts`: every ledger entry resolves back to a real content item; no orphans; every project with a `## Key Decisions` section pre-migration has a non-empty `decisions[]` post-migration (regression guard against a lost entry during the manual migration pass).
- Extend the `case-study-depth.test.ts`-style placeholder/length guard to the new `decisions` field (real prose, not `TODO`/`TBD`/lorem placeholder text).
- `e2e/views.spec.ts`-style coverage: `/decisions` loads, the tag filter works, and a sampled entry's link resolves to its real canonical page (not a 404 or a redirect stub).

### Explicitly deferred, not this phase

- `corpus.ts` chat-grounding integration — real value, but adds corpus-size risk (the file's own comment notes a ~4KB budget); do this once the data model has proven stable post-launch, not in the same pass as the initial migration.
- Any curated tag vocabulary — start with whatever tags fall out of the migration naturally; freeform, no controlled enum (YAGNI).
- Any JSON-LD/structured-data type for decisions — no clean Schema.org type fits a personal site's "architecture decision" concept; not worth inventing one.
- Cross-project "recurring pattern" clustering (e.g. auto-grouping every "fail-open" decision across projects) — an analysis feature built *on top of* the ledger, not part of building the ledger itself.

---

## Suggested build order

Phase 1 (both items) → Phase 2 → Phase 3, matching priority order from the research synthesis. Phases 2 and 3 share no code and could swap order or run concurrently if preferred — this ordering is priority-driven, not dependency-driven.

## Verification approach (all phases, consistent with this session's standing pattern)

Each phase: local `pnpm build` + `pnpm lint` + full test suite green before pushing; a dedicated branch + PR into `develop` (never direct commits); CI watched via `gh pr checks --watch`; live-site verification against the real deployed preview and production after promotion, matching the same rigor applied to every prior round this session (UI/UX findings, color/design-system audit).
