import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_VERSION_HEADER } from "@/lib/api-policy";
import { SLUG_PATTERN, V1_RESOURCES } from "@/lib/content-api";
import { allArticles, allProjects, allWork } from "@/lib/content";
import {
  buildOpenApiDocument,
  listOperations,
  type OpenApiOperation,
  type OpenApiResponse,
} from "@/lib/openapi";
import { buildV1Paths, V1_SCHEMAS, V1_TAGS } from "./openapi-v1";

const paths = buildV1Paths();
const operations = Object.entries(paths).flatMap(([path, item]) =>
  Object.entries(item).map(([method, operation]) => ({
    path,
    method,
    operation,
  })),
);
const document = buildOpenApiDocument();

type Json = Record<string, unknown>;

const ITEM_PATHS = operations
  .map((o) => o.path)
  .filter((p) => p.endsWith("/{slug}"));
const INPUT_PATHS = [...ITEM_PATHS, "/api/v1/decisions", "/api/v1/search"];

function routeFile(path: string): string {
  const dir = path.replace("{slug}", "[slug]");
  return join(process.cwd(), "src/app", dir, "route.ts");
}

function collectRefs(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => collectRefs(n, found));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") found.push(value);
      else collectRefs(value, found);
    }
  }
  return found;
}

const knownSchemas = {
  ...document.components.schemas,
  ...V1_SCHEMAS,
} as Record<string, Json>;

describe("buildV1Paths", () => {
  it("documents exactly the routes that exist: the index, each resource and each item route", () => {
    const expected = [
      "/api/v1",
      ...Object.values(V1_RESOURCES),
      "/api/v1/work/{slug}",
      "/api/v1/projects/{slug}",
      "/api/v1/articles/{slug}",
      "/api/v1/notes/{slug}",
    ];
    expect(Object.keys(paths).sort()).toEqual(expected.sort());
  });

  it("documents only GET", () => {
    for (const { path, method } of operations) expect(method, path).toBe("get");
  });

  it("points every path at a route file that exists", () => {
    for (const { path } of operations)
      expect(existsSync(routeFile(path)), `${path} -> ${routeFile(path)}`).toBe(
        true,
      );
  });

  it("gives every operation a unique, well-formed operationId that no other operation in the document uses", () => {
    const ids = operations.map((o) => o.operation.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][A-Za-z0-9]{2,62}$/);
    const others = listOperations(document).filter((o) => !(o.path in paths));
    for (const other of others)
      expect(ids, other.operation.operationId).not.toContain(
        other.operation.operationId,
      );
  });

  it("describes every operation well enough to become a tool definition", () => {
    for (const { path, operation } of operations) {
      expect(operation.summary.length, path).toBeGreaterThan(8);
      expect(operation.summary.length, path).toBeLessThanOrEqual(80);
      expect(operation.description.length, path).toBeGreaterThan(60);
      expect(operation.tags.length, path).toBeGreaterThan(0);
    }
  });

  it("uses only tags that are defined", () => {
    const defined = new Set([...V1_TAGS, ...document.tags].map((t) => t.name));
    for (const { path, operation } of operations) {
      for (const tag of operation.tags)
        expect(defined.has(tag), `${path} ${tag}`).toBe(true);
    }
  });

  it("declares and types every path parameter, with a real example slug", () => {
    const real = {
      work: new Set(allWork.map((w) => w.slug)),
      projects: new Set(allProjects.map((p) => p.slug)),
      articles: new Set(allArticles.map((a) => a.slug)),
    } as Record<string, Set<string>>;
    for (const { path, operation } of operations) {
      const declared = (operation.parameters ?? []).filter(
        (p) => p.in === "path",
      );
      const templated = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      expect(declared.map((p) => p.name).sort(), path).toEqual(
        templated.sort(),
      );
      for (const p of declared) {
        expect(p.required, path).toBe(true);
        expect(p.schema.type, path).toBe("string");
        expect(p.schema.pattern, path).toBe(SLUG_PATTERN);
        expect(p.schema.minLength, path).toBe(1);
        expect(p.schema.maxLength, path).toBe(120);
        expect(p.description.length, path).toBeGreaterThan(20);
        expect(p.example, path).toBeTruthy();
        const kind = path.split("/")[3];
        if (real[kind])
          expect(
            real[kind].has(p.example as string),
            `${path} example ${p.example}`,
          ).toBe(true);
      }
    }
  });

  it("types the query parameters of search and decisions with the limits the routes enforce", () => {
    const q = paths["/api/v1/search"].get.parameters!.find(
      (p) => p.name === "q",
    )!;
    expect(q).toMatchObject({
      in: "query",
      required: true,
      schema: { type: "string", minLength: 1, maxLength: 100 },
    });
    expect(q.description.length).toBeGreaterThan(20);
    const tag = paths["/api/v1/decisions"].get.parameters!.find(
      (p) => p.name === "tag",
    )!;
    expect(tag).toMatchObject({
      in: "query",
      required: false,
      schema: { type: "string", minLength: 1, maxLength: 100 },
    });
    expect(tag.description.length).toBeGreaterThan(20);
  });

  it("starts every operation's parameters with the optional API-Version header", () => {
    for (const { path, operation } of operations) {
      const first = operation.parameters?.[0];
      expect(first?.name, path).toBe(API_VERSION_HEADER);
      expect(first?.in, path).toBe("header");
      expect(first?.required, path).toBe(false);
    }
  });

  it("answers 200 with a described JSON body and the version and rate-limit headers", () => {
    for (const { path, operation } of operations) {
      const ok = operation.responses["200"] as OpenApiResponse;
      expect(ok.description.length, path).toBeGreaterThan(5);
      expect(Object.keys(ok.headers ?? {}), path).toEqual(
        expect.arrayContaining([
          API_VERSION_HEADER,
          "RateLimit-Policy",
          "RateLimit",
          "RateLimit-Limit",
          "RateLimit-Remaining",
          "RateLimit-Reset",
        ]),
      );
      expect(ok.content?.["application/json"]?.schema, path).toBeTruthy();
    }
  });

  it("lists 429 and 500 on every operation with the Error schema inline", () => {
    for (const { path, operation } of operations) {
      for (const status of ["429", "500"]) {
        const response = operation.responses[status] as OpenApiResponse;
        expect(response, `${path} ${status}`).toBeTruthy();
        expect(
          response.content?.["application/json"]?.schema,
          `${path} ${status}`,
        ).toEqual({ $ref: "#/components/schemas/Error" });
      }
      expect(operation.responses.default, path).toEqual({
        $ref: "#/components/responses/Error",
      });
    }
  });

  it("lists exactly the extra statuses a route can return", () => {
    const statuses = (op: OpenApiOperation) =>
      Object.keys(op.responses).filter((s) => /^\d+$/.test(s) && s !== "200");
    for (const { path, operation } of operations) {
      // 405 comes from the proxy for every read-only public path, static or dynamic.
      const expected = ["405", "429", "500"];
      if (INPUT_PATHS.includes(path)) expected.push("400");
      if (ITEM_PATHS.includes(path)) expected.push("404");
      expect(statuses(operation).sort(), path).toEqual(expected.sort());
    }
  });

  it("resolves every $ref", () => {
    const refs = collectRefs(paths);
    expect(refs.length).toBeGreaterThan(10);
    for (const ref of refs) {
      const name = ref.replace("#/components/schemas/", "");
      if (ref.startsWith("#/components/responses/"))
        expect(
          document.components.responses[ref.split("/").pop()!],
          ref,
        ).toBeTruthy();
      else expect(knownSchemas[name], ref).toBeTruthy();
    }
  });

  it("reuses the existing résumé and GitHub statistics schemas instead of redefining them", () => {
    expect(V1_SCHEMAS).not.toHaveProperty("ResumeJson");
    expect(V1_SCHEMAS).not.toHaveProperty("GithubStats");
    expect(V1_SCHEMAS).not.toHaveProperty("Error");
    const ref = (path: string) =>
      (
        (paths[path].get.responses["200"] as OpenApiResponse).content![
          "application/json"
        ].schema as Json
      ).$ref;
    expect(ref("/api/v1/resume")).toBe("#/components/schemas/ResumeJson");
    expect(ref("/api/v1/github/stats")).toBe(
      "#/components/schemas/GithubStats",
    );
  });
});

