# Add Tombstone, trelix & Inkforge to Anvilry Portfolio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tombstone (v2.2.0), trelix (v1.0.0), and Inkforge (v0.1.2) as portfolio project entries in Anvilry — including MDX content, hero-graph nodes, article cross-links, and passing build/test gates.

**Architecture:** Each project gets an MDX file in `content/projects/` (Velite-processed), a new node in `src/lib/graph-data.ts` (the hero WebGL scene), and a `NODE_CONTENT` entry in `src/lib/game-model.ts` (the bijection that lets the gamified view open a dossier for every node). Two published articles (Tombstone launch + Inkforge build) also get `content/articles/` cross-link MDX files pointing at the already-existing notes. The Anvilry build runs Velite then Vitest — the bijection test (`game-model.test.ts`) blocks deploy if any graph node is orphaned from content, so all four files (MDX + graph node + NODE_CONTENT entry + article) must land in the same branch.

**Tech Stack:** Next.js 16 App Router, Velite (MDX → typed JSON), Vitest, TypeScript strict, pnpm, Conventional Commits, branch → PR → develop.

## Global Constraints

- Branch from `develop`: `feat/add-tombstone-trelix-inkforge`
- Never commit to `develop` directly; PR target is `develop`
- No `Co-Authored-By` trailer in commit messages (CLAUDE.md rule)
- Conventional commit format: `feat(content): …`
- Content files: `.mdx` extension for projects/articles; `.md` is also accepted by Velite but use `.mdx` for consistency with existing project files
- `themeGroup` enum in `velite.config.ts` has exactly three valid values — use one verbatim: `"Agent Frameworks & Infrastructure"` | `"Code Intelligence & Engines"` | `"Tooling & Lab"`
- `group` field must be one of those three strings exactly — Velite's Zod schema rejects anything else
- `repo` field must be a valid URL (Velite validates with `s.string().url()`)
- `tech` field is `string[]` — keep each entry short (one word or hyphenated, no versions)
- `order` controls sort rank; existing projects use 1–10; use 5, 6, 7 for new entries to slot between existing (adjust if needed)
- `pnpm test` must pass (vitest run) before committing
- `pnpm build` must pass before opening PR (Velite + vitest + Next.js compile)
- Working directory for all commands: `/Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev`
- `article` content files: body can be empty (just frontmatter + empty line) — the card links to `externalUrl`; `linkedNote` points at the existing note slug
- `source` enum for articles: `"devto" | "substack" | "medium" | "linkedin" | "hashnode" | "native"`

---

### Task 1: Branch + Tombstone project MDX

**Files:**
- Create: `content/projects/tombstone.mdx`
- No test file needed (Velite schema validation is the gate; game-model test is Task 4)

**Interfaces:**
- Produces: `slug: tombstone` available in `allProjects` from `@/lib/content` (used by Task 4)

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
git checkout develop
git pull origin develop
git checkout -b feat/add-tombstone-trelix-inkforge
```

- [ ] **Step 2: Verify the branch is clean**

```bash
git status
```
Expected: `nothing to commit, working tree clean`

- [ ] **Step 3: Create `content/projects/tombstone.mdx`**

```mdx
---
slug: tombstone
name: Tombstone
tagline: Production intelligence layer for 5,000+ feature flags.
group: Agent Frameworks & Infrastructure
repo: https://github.com/sairam0424/Tombstone
commits: 289
tech: [Go, Python, TypeScript, React, PostgreSQL, Redis, Kafka, pgvector, Docker, Kubernetes]
pinned: true
pinRank: 4
featured: true
order: 5
excerpt: Self-hosted feature flag intelligence with blast-radius gating, circuit-breaker auto-rollback, causal incident correlation ("What Changed?"), and Knight Capital–style tombstoning. Go + Python + TypeScript polyglot.
---

**Tombstone** is a self-hosted production intelligence layer for feature flags at scale — built to answer the question that every SRE asks at 2am but no flag system answers: *which flag caused this incident, and can I roll it back safely right now?*

At its core, Tombstone treats flags as **causal agents in a live production system**, not boolean configuration. It combines an 8-service polyglot backend (Go for performance, Python for ML, TypeScript for the management UI) with a **circuit-breaker auto-rollback** engine, a **causal dependency graph** for "What Changed?" incident correlation, and a **Merkle-linked audit trail** connected to Sigstore Rekor for SOC2-grade immutability.

