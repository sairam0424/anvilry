import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /openapi.json", () => {
  it("serves the OpenAPI 3.1 document as JSON", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    const doc = await res.json();
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths).length).toBeGreaterThan(10);
  });

  it("is cacheable by shared caches", () => {
    expect(GET().headers.get("cache-control")).toContain("s-maxage");
  });
});
