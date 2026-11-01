import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArticleGroup } from "@/lib/article-grouping";
import type { Article } from "@/lib/content";
import { resolveCanonicalHref } from "./article-href";

/**
 * The one rule for where an article card on the homepage sends a visitor. The card
 * (article-group-card.tsx) and the homepage JSON-LD (json-ld-lists.tsx) both call it, so this is the
 * only place the rule is pinned. The flag is always passed explicitly: nothing here depends on a
 * default, because the Vercel build runs with NEXT_PUBLIC_NOTES_ENABLED=true and GitHub CI does not.
 */

const article = (over: Partial<Article>): Article =>
  ({
    slug: "a",
    title: "A",
    date: "2026-06-20T00:00:00.000Z",
    summary: "s",
    source: "devto",
    tags: [],
    draft: false,
    url: "/articles/a",
    ...over,
  }) as Article;

const group = (canonical: Partial<Article>, others: Partial<Article>[] = []): ArticleGroup => {
  const first = article(canonical);
  const rest = others.map((o, i) => article({ slug: `other-${i}`, url: `/articles/other-${i}`, ...o }));
  return { canonical: first, platforms: [first, ...rest], externalPlatforms: rest };
};

afterEach(() => vi.unstubAllEnvs());

describe("resolveCanonicalHref", () => {
  it("sends a cross-posted note to the on-site note while notes are enabled", () => {
    const g = group({ linkedNote: "how-dns-works", externalUrl: "https://dev.to/x/how-dns-works" });
    expect(resolveCanonicalHref(g, true)).toEqual({ href: "/notes/how-dns-works", external: false });
  });

  it("falls back to the canonical's own external URL while notes are disabled", () => {
    const g = group({ linkedNote: "how-dns-works", externalUrl: "https://dev.to/x/how-dns-works" });
    expect(resolveCanonicalHref(g, false)).toEqual({ href: "https://dev.to/x/how-dns-works", external: true });
  });

  it("uses the external URL of an article that has no linked note, whatever the flag says", () => {
    const g = group({ externalUrl: "https://medium.com/@x/p" });
    expect(resolveCanonicalHref(g, true)).toEqual({ href: "https://medium.com/@x/p", external: true });
    expect(resolveCanonicalHref(g, false)).toEqual({ href: "https://medium.com/@x/p", external: true });
  });

  it("uses the first syndicated copy that has a URL when the canonical has none", () => {
    const g = group({ source: "native" }, [{ source: "medium" }, { externalUrl: "https://dev.to/x/dns" }, { externalUrl: "https://hashnode.dev/dns" }]);
    expect(resolveCanonicalHref(g, false)).toEqual({ href: "https://dev.to/x/dns", external: true });
  });

  it("treats an empty external URL as missing, as the card always has", () => {
    const g = group({ externalUrl: "" }, [{ externalUrl: "https://dev.to/x/dns" }]);
    expect(resolveCanonicalHref(g, false)).toEqual({ href: "https://dev.to/x/dns", external: true });
  });

  it("ends at the on-site article page when nothing else exists", () => {
    const g = group({ source: "native", url: "/articles/native-one" });
    expect(resolveCanonicalHref(g, false)).toEqual({ href: "/articles/native-one", external: false });
    expect(resolveCanonicalHref(g, true)).toEqual({ href: "/articles/native-one", external: false });
  });

  it("follows NEXT_PUBLIC_NOTES_ENABLED when the flag is not passed", async () => {
    const g = group({ linkedNote: "n", externalUrl: "https://dev.to/x/n" });
    for (const [flag, expected] of [
      ["true", "/notes/n"],
      ["false", "https://dev.to/x/n"],
    ] as const) {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", flag);
      const { resolveCanonicalHref: resolve } = await import("./article-href");
      expect(resolve(g).href, flag).toBe(expected);
    }
  });
});
