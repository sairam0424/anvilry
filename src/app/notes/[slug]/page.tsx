import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { allNotes, getNote } from "@/lib/content";
import { MDXContent } from "@/components/mdx-content";
import { Reveal } from "@/components/ui/reveal";
import { profile } from "@/lib/profile";

const BASE = "https://anvilry.vercel.app";

export function generateStaticParams() {
  return allNotes.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) return {};
  return { title: note.title, description: note.summary, alternates: { canonical: `/notes/${slug}` } };
}

export default async function NotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: note.title,
    description: note.summary,
    datePublished: note.date,
    url: `${BASE}${note.url}`,
    keywords: note.tags.join(", "),
    author: { "@type": "Person", name: profile.name, url: BASE },
  };

  return (
    <main className="flex-1">
      <article className="mx-auto w-full max-w-3xl px-6 py-16">
        <Link href="/notes" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-accent">
          <ArrowLeft size={15} /> Notes
        </Link>
        <Reveal>
          <header className="mt-6 border-b border-border pb-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{note.title}</h1>
            <p className="mt-2 text-sm text-fg-subtle">
              {new Date(note.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })}
            </p>
            {note.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {note.tags.map((t) => (
                  <span key={t} className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </header>
        </Reveal>
        <div className="prose-portfolio mt-8">
          <MDXContent code={note.body} />
        </div>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}
