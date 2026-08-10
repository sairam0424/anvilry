# Resume Page: Single Master Default + PDF/Web Toggle + Variants Feature Flag

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 5-variant card grid on `/resume` with a single "Sairam Resume" master PDF as the default, a PDF/Web toggle, and a `NEXT_PUBLIC_RESUME_VARIANTS` feature flag that controls whether the 4 role-targeted variants (Backend, Full-Stack, Frontend, GenAI) are shown anywhere on the site.

**Architecture:** Rename `resumeVariants[0].label` → `"Sairam Resume"` in `profile.ts` (single source of truth — cascades everywhere). Add `NEXT_PUBLIC_RESUME_VARIANTS` build-time flag (default OFF = only master visible). Extract a private `ResumeContent` component from `ResumeView` so both the `?view=resume` full-page view and the new `ResumeViewInline` (used inside `/resume`) share identical markup; `ResumeContent` reads the flag inside its function body (module-scope const would break `vi.stubEnv`). Refactor `src/app/resume/page.tsx` to a two-state (`"pdf" | "web"`) toggle; the `<details>` variant disclosure is entirely absent from the DOM when the flag is off.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Framer Motion (`motion/react`), Lucide icons. No new npm dependencies.

## Global Constraints

- Branch from `develop` — PR must target `develop`, never `main`.
- No `Co-Authored-By` trailer in commit messages (CLAUDE.md rule).
- No new npm dependencies — use existing `motion/react`, `lucide-react`, Tailwind, existing UI primitives (`Section`, `SkeletonIframe`, `cn`).
- Keep files under 500 lines.
- `pnpm build` must stay green after every task (includes `game-model.test.ts` bijection gate and all Vitest suites).
- **`NEXT_PUBLIC_*` constants MUST be read inside function/component bodies, NOT at module scope.** Module-scope `const flag = process.env.NEXT_PUBLIC_X` is evaluated at import time, making `vi.stubEnv` in tests ineffective. Always write `const showVariants = process.env.NEXT_PUBLIC_RESUME_VARIANTS === "true";` inside the component.
- No fabrication of profile data — all content derives from `profile.ts` + Velite output only.
- DOM tests must be named `*.dom.test.tsx`; Vitest node tests must be `*.test.ts`.
- **New flag**: `NEXT_PUBLIC_RESUME_VARIANTS` — `"true"` = show all 4 role-targeted variants. Unset or any other value = show only master. Default is OFF. Redeploy required to change (build-time inlining).

---

## File Map

| File | Action | Why |
|---|---|---|
| `src/lib/profile.ts` | Modify line 77 | Rename `"Master (All-purpose)"` → `"Sairam Resume"` |
| `src/components/home/resume-view.tsx` | Modify | Extract `ResumeContent` private fn (flag-aware PDF section); add `ResumeViewInline` export |
| `src/app/resume/page.tsx` | Modify | Full refactor — single master PDF + PDF/Web toggle + flag-gated variant disclosure |
| `docs/configuration.md` | Modify | Document `NEXT_PUBLIC_RESUME_VARIANTS` flag |
| `e2e/resume.spec.ts` | Create | Playwright E2E: default PDF state, Web tab toggle, variant flag-off state |

---

## Task 1: Rename master label + extract `ResumeContent` with flag-aware PDF section

**Files:**
- Modify: `src/lib/profile.ts:77`
- Modify: `src/components/home/resume-view.tsx`

**Interfaces:**
- Produces: `export function ResumeViewInline()` — identical inner content as `ResumeView`, wrapped in `<div>` not `<main>`. Used by Task 2.
- `ResumeView` export remains unchanged — still consumed by `view-router.tsx` for the `?view=resume` route.
- `ResumeContent` is private (not exported). It reads `NEXT_PUBLIC_RESUME_VARIANTS` inside its body.

---

- [ ] **Step 1: Rename the master variant label in `src/lib/profile.ts`**

Open `src/lib/profile.ts`. Change only line 77 (the first entry in `resumeVariants`):

```typescript
// BEFORE (line 77):
{ label: "Master (All-purpose)", file: "/resume/Sairam_Resume_MX_E.pdf", tag: "Backend & GenAI" },

// AFTER (line 77):
{ label: "Sairam Resume", file: "/resume/Sairam_Resume_MX_E.pdf", tag: "Backend & GenAI" },
```

