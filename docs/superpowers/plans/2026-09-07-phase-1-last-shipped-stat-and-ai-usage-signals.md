# Phase 1 — Last-Shipped Stat + AI Usage Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface an already-computed GitHub "last push" timestamp as a new stat card on the homepage, and add an AI usage-rights signal (Cloudflare Content Signals convention) to `robots.txt` plus a matching policy paragraph in `llms.txt`.

**Architecture:** Both changes are pure additions to existing, working code paths — no new fetch, no new route, no new dependency. Task 1 extends an existing client component's rendered data with a field its own backing API route already returns. Tasks 2–3 add one typed field and one template section to two existing, already-tested files.

**Tech Stack:** Next.js 16 (App Router, `MetadataRoute.Robots`), React 19, Vitest 4 (two projects: `node` for pure logic, `dom` for component tests via happy-dom), `@testing-library/react`.

**Spec:** `docs/superpowers/specs/2026-09-07-feature-phase-decisions-integrity-design.md` (Phase 1 section)

## Global Constraints

- Label the new stat card **"last shipped"** or **"last commit"** — never "currently coding" or any real-time framing. GitHub's own docs disclaim real-time accuracy even for their purpose-built Events API; this data point is simpler (plain repo metadata) but still not live.
- `Content-Signal` value must be exactly `search=yes, ai-input=yes, ai-train=no` — `ai-input=yes` is deliberate (protects the MCP/llms.txt investment's purpose of being cited/grounded-against); do not default to leaving `ai-input` unset, which is the common (wrong-for-this-site) public example.
- The AI Usage Policy paragraph must be hedged, not overclaiming: state it as a preference under Cloudflare's convention, not as something that technically blocks AI training (no crawler/LLM is confirmed to act on this directive as of the underlying research).
- No new npm dependencies for any task in this phase.
- Every new/modified test file must run under the correct Vitest project: filenames ending in `.dom.test.tsx`/`.dom.test.ts` run under the `dom` (happy-dom) project; everything else runs under `node`. Get this wrong and the test silently never runs in CI.

---

## Task 1: Last-shipped stat card

**Files:**
- Modify: `src/components/github-stats-strip.tsx`
- Test: `src/components/github-stats-strip.dom.test.tsx` (new file — no test currently exists for this component)

**Interfaces:**
- Consumes: `GET /api/github/stats` response shape, already includes `mostRecentPush: string | null` (verified in `src/app/api/github/stats/route.ts:57-67` — no backend change needed). Consumes `pushedAgo(iso: string): string` from `@/lib/github` (verified signature at `src/lib/github.ts:141`).
- Produces: no new exports — this is a leaf UI component with no other consumers.

Current relevant code (verified by reading the file in full):

```tsx
type GitHubStats = {
  followers: number;
  publicRepos: number;
  totalStars: number;
  totalForks: number;
};
```

```tsx
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
  <StatCard icon={<Users size={16} />} value={stats!.followers.toLocaleString()} label="GitHub followers" />
  <StatCard icon={<BookOpen size={16} />} value={stats!.publicRepos.toLocaleString()} label="public repos" />
  <StatCard icon={<Star size={16} />} value={stats!.totalStars > 0 ? stats!.totalStars.toLocaleString() : "—"} label="stars earned" />
  <StatCard icon={<GitFork size={16} />} value={stats!.totalForks > 0 ? stats!.totalForks.toLocaleString() : "—"} label="forks" />
</div>
```

**Design decision (documented, not left implicit):** the grid stays `grid-cols-2 sm:grid-cols-4` unchanged — when the 5th card renders it simply wraps to its own row via normal CSS grid flow. No conditional column-count logic. This is intentionally the simplest correct choice (YAGNI); if the wrapped single-card row looks visually unbalanced once shipped, that's a cosmetic follow-up, not a blocker for this task.

**Null handling:** when `mostRecentPush` is `null` (can happen if the aggregation in `route.ts` finds zero repos, though the "empty" `fetchState` guard already covers the more common all-zero case), omit the 5th card entirely rather than rendering a placeholder — matches this file's own existing philosophy ("a strip showing 0/0/— is worse than nothing").

- [ ] **Step 1: Write the failing test**

Create `src/components/github-stats-strip.dom.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { GithubStatsStrip } from "./github-stats-strip";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GithubStatsStrip — last-shipped stat card", () => {
  it("renders a 'last shipped' card using the API's mostRecentPush field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          followers: 12,
          publicRepos: 11,
          totalStars: 40,
          totalForks: 5,
          mostRecentPush: "2026-09-05T10:00:00Z",
        }),
      })),
    );

    render(<GithubStatsStrip />);

    await waitFor(() => {
      expect(screen.getByText(/last shipped/i)).toBeTruthy();
    });
  });

  it("omits the last-shipped card when mostRecentPush is null, without hiding the rest of the strip", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          followers: 12,
          publicRepos: 11,
          totalStars: 40,
          totalForks: 5,
          mostRecentPush: null,
        }),
      })),
    );

    render(<GithubStatsStrip />);

    await waitFor(() => {
      expect(screen.getByText("public repos")).toBeTruthy();
    });
    expect(screen.queryByText(/last shipped/i)).toBeNull();
  });

  it("never renders 'currently coding' or any real-time framing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          followers: 12,
          publicRepos: 11,
          totalStars: 40,
          totalForks: 5,
          mostRecentPush: "2026-09-05T10:00:00Z",
        }),
      })),
    );

    render(<GithubStatsStrip />);

    await waitFor(() => {
      expect(screen.getByText(/last shipped/i)).toBeTruthy();
    });
    expect(screen.queryByText(/currently coding/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/github-stats-strip.dom.test.tsx`
Expected: FAIL — `mostRecentPush`/`"last shipped"` text not found, because the component doesn't read or render that field yet.

- [ ] **Step 3: Write minimal implementation**

In `src/components/github-stats-strip.tsx`:

1. Add `GitCommit` to the existing `lucide-react` import:

```tsx
import { Star, GitFork, Users, BookOpen, GitCommit } from "lucide-react";
```

2. Extend the type:

```tsx
type GitHubStats = {
  followers: number;
  publicRepos: number;
  totalStars: number;
  totalForks: number;
  mostRecentPush: string | null;
};
```

3. Import `pushedAgo`:

```tsx
import { pushedAgo } from "@/lib/github";
```

4. Add the 5th card, conditionally, right after the existing 4 inside the grid `div`:

```tsx
<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
  <StatCard icon={<Users size={16} />} value={stats!.followers.toLocaleString()} label="GitHub followers" />
  <StatCard icon={<BookOpen size={16} />} value={stats!.publicRepos.toLocaleString()} label="public repos" />
  <StatCard icon={<Star size={16} />} value={stats!.totalStars > 0 ? stats!.totalStars.toLocaleString() : "—"} label="stars earned" />
  <StatCard icon={<GitFork size={16} />} value={stats!.totalForks > 0 ? stats!.totalForks.toLocaleString() : "—"} label="forks" />
  {stats!.mostRecentPush && (
    <StatCard icon={<GitCommit size={16} />} value={pushedAgo(stats!.mostRecentPush)} label="last shipped" />
  )}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/github-stats-strip.dom.test.tsx`
Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/github-stats-strip.tsx src/components/github-stats-strip.dom.test.tsx
git commit -m "feat(home): surface last-shipped GitHub activity stat

mostRecentPush was already computed and returned by /api/github/stats
but never rendered anywhere. Adds a 5th StatCard reusing the existing
pushedAgo() formatter. Labeled 'last shipped', never 'currently coding' —
nothing in this pipeline is real-time."
```

---

## Task 2: AI Usage Signal in robots.txt

**Files:**
- Modify: `src/app/robots.ts`
- Test: `src/app/robots.test.ts` (new file)

**Interfaces:**
- Consumes: `MetadataRoute.Robots` type from `next` (verified: `RobotsRuleBase.other?: Record<string, string | number | Array<string | number>> | undefined` at `node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts:547-567` — a plain string value is valid).
- Produces: no exports consumed elsewhere; `robots()` is a Next.js file-convention default export invoked by the framework.

Current file (verified in full, this is the entire file):

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://anvilry.vercel.app/sitemap.xml",
  };
}
```

- [ ] **Step 1: Write the failing test**

Create `src/app/robots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots — AI usage signal", () => {
  it("declares the Content-Signal directive with the exact intended values", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.other?.["Content-Signal"]).toBe(
      "search=yes, ai-input=yes, ai-train=no",
    );
  });

  it("still allows all crawlers on all paths (unchanged base rule)", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.allow).toBe("/");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/robots.test.ts`
Expected: FAIL — `rules?.other` is `undefined`, so the first assertion fails.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Cloudflare Content Signals Policy (CC0 convention) — a stated preference,
      // not a technical block. No crawler/LLM is confirmed to act on this directive
      // as of this writing; it makes this repo's existing LICENSE content-exclusion
      // clause machine-visible at the one place a crawler actually looks.
      // ai-input=yes is deliberate: it protects the MCP server + llms.txt/llms-full.txt
      // investment's entire purpose (being cited/grounded-against by an AI agent).
      other: { "Content-Signal": "search=yes, ai-input=yes, ai-train=no" },
    },
    sitemap: "https://anvilry.vercel.app/sitemap.xml",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/robots.test.ts`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/robots.ts src/app/robots.test.ts
git commit -m "feat(seo): add AI usage Content-Signal directive to robots.txt

Adds Cloudflare's Content Signals convention (search=yes, ai-input=yes,
ai-train=no) — makes the existing LICENSE content-exclusion clause
machine-visible for the first time, without undermining the MCP/llms.txt
investment (ai-input stays yes). Framed as a stated preference, not
enforcement — no crawler/LLM is confirmed to act on this directive yet."
```