- **Circuit-breaker auto-rollback** — 5%+ error rate over 100 requests in 10s auto-disables the flag; no human in the loop
- **Blast-radius gating** — BLOCKED / HIGH / MEDIUM / LOW tiers; BLOCKED changes require a 10-char justification
- **3-model ensemble anomaly detection** — Z-score + Isolation Forest + EWMA with 2/3 vote, eliminating false positives
- **Thompson Sampling + LinUCB bandit** for ML-driven rollout recommendations
- **Causal dependency graph** — Redis sorted sets (O(log n) updates), daily rebuild at 02:00 UTC
- **Merkle audit chains** — SHA-256 coverage of every state transition, Rekor transparency log submission
- **WASM evaluation engine** (`@flagmind/eval`) — zero-dependency, runs on Cloudflare Workers

> Inspired by Knight Capital's $440M flag incident (2012). 289 commits, 8 services, full Kubernetes operator.
```

- [ ] **Step 4: Run Velite to confirm schema validates**

```bash
pnpm content
```
Expected: exits 0, no Zod validation errors. If errors appear, fix the frontmatter field that failed (check the exact error message against `velite.config.ts`).

- [ ] **Step 5: Commit**

```bash
git add content/projects/tombstone.mdx
git commit -m "feat(content): add Tombstone project MDX — v2.2.0, 289 commits"
```

---

### Task 2: trelix project MDX

**Files:**
- Create: `content/projects/trelix.mdx`

**Interfaces:**
- Produces: `slug: trelix` available in `allProjects` from `@/lib/content` (used by Task 4)

- [ ] **Step 1: Create `content/projects/trelix.mdx`**

```mdx
---
slug: trelix
name: trelix
tagline: Production-grade code indexing and semantic retrieval engine.
group: Code Intelligence & Engines
repo: https://github.com/sairam0424/trelix
commits: 201
tech: [Python, tree-sitter, sqlite-vec, SQLite, BM25, Pydantic, FastAPI, LiteLLM, networkx]
pinned: true
pinRank: 5
featured: true
order: 6
excerpt: Hybrid semantic + BM25 + grep code search with call-graph expansion, adaptive query planning, and GraphRAG synthesis. Zero-infra default (SQLite + HNSW). 929 unit tests. MCP server for Claude Code and Cursor.
---

**trelix** is a production-ready code indexing and retrieval engine that transforms any repository into a queryable knowledge base. Where grep finds exact strings, trelix finds *relevant* code — via a hybrid retrieval pipeline, call-graph traversal, and LLM synthesis that answers "how does auth work?" with actual code paths, not a keyword hit list.

The engine combines three parallel retrieval legs — **semantic embeddings** (voyage/OpenAI/Bedrock Titan), **BM25 keyword search** (SQLite FTS5), and **exact grep** — fused via Reciprocal Rank Fusion. A **3-tier adaptive query planner** routes direct lookups to tier 1 (zero retrieval), single-intent queries to tier 2 (8 intent types), and complex decomposition to tier 3 (LLM parallel planning). For large result sets, **GraphRAG map-reduce** scales synthesis beyond context limits.

- **Contextual chunking** — LLM-generated per-chunk summaries; 67% retrieval failure reduction vs. naive chunking
- **Call-graph expansion** — PageRank-weighted traversal with `callee_type_hint` precision (40% fewer false edges)
- **Universal LLM client factory** — 5 provider backends (OpenAI, Azure, Anthropic, Bedrock, Vertex) via one env var
- **Zero-infra default** — single `.trelix/index.db` SQLite file with HNSW vector index + FTS5; no external services
- **Real-time watcher** — debounced 500ms incremental re-indexing on file save, respects `.gitignore`
- **MCP server** — integrates natively with Claude Code, Cursor, Windsurf, LangChain, LlamaIndex

