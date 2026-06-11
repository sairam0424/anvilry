import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, GitCommitHorizontal } from "lucide-react";
import { Github } from "@/components/icons";
import { allProjects, getProject } from "@/lib/content";
import { MDXContent } from "@/components/mdx-content";
import { Reveal } from "@/components/ui/reveal";

export function generateStaticParams() {
  return allProjects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return { title: project.name, description: project.excerpt };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <main className="flex-1">
      <article className="mx-auto w-full max-w-3xl px-6 py-16">
        <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-accent">
          <ArrowLeft size={15} /> Projects
        </Link>

        <Reveal>
          <header className="mt-6 border-b border-border pb-8">
            <p className="mono-label">{project.group}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h1>
            <p className="mt-2 text-fg-muted">{project.tagline}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={project.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm text-fg transition-colors hover:bg-bg-elevated"
              >
                <Github size={16} /> View repo <ExternalLink size={13} className="text-fg-subtle" />
              </a>
              {project.commits != null && (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-fg-subtle">
                  <GitCommitHorizontal size={14} />
                  {project.commits.toLocaleString()} commits
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {project.tech.map((t) => (
                <span key={t} className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted">
                  {t}
                </span>
              ))}
            </div>
          </header>
        </Reveal>

        <div className="prose-portfolio mt-8">
          <MDXContent code={project.body} />
        </div>
      </article>
    </main>
  );
}
