import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { allArticles } from "@/lib/content";
import { ARTICLES_ENABLED } from "@/lib/writing-flags";
import { ArticleCard } from "@/components/article-card";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/ui/reveal";

export function WritingPreview() {
  if (!ARTICLES_ENABLED || allArticles.length === 0) return null;
  const preview = allArticles.slice(0, 2);

  return (
    <Section label="// writing" title="Latest articles">
      <div className="grid gap-5 sm:grid-cols-2">
        {preview.map((a, i) => (
          <Reveal key={a.slug} delay={i * 0.06}>
            <ArticleCard article={a} />
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
