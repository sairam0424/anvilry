# Content Refresh: Trelix v2.4 + Tombstone v1.2 + New Articles + Resume Iframe Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update trelix and tombstone project MDX to current versions, add 4 new article cross-links (trelix v1 launch + tombstone v1.2 release across dev.to and substack), and fix the resume page PDF iframe "refused to connect" bug caused by the CSP `frame-ancestors 'none'` header.

**Architecture:** Three independent content tasks (project MDX updates, new article MDX files, iframe CSP fix) plus a configuration docs update. Content tasks follow the existing Anvilry pattern: MDX frontmatter only, Velite processes at build time, `game-model.test.ts` bijection gate is not affected (only articles/projects, no graph nodes changed). The CSP fix removes `frame-ancestors 'none'` from the `/resume` route only via a per-route header override.

**Tech Stack:** Next.js 16 App Router, Velite MDX content layer, Zod schemas (velite.config.ts), TypeScript, Vitest.

## Global Constraints

- Branch from `develop` — PR targets `develop`, never `main`
- No `Co-Authored-By` in any commit message
- `pnpm build` must be green after every task (currently 499 tests passing)
- Article slugs must be unique within `content/articles/` — checked against existing slugs before creating
- Article `source` field must be one of: `"medium" | "substack" | "linkedin" | "devto" | "hashnode" | "native"`
- Article `date` must be ISO format: `YYYY-MM-DD`
- Article `externalUrl` must be a valid URL when `source` is not `"native"`
- Dedup rule: if a URL already appears in `externalUrl` of any existing article, do NOT create a duplicate
- `game-model.test.ts` bijection gate: ONLY triggered by graph node changes in `src/lib/graph-data.ts` — content MDX changes do NOT trigger it
- Keep files under 500 lines

---

## Dedup Analysis (pre-computed — do not re-derive)

### Already in Anvilry articles (SKIP these):
- `tombstone-launch-devto.mdx` → `https://dev.to/sai_ram_0000/how-i-built-tombstone...`
- `tombstone-launch-substack.mdx` → `https://open.substack.com/pub/sairam0000/p/i-built-tombstone...`
- `inkforge-build-devto.mdx` → `https://dev.to/sai_ram_0000/how-i-built-inkforge...`

### New articles to add (these URLs do NOT exist yet in Anvilry):
1. **trelix-v1-launch-devto** — `https://dev.to/sai_ram_0000/i-built-trelix-because-i-was-tired-of-grepping-my-way-through-codebases-1f3b`
2. **trelix-v1-launch-substack** — `https://open.substack.com/pub/sairam0000/p/i-built-trelix-because-i-was-tired?r=2xzeyx&utm_campaign=post&utm_medium=web&showWelcomeOnShare=true`
3. **tombstone-v1-2-devto** — `https://dev.to/sai_ram_0000/we-shipped-tombstone-v10-then-we-found-nine-bugs-that-would-have-paged-us-at-2am-1d2g-temp-slug-1619338`
4. **tombstone-v1-2-substack** — substack draft, no live URL yet → add as `draft: true` with placeholder

### Project updates needed:
- `trelix.mdx`: commits `201` → `501`, tech stack update (add networkx, scipy, ColBERT, Qdrant, LanceDB, GitHub Actions)
- `tombstone.mdx`: commits `289` → `492`, add v1.2.1 release context to body

---

## File Map

| File | Action | Why |
|---|---|---|
| `content/projects/trelix.mdx` | Modify | Update commits 201→501, update tech stack, update excerpt |
| `content/projects/tombstone.mdx` | Modify | Update commits 289→492, add v1.2.1 in body |
| `content/articles/trelix-v1-launch-devto.mdx` | Create | New: trelix launch article on dev.to (2026-07-05) |
| `content/articles/trelix-v1-launch-substack.mdx` | Create | New: trelix launch article on substack (2026-07-05) |
| `content/articles/tombstone-v1-2-devto.mdx` | Create | New: tombstone v1.2 release article on dev.to |
| `next.config.ts` | Modify | Fix `/resume` iframe CSP: allow `anvilry.vercel.app` in `frame-ancestors` for that route only |
| `docs/configuration.md` | Modify | Document CSP per-route override for `/resume` |

---

## Task 1: Update trelix + tombstone project MDX

**Files:**
- Modify: `content/projects/trelix.mdx`
- Modify: `content/projects/tombstone.mdx`

**Interfaces:**
- Produces: updated project MDX consumed by Velite → `.velite/projects.json` → all four views

