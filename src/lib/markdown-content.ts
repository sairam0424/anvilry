import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allArticles, allNotes, allProjects, allWork } from "@/lib/content";
import { CONTENT_KINDS, type ContentKind } from "@/lib/content-kinds";
import { markdownNotFound, markdownResponse } from "@/lib/markdown-response";

type ArticleMeta = (typeof allArticles)[number];

export { CONTENT_KINDS, type ContentKind };

const collections: Record<ContentKind, readonly { slug: string }[]> = {
  projects: allProjects,
  work: allWork,
  articles: allArticles,
  notes: allNotes,
};

/**
 * Removes the leading front matter block. The closing fence must be a line of its own: a value
 * that merely contains "---" (a decision title in nh-deck.mdx ends with it) must not close the
 * block early and leak the rest of the YAML into the page.
 */
function stripFrontmatter(raw: string): string {
  return raw.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, "").trimStart();
}

function readRawContent(kind: ContentKind, slug: string): string | null {
  const base = join(process.cwd(), "content", kind);
  for (const ext of ["mdx", "md"]) {
    try {
      return readFileSync(join(base, `${slug}.${ext}`), "utf-8");
    } catch {
      // try the next extension
    }
  }
  return null;
}

/**
 * Cross-posted articles live as metadata-only files (the text is on Dev.to, Substack and so on),
 * so their twin is a description with the places to read them, not an empty page.
 */
function describeArticle(article: ArticleMeta): string {
  const lines = [`# ${article.title}`, "", article.summary, ""];
  const published = `Published ${article.date.slice(0, 10)} on ${article.source}`;
  lines.push(`- ${article.readingTime ? `${published}, ${article.readingTime} min read` : published}`);
  if (article.externalUrl) lines.push(`- Read it: ${article.externalUrl}`);
  if (article.canonicalUrl) lines.push(`- Canonical version: ${article.canonicalUrl}`);
  if (article.tags.length > 0) lines.push(`- Tags: ${article.tags.join(", ")}`);
  return `${lines.join("\n")}\n`;
}

/**
 * The Markdown twin of /<kind>/<slug>. The slug must exist in the content layer before any file
 * is read: that membership check is what keeps a crafted slug from reaching the filesystem.
 */
export function markdownForContent(kind: ContentKind, slug: string): Response {
  const notFound = () => markdownNotFound(`/${kind}/${slug}`);
  if (!collections[kind].some((item) => item.slug === slug)) return notFound();
  const raw = readRawContent(kind, slug);
  if (raw === null) return notFound();
  const body = stripFrontmatter(raw);
  const article = kind === "articles" ? allArticles.find((a) => a.slug === slug) : undefined;
  const text = body.trim() === "" && article ? describeArticle(article) : body;
  return markdownResponse(text, { canonicalPath: `/${kind}/${slug}` });
}
