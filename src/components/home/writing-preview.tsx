import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { homeArticleGroups } from "@/lib/home-articles";
import { ArticleGroupCard } from "@/components/article-group-card";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

export function WritingPreview() {
  // The selection (flag, grouping before slicing, count) lives in home-articles.ts: the homepage
  // JSON-LD lists the same articles.
  const preview = homeArticleGroups();
  if (preview.length === 0) return null;

  return (
    <Section label="// writing" title="Latest articles">
      <div className="grid gap-5 sm:grid-cols-2">
        {preview.map((group, i) => (
          <Reveal key={group.canonical.slug} delay={i * 0.06}>
            <ArticleGroupCard group={group} />
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.12}>
        <div className="mt-6 flex justify-end">
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 font-mono text-sm text-fg-muted transition-colors hover:text-accent"
          >
            All articles <ArrowUpRight size={14} />
          </Link>
        </div>
      </Reveal>
    </Section>
  );
}
