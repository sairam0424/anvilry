import {
  authorPerson,
  JsonLdScript,
  ORGANIZATION_ID,
} from "@/components/json-ld";
import { API_V1_BASE, API_VERSION } from "@/lib/api-policy";
import { profile } from "@/lib/profile";
import { SITE_URL } from "@/lib/site-url";

/**
 * JSON-LD for the two pages that document a machine interface, so a search for the Anvilry API or
 * the Anvilry MCP server finds these pages and an agent can read what they offer without parsing
 * prose. Each entity says only what its page says; json-ld-api.dom.test.tsx renders the real pages
 * and compares. Nothing here is invented: there are no terms of service, so none are declared, and
 * there is no real publication date for either page, so no date is declared.
 */

const DEVELOPERS_URL = `${SITE_URL}/developers`;
const MCP_PAGE_URL = `${SITE_URL}/mcp`;
const MCP_ENDPOINT_URL = `${SITE_URL}/api/mcp/mcp`;
const PUBLIC_API_ID = `${DEVELOPERS_URL}#api`;

/** The headline of /developers: its one h1 (the page's test compares the two). */
const DEVELOPERS_HEADLINE = "Build on Anvilry: API documentation";

/** The public read-only API documented on /developers. */
export function publicApiEntity() {
  return {
    "@type": "WebAPI",
    "@id": PUBLIC_API_ID,
    name: "Anvilry public API",
    description: `A free, read-only API over ${profile.name}'s portfolio, version ${API_VERSION}, described by an OpenAPI 3.1 document. No API keys, no sign-up and no cost.`,
    url: `${SITE_URL}${API_V1_BASE}`,
    documentation: DEVELOPERS_URL,
    provider: { "@id": ORGANIZATION_ID },
  };
}

/** The /developers page itself, as a technical article about the API above. */
export function developersArticleEntity() {
  return {
    "@type": "TechArticle",
    "@id": `${DEVELOPERS_URL}#article`,
    headline: DEVELOPERS_HEADLINE,
    description:
      "Documentation for the Anvilry API: endpoints, versioning, rate limits, errors, Markdown content negotiation, the OpenAPI 3.1 description and the MCP server. Free and read-only, with no API keys.",
    url: DEVELOPERS_URL,
    mainEntityOfPage: DEVELOPERS_URL,
    inLanguage: "en",
    about: { "@id": PUBLIC_API_ID },
    author: authorPerson(),
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/** The MCP server documented on /mcp. */
export function mcpServerEntity() {
  return {
    "@type": "WebAPI",
    "@id": `${MCP_PAGE_URL}#server`,
    name: "Anvilry MCP server",
    description: `A read-only Model Context Protocol (MCP) server that answers from ${profile.name}'s real projects and résumé. Connect it to Claude Desktop or Cursor.`,
    url: MCP_ENDPOINT_URL,
    documentation: MCP_PAGE_URL,
    provider: { "@id": ORGANIZATION_ID },
  };
}

/** For /developers: the API and the article that documents it. */
export function DevelopersJsonLd() {
  return (
    <>
      <JsonLdScript data={publicApiEntity()} />
      <JsonLdScript data={developersArticleEntity()} />
    </>
  );
}

/** For /mcp: the MCP server. */
export function McpServerJsonLd() {
  return <JsonLdScript data={mcpServerEntity()} />;
}