describe("V1_TAGS", () => {
  it("defines each tag once, describes it and uses it", () => {
    const names = V1_TAGS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    const used = new Set(operations.flatMap((o) => o.operation.tags));
    for (const tag of V1_TAGS) {
      expect(tag.description.length, tag.name).toBeGreaterThan(15);
      expect(used.has(tag.name), tag.name).toBe(true);
    }
    for (const name of names)
      expect(
        document.tags.map((t) => t.name).filter((n) => n === name).length,
        name,
      ).toBeLessThanOrEqual(1);
  });
});

describe("V1_SCHEMAS", () => {
  /** Every object schema, so each property can be checked for a type and a description. */
  function objectSchemas(
    node: unknown,
    where: string,
    found: [string, Json][] = [],
  ): [string, Json][] {
    if (!node || typeof node !== "object") return found;
    const schema = node as Json;
    if (schema.type === "object" && schema.properties)
      found.push([where, schema]);
    for (const [key, value] of Object.entries(
      (schema.properties as Json | undefined) ?? {},
    )) {
      objectSchemas(value, `${where}.${key}`, found);
    }
    if (schema.items) objectSchemas(schema.items, `${where}[]`, found);
    return found;
  }

  it("describes every schema and types and describes every property", () => {
    for (const [name, schema] of Object.entries(V1_SCHEMAS)) {
      expect(
        (schema.description as string | undefined)?.length ?? 0,
        name,
      ).toBeGreaterThan(15);
      for (const [where, object] of objectSchemas(schema, name)) {
        for (const [key, property] of Object.entries(
          object.properties as Record<string, Json>,
        )) {
          if ("$ref" in property) continue;
          expect(property.type, `${where}.${key}`).toBeTruthy();
          expect(
            (property.description as string | undefined)?.length ?? 0,
            `${where}.${key}`,
          ).toBeGreaterThan(3);
        }
      }
    }
  });

  it("only requires properties it declares", () => {
    for (const [name, schema] of Object.entries(V1_SCHEMAS)) {
      for (const [where, object] of objectSchemas(schema, name)) {
        const declared = Object.keys(object.properties as Json);
        for (const key of (object.required as string[] | undefined) ?? [])
          expect(declared, `${where} requires ${key}`).toContain(key);
      }
    }
  });
});
