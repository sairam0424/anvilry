import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allArticles, allNotes, allProjects, allWork } from "@/lib/content";
import { buildResumeJson } from "@/lib/resume-json";
import { SITE_URL } from "@/lib/site-url";
import {
  call,
  check,
  DYNAMIC_ROUTES,
  exampleInput,
  expectApiError,
  ROUTES,
  successSchema,
  v1Paths,
} from "./v1-test-support";

/**
 * The contract of the /api/v1 JSON API: every route handler is called directly, and its body must
 * validate, strictly, against the response schema the OpenAPI document declares for it. A field a
 * route emits but the spec does not describe, or the reverse, fails here. The behaviour behind the
 * contract (errors, filters, limits) is in v1-behaviour.test.ts.
 */

beforeEach(() => {
  // GitHub stays unreachable: the statistics route must still answer 200 with zeros.
  vi.stubGlobal("fetch", async () => {
    throw new Error("offline");
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("route coverage", () => {
  it("has a handler for every documented path and documents every handler", () => {
    expect(Object.keys(ROUTES).sort()).toEqual(Object.keys(v1Paths).sort());
  });
});

describe("every route answers 200 JSON that matches its declared schema", () => {
  // A note item is covered below: with notes switched off (the default) its documented example is a 404.
  for (const path of Object.keys(ROUTES).filter(
    (p) => p !== "/api/v1/notes/{slug}",
  )) {
    it(path, async () => {
      const res = await call(path, exampleInput(path));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/^application\/json/);
      expect(check(await res.json(), successSchema(path))).toEqual([]);
    });
  }

  it("builds each request from the examples the document prints, and they hit real data", () => {
    expect(exampleInput("/api/v1/search")).toEqual({
      slug: undefined,
      search: "?q=kafka",
    });
    expect(exampleInput("/api/v1/decisions").search).toBe("?tag=mcp");
    expect(allWork.map((w) => w.slug)).toContain(
      exampleInput("/api/v1/work/{slug}").slug,
    );
    expect(allProjects.map((p) => p.slug)).toContain(
      exampleInput("/api/v1/projects/{slug}").slug,
    );
    expect(allArticles.map((a) => a.slug)).toContain(
      exampleInput("/api/v1/articles/{slug}").slug,
    );
  });
});

describe("every real item validates, not only the documented example", () => {
  const cases = [
    ["/api/v1/work/{slug}", allWork.map((w) => w.slug)],
    ["/api/v1/projects/{slug}", allProjects.map((p) => p.slug)],
    ["/api/v1/articles/{slug}", allArticles.map((a) => a.slug)],
    ["/api/v1/notes/{slug}", allNotes.map((n) => n.slug)],
  ] as const;

  for (const [path, slugs] of cases) {
    it(`${path} for all ${slugs.length} slugs`, async () => {
      for (const slug of slugs) {
        const res = await call(path, { slug });
        expect(res.status, slug).toBe(200);
        const body = await res.json();
        expect(body.slug, slug).toBe(slug);
        expect(check(body, successSchema(path)), slug).toEqual([]);
      }
    });
  }
});

describe("the versioned routes are views of the existing data", () => {
  it("serves the same résumé as /api/resume.json", async () => {
    const body = await (await call("/api/v1/resume")).json();
    expect(body).toEqual(JSON.parse(JSON.stringify(buildResumeJson())));
  });

  it("serves the same statistics as /api/github/stats, key for key", async () => {
    const legacy = (await import("@/app/api/github/stats/route")).GET;
    const [v1, unversioned] = await Promise.all([
      call("/api/v1/github/stats").then((r) => r.json()),
      legacy().then((r) => r.json()),
    ]);
    expect(Object.keys(v1).sort()).toEqual(Object.keys(unversioned).sort());
    expect(v1).toEqual(unversioned);
  });
});

describe("static and dynamic routes", () => {
  for (const path of Object.keys(ROUTES).filter(
    (p) => !DYNAMIC_ROUTES.includes(p),
  )) {
    it(`${path} exports GET only, so it stays prerenderable`, async () => {
      const exported = Object.keys(await ROUTES[path]());
      expect(exported).toContain("GET");
      for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
        expect(exported, method).not.toContain(method);
      }
    });
  }

  for (const path of DYNAMIC_ROUTES) {
    it(`${path} answers other methods with a JSON 405 and a truthful Allow`, async () => {
      const mod = await ROUTES[path]();
      const context = { params: Promise.resolve({ slug: "x" }) };
      for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
        const res = await mod[method]!(
          new Request(`${SITE_URL}${path}`, { method }),
          context,
        );
        const body = await expectApiError(res, 405, "method_not_allowed");
        expect(body.hint).toContain("GET");
        expect(res.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
      }
      const options = await mod.OPTIONS!(
        new Request(`${SITE_URL}${path}`, { method: "OPTIONS" }),
        context,
      );
      expect(options.status).toBe(204);
      expect(options.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    });
  }
});
