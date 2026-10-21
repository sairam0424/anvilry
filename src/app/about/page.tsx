import type { Metadata } from "next";
import { profile, skills, impactMetrics } from "@/lib/profile";
import { personal, now, hasNow, hasPersonalContent } from "@/lib/personal";
import { allProjects } from "@/lib/content";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { ProfilePageJsonLd } from "@/components/json-ld";
import { SiteMascot } from "@/components/mascot/site-mascot";
import { isAboutMascotEnabled } from "@/lib/mascots";
import { SkillChip } from "@/components/skill-chip";

/** Format an ISO date as an absolute, human-readable string (no relative drift). */
function formatUpdated(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

const description = `About ${profile.name} — ${profile.role} at ${profile.company}.`;
export const metadata: Metadata = {
  title: "About",
  description,
  alternates: { canonical: "/about" },
  // Page-specific OG so a share of /about shows this page, not the homepage identity.
  openGraph: { type: "profile", url: "/about", title: `About — ${profile.name}`, description },
};

export default function AboutPage() {
  // Derive the headline numbers from the single source so the prose can't drift.
  const [pensieve, aava] = impactMetrics;
  return (
    <main className="flex-1">
      <Section label="// whoami" title={`I'm ${profile.name}.`} titleAs="h1">
        <Reveal>
          {/* Portrait: the site's drawn head (src/lib/mascots.ts) beside the intro from `sm`,
              lifted to the heading line; above the intro on phones. It only tracks fine
              pointers and a tap plays a reaction. NEXT_PUBLIC_ABOUT_MASCOT=false removes it. */}
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between sm:gap-12">
            <div className="max-w-2xl space-y-4 text-fg-muted">
            <p>
              I&apos;m a <span className="text-fg">GenAI &amp; Backend engineer</span> at {profile.company} (since
              Jun 2024), building production multi-agent LLM systems and the event-driven backends that keep them
              fast, governed, and reliable at scale.
            </p>
            <p>
              I co-built and production-hardened <span className="text-fg">Pensieve</span>, a multi-agent
              orchestration engine serving {pensieve.value} users daily, and architected the backend for{" "}
              <span className="text-fg">AAVA Code</span>, an AI coding plugin for VS Code adopted by {aava.value}{" "}
              users daily across 5+ client environments. On the backend I&apos;ve owned systems end-to-end — building
              decoupled, event-driven services with a Redis Streams + SSE pub/sub architecture.
            </p>
            <p>
              Beyond work, I build open-source AI infrastructure in the open — agent frameworks, code-intelligence
              engines, and AI-native tooling ({allProjects.length}&nbsp;public repos). I also compete: Google Code Jam
              2023
              (AIR 420), Meta Hacker Cup 2022, and Institute Rank 1 on GeeksforGeeks &amp; InterviewBit.
            </p>
            </div>
            {isAboutMascotEnabled() && (
              <div className="order-first shrink-0 sm:order-none sm:-mt-28">
                <SiteMascot character="gearbot" size={176} />
              </div>
            )}
          </div>
        </Reveal>
      </Section>

      {/* Currently — the strongest hire signal ("open to new roles") on the indexed
          recruiter path. Owner-curated content from personal.ts; empty-safe (renders
          nothing until populated). Absolute date, never a drifting "N days ago". */}
      {hasNow && (
        <Section label="// now" title="What I'm focused on">
          <Reveal>
            <div className="max-w-2xl">
              <ul className="space-y-2 text-fg-muted">
                {now.focus.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-accent" aria-hidden="true">
                      →
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-fg-subtle">Last updated {formatUpdated(now.updated)}</p>
            </div>
          </Reveal>
        </Section>
      )}

      {/* Uses — a compact toolkit teaser (the full list lives behind the `uses`
          terminal command). Empty-safe. */}
      {hasPersonalContent && personal.uses.length > 0 && (
        <Section id="uses" label="// uses" title="My toolkit">
          <div className="grid gap-5 sm:grid-cols-2">
            {personal.uses.map((g, i) => (
              <Reveal key={g.group} delay={(i % 2) * 0.06}>
                <div className="card-surface p-5">
                  <p className="mono-label">{g.group}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {g.items.map((item) => (
                      <span key={item} className="rounded-md border border-border px-2 py-1 text-xs text-fg-muted">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      <Section id="skills" label="// skills" title="What I work with">
        <div className="grid gap-5 sm:grid-cols-2">
          {skills.map((s, i) => (
            <Reveal key={s.group} delay={(i % 2) * 0.06}>
              <div className="card-surface p-5">
                <p className="mono-label">{s.group}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.items.map((item) => (
                    <SkillChip key={item} name={item} />
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>
      <ProfilePageJsonLd />
    </main>
  );
}
