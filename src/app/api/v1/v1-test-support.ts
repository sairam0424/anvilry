import { expect } from "vitest";
import { API_ERROR_CODES, type ApiErrorBody } from "@/lib/api-error";
import { validate, type JsonSchema } from "@/lib/json-schema-lite";
import {
  buildOpenApiDocument,
  type OpenApiOperation,
  type OpenApiResponse,
} from "@/lib/openapi";
import { buildV1Paths, V1_SCHEMAS } from "@/lib/openapi-v1";
import { SITE_URL } from "@/lib/site-url";

/**
 * Shared by v1-contract.test.ts and v1-behaviour.test.ts: the table of route modules, the OpenAPI
 * description the answers are checked against, and the helpers that call a handler the way Next 16
 * does (a Request plus a `params` promise). Not a test itself, and nothing at runtime imports it.
 */

type Handler = (
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) => Response | Promise<Response>;

export type RouteModule = Partial<
  Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS", Handler>
>;

/** Every documented path and the module that serves it. A new route without a row fails the coverage test. */
export const ROUTES: Record<string, () => Promise<RouteModule>> = {
  "/api/v1": () => import("./route"),
  "/api/v1/profile": () => import("./profile/route"),
  "/api/v1/work": () => import("./work/route"),
  "/api/v1/work/{slug}": () => import("./work/[slug]/route"),
  "/api/v1/projects": () => import("./projects/route"),
  "/api/v1/projects/{slug}": () => import("./projects/[slug]/route"),
  "/api/v1/articles": () => import("./articles/route"),
  "/api/v1/articles/{slug}": () => import("./articles/[slug]/route"),
  "/api/v1/notes": () => import("./notes/route"),
  "/api/v1/notes/{slug}": () => import("./notes/[slug]/route"),
  "/api/v1/decisions": () => import("./decisions/route"),
  "/api/v1/search": () => import("./search/route"),
  "/api/v1/resume": () => import("./resume/route"),
  "/api/v1/github/stats": () => import("./github/stats/route"),
};

/** Routes whose answer depends on the request, so they are dynamic and carry JSON 405 stubs. */
export const DYNAMIC_ROUTES = [
  "/api/v1/work/{slug}",
  "/api/v1/projects/{slug}",
  "/api/v1/articles/{slug}",
  "/api/v1/notes/{slug}",
  "/api/v1/decisions",
  "/api/v1/search",
  "/api/v1/github/stats",
];

export const v1Paths = buildV1Paths();

const schemas: Record<string, JsonSchema> = {
  ...buildOpenApiDocument().components.schemas,
  ...V1_SCHEMAS,
};

function resolveRef(ref: string): JsonSchema | undefined {
  const prefix = "#/components/schemas/";
  return ref.startsWith(prefix) ? schemas[ref.slice(prefix.length)] : undefined;
}

/** Strict: a key the route emits but the schema does not declare fails, so the spec cannot lag the code. */
export const check = (value: unknown, schema: JsonSchema) =>
  validate(value, schema, resolveRef, { rejectUndeclaredKeys: true });

function operationFor(path: string): OpenApiOperation {
  const operation = v1Paths[path]?.get;
  if (!operation) throw new Error(`${path} is not documented`);
  return operation;
}

export function successSchema(path: string): JsonSchema {
  const ok = operationFor(path).responses["200"] as OpenApiResponse;
  return ok.content!["application/json"].schema;
}

export const errorSchema: JsonSchema = { $ref: "#/components/schemas/Error" };

interface RouteInput {
  slug?: string;
  search?: string;
}

/** The request the OpenAPI document itself suggests: every path and query parameter that has an example. */
export function exampleInput(path: string): RouteInput {
  const parameters = operationFor(path).parameters ?? [];
  const slug = parameters.find((p) => p.in === "path")?.example;
  const query = parameters
    .filter((p) => p.in === "query" && p.example)
    .map((p) => `${p.name}=${encodeURIComponent(p.example!)}`)
    .join("&");
  return { slug, search: query ? `?${query}` : undefined };
}

export async function call(
  path: string,
  { slug = "", search = "" }: RouteInput = {},
): Promise<Response> {
  const mod = await ROUTES[path]();
  const url = `${SITE_URL}${path.replace("{slug}", encodeURIComponent(slug))}${search}`;
  return mod.GET!(new Request(url), { params: Promise.resolve({ slug }) });
}

/** Asserts a response is the shared JSON error with this status and code, and returns its body. */
export async function expectApiError(
  res: Response,
  status: number,
  code: string,
): Promise<ApiErrorBody> {
  expect(res.status).toBe(status);
  expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  const body = (await res.json()) as ApiErrorBody;
  expect(check(body, errorSchema)).toEqual([]);
  expect(API_ERROR_CODES.map((c) => c.code)).toContain(body.code);
  expect(body.code).toBe(code);
  expect(body.status).toBe(status);
  return body;
}
