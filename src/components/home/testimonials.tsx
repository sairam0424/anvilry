import { Quote, ArrowUpRight } from "lucide-react";
import { testimonials } from "@/lib/testimonials";
import { TESTIMONIALS_ENABLED } from "@/lib/writing-flags";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

/**
 * Social-proof strip — hidden by default (NEXT_PUBLIC_TESTIMONIALS_ENABLED=false)
 * until real LinkedIn recommendations are collected and added to lib/testimonials.ts.
 */
export function Testimonials() {
  // Flag off → hide entirely (no placeholder either — clean homepage)
  if (!TESTIMONIALS_ENABLED) return null;

  if (!testimonials || testimonials.length === 0) {
    return (
      <Section label="// what people say" title="Recommendations">
        <Reveal>
          <div className="card-surface flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-fg">LinkedIn recommendations coming soon</p>
              <p className="mt-1 text-sm text-fg-muted">
                In the meantime, view my recommendations directly on LinkedIn.
              </p>
            </div>
            <a
              href="https://linkedin.com/in/sairam0424"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2.5 text-sm text-fg transition-colors hover:bg-bg-elevated"
            >
              View on LinkedIn <span aria-hidden="true">↗</span>
            </a>
          </div>
        </Reveal>
      </Section>
    );
  }

  return (
    <Section label="// what people say" title="Recommendations">
      <ul className="grid list-none gap-4 sm:grid-cols-2">
        {testimonials.map((t, i) => (
          <li key={t.sourceUrl}>
            <Reveal delay={(i % 2) * 0.06}>
              <figure className="card-surface flex h-full flex-col p-5">
                <Quote size={18} className="text-accent" aria-hidden="true" />
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-fg-muted">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3">
                  <div>
                    <p className="text-sm font-medium text-fg">{t.name}</p>
                    <p className="text-xs text-fg-subtle">
                      {t.role} · {t.relationship}
                    </p>
                  </div>
                  <a
                    href={t.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-fg-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    verify on LinkedIn <ArrowUpRight size={12} aria-hidden="true" />
                  </a>
                </figcaption>
              </figure>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
