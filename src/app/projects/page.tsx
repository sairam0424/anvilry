import type { Metadata } from "next";
import { projectsByGroup } from "@/lib/content";
import { profile } from "@/lib/profile";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { ProjectCard } from "@/components/project-card";
import { GithubFeed } from "@/components/github-feed";
import { getRepoFeed } from "@/lib/github";

export const metadata: Metadata = {
  title: "Projects",
  description: `Open-source AI infrastructure by ${profile.name} — agent frameworks, code-intelligence engines, and developer tooling.`,
  alternates: { canonical: "/projects" },
};

// ISR: prerender at build with whatever repos resolve, regenerate at most once/hour.
// The GitHub API is fetched server-side here (never in the visitor's request path),
// so the page stays static-served — cacheComponents is OFF, so this segment config
// is valid. Empty-safe: getRepoFeed() returns [] on failure and the feed hides.
export const revalidate = 3600;

export default async function ProjectsPage() {
  const groups = projectsByGroup();
  const repos = await getRepoFeed();
  return (
    <main className="flex-1">
      <Section label="// open-source AI infrastructure" title="Projects I build in the open">
        <Reveal>
          <p className="max-w-2xl text-fg-muted">
            Agent frameworks, code-intelligence engines, and AI-native tooling. Each card describes architecture and
            tech, not adoption — clone any repo and inspect it.
          </p>
        </Reveal>
        {repos.length > 0 && (
          <div className="mt-8">
            <GithubFeed repos={repos} />
          </div>
        )}
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
