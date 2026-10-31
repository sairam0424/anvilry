import { API_V1_BASE } from "@/lib/api-policy";
import { SITE_URL } from "@/lib/site-url";

/**
 * The API catalog of RFC 9727: a Linkset (RFC 9264, application/linkset+json) served at a fixed
 * well-known path so an agent that knows nothing about this site can find its APIs, their
 * machine-readable descriptions and their documentation with one request. The homepage points
 * here with `Link: </.well-known/api-catalog>; rel="api-catalog"`.
 */

export const API_CATALOG_PATH = "/.well-known/api-catalog";
export const API_CATALOG_CONTENT_TYPE =
  'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"';

interface Link {
  href: string;
  type?: string;
}

interface LinksetContext {
  anchor: string;
  item?: Link[];
  "service-desc"?: Link[];
  "service-doc"?: Link[];
  status?: Link[];
}

export interface ApiCatalog {
  linkset: LinksetContext[];
}

export function buildApiCatalog(): ApiCatalog {
  const rest = `${SITE_URL}${API_V1_BASE}`;
  const mcp = `${SITE_URL}/api/mcp/mcp`;
  return {
    linkset: [
      { anchor: `${SITE_URL}${API_CATALOG_PATH}`, item: [{ href: rest }, { href: mcp }] },
      {
        anchor: rest,
        "service-desc": [{ href: `${SITE_URL}/openapi.json`, type: "application/json" }],
        "service-doc": [{ href: `${SITE_URL}/developers`, type: "text/html" }],
        // GET /api/v1 answers with the version, its status and the list of resources.
        status: [{ href: rest, type: "application/json" }],
      },
      {
        anchor: mcp,
        "service-doc": [{ href: `${SITE_URL}/mcp`, type: "text/html" }],
      },
    ],
  };
}
