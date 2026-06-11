import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile, impactMetrics } from "@/lib/profile";
import { HeroGraph } from "@/components/hero-graph";

/**
 * Above-the-fold hero. Renders VISIBLE at first paint via a pure-CSS entrance
 * (.hero-rise) — no JS/hydration gate, so it never flashes invisible-then-in and
 * doesn't delay LCP. (Below-the-fold sections use the JS-gated <Reveal>.) The WebGL
 * graph mounts behind this via a dynamic, client-only slot — never blocking paint.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* WebGL knowledge-graph, behind the text. Client-only, lazy, mobile/reduced-motion fallbacks. */}
      <HeroGraph />
      <div className="relative mx-auto w-full max-w-5xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <p className="hero-rise mono-label">{`> ${profile.role} @ ${profile.company}`}</p>

        <h1
          className="hero-rise mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl"
          style={{ animationDelay: "0.05s" }}
        >
          I build production{" "}
          <span className="text-accent">multi-agent LLM systems</span> and the{" "}
          <span className="text-violet">event-driven backends</span> behind them.
        </h1>

        <p className="hero-rise mt-6 max-w-2xl text-lg text-fg-muted" style={{ animationDelay: "0.1s" }}>
          {profile.subhead}
        </p>

        <div className="hero-rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "0.15s" }}>
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

        {/* Impact strip — headline metrics above the fold (all real, work-context). */}
        <dl
          className="hero-rise mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4"
          style={{ animationDelay: "0.2s" }}
        >
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
      </div>
    </section>
  );
}