> 929 unit tests + 16 integration tests, 75% coverage gate enforced. First stable release v1.0.0.
```

- [ ] **Step 2: Run Velite to confirm schema validates**

```bash
pnpm content
```
Expected: exits 0, both tombstone and trelix appear in the Velite output without errors.

- [ ] **Step 3: Commit**

```bash
git add content/projects/trelix.mdx
git commit -m "feat(content): add trelix project MDX — v1.0.0, 929 unit tests"
```

---

### Task 3: Inkforge project MDX

**Files:**
- Create: `content/projects/inkforge.mdx`

**Interfaces:**
- Produces: `slug: inkforge` available in `allProjects` from `@/lib/content` (used by Task 4)

- [ ] **Step 1: Create `content/projects/inkforge.mdx`**

```mdx
---
slug: inkforge
name: Inkforge
tagline: Notes, topics, or code → published technical articles.
group: Tooling & Lab
repo: https://github.com/sairam0424/Inkforge
commits: 89
tech: [TypeScript, Node.js, Next.js, Turborepo, Bedrock, BM25, Playwright, Commander, Vitest]
pinned: true
pinRank: 7
featured: true
order: 7
excerpt: STORM two-stage pipeline (outline → draft → polish) with BM25 in-memory RAG, streaming web UI, and one-command publishing to Dev.to, Hashnode, and a Playwright-rendered LinkedIn carousel.
---

**Inkforge** is personal publishing infrastructure — a CLI + web UI that turns scattered notes, topics, or code directories into polished technical articles and publishes them to Dev.to, Hashnode, and LinkedIn without leaving the terminal.

The core is a **STORM two-stage pipeline**: first an explicit outline artifact is generated (section tree + word budgets per section), then each section is drafted independently with context chaining, then a single humanization pass adds voice and transitions. For notes-dump inputs, an in-process **BM25 RAG layer** (no external vector DB — k1=1.5, b=0.75, hierarchical Markdown chunker) surfaces the top-5 relevant chunks into the outline prompt.

- **STORM pipeline with explicit outlines** — sections drafted independently, no context explosion; 4096-token budget with JSON truncation repair
- **BM25 in-memory RAG** — zero external service; scales to thousands of personal notes; 95% of semantic search quality at 10% of the cost
- **Dual output sinks** — primary `.md` files for portability; optional Anvilry `.mdx` mirror for Velite
- **Playwright-based asset rendering** — pixel-perfect 1400×787px cover images and 15-slide LinkedIn carousels (2× pixel density); never macOS `qlmanage`
- **Platform publishers** — Dev.to REST API v1 (canonical_url), Hashnode GraphQL v2 (originalArticleURL), cross-posting without SEO duplicate penalties
- **Streaming web UI** — SSE event stream from CLI pipeline into browser; section-by-section live preview at `/generate`
- **Content-as-committed-data** — generated articles gitignored; published tracking committed as source of truth

> 11/11 tests passing. Built the Tombstone launch article (3,531 words) from incident notes in one command. Ships as `@inkforge/cli`.
```

- [ ] **Step 2: Run Velite to confirm schema validates**

```bash
pnpm content
```
Expected: exits 0, tombstone + trelix + inkforge all appear without errors.

- [ ] **Step 3: Commit**

```bash
git add content/projects/inkforge.mdx
git commit -m "feat(content): add Inkforge project MDX — v0.1.2, STORM pipeline"
```

---

### Task 4: Hero-graph nodes + NODE_CONTENT entries (build gate)

This is the critical task. The `game-model.test.ts` bijection test **blocks deployment** if any project in `allProjects` is not reachable from a graph node, or if any graph node id is missing from `NODE_CONTENT`. All three new projects must be added here atomically.

**Files:**
- Modify: `src/lib/graph-data.ts` (add 3 nodes + 3 edges)
- Modify: `src/lib/game-model.ts` (add 3 NODE_CONTENT entries)
- Test: `src/lib/game-model.test.ts` (already exists — run it; do NOT modify it)

**Interfaces:**
- Consumes: slugs `tombstone`, `trelix`, `inkforge` from Tasks 1–3 (must exist in Velite)
- Produces: `NODE_CONTENT["tombstone"]`, `NODE_CONTENT["trelix"]`, `NODE_CONTENT["inkforge"]` so `resolveNode()` returns non-null for all three

- [ ] **Step 1: Read the current state of both files**

```bash
# Confirm current node count and existing positions before adding
grep -n "id:" src/lib/graph-data.ts | wc -l
grep -n "kind: \"project\"" src/lib/graph-data.ts
```
Expected: 13 existing nodes (5 work + 8 project).

- [ ] **Step 2: Add three new nodes to `src/lib/graph-data.ts`**

Open `src/lib/graph-data.ts`. The current `graphNodes` array ends at line ~35 with the `nhl` entry. Add three new entries **inside** the array, after the last `// Tooling & lab` comment block:

