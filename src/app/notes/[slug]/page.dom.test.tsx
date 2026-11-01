import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { scriptBodies } from "@/components/json-ld-lists-support";
import { profile } from "@/lib/profile";

/**
 * The note page's JSON-LD goes through the same hardened serialiser as every other block: a title or
 * summary that tries to end the script, open a comment or start another script is escaped, and
 * ordinary text is unchanged byte for byte. The page is rendered the way it is at build time, from
 * frontmatter, with only the content lookup and the MDX compiler replaced.
 *
 * Notes ship dark, so the flag is pinned in every test: `vi.resetModules()` + `vi.stubEnv()` + a
 * dynamic import. The Vercel build runs with NEXT_PUBLIC_NOTES_ENABLED=true, GitHub CI without it.
 */

const BASE = "https://anvilry.vercel.app";
const HOSTILE = "Why </script><!--<script> broke my\u2028page & more";
const RAW_SEQUENCES = ["</script", "<!--", "<script", "\u2028", "\u2029"];

interface NoteFixture {
  title: string;
  summary: string;
  tags: string[];
}

async function renderNote(notes: "true" | "false", fixture: NoteFixture): Promise<string> {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", notes);
  vi.stubEnv("NEXT_PUBLIC_ARTICLES_ENABLED", "true");
  const note = {
    slug: "fixture-note",
    date: "2026-06-19T00:00:00.000Z",
    draft: false,
    url: "/notes/fixture-note",
    ...fixture,
  };
  vi.doMock("@/lib/content", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/content")>()),
    getNote: (slug: string) => (slug === note.slug ? note : undefined),
  }));
  vi.doMock("@/lib/content-bodies", () => ({ getNoteBody: () => "" }));
  vi.doMock("@/components/mdx-content", () => ({ MDXContent: () => null }));
  const { default: NotePage } = await import("./page");
  return renderToStaticMarkup(await NotePage({ params: Promise.resolve({ slug: note.slug }) }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/content");
  vi.doUnmock("@/lib/content-bodies");
  vi.doUnmock("@/components/mdx-content");
});

describe("the note page JSON-LD", () => {
  it("leaves no raw script-breaking sequence in either block and parses back to the same data", async () => {
    const html = await renderNote("true", { title: HOSTILE, summary: HOSTILE, tags: [HOSTILE, "plain"] });
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
      url: `${BASE}/notes/fixture-note`,
      keywords: `${HOSTILE}, plain`,
      author: { "@type": "Person", name: profile.name, url: BASE },
    });
    expect(JSON.parse(bodies[1]).itemListElement.map((e: { name: string }) => e.name)).toEqual(["Home", "Writing", HOSTILE]);
  });

  it("writes ordinary text exactly as JSON.stringify would, so the content did not change", async () => {
    const html = await renderNote("true", { title: "How DNS works", summary: "A short summary.", tags: ["dns", "networking"] });
    const [note] = scriptBodies(html);

    expect(note).toBe(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: "How DNS works",
        description: "A short summary.",
        datePublished: "2026-06-19T00:00:00.000Z",
        url: `${BASE}/notes/fixture-note`,
        keywords: "dns, networking",
        author: { "@type": "Person", name: profile.name, url: BASE },
      }),
    );
  });

  it("is not rendered at all while notes are disabled, so no JSON-LD can be emitted for a 404", async () => {
    await expect(renderNote("false", { title: "x", summary: "y", tags: [] })).rejects.toThrow();
  });
});
