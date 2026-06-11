import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { allWork } from "@/lib/content";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

/** Flagship production work — Pensieve + AAVA Code, honest register + real metrics. */
export function FeaturedWork() {
  return (
    <Section id="work" label="// production work @ Ascendion" title="Flagship systems I helped build">
      <div className="grid gap-5 sm:grid-cols-2">
        {allWork.map((w, i) => (
          <Reveal key={w.slug} delay={i * 0.08}>
            <Link
              href={w.url}
              className="card-surface group flex h-full flex-col p-6 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="mono-label">{w.register}</span>
                <ArrowUpRight size={18} className="text-fg-subtle transition-colors group-hover:text-accent" />
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight group-hover:text-accent">{w.name}</h3>
              <p className="mt-1 text-sm text-fg-subtle">{w.role}</p>
              <p className="mt-3 text-sm text-fg-muted">{w.summary}</p>

              <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-4">
                {w.metrics.map((m) => (
                  <div key={m.label}>
                    <dt className="text-lg font-semibold text-accent">{m.value}</dt>
                    <dd className="text-[11px] text-fg-subtle">{m.label}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
