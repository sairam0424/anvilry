# Decisions Ledger (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the ~30 architecture-decision narratives that already exist in project MDX bodies (and the `constraints`/`tradeoffs` fields on Work items) as one structured, browsable, tag-filterable ledger — reachable via a new `/decisions` route and a new `list_decisions` MCP tool — with zero new content authored (pure migration + derivation).

**Architecture:** A new `decisions: {title, body, tags}[]` field on the Velite `Project` collection holds the migrated prose. A new derivation module (`src/lib/decisions.ts`) mirrors `src/lib/game-model.ts`'s "no view owns its own copy of content" pattern: it iterates `allProjects`/`allWork` and normalizes both sources into one `LedgerEntry[]`. A new route renders that list with a single-select tag filter (mirroring the existing pill-filter pattern on `/articles`). A new 10th MCP tool exposes the same data to AI agents.

**Tech Stack:** Next.js 16 / React 19, Velite (content layer), Vitest (unit tests), Playwright (e2e), `mcp-handler` (MCP server).

**Spec:** `docs/superpowers/specs/2026-09-07-feature-phase-decisions-integrity-design.md` (Phase 3 section) — read both before starting.

## Global Constraints

- No new content is authored. Every word in every migrated `decisions[]` entry must be copied verbatim (or, for the one no-bold-title file, near-verbatim for the title only — see Task 3) from the existing MDX prose. Do not paraphrase, summarize, or improve the writing.
- `tags` is omitted (defaults to `[]`) on every migrated entry in this pass — tag curation is explicitly deferred (YAGNI), per the spec.
- Work's `constraints`/`tradeoffs` fields and schema are **not modified** — only read, at the derivation layer.
- The `/decisions` route must have no dynamic `[slug]` segment — every entry deep-links to its own canonical `/work/[slug]` or `/projects/[slug]` page. Never mint a second indexable URL for the same content.
- The new MCP tool must land in the same commit as its `mcp-tools.test.ts` coverage and its `src/app/mcp/page.tsx` `TOOLS` table row — `tools-documented.test.ts` is chained into `pnpm build` and fails the whole build if these three drift out of sync.
- Before the final push (Task 9), run `node scripts/check-index-citations.mjs` locally and fix any citation it reports as stale — this migration touches 11 content files plus `mcp-tools.ts`/`mcp/page.tsx`, all of which this session has previously seen shift line-number citations in `docs/index/*.md`. Confirm it exits 0 before opening the PR, not after a failed CI run.

---

## Task 1: Add the `decisions` field to the Velite Project schema

**Files:**
- Modify: `velite.config.ts:11-40` (the `projects` collection)
- Verify: `.velite/projects.json` regenerates with the new field

**Interfaces:**
- Produces: `Project.decisions: { title: string; body: string; tags: string[] }[]` — every later task that reads a project's decisions relies on this exact shape and field name.

- [ ] **Step 1: Add the schema field**

In `velite.config.ts`, add a `decision` object schema above the `projects` collection definition, and a `decisions` field inside the `projects` schema, right before `body: s.mdx()`:

```ts
/* One architecture-decision narrative, migrated verbatim from a project's
 * former "## Key Decisions" MDX section. See docs/superpowers/specs/
 * 2026-09-07-feature-phase-decisions-integrity-design.md. */
const decision = s.object({
  title: s.string(),
  body: s.string(),
  tags: s.array(s.string()).default([]),
});
```

Then, inside the `projects` collection's schema object (after `relatedArticles: s.array(s.string()).optional(),` and before `tech: s.array(s.string()),` — or any position before `body: s.mdx()`, exact position among sibling fields doesn't matter, grouping near other optional metadata does):

```ts
      decisions: s.array(decision).default([]),
```

- [ ] **Step 2: Regenerate Velite output and verify the shape**

