import { describe, expect, it } from "vitest";
import { allArticles, allNotes, allProjects, allWork } from "@/lib/content";
import { CONTENT_KINDS, markdownForContent } from "./markdown-content";

/**
 * The Markdown twin of a content page is the MDX source with its frontmatter removed. Only slugs
 * that exist in the content layer may reach the filesystem, so a crafted slug can never read
 * another file.
 */

const collections = {
  projects: allProjects,
  work: allWork,
  articles: allArticles,
  notes: allNotes,
} as const;

describe("markdownForContent", () => {
  it("covers the four content kinds that have a Markdown twin", () => {
    expect([...CONTENT_KINDS].sort()).toEqual(["articles", "notes", "projects", "work"]);
  });

  it.each(CONTENT_KINDS)("serves an existing %s item as Markdown with its HTML page as canonical", async (kind) => {
    const item = collections[kind][0];
    if (!item) return; // a collection that is switched off (notes) has nothing to serve
    const res = markdownForContent(kind, item.slug);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("vary")).toBe("Accept");
    expect(res.headers.get("link")).toBe(`<https://anvilry.vercel.app/${kind}/${item.slug}>; rel="canonical"`);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(50);
    expect(body.startsWith("---")).toBe(false);
  });

  it("describes a cross-posted article, whose file is metadata only, instead of returning an empty page", async () => {
    const article = allArticles[0];
    if (!article) return;
    const body = await markdownForContent("articles", article.slug).text();
    expect(body.startsWith(`# ${article.title}`)).toBe(true);
    expect(body).toContain(article.summary);
    if (article.externalUrl) expect(body).toContain(article.externalUrl);
    expect(body).toContain(`Published ${article.date.slice(0, 10)}`);
  });

  it.each(CONTENT_KINDS)("answers an unknown %s slug with a Markdown 404 that links to llms.txt", async (kind) => {
    const res = markdownForContent(kind, "this-slug-does-not-exist");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    const body = await res.text();
    expect(body).toContain("https://anvilry.vercel.app/llms.txt");
    expect(body).toContain(`/${kind}/this-slug-does-not-exist`);
  });

  it("never reads outside the content folder for a traversal slug", async () => {
    const res = markdownForContent("projects", "../../package");
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).not.toContain('"name"');
    expect(body).not.toContain("dependencies");
  });
});
