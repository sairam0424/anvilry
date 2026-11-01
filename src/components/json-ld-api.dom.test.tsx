import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import DevelopersPage, {
  metadata as developersMeta,
} from "@/app/developers/page";
import McpPage, { metadata as mcpMeta } from "@/app/mcp/page";
import { buildApiCatalog } from "@/lib/api-catalog";
import { API_V1_BASE } from "@/lib/api-policy";
import { buildPageMarkdown } from "@/lib/page-markdown";
import { profile } from "@/lib/profile";
import { ORGANIZATION_ID } from "./json-ld";
import { DevelopersJsonLd, McpServerJsonLd } from "./json-ld-api";

/**
 * JSON-LD for the two pages that document machine interfaces. It describes only what those pages
 * say, and every claim here is pinned to the rendered page so the markup cannot drift from the text.
 *
 * No flag matters to these pages' JSON-LD; the suite is still run with NEXT_PUBLIC_NOTES_ENABLED
 * unset, true and false (see the report) because the pages read the content layer.
 */

const SITE = "https://anvilry.vercel.app";
const LD_SELECTOR = 'script[type="application/ld+json"]';
const MARKUP = /<[^>]+>|`|\*\*|\]\(|^#{1,6}\s/m;

type Ld = Record<string, unknown>;

const parseHtml = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

function ldBlocks(html: string): Ld[] {
  return [...parseHtml(html).querySelectorAll(LD_SELECTOR)].map((s) =>
    JSON.parse(s.textContent ?? "null"),
  );
}

const ofType = (blocks: Ld[], type: string) =>
  blocks.filter((b) => b["@type"] === type);

/** The real layout mounts TooltipProvider (providers.tsx); CopyButton needs it. */
const renderPage = (page: React.ReactElement) =>
  renderToStaticMarkup(<TooltipProvider>{page}</TooltipProvider>);

function visibleText(html: string): string {
  const doc = parseHtml(html);
  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function urlsIn(value: unknown): string[] {
  if (typeof value === "string")
    return /^https?:\/\//.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(urlsIn);
  if (value !== null && typeof value === "object")
    return Object.values(value).flatMap(urlsIn);
  return [];
}

describe("DevelopersJsonLd", () => {
  const blocks = ldBlocks(renderToStaticMarkup(<DevelopersJsonLd />));
  const [api] = ofType(blocks, "WebAPI");
  const [article] = ofType(blocks, "TechArticle");

  it("emits one WebAPI and one TechArticle, each valid JSON-LD with the schema.org context", () => {
    expect(blocks).toHaveLength(2);
    expect(api).toBeDefined();
    expect(article).toBeDefined();
    for (const block of blocks)
      expect(block["@context"]).toBe("https://schema.org");
  });

  it("names the API, points documentation at /developers and the url at the versioned base", () => {
    expect(api).toMatchObject({
      name: "Anvilry public API",
      url: `${SITE}${API_V1_BASE}`,
      documentation: `${SITE}/developers`,
      provider: { "@id": ORGANIZATION_ID },
    });
    expect(typeof api.description).toBe("string");
    expect((api.description as string).length).toBeGreaterThan(40);
    expect(api.description as string).not.toMatch(MARKUP);
  });

  it("has a stable @id the article can point at, and leaves out terms of service it does not have", () => {
    expect(api["@id"]).toBe(`${SITE}/developers#api`);
    expect("termsOfService" in api).toBe(false);
    expect(article.about).toEqual({ "@id": api["@id"] });
  });

  it("describes the page as a TechArticle that is about the API and published by the Organization", () => {
    expect(article).toMatchObject({
      url: `${SITE}/developers`,
      mainEntityOfPage: `${SITE}/developers`,
      inLanguage: "en",
      author: { "@type": "Person", name: profile.name, url: SITE },
      publisher: { "@id": ORGANIZATION_ID },
    });
    expect(article.description as string).not.toMatch(MARKUP);
  });

  it("does not invent a publication date it has no source for", () => {
    expect("datePublished" in article).toBe(false);
    expect("dateModified" in article).toBe(false);
  });

  it("uses absolute https URLs everywhere", () => {
    const urls = urlsIn(blocks);
    expect(urls.length).toBeGreaterThan(0);
    // Origins, not string prefixes: "https://schema.org.example" starts with "https://schema.org".
    const origins = [new URL(SITE).origin, "https://schema.org"];
    for (const url of urls)
      expect(origins).toContain(new URL(url).origin);
  });

  describe("on the rendered /developers page", () => {
    const html = renderPage(<DevelopersPage />);
    const pageBlocks = ldBlocks(html);
    const text = visibleText(html);

    it("is present in the page output, once per type", () => {
      expect(ofType(pageBlocks, "WebAPI")).toHaveLength(1);
      expect(ofType(pageBlocks, "TechArticle")).toHaveLength(1);
    });

    it("gives the TechArticle the headline of the page's one h1", () => {
      const h1 = parseHtml(html).querySelector("h1")?.textContent;
      expect(ofType(pageBlocks, "TechArticle")[0].headline).toBe(h1);
    });

    it("points at the same canonical address and API base the page shows", () => {
      expect(developersMeta.alternates?.canonical).toBe("/developers");
      expect(text).toContain(`${SITE}${API_V1_BASE}`);
      expect(text).toContain("openapi.json");
    });

    it("only claims what the page says", () => {
      const description = (
        ofType(pageBlocks, "WebAPI")[0].description as string
      ).toLowerCase();
      expect(description).toContain("read-only");
      expect(description).toContain("no api keys");
      expect(text.toLowerCase()).toContain("read-only");
      expect(text.toLowerCase()).toContain("no api keys");
      expect(text).toContain("OpenAPI 3.1");
    });

    it("keeps the JSON-LD out of the visible text and out of the Markdown twin", async () => {
      expect(text).not.toContain("schema.org");
      expect(text).not.toContain("TechArticle");
      const markdown = (await buildPageMarkdown("developers")) as string;
      expect(markdown).not.toContain("@context");
      expect(markdown).not.toContain("schema.org");
      expect(markdown).not.toContain("WebAPI");
    });
  });
});

