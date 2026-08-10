# Visitor Counter Redis Fallback — localStorage Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Upstash Redis is unavailable (quota exhausted, network error, env vars missing), the visitor badge shows the last-known count from `localStorage` instead of 0, so the counter stays meaningful across outages.

**Architecture:** Two changes only. (1) `VisitorBadge` in `site-footer.tsx` reads `localStorage["anvilry:visits:total"]` as its initial state, writes it on every successful API response, and treats `total === 0` from the API as "Redis was unavailable — use cached value." (2) `POST /api/visit` already returns `{ total: 0, today: 0 }` on Redis failure — the client distinguishes "real zero" (no prior cached value) from "failure zero" (cached value exists) by checking localStorage before trusting the API's 0. No new files. No new deps. No server changes required.

**Tech Stack:** TypeScript, React 19, `localStorage` Web API, Vitest + happy-dom + `@testing-library/react`.

## Global Constraints

- No new npm dependencies — use only what is already in `package.json`
- No changes to `src/app/api/visit/route.ts` (server already handles errors correctly)
- No changes to `src/lib/redis.ts`
- `localStorage` key: `"anvilry:visits:total"` (string, stores the number as a string)
- Working directory: `/Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev`
- Branch: `feat/add-tombstone-trelix-inkforge` (already checked out)
- Conventional commits, no `Co-Authored-By` trailer
- DOM tests must be named `*.dom.test.tsx` (happy-dom environment, per `vitest.config.ts`)
- Test helpers use `vi.stubGlobal` and `vi.unstubAllGlobals()` in `afterEach` (existing pattern)
- `pnpm test` must pass before committing

---

### Task 1: localStorage-cached VisitorBadge + DOM test

This is the entire client-side change. Two things happen in one task because they are tightly coupled: the test drives the implementation (TDD), and the test file must be reviewed against the implementation together.

**Files:**
- Modify: `src/components/site-footer.tsx` — `VisitorBadge` function only (lines 17–37)
- Create: `src/components/site-footer.dom.test.tsx`

**Interfaces:**
- Consumes: `POST /api/visit` → `{ total: number, today: number }` (unchanged)
- Produces: `VisitorBadge` reads/writes `localStorage["anvilry:visits:total"]`

---

- [ ] **Step 1: Write the failing test file**

Create `src/components/site-footer.dom.test.tsx` with this exact content:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { SiteFooter } from "./site-footer";

// SiteFooter reads NEXT_PUBLIC_VISITOR_COUNTER at module load — stub it ON
vi.stubEnv("NEXT_PUBLIC_VISITOR_COUNTER", "true");

// SiteFooter uses useView() from view-context — stub the router dep
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

// useView needs the store to be initialised — mock it to return "classic"
vi.mock("@/components/view-context", () => ({
  useView: () => ({ view: "classic" }),
  ViewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("VisitorBadge localStorage cache", () => {
  it("shows count from API on successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ total: 42, today: 1 }) })),
    );

    render(<SiteFooter />);

    await waitFor(() => {
      expect(screen.getByText(/42/)).toBeTruthy();
    });
  });

  it("writes successful count to localStorage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ total: 99, today: 2 }) })),
    );

    render(<SiteFooter />);

    await waitFor(() => {
      expect(localStorage.getItem("anvilry:visits:total")).toBe("99");
    });
  });

  it("shows cached count when API returns 0 (Redis unavailable)", async () => {
    // Pre-seed the cache with a previously stored count
    localStorage.setItem("anvilry:visits:total", "1500");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ total: 0, today: 0 }) })),
    );

    render(<SiteFooter />);

    await waitFor(() => {
      expect(screen.getByText(/1[,.]?500/)).toBeTruthy();
    });
  });

  it("shows nothing (skeleton then no count) when API returns 0 and no cache exists", async () => {
    // No localStorage entry — fresh browser, Redis down
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ total: 0, today: 0 }) })),
    );

    render(<SiteFooter />);

    // Wait for fetch to complete — badge should not render a number
    await waitFor(() => {
      expect(screen.queryByText(/engineers visited/)).toBeNull();
    });
  });

  it("shows cached count when fetch throws (network error)", async () => {
    localStorage.setItem("anvilry:visits:total", "750");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => { throw new Error("network error"); }),
    );

    render(<SiteFooter />);

    await waitFor(() => {
      expect(screen.getByText(/750/)).toBeTruthy();
    });
  });

  it("does not overwrite cache with 0 when Redis is unavailable", async () => {
    localStorage.setItem("anvilry:visits:total", "300");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ total: 0, today: 0 }) })),
    );

    render(<SiteFooter />);

    await waitFor(() => {
      // Cache should still hold 300, not be overwritten with 0
      expect(localStorage.getItem("anvilry:visits:total")).toBe("300");
    });
  });
});
```

- [ ] **Step 2: Run the tests — confirm they fail**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
npx vitest run src/components/site-footer.dom.test.tsx --reporter=verbose
```

Expected: 6 tests FAIL (the `VisitorBadge` does not yet read/write `localStorage`).

- [ ] **Step 3: Implement the localStorage cache in `VisitorBadge`**

Open `src/components/site-footer.tsx`. Replace the entire `VisitorBadge` function (lines 17–37) with:

