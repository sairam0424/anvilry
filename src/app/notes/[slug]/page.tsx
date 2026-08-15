import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { allNotes, getNote } from "@/lib/content";
import { NOTES_ENABLED } from "@/lib/writing-flags";
import { MDXContent } from "@/components/mdx-content";
import { BreadcrumbJsonLd } from "@/components/json-ld";
import { Reveal } from "@/components/ui/reveal";
import { ReadingProgress } from "@/components/reading-progress";
import { profile } from "@/lib/profile";

const BASE = "https://anvilry.vercel.app";

export function generateStaticParams() {
  // NOTE: the `if (!NOTES_ENABLED) return []` short-circuit was removed for cacheComponents,
  // which hard-requires every generateStaticParams to return at least one result ("This is to
  // ensure that we can perform build-time validation that there is no other dynamic accesses
  // that would cause a runtime error"). An empty array failed the build outright.
  //
  // User-visible behaviour is UNCHANGED: the page component below still calls notFound() when
  // NOTES_ENABLED is false, so these routes remain 404s while notes ship dark — they are just
  // prerendered as 404s instead of resolved on demand. This also makes the page route
  // consistent with ./opengraph-image.tsx, which already maps all note slugs with no flag check.
  return allNotes.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  // Guard matches the page component — prevents partial metadata then 500
  if (!NOTES_ENABLED) return {};
  const { slug } = await params;
  const note = getNote(slug);
  if (!note) return {};
  return {
    title: note.title,
    description: note.summary,
    alternates: { canonical: `/notes/${slug}` },
  };
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!NOTES_ENABLED) notFound();
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
      <ReadingProgress />
      <article className="mx-auto w-full max-w-3xl px-6 py-16">
        <Link
          href="/notes"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-accent"
        >
          <ArrowLeft size={15} /> Notes
        </Link>
        <Reveal>
          <header className="mt-6 border-b border-border pb-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {note.title}
            </h1>
            <p className="mt-2 text-sm text-fg-subtle">
              {new Date(note.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}
            </p>
            {note.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {note.tags.map((t) => (
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
          <MDXContent code={note.body} />
        </div>
      </article>
      {/* BlogPosting + breadcrumb structured data — article entity + SERP breadcrumb,
          mirroring the /work and /projects detail pages. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE },
          { name: "Notes", url: `${BASE}/notes` },
          { name: note.title, url: `${BASE}${note.url}` },
        ]}
      />
    </main>
  );
}
