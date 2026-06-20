import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { allArticles, getArticle } from "@/lib/content";
import { NOTES_ENABLED } from "@/lib/writing-flags";
import { MDXContent } from "@/components/mdx-content";
import { BreadcrumbJsonLd } from "@/components/json-ld";
import { Reveal } from "@/components/ui/reveal";
import { profile } from "@/lib/profile";

const BASE = "https://anvilry.vercel.app";

const SOURCE_LABELS: Record<string, string> = {
  medium:   "Medium",
  substack: "Substack",
  linkedin: "LinkedIn",
  native:   "Essay",
};

export function generateStaticParams() {
  return allArticles
    // Skip articles that are notes-only (linkedNote + no externalUrl) when notes are disabled.
    // At runtime these will notFound() — no point prerendering a guaranteed 404.
    .filter((a) => !(a.linkedNote && !a.externalUrl && !NOTES_ENABLED))
    .map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    alternates: {
      canonical: article.canonicalUrl ?? (article.externalUrl ?? `/articles/${slug}`),
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  // linkedNote: redirect to /notes when the notes section is enabled.
  // When NOTES_ENABLED=false the notes routes don't exist — fall through to externalUrl.
  if (article.linkedNote && NOTES_ENABLED) {
    redirect(`/notes/${article.linkedNote}`);
  }

  // External articles: redirect to the original publication.
  if (article.source !== "native" && article.externalUrl) {
    redirect(article.externalUrl);
  }

  // Notes-only article (linkedNote + no externalUrl) with notes disabled — nothing to show.
  if (article.linkedNote && !article.externalUrl && !NOTES_ENABLED) {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.summary,
    datePublished: article.date,
    url: `${BASE}${article.url}`,
    keywords: article.tags.join(", "),
    author: { "@type": "Person", name: profile.name, url: BASE },
  };

  return (
    <main className="flex-1">
      <article className="mx-auto w-full max-w-3xl px-6 py-16">
        <Link href="/articles" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-accent">
          <ArrowLeft size={15} /> Articles
        </Link>
        <Reveal>
          <header className="mt-6 border-b border-border pb-8">
            <p className="mb-2 font-mono text-xs text-fg-subtle">
              {SOURCE_LABELS[article.source] ?? article.source}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{article.title}</h1>
            <p className="mt-2 text-sm text-fg-subtle">
              {new Date(article.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            </p>
            {article.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {article.tags.map((t: string) => (
                  <span
                    key={t}
                    className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </header>
        </Reveal>
        <div className="prose-portfolio mt-8">
          <MDXContent code={article.body} />
        </div>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE },
          { name: "Articles", url: `${BASE}/articles` },
          { name: article.title, url: `${BASE}${article.url}` },
        ]}
      />
    </main>
  );
}
