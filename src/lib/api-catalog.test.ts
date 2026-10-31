import { describe, expect, it } from "vitest";
import { API_V1_BASE } from "./api-policy";
import { API_CATALOG_CONTENT_TYPE, API_CATALOG_PATH, buildApiCatalog } from "./api-catalog";
import { SITE_URL } from "./site-url";

type Link = { href: string; type?: string };
type Context = { anchor: string; item?: Link[]; [rel: string]: unknown };

const catalog = buildApiCatalog();
const byAnchor = (anchor: string) => catalog.linkset.find((c) => c.anchor === anchor) as Context;

describe("RFC 9727 API catalog", () => {
  it("is served at the well-known path with the linkset media type and the RFC 9727 profile", () => {
    expect(API_CATALOG_PATH).toBe("/.well-known/api-catalog");
    expect(API_CATALOG_CONTENT_TYPE).toBe(
      'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
    );
  });

  it("lists every API as an item of the catalog itself", () => {
    const self = byAnchor(`${SITE_URL}${API_CATALOG_PATH}`);
    expect(self.item?.map((i) => i.href)).toEqual([`${SITE_URL}${API_V1_BASE}`, `${SITE_URL}/api/mcp/mcp`]);
  });

  it("describes the REST API with its OpenAPI document, its guide and a status resource", () => {
    const rest = byAnchor(`${SITE_URL}${API_V1_BASE}`);
    expect(rest["service-desc"]).toEqual([{ href: `${SITE_URL}/openapi.json`, type: "application/json" }]);
    expect(rest["service-doc"]).toEqual([{ href: `${SITE_URL}/developers`, type: "text/html" }]);
    expect(rest.status).toEqual([{ href: `${SITE_URL}${API_V1_BASE}`, type: "application/json" }]);
  });

  it("describes the MCP server by its guide", () => {
    const mcp = byAnchor(`${SITE_URL}/api/mcp/mcp`);
    expect(mcp["service-doc"]).toEqual([{ href: `${SITE_URL}/mcp`, type: "text/html" }]);
  });

  it("uses only absolute URLs, so the document means the same wherever it is copied", () => {
    const hrefs = JSON.stringify(catalog).match(/"(?:href|anchor)":"([^"]+)"/g) ?? [];
    expect(hrefs.length).toBeGreaterThan(5);
    for (const h of hrefs) expect(h).toMatch(/"https?:\/\//);
  });
});