Full array after change (no other lines touched):

```typescript
export const resumeVariants = [
  { label: "Sairam Resume",  file: "/resume/Sairam_Resume_MX_E.pdf",  tag: "Backend & GenAI"    },
  { label: "Backend",        file: "/resume/Sairam_Resume_MX_BE.pdf", tag: "Distributed Systems" },
  { label: "Full-Stack",     file: "/resume/Sairam_Resume_MX_FS.pdf", tag: "GenAI Platforms"     },
  { label: "Frontend",       file: "/resume/Sairam_Resume_MX_FE.pdf", tag: "GenAI Platforms"     },
  { label: "GenAI",          file: "/resume/Sairam_Resume_MX_GAI.pdf",tag: "LLM Systems"         },
];
```

- [ ] **Step 2: Replace `src/components/home/resume-view.tsx` entirely**

The critical change: `ResumeContent` reads `NEXT_PUBLIC_RESUME_VARIANTS` **inside its function body** (not module scope). The PDF Downloads section shows only the master when the flag is OFF; shows all 5 when ON.

```tsx
"use client";

/**
 * ResumeView — the sixth portfolio view (?view=resume).
 *
 * A single-column, animation-free, print-optimized layout for recruiters who
 * need to speed-scan. No Three.js, no Framer Motion, no interactive terminal.
 * All content derives from profile.ts — zero fabrication, honest contribution
 * register preserved.
 *
 * Activated via Cmd+K → "Recruiter View" or ?view=resume in the URL. The
 * ViewEscapeHatch component (auto-rendered by view-router for non-classic views)
 * provides the "back to classic" affordance at the top of the page.
 *
 * @media print: nav/footer hidden, colors forced to black-on-white via Tailwind's
 * print: variants, making Cmd+P produce a clean PDF without any extra tooling.
 *
 * ResumeViewInline — same inner markup, wrapped in <div> instead of <main>.
 * Used by src/app/resume/page.tsx to avoid nesting two <main> landmarks.
 *
 * Feature flag NEXT_PUBLIC_RESUME_VARIANTS:
 *   "true"  → show all 4 role-targeted PDF download pills
 *   unset   → show only the master "Sairam Resume" pill (default)
 * Read inside function body (not module scope) so vi.stubEnv works in tests.
 */

import Link from "next/link";
import { allWork, allProjects } from "@/lib/content";
import { profile, skills, achievements, resumeVariants, impactMetrics } from "@/lib/profile";

const WRAPPER_CLASS =
  "bg-bg-base px-4 py-10 text-fg print:bg-white print:text-black sm:px-8";

function ResumeContent() {
  // Read flag inside function body — module-scope const breaks vi.stubEnv in tests.
  const showVariants = process.env.NEXT_PUBLIC_RESUME_VARIANTS === "true";
  const visibleDownloads = showVariants ? resumeVariants : [resumeVariants[0]];

  return (
    <div className="mx-auto max-w-3xl">

      {/* ── Identity ──────────────────────────────────────────────────────── */}
      <header className="mb-8 border-b border-border pb-6 print:border-gray-300">
        <h1 className="text-2xl font-semibold tracking-tight print:text-black">
          {profile.name}
        </h1>
        <p className="mt-1 text-fg-muted print:text-gray-700">
          {profile.role} · {profile.company}
        </p>
        <p className="mt-1 text-sm text-fg-subtle print:text-gray-600">
          {profile.location} ·{" "}
          <a
            href={`mailto:${profile.email}`}
            className="text-accent hover:underline print:text-black"
          >
            {profile.email}
          </a>
          {" "}·{" "}
          <a
            href={profile.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline print:text-black"
          >
            GitHub
          </a>
          {" "}·{" "}
          <a
            href={profile.links.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline print:text-black"
          >
            LinkedIn
          </a>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted print:text-gray-700">
          {profile.headline}
        </p>

        {/* Impact metrics strip */}
        <div className="mt-4 flex flex-wrap gap-4">
          {impactMetrics.map((m) => (
            <div key={m.label} className="text-sm">
              <span className="font-semibold text-accent print:text-black">{m.value}</span>
              {" "}
              <span className="text-fg-muted print:text-gray-600">
                {m.label} ({m.sub})
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* ── Production Work ───────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mono-label mb-4 print:text-black">Production Work</h2>
        <div className="space-y-4">
          {allWork.map((w) => (
            <div
              key={w.slug}
              className="rounded-lg border border-border p-4 print:border-gray-300"
            >
              <div className="flex flex-wrap items-start justify-between gap-1">
                <h3 className="font-medium text-fg print:text-black">{w.name}</h3>
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle print:text-gray-500">
                  {w.register}
                </span>
              </div>
              <p className="mt-1 text-sm text-fg-muted print:text-gray-700">{w.role}</p>
              {w.metrics.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3">
                  {w.metrics.map((met) => (
                    <span
                      key={met.label}
                      className="text-xs text-accent print:text-black"
                    >
                      {met.value} {met.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Open-Source Projects ──────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mono-label mb-4 print:text-black">Open-Source Projects</h2>
        <div className="space-y-3">
          {allProjects.map((p) => (
            <div
              key={p.slug}
              className="rounded-lg border border-border p-3 print:border-gray-300"
            >
              <div className="flex flex-wrap items-start justify-between gap-1">
                <h3 className="font-medium text-fg print:text-black">{p.name}</h3>
                <span className="font-mono text-[10px] text-fg-subtle print:text-gray-500">
                  {p.group}
                </span>
              </div>
              <p className="mt-1 text-xs text-fg-muted print:text-gray-700">{p.tagline}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Skills ────────────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mono-label mb-4 print:text-black">Skills</h2>
        <div className="space-y-2">
          {skills.map((s) => (
            <div key={s.group} className="flex flex-wrap gap-x-2 text-sm">
              <span className="min-w-[11rem] shrink-0 font-medium text-fg print:text-black">
                {s.group}
              </span>
              <span className="text-fg-muted print:text-gray-700">{s.items.join(", ")}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Achievements ──────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mono-label mb-4 print:text-black">Recognition</h2>
        <ul className="space-y-1">
          {achievements.map((a) => (
            <li key={a.title} className="flex flex-wrap gap-x-2 text-sm">
              <span className="font-medium text-fg print:text-black">{a.title}</span>
              <span className="text-fg-subtle print:text-gray-600">— {a.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── PDF Downloads ─────────────────────────────────────────────────── */}
      {/* Flag OFF: only master pill. Flag ON: all 5 pills. */}
      <section className="mb-4 print:hidden">
        <h2 className="mono-label mb-3">Download PDF Résumé</h2>
        <div className="flex flex-wrap gap-2">
          {visibleDownloads.map((r) => (
            <a
              key={r.label}
              href={r.file}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {r.label}
              <span className="ml-1 text-fg-subtle">↗</span>
            </a>
          ))}
        </div>
      </section>

      {/* ── Contact CTA ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border pt-4 print:border-gray-300">
        <p className="text-sm text-fg-muted print:text-gray-600">
          Reach me at{" "}
          <a
            href={`mailto:${profile.email}`}
            className="text-accent hover:underline print:text-black"
          >
            {profile.email}
          </a>
          {" "}or on{" "}
          <Link
            href={profile.links.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline print:text-black"
          >
            LinkedIn
          </Link>
        </p>
      </footer>

    </div>
  );
}

/** Full-page view — used by view-router.tsx for the ?view=resume route. */
export function ResumeView() {
  return (
    <main className={`min-h-screen ${WRAPPER_CLASS}`}>
      <ResumeContent />
    </main>
  );
}

/**
 * Inline variant — same inner content but wrapped in <div> instead of <main>.
 * Use inside src/app/resume/page.tsx to avoid nesting two <main> landmarks.
 */
export function ResumeViewInline() {
  return (
    <div className={WRAPPER_CLASS}>
      <ResumeContent />
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm build
```