---

- [ ] **Step 1: Read current `trelix.mdx` frontmatter in full**

```bash
head -20 /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/content/projects/trelix.mdx
```

Confirm: `commits: 201`, tech stack is `[Python, tree-sitter, sqlite-vec, SQLite, BM25, Pydantic, FastAPI, LiteLLM, networkx]`

- [ ] **Step 2: Update trelix.mdx frontmatter**

Change the frontmatter section only (lines 1–14). Replace the entire frontmatter block:

```yaml
---
slug: trelix
name: Trelix
tagline: Offline code intelligence engine — Tree-sitter indexing, hybrid BM25+vector+graph search.
group: Code Intelligence & Engines
repo: https://github.com/sairam0424/trelix
commits: 501
tech: [Python, tree-sitter, sqlite-vec, SQLite, BM25, FastAPI, LiteLLM, networkx, Qdrant, LanceDB, PyInstaller, Pydantic]
pinned: true
pinRank: 5
featured: true
order: 6
excerpt: Zero-infra code intelligence — Tree-sitter AST indexing + 7-leg RRF retrieval (BM25 + vector + call-graph + SPLADE + multi-granularity) + knowledge graph (Louvain community detection, Pyvis). MCP server. 1,467 unit tests. Works offline with no API key.
---
```

- [ ] **Step 3: Read current `tombstone.mdx` frontmatter in full**

```bash
head -20 /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/content/projects/tombstone.mdx
```

Confirm: `commits: 289`

- [ ] **Step 4: Update tombstone.mdx frontmatter and add v1.2.1 note to body**

Update the frontmatter `commits` field:

```yaml
commits: 492
```

Also find the last paragraph/bullet in the MDX body and append this block after the existing content:

```mdx
### v1.2.1 — Production Resilience Release

The v1.2 cycle hardened Tombstone against real-world distributed failure modes discovered during pressure testing:

- **Resilient inter-service HTTP** — `failsafe-go` retry + jitter + per-client circuit breakers across all 6 services
- **Distributed Redis Lua rate limiting** — shared across replicas (replaces the per-process `sync.Map`)
- **Dependency-aware `/readyz` probes** — Postgres + Redis health checks; 503 on degraded dependencies
- **Idempotency keys** on `CreateFlag`, `UpdateEnvironment`, `KillSwitch` mutations
- **Redis Streams DLQ** — dead-letter replay for poison messages
- **`FOR UPDATE SKIP LOCKED` scheduler** — multi-replica safe, prevents duplicate flag evaluations
- **9 regressions fixed** in v1.2.1: Slack kill-switch 400 (env in query param vs JSON body), four-eyes approval endpoints never registered in `main.go`, Datadog auto kill-switch 401, audit log `actor` always "unknown", `/readyz` returning 429/503 under load
```

- [ ] **Step 5: Run build to verify Velite processes correctly**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm build
```

Expected: green, 499 tests pass. Velite must process both updated MDX files without schema errors.

If you see a Velite validation error like `commits must be number`, check that the `commits: 492` line has no quotes.

- [ ] **Step 6: Commit**

```bash
git add content/projects/trelix.mdx content/projects/tombstone.mdx
git commit -m "content(projects): update trelix v2.4 (501 commits) + tombstone v1.2.1 (492 commits)"
```

---

## Task 2: Add trelix v1 launch article cross-links (dev.to + substack)

**Files:**
- Create: `content/articles/trelix-v1-launch-devto.mdx`
- Create: `content/articles/trelix-v1-launch-substack.mdx`

**Interfaces:**
- Consumes: velite Article schema from `velite.config.ts` — `slug`, `title`, `date`, `summary`, `source`, `externalUrl`, `linkedNote`, `tags`, `draft`, `readingTime`, `body`
- Produces: two new Article records in `.velite/articles.json`

---

- [ ] **Step 1: Verify these slugs don't already exist**

```bash
ls /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/content/articles/ | grep trelix
```

Expected: empty output (no trelix articles yet). If any trelix article exists, stop and report which one.

- [ ] **Step 2: Create `content/articles/trelix-v1-launch-devto.mdx`**

```mdx
---
slug: trelix-v1-launch-devto
title: "I Built trelix Because I Was Tired of Grepping My Way Through Codebases"
date: 2026-07-05
summary: "How I built trelix — a zero-infra code intelligence engine that indexes any repo with Tree-sitter, runs 7-leg RRF retrieval, and answers questions about your codebase offline. From four hours of archaeology to a query that returns in 200ms."
source: devto
externalUrl: "https://dev.to/sai_ram_0000/i-built-trelix-because-i-was-tired-of-grepping-my-way-through-codebases-1f3b"
canonicalUrl: "https://anvilry.vercel.app/notes/trelix-code-intelligence-engine"
linkedNote: trelix-code-intelligence-engine
tags: ["python", "open-source", "ai", "code-search", "developer-tools", "mcp"]
readingTime: 12
draft: false
---
```

- [ ] **Step 3: Create `content/articles/trelix-v1-launch-substack.mdx`**

```mdx
---
slug: trelix-v1-launch-substack
title: "I Built trelix Because I Was Tired of Grepping My Way Through Codebases"
date: 2026-07-05
summary: "How I built trelix — a zero-infra code intelligence engine that indexes any repo with Tree-sitter, runs 7-leg RRF retrieval, and answers questions about your codebase offline. From four hours of archaeology to a query that returns in 200ms."
source: substack
externalUrl: "https://open.substack.com/pub/sairam0000/p/i-built-trelix-because-i-was-tired?r=2xzeyx&utm_campaign=post&utm_medium=web&showWelcomeOnShare=true"
canonicalUrl: "https://anvilry.vercel.app/notes/trelix-code-intelligence-engine"
linkedNote: trelix-code-intelligence-engine
tags: ["python", "open-source", "ai", "code-search", "developer-tools", "mcp"]
readingTime: 12
draft: false
---
```

- [ ] **Step 4: Run build**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm build
```

