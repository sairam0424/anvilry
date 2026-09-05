import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  GitCommitHorizontal,
  History,
} from "lucide-react";
import { Github } from "@/components/icons";
import { allProjects, getProject, getArticle } from "@/lib/content";
import { profile } from "@/lib/profile";
import { fetchRepo, pushedAgo } from "@/lib/github";
import { MDXContent } from "@/components/mdx-content";
import { Reveal } from "@/components/ui/reveal";
import { RelatedWriting } from "@/components/related-writing";
import {
  SoftwareSourceCodeJsonLd,
  BreadcrumbJsonLd,
} from "@/components/json-ld";
import { cacheLife } from "next/cache";

const BASE = "https://anvilry.vercel.app";

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
  const url = `/projects/${slug}`;
  // Page-specific OpenGraph: Next merges metadata segments SHALLOWLY and REPLACES nested
  // objects wholesale, so without this the page inherits the root layout's homepage
  // og:title/og:url. The per-route opengraph-image.tsx is file-based (higher priority),
  // so the share IMAGE stays correct; we override only the text + canonical url here.
  return {
    title: project.name,
    description: project.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: `${project.name} — ${profile.name}`,
      description: project.excerpt,
    },
    twitter: {
      card: "summary_large_image",
      title: `${project.name} — ${profile.name}`,
      description: project.excerpt,
    },
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // "use cache" must be the function body's first statement: fetchRepo()+pushedAgo()
  // below call Date.now(), which cacheComponents rejects in an otherwise-static SSG
  // page unless the render is itself a cache boundary. Same pattern as
  // /projects/page.tsx's GithubFeed.
  "use cache";
  cacheLife("hours");

  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  // Repo name is the last path segment of the declared repo URL, e.g.
  // "https://github.com/sairam0424/Tombstone" -> "Tombstone". fetchRepo() itself
  // fails open (null) on a private/renamed repo or if the name isn't allowlisted.
  const repoName = project.repo.split("/").filter(Boolean).pop() ?? "";
  const repo = await fetchRepo(profile.githubUser, repoName);
  const updatedAgo = repo ? pushedAgo(repo.pushedAt) : "";

  const relatedArticles = (project.relatedArticles ?? [])
    .map((articleSlug) => getArticle(articleSlug))
    .filter((a): a is NonNullable<typeof a> => a != null);

  return (
    <main className="flex-1">
      <article className="mx-auto w-full max-w-3xl px-6 py-16">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-accent"
        >
          <ArrowLeft size={15} /> Projects
        </Link>

        <Reveal>
          <header className="mt-6 border-b border-border pb-8">
            <p className="mono-label">{project.group}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {project.name}
            </h1>
            <p className="mt-2 text-fg-muted">{project.tagline}</p>

            {/* Reading-time depth indicator — derived from compiled MDX body length.
                ~200 words/min; only shown when content is substantive (>100 words). */}
            {(() => {
              const words = project.body
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .split(" ")
                .filter(Boolean).length;
              if (words < 100) return null;
              const mins = Math.max(1, Math.round(words / 200));
              return (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] text-fg-subtle">
                  {mins} min read · {words.toLocaleString()} words
                </p>
              );
            })()}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={project.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm text-fg transition-colors hover:bg-bg-elevated"
              >
                <Github size={16} /> View repo{" "}
                <ExternalLink size={13} className="text-fg-subtle" />
              </a>
              {project.commits != null && (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-fg-subtle">
                  <GitCommitHorizontal size={14} />
                  {project.commits.toLocaleString()} commits
                </span>
              )}
              {/* Explicit space text node: adjacent inline spans with no separating
                  whitespace concatenate in Pagefind's static-HTML excerpt extraction
                  (e.g. "775 commitsupdated today"). Flexbox's `gap-3` already provides
                  the visual gap and ignores whitespace-only text nodes for layout, so
                  this space is a no-op visually but fixes the raw-HTML text run. */}
              {project.commits != null && updatedAgo && " "}
              {updatedAgo && (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-fg-subtle">
                  <History size={14} />
                  updated {updatedAgo}
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {project.tech.flatMap((t) => [
                <span
                  key={t}
                  className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted"
                >
                  {t}
                </span>,
                " ",
              ])}
            </div>
          </header>
        </Reveal>

        <div className="prose-portfolio mt-8">
          <MDXContent code={project.body} />
        </div>

        <RelatedWriting articles={relatedArticles} />
      </article>

      <SoftwareSourceCodeJsonLd
        name={project.name}
        description={project.tagline}
        url={`${BASE}${project.url}`}
        codeRepository={project.repo}
        tech={project.tech}
        dateCreated={project.dateCreated}
        license={project.license}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE}/` },
          { name: "Projects", url: `${BASE}/projects` },
          { name: project.name, url: `${BASE}${project.url}` },
        ]}
      />
    </main>
  );
}
