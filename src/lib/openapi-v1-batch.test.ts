import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BATCH_MAX_BODY_BYTES,
  BATCH_MAX_REQUESTS,
  BATCH_MAX_RESPONSE_BYTES,
  BATCH_PATH,
} from "@/lib/api-policy";
import {
  BATCH_MAX_ID_LENGTH,
  BATCH_MAX_PATH_LENGTH,
  BATCH_PATH_PATTERN,
} from "@/lib/batch";
import { POST } from "@/app/api/v1/batch/route";
import { validate, type JsonSchema } from "@/lib/json-schema-lite";
import { parseBatchBody } from "@/lib/batch";
import { buildOpenApiDocument, type OpenApiResponse } from "@/lib/openapi";
import { SITE_URL } from "@/lib/site-url";
import { buildV1Paths, V1_SCHEMAS } from "./openapi-v1";

type Json = Record<string, unknown>;

const paths = buildV1Paths();

describe("the batch operation", () => {
  const operation = paths[BATCH_PATH].post;
  const properties = (name: string) =>
    (V1_SCHEMAS[name].properties ?? {}) as Record<string, Json>;

  it("is runBatch, tagged API, with a summary and a description an agent can act on", () => {
    expect(operation.operationId).toBe("runBatch");
    expect(operation.tags).toEqual(["API"]);
    expect(operation.summary.length).toBeGreaterThan(8);
    expect(operation.summary.length).toBeLessThanOrEqual(80);
    const text = operation.description;
    expect(text).toContain(String(BATCH_MAX_REQUESTS));
    expect(text).toMatch(/all[- ]or[- ]nothing/i);
    expect(text).toMatch(/one request/i);
    expect(text).toContain("budget");
    expect(text).toContain("/api/v1/");
    expect(text).toMatch(/request order/i);
    for (const part of ["id", "path", "status", "body", "404", "500"]) {
      expect(text, part).toContain(part);
    }
  });

  it("takes every number it prints from the constants: the summary, the description, the request body and the schemas agree on the item limit", () => {
    const numbersIn = (text: string) => (text.match(/\d+/g) ?? []).map(Number);
    expect(operation.summary).toBe(`Run up to ${BATCH_MAX_REQUESTS} read-only operations in one request`);
    expect(numbersIn(operation.summary)).toEqual([BATCH_MAX_REQUESTS]);
    expect(numbersIn(operation.description)).toEqual(expect.arrayContaining([BATCH_MAX_REQUESTS, BATCH_MAX_BODY_BYTES, BATCH_MAX_RESPONSE_BYTES]));
    expect(numbersIn(operation.requestBody?.description ?? "")).toEqual(
      expect.arrayContaining([BATCH_MAX_REQUESTS, BATCH_MAX_BODY_BYTES]),
    );
    expect(JSON.stringify(V1_SCHEMAS.BatchRequest)).toContain(`"maxItems":${BATCH_MAX_REQUESTS}`);
    expect(JSON.stringify(V1_SCHEMAS.BatchRequest)).toContain(`${BATCH_MAX_REQUESTS} at most`);
  });

  it("states the answer cap, and that an over-cap batch is refused whole and never truncated", () => {
    const text = operation.description;
    expect(text).toContain(String(BATCH_MAX_RESPONSE_BYTES));
    expect(text).toMatch(/never truncat|not truncat|nothing is truncated/i);
    const tooLarge = (operation.responses["413"] as OpenApiResponse).description;
    expect(tooLarge).toContain(String(BATCH_MAX_BODY_BYTES));
    expect(tooLarge).toContain(String(BATCH_MAX_RESPONSE_BYTES));
    expect(tooLarge).toMatch(/response|answer/i);
  });

  it("takes a required JSON body described by BatchRequest", () => {
    expect(operation.requestBody).toMatchObject({
      required: true,
      content: {
        "application/json": { schema: { $ref: "#/components/schemas/BatchRequest" } },
      },
    });
    expect(operation.requestBody?.description.length).toBeGreaterThan(20);
  });

  it("answers 200 with BatchResponse and lists the errors a batch can raise, each typed as the shared Error", () => {
    const ok = operation.responses["200"] as OpenApiResponse;
    expect(ok.content?.["application/json"].schema).toEqual({
      $ref: "#/components/schemas/BatchResponse",
    });
    for (const status of ["400", "405", "413", "429", "500"]) {
      const response = operation.responses[status] as OpenApiResponse;
      expect(response.content?.["application/json"].schema, status).toEqual({
        $ref: "#/components/schemas/Error",
      });
    }
    expect((operation.responses["413"] as OpenApiResponse).description).toMatch(/too large/);
  });

  it("prints the limits the route enforces in its request schemas", () => {
    expect(properties("BatchRequest").requests).toMatchObject({
      type: "array",
      minItems: 1,
      maxItems: BATCH_MAX_REQUESTS,
      items: { $ref: "#/components/schemas/BatchRequestItem" },
    });
    expect(V1_SCHEMAS.BatchRequest.required).toEqual(["requests"]);
    const item = properties("BatchRequestItem");
    expect(V1_SCHEMAS.BatchRequestItem.required).toEqual(["id", "path"]);
    expect(item.id).toMatchObject({ type: "string", minLength: 1, maxLength: BATCH_MAX_ID_LENGTH });
    expect(item.method).toMatchObject({ type: "string", enum: ["GET"], default: "GET" });
    expect(item.path).toMatchObject({
      type: "string",
      minLength: 1,
      maxLength: BATCH_MAX_PATH_LENGTH,
      pattern: BATCH_PATH_PATTERN,
    });
    expect(V1_SCHEMAS.BatchRequestItem.additionalProperties).toBe(false);
    expect(V1_SCHEMAS.BatchRequest.additionalProperties).toBe(false);
  });

  it("states the body limit in the description of the request body or the 413", () => {
    const text = JSON.stringify(operation);
    expect(text).toContain(String(BATCH_MAX_BODY_BYTES));
  });

  it("describes each result with an id, a status and a body in the response schemas", () => {
    expect(V1_SCHEMAS.BatchResponse.required).toEqual(["responses"]);
    expect(properties("BatchResponse").responses).toMatchObject({
      type: "array",
      items: { $ref: "#/components/schemas/BatchResponseItem" },
    });
    expect(V1_SCHEMAS.BatchResponseItem.required).toEqual(["id", "status", "body"]);
    expect(Object.keys(properties("BatchResponseItem")).sort()).toEqual(["body", "id", "status"]);
    expect(properties("BatchResponseItem").body.type).toEqual(["object", "null"]);
  });
});