```tsx
const VISIT_CACHE_KEY = "anvilry:visits:total";

function VisitorBadge() {
  // Seed from localStorage so the badge shows instantly on repeat visits,
  // and so it shows the last-known count when Redis is unavailable (total=0).
  const [total, setTotal] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem(VISIT_CACHE_KEY);
      return cached !== null ? Number(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    fetch("/api/visit", { method: "POST" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { total: number; today: number } | null) => {
        if (data?.total != null && data.total > 0) {
          setTotal(data.total);
          try {
            localStorage.setItem(VISIT_CACHE_KEY, String(data.total));
          } catch {
            // localStorage blocked (private browsing / storage full) — ignore
          }
        }
        // If total === 0: Redis was unavailable. Keep the cached value (don't call setTotal).
      })
      .catch(() => {
        // Network error — cached value (already in state) stays visible
      });
  }, []);

  if (total === null) {
    return (
      <span className="inline-block h-3 w-28 animate-pulse rounded bg-fg-subtle/20" aria-hidden="true" />
    );
  }
  if (total === 0) return null; // No cache, no real count — hide the badge entirely

  return (
    <span className="font-mono text-xs text-fg-subtle">
      ↑ {total.toLocaleString()} engineers visited
    </span>
  );
}
```

- [ ] **Step 4: Run the tests — confirm all 6 pass**

```bash
npx vitest run src/components/site-footer.dom.test.tsx --reporter=verbose
```

Expected output:
```
✓ VisitorBadge localStorage cache > shows count from API on successful response
✓ VisitorBadge localStorage cache > writes successful count to localStorage
✓ VisitorBadge localStorage cache > shows cached count when API returns 0 (Redis unavailable)
✓ VisitorBadge localStorage cache > shows nothing when API returns 0 and no cache exists
✓ VisitorBadge localStorage cache > shows cached count when fetch throws (network error)
✓ VisitorBadge localStorage cache > does not overwrite cache with 0 when Redis is unavailable

Test Files  1 passed (1)
     Tests  6 passed (6)
```

If any test fails, read the failure message — the most common cause is the `total === 0` branch: ensure `setTotal` is NOT called when `data.total === 0`.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
pnpm test
```

Expected: all tests pass (the existing test count + 6 new ones).

- [ ] **Step 6: Commit**

```bash
git add src/components/site-footer.tsx src/components/site-footer.dom.test.tsx
git commit -m "feat(visit): cache last-known visitor count in localStorage as Redis fallback"
```

---

### Task 2: Update configuration docs

The `docs/configuration.md` entry for `NEXT_PUBLIC_VISITOR_COUNTER` should document the new fallback behaviour so future engineers understand the degradation path.

**Files:**
- Modify: `docs/configuration.md` — the `NEXT_PUBLIC_VISITOR_COUNTER` row in the Beast-Mode Feature Flags table

**Interfaces:**
- Consumes: nothing from Task 1 (documentation only)
- Produces: updated docs entry

---

- [ ] **Step 1: Find the existing row**

```bash
grep -n "VISITOR_COUNTER" /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/docs/configuration.md
```

Expected: one matching line in the Beast-Mode Feature Flags table.

- [ ] **Step 2: Update the description in `docs/configuration.md`**

Find the row:
```markdown
| `NEXT_PUBLIC_VISITOR_COUNTER` | `false` | v2.0 | Shows an `"↑ N engineers visited"` badge in the site footer. Increments a Redis counter (`anvilry:visits:total`) on each page load, rate-limited to 1 increment per IP per 30 min via `@upstash/ratelimit`. Requires Upstash Redis. |
```

Replace with:
```markdown
| `NEXT_PUBLIC_VISITOR_COUNTER` | `false` | v2.0 | Shows an `"↑ N engineers visited"` badge in the site footer. Increments a Redis counter (`anvilry:visits:total`) on each page load, rate-limited to 1 increment per IP per 30 min via `@upstash/ratelimit`. Requires Upstash Redis. **Fallback:** when Redis is unavailable (quota exhausted, network error), the badge shows the last-known count from `localStorage["anvilry:visits:total"]`. If no cached value exists, the badge hides. |
```

- [ ] **Step 3: Run the full test suite to confirm docs change doesn't break anything**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add docs/configuration.md
git commit -m "docs(visit): document localStorage fallback behaviour for visitor counter"
```

---

## File Map Summary

| File | Task | Action |
|------|------|--------|
| `src/components/site-footer.tsx` | T1 | Modify — `VisitorBadge` reads/writes `localStorage` |
| `src/components/site-footer.dom.test.tsx` | T1 | Create — 6 happy-dom tests |
| `docs/configuration.md` | T2 | Modify — update `NEXT_PUBLIC_VISITOR_COUNTER` description |

**Total: 1 new file, 2 modified files, 2 commits**

## End-to-End Manual Verification

After both tasks complete:

```bash
# 1. Start dev server
pnpm dev

# 2. Open localhost:3000 in browser with DevTools → Application → Local Storage
# 3. Clear localStorage, disable network (DevTools → Network → Offline)
# 4. Reload — badge should be hidden (no cache, Redis unreachable)
# 5. Re-enable network, reload — badge shows real count, localStorage["anvilry:visits:total"] is set
# 6. Disable network again, reload — badge now shows cached count instead of hiding
```