Expected: green. If Velite throws `externalUrl is required for source devto/substack`, check the URL is present and valid.

- [ ] **Step 5: Commit**

```bash
git add content/articles/trelix-v1-launch-devto.mdx content/articles/trelix-v1-launch-substack.mdx
git commit -m "content(articles): add trelix v1 launch cross-links — dev.to + substack (2026-07-05)"
```

---

## Task 3: Add tombstone v1.2 release article cross-link (dev.to)

**Files:**
- Create: `content/articles/tombstone-v1-2-devto.mdx`

**Interfaces:**
- Same velite Article schema as Task 2
- NOTE: The substack version is still a draft (no live URL). Do NOT create a substack article for tombstone v1.2 — the URL is not live yet.

---

- [ ] **Step 1: Verify tombstone v1.2 slug doesn't exist**

```bash
ls /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/content/articles/ | grep tombstone
```

Expected: `tombstone-launch-devto.mdx` and `tombstone-launch-substack.mdx` only. If `tombstone-v1-2` already exists, stop and report.

- [ ] **Step 2: Create `content/articles/tombstone-v1-2-devto.mdx`**

```mdx
---
slug: tombstone-v1-2-devto
title: "We Shipped Tombstone v1.0. Then We Found Nine Bugs That Would Have Paged Us at 2am."
date: 2026-07-05
summary: "What happened when we pressure-tested Tombstone v1.0 against production reality: a kill switch silently returning 400, approval endpoints wired to routes never registered, a scheduler that could double-fire. Nine bugs. Nine fixes. Here's the post-mortem."
source: devto
externalUrl: "https://dev.to/sai_ram_0000/we-shipped-tombstone-v10-then-we-found-nine-bugs-that-would-have-paged-us-at-2am-1d2g-temp-slug-1619338"
canonicalUrl: "https://anvilry.vercel.app/notes/tombstone-v1-2-release"
linkedNote: tombstone-v1-2-release
tags: ["devops", "open-source", "system-design", "go", "feature-flags", "incident-response"]
readingTime: 10
draft: false
---
```