describe("the batch request example", () => {
  const media = paths[BATCH_PATH].post.requestBody?.content["application/json"] as
    | { schema: Json; example?: unknown }
    | undefined;
  const example = media?.example;

  beforeEach(() => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is carried on the request body media object, where /developers and llms.txt read it", () => {
    expect(example).toBeDefined();
    expect(media?.schema).toEqual({ $ref: "#/components/schemas/BatchRequest" });
  });

  it("is reachable in the served document at paths[BATCH_PATH].post.requestBody.content[application/json].example", () => {
    const served = buildOpenApiDocument().paths[BATCH_PATH].post.requestBody?.content[
      "application/json"
    ] as { example?: unknown };
    expect(served.example).toEqual(example);
  });

  it("is a complete body of the documented shape: a requests array of id and path, with an optional GET method", () => {
    const { requests } = example as { requests: { id: string; method?: string; path: string }[] };
    expect(Object.keys(example as object)).toEqual(["requests"]);
    expect(requests.length).toBeGreaterThanOrEqual(2);
    expect(requests.length).toBeLessThanOrEqual(BATCH_MAX_REQUESTS);
    for (const entry of requests) {
      expect(Object.keys(entry).every((key) => ["id", "method", "path"].includes(key))).toBe(true);
      expect(entry.path.startsWith("/api/v1/")).toBe(true);
    }
  });

  it("validates against the BatchRequest schema, strictly", () => {
    const schemas = V1_SCHEMAS as Record<string, JsonSchema>;
    const resolve = (ref: string) => schemas[ref.replace("#/components/schemas/", "")];
    expect(validate(example, { $ref: "#/components/schemas/BatchRequest" }, resolve, { rejectUndeclaredKeys: true })).toEqual([]);
  });

  it("passes the route's own validation and fits the body limit", () => {
    const text = JSON.stringify(example);
    expect(Buffer.byteLength(text)).toBeLessThan(BATCH_MAX_BODY_BYTES);
    expect(parseBatchBody(text).ok).toBe(true);
  });

  it("runs end to end: every operation of the example answers 200, in order", async () => {
    const res = await POST(
      new Request(`${SITE_URL}${BATCH_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(example),
      }),
    );
    expect(res.status).toBe(200);
    const { responses } = await res.json();
    const ids = (example as { requests: { id: string }[] }).requests.map((r) => r.id);
    expect(responses.map((r: { id: string }) => r.id)).toEqual(ids);
    expect(responses.map((r: { status: number }) => r.status)).toEqual(ids.map(() => 200));
  });
});

