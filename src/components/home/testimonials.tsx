import { Quote, ArrowUpRight } from "lucide-react";
import { testimonials, hasTestimonials } from "@/lib/testimonials";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

/**
 * Social-proof strip — third-party recommendations the self-authored résumé can't
 * provide (especially potent for the honest "co-built" register, where a manager
 * confirming the contribution removes any doubt). EMPTY-SAFE: renders nothing until
 * real, source-linked testimonials exist (see lib/testimonials.ts). Every card carries
 * a "verify on LinkedIn" link — the permalink IS the anti-fabrication guarantee.
 */
export function Testimonials() {
  if (!hasTestimonials) return null;

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