```typescript
// Production intelligence & publishing tools
{ id: "tombstone", label: "Tombstone", kind: "tool", pos: [-1.0, 2.1, 0.8] },
{ id: "trelix", label: "trelix", kind: "engine", pos: [3.0, 0.5, -0.8] },
{ id: "inkforge", label: "Inkforge", kind: "tool", pos: [0.8, 2.0, 1.2] },
```

Also add three edges to `graphEdges` (real lineage relationships):

```typescript
// Tombstone and Inkforge are in the same production-tooling cluster
["tombstone", "nhl"],         // Tombstone is part of the Not-Humans-World workspace
["trelix", "graph-forge"],    // trelix is a code-intelligence engine (sibling of Graph-Forge)
["inkforge", "commandvault"], // Inkforge generates content that CommandVault indexes
```

After editing, the file should look like:

```typescript
// (existing nodes unchanged above this block)
// Production intelligence & publishing tools
{ id: "tombstone", label: "Tombstone", kind: "tool", pos: [-1.0, 2.1, 0.8] },
{ id: "trelix", label: "trelix", kind: "engine", pos: [3.0, 0.5, -0.8] },
{ id: "inkforge", label: "Inkforge", kind: "tool", pos: [0.8, 2.0, 1.2] },
```

And in `graphEdges`:
```typescript
// (existing edges unchanged above this block)
["tombstone", "nhl"],
["trelix", "graph-forge"],
["inkforge", "commandvault"],
```

- [ ] **Step 3: Add three NODE_CONTENT entries to `src/lib/game-model.ts`**

Open `src/lib/game-model.ts`. Find the `NODE_CONTENT` object (around line 28). It currently ends with:

```typescript
  commandvault: { kind: "project", slug: "commandvault" },
  nhl: { kind: "project", slug: "not-humans-lab" }, // node id != slug
```

Add the three new entries **inside** the object, after `nhl`:

```typescript
  // Production intelligence & publishing
  tombstone: { kind: "project", slug: "tombstone" },
  trelix: { kind: "project", slug: "trelix" },
  inkforge: { kind: "project", slug: "inkforge" },
```

- [ ] **Step 4: Run the bijection test to verify correctness**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
npx vitest run src/lib/game-model.test.ts
```

Expected output (all passing):
```
✓ game-model coverage > maps every graph node id (no node left unmapped)
✓ game-model coverage > resolves every graph node to a real content item (forward coverage)
✓ game-model coverage > points every node at a slug that actually exists in Velite
✓ game-model coverage > covers every content item with a graph node (reverse coverage)
✓ game-model coverage > is a bijection between nodes and content (counts line up)
✓ game-model coverage > deep-links every quest node into a canonical Classic route
✓ game-model coverage > groups every quest node exactly once (no loss, no dup)
✓ game-model anti-fabrication > dossier facts trace to real content values
```

If any test fails:
- `"maps every graph node id"` fails → a node id in `graph-data.ts` is missing from `NODE_CONTENT`
- `"covers every content item"` fails → a project slug in `allProjects` has no matching graph node
- `"points every node at a slug"` fails → a NODE_CONTENT slug doesn't match any `.mdx` file slug

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/graph-data.ts src/lib/game-model.ts
git commit -m "feat(graph): add tombstone, trelix, inkforge nodes to hero graph + NODE_CONTENT"
```

---

### Task 5: Article cross-links — Tombstone launch posts

Two published articles about Tombstone are live on dev.to and Substack. Add them as `content/articles/` entries so they appear in the `/articles` section and link back to the canonical note already in `content/notes/`.

The canonical note slug is: `how-i-built-tombstone-feature-flag-intelligence-platform` (already exists in `content/notes/`).

**Files:**
- Create: `content/articles/tombstone-launch-devto.mdx`
- Create: `content/articles/tombstone-launch-substack.mdx`

**Interfaces:**
- Consumes: existing note slug `how-i-built-tombstone-feature-flag-intelligence-platform`
- `linkedNote` field routes card clicks to the local note, not the external URL

