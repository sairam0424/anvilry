import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { allArticles, allProjects, allWork } from "@/lib/content";
import { API_ERROR_CODES } from "@/lib/api-error";
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

  it("documents the error codes the server really emits, and only those", () => {
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
