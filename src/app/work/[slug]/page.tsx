import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { allWork, getWork } from "@/lib/content";
import { MDXContent } from "@/components/mdx-content";
import { Reveal } from "@/components/ui/reveal";

export function generateStaticParams() {
  return allWork.map((w) => ({ slug: w.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const work = getWork(slug);
  if (!work) return {};
  return {
    title: work.name,
    description: work.summary,
    alternates: { canonical: `/work/${slug}` },
  };
}

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = getWork(slug);
  if (!work) notFound();

  return (
    <main className="flex-1">
      <article className="mx-auto w-full max-w-3xl px-6 py-16">
        <Link href="/#work" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-accent">
          <ArrowLeft size={15} /> Work
        </Link>

        <Reveal>
          <header className="mt-6 border-b border-border pb-8">
            <p className="mono-label">{work.register}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{work.name}</h1>
            <p className="mt-2 text-fg-muted">{work.role}</p>

            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
              {work.metrics.map((m) => (
                <div key={m.label}>
                  <dt className="text-2xl font-semibold text-accent">{m.value}</dt>
                  <dd className="text-xs text-fg-subtle">{m.label}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-wrap gap-1.5">
              {work.tech.map((t) => (
                <span key={t} className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted">
                  {t}
                </span>
              ))}
            </div>
          </header>
        </Reveal>

        <div className="prose-portfolio mt-8">
          <MDXContent code={work.body} />
        </div>
      </article>
    </main>
  );
}