describe("McpServerJsonLd", () => {
  const blocks = ldBlocks(renderToStaticMarkup(<McpServerJsonLd />));
  const [server] = blocks;

  it("emits a single WebAPI for the MCP server with the schema.org context", () => {
    expect(blocks).toHaveLength(1);
    expect(server["@context"]).toBe("https://schema.org");
    expect(server["@type"]).toBe("WebAPI");
    expect(server["@id"]).toBe(`${SITE}/mcp#server`);
  });

  it("names the server, points url at the endpoint and documentation at /mcp", () => {
    expect(server).toMatchObject({
      name: "Anvilry MCP server",
      url: `${SITE}/api/mcp/mcp`,
      documentation: `${SITE}/mcp`,
      provider: { "@id": ORGANIZATION_ID },
    });
    expect(server.description as string).not.toMatch(MARKUP);
    expect((server.description as string).length).toBeGreaterThan(40);
  });

  it("uses the same endpoint the API catalog advertises", () => {
    const catalog = buildApiCatalog();
    const advertised = catalog.linkset[0].item?.map((i) => i.href) ?? [];
    expect(advertised).toContain(server.url);
  });

  describe("on the rendered /mcp page", () => {
    const html = renderPage(<McpPage />);
    const pageBlocks = ldBlocks(html);
    const text = visibleText(html);

    it("is present in the page output", () => {
      expect(ofType(pageBlocks, "WebAPI")).toHaveLength(1);
    });

    it("matches the endpoint, the canonical path and the name the page shows", () => {
      const only = ofType(pageBlocks, "WebAPI")[0];
      expect(text).toContain(only.url as string);
      expect(mcpMeta.alternates?.canonical).toBe("/mcp");
      expect(String(mcpMeta.title)).toBe(only.name);
      expect(parseHtml(html).querySelector("h1")?.textContent).toContain(
        only.name as string,
      );
    });

    it("only claims what the page says", () => {
      const description = (
        ofType(pageBlocks, "WebAPI")[0].description as string
      ).toLowerCase();
      expect(description).toContain("model context protocol");
      expect(description).toContain("read-only");
      expect(text.toLowerCase()).toContain("model context protocol");
      expect(text.toLowerCase()).toContain("read-only");
    });

    it("keeps the JSON-LD out of the visible text and out of the Markdown twin", async () => {
      expect(text).not.toContain("schema.org");
      expect(text).not.toContain("WebAPI");
      const markdown = (await buildPageMarkdown("mcp")) as string;
      expect(markdown).not.toContain("@context");
      expect(markdown).not.toContain("schema.org");
      expect(markdown).not.toContain("WebAPI");
    });
  });
});