---

## Task 3: AI Usage Policy paragraph in llms.txt

**Files:**
- Modify: `src/lib/llms-txt.ts`
- Modify: `src/lib/llms-txt.test.ts`

**Interfaces:**
- Consumes: nothing new — this task only adds a static template section inside the existing `buildLlmsTxt()` function.
- Produces: `buildLlmsTxt(): string` return value gains one new section; signature unchanged. `src/app/llms.txt/route.ts` (unmodified) continues to call this function as-is.

Current relevant code (verified in full — the return statement's tail end):

```ts
  return `# ${profile.name}

...

## Links
- Portfolio: ${BASE}/
- GitHub: ${profile.links.github}
- LinkedIn: ${profile.links.linkedin}
- Résumé: ${BASE}/resume
- Structured résumé (JSON): ${BASE}/api/resume.json
- MCP server (for AI agents): ${BASE}/api/mcp/mcp
- RSS feed: ${BASE}/feed.xml

## Markdown Versions
Every content page is available as clean markdown by appending .md to the URL.
${allWork.map((w) => `- ${BASE}${w.url}.md`).join("\n")}
...
`;
```

Existing test file pattern (verified in full — `src/lib/llms-txt.test.ts`), to mirror exactly:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildLlmsTxt } from "./llms-txt";

