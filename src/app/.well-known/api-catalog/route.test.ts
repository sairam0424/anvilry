import { describe, expect, it } from "vitest";
import { API_CATALOG_CONTENT_TYPE, buildApiCatalog } from "@/lib/api-catalog";
import * as route from "./route";
import { GET } from "./route";

describe("GET /.well-known/api-catalog", () => {
  it("returns the catalog as application/linkset+json with the RFC 9727 profile", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(API_CATALOG_CONTENT_TYPE);
    expect(await res.json()).toEqual(buildApiCatalog());
  });

  it("exports GET only, so it stays prerendered (an extra POST or OPTIONS export would make it dynamic)", () => {
    expect(Object.keys(route)).toEqual(["GET"]);
  });
});
