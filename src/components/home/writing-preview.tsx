import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { allArticles } from "@/lib/content";
import { ARTICLES_ENABLED } from "@/lib/writing-flags";
import { groupArticles } from "@/lib/article-grouping";
import { ArticleGroupCard } from "@/components/article-group-card";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

export function WritingPreview() {
  if (!ARTICLES_ENABLED || allArticles.length === 0) return null;

  // Deduplicate before slicing — show 2 unique articles, not 2 platform variants
  const grouped = groupArticles(allArticles);
  const preview = grouped.slice(0, 2);

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
