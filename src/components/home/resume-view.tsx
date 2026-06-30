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
