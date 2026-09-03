import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";
import type { Article } from "@/lib/content";
import { NOTES_ENABLED } from "@/lib/writing-flags";

/**
 * Compact "Related Writing" list for a project's detail page — reciprocal links
 * between a project and the writing that documents it. Same href-resolution rule
 * as ArticleGroupCard (route to /notes only when NOTES_ENABLED), kept independent
 * since it renders one Article at a time, not a cross-posted ArticleGroup.
 */
function resolveHref(article: Article): { href: string; external: boolean } {
  if (article.linkedNote && NOTES_ENABLED) {
    return { href: `/notes/${article.linkedNote}`, external: false };
  }
  if (article.externalUrl) return { href: article.externalUrl, external: true };
  return { href: article.url, external: false };
}

export function RelatedWriting({ articles }: { articles: Article[] }) {
  if (articles.length === 0) return null;

  return (
    <div className="mt-10 border-t border-border pt-6">
      <p className="mono-label">Related writing</p>
      <ul className="mt-3 flex flex-col gap-2">
        {articles.map((article) => {
          const { href, external } = resolveHref(article);
          return (
            <li key={article.slug}>
              <Link
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="inline-flex items-center gap-2 text-sm text-fg-muted transition-colors hover:text-accent"
              >
                <FileText
                  size={14}
                  className="shrink-0 text-fg-subtle"
                  aria-hidden="true"
                />
                {article.title}
                {external && (
                  <ExternalLink
                    size={12}
                    className="text-fg-subtle"
                    aria-hidden="true"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
