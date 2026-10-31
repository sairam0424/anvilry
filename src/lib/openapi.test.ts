import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { allArticles, allProjects, allWork } from "@/lib/content";
import { API_ERROR_CODES } from "@/lib/api-error";
import { API_VERSION, API_VERSION_HEADER, RATE_LIMIT_POLICY } from "@/lib/api-policy";
import { buildResumeJson } from "@/lib/resume-json";
import { SITE_URL } from "@/lib/site-url";
import { buildOpenApiDocument, listOperations, type OpenApiResponse } from "./openapi";

const doc = buildOpenApiDocument();
const operations = listOperations(doc);

type Json = Record<string, unknown>;

function resolveRef(ref: string): unknown {
  expect(ref.startsWith("#/")).toBe(true);
  return ref
    .slice(2)
    .split("/")
    .reduce<unknown>((node, key) => (node as Json | undefined)?.[key], doc);
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

/** Where the route handler for a documented path lives, so the spec cannot document a ghost. */
function routeFileFor(path: string): string[] {
  const app = (p: string) => join(process.cwd(), "src/app", p, "route.ts");
  if (path === "/") return [join(process.cwd(), "src/app/page.tsx")];
  if (path === "/index.md") return [app("api/md/home")];
  const md = path.match(/^\/(projects|work|articles|notes)\/\{slug\}\.md$/);
  if (md) return [app(`${md[1]}/[slug].md`)];
  // Versioned JSON routes: /api/v1/work/{slug} lives in src/app/api/v1/work/[slug].
  if (path.startsWith("/api/v1")) return [app(path.slice(1).replace("{slug}", "[slug]"))];
  if (path === "/api/mcp/mcp") return [app("api/mcp/[transport]")];
  if (path === "/sitemap.xml") return [join(process.cwd(), "src/app/sitemap.ts")];
  if (path === "/robots.txt") return [join(process.cwd(), "src/app/robots.ts")];
  return [app(path.slice(1))];
}

describe("OpenAPI document", () => {
  it("is OpenAPI 3.1 with the identity an agent needs before the first call", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title.length).toBeGreaterThan(5);
    expect(doc.info.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(doc.info.description.length).toBeGreaterThan(80);
    expect(doc.servers[0].url).toBe(SITE_URL);
    expect(doc.externalDocs.url).toBe(`${SITE_URL}/developers`);
  });

  it("declares that no credentials are needed", () => {
    expect(doc.security).toEqual([]);
  });

  it("gives every operation a unique, tool-name-safe operationId", () => {
    const ids = operations.map((o) => o.operation.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][A-Za-z0-9]{2,62}$/);
    }
  });

  it("describes every operation well enough to become a tool definition", () => {
    for (const { path, method, operation } of operations) {
      const where = `${method.toUpperCase()} ${path}`;
      expect(operation.summary.length, where).toBeGreaterThan(8);
      expect(operation.summary.length, where).toBeLessThanOrEqual(80);
      expect(operation.description.length, where).toBeGreaterThan(60);
      expect(operation.tags.length, where).toBeGreaterThan(0);
    }
  });

  it("declares and types every path parameter, with a description and a real example", () => {
    for (const { path, operation } of operations) {
      const declared = (operation.parameters ?? []).filter((p) => p.in === "path");
      const templated = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      expect(declared.map((p) => p.name).sort(), path).toEqual(templated.sort());
      for (const p of declared) {
        expect(p.required, path).toBe(true);
        expect(p.schema.type, path).toBe("string");
        expect(p.schema.pattern, path).toBeTruthy();
        expect(p.description.length, path).toBeGreaterThan(20);
        expect(p.example, path).toBeTruthy();
      }
    }
  });

  it("gives every success and error response a described, typed body", () => {
    for (const { path, method, operation } of operations) {
      const where = `${method.toUpperCase()} ${path}`;
      const success = Object.entries(operation.responses).filter(([s]) => /^2/.test(s));
      expect(success.length, where).toBeGreaterThan(0);
      for (const [status, response] of success) {
        // Success responses are always inline; only `default` is a $ref.
        expect("$ref" in response, `${where} ${status}`).toBe(false);
        const inline = response as OpenApiResponse;
        expect(inline.description.length, `${where} ${status}`).toBeGreaterThan(5);
        const media = Object.values(inline.content ?? {});
        expect(media.length, `${where} ${status}`).toBeGreaterThan(0);
        for (const m of media) expect(m.schema, `${where} ${status}`).toBeTruthy();
      }
      expect(operation.responses.default, where).toBeTruthy();
    }
  });

  it("resolves every $ref", () => {
    const refs = collectRefs(doc);
    expect(refs.length).toBeGreaterThan(5);
    for (const ref of refs) expect(resolveRef(ref), ref).toBeTruthy();
  });

  it("documents exactly the catalogued error codes (api-error.test.ts checks each is emitted)", () => {
    const schema = doc.components.schemas.Error as Json;
    const props = schema.properties as Record<string, Json>;
    expect([...(props.code.enum as string[])].sort()).toEqual(
      API_ERROR_CODES.map((c) => c.code).sort(),
    );
    expect(schema.required).toEqual(["error", "code", "status", "hint", "docs"]);
  });

  it("only documents routes that exist", () => {
    for (const { path } of operations) {
      for (const file of routeFileFor(path)) {
        expect(existsSync(file), `${path} -> ${file}`).toBe(true);
      }
    }
  });

  it("does not document paid, voice, beacon, admin or cron routes", () => {
    const paths = operations.map((o) => o.path).join(" ");
    for (const banned of ["/api/chat", "/api/tts", "/api/transcribe", "/api/error", "/api/visit", "/api/admin", "/api/cron"]) {
      expect(paths).not.toContain(banned);
    }
  });

  it("uses slugs that exist in the content it documents", () => {
    const real = {
      projects: new Set(allProjects.map((p) => p.slug)),
      work: new Set(allWork.map((w) => w.slug)),
      articles: new Set(allArticles.map((a) => a.slug)),
    } as Record<string, Set<string>>;
    for (const { path, operation } of operations) {
      const kind = path.match(/^\/(projects|work|articles)\//)?.[1];
      if (!kind) continue;
      const slug = operation.parameters?.find((p) => p.name === "slug")?.example;
      expect(real[kind].has(slug as string), `${path} example ${slug}`).toBe(true);
    }
  });

  it("types the résumé response with exactly the keys the route returns", () => {
    const schema = doc.components.schemas.ResumeJson as Json;
    expect(Object.keys(schema.properties as Json).sort()).toEqual(
      Object.keys(buildResumeJson()).sort(),
    );
  });
});

