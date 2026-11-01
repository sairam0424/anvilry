import { groupArticles, type ArticleGroup } from "@/lib/article-grouping";
import { allArticles } from "@/lib/content";
import { ARTICLES_ENABLED } from "@/lib/writing-flags";

/** How many articles the homepage "Latest articles" section shows. */
export const HOME_ARTICLE_COUNT = 2;

/**
 * The articles the homepage "Latest articles" section shows, newest first: none while articles are
 * disabled. Grouped BEFORE slicing, so the section shows unique articles and not two platform
 * variants of one. WritingPreview renders these and the homepage JSON-LD lists these, so the two
 * cannot disagree about which articles are on the page.
 */
export function homeArticleGroups(): ArticleGroup[] {
  if (!ARTICLES_ENABLED) return [];
  return groupArticles(allArticles).slice(0, HOME_ARTICLE_COUNT);
}
