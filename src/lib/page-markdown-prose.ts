import type { ReactNode } from "react";
import {
  CodeBlock,
  InlineCode,
  ProseH2,
  ProseList,
  ProseP,
} from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { elementToMarkdown } from "@/lib/element-markdown";
import { joinParts, twinFooter } from "@/lib/page-markdown-shared";
import { SITE_URL } from "@/lib/site-url";

/**
 * The Markdown twins of the pages that are prose, tables and code: contact, developers, mcp and
 * privacy. The twin is the page itself: its component is called and the elements it returns are
 * converted (element-markdown.ts), so the text, the tables and the numbers (which the page takes
 * from PRIVACY_FACTS, the OpenAPI document and the API policy) cannot differ from what a browser
 * shows. The privacy text in particular is never retyped.
 *
 * Each page is loaded on first use so a fault in one cannot take the others down with it. A page
 * built from its own section components (the developer guide) hands them over with it: the
 * converter calls the components it is told about and reads through all the others, so a section
 * that was not handed over would silently disappear from the twin.
 */

interface ProsePageLoad {
  Page: () => ReactNode;
  /** Pure components the page is built from, beyond the shared prose ones. */
  components: readonly unknown[];
}

const loadPage = async (page: Promise<{ default: () => ReactNode }>): Promise<ProsePageLoad> => ({
  Page: (await page).default,
  components: [],
});

const PROSE_PAGES = {
  contact: () => loadPage(import("@/app/contact/page")),
  developers: async (): Promise<ProsePageLoad> => {
    const [{ default: Page }, sections] = await Promise.all([
      import("@/app/developers/page"),
      import("@/app/developers/sections"),
    ]);
    return { Page, components: Object.values(sections) };
  },
  mcp: () => loadPage(import("@/app/mcp/page")),
  privacy: () => loadPage(import("@/app/privacy/page")),
} satisfies Record<string, () => Promise<ProsePageLoad>>;

export type ProsePage = keyof typeof PROSE_PAGES;

/** Components that are pure functions of their props, so the converter may call them. */
const CALLABLE = new Set<unknown>([
  ProseH2,
  ProseP,
  ProseList,
  InlineCode,
  CodeBlock,
]);
const SECTIONS = new Set<unknown>([Section]);

/** Throws when the page cannot be converted; the route turns that into the shared JSON error. */
export async function renderProseMarkdown(page: ProsePage): Promise<string> {
  const { Page, components } = await PROSE_PAGES[page]();
  const body = elementToMarkdown(Page(), {
    siteUrl: SITE_URL,
    pagePath: `/${page}`,
    callable: new Set<unknown>([...CALLABLE, ...components]),
    sections: SECTIONS,
  });
  return joinParts([body, twinFooter(`/${page}`)]);
}