- [ ] **Step 1: Create `content/articles/tombstone-launch-devto.mdx`**

```mdx
---
slug: tombstone-launch-devto
title: "How I Built Tombstone: A Self-Hosted Feature Flag Intelligence Platform to Prevent the Next Knight Capital"
date: 2026-06-27
summary: "A first-person engineering account of building Tombstone — 8 services, circuit-breaker auto-rollback, causal incident correlation, and Merkle-linked audit trails — born from a 2am on-call incident."
source: devto
externalUrl: "https://dev.to/sai_ram_0000/how-i-built-tombstone-a-self-hosted-feature-flag-intelligence-platform-to-prevent-the-next-knight-10lp"
canonicalUrl: "https://anvilry.vercel.app/notes/how-i-built-tombstone-feature-flag-intelligence-platform"
linkedNote: how-i-built-tombstone-feature-flag-intelligence-platform
tags: ["feature-flags", "system-design", "open-source", "devops", "incident-response", "distributed-systems"]
readingTime: 13
draft: false
---
```

- [ ] **Step 2: Create `content/articles/tombstone-launch-substack.mdx`**

```mdx
---
slug: tombstone-launch-substack
title: "I Built Tombstone Because I Was Tired of 2am Flag Incidents"
date: 2026-06-27
summary: "Why I spent months building a self-hosted feature flag intelligence platform instead of just using LaunchDarkly — the 2am incident that started it, the Knight Capital lesson, and how circuit-breaker auto-rollback works."
source: substack
externalUrl: "https://open.substack.com/pub/sairam0000/p/i-built-tombstone-because-i-was-tired?r=2xzeyx&utm_campaign=post&utm_medium=web&showWelcomeOnShare=true"
canonicalUrl: "https://anvilry.vercel.app/notes/how-i-built-tombstone-feature-flag-intelligence-platform"
linkedNote: how-i-built-tombstone-feature-flag-intelligence-platform
tags: ["feature-flags", "open-source", "engineering", "incident-response"]
readingTime: 13
draft: false
---
```

- [ ] **Step 3: Run Velite to confirm both article files validate**

