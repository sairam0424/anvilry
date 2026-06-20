import { allProjects, allNotes, allArticles } from "@/lib/content";
import { profile } from "@/lib/profile";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

const totalCommits = allProjects.reduce((sum, p) => sum + (p.commits ?? 0), 0);

const stats = [
  { value: allProjects.length.toString(), label: "Open-source repos", sub: "published projects" },
  { value: totalCommits.toLocaleString(), label: "Total commits", sub: "across all repos" },
  { value: "2K+", label: "Daily users", sub: "Pensieve at peak" },
  { value: "3K+", label: "Daily users", sub: "AAVA Code at peak" },
  { value: (allArticles.length + allNotes.length).toString(), label: "Articles & notes", sub: "published writing" },
  { value: profile.company, label: "Current company", sub: profile.tenure },
];

export default function StatsPage() {
  return (
    <main className="flex-1">
      <Section label="// numbers" title="By the numbers" titleAs="h1">
        <p className="mb-10 max-w-2xl text-fg-muted">
          A snapshot of open-source work, production systems, and engineering output.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={(i % 3) * 0.06}>
              <div className="card-surface flex flex-col gap-1 p-6">
                <span className="font-mono text-3xl font-bold text-accent">{s.value}</span>
                <span className="font-medium text-fg">{s.label}</span>
                <span className="font-mono text-xs text-fg-subtle">{s.sub}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>
    </main>
  );
}
