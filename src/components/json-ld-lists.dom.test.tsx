import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  absolute,
  load,
  loadHomePage,
  lists,
  MARKUP,
  parseHtml,
  restoreListMocks,
  scriptBodies,
  SITE,
} from "./json-ld-lists-support";

/**
 * The homepage JSON-LD lists for production work and open-source projects are tied to the sections
 * that render the same data. Every test here renders the real section to server HTML (what a crawler
 * gets) and compares it with the JSON-LD, so a list can neither name an item the page does not show
 * nor drop one it does. The articles list is in json-ld-articles.dom.test.tsx. Flags are pinned by
 * `load()`; see json-ld-lists-support.tsx.
 */

afterEach(restoreListMocks);


describe.each(["true", "false"] as const)(
  "homepage JSON-LD lists with NEXT_PUBLIC_NOTES_ENABLED=%s",
  (notes) => {
    describe("flagship production work", () => {
      it("is an ItemList whose entries are the cards FeaturedWork renders, in order", async () => {
        const { ld, content, workSection } = await load({ notes });
        const html = renderToStaticMarkup(<ld.FeaturedWorkJsonLd />);
        const [list] = lists(html);
        expect(lists(html)).toHaveLength(1);

        const section = parseHtml(
          renderToStaticMarkup(workSection.FeaturedWork()),
        );
        const cardNames = [...section.querySelectorAll("h3")].map(
          (h) => h.textContent,
        );
        const cardHrefs = [
          ...section.querySelectorAll("a[href^='/work/']"),
        ].map((a) => absolute(a.getAttribute("href") ?? ""));
        const sectionTitle = section.querySelector("h2")?.textContent;

        expect(list["@context"]).toBe("https://schema.org");
        expect(list["@type"]).toBe("ItemList");
        expect(list.name).toBe(sectionTitle);
        expect(list.numberOfItems).toBe(content.allWork.length);
        expect(list.itemListElement).toHaveLength(content.allWork.length);
        expect(list.itemListElement.map((e) => e.name)).toEqual(cardNames);
        expect(list.itemListElement.map((e) => e.url)).toEqual(cardHrefs);
        expect(list.itemListElement.map((e) => e.position)).toEqual(
          content.allWork.map((_, i) => i + 1),
        );
      });

      it("describes each entry as a CreativeWork carrying the summary the card shows", async () => {
        const { ld, content, workSection } = await load({ notes });
        const [list] = lists(renderToStaticMarkup(<ld.FeaturedWorkJsonLd />));
        const rendered = parseHtml(
          renderToStaticMarkup(workSection.FeaturedWork()),
        );
        const cardSummaries = [
          ...rendered.querySelectorAll("a[href^='/work/'] > p.text-fg-muted"),
        ].map((p) => p.textContent);

        list.itemListElement.forEach((entry, i) => {
          const work = content.allWork[i];
          expect(entry["@type"]).toBe("ListItem");
          expect(entry.item).toMatchObject({
            "@type": "CreativeWork",
            name: work.name,
            description: work.summary,
            url: `${SITE}${work.url}`,
          });
          expect(entry.item.description).toBe(cardSummaries[i]);
        });
      });

      it("credits the owner as a contributor, not the sole author, of co-built work", async () => {
        const { ld } = await load({ notes });
        const [list] = lists(renderToStaticMarkup(<ld.FeaturedWorkJsonLd />));
        for (const { item } of list.itemListElement) {
          expect(item.contributor).toMatchObject({
            "@type": "Person",
            url: SITE,
          });
          expect("author" in item).toBe(false);
        }
      });

      it("emits nothing when there is no work to list", async () => {
        const { ld } = await load({ notes });
        expect(ld.featuredWorkItemList([]).numberOfItems).toBe(0);
      });
    });

    describe("featured open-source projects", () => {
      it("is an ItemList whose entries are the project cards FeaturedProjects renders, in order", async () => {
        const { ld, content, projectsSection } = await load({ notes });
        const html = renderToStaticMarkup(<ld.FeaturedProjectsJsonLd />);
        const [list] = lists(html);
        expect(lists(html)).toHaveLength(1);

        const section = parseHtml(
          renderToStaticMarkup(projectsSection.FeaturedProjects()),
        );
        const cardLinks = [
          ...section.querySelectorAll("a[href^='/projects/']"),
        ].filter((a) => !(a.textContent ?? "").trim().startsWith("Details"));

        expect(list.name).toBe(section.querySelector("h2")?.textContent);
        expect(list.numberOfItems).toBe(content.featuredProjects.length);
        expect(list.itemListElement.map((e) => e.name)).toEqual(
          cardLinks.map((a) => a.textContent),
        );
        expect(list.itemListElement.map((e) => e.url)).toEqual(
          cardLinks.map((a) => absolute(a.getAttribute("href") ?? "")),
        );
        expect(list.itemListElement.map((e) => e.position)).toEqual(
          content.featuredProjects.map((_, i) => i + 1),
        );
      });

      it("types each entry SoftwareSourceCode with the tagline the card shows", async () => {
        const { ld, content, projectsSection } = await load({ notes });
        const [list] = lists(
          renderToStaticMarkup(<ld.FeaturedProjectsJsonLd />),
        );
        const rendered = parseHtml(
          renderToStaticMarkup(projectsSection.FeaturedProjects()),
        );
        const taglines = [
          ...rendered.querySelectorAll(".card-surface > p.text-fg-muted"),
        ].map((p) => p.textContent);

        list.itemListElement.forEach((entry, i) => {
          const project = content.featuredProjects[i];
          expect(entry.item).toMatchObject({
            "@type": "SoftwareSourceCode",
            name: project.name,
            description: project.tagline,
            url: `${SITE}${project.url}`,
          });
          expect(entry.item.description).toBe(taglines[i]);
          expect(typeof entry.item.keywords).toBe("string");
        });
      });

      it("lists a repository exactly where the card links to one, and keeps programmingLanguage to real languages", async () => {
        const { ld, content, projectsSection } = await load({ notes });
        const [list] = lists(
          renderToStaticMarkup(<ld.FeaturedProjectsJsonLd />),
        );
        const rendered = parseHtml(
          renderToStaticMarkup(projectsSection.FeaturedProjects()),
        );
        const githubLinks = [
          ...rendered.querySelectorAll("a[aria-label$=' on GitHub']"),
        ].map((a) => a.getAttribute("href"));
        const declared = list.itemListElement
          .map((e) => e.item.codeRepository)
          .filter(Boolean);

        expect(declared).toEqual(githubLinks);
        for (const [i, entry] of list.itemListElement.entries()) {
          const languages = (entry.item.programmingLanguage ?? []) as string[];
          for (const language of languages)
            expect(content.featuredProjects[i].tech).toContain(language);
          expect(languages).not.toContain("MCP");
          expect(languages).not.toContain("Docker");
        }
      });

      it("gives each project the creation date and license its page gives it, and none it does not have", async () => {
        const { ld, content } = await load({ notes });
        const [list] = lists(
          renderToStaticMarkup(<ld.FeaturedProjectsJsonLd />),
        );

        list.itemListElement.forEach((entry, i) => {
          const project = content.featuredProjects[i];
          if (project.dateCreated)
            expect(entry.item.dateCreated, project.slug).toBe(project.dateCreated);
          else expect("dateCreated" in entry.item, project.slug).toBe(false);
          if (project.license)
            expect(entry.item.license, project.slug).toBe(
              `https://spdx.org/licenses/${project.license}.html`,
            );
          else expect("license" in entry.item, project.slug).toBe(false);
        });
        expect(list.itemListElement.some((e) => "license" in e.item)).toBe(true);
      });

      it("never emits the URL of a private repository", async () => {
        const { ld, content } = await load({ notes });
        const base = content.featuredProjects[0];
        const privateRepo = "https://github.com/someone/secret-repo";
        const list = ld.featuredProjectsItemList([
          { ...base, visibility: "private", repo: privateRepo },
          {
            ...base,
            slug: "open-one",
            url: "/projects/open-one",
            name: "Open one",
            visibility: "public",
            repo: "https://github.com/someone/open-one",
          },
        ]);
        const [hidden, shown] = list.itemListElement;

        expect("codeRepository" in hidden.item).toBe(false);
        expect(shown.item.codeRepository).toBe(
          "https://github.com/someone/open-one",
        );
        expect(JSON.stringify(list)).not.toContain(privateRepo);
      });
    });

    describe("every homepage list", () => {
      it("is valid JSON, absolute, plain text and free of duplicate entries", async () => {
        const { ld } = await load({ notes });
        const html = renderToStaticMarkup(
          <>
            <ld.FeaturedWorkJsonLd />
            <ld.FeaturedProjectsJsonLd />
            <ld.LatestArticlesJsonLd />
          </>,
        );
        const found = lists(html);
        expect(found).toHaveLength(3);
        expect(new Set(found.map((l) => l["@id"])).size).toBe(3);

        for (const list of found) {
          expect(list["@id"].startsWith(`${SITE}/#`)).toBe(true);
          expect(new Set(list.itemListElement.map((e) => e.url)).size).toBe(
            list.itemListElement.length,
          );
          expect(new Set(list.itemListElement.map((e) => e.name)).size).toBe(
            list.itemListElement.length,
          );
          for (const entry of list.itemListElement) {
            expect(() => new URL(entry.url)).not.toThrow();
            expect(entry.url.startsWith("https://")).toBe(true);
            for (const text of [
              entry.name,
              entry.item.description,
              entry.item.headline,
            ].filter(Boolean) as string[]) {
              expect(text, `${list.name}: ${text}`).not.toMatch(MARKUP);
              expect(text, text).toBe(text.trim());
            }
          }
        }
        // One closing tag per block: no text in the data can end a script early.
      expect(html.match(/<\/script>/g)).toHaveLength(3);
        for (const body of scriptBodies(html))
          expect(body).not.toMatch(/[<>&\u2028\u2029]/);
      });
    });
  },
);

