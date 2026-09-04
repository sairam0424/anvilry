import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Github, Linkedin } from "@/components/icons";
import { profile, impactMetrics } from "@/lib/profile";
import { HeroGraph } from "@/components/hero-graph";
import { HeroAvatar } from "@/components/hero-avatar";
import { GithubStatsStrip } from "@/components/github-stats-strip";
import { GITHUB_STATS_ENABLED } from "@/lib/writing-flags";

/**
 * Above-the-fold hero. Renders VISIBLE at first paint via a pure-CSS entrance
 * (.hero-rise) — no JS/hydration gate, so it never flashes invisible-then-in and
 * doesn't delay LCP. (Below-the-fold sections use the JS-gated <Reveal>.) The WebGL
 * graph mounts behind this via a dynamic, client-only slot — never blocking paint.
 */
export function Hero() {
  // Read flag inside function body — NOT module scope (required for vi.stubEnv in tests).
  const heroMode = process.env.NEXT_PUBLIC_HERO_MODE;

  return (
    <section className="relative overflow-hidden">
      {/* WebGL slot: avatar when NEXT_PUBLIC_HERO_MODE=avatar, otherwise knowledge-graph (default). */}
      {heroMode === "avatar" ? <HeroAvatar /> : <HeroGraph />}
      <div className="relative mx-auto w-full max-w-5xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
        <p className="hero-rise font-mono text-sm text-fg-muted">{profile.name}</p>
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
            href="/work"
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

        {/* Impact strip — headline metrics above the fold (all real, work-context).
            sm:grid-cols-3 matches the 3 metrics so the grid never leaves an empty
            trailing cell (was sm:grid-cols-4 → a blank 4th box after the 10x removal).
            grid-cols-1 (not grid-cols-2) below `sm` — 3 items in a 2-col grid orphans
            the 3rd cell alone on its own row; stacking full-width is count-independent. */}
        <dl
          className="hero-rise mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3"
          style={{ animationDelay: "0.2s" }}
        >
          {impactMetrics.map((m) => (
            <Link key={m.sub} href={m.href} className="bg-bg-surface p-4 transition-colors hover:bg-bg-elevated">
              <dt className="text-2xl font-semibold text-fg sm:text-3xl">{m.value}</dt>
              <dd className="mt-1 text-xs text-fg-muted">
                {m.label}
                <span className="block text-fg-subtle">{m.sub}</span>
              </dd>
            </Link>
          ))}
        </dl>

        {GITHUB_STATS_ENABLED && (
          <div className="hero-rise mt-8" style={{ animationDelay: "0.25s" }}>
            <p className="font-mono text-xs uppercase tracking-widest text-fg-muted">Live GitHub — as of today</p>
            <div className="mt-3">
              <GithubStatsStrip />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
