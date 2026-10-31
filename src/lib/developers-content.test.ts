import { describe, expect, it } from "vitest";
import { API_V1_BASE, API_VERSION, RATE_LIMIT_POLICY } from "@/lib/api-policy";
import type {
  OpenApiDocument,
  OpenApiOperation,
  OpenApiParameter,
} from "@/lib/openapi";
import { SITE_URL } from "@/lib/site-url";
import {
  buildCurlRecipes,
  deprecationSummary,
  RESPONSE_HEADERS,
} from "./developers-content";

/** The facts /developers states about the response headers and the curl recipes it prints. */

describe("RESPONSE_HEADERS", () => {
  it("documents the nine headers of the API contract, in the order a reader meets them", () => {
    expect(RESPONSE_HEADERS.map((h) => h.name)).toEqual([
      "RateLimit-Policy",
      "RateLimit",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
      "Retry-After",
      "API-Version",
      "Deprecation",
      "Sunset",
    ]);
  });

  it("takes every number from the published policy", () => {
    const text = RESPONSE_HEADERS.map((h) => `${h.sent} ${h.meaning}`).join(
      " ",
    );
    expect(text).toContain(
      `"${RATE_LIMIT_POLICY.name}";q=${RATE_LIMIT_POLICY.requests};w=${RATE_LIMIT_POLICY.windowSeconds}`,
    );
    expect(text).toContain(`${RATE_LIMIT_POLICY.requests} requests`);
    expect(text).toContain(`${RATE_LIMIT_POLICY.windowSeconds} seconds`);
    expect(text).toContain(`API-Version: ${API_VERSION}`);
  });

  it("says for each header when it is sent", () => {
    for (const header of RESPONSE_HEADERS) {
      expect(header.sent.length, header.name).toBeGreaterThan(3);
      expect(header.meaning.length, header.name).toBeGreaterThan(10);
    }
    const sent = Object.fromEntries(
      RESPONSE_HEADERS.map((h) => [h.name, h.sent]),
    );
    expect(sent["Retry-After"]).toMatch(/429/);
    expect(sent["Deprecation"]).toMatch(/deprecated/i);
    expect(sent["Sunset"]).toMatch(/deprecated/i);
  });
});

describe("deprecationSummary", () => {
  it("says so when nothing is deprecated", () => {
    expect(deprecationSummary([])).toBe(
      "No surface is deprecated today, so Deprecation and Sunset do not appear yet.",
    );
  });

  it("lists each deprecated surface with its dates and successor", () => {
    const text = deprecationSummary([
      {
        prefix: "/api/v1/old",
        deprecatedOn: "2027-01-01",
        sunsetOn: "2027-07-01",
        successor: "/api/v2/old",
      },
    ]);
    expect(text).toContain("/api/v1/old");
    expect(text).toContain("2027-01-01");
    expect(text).toContain("2027-07-01");
    expect(text).toContain("/api/v2/old");
  });
});

function operation(parameters: OpenApiParameter[] = []): OpenApiOperation {
  return {
    operationId: "op",
    summary: "s",
    description: "d",
    tags: [],
    parameters,
    responses: { default: { $ref: "#/components/responses/Error" } },
  };
}

const param = (over: Partial<OpenApiParameter>): OpenApiParameter => ({
  name: "p",
  in: "path",
  required: true,
  description: "d",
  schema: { type: "string" },
  ...over,
});

function doc(paths: OpenApiDocument["paths"]): OpenApiDocument {
  return { paths } as unknown as OpenApiDocument;
}

describe("buildCurlRecipes", () => {
  const recipes = buildCurlRecipes(
    doc({
      [`${API_V1_BASE}/projects`]: { get: operation() },
      [`${API_V1_BASE}/projects/{slug}`]: {
        get: operation([param({ name: "slug", example: "kelvran" })]),
      },
      [`${API_V1_BASE}/search`]: {
        get: operation([
          param({ name: "q", in: "query", example: "redis streams" }),
          param({ name: "limit", in: "query", required: false, example: "5" }),
        ]),
      },
      [`${API_V1_BASE}/decisions`]: {
        get: operation([
          param({ name: "tag", in: "query", required: false, example: "x" }),
        ]),
      },
      [`${API_V1_BASE}/needs-example/{id}`]: {
        get: operation([param({ name: "id" })]),
      },
      [`${API_V1_BASE}/enum/{kind}`]: {
        get: operation([
          param({ name: "kind", schema: { type: "string", enum: ["a", "b"] } }),
        ]),
      },
      [`${API_V1_BASE}/write`]: { post: operation() },
      "/api/resume.json": { get: operation() },
    }),
  );

  it("prints one curl line per readable v1 operation, filling parameters from their examples", () => {
    expect(recipes).toEqual([
      `curl -sS ${SITE_URL}${API_V1_BASE}/projects`,
      `curl -sS ${SITE_URL}${API_V1_BASE}/projects/kelvran`,
      `curl -sS '${SITE_URL}${API_V1_BASE}/search?q=redis%20streams'`,
      `curl -sS ${SITE_URL}${API_V1_BASE}/decisions`,
      `curl -sS ${SITE_URL}${API_V1_BASE}/enum/a`,
    ]);
  });

  it("skips what it cannot fill in, writes, and routes outside the versioned API", () => {
    const joined = recipes.join("\n");
    expect(joined).not.toContain("needs-example");
    expect(joined).not.toContain("/write");
    expect(joined).not.toContain("resume.json");
    expect(joined).not.toContain("limit=");
  });

  it("returns nothing for a document without versioned routes", () => {
    expect(
      buildCurlRecipes(doc({ "/openapi.json": { get: operation() } })),
    ).toEqual([]);
  });
});
