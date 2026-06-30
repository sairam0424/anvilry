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
