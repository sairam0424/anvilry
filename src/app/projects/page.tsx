import type { Metadata } from "next";
import { projectsByGroup } from "@/lib/content";
import { profile } from "@/lib/profile";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { ProjectCard } from "@/components/project-card";
import { GithubStats } from "@/components/github-stats";

export const metadata: Metadata = {
  title: "Projects",
  description: `Open-source AI infrastructure by ${profile.name} — agent frameworks, code-intelligence engines, and developer tooling.`,
  alternates: { canonical: "/projects" },
};

export default function ProjectsPage() {
  const groups = projectsByGroup();
  return (
    <main className="flex-1">
      <Section label="// open-source AI infrastructure" title="Projects I build in the open">
        <Reveal>
          <p className="max-w-2xl text-fg-muted">
            Agent frameworks, code-intelligence engines, and AI-native tooling. Each card describes architecture and
            tech, not adoption — clone any repo and inspect it.
          </p>
        </Reveal>
        <div className="mt-8">
          <GithubStats />
        </div>
      </Section>

      {groups.map((g) => (
        <Section key={g.group} label={`// ${g.group.toLowerCase()}`} title={g.group} className="py-12">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((p, i) => (
              <Reveal key={p.slug} delay={(i % 3) * 0.06}>
                <ProjectCard project={p} />
              </Reveal>
            ))}
          </div>
        </Section>
      ))}
    </main>
  );
}
