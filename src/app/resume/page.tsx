"use client";

import { useState } from "react";
import { Download, FileText, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { resumeVariants } from "@/lib/profile";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { SkeletonIframe } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function ResumePage() {
  const [selected, setSelected] = useState(resumeVariants[0]);
  const [pdfLoading, setPdfLoading] = useState(true);

  // Reset loading state whenever the selected variant changes
  function selectVariant(v: (typeof resumeVariants)[number]) {
    setSelected(v);
    setPdfLoading(true);
  }

  return (
    <main className="flex-1">
      <Section label="// résumé" title="Role-targeted résumés" titleAs="h1">
        <Reveal>
          <p className="max-w-2xl text-fg-muted">
            One page, tuned per role. Pick the variant that matches the opening — every version shares the same
            verified work history and metrics.
          </p>
        </Reveal>

        {/* ── Variant selector grid ──────────────────────────────────── */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resumeVariants.map((v, i) => {
            const active = selected.file === v.file;
            return (
              <Reveal key={v.file} delay={(i % 3) * 0.05}>
                <motion.div
                  animate={active ? { boxShadow: "var(--glow-accent)" } : { boxShadow: "none" }}
                  transition={{ duration: 0.2 }}
                  className={[
                    "card-surface group flex items-center justify-between p-4 transition-colors",
                    active ? "border-accent/60" : "",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => selectVariant(v)}
                    className="flex flex-1 items-center gap-3 text-left focus-visible:outline-none"
                    aria-pressed={active}
                    aria-label={`Preview ${v.label} résumé`}
                  >
                    <FileText size={20} className={active ? "text-accent" : "text-fg-subtle transition-colors group-hover:text-accent"} />
                    <div>
                      <p className={`text-sm font-medium ${active ? "text-accent" : "text-fg"}`}>{v.label}</p>
                      <p className="text-xs text-fg-subtle">{v.tag}</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectVariant(v)}
                      aria-pressed={active}
                      aria-label={`Preview ${v.label}`}
                      className="rounded p-1 text-fg-subtle transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {active ? <Eye size={16} className="text-accent" /> : <EyeOff size={16} />}
                    </button>
                    <a
                      href={v.file}
                      download
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Download ${v.label}`}
                      className="rounded p-1 text-fg-subtle transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                </motion.div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* ── Inline preview panel ───────────────────────────────────────── */}
      <Section label="// preview" title="">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono text-xs text-fg-subtle">
            Now previewing: <span className="text-accent">{selected.label}</span>
          </p>
          <a
            href={selected.file}
            download
            className="inline-flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-accent"
          >
            <Download size={13} /> Download this variant
          </a>
        </div>

        {/* Skeleton overlay + iframe — crossfade on load and on variant switch */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selected.file}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="relative overflow-hidden rounded-xl border border-border"
          >
            {/* Shimmer skeleton — visible while PDF is loading */}
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
              src={selected.file}
              onLoad={() => setPdfLoading(false)}
              className={cn(
                "h-[80vh] w-full transition-opacity duration-300",
                pdfLoading ? "opacity-0" : "opacity-100",
              )}
              title={`${selected.label} résumé preview`}
            />
          </motion.div>
        </AnimatePresence>
      </Section>
    </main>
  );
}