Run: `pnpm content` (this is the repo's alias for `velite --clean`)
Expected: exits 0, no schema errors. Then run:

```bash
node -e "const p = require('./.velite/projects.json'); console.log(JSON.stringify(p.find(x => x.slug === 'ag-bash').decisions))"
```

Expected output: `[]` (every project defaults to an empty array until Task 3/4 migrate real content into specific files — this step only proves the schema compiles and defaults correctly).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (The generated `.velite` types now include `decisions` on `Project` — nothing consumes it yet, so this should be a silent pass.)

- [ ] **Step 4: Commit**

```bash
git add velite.config.ts
git commit -m "feat(content): add decisions field to the Project schema

Empty by default (s.array(decision).default([])) — no content changes
yet. Prepares for migrating each project's Key Decisions MDX section
into structured frontmatter (next commits)."
```

---

## Task 2: Migrate 3 representative project files (establishes the pattern)

This task hand-migrates `tombstone.mdx`, `contextos.mdx`, and `ag-bash.mdx` — one from each of the two real prose formats found in the corpus — so the pattern is proven before Task 3 applies it mechanically to the rest.

**Files:**
- Modify: `content/projects/tombstone.mdx`, `content/projects/contextos.mdx`, `content/projects/ag-bash.mdx`

**Interfaces:**
- Consumes: the `decisions` field from Task 1.
- Produces: 3 real, populated `decisions[]` arrays — Task 4's derivation module and Task 3's bijection test both read these.

### Format reference (read before migrating anything else in Task 3)

The 11 project files' `## Key Decisions` sections use exactly two prose shapes:

- **Bold-lead-in, no separator** — `**Title.**` immediately followed by body prose, either as its own paragraph or as a `-` bullet. The bold span ends with a period. Used by: `tombstone`, `contextos`, `commandvault`, `not-humans-lab` (paragraphs) and `agent-forge`, `graph-forge`, `grpc-microservices`, `mindforge`, `trelix` (bullets).
- **Bold-lead-in, em-dash separator** — `**Title**` (no period inside the bold span) followed by ` — ` then lowercase body prose, as a `-` bullet. Used by: `ag-bash` only.

**Extraction rule (applies to both shapes):** the title is the text inside the first `**...**` span, with any trailing period stripped. The body is everything after the closing `**`, with leading whitespace and any of `. `, ` — `, or `- ` stripped from the start.

- [ ] **Step 1: Migrate `content/projects/tombstone.mdx`**

Read the file's current `## Key Decisions` section (lines 49–55 as of this plan being written — confirm the exact current line numbers before editing, they may have shifted). It contains exactly 3 paragraphs:

Add to the frontmatter (after `relatedArticles: [...]`, before `tech: [...]` — or anywhere in frontmatter before the closing `---`):

```yaml
decisions:
  - title: "Fail-open, async Rekor submission over a blocking write"
    body: "A third-party outage should never stop a flag mutation, so Rekor submission sits off the critical path and swallows its own failures by design. That same posture let a real bug — AUD-1b — go unnoticed for an unknown stretch: the Rekor client submitted a \"rekord\" entry claiming signature format `x509` but never actually included a signature or public key, so Rekor's server-side validation rejected every entry and the existing fail-open handling swallowed the failure silently. Every `REKOR_ENABLED=true` deployment believed it was writing to the transparency log while, very likely, no entry had ever been successfully recorded."
  - title: "Duplicated HTTP clients over one shared Go module"
    body: "The retry/backoff/circuit-breaker logic above is copied byte-for-byte into six-plus services rather than factored out. The cost: any tuning change has to be hand-applied to every copy instead of landing with one version bump."
  - title: "Audit-log correlation over a real dependency graph for blast-radius \"dependent flags\""
    body: "Scoring counts how often two flags changed together in the last 30 days — cheap and always available, but correlation, not causation. Two flags toggled by the same engineer in the same sprint count as dependent; a flag with a genuine hard dependency that hasn't been co-changed recently scores as having none."
```

Then remove the `## Key Decisions` heading and its 3 paragraphs from the MDX body (they were the last section in the file — the body now ends after the `## How It Works` section's last paragraph).

**Why YAML block scalars aren't used here:** the body strings contain literal backticks and embedded double quotes (` ```x509` ``, `"rekord"`) — plain double-quoted YAML scalars with escaped `\"` handle this correctly and match the existing style already used for Work's `constraints`/`tradeoffs` single-line strings. Verify the escaping is exact — a missed `\"` will break YAML parsing at `pnpm content`.

- [ ] **Step 2: Migrate `content/projects/contextos.mdx`**

Same pattern, 3 entries:

```yaml
decisions:
  - title: "Made the embedding provider optional, not bundled"
    body: "`@xenova/transformers` pulls in `onnxruntime-web` → `onnx-proto` → `protobufjs`, which carries a critical RCE advisory with no fix in any maintained ONNX package. Default install: 83 packages, zero known vulnerabilities. Opt into semantic search: 130 packages, 1 critical + 4 high advisories `npm audit fix` can't clear. Cost: an upgrade silently drops semantic search until the dependency returns — why degraded retrieval now surfaces across five output surfaces instead of failing quietly."
  - title: "Hard-fixed the vector index at 384 dimensions"
    body: "the local MiniLM model's width — instead of auto-negotiating per provider. Gemini and Ollama report 768 dimensions, so enabling `GEMINI_API_KEY` or `OLLAMA_MODEL` deliberately throws at startup instead of silently writing mismatched-width vectors into the store. Cost: those \"supported\" providers don't work out of the box — using them means re-embedding the index or injecting a custom 384-dim provider."
  - title: "Left git auto-commit off by default"
    body: "The architecture doc explains why: an agent-authored commit puts an unreviewed write into shared history — \"and that is precisely how a corrupt write once reached this repository's history.\" With `CONTEXTOS_AUTO_COMMIT` unset, agent writes exist only as an audit-log row and an unreviewed diff until a human opts in — a real reviewability gap, traded against repeating the incident that caused it."
```

Remove the `## Key Decisions` heading and its 3 paragraphs from the body.

- [ ] **Step 3: Migrate `content/projects/ag-bash.mdx`** (the em-dash-separator format)

```yaml
decisions:
  - title: "FNV-1a over SHA-256 for the AST cache key"
    body: "a non-cryptographic hash gives roughly 10x faster key generation and works in the browser, at the cost of weaker collision resistance; the project's own architecture notes defend it only as \"sufficient distribution for realistic script populations,\" not a formal guarantee."
  - title: "`DestructiveStage` defaults to `warn`, not `block`"
    body: "a detected `rm -rf /` or fork bomb surfaces as an Observation rather than a refusal, trading hard-stop safety for agent throughput. Callers who want the refusal have to opt in explicitly with `destructivePolicy: 'block'`."
  - title: "Node floor of >=20.6.0 despite full ESM-hook sandbox hardening needing >=23.5"
    body: "chose broad compatibility over guaranteeing the complete hardening story on the officially supported minimum runtime."
```

Remove the `## Key Decisions` heading and its 3 bullets from the body.

- [ ] **Step 4: Regenerate and verify all 3**

Run: `pnpm content`
Expected: exits 0. Then:

```bash
node -e "
const p = require('./.velite/projects.json');
for (const slug of ['tombstone', 'contextos', 'ag-bash']) {
  const proj = p.find(x => x.slug === slug);
  console.log(slug, proj.decisions.length);
}
"
```

Expected: `tombstone 3`, `contextos 3`, `ag-bash 3`.

- [ ] **Step 5: Visually confirm no orphaned heading**

Run: `grep -n "## Key Decisions" content/projects/tombstone.mdx content/projects/contextos.mdx content/projects/ag-bash.mdx`
Expected: no output (heading fully removed from all 3 files).

- [ ] **Step 6: Commit**

```bash
git add content/projects/tombstone.mdx content/projects/contextos.mdx content/projects/ag-bash.mdx
git commit -m "feat(content): migrate 3 projects' Key Decisions into structured frontmatter

tombstone, contextos (bold-lead-in-period format) and ag-bash (bold-lead-in
em-dash format) — the two prose shapes used across all 11 project files.
Prose copied verbatim; establishes the migration pattern for the
remaining 8 files."
```

---

## Task 3: Migrate the remaining 8 project files

Apply the same extraction rule from Task 2 to the other 8 files. Two of them need a documented exception — resolved here, not left as an open question:

- **`inkforge.mdx` has no bold lead-in text at all** — its "Key Decisions" section is 3 plain prose paragraphs. For this file only: use each paragraph's own opening clause (verbatim, trimmed to roughly its first 8–10 words) as the title — never invent a summary that isn't drawn directly from the text.
- **`trelix.mdx` has a 4th paragraph after its 3 real decisions** ("A note on the numbers above...") that is a data-accuracy correction, not a decision. Migrate only the 3 bulleted decisions; leave the numbers-correction paragraph in the MDX body as standalone prose (remove the `## Key Decisions` heading, but keep this one paragraph in place — it doesn't need its own heading).

**Files:**
- Modify: `content/projects/agent-forge.mdx`, `content/projects/commandvault.mdx`, `content/projects/graph-forge.mdx`, `content/projects/grpc-microservices.mdx`, `content/projects/inkforge.mdx`, `content/projects/mindforge.mdx`, `content/projects/not-humans-lab.mdx`, `content/projects/trelix.mdx`

- [ ] **Step 1: Migrate `content/projects/agent-forge.mdx`** (3 bulleted entries, bold-period format)

```yaml
decisions:
  - title: "Git as the rollback mechanism, not a custom versioned store"
    body: "Commit-or-revert rides on git's own history instead of a bespoke database of spec versions. The cost is a real git operation per iteration, slower than an in-memory diff-and-discard — the payoff is an audit trail already inspectable with tools every engineer has, with no parallel system to keep in sync."
  - title: "Held-out validation as a periodic overfit check, not a per-iteration eval pass"
    body: "Scoring every candidate against the same examples that shaped its proposal risks the loop learning to game its own judge. Rather than paying that cost every iteration, a held-out check runs periodically (every 10th iteration by default) against examples the loop never optimized against — cheaper than gating every commit on it, at the cost of only catching overfitting in arrears rather than blocking it in the moment it happens."
  - title: "Framework-agnostic adapters over a deep, single-framework integration"
    body: "Thin adapters across LangChain, LangGraph, CrewAI, AutoGen, and raw SDKs mean none gets the tightest integration a framework-native rebuild could reach. In exchange, the same loop runs over whatever stack an agent is already built on, instead of forcing a migration first."
```

- [ ] **Step 2: Migrate `content/projects/commandvault.mdx`** (3 paragraph entries, bold-period format)

```yaml
decisions:
  - title: "Two SQLite engines instead of one"
    body: "better-sqlite3 gives native speed for the CLI; sql.js gives a pure-WASM fallback for the extension, which can't ship a native module across Electron's ABI. The cost is real — two adapters must stay behaviorally identical and both get tested — paid so the extension isn't a degraded second product."
  - title: "A fixed 500ms debounce, not per-event parsing"
    body: "Every save waits up to half a second before the vault reflects it, even an isolated change — a latency floor accepted so bulk operations like a branch checkout don't trigger a parse storm."
  - title: "500-character truncation in the two fast search tiers, full content in the slow one"
    body: "Fuse.js and MiniSearch cap indexed content at 500 characters; FTS5 stores everything, after an earlier 2000-char cap on that tier was explicitly removed. The fast tiers trade match depth for speed — a match buried deep in a long file only ever surfaces through FTS5."
```

- [ ] **Step 3: Migrate `content/projects/graph-forge.mdx`** (3 bulleted entries, bold-period format)

```yaml
decisions:
  - title: "Chose a parser-built context header over an LLM-generated one, despite losing retrieval precision"
    body: "Anthropic-style \"Contextual Retrieval\" — an LLM writes a situating blurb per chunk at index time — would have coupled the otherwise LLM-free, Kafka-driven indexing pipeline to Bedrock's uptime, rate limits, and per-chunk cost. I kept indexing pure and cheap: a parser-built header plus query-time Neo4j neighborhood recovers most of the same signal without ever calling an LLM during ingest."
  - title: "Chose Bedrock-primary with automatic Ollama fallback, and left a known gap in it rather than hide it"
    body: "The fallback keeps the whole platform functional — and free — with zero cloud credentials configured. The cost: the swarm binds tools via LangGraph's `bind_tools`, so the fallback model has to be tool-capable too. If Bedrock goes down and the fallback model (the Compose default is `qwen2.5-coder:7b`) can't actually call tools, tool calls silently no-op instead of erroring. That gap is documented in the repo, not papered over."
  - title: "Chose architectural breadth over test coverage"
    body: "Nineteen services, a durable HITL multi-agent swarm, Istio-enforced zero-trust, and hybrid RRF retrieval shipped before a single Go unit test did. The project's own tech-debt tracker rates \"Go services: no unit tests, only compile checks\" as a HIGH-priority gap against its own documented 80%-coverage standard — an honest trade I'm now closing on two unmerged branches (`feat/test-suite-go-services`, `feat/test-suite-python-services`) rather than one I'm pretending isn't there."
```

- [ ] **Step 4: Migrate `content/projects/grpc-microservices.mdx`** (3 bulleted entries, bold-period format)

```yaml
decisions:
  - title: "Saga orchestration, not Two-Phase Commit"
    body: "2PC is the obvious alternative for cross-service atomicity, but it needs distributed locks held across every participant and a coordinator that becomes a single point of failure. Sagas avoid both, but the cost lands on the order flow's consistency model — it's eventually consistent, and correctness now depends on compensating transactions actually reversing partial work cleanly when a step fails midway."
  - title: "At-least-once-with-dedup, not real exactly-once"
    body: "The \"exactly-once-ish\" label above is intentionally hedged: a CDC outbox plus idempotency keys plus a DLQ is, underneath, an at-least-once delivery guarantee with deduplication bolted on — not the theoretically pure exactly-once semantics the name gestures at. Consumers have to be built idempotent by construction, in exchange for not needing a distributed transaction coordinator to get reliable delivery."
  - title: "etcd leader election over letting any instance write"
    body: "Single-writer coordination through etcd buys write-conflict and split-brain avoidance by construction, but it adds a new coordination dependency with its own failure modes — leader flapping or quorum loss becomes part of this system's failure surface. What happens to in-flight writes during a leader-election gap isn't something the current design spells out."
```

- [ ] **Step 5: Migrate `content/projects/mindforge.mdx`** (3 bulleted entries, bold-period format)

```yaml
decisions:
  - title: "Advisory governance over fail-closed hooks"
    body: "Outside Claude Code's own hook channel, MindForge enforces policy by convention rather than by blocking — a trade its own README states outright, made against a fail-closed tail that was measured denying benign commands on a fresh clone."
  - title: "A single canonical version source over a \"bump N files\" heuristic"
    body: "`package.json` feeds a sync script and test gate fanning out across 16 channels — the SDK, the MCP server, three lockfiles, the Homebrew formula, the Dockerfile, the marketplace listing. The cost of skipping that gate already happened once: v11.9.2 shipped with the Homebrew formula and Dockerfile still pinned four releases behind."
  - title: "A zero-dependency SDK over a bundled WebSocket client"
    body: "Shipping `sdk/` with no runtime dependencies keeps it lean, but it means `WebSocketEventStream` can't function on Node 18 or 20 unless the caller manually installs and polyfills `ws` onto `globalThis` — a real enough gap that the code now throws a descriptive error instead of the bare `ReferenceError` it used to."
```

- [ ] **Step 6: Migrate `content/projects/not-humans-lab.mdx`** (3 paragraph entries, bold-period format)

```yaml
decisions:
  - title: "No shared build tooling, over a Turborepo/pnpm umbrella"
    body: "Each sub-project keeps its own toolchain instead of folding into shared build tooling — framed as YAGNI (\"each project's toolchain is small enough on its own... shared tooling would add coordination cost without a proven need\"). The cost: the architecture doc's own Risks section admits the layout is \"unvalidated against real code,\" and the system-level tech-stack research pass meant to back this call came back as a placeholder/error — thinner-evidenced than the three project-level stack decisions it sits alongside."
  - title: "Numbered ADRs, over commit-message-driven history"
    body: "Cross-cutting decisions get a Nygard-style ADR instead of living only in commit messages or PR threads, at the cost of \"a small amount of process overhead per significant decision\" and a standing risk that the practice quietly lapses back into chat-only decisions if nobody keeps writing them."
  - title: "Mandatory PR review, over direct commits — even solo"
    body: "`main` is protected: no force-push, no direct commits, a PR required even when the maintainer is the only contributor. There's no team to review for; the stated purpose is a single self-imposed checkpoint against agent output, deliberately removing the option to bypass CI \"just this once.\""
```

- [ ] **Step 7: Migrate `content/projects/trelix.mdx`** (3 bulleted entries — the "note on the numbers" paragraph is excluded, per the exception documented above)

```yaml
decisions:
  - title: "7-leg fan-out over a simpler pipeline, despite the cost"
    body: "No single tool combines all 7 legs, and RRF rewards agreement across them — but a full fan-out costs 50-500ms per query versus under 1ms for a tier-1 hit. The 3-tier planner exists to keep most queries out of that expensive path."
  - title: "\"Beast-mode\" features (FLARE, HyDE, multi-query expansion) ship opt-in"
    body: "Each is a real LLM cost — stacking HyDE and multi-query expansion runs N+2 chat calls (4 at default N=2). Docs recommend one flag at a time, not all on a slow backend."
  - title: "Call-graph depth caps at 1 hop for most single-intent queries, with one deliberate exception"
    body: "The traversal code warns against depth=2 for tier 2 to keep latency predictable, but `feature_flow` overrides that guidance — a \"how does X flow\" question needs the extra hop to be useful at all."
```

Remove the `## Key Decisions` heading and its 3 bullets from the body, but **keep** the trailing "A note on the numbers above..." paragraph in the body exactly where it is.

- [ ] **Step 8: Migrate `content/projects/inkforge.mdx`** (3 paragraphs, no bold lead-in — titles derived from each paragraph's own opening clause)

```yaml
decisions:
  - title: "Bedrock fallback stops at Haiku 4.5, skips Opus 4.6"
    body: "Bedrock's fallback stops at Haiku 4.5 and skips Opus 4.6 on purpose — Opus needs separate per-account Bedrock enablement, and I chose zero extra AWS config over deeper resilience. Fallback eligibility is narrow too — only connection errors, 429/404/5xx, and IAM-deny 403s trigger it; a bad-credentials 403 doesn't, since a new model won't fix that."
  - title: "Kept Hashnode's client, never built a LinkedIn publisher"
    body: "I kept Hashnode's client despite its now-decommissioned API, and never built a real publisher for LinkedIn at all — different reasons, same effect. Hashnode fails loudly with a documented manual-paste workflow instead of a silent no-op; LinkedIn never had an API to integrate, so the render-spec-plus-human-upload path was the honest choice from day one, not a fallback. The cost: \"publish without leaving the terminal\" holds for Dev.to alone."
  - title: "Generated articles never get committed, only the tracking record does"
    body: "Generated articles never get committed; only the tracking record does. That keeps the repo's diff history clean, but the article text isn't recoverable from git if local `content/` is lost — only proof it was published survives."
```

- [ ] **Step 9: Regenerate and verify all 8**

Run: `pnpm content`
Expected: exits 0.

```bash
node -e "
const p = require('./.velite/projects.json');
for (const slug of ['agent-forge','commandvault','graph-forge','grpc-microservices','mindforge','not-humans-lab','trelix','inkforge']) {
  const proj = p.find(x => x.slug === slug);
  console.log(slug, proj.decisions.length);
}
"
```

Expected: every slug prints `3`.

- [ ] **Step 10: Confirm no orphaned headings remain anywhere**

Run: `grep -rn "## Key Decisions" content/projects/*.mdx`
Expected: no output (all 11 files migrated — 3 from Task 2, 8 from this task).

- [ ] **Step 11: Confirm all 11 projects now have exactly 3 decisions each**

```bash
node -e "
const p = require('./.velite/projects.json');
const counts = p.map(x => [x.slug, x.decisions.length]);
console.log(counts);
console.log('total:', counts.reduce((s, [, n]) => s + n, 0));
"
```

Expected: 11 entries, each `3`, total `33`.

- [ ] **Step 12: Commit**

```bash
git add content/projects/agent-forge.mdx content/projects/commandvault.mdx content/projects/graph-forge.mdx content/projects/grpc-microservices.mdx content/projects/inkforge.mdx content/projects/mindforge.mdx content/projects/not-humans-lab.mdx content/projects/trelix.mdx
git commit -m "feat(content): migrate remaining 8 projects' Key Decisions into frontmatter

Completes the migration started in the previous commit. inkforge's 3
paragraphs had no bold lead-in text, so their titles are derived from
each paragraph's own opening clause (verbatim), not invented. trelix's
4th 'note on the numbers' paragraph is a data-accuracy correction, not
a decision — left in the MDX body, not migrated.

All 11 projects now carry exactly 3 structured decisions (33 total),
verified via .velite/projects.json."
```

---

## Task 4: `src/lib/decisions.ts` derivation module + bijection test

**Files:**
- Create: `src/lib/decisions.ts`
- Test: `src/lib/decisions.test.ts`

**Interfaces:**
- Consumes: `Project.decisions` (Task 1–3), `Work.constraints`/`Work.tradeoffs` (existing, unchanged), `allProjects`/`allWork` from `@/lib/content`.
- Produces: `export type LedgerEntry = { id: string; sourceKind: "work" | "project"; sourceSlug: string; sourceName: string; title: string; body: string; tags: string[]; href: string }`, `export const allDecisions: LedgerEntry[]`, `export function decisionsByTag(tag: string): LedgerEntry[]`, `export const DECISION_COUNTS: { projectEntries: number; workEntries: number; totalEntries: number }`. Every later task (route, MCP tool, e2e) imports from here — these exact names.

- [ ] **Step 1: Write the failing test**

Create `src/lib/decisions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { allProjects, allWork } from "@/lib/content";
import {
  allDecisions,
  decisionsByTag,
  DECISION_COUNTS,
  type LedgerEntry,
} from "@/lib/decisions";

/**
 * Bidirectional coverage + anti-fabrication gate for the decisions ledger, mirroring
 * game-model.test.ts's pattern. Chained into `pnpm build` (via `vitest run`), so any
 * drift between the ledger and the canonical Velite content FAILS THE DEPLOY.
 */
describe("decisions ledger coverage", () => {
  it("has at least one entry per project that has decisions[] populated", () => {
    const projectsWithDecisions = allProjects.filter((p) => p.decisions.length > 0);
    for (const p of projectsWithDecisions) {
      const entries = allDecisions.filter(
        (e) => e.sourceKind === "project" && e.sourceSlug === p.slug,
      );
      expect(entries.length, `project "${p.slug}" has decisions but no ledger entries`).toBe(
        p.decisions.length,
      );
    }
  });

  it("has an entry for every work item's populated constraints/tradeoffs", () => {
    for (const w of allWork) {
      const entries = allDecisions.filter(
        (e) => e.sourceKind === "work" && e.sourceSlug === w.slug,
      );
      const expected = (w.constraints ? 1 : 0) + (w.tradeoffs ? 1 : 0);
      expect(entries.length, `work "${w.slug}" expected ${expected} entries`).toBe(expected);
    }
  });

  it("every entry's title and body trace to real content (no fabrication)", () => {
    for (const e of allDecisions) {
      if (e.sourceKind === "project") {
        const p = allProjects.find((x) => x.slug === e.sourceSlug);
        expect(p, `entry references unknown project "${e.sourceSlug}"`).toBeTruthy();
        const match = p!.decisions.some((d) => d.title === e.title && d.body === e.body);
        expect(match, `entry "${e.title}" not found verbatim in project "${e.sourceSlug}"`).toBe(
          true,
        );
      } else {
        const w = allWork.find((x) => x.slug === e.sourceSlug);
        expect(w, `entry references unknown work item "${e.sourceSlug}"`).toBeTruthy();
        const bodyMatches = e.body === w!.constraints || e.body === w!.tradeoffs;
        expect(bodyMatches, `entry "${e.title}" body doesn't match work "${e.sourceSlug}"`).toBe(
          true,
        );
      }
    }
  });

  it("deep-links every entry into a canonical Classic route", () => {
    for (const e of allDecisions) {
      expect(e.href, `entry "${e.id}" has a malformed href`).toMatch(
        /^\/(work|projects)\/[a-z0-9-]+$/,
      );
    }
  });

  it("gives every entry a unique, stable id", () => {
    const ids = allDecisions.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is a bijection: counts line up", () => {
    expect(DECISION_COUNTS.totalEntries).toBe(allDecisions.length);
    expect(DECISION_COUNTS.projectEntries + DECISION_COUNTS.workEntries).toBe(
      DECISION_COUNTS.totalEntries,
    );
  });

  it("decisionsByTag returns only entries carrying that tag", () => {
    // No tags are populated yet (Task 2/3 omit them, per the spec's YAGNI decision) —
    // this proves the filter is correct/empty-safe, not that tagged data exists yet.
    const result: LedgerEntry[] = decisionsByTag("nonexistent-tag");
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/decisions.test.ts`
Expected: FAIL — `Cannot find module '@/lib/decisions'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/decisions.ts`:

```ts
import { allProjects, allWork } from "@/lib/content";

/**
 * Derivation layer that surfaces the architecture-decision narratives already living
 * in project MDX frontmatter (Project.decisions) and work case studies
 * (Work.constraints/Work.tradeoffs) as one flat, typed ledger — zero duplication, zero
 * fabrication. Mirrors the role of src/lib/game-model.ts for the gamified view.
 * decisions.test.ts asserts every entry traces to real content and every populated
 * source field is represented (bidirectional coverage).
 */

export type LedgerEntry = {
  id: string;
  sourceKind: "work" | "project";
  sourceSlug: string;
  sourceName: string;
  title: string;
  body: string;
  tags: string[];
  href: string;
};

const projectEntries: LedgerEntry[] = allProjects.flatMap((p) =>
  p.decisions.map((d, i) => ({
    id: `project:${p.slug}:${i}`,
    sourceKind: "project" as const,
    sourceSlug: p.slug,
    sourceName: p.name,
    title: d.title,
    body: d.body,
    tags: d.tags,
    href: p.url,
  })),
);

const workEntries: LedgerEntry[] = allWork.flatMap((w) => {
  const entries: LedgerEntry[] = [];
  if (w.constraints) {
    entries.push({
      id: `work:${w.slug}:constraints`,
      sourceKind: "work",
      sourceSlug: w.slug,
      sourceName: w.name,
      title: "Constraints",
      body: w.constraints,
      tags: [],
      href: w.url,
    });
  }
  if (w.tradeoffs) {
    entries.push({
      id: `work:${w.slug}:tradeoffs`,
      sourceKind: "work",
      sourceSlug: w.slug,
      sourceName: w.name,
      title: "Tradeoffs",
      body: w.tradeoffs,
      tags: [],
      href: w.url,
    });
  }
  return entries;
});

export const allDecisions: LedgerEntry[] = [...projectEntries, ...workEntries];

export function decisionsByTag(tag: string): LedgerEntry[] {
  return allDecisions.filter((e) => e.tags.includes(tag));
}

/** Sanity counts used by the coverage test (kept here so the test imports one module). */
export const DECISION_COUNTS = {
  projectEntries: projectEntries.length,
  workEntries: workEntries.length,
  totalEntries: allDecisions.length,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/decisions.test.ts`
Expected: PASS, all 7 tests. (`DECISION_COUNTS.totalEntries` should be 33 project entries + up to 10 work entries — 5 work items × 2 fields each, all 5 currently have both populated per Task grounding — so 43 total.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/decisions.ts src/lib/decisions.test.ts
git commit -m "feat: add decisions ledger derivation module

Mirrors game-model.ts's derivation pattern. Combines Project.decisions
with Work.constraints/tradeoffs into one typed LedgerEntry[], with a
bijection test asserting every populated source field has a
corresponding entry and every entry traces to real content verbatim."
```

---

## Task 5: `/decisions` route with tag filter

**Files:**
- Create: `src/app/decisions/page.tsx`

**Interfaces:**
- Consumes: `allDecisions`, `LedgerEntry` from `@/lib/decisions` (Task 4).

- [ ] **Step 1: Write the route**

Create `src/app/decisions/page.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { allDecisions } from "@/lib/decisions";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";

export default function DecisionsPage() {
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const e of allDecisions) for (const t of e.tags) set.add(t);
    return [...set].sort();
  }, []);

  const [activeTag, setActiveTag] = useState<"all" | string>("all");
  const filterOptions: ("all" | string)[] = ["all", ...allTags];

  const filtered =
    activeTag === "all"
      ? allDecisions
      : allDecisions.filter((e) => e.tags.includes(activeTag));

  return (
    <main className="flex-1">
      <Section
        label={`// decisions — ${allDecisions.length} entries`}
        title="Decisions"
        titleAs="h1"
      >
        <p className="max-w-2xl text-fg-muted">
          Real architecture and engineering tradeoffs from across my
          production work and open-source projects — the choice made, the
          alternative considered, and the cost actually paid. Every entry
          links back to the project or case study it came from.
        </p>

        {filterOptions.length > 2 && (
          <Reveal className="mb-10 mt-8">
            <div
              className="w-full overflow-x-auto overscroll-x-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div
                role="group"
                aria-label="Filter decisions by tag"
                className="inline-flex items-center rounded-full border border-border bg-bg-surface/80 p-0.5 backdrop-blur gap-0.5"
              >
                {filterOptions.map((opt) => {
                  const active = activeTag === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setActiveTag(opt)}
                      aria-pressed={active}
                      className={[
                        "relative inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base",
                        active ? "text-bg-base" : "text-fg-muted hover:text-fg",
                      ].join(" ")}
                    >
                      {active && (
                        <motion.span
                          layoutId="decisions-filter-pill"
                          aria-hidden="true"
                          className="absolute inset-0 z-0 rounded-full bg-accent"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        />
                      )}
                      <span className="relative z-10">
                        {opt === "all" ? "All" : opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {filtered.map((e) => (
            <Reveal key={e.id}>
              <Link
                href={e.href}
                className="card-surface group flex h-full flex-col p-5"
              >
                <p className="mono-label text-fg-subtle">{e.sourceName}</p>
                <h2 className="mt-2 text-base font-semibold tracking-tight">
                  {e.title}
                </h2>
                <p className="mt-2 flex-1 text-sm text-fg-muted">{e.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs text-accent">
                  View source <ArrowUpRight size={13} aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-8 text-sm text-fg-subtle">
            No decisions tagged &ldquo;{activeTag}&rdquo;.
          </p>
        )}
      </Section>
    </main>
  );
}
```

- [ ] **Step 2: Verify it builds and renders**

Run: `pnpm dev` (or reuse a running instance), navigate to `http://localhost:3000/decisions`.
Expected: page loads, shows 43 cards (no filter bar yet — `allTags` is empty until tags are populated in a later, deferred pass, so `filterOptions.length` is 1, and the `> 2` check hides the bar — this is correct per the spec's YAGNI tag deferral, not a bug).

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/decisions/page.tsx
git commit -m "feat: add /decisions route

Flat, tag-filterable list rendered from the decisions ledger. No
dynamic [slug] route — every card deep-links to its own canonical
/work/[slug] or /projects/[slug] page, avoiding duplicate-content SEO
risk. Tag filter bar is present but inert until a later pass populates
tags (currently empty, per the spec's YAGNI deferral)."
```

---

## Task 6: Extend the placeholder/anti-fabrication guard to the new field

**Files:**
- Modify: `src/lib/case-study-depth.test.ts`

**Interfaces:**
- Consumes: `allProjects` from `@/lib/content` (already imported elsewhere in the repo; this file currently imports only `allWork` — add `allProjects` to its import).

- [ ] **Step 1: Write the failing test**

In `src/lib/case-study-depth.test.ts`, add `allProjects` to the existing import line:

```ts
import { allWork, allProjects } from "@/lib/content";
```

Then add a new `it` block inside the existing `describe("case-study depth fields", ...)`:

```ts
  it("every project's decisions (when present) are non-trivial prose, not a placeholder", () => {
    for (const p of allProjects) {
      for (const d of p.decisions) {
        expect(d.title.length, `${p.slug}: decision title too short`).toBeGreaterThan(3);
        expect(d.body.length, `${p.slug}: decision "${d.title}" body too short`).toBeGreaterThan(20);
        expect(
          /TODO|TBD|lorem/i.test(d.title) || /TODO|TBD|lorem/i.test(d.body),
          `${p.slug}: decision "${d.title}" looks like a placeholder`,
        ).toBe(false);
      }
    }
  });
```

- [ ] **Step 2: Run to verify it passes immediately**

Run: `npx vitest run src/lib/case-study-depth.test.ts`
Expected: PASS — this is a regression guard against *future* placeholder content, not a gap the migration in Tasks 2–3 should trip (all migrated prose is real). If it fails now, re-check Task 2/3's migrated content for a copy-paste error before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/lib/case-study-depth.test.ts
git commit -m "test: extend the placeholder/anti-fabrication guard to Project.decisions

Mirrors the existing Work constraints/tradeoffs guard in the same file.
Regression guard for future decisions content, not a gap in the
migration just completed — all 43 current entries already pass."
```

---

## Task 7: `list_decisions` MCP tool

**Files:**
- Modify: `src/lib/mcp-tools.ts`
- Modify: `src/lib/mcp-tools.test.ts`
- Modify: `src/app/api/mcp/[transport]/route.ts`
- Modify: `src/app/mcp/page.tsx`

All four files land in one commit — `tools-documented.test.ts` enforces the route and the page's `TOOLS` table agree, and `pnpm build` chains that test, so a partial commit here fails the build.

**Interfaces:**
- Consumes: `allDecisions` from `@/lib/decisions` (Task 4).
- Produces: a `listDecisionsData(tag?: string)` function other code could import later; a 10th registered MCP tool `list_decisions`.

- [ ] **Step 1: Write the failing test**

In `src/lib/mcp-tools.test.ts`, add to the existing imports:

```ts
import {
  RESUME_ROLES,
  getProfileData,
  listProjectsData,
  getProjectData,
  listWorkData,
  getWorkData,
  searchExperienceData,
  getResumeVariantData,
  listDecisionsData,
} from "./mcp-tools";
```

Add a new `it` block inside the existing `describe("mcp tools", ...)`:

```ts
  it("list_decisions returns real ledger entries and supports an optional tag filter", () => {
    const all = listDecisionsData();
    expect(all.length).toBeGreaterThan(0);
    for (const e of all) {
      expect(e.title).toBeTruthy();
      expect(e.body).toBeTruthy();
      expect(e.url).toContain("https://anvilry.vercel.app/");
    }
    // A tag nothing carries yet returns empty, not an error (tags are still unpopulated
    // per the spec's YAGNI deferral — this proves the filter path is safe either way).
    const filtered = listDecisionsData("nonexistent-tag");
    expect(filtered).toEqual([]);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/mcp-tools.test.ts`
Expected: FAIL — `listDecisionsData is not exported` (or a TypeScript error, depending on how the test runner surfaces a missing named import).

- [ ] **Step 3: Add `listDecisionsData` to `mcp-tools.ts`**

In `src/lib/mcp-tools.ts`, add the import and function (place near `listAllContentData`, the most similar existing tool):

```ts
import { allDecisions } from "@/lib/decisions";
```

```ts
export const decisionsTagSchema = {
  tag: z.string().optional().describe("filter to decisions carrying this tag; omit for all"),
};

/** All architecture-decision entries (project Key Decisions + work constraints/tradeoffs),
 *  optionally filtered by tag. */
export function listDecisionsData(tag?: string) {
  const entries = tag ? allDecisions.filter((e) => e.tags.includes(tag)) : allDecisions;
  return entries.map((e) => ({
    sourceKind: e.sourceKind,
    sourceName: e.sourceName,
    title: e.title,
    body: e.body,
    tags: e.tags,
    url: `${BASE}${e.href}`,
  }));
}
```

- [ ] **Step 4: Run to verify the unit test passes**

Run: `npx vitest run src/lib/mcp-tools.test.ts`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Register the tool in the route**

In `src/app/api/mcp/[transport]/route.ts`, add the import and a new `server.registerTool(...)` call after the existing `get_content_item` registration (inside the same handler function, before its closing `}`):

```ts
    server.registerTool(
      "list_decisions",
      {
        title: "List architecture decisions",
        description:
          "Real engineering tradeoffs across all projects and work case studies — the choice made, the alternative considered, and the cost paid. Optional tag filter.",
        inputSchema: T.decisionsTagSchema,
      },
      async ({ tag }) => wrap(T.listDecisionsData(tag)),
    );
```

- [ ] **Step 6: Add the documentation row**

In `src/app/mcp/page.tsx`, add a row to the `TOOLS` array (order doesn't matter — `tools-documented.test.ts` sorts before comparing):

```ts
  ["list_decisions", "Real architecture tradeoffs across projects and work, optionally filtered by tag"],
```

- [ ] **Step 7: Run the enforced contract test**

Run: `npx vitest run src/app/mcp/tools-documented.test.ts`
Expected: PASS — all 5 assertions (registered/documented counts match, no extra, no missing, identical sorted sets).

- [ ] **Step 8: Full local build check**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/mcp-tools.ts src/lib/mcp-tools.test.ts src/app/api/mcp/[transport]/route.ts src/app/mcp/page.tsx
git commit -m "feat(mcp): add list_decisions, the 10th MCP tool

Exposes the decisions ledger to AI agents querying the portfolio's MCP
server — the highest-leverage single addition in this phase, since an
agent evaluating engineering judgment previously had zero structured
access to this content. Registered tool + TOOLS table row +
mcp-tools.test.ts coverage land together, satisfying
tools-documented.test.ts (chained into pnpm build) on the first try."
```

---

## Task 8: e2e coverage for `/decisions`

**Files:**
- Modify: `e2e/views.spec.ts`

- [ ] **Step 1: Write the test**

Add to `e2e/views.spec.ts` (in the "Classic view" section, alongside the other `classic view: navigation to ... works` tests):

```ts
test("classic view: navigation to decisions page works", async ({ page }) => {
  await page.goto("/decisions");
  await expect(page).toHaveURL("/decisions");
  await expect(page.locator("main")).toBeVisible();
  // At least one decision card renders and links to a real canonical page.
  const firstLink = page.locator("main a[href^='/work/'], main a[href^='/projects/']").first();
  await expect(firstLink).toBeVisible();
  const href = await firstLink.getAttribute("href");
  expect(href).toMatch(/^\/(work|projects)\/[a-z0-9-]+$/);
});
```

- [ ] **Step 2: Run it**

Run: `pnpm e2e --project=chromium -g "decisions"`
Expected: PASS (requires a running build — see Task 9's verification step, which runs the full e2e suite anyway; running it here first catches an obvious failure early).

- [ ] **Step 3: Commit**

```bash
git add e2e/views.spec.ts
git commit -m "test(e2e): add /decisions navigation + canonical-link smoke test"
```

---

## Task 9: Ship

Follow this session's standing pattern for every prior round.

- [ ] **Step 1: Create the branch**

```bash
git fetch origin
git checkout -B feat/decisions-ledger origin/develop
```

(If Tasks 1–8 were already committed on a different local branch, cherry-pick or rebase those commits onto this fresh branch from `origin/develop` instead of starting over.)

- [ ] **Step 2: Run the docs-index citation checker**

```bash
node scripts/check-index-citations.mjs
```

Expected: exits 0. This migration touched 11 content files plus `mcp-tools.ts`/`route.ts`/`mcp/page.tsx` — files this session has twice seen shift line-number citations in `docs/index/*.md`. If it reports stale citations, fix the prose in the listed `docs/index/*.md` files (repoint to the correct current line, or drop an exact line pin in favor of a range/no-pin if the checker's regex collides with a pre-existing fingerprint — see this session's own precedent for that exact failure mode) before continuing. Do not run `--write` — it refuses while unrelated pre-existing drift exists elsewhere in the repo, and forcing `--accept-warnings` is out of scope for this phase.

- [ ] **Step 3: Full local verification**

```bash
npx tsc --noEmit
pnpm lint
pnpm test
```

Expected: all green. `pnpm test` should show the same pre-existing 9-failure baseline (`site-footer.dom.test.tsx`, `voice-pitfalls.dom.test.ts` — unrelated Node-version/localStorage issue, documented earlier this session) plus every new test from Tasks 4/6/7 passing.

```bash
pnpm content
npx next build
node scripts/bundle-budget.mjs
npx pagefind --site .next/server/app --output-path public/pagefind
```

Expected: all succeed. Check `bundle-budget.mjs`'s output for headroom — the new `/decisions` route adds a new page to the budget table; confirm it doesn't exceed `MAX_FIRST_LOAD_BYTES`.

```bash
npx playwright test --project=chromium
npx playwright test --project=mobile-safari
```

Expected: green on both, including the new decisions test from Task 8. If `ask-portfolio.dom.test.tsx`'s "Hello from the corpus" test flakes in the `pnpm test` run (a documented pre-existing issue, unrelated to this phase), re-run just that file in isolation 2–3 times to confirm it's the known flake, not a regression, before proceeding.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/decisions-ledger
gh pr create --base develop --title "feat: Decisions Ledger — surface existing architecture-decision narratives" --body-file /tmp/pr-body-decisions-ledger.md
```

(Write `/tmp/pr-body-decisions-ledger.md` first, summarizing: what shipped per task above, the two migration edge cases and how they were resolved, verification results, and a test-plan checklist — matching the PR body style used for every prior round this session.)

- [ ] **Step 5: Watch CI**

```bash
gh pr checks <PR_NUMBER> --watch
```

If the known `ask-portfolio.dom.test.tsx` flake fails a CI run: `gh run rerun <RUN_ID> --failed`, then re-watch. Any other failure is a real regression — investigate before re-running.

- [ ] **Step 6: Merge**

Once all checks are green:

```bash
gh pr merge <PR_NUMBER> --merge
```

Do **not** open a develop→main promotion PR as part of this task — that's a separate, human-gated step after all 3 phases of the feature plan have shipped to `develop`.

---

## Self-Review Notes

- **Spec coverage**: every Phase 3 requirement from the design spec has a task — schema (Task 1), migration (Tasks 2–3), derivation module + bijection test (Task 4), route (Task 5), placeholder guard (Task 6), MCP tool (Task 7), e2e (Task 8), shipping incl. the citation-checker note (Task 9). The spec's explicitly-deferred items (corpus.ts integration, tag taxonomy, JSON-LD, pattern clustering) have no task here — correct, they're out of scope for this phase.
- **Type consistency checked**: `LedgerEntry`'s fields (`id`, `sourceKind`, `sourceSlug`, `sourceName`, `title`, `body`, `tags`, `href`) are identical everywhere referenced — Task 4's definition, Task 4's test, Task 5's route (via `allDecisions` directly), Task 7's `listDecisionsData` (which reshapes to a public MCP-facing shape with `url` instead of `href`, deliberately — matches every other tool's `${BASE}${...}` convention rather than leaking the internal `href` field name).
- **No placeholders**: every migration step quotes real, verbatim prose read from the actual files during planning; the two format edge cases (inkforge's title-less paragraphs, trelix's non-decision trailing paragraph) are resolved with concrete text, not left as open questions.
