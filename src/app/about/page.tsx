import type { Metadata } from "next";
import { profile, skills, impactMetrics } from "@/lib/profile";
import { allProjects } from "@/lib/content";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "About",
  description: `About ${profile.name} — ${profile.role} at ${profile.company}.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  // Derive the headline numbers from the single source so the prose can't drift.
  const [pensieve, aava, throughput] = impactMetrics;
  return (
    <main className="flex-1">
      <Section label="// whoami" title={`I'm ${profile.name}.`}>
        <Reveal>
          <div className="max-w-2xl space-y-4 text-fg-muted">
            <p>
              I&apos;m a <span className="text-fg">GenAI &amp; Backend engineer</span> at {profile.company} (since
              Jun 2024), building production multi-agent LLM systems and the event-driven backends that keep them
              fast, governed, and reliable at scale.
            </p>
            <p>
              I co-built and production-hardened <span className="text-fg">Pensieve</span>, a multi-agent
              orchestration engine serving {pensieve.value} users daily, and architected the backend for{" "}
              <span className="text-fg">AAVA Code</span>, an AI coding plugin for VS Code adopted by {aava.value} users
              daily across 5+ client environments. On the backend I&apos;ve owned systems end-to-end — scaling
              throughput {throughput.value} {throughput.sub} via a decoupled Redis Streams + SSE pub/sub architecture.
            </p>
            <p>
              Beyond work, I build open-source AI infrastructure in the open — agent frameworks, code-intelligence
              engines, and AI-native tooling ({allProjects.length}&nbsp;public repos). I also compete: Google Code Jam
              2023
              (AIR 420), Meta Hacker Cup 2022, and Institute Rank 1 on GeeksforGeeks &amp; InterviewBit.
            </p>
          </div>
        </Reveal>
      </Section>

      <Section label="// skills" title="What I work with">
        <div className="grid gap-5 sm:grid-cols-2">
          {skills.map((s, i) => (
            <Reveal key={s.group} delay={(i % 2) * 0.06}>
              <div className="card-surface p-5">
                <p className="mono-label">{s.group}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.items.map((item) => (
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
    </main>
  );
}
