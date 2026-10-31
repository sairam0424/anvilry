import { describe, expect, it } from "vitest";
import { API_V1_BASE, DEPRECATIONS, RATE_LIMIT_POLICY } from "@/lib/api-policy";
import { V1_RESOURCES } from "@/lib/content-api";
import { allArticles, allNotes, allProjects, allWork } from "@/lib/content";
import { listDecisionsData } from "@/lib/mcp-tools";
import { SITE_URL } from "@/lib/site-url";
import { call, expectApiError } from "./v1-test-support";

/**
 * What the /api/v1 routes do beyond the shape of a 200: list envelopes, absolute URLs, the 400 and
 * 404 answers, the search and tag limits and the index. The shape itself is v1-contract.test.ts.
 */

const ITEM_ROUTES = [
  "/api/v1/work/{slug}",
  "/api/v1/projects/{slug}",
  "/api/v1/articles/{slug}",
  "/api/v1/notes/{slug}",
];

function collectUrls(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => collectUrls(n, found));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "url" && typeof value === "string") found.push(value);
      else collectUrls(value, found);
    }
  }
  return found;
}

const json = async (path: string, input?: { slug?: string; search?: string }) =>
  (await call(path, input)).json();

describe("lists", () => {
  const lists = [
    ["/api/v1/work", allWork.length],
    ["/api/v1/projects", allProjects.length],
    ["/api/v1/articles", allArticles.length],
    ["/api/v1/notes", allNotes.length],
    ["/api/v1/decisions", listDecisionsData().length],
  ] as const;

  for (const [path, expected] of lists) {
    it(`${path} lists every item and its count equals the length`, async () => {
      const body = await json(path);
      expect(body.count).toBe(body.items.length);
      expect(body.count).toBe(expected);
    });
  }

  it("keeps every url on the canonical origin", async () => {
    const requests = [
      ["/api/v1/work", {}],
      ["/api/v1/projects", {}],
      ["/api/v1/articles", {}],
      ["/api/v1/decisions", {}],
      ["/api/v1/search", { search: "?q=a" }],
    ] as const;
    for (const [path, input] of requests) {
      const urls = collectUrls(await json(path, input));
      expect(urls.length, path).toBeGreaterThan(0);
      for (const url of urls) {
        expect(url.startsWith(`${SITE_URL}/`), `${path} ${url}`).toBe(true);
      }
    }
  });
});

describe("item routes", () => {
  for (const path of ITEM_ROUTES) {
    const collection = path.split("/")[3];

    it(`${path}: an unknown slug is a 404 that names the collection and does not echo the slug`, async () => {
      const body = await expectApiError(
        await call(path, { slug: "no-such-item" }),
        404,
        "not_found",
      );
      expect(body.error).toContain(collection);
      expect(JSON.stringify(body)).not.toContain("no-such-item");
    });

    it(`${path}: a malformed slug is a 400`, async () => {
      for (const slug of [
        "has space",
        "dots.in.it",
        "x".repeat(121),
        "../etc",
      ]) {
        const body = await expectApiError(
          await call(path, { slug }),
          400,
          "invalid_request",
        );
        expect(JSON.stringify(body)).not.toContain(slug);
      }
    });
  }

  it("puts up to 30 valid slugs in the 404 hint", async () => {
    const body = await expectApiError(
      await call("/api/v1/projects/{slug}", { slug: "nope" }),
      404,
      "not_found",
    );
    const shown = allProjects.slice(0, 30).map((p) => p.slug);
    expect(body.hint).toContain(shown.join(", "));
  });
});

describe("GET /api/v1/search", () => {
  it("requires q, between 1 and 100 characters once trimmed", async () => {
    for (const search of ["", "?q=", "?q=%20%20%20", `?q=${"a".repeat(101)}`]) {
      await expectApiError(
        await call("/api/v1/search", { search }),
        400,
        "invalid_request",
      );
    }
  });

  it("accepts 100 characters and trims the text it searches for", async () => {
    const longest = await call("/api/v1/search", {
      search: `?q=${"a".repeat(100)}`,
    });
    expect(longest.status).toBe(200);
    const body = await json("/api/v1/search", { search: "?q=%20kafka%20" });
    expect(body.query).toBe("kafka");
    expect(body.matches.length + body.skills.length).toBeGreaterThan(0);
  });

  it("answers a search nothing matches with empty arrays, not an error", async () => {
    const body = await json("/api/v1/search", { search: "?q=zzzz-no-match" });
    expect(body).toEqual({ query: "zzzz-no-match", matches: [], skills: [] });
  });
});

describe("GET /api/v1/decisions", () => {
  it("filters by tag and answers an unknown tag with an empty list", async () => {
    const all = await json("/api/v1/decisions");
    const tagged = await json("/api/v1/decisions", { search: "?tag=mcp" });
    expect(tagged.count).toBeGreaterThan(0);
    expect(tagged.count).toBeLessThan(all.count);
    for (const item of tagged.items) expect(item.tags).toContain("mcp");
    expect(
      await json("/api/v1/decisions", { search: "?tag=no-such-tag" }),
    ).toEqual({ count: 0, items: [] });
  });

  it("rejects a blank or over-long tag", async () => {
    for (const search of ["?tag=", "?tag=%20", `?tag=${"a".repeat(101)}`]) {
      await expectApiError(
        await call("/api/v1/decisions", { search }),
        400,
        "invalid_request",
      );
    }
  });
});

describe("GET /api/v1", () => {
  it("states the version, the limits, the deprecations and every resource with an absolute URL", async () => {
    const body = await json("/api/v1");
    expect(body).toMatchObject({
      version: "1",
      status: "stable",
      baseUrl: `${SITE_URL}${API_V1_BASE}`,
      openapi: `${SITE_URL}/openapi.json`,
      docs: `${SITE_URL}/developers`,
      rateLimit: {
        requests: RATE_LIMIT_POLICY.requests,
        windowSeconds: RATE_LIMIT_POLICY.windowSeconds,
      },
    });
    expect(body.deprecations).toEqual(
      DEPRECATIONS.map(({ prefix, deprecatedOn, sunsetOn, successor }) => ({
        prefix,
        deprecatedOn,
        sunsetOn,
        successor,
      })),
    );
    expect(body.resources).toEqual(
      Object.fromEntries(
        Object.entries(V1_RESOURCES).map(([name, path]) => [
          name,
          `${SITE_URL}${path}`,
        ]),
      ),
    );
  });
});
