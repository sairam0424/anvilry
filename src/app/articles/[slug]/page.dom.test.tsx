import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scriptBodies } from "@/components/json-ld-lists-support";
import { profile } from "@/lib/profile";

/**
 * The article page's JSON-LD goes through the same hardened serialiser as every other block: a title
 * or summary that tries to end the script, open a comment or start another script is escaped, and
 * ordinary text is unchanged byte for byte. The page is rendered the way it is at build time, from
 * frontmatter, with only the content lookup and the MDX compiler replaced.
 *
 * Flags are pinned in every test (the Vercel build runs with NEXT_PUBLIC_NOTES_ENABLED=true, GitHub
 * CI without it): `vi.resetModules()` + `vi.stubEnv()` + a dynamic import.
 */

const BASE = "https://anvilry.vercel.app";
const HOSTILE = "Why </script><!--<script> broke my\u2028page & more";
const RAW_SEQUENCES = ["</script", "<!--", "<script", "\u2028", "\u2029"];

interface ArticleFixture {
  title: string;
  summary: string;
  tags: string[];
}

async function renderArticle(notes: "true" | "false", fixture: ArticleFixture): Promise<string> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", notes);
  vi.stubEnv("NEXT_PUBLIC_ARTICLES_ENABLED", "true");
  const article = {
    slug: "fixture-article",
    date: "2026-06-19T00:00:00.000Z",
    source: "native",
    draft: false,
    url: "/articles/fixture-article",
    ...fixture,
  };
  vi.doMock("@/lib/content", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/content")>()),
    getArticle: (slug: string) => (slug === article.slug ? article : undefined),
  }));
  vi.doMock("@/lib/content-bodies", () => ({ getArticleBody: () => "" }));
  vi.doMock("@/components/mdx-content", () => ({ MDXContent: () => null }));
  const { default: ArticlePage } = await import("./page");
  return renderToStaticMarkup(await ArticlePage({ params: Promise.resolve({ slug: article.slug }) }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/content");
  vi.doUnmock("@/lib/content-bodies");
  vi.doUnmock("@/components/mdx-content");
});

describe.each(["true", "false"] as const)("the article page JSON-LD with NEXT_PUBLIC_NOTES_ENABLED=%s", (notes) => {
  it("leaves no raw script-breaking sequence in either block and parses back to the same data", async () => {
    const html = await renderArticle(notes, { title: HOSTILE, summary: HOSTILE, tags: [HOSTILE, "plain"] });
    const bodies = scriptBodies(html);

    expect(bodies).toHaveLength(2);
    expect(html.match(/<script/g)).toHaveLength(2);
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    for (const body of bodies) {
      expect(body).not.toMatch(/[<>&\u2028\u2029]/);
      for (const raw of RAW_SEQUENCES) expect(body, JSON.stringify(raw)).not.toContain(raw);
    }
    expect(JSON.parse(bodies[0])).toEqual({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: HOSTILE,
      description: HOSTILE,
      datePublished: "2026-06-19T00:00:00.000Z",
      url: `${BASE}/articles/fixture-article`,
      keywords: `${HOSTILE}, plain`,
      author: { "@type": "Person", name: profile.name, url: BASE },
    });
    expect(JSON.parse(bodies[1]).itemListElement.map((e: { name: string }) => e.name)).toEqual(["Home", "Articles", HOSTILE]);
  });

  it("writes ordinary text exactly as JSON.stringify would, so the content did not change", async () => {
    const html = await renderArticle(notes, { title: "How DNS works", summary: "A short summary.", tags: ["dns", "networking"] });
    const [article] = scriptBodies(html);

    expect(article).toBe(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: "How DNS works",
        description: "A short summary.",
        datePublished: "2026-06-19T00:00:00.000Z",
        url: `${BASE}/articles/fixture-article`,
        keywords: "dns, networking",
        author: { "@type": "Person", name: profile.name, url: BASE },
      }),
    );
  });
});
