import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import ContactPage from "@/app/contact/page";
import DevelopersPage from "@/app/developers/page";
import McpPage from "@/app/mcp/page";
import PrivacyPage from "@/app/privacy/page";
import { buildPageMarkdown } from "./page-markdown";
import type { PageTwin } from "./page-twins";

/**
 * The prose twins are made by walking the elements a page returns. This test renders the same page
 * to real HTML in a DOM and checks that nothing a visitor can read was lost on the way: every
 * heading, paragraph, list item, table cell and code block of the HTML must be in the twin, and
 * every link must point at the same place. If someone adds a component the converter does not
 * understand, the text it renders is missing from the twin and this test names it.
 */

const PAGES: [PageTwin, () => React.ReactElement][] = [
  ["contact", ContactPage],
  ["developers", DevelopersPage],
  ["mcp", McpPage],
  ["privacy", PrivacyPage],
];

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/** Markdown reduced to the words a reader sees: syntax, link targets and escapes removed. */
function visibleText(md: string): string {
  return collapse(
    md
      .replace(/^(`{3,})[^\n]*\n([\s\S]*?)\n\1$/gm, "$2")
      .replace(/!?\[((?:\\.|[^\]\\])*)\]\([^)]*\)/g, "$1")
      .replace(/\\([\\*[\]`<>#|.+)-])/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*(?:-|\d+\.)\s+/gm, "")
      .replace(/[`*]/g, "")
      .replace(/\|/g, " "),
  );
}

function parse(page: () => React.ReactElement): Document {
  // The real layout mounts TooltipProvider (providers.tsx); CopyButton needs it.
  const html = renderToStaticMarkup(
    <TooltipProvider>{page()}</TooltipProvider>,
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll(
      "script, style, svg, button, caption, [aria-hidden='true']",
    )
    .forEach((el) => el.remove());
  doc.querySelectorAll("header p.mono-label").forEach((el) => el.remove());
  return doc;
}

const leafTexts = (doc: Document, selector: string) =>
  [...doc.querySelectorAll(selector)]
    .filter((el) => el.querySelector("ul, ol, table, p, div") === null)
    .map((el) => collapse(el.textContent ?? ""))
    .filter((text) => text !== "");

describe.each(PAGES)(
  "the %s twin loses nothing the page shows",
  (name, Page) => {
    let text = "";
    let md = "";
    const doc = parse(Page);

    beforeAll(async () => {
      md = (await buildPageMarkdown(name)) as string;
      text = visibleText(md);
    });

    it("has every heading, paragraph, list item and table cell of the HTML", () => {
      const missing = leafTexts(doc, "h1, h2, h3, h4, p, li, th, td").filter(
        (t) => !text.includes(t),
      );
      expect(
        missing,
        `text in the ${name} page that its Markdown twin does not contain`,
      ).toEqual([]);
    });

    it("has every code block verbatim", () => {
      const blocks = [...doc.querySelectorAll("pre")].map((pre) =>
        (pre.textContent ?? "").trimEnd(),
      );
      for (const block of blocks)
        expect(md, block.slice(0, 40)).toContain(block);
    });

    it("links every anchor to the same place, as an absolute URL", () => {
      const wrong: string[] = [];
      for (const a of doc.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href") as string;
        const absolute = href.startsWith("/")
          ? `https://anvilry.vercel.app${href}`
          : href;
        if (!md.includes(`](${absolute})`))
          wrong.push(`${collapse(a.textContent ?? "")} -> ${absolute}`);
      }
      expect(wrong).toEqual([]);
    });

    it("has as many headings as the page", () => {
      const pageHeadings = doc.querySelectorAll("h1, h2, h3, h4").length;
      const twinHeadings = (
        md.replace(/^(`{3,}).*\n[\s\S]*?\n\1$/gm, "").match(/^#{1,4} /gm) ?? []
      ).length;
      expect(twinHeadings).toBe(pageHeadings);
    });
  },
);
