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
 * Each page is loaded on first use so a fault in one cannot take the others down with it.
 */

const PROSE_PAGES = {
  contact: () => import("@/app/contact/page"),
  developers: () => import("@/app/developers/page"),
  mcp: () => import("@/app/mcp/page"),
  privacy: () => import("@/app/privacy/page"),
} satisfies Record<string, () => Promise<{ default: () => ReactNode }>>;

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
  const { default: Page } = await PROSE_PAGES[page]();
  const body = elementToMarkdown(Page(), {
    siteUrl: SITE_URL,
    pagePath: `/${page}`,
    callable: CALLABLE,
    sections: SECTIONS,
  });
  return joinParts([body, twinFooter(`/${page}`)]);
}
