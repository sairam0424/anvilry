import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stripTrackingParams } from "@/lib/strip-tracking-params";
import { JsonLdScript } from "./json-ld";
import {
  absolute,
  fixtureGroup,
  load,
  lists,
  MAX_HOME_ARTICLES,
  parseHtml,
  restoreListMocks,
  scriptBodies,
  SITE,
} from "./json-ld-lists-support";

/**
 * The "Latest articles" JSON-LD list, tied to the cards WritingPreview renders. Which article a card
 * links to depends on NEXT_PUBLIC_NOTES_ENABLED, so every test runs under both settings, and the
 * flags are pinned by `load()`; see json-ld-lists-support.tsx.
 */

afterEach(restoreListMocks);

describe.each(["true", "false"] as const)(
  "homepage JSON-LD article list with NEXT_PUBLIC_NOTES_ENABLED=%s",
  (notes) => {
    describe("latest articles", () => {
      it("is an ItemList whose entries are the cards WritingPreview renders: same articles, order and links", async () => {
        const { ld, writingSection } = await load({ notes });
        const html = renderToStaticMarkup(<ld.LatestArticlesJsonLd />);
        const [list] = lists(html);
        expect(lists(html)).toHaveLength(1);

        const section = parseHtml(
          renderToStaticMarkup(writingSection.WritingPreview()),
        );
        const cardTitles = [...section.querySelectorAll("h3")].map(
          (h) => h.textContent,
        );
        // The card links to the article as the author wrote the URL; the JSON-LD names the same
        // address without its tracking parameters.
        const cardHrefs = [...section.querySelectorAll(".card-surface a")].map(
          (a) => stripTrackingParams(absolute(a.getAttribute("href") ?? "")),
        );

        expect(list.name).toBe(section.querySelector("h2")?.textContent);
        expect(list.numberOfItems).toBe(cardTitles.length);
        expect(list.numberOfItems).toBeGreaterThan(0);
        expect(list.numberOfItems).toBeLessThanOrEqual(MAX_HOME_ARTICLES);
        expect(list.itemListElement.map((e) => e.name)).toEqual(cardTitles);
        expect(list.itemListElement.map((e) => e.url)).toEqual(cardHrefs);
      });

      it("types each entry BlogPosting with the headline, summary and date of the article", async () => {
        const { ld, homeArticles, writingSection } = await load({ notes });
        const [list] = lists(renderToStaticMarkup(<ld.LatestArticlesJsonLd />));
        const rendered = parseHtml(
          renderToStaticMarkup(writingSection.WritingPreview()),
        );
        const cardSummaries = [
          ...rendered.querySelectorAll(".card-surface p"),
        ].map((p) => p.textContent);

        homeArticles.homeArticleGroups().forEach(({ canonical }, i) => {
          const entry = list.itemListElement[i];
          expect(entry.item).toMatchObject({
            "@type": "BlogPosting",
            headline: canonical.title,
            description: canonical.summary,
            datePublished: canonical.date,
            author: { "@type": "Person", url: SITE },
          });
          expect(entry.item.url).toBe(entry.url);
          expect(entry.item.description).toBe(cardSummaries[i]);
          expect(
            Number.isNaN(Date.parse(entry.item.datePublished as string)),
          ).toBe(false);
        });
      });

      it("leaves the card's own link as the author wrote it while the JSON-LD URL carries no tracking parameter", async () => {
        const { ld, homeArticles, writingSection } = await load({ notes });
        const { resolveCanonicalHref } = await import("@/lib/article-href");
        const [list] = lists(renderToStaticMarkup(<ld.LatestArticlesJsonLd />));
        const section = parseHtml(
          renderToStaticMarkup(writingSection.WritingPreview()),
        );
        const visible = [...section.querySelectorAll(".card-surface a")].map(
          (a) => a.getAttribute("href"),
        );

        expect(visible).toEqual(
          homeArticles
            .homeArticleGroups()
            .map((group) => resolveCanonicalHref(group).href),
        );
        for (const { url } of list.itemListElement) {
          const names = [...new URL(url).searchParams.keys()].map((n) =>
            n.toLowerCase(),
          );
          expect(names.filter((n) => n.startsWith("utm_") || n === "r" || n === "showwelcomeonshare"), url).toEqual([]);
        }
      });

      it("names an article by its address without tracking parameters, and keeps the other parameters", async () => {
        const { ld } = await load({ notes });
        const list = ld.latestArticlesItemList([
          fixtureGroup({
            externalUrl:
              "https://open.substack.com/pub/o/p/slug?r=2xzeyx&id=7&utm_campaign=post&showWelcomeOnShare=true",
          }),
        ]);
        const [entry] = list.itemListElement;

        expect(entry.url).toBe("https://open.substack.com/pub/o/p/slug?id=7");
        expect(entry.item.url).toBe(entry.url);
      });

      it("stays valid when a title tries to end the script, open a comment or start another script", async () => {
        const { ld } = await load({ notes });
        const hostile = "Why </script><!--<script> broke\u2028my page";
        const list = ld.latestArticlesItemList([
          fixtureGroup({ title: hostile, summary: hostile }),
        ]);
        const html = renderToStaticMarkup(
          <>
            <JsonLdScript data={list} />
            <JsonLdScript data={{ "@type": "Thing", name: "next block" }} />
          </>,
        );
        const bodies = scriptBodies(html);

        expect(bodies).toHaveLength(2);
        for (const body of bodies) {
          expect(body).not.toMatch(/[<>&\u2028\u2029]/);
          for (const raw of ["</script", "<!--", "<script", "\u2028", "\u2029"])
            expect(body, JSON.stringify(raw)).not.toContain(raw);
        }
        expect(JSON.parse(bodies[0]).itemListElement[0].item.headline).toBe(hostile);
        expect(html.match(/<\/script>/g)).toHaveLength(2);
        expect(html).not.toContain("<!--");
      });

      it("is rendered when articles are enabled and absent when they are disabled", async () => {
        const on = await load({ notes, articles: "true" });
        expect(
          lists(renderToStaticMarkup(<on.ld.LatestArticlesJsonLd />)),
        ).toHaveLength(1);

        const off = await load({ notes, articles: "false" });
        expect(renderToStaticMarkup(<off.ld.LatestArticlesJsonLd />)).toBe("");
        // The section itself renders nothing in this state, which is the reason for the rule.
        expect(
          renderToStaticMarkup(off.writingSection.WritingPreview() ?? <></>),
        ).toBe("");
      });

      it("is absent when the section has no articles to show", async () => {
        vi.resetModules();
        vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", notes);
        vi.stubEnv("NEXT_PUBLIC_ARTICLES_ENABLED", "true");
        vi.doMock("@/lib/home-articles", () => ({
          homeArticleGroups: () => [],
        }));
        const ld = await import("./json-ld-lists");
        expect(renderToStaticMarkup(<ld.LatestArticlesJsonLd />)).toBe("");
      });

      it("links a cross-posted article to the on-site note only while notes are enabled", async () => {
        const { ld, homeArticles } = await load({ notes });
        const [list] = lists(renderToStaticMarkup(<ld.LatestArticlesJsonLd />));
        homeArticles.homeArticleGroups().forEach(({ canonical }, i) => {
          const url = list.itemListElement[i].url;
          if (canonical.linkedNote && notes === "true")
            expect(url).toBe(`${SITE}/notes/${canonical.linkedNote}`);
          else expect(url).not.toContain("/notes/");
        });
      });
    });

  },
);