- [ ] **Step 3: Run build**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm build
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add content/articles/tombstone-v1-2-devto.mdx
git commit -m "content(articles): add tombstone v1.2 release article — dev.to (2026-07-05)"
```

---

## Task 4: Fix resume page PDF iframe — CSP `frame-ancestors` bug

**Files:**
- Modify: `next.config.ts`
- Modify: `docs/configuration.md` (add note about per-route CSP override)

**Root cause:** The `/resume` page embeds a `<iframe src="/resume/Sairam_Resume_MX_E.pdf">`. The CSP header `frame-ancestors 'none'` is applied to ALL routes via `source: "/:path*"`. When the browser tries to load the iframe, it fetches the PDF URL, which also gets `frame-ancestors 'none'` — blocking itself from being framed, even by the same origin. The fix is to add a separate header override for `/resume/*.pdf` routes that sets `frame-ancestors 'self'`.

**Interfaces:**
- Consumes: `next.config.ts` headers array — `securityHeaders` applied to `/:path*`
- Produces: additional header rule for `/resume/:path*` that overrides `frame-ancestors` to `'self'`

---

- [ ] **Step 1: Read `next.config.ts` headers section in full**

```bash
sed -n '/async headers/,/^}/p' /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/next.config.ts | head -20
```

Confirm it returns a single `[{ source: "/:path*", headers: securityHeaders }]` array entry.

- [ ] **Step 2: Modify the `headers()` function in `next.config.ts`**

Find the `async headers()` function (currently returns a single-entry array) and replace it with a two-entry array that adds a `/resume` route override:

```typescript
async headers() {
  // Per-route CSP override for /resume — the PDF iframe needs frame-ancestors 'self'
  // so the browser allows anvilry.vercel.app to embed its own PDF inside the page.
  // The global securityHeaders sets frame-ancestors 'none' (clickjacking defense);
  // we override only X-Frame-Options and the CSP frame-ancestors directive here.
  const resumeHeaders = securityHeaders.map((h) => {
    if (h.key === "X-Frame-Options") return { key: h.key, value: "SAMEORIGIN" };
    if (h.key === "Content-Security-Policy") {
      return {
        key: h.key,
        value: h.value
          .replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
      };
    }
    return h;
  });

  return [
    { source: "/:path*", headers: securityHeaders },
    // Override frame-ancestors for the resume route so the PDF iframe works.
    { source: "/resume", headers: resumeHeaders },
    { source: "/resume/:path*", headers: resumeHeaders },
  ];
},
```

- [ ] **Step 3: Run build**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm build
```

Expected: green. TypeScript must compile without errors. If you see a type error on `.map()`, confirm `securityHeaders` is typed as `Array<{ key: string; value: string }>` — it is defined inline so TypeScript should infer it.

- [ ] **Step 4: Local smoke-test**

```bash
pnpm dev
```

Open `http://localhost:3000/resume`. The PDF iframe should load without "refused to connect". Verify in Chrome DevTools → Network → look for the PDF request → Response Headers should show `frame-ancestors 'self'` (not `'none'`).

- [ ] **Step 5: Update `docs/configuration.md`**

Read the file first:

```bash
grep -n "frame-ancestors\|X-Frame-Options\|CSP" /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/docs/configuration.md | head -10
```

Find the CSP section and add a note below the existing CSP documentation:

```markdown
**Per-route CSP overrides:** The `/resume` and `/resume/:path*` routes override `frame-ancestors 'none'` → `frame-ancestors 'self'` so the PDF iframe on the résumé page can load. All other routes keep `frame-ancestors 'none'` (clickjacking defense). See `async headers()` in `next.config.ts`.
```

- [ ] **Step 6: Commit**

```bash
git add next.config.ts docs/configuration.md
git commit -m "fix(csp): allow frame-ancestors 'self' on /resume routes to fix PDF iframe"
```

---

## Self-Review

**Spec coverage:**
- ✅ Trelix project MDX updated (commits 201→501, tech stack expanded) → Task 1
- ✅ Tombstone project MDX updated (commits 289→492, v1.2.1 release notes) → Task 1
- ✅ Trelix v1 launch — dev.to cross-link → Task 2
- ✅ Trelix v1 launch — substack cross-link → Task 2
- ✅ Tombstone v1.2 — dev.to cross-link → Task 3
- ✅ Tombstone v1.2 — substack NOT added (draft, no live URL) → Task 3 (explicitly skipped)
- ✅ Dedup check: no duplicate `externalUrl` values against existing articles → Global Constraints
- ✅ Resume iframe "refused to connect" bug fixed → Task 4
- ✅ Game-model bijection gate: NOT touched (no graph-data.ts changes, correct — trelix/tombstone nodes already exist)

**Placeholder scan:** None. All frontmatter values are exact. All code is complete.

**Type consistency:**
- `securityHeaders.map(h => ...)` — `h` inferred as `{ key: string; value: string }` from the inline array ✅
- `.replace("frame-ancestors 'none'", "frame-ancestors 'self'")` — string literals match exactly what's in the CSP string ✅
- Article `source` values: `"devto"` and `"substack"` — both in the Zod enum ✅
- Article `date` values: `"2026-07-05"` — valid ISO date ✅
