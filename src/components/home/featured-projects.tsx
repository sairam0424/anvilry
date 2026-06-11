import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { featuredProjects } from "@/lib/content";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";
import { ProjectCard } from "@/components/project-card";

/** Featured open-source repos preview — links to the full /projects grid. */
export function FeaturedProjects() {
  return (
    <Section id="projects" label="// open-source AI infrastructure" title="Things I build in the open">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {featuredProjects.map((p, i) => (
          <Reveal key={p.slug} delay={(i % 3) * 0.06}>
            <ProjectCard project={p} />
          </Reveal>
        ))}
      </div>
      <div className="mt-8">
        <Link
          href="/projects"
          className="group inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-strong"
        >
          View all 8 projects
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </Section>
  );
}
