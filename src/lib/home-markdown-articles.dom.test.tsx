import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  absolute,
  load,
  lists,
  parseHtml,
  restoreListMocks,
} from "@/components/json-ld-lists-support";
import { stripTrackingParams } from "@/lib/strip-tracking-params";

/**
 * The homepage Markdown twin lists the same articles as the "Latest articles" cards and the JSON-LD,
 * and links each one to the same place the card does. The three used to carry separate copies of the
 * rule and disagreed once notes were on (production's setting); now they share homeArticleGroups()
 * and resolveCanonicalHref(), and this test compares the three outputs for the same data under both
 * settings of NEXT_PUBLIC_NOTES_ENABLED, which `load()` pins.
 */

afterEach(restoreListMocks);

interface TwinArticle {
  title: string;
  href: string;
  summary: string;
}

/** The article entries of the twin's "## Writing" section, read back out of the Markdown. */
function twinArticles(markdown: string): TwinArticle[] {
  const section =
    markdown.split("\n## ").find((part) => part.startsWith("Writing")) ?? "";
  return [...section.matchAll(/^- \[(.+?)\]\((\S+?)\): (.*)$/gm)].map((m) => ({
    title: m[1],
    href: m[2],
    summary: m[3],
  }));
}

describe.each(["true", "false"] as const)(
  "homepage Markdown twin articles with NEXT_PUBLIC_NOTES_ENABLED=%s",
  (notes) => {
    it("names the same articles, in the same order, and links each to where its card links", async () => {
      const { writingSection } = await load({ notes });
      const { buildHomeMarkdown } = await import("@/lib/home-markdown");
      const twin = twinArticles(buildHomeMarkdown());
      const section = parseHtml(
        renderToStaticMarkup(writingSection.WritingPreview()),
      );

      const cards = [...section.querySelectorAll(".card-surface")].map(
        (card) => ({
          title: card.querySelector("h3")?.textContent,
          href: absolute(card.querySelector("a")?.getAttribute("href") ?? ""),
          summary: card.querySelector("p")?.textContent,
        }),
      );

      expect(twin.length).toBeGreaterThan(0);
      expect(twin).toEqual(cards);
    });

    it("links each article to the address the JSON-LD names, apart from the tracking parameters it strips", async () => {
      const { ld } = await load({ notes });
      const { buildHomeMarkdown } = await import("@/lib/home-markdown");
      const twin = twinArticles(buildHomeMarkdown());
      const [list] = lists(renderToStaticMarkup(<ld.LatestArticlesJsonLd />));

      expect(list.itemListElement.map((e) => e.name)).toEqual(
        twin.map((t) => t.title),
      );
      expect(list.itemListElement.map((e) => e.url)).toEqual(
        twin.map((t) => stripTrackingParams(t.href)),
      );
    });

    it("sends a cross-posted article to the on-site note exactly while notes are enabled", async () => {
      const { homeArticles } = await load({ notes });
      const { buildHomeMarkdown } = await import("@/lib/home-markdown");
      const twin = twinArticles(buildHomeMarkdown());

      homeArticles.homeArticleGroups().forEach(({ canonical }, i) => {
        if (canonical.linkedNote && notes === "true")
          expect(twin[i].href).toBe(
            `https://anvilry.vercel.app/notes/${canonical.linkedNote}`,
          );
        else expect(twin[i].href).not.toContain("/notes/");
      });
    });

    it("lists as many articles as the homepage section shows, and closes with the link to all of them", async () => {
      const { homeArticles } = await load({ notes });
      const { buildHomeMarkdown } = await import("@/lib/home-markdown");
      const markdown = buildHomeMarkdown();

      expect(twinArticles(markdown)).toHaveLength(
        homeArticles.homeArticleGroups().length,
      );
      expect(markdown).toContain(
        "- [All articles](https://anvilry.vercel.app/articles)",
      );
    });

    it("has no Writing section while articles are disabled, like the page", async () => {
      await load({ notes, articles: "false" });
      const { buildHomeMarkdown } = await import("@/lib/home-markdown");
      expect(buildHomeMarkdown()).not.toContain("## Writing");
    });
  },
);
