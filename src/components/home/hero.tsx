import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile, impactMetrics } from "@/lib/profile";
import { Reveal } from "@/components/ui/reveal";
import { HeroGraph } from "@/components/hero-graph";

/**
 * Above-the-fold hero. Static, server-rendered text owns the LCP (research:
 * 57% of attention is above the fold; ~6s recruiter scan). The WebGL graph
 * mounts behind this in M3 via a dynamic, client-only slot — never blocking paint.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* WebGL knowledge-graph, behind the text. Client-only, lazy, mobile/reduced-motion fallbacks. */}
      <HeroGraph />
      <div className="relative mx-auto w-full max-w-5xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <Reveal>
          <p className="mono-label">{`> ${profile.role} @ ${profile.company}`}</p>
        </Reveal>

        <Reveal delay={0.05}>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            I build production{" "}
            <span className="text-accent">multi-agent LLM systems</span> and the{" "}
            <span className="text-violet">event-driven backends</span> behind them.
          </h1>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="mt-6 max-w-2xl text-lg text-fg-muted">{profile.subhead}</p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/#work"
              className="group inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-bg-base transition-colors hover:bg-accent-strong"
            >
              See my work
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/resume"
              className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-5 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-bg-elevated"
            >
              Résumé
            </Link>
            <div className="flex items-center gap-3 pl-1">
              <a href={profile.links.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="text-fg-muted hover:text-accent">
                <Github size={20} />
              </a>
              <a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-fg-muted hover:text-accent">
                <Linkedin size={20} />
              </a>
            </div>
          </div>
        </Reveal>

        {/* Impact strip — headline metrics above the fold (all real, work-context). */}
        <Reveal delay={0.2}>
          <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
            {impactMetrics.map((m) => (
              <div key={m.sub} className="bg-bg-surface p-4">
                <dt className="text-2xl font-semibold text-fg sm:text-3xl">{m.value}</dt>
                <dd className="mt-1 text-xs text-fg-muted">
                  {m.label}
                  <span className="block text-fg-subtle">{m.sub}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