describe("buildLlmsTxt — advertised MCP endpoint", () => {
  const txt = buildLlmsTxt();
  // ...existing tests using txt.split("\n").find(...) and txt.toContain(...)
});
```

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `src/lib/llms-txt.test.ts` (append after the existing one, do not modify the existing tests):

```ts
describe("buildLlmsTxt — AI Usage Policy", () => {
  const txt = buildLlmsTxt();

  it("includes an AI Usage Policy section", () => {
    expect(txt).toContain("## AI Usage Policy");
  });

  it("frames the policy as a stated preference, not an enforced block", () => {
    const section = txt.split("## AI Usage Policy")[1] ?? "";
    // Must not claim this technically blocks or prevents AI training —
    // only that it's a stated preference under an existing convention.
    expect(section.toLowerCase()).not.toMatch(/blocks? (ai )?training/);
    expect(section.toLowerCase()).toMatch(/preference|signal/);
  });

  it("references the existing LICENSE content-exclusion terms", () => {
    const section = txt.split("## AI Usage Policy")[1] ?? "";
    expect(section.toLowerCase()).toContain("license");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/llms-txt.test.ts`
Expected: the 3 new tests FAIL (`## AI Usage Policy` not found in `txt`); the pre-existing tests in the file still PASS.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/llms-txt.ts`, insert a new section between `## Links` and `## Markdown Versions` in the returned template literal:

```ts
## Links
- Portfolio: ${BASE}/
- GitHub: ${profile.links.github}
- LinkedIn: ${profile.links.linkedin}
- Résumé: ${BASE}/resume
- Structured résumé (JSON): ${BASE}/api/resume.json
- MCP server (for AI agents): ${BASE}/api/mcp/mcp
- RSS feed: ${BASE}/feed.xml

## AI Usage Policy
This site publishes a Content-Signal preference in robots.txt (search=yes,
ai-input=yes, ai-train=no) — a stated preference under Cloudflare's Content
Signals convention, not a technical enforcement mechanism. AI assistants and
agents are welcome to read and cite this content when answering questions
about ${profile.name} (that is the whole point of this file and the MCP
server above). Bulk absorption into model training data is not authorized,
consistent with the content-exclusion terms already in this repository's
LICENSE file.

## Markdown Versions
Every content page is available as clean markdown by appending .md to the URL.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/llms-txt.test.ts`
Expected: all tests (new and pre-existing) PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/llms-txt.ts src/lib/llms-txt.test.ts
git commit -m "feat(seo): add AI Usage Policy section to llms.txt

Companion to the robots.txt Content-Signal directive — states the same
preference in human-and-agent-readable prose, in the one file specifically
built for AI agents to read. Hedged tone: a stated preference, not a claim
that this technically blocks anything."
```

---

## Task 4: Ship Phase 1

**Files:** none (git/CI operations only)

- [ ] **Step 1: Create the branch**

```bash
git fetch origin
git checkout -B feat/phase-1-last-shipped-and-ai-usage-signals origin/develop
```

(If Tasks 1–3 were already committed on a different local branch, cherry-pick or rebase those 3 commits onto this branch instead of re-doing the work.)

- [ ] **Step 2: Full local verification**

```bash
npx tsc --noEmit
pnpm lint
pnpm test
```

Expected: `tsc` clean; `lint` clean; `pnpm test` shows all new tests passing, and the same pre-existing baseline failures as always (`site-footer.dom.test.tsx`, `voice-pitfalls.dom.test.ts` — a documented, unrelated Node-version-vs-happy-dom-localStorage issue in this environment) and no other new failures.

- [ ] **Step 3: Full build + bundle budget**

```bash
npx velite --clean
npx next build
node scripts/bundle-budget.mjs
npx pagefind --site .next/server/app --output-path public/pagefind
```

Expected: build succeeds; bundle-budget reports `OK`; pagefind indexes without error.

- [ ] **Step 4: Full e2e on both browsers**

```bash
npx playwright test --project=chromium
npx playwright test --project=mobile-safari
```

Expected: both green. If any test fails, check first whether it's the known `ask-portfolio.dom.test.tsx`-style flake pattern (unrelated, timing-based) before assuming a regression from this phase's changes.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin feat/phase-1-last-shipped-and-ai-usage-signals
gh pr create --base develop \
  --title "feat: last-shipped stat + AI usage signals in robots.txt" \
  --body "Phase 1 of docs/superpowers/specs/2026-09-07-feature-phase-decisions-integrity-design.md — surfaces the already-computed mostRecentPush GitHub stat, and adds a Cloudflare Content-Signal directive + matching llms.txt policy paragraph. See spec for full rationale."
```

- [ ] **Step 6: Watch CI**

```bash
gh pr checks <pr-number> --watch
```

If the `E2E (Playwright)` job fails specifically on `src/components/ask-portfolio.dom.test.tsx` with a "Hello from the corpus" assertion — this is a known, pre-existing flake unrelated to this phase's changes. Re-run it:

```bash
gh run rerun <failed-run-id> --failed
```

Then re-watch. Any other failure should be treated as real and investigated before merging.

- [ ] **Step 7: Merge**

```bash
gh pr merge <pr-number> --merge
```

Do **not** promote to `main` as part of this task — that is a separate, explicitly human-gated action taken after all 3 phases have shipped to `develop`, not part of any individual phase.

---

## Self-Review

**Spec coverage**: both Phase 1 spec items have a task each (Task 1 = last-shipped stat, Tasks 2–3 = AI Usage Signals split across the two files the spec names). The spec's exact required values (`Content-Signal` string, "last shipped" labeling, hedged tone) are all reproduced verbatim in the relevant tasks' code and test assertions.

**Placeholder scan**: no `TBD`/`TODO`/"add appropriate X" phrasing anywhere in the task steps; every code block is complete, real code grounded in the files actually read for this plan.

**Type/signature consistency**: `GitHubStats.mostRecentPush: string | null` (Task 1) matches the real `route.ts` response shape read during planning. `pushedAgo(iso: string): string` is called only when `stats!.mostRecentPush` has already been checked truthy (narrowed to `string`), so no type error. `RobotsRuleBase.other` (Task 2) uses the exact verified type shape (`Record<string, string | ...>`). No cross-task naming drift — each task is independent (no shared new function/type between them).