```bash
pnpm content
```
Expected: exits 0, no Zod errors. If `linkedNote` validation fails (Velite doesn't validate cross-references), the field is just a string — it's fine; the UI uses it as a slug lookup.

- [ ] **Step 4: Commit**

```bash
git add content/articles/tombstone-launch-devto.mdx content/articles/tombstone-launch-substack.mdx
git commit -m "feat(content): add Tombstone launch article cross-links (dev.to + Substack)"
```

---

### Task 6: Article cross-links — Inkforge build post

One published article about Inkforge is live on dev.to. Add it as a `content/articles/` entry linking to the canonical note.

The canonical note slug is: `how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-bedrock` (already exists in `content/notes/`).

**Files:**
- Create: `content/articles/inkforge-build-devto.mdx`

- [ ] **Step 1: Create `content/articles/inkforge-build-devto.mdx`**

```mdx
---
slug: inkforge-build-devto
title: "How I Built Inkforge: Designing an AI-Powered Article System with STORM Pipeline, BM25 RAG, and AWS Bedrock"
date: 2026-06-27
summary: "How I designed Inkforge's generation engine — a STORM two-stage pipeline with explicit outline artifacts, in-process BM25 RAG (no vector DB), and Playwright-rendered LinkedIn carousels."
source: devto
externalUrl: "https://dev.to/sai_ram_0000/how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-g2n-temp-slug-2132717"
canonicalUrl: "https://anvilry.vercel.app/notes/how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-bedrock"
linkedNote: how-i-built-inkforge-designing-an-ai-powered-article-system-with-storm-pipeline-bm25-rag-and-aws-bedrock
tags: ["ai", "typescript", "content", "llm", "engineering"]
readingTime: 12
draft: false
---
```

- [ ] **Step 2: Run Velite to confirm validation**

```bash
pnpm content
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add content/articles/inkforge-build-devto.mdx
git commit -m "feat(content): add Inkforge build article cross-link (dev.to)"
```

---

### Task 7: Full build verification + PR

Run the complete build pipeline (Velite + vitest + Next.js compile), then open a PR to `develop`.

**Files:**
- No file changes — verification only, then `gh pr create`

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm test
```
Expected: all tests pass. If `game-model.test.ts` fails, go back to Task 4 and fix the mapping. If another test fails, investigate that specific test file.

- [ ] **Step 2: Run full production build**

```bash
pnpm build
```
Expected: exits 0. Output should show the three new project pages appearing in the static route list:
```
○ /projects/tombstone
○ /projects/trelix
○ /projects/inkforge
```
And the three new article entries:
```
○ /articles/tombstone-launch-devto
○ /articles/tombstone-launch-substack
○ /articles/inkforge-build-devto
```

If Velite throws a schema error, fix the offending frontmatter field and re-run.
If Next.js throws a TypeScript error, check `src/lib/graph-data.ts` — the `kind` field on new nodes must be one of `"work" | "agent" | "engine" | "tool"`.

- [ ] **Step 3: Verify git log looks correct**

```bash
git log --oneline develop..HEAD
```
Expected output (6 commits in order):
```
<sha> feat(content): add Inkforge build article cross-link (dev.to)
<sha> feat(content): add Tombstone launch article cross-links (dev.to + Substack)
<sha> feat(graph): add tombstone, trelix, inkforge nodes to hero graph + NODE_CONTENT
<sha> feat(content): add Inkforge project MDX — v0.1.2, STORM pipeline
<sha> feat(content): add trelix project MDX — v1.0.0, 929 unit tests
<sha> feat(content): add Tombstone project MDX — v2.2.0, 289 commits
```

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/add-tombstone-trelix-inkforge
```

- [ ] **Step 5: Open PR to develop**

```bash
gh pr create \
  --base develop \
  --title "feat(content): add Tombstone, trelix & Inkforge to portfolio" \
  --body "$(cat <<'EOF'
## Summary

- Adds **Tombstone** (v2.2.0, 289 commits) — production intelligence layer for feature flags: circuit-breaker auto-rollback, causal dependency graph, Merkle audit chains, 8-service Go+Python+TypeScript polyglot
- Adds **trelix** (v1.0.0, 201 commits) — code indexing engine: hybrid search (semantic + BM25 + grep), call-graph expansion, GraphRAG synthesis, 929 unit tests, MCP server
- Adds **Inkforge** (v0.1.2, 89 commits) — AI article generator: STORM pipeline, BM25 RAG, Playwright asset rendering, Dev.to + Hashnode publishing
- Adds 3 article cross-links: Tombstone dev.to + Substack, Inkforge dev.to
- Wires all 3 new projects into hero graph (`graph-data.ts`) + `NODE_CONTENT` bijection

## Test plan

- [ ] `pnpm test` passes — game-model.test.ts bijection verified (all 8 assertions green)
- [ ] `pnpm build` passes — Velite schema validates, Next.js compiles all new routes
- [ ] `/projects/tombstone`, `/projects/trelix`, `/projects/inkforge` render correctly
- [ ] `/articles` page shows 3 new Tombstone/Inkforge article cards
- [ ] Gamified (Play) view — 3 new graph nodes visible, clicking each opens correct dossier
EOF
)"
```

---

## File Map Summary

| File | Task | Action |
|------|------|--------|
| `content/projects/tombstone.mdx` | T1 | Create |
| `content/projects/trelix.mdx` | T2 | Create |
| `content/projects/inkforge.mdx` | T3 | Create |
| `src/lib/graph-data.ts` | T4 | Modify — add 3 nodes + 3 edges |
| `src/lib/game-model.ts` | T4 | Modify — add 3 NODE_CONTENT entries |
| `content/articles/tombstone-launch-devto.mdx` | T5 | Create |
| `content/articles/tombstone-launch-substack.mdx` | T5 | Create |
| `content/articles/inkforge-build-devto.mdx` | T6 | Create |

**Total: 6 new files, 2 modified files, 6 commits, 1 PR → develop**

## End-to-End Verification After Merge

```bash
# After PR merges to develop, pull and verify
git checkout develop && git pull

# Run full build
pnpm build

# Spot-check routes
curl -s https://anvilry.vercel.app/projects/tombstone | grep -i "tombstone"
curl -s https://anvilry.vercel.app/projects/trelix | grep -i "trelix"
curl -s https://anvilry.vercel.app/projects/inkforge | grep -i "inkforge"
```