Expected: green. No TypeScript errors. `game-model.test.ts` bijection test and all Vitest suites pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
git add src/lib/profile.ts src/components/home/resume-view.tsx
git commit -m "refactor(resume): rename master to 'Sairam Resume', extract ResumeContent, gate variants on NEXT_PUBLIC_RESUME_VARIANTS"
```

---

## Task 2: Refactor `/resume` page — single master default + toggle + flag-gated variant disclosure

**Files:**
- Modify: `src/app/resume/page.tsx`

**Interfaces:**
- Consumes: `ResumeViewInline` from `@/components/home/resume-view` (Task 1)
- Consumes: `resumeVariants` from `@/lib/profile` — `[0]` is the master, `[1..4]` are role variants
- Consumes: `Section`, `SkeletonIframe`, `motion`, `AnimatePresence`, `Download`, `FileText`, `Globe`, `ChevronRight`, `cn` — all already in the codebase
- The `NEXT_PUBLIC_RESUME_VARIANTS` flag is read inside `ResumePage()`, not at module scope

---

- [ ] **Step 1: Replace `src/app/resume/page.tsx` entirely**

```tsx
"use client";

import { useState } from "react";
import { Download, FileText, Globe, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { resumeVariants } from "@/lib/profile";
import { Section } from "@/components/ui/section";
import { SkeletonIframe } from "@/components/ui/skeleton";
import { ResumeViewInline } from "@/components/home/resume-view";
import { cn } from "@/lib/utils";

type ResumeTab = "pdf" | "web";

// resumeVariants[0] is always the master ("Sairam Resume").
// [1..4] are role-targeted — shown only when NEXT_PUBLIC_RESUME_VARIANTS="true".
const master = resumeVariants[0];
const otherVariants = resumeVariants.slice(1);

export default function ResumePage() {
  const [tab, setTab] = useState<ResumeTab>("pdf");
  const [pdfLoading, setPdfLoading] = useState(true);

  // Read flag inside function body — NOT at module scope — so vi.stubEnv works in tests.
  const showVariants = process.env.NEXT_PUBLIC_RESUME_VARIANTS === "true";

  return (
    <main className="flex-1">
      {/* ── Header + PDF/Web toggle ──────────────────────────────────────── */}
      <Section label="// résumé" title="Sairam Resume" titleAs="h1">
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-fg-muted">
            One verified engineering record — view as a formatted web résumé or preview the PDF.
          </p>

          {/* Segmented PDF / Web toggle — matches ViewSwitcher pill pattern */}
          <div
            role="group"
            aria-label="Choose résumé format"
            className="relative inline-flex items-center rounded-full border border-border bg-bg-surface/80 p-0.5 backdrop-blur"
          >
            {(["pdf", "web"] as const).map((t) => {
              const active = tab === t;
              const Icon = t === "pdf" ? FileText : Globe;
              const label = t === "pdf" ? "PDF" : "Web";
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-pressed={active}
                  aria-label={`${label} résumé`}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg-base",
                    active ? "text-bg-base" : "text-fg-muted hover:text-fg",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="resume-tab-pill"
                      aria-hidden="true"
                      className="absolute inset-0 z-0 rounded-full bg-accent"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      {/* ── Tab content — crossfades on switch ──────────────────────────── */}
      <AnimatePresence mode="wait">
        {tab === "pdf" ? (
          <motion.div
            key="pdf"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            {/* ── Master PDF preview ──────────────────────────────────────── */}
            <Section label="// preview" title="">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-mono text-xs text-fg-subtle">
                  Viewing:{" "}
                  <span className="text-accent">{master.label}</span>
                  <span className="ml-2 text-fg-subtle/60">{master.tag}</span>
                </p>
                <a
                  href={master.file}
                  download
                  className="inline-flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-accent"
                >
                  <Download size={13} /> Download PDF
                </a>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-border">
                <AnimatePresence>
                  {pdfLoading && (
                    <motion.div
                      key="pdf-skeleton"
                      className="absolute inset-0 z-10"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <SkeletonIframe />
                    </motion.div>
                  )}
                </AnimatePresence>

                <iframe
                  src={master.file}
                  onLoad={() => setPdfLoading(false)}
                  className={cn(
                    "h-[80vh] w-full transition-opacity duration-300",
                    pdfLoading ? "opacity-0" : "opacity-100",
                  )}
                  title={`${master.label} résumé preview`}
                />
              </div>
            </Section>

            {/* ── Role-targeted variants — only rendered when flag is ON ──── */}
            {showVariants && (
              <Section label="// variants" title="">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <ChevronRight
                      size={14}
                      aria-hidden="true"
                      className="shrink-0 text-fg-subtle transition-transform group-open:rotate-90"
                    />
                    <span>Role-targeted variants</span>
                    <span className="ml-auto font-mono text-[10px] text-fg-subtle">
                      {otherVariants.length} available
                    </span>
                  </summary>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {otherVariants.map((v) => (
                      <div
                        key={v.file}
                        className="card-surface flex items-center justify-between p-4"
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={18} className="shrink-0 text-fg-subtle" aria-hidden="true" />
                          <div>
                            <p className="text-sm font-medium text-fg">{v.label}</p>
                            <p className="text-xs text-fg-subtle">{v.tag}</p>
                          </div>
                        </div>
                        <a
                          href={v.file}
                          download
                          aria-label={`Download ${v.label} résumé`}
                          className="rounded p-1 text-fg-subtle transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    ))}
                  </div>
                </details>
              </Section>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="web"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
          >
            <ResumeViewInline />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
```

**What `showVariants` controls:**
| Flag value | `/resume` page | `?view=resume` web view PDF pills |
|---|---|---|
| unset / `"false"` | No `// variants` section at all | Only "Sairam Resume" pill |
| `"true"` | `// variants` `<details>` block with 4 cards | All 5 pills |

- [ ] **Step 2: Verify build passes**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm build
```

Expected: green. TypeScript, Vitest, Next.js all pass.

- [ ] **Step 3: Visual smoke-test locally (flag OFF — the default)**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm dev
```

Open `http://localhost:3000/resume`. Verify:
- Page heading: "Sairam Resume" (h1)
- "PDF" pill active by default
- Master PDF iframe loads with skeleton fade-out
- No "Role-targeted variants" section anywhere on the page
- Clicking "Web" cross-fades to the inline HTML résumé showing "Sairam Ugge" heading
- Web tab → PDF Downloads section shows ONLY the "Sairam Resume" pill (not 5)
- Clicking "PDF" cross-fades back; iframe reloads

- [ ] **Step 4: Visual smoke-test with flag ON**

Stop dev server. Add the flag to `.env.local`:

```bash
echo "NEXT_PUBLIC_RESUME_VARIANTS=true" >> /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/.env.local
pnpm dev
```

Verify on `http://localhost:3000/resume`:
- "Role-targeted variants" `<details>` is now present and collapsed
- Clicking the summary expands to show 4 cards (Backend, Full-Stack, Frontend, GenAI)
- Web tab → PDF Downloads section now shows all 5 pills

Remove the test line from `.env.local` when done:

```bash
# Remove the line added above so local default matches production default (flag OFF)
grep -v "NEXT_PUBLIC_RESUME_VARIANTS" /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/.env.local > /tmp/env_tmp && mv /tmp/env_tmp /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev/.env.local
```

- [ ] **Step 5: Commit**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
git add src/app/resume/page.tsx
git commit -m "feat(resume): single master PDF default, PDF/Web toggle, flag-gated variant disclosure"
```

---

## Task 3: Document `NEXT_PUBLIC_RESUME_VARIANTS` in configuration docs

**Files:**
- Modify: `docs/configuration.md`

**Interfaces:**
- Consumes: nothing from prior tasks — purely documentation
- The flag name `NEXT_PUBLIC_RESUME_VARIANTS` must match exactly what's used in Tasks 1 and 2

---

- [ ] **Step 1: Read the existing configuration docs**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
cat docs/configuration.md
```

Find the section listing `NEXT_PUBLIC_*` environment variables (the feature flags table). It likely contains rows for `NEXT_PUBLIC_VISITOR_COUNTER`, `NEXT_PUBLIC_ENABLED_VIEWS`, etc.

- [ ] **Step 2: Add the new flag row to the feature flags table**

In `docs/configuration.md`, locate the feature flags table. Add a new row for `NEXT_PUBLIC_RESUME_VARIANTS` following the same format as the `NEXT_PUBLIC_VISITOR_COUNTER` row. Example of what to insert:

```markdown
| `NEXT_PUBLIC_RESUME_VARIANTS` | Show 4 role-targeted PDF variants (Backend / Full-Stack / Frontend / GenAI) on the `/resume` page and in the `?view=resume` PDF downloads section. When unset, only the master "Sairam Resume" PDF is shown. | `"true"` to enable; unset = OFF | Redeploy required |
```

The exact position and column format must match the existing table — read the file first to confirm.

- [ ] **Step 3: Verify the docs file renders cleanly**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm build
```

Expected: green. (The docs file is not tested by the build, but running build confirms no regressions from the prior tasks.)

- [ ] **Step 4: Commit**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
git add docs/configuration.md
git commit -m "docs(resume): document NEXT_PUBLIC_RESUME_VARIANTS feature flag"
```

---

## Task 4: E2E tests for `/resume` page

**Files:**
- Create: `e2e/resume.spec.ts`

**Interfaces:**
- Consumes: nothing from prior tasks beyond the running app
- The existing `e2e/views.spec.ts` tests `/api/resume.json` — this file tests the `/resume` page UI
- E2E tests run against the dev build with `NEXT_PUBLIC_RESUME_VARIANTS` **unset** (flag OFF, the default). The variants tests use `test.skip` with a clear note.

---

- [ ] **Step 1: Check the existing E2E test structure**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
head -20 e2e/views.spec.ts
```

Expected: `import { test, expect } from "@playwright/test"` at the top. The new file follows the same import style.

- [ ] **Step 2: Create `e2e/resume.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

/**
 * /resume page E2E suite.
 *
 * Default state: NEXT_PUBLIC_RESUME_VARIANTS is unset (OFF).
 * Tests that require the flag set to "true" are marked with test.skip
 * and an inline instruction — run them locally after adding the flag.
 */

test.describe("/resume page — flag OFF (default)", () => {
  test("loads with h1 'Sairam Resume' and PDF tab active", async ({ page }) => {
    await page.goto("/resume");

    await expect(page.getByRole("heading", { name: "Sairam Resume", level: 1 })).toBeVisible();

    // PDF button is the active tab
    const pdfButton = page.getByRole("button", { name: "PDF résumé" });
    await expect(pdfButton).toBeVisible();
    await expect(pdfButton).toHaveAttribute("aria-pressed", "true");

    // Web button is inactive
    await expect(page.getByRole("button", { name: "Web résumé" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Master PDF iframe is present
    await expect(
      page.locator('iframe[title="Sairam Resume résumé preview"]'),
    ).toBeAttached();
  });

  test("variants section is absent from DOM when flag is OFF", async ({ page }) => {
    await page.goto("/resume");

    // The entire Section "// variants" must not be rendered
    await expect(page.locator("details")).not.toBeAttached();
    await expect(page.getByText("Role-targeted variants")).not.toBeVisible();
  });

  test("switches to Web view and shows inline HTML résumé", async ({ page }) => {
    await page.goto("/resume");

    await page.getByRole("button", { name: "Web résumé" }).click();

    // Web button becomes active
    await expect(page.getByRole("button", { name: "Web résumé" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Inline HTML résumé shows the owner's real name
    await expect(page.getByRole("heading", { name: "Sairam Ugge" })).toBeVisible();

    // iframe is removed from DOM (AnimatePresence unmounts the PDF tab tree)
    await expect(page.locator("iframe")).not.toBeAttached();
  });

  test("Web view PDF downloads section shows only master pill (flag OFF)", async ({ page }) => {
    await page.goto("/resume");

    await page.getByRole("button", { name: "Web résumé" }).click();
    await expect(page.getByRole("heading", { name: "Sairam Ugge" })).toBeVisible();

    // Only the master pill link is present
    await expect(page.getByRole("link", { name: /Sairam Resume/ })).toBeVisible();

    // Role-targeted variant pills are NOT present
    await expect(page.getByRole("link", { name: /Backend/ })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /Full-Stack/ })).not.toBeVisible();
  });

  test("returns to PDF view when PDF tab is re-clicked", async ({ page }) => {
    await page.goto("/resume");

    await page.getByRole("button", { name: "Web résumé" }).click();
    await expect(page.getByRole("heading", { name: "Sairam Ugge" })).toBeVisible();

    await page.getByRole("button", { name: "PDF résumé" }).click();

    await expect(page.getByRole("button", { name: "PDF résumé" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.locator('iframe[title="Sairam Resume résumé preview"]'),
    ).toBeAttached();
  });
});

test.describe("/resume page — flag ON (NEXT_PUBLIC_RESUME_VARIANTS=true)", () => {
  // These tests require the app to be running with NEXT_PUBLIC_RESUME_VARIANTS=true.
  // To run locally:
  //   echo "NEXT_PUBLIC_RESUME_VARIANTS=true" >> .env.local && pnpm dev
  //   pnpm e2e --grep "flag ON"
  // They are skipped in CI where the flag is unset.

  test.skip(
    process.env.NEXT_PUBLIC_RESUME_VARIANTS !== "true",
    "Requires NEXT_PUBLIC_RESUME_VARIANTS=true — see comment above",
  );

  test("variants section is present and collapsed by default", async ({ page }) => {
    await page.goto("/resume");

    const details = page.locator("details");
    await expect(details).toBeAttached();
    await expect(details).not.toHaveAttribute("open");
    await expect(page.getByText("Role-targeted variants")).toBeVisible();
  });

  test("expanding variants disclosure shows 4 role-targeted cards", async ({ page }) => {
    await page.goto("/resume");

    await page.locator("summary").click();

    await expect(page.getByRole("link", { name: "Download Backend résumé" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Full-Stack résumé" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Frontend résumé" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download GenAI résumé" })).toBeVisible();
  });

  test("Web view PDF downloads shows all 5 pills when flag is ON", async ({ page }) => {
    await page.goto("/resume");

    await page.getByRole("button", { name: "Web résumé" }).click();
    await expect(page.getByRole("heading", { name: "Sairam Ugge" })).toBeVisible();

    await expect(page.getByRole("link", { name: /Sairam Resume/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Backend/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Full-Stack/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Frontend/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /GenAI/ })).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the E2E tests (flag OFF — default CI state)**

Make sure the dev server is running (`pnpm dev` in a separate terminal), then:

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
pnpm e2e --grep "resume page"
```

Expected: the 5 "flag OFF" tests pass, the 3 "flag ON" tests are automatically skipped (they print `skipped` not `failed`).

If `"heading Sairam Ugge not visible after Web click"` fails: add `await page.waitForTimeout(300)` after the `.click()` call — `AnimatePresence mode="wait"` needs the exit animation to complete before the new child mounts.

If `"iframe not attached"` fails after switching to Web: same fix — add a short wait for the AnimatePresence exit transition.

- [ ] **Step 4: Commit**

```bash
cd /Users/sairamugge/Desktop/Not-Humans-World/Anvilry/sairam-dev
git add e2e/resume.spec.ts
git commit -m "test(resume): E2E suite covering master-only default and flag-gated variants"
```

---

## Self-Review

**Spec coverage:**
- ✅ Show only master resume ("Sairam Resume") by default → Task 1 (rename) + Task 2 (single iframe)
- ✅ Other 4 variants behind feature flag → Task 2 (`showVariants` gate on `<Section>`) + Task 1 (`visibleDownloads` in `ResumeContent`)
- ✅ Toggle to switch between PDF and web view → Task 2 (PDF/Web segmented pill control)
- ✅ "Dynamic resume on this window" (web/HTML view) → Task 2 (`ResumeViewInline` in Web tab)
- ✅ Feature flag documented → Task 3 (`docs/configuration.md`)
- ✅ Tests cover flag-OFF (default) AND note flag-ON path → Task 4 (8 E2E tests, 3 auto-skipped in CI)

**Placeholder scan:** None. All code blocks complete and runnable.

**Type consistency:**
- `resumeVariants[0]` → `master` (Task 2) ✅
- `resumeVariants.slice(1)` → `otherVariants` (Task 2) ✅  
- `showVariants = process.env.NEXT_PUBLIC_RESUME_VARIANTS === "true"` — same expression in Task 1 (`visibleDownloads`) and Task 2 (`showVariants`) ✅
- `ResumeViewInline` exported Task 1, imported Task 2 ✅
- `ResumeTab = "pdf" | "web"` — `useState<ResumeTab>("pdf")` ✅

**Flag behaviour matrix (verified against both task implementations):**

| Location | Flag OFF | Flag ON |
|---|---|---|
| `/resume` PDF tab | Master iframe + download only | Master iframe + `<details>` with 4 variant cards |
| `/resume` Web tab → PDF pills | 1 pill: "Sairam Resume" | 5 pills: all variants |
| `?view=resume` PDF pills | 1 pill: "Sairam Resume" | 5 pills: all variants |
| Command palette "Download résumé" entries | All 5 (palette unchanged — intentional, recruiter-facing) | All 5 |
