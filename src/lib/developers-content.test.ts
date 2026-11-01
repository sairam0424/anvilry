import { describe, expect, it } from "vitest";
import {
  API_V1_BASE,
  API_VERSION,
  BATCH_MAX_BODY_BYTES,
  BATCH_MAX_REQUESTS,
  BATCH_MAX_RESPONSE_BYTES,
  BATCH_PATH,
  RATE_LIMIT_POLICY,
} from "@/lib/api-policy";
import type {
  OpenApiDocument,
  OpenApiOperation,
  OpenApiParameter,
} from "@/lib/openapi";
import { parseBatchBody } from "@/lib/batch";
import { buildOpenApiDocument } from "@/lib/openapi";
import { SITE_URL } from "@/lib/site-url";
import {
  batchSemantics,
  batchSentence,
  buildBatchRecipe,
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

/**
 * The batch endpoint is part of the OpenAPI document, so the page prints its curl call from the
 * example that document carries for the request body (a Media Type Object `example`): the body is
 * written once, by the owner of the route. A document without that example is a bug and fails loudly.
 */
describe("the batch endpoint", () => {
  const example = { requests: [{ id: "a", path: `${API_V1_BASE}/profile` }, { id: "b", path: `${API_V1_BASE}/work` }] };

  function batchDoc(media: Record<string, unknown>): OpenApiDocument {
    const op: OpenApiOperation = {
      ...operation(),
      operationId: "runBatch",
      requestBody: { required: true, description: "d", content: { "application/json": { schema: {}, ...media } } },
    };
    return doc({ [BATCH_PATH]: { post: op } });
  }

  it("prints a curl call whose body is the example from the document, compact and shell-quoted", () => {
    expect(buildBatchRecipe(batchDoc({ example }))).toBe(
      [
        `curl -sS -X POST ${SITE_URL}${BATCH_PATH} \\`,
        "  -H 'Content-Type: application/json' \\",
        `  -d '${JSON.stringify(example)}'`,
      ].join("\n"),
    );
  });

  it("escapes a single quote inside the body so the command stays valid", () => {
    expect(buildBatchRecipe(batchDoc({ example: { q: "it's" } }))).toContain(`-d '{"q":"it'\\''s"}'`);
  });

  it("fails loudly, and never invents a body, when the document has no batch or no example for it", () => {
    expect(() => buildBatchRecipe(batchDoc({}))).toThrow(/example body for POST \/api\/v1\/batch/);
    expect(() => buildBatchRecipe(doc({ [`${API_V1_BASE}/work`]: { get: operation() } }))).toThrow(/POST/);
    expect(() => buildBatchRecipe(doc({ [BATCH_PATH]: { get: operation() } }))).toThrow(/POST/);
  });

  it("states the limits from api-policy.ts, as read-only operations", () => {
    const sentence = batchSentence();
    expect(sentence).toContain(`POST ${BATCH_PATH}`);
    expect(sentence).toContain(`${BATCH_MAX_REQUESTS} `);
    expect(sentence).toContain(BATCH_MAX_BODY_BYTES.toLocaleString("en-US"));
    expect(sentence).toMatch(/read-only/);
  });

  describe("semantics", () => {
    const text = batchSemantics();

    it("says the batch is validated whole before anything runs, with the statuses and the item named", () => {
      expect(text).toMatch(/checked as a whole before anything runs/);
      for (const reason of ["a malformed item", "a duplicate id", "a path outside /api/v1/", "a batch inside a batch"]) {
        expect(text, reason).toContain(reason);
      }
      expect(text).toContain("400 (413 for size)");
      expect(text).toMatch(/when an item is at fault, the hint names it/);
      expect(text).toMatch(/nothing runs/);
    });

    it("says a valid batch answers 200 with a result per item, in request order, each with its own status", () => {
      expect(text).toContain("always answers 200");
      expect(text).toMatch(/one result per item, in request order/);
      expect(text).toMatch(/id, status and body/);
      expect(text).toMatch(/404 inside the 200/);
    });

    it("says how it counts against the rate limit and what the response cap does, with the number from api-policy.ts", () => {
      expect(text).toMatch(/counts as one request against the rate limit however many operations it carries/);
      expect(text).toContain(`${BATCH_MAX_RESPONSE_BYTES.toLocaleString("en-US")} bytes`);
      expect(text).toMatch(/refused whole with 413/);
      expect(text).toMatch(/nothing is truncated/);
    });

    it("agrees with the route owner's description in the OpenAPI document on every number and status it states", () => {
      const description = buildOpenApiDocument().paths[BATCH_PATH].post.description;
      for (const fact of [String(BATCH_MAX_REQUESTS), String(BATCH_MAX_BODY_BYTES), String(BATCH_MAX_RESPONSE_BYTES), "413", "400", "404", "request order"]) {
        expect(description, fact).toContain(fact);
      }
    });
  });

  it("gives, for the real document, the example the route's owner documents, and the real parser accepts it", () => {
    const recipe = buildBatchRecipe(buildOpenApiDocument());
    const body = /-d '(.*)'$/.exec(recipe)?.[1] ?? "";
    const media = buildOpenApiDocument().paths[BATCH_PATH].post.requestBody?.content["application/json"] as {
      example?: unknown;
    };
    expect(media.example, "the batch operation must document an example body").toBeDefined();
    expect(JSON.parse(body)).toEqual(media.example);
    const parsed = parseBatchBody(body);
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (parsed.ok) {
      expect(parsed.items.length).toBeGreaterThan(0);
      expect(parsed.items.length).toBeLessThanOrEqual(BATCH_MAX_REQUESTS);
    }
  });
});
