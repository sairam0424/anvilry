import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";
import { profile, resumeVariants } from "@/lib/profile";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

const description = `Download ${profile.name}'s résumé — role-targeted variants for Backend, GenAI, and Full-Stack.`;
export const metadata: Metadata = {
  title: "Résumé",
  description,
  alternates: { canonical: "/resume" },
  // Page-specific OG (Next replaces the nested openGraph wholesale per segment) so a
  // share of /resume shows this page, not the homepage identity.
  openGraph: { type: "website", url: "/resume", title: `Résumé — ${profile.name}`, description },
};

const master = resumeVariants[0];

export default function ResumePage() {
  return (
    <main className="flex-1">
      <Section label="// résumé" title="Role-targeted résumés" titleAs="h1">
        <Reveal>
          <p className="max-w-2xl text-fg-muted">
            One page, tuned per role. Pick the variant that matches the opening — every version shares the same
            verified work history and metrics.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resumeVariants.map((v, i) => (
            <Reveal key={v.file} delay={(i % 3) * 0.05}>
              <a
                href={v.file}
                download
                className="card-surface group flex items-center justify-between p-4 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-accent" />
                  <div>
                    <p className="text-sm font-medium">{v.label}</p>
                    <p className="text-xs text-fg-subtle">{v.tag}</p>
                  </div>
                </div>
                <Download size={16} className="text-fg-subtle transition-colors group-hover:text-accent" />
              </a>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section label="// preview" title="Master résumé">
        <Reveal>
          {/* <object> was deprecated for PDF in Chrome 120+ (Plugin API removal).
              <iframe> uses Chrome's native PDF renderer and works cross-browser.
              No fallback inside <iframe> — iframe children cause SSR/client hydration
              mismatch because browsers serialize iframe content differently from React. */}
          <div className="overflow-hidden rounded-xl border border-border">
            <iframe
              src={master.file}
              className="h-[80vh] w-full"
              title="Résumé preview"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <a
              href={master.file}
              download
              className="inline-flex items-center gap-2 text-sm text-fg-muted transition-colors hover:text-accent"
            >
              <Download size={15} /> Download master résumé
            </a>
          </div>
        </Reveal>
      </Section>
    </main>
  );
}