describe("GithubStats schema", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("matches the keys the route returns", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    const { GET } = await import("@/app/api/github/stats/route");
    const body = (await (await GET()).json()) as Json;
    const schema = doc.components.schemas.GithubStats as Json;
    expect(Object.keys(schema.properties as Json).sort()).toEqual(Object.keys(body).sort());
  });
});

describe("the public API contract on every operation", () => {
  const proxied = operations.filter((o) => o.path !== "/"); // the homepage is a page, not stamped by the proxy

  const refsError = (node: unknown): boolean => JSON.stringify(node).includes('"#/components/schemas/Error"');

  it("describes the versioning policy and the enforced rate limit in info.description", () => {
    const text = doc.info.description;
    expect(text).toContain(`version ${API_VERSION}`);
    expect(text).toContain(API_VERSION_HEADER);
    expect(text).toMatch(/Deprecation/);
    expect(text).toMatch(/Sunset/);
    expect(text).toContain(`${RATE_LIMIT_POLICY.requests} requests per ${RATE_LIMIT_POLICY.windowSeconds} seconds`);
    expect(text).toContain("Retry-After");
  });

  it("declares the optional API-Version header, restricted to the one version, on every operation", () => {
    for (const { path, method, operation } of proxied) {
      const header = (operation.parameters ?? []).find((p) => p.in === "header" && p.name === API_VERSION_HEADER);
      const where = `${method.toUpperCase()} ${path}`;
      expect(header, where).toBeDefined();
      expect(header?.required, where).toBe(false);
      expect(header?.schema.enum, where).toEqual([API_VERSION]);
    }
  });

  it("reports the version and the rate-limit state on every success response", () => {
    for (const { path, method, operation } of proxied) {
      for (const [status, response] of Object.entries(operation.responses).filter(([s]) => /^2/.test(s))) {
        const names = Object.keys((response as OpenApiResponse).headers ?? {});
        for (const name of [API_VERSION_HEADER, "RateLimit", "RateLimit-Policy", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"]) {
          expect(names, `${method.toUpperCase()} ${path} ${status}`).toContain(name);
        }
      }
    }
  });

  it("lists 429 with Retry-After and 405 on every operation, each typed with the Error schema", () => {
    for (const { path, method, operation } of proxied) {
      const where = `${method.toUpperCase()} ${path}`;
      for (const status of ["405", "429"]) {
        const response = operation.responses[status] as OpenApiResponse | undefined;
        expect(response, `${where} ${status}`).toBeDefined();
        expect(refsError(response), `${where} ${status}`).toBe(true);
      }
      const limited = operation.responses["429"] as OpenApiResponse;
      expect(Object.keys(limited.headers ?? {}), where).toContain("Retry-After");
    }
  });

  it("types every other 4xx and 5xx response too: the shared Error schema, or a named document schema", () => {
    for (const { path, method, operation } of proxied) {
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!/^[45]/.test(status)) continue;
        const where = `${method.toUpperCase()} ${path} ${status}`;
        const inline = response as OpenApiResponse;
        expect(Object.keys(inline.content ?? {}).length, where).toBeGreaterThan(0);
        const typed = refsError(inline) || JSON.stringify(inline).includes("#/components/schemas/MarkdownDocument");
        expect(typed, where).toBe(true);
      }
    }
  });

  it("types every non-JSON body with a named document schema, not an anonymous string", () => {
    for (const { path, method, operation } of operations) {
      for (const [status, response] of Object.entries(operation.responses)) {
        if (status === "default") continue;
        for (const [media, body] of Object.entries((response as OpenApiResponse).content ?? {})) {
          if (media === "application/json") continue;
          const where = `${method.toUpperCase()} ${path} ${status} ${media}`;
          expect(JSON.stringify(body.schema), where).not.toBe('{"type":"string"}');
        }
      }
    }
  });
});