describe("the homepage", () => {
  it.each([
    ["notes on, articles on", { notes: "true", articles: "true" }, 3],
    ["notes off, articles on", { notes: "false", articles: "true" }, 3],
    ["articles off", { notes: "false", articles: "false" }, 2],
  ] as const)(
    "carries its JSON-LD lists in the rendered page (%s)",
    async (_label, flags, expectedLists) => {
      const renderHome = await loadHomePage(flags);
      const found = lists(renderHome());

      expect(found).toHaveLength(expectedLists);
      expect(found.map((l) => l["@id"])).toEqual(
        [
          `${SITE}/#production-work`,
          `${SITE}/#open-source-projects`,
          `${SITE}/#latest-articles`,
        ].slice(0, expectedLists),
      );
    },
  );

  it("keeps the JSON-LD out of the visible page text and out of the Markdown twin", async () => {
    const renderHome = await loadHomePage({ notes: "false" });
    const doc = parseHtml(renderHome());
    doc.querySelectorAll("script").forEach((s) => s.remove());
    expect(doc.body.textContent).not.toContain("schema.org");
    expect(doc.body.textContent).not.toContain("ItemList");

    const { buildHomeMarkdown } = await import("@/lib/home-markdown");
    const markdown = buildHomeMarkdown();
    expect(markdown).not.toContain("@context");
    expect(markdown).not.toContain("application/ld+json");
  });
});
