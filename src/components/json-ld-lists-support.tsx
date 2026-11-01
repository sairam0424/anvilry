import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ArticleGroup } from "@/lib/article-grouping";
import type { Article } from "@/lib/content";

/**
 * Shared by json-ld-lists.dom.test.tsx and json-ld-articles.dom.test.tsx: renders the real
 * homepage sections and reads the JSON-LD back out of server HTML.
 *
 * Flags are pinned by `load()`, never inherited: the Vercel build runs the whole suite with
 * NEXT_PUBLIC_NOTES_ENABLED=true while GitHub CI leaves it unset, and which article a card links to
 * depends on it. `vi.resetModules()` + `vi.stubEnv()` + a dynamic import is the pattern this repo uses.
 */

export const SITE = "https://anvilry.vercel.app";
const LD_SELECTOR = 'script[type="application/ld+json"]';
export const MAX_HOME_ARTICLES = 2;

export interface ListItemLd {
  "@type": string;
  position: number;
  name: string;
  url: string;
  item: Record<string, unknown>;
}
export interface ItemListLd {
  "@context": string;
  "@type": string;
  "@id": string;
  name: string;
  numberOfItems: number;
  itemListElement: ListItemLd[];
}

export const parseHtml = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

function ldBlocks(html: string): Record<string, unknown>[] {
  return [...parseHtml(html).querySelectorAll(LD_SELECTOR)].map((s) =>
    JSON.parse(s.textContent ?? "null"),
  );
}

export const lists = (html: string) =>
  ldBlocks(html).filter(
    (b) => b["@type"] === "ItemList",
  ) as unknown as ItemListLd[];

const SCRIPT_BODY =
  /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

/** The text of each JSON-LD block as it sits in the HTML, which is what a browser tokenises. */
export const scriptBodies = (html: string): string[] =>
  [...html.matchAll(SCRIPT_BODY)].map((m) => m[1]);

/** An article group with one article, for the tests that need data the real content lacks. */
export function fixtureGroup(over: Partial<Article>): ArticleGroup {
  const canonical = {
    slug: "fixture",
    title: "Fixture",
    date: "2026-06-20T00:00:00.000Z",
    summary: "A summary",
    source: "devto",
    tags: [],
    draft: false,
    url: "/articles/fixture",
    ...over,
  } as Article;
  return { canonical, platforms: [canonical], externalPlatforms: [] };
}

export const absolute = (href: string) =>
  href.startsWith("/") ? `${SITE}${href}` : href;

export interface LoadFlags {
  notes: "true" | "false";
  articles?: "true" | "false";
}

export async function load({ notes, articles = "true" }: LoadFlags) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", notes);
  vi.stubEnv("NEXT_PUBLIC_ARTICLES_ENABLED", articles);
  const [
    ld,
    content,
    workSection,
    projectsSection,
    writingSection,
    homeArticles,
  ] = await Promise.all([
    import("./json-ld-lists"),
    import("@/lib/content"),
    import("@/components/home/featured-work"),
    import("@/components/home/featured-projects"),
    import("@/components/home/writing-preview"),
    import("@/lib/home-articles"),
  ]);
  return {
    ld,
    content,
    workSection,
    projectsSection,
    writingSection,
    homeArticles,
  };
}

/**
 * The homepage as the server renders it. The view switcher and the hero (which reads the active
 * view) need the real ViewProvider and the router. The switcher hides nothing from a crawler (the
 * Classic <main> is always rendered) and the hero holds none of the data the JSON-LD lists, so both
 * are replaced here; every section the lists are built from is the real one.
 */
export async function loadHomePage(flags: LoadFlags) {
  await load(flags);
  vi.doMock("@/components/view-router", () => ({
    ViewRouter: ({ children }: { children: ReactNode }) => <>{children}</>,
  }));
  vi.doMock("@/components/home/hero", () => ({ Hero: () => null }));
  const { default: Home } = await import("@/app/page");
  // The real layout mounts TooltipProvider (providers.tsx); the Stack section needs it.
  return () => renderToStaticMarkup(<TooltipProvider><Home /></TooltipProvider>);
}

// A markdown or HTML fragment in a field would be shown as plain text on the page and as noise in JSON-LD.
export const MARKUP = /<[^>]+>|`|\*\*|\]\(|^#{1,6}\s/m;
/** For afterEach: put back what `load()` and `loadHomePage()` stubbed and mocked. */
export function restoreListMocks() {
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/home-articles");
  vi.doUnmock("@/components/view-router");
  vi.doUnmock("@/components/home/hero");
}
