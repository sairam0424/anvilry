import { afterEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES, type ApiErrorBody } from "@/lib/api-error";
import { allArticles } from "@/lib/content";
import { getContentItemData } from "@/lib/mcp-tools";
import { SITE_URL } from "@/lib/site-url";
import {
  getArticleData,
  isValidSlug,
  jsonResponse,
  listArticlesData,
  listResponse,
  MAX_TEXT_PARAM_LENGTH,
  parseTextParam,
  respondWithItem,
  V1_RESOURCES,
} from "./content-api";

const params = (slug: string) => Promise.resolve({ slug });
const found = (slug: string) => ({ slug, name: "Example" });
const missing = (slug: string) => ({
  notFound: true as const,
  kind: "work",
  given: slug,
  valid: ["a", "b"],
});

describe("isValidSlug", () => {
  it("accepts the characters a slug is made of", () => {
    for (const slug of [
      "pensieve",
      "ag-bash",
      "how_dns_works",
      "A1",
      "x".repeat(120),
    ]) {
      expect(isValidSlug(slug), slug).toBe(true);
    }
  });

  it("rejects anything else, including path tricks and over-long values", () => {
    for (const slug of [
      "",
      "a b",
      "../etc",
      "a/b",
      "a.b",
      "%2e%2e",
      "é",
      "x".repeat(121),
      "a\nb",
    ]) {
      expect(isValidSlug(slug), JSON.stringify(slug)).toBe(false);
    }
  });
});

describe("parseTextParam", () => {
  it("returns the trimmed text", () => {
    expect(parseTextParam("kafka")).toBe("kafka");
    expect(parseTextParam("  multi agent \n")).toBe("multi agent");
    expect(parseTextParam("a".repeat(MAX_TEXT_PARAM_LENGTH))).toHaveLength(MAX_TEXT_PARAM_LENGTH);
  });

  it("returns null for a missing, blank or over-long value", () => {
    expect(parseTextParam(null)).toBeNull();
    expect(parseTextParam("")).toBeNull();
    expect(parseTextParam("   ")).toBeNull();
    expect(parseTextParam("a".repeat(MAX_TEXT_PARAM_LENGTH + 1))).toBeNull();
  });

  it("measures the limit after trimming, not before", () => {
    expect(parseTextParam(` ${"a".repeat(MAX_TEXT_PARAM_LENGTH)} `)).toHaveLength(MAX_TEXT_PARAM_LENGTH);
  });
});

describe("jsonResponse and listResponse", () => {
  it("answers UTF-8 JSON", async () => {
    const res = jsonResponse({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(await res.json()).toEqual({ a: 1 });
  });

  it("wraps a list as { count, items } with a count that matches", async () => {
    expect(await listResponse(["x", "y"]).json()).toEqual({
      count: 2,
      items: ["x", "y"],
    });
    expect(await listResponse([]).json()).toEqual({ count: 0, items: [] });
  });
});

describe("respondWithItem", () => {
  it("returns the item as JSON", async () => {
    const res = await respondWithItem("work", params("pensieve"), found);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ slug: "pensieve", name: "Example" });
  });

  it("answers 400 invalid_request for a malformed slug without echoing it", async () => {
    const res = await respondWithItem("work", params("../secret"), found);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.code).toBe("invalid_request");
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("answers 404 not_found naming the collection, with the valid slugs as the hint", async () => {
    const res = await respondWithItem("work", params("nope"), missing);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    const body = (await res.json()) as ApiErrorBody;
    expect(body.code).toBe("not_found");
    expect(body.error).toContain("work");
    expect(body.hint).toContain("a, b");
    expect(JSON.stringify(body)).not.toContain("nope");
  });

  it("lists at most 30 slugs in the hint and points at the list route for the rest", async () => {
    const many = Array.from({ length: 45 }, (_, i) => `slug-${i}`);
    const res = await respondWithItem("projects", params("nope"), (slug) => ({
      notFound: true as const,
      kind: "project",
      given: slug,
      valid: many,
    }));
    const { hint } = (await res.json()) as ApiErrorBody;
    expect(hint).toContain("slug-29");
    expect(hint).not.toContain("slug-30");
    expect(hint).toContain("30 of 45");
    expect(hint).toContain(`${SITE_URL}/api/v1/projects`);
  });

  it("says so when the collection is empty, for example notes while they are switched off", async () => {
    const res = await respondWithItem("notes", params("x"), (slug) => ({
      notFound: true as const,
      kind: "note",
      given: slug,
      valid: [],
    }));
    expect(res.status).toBe(404);
    const { hint } = (await res.json()) as ApiErrorBody;
    expect(hint).toContain("no items");
    expect(hint).toContain(`${SITE_URL}/api/v1/notes`);
  });

  it("only uses error codes from the catalogue", async () => {
    const codes = API_ERROR_CODES.map((c) => c.code) as string[];
    for (const res of [
      await respondWithItem("work", params("x y"), found),
      await respondWithItem("work", params("nope"), missing),
    ]) {
      expect(codes).toContain(((await res.json()) as ApiErrorBody).code);
    }
  });
});

describe("articles and notes", () => {
  it("lists exactly what the MCP item lookup returns for each article", () => {
    expect(listArticlesData()).toEqual(
      allArticles.map((a) => getContentItemData("article", a.slug)),
    );
    expect(listArticlesData().length).toBeGreaterThan(0);
  });

  it("returns an article by slug and a not-found value for an unknown one", () => {
    const slug = allArticles[0].slug;
    expect(getArticleData(slug)).toEqual(getContentItemData("article", slug));
    expect(getArticleData("no-such-article")).toMatchObject({ notFound: true });
  });
});

/**
 * NEXT_PUBLIC_NOTES_ENABLED is inlined when `@/lib/content` loads, so each case resets the module
 * graph, sets the flag and only then imports the code under test (the pattern of notes-dark.test.ts).
 * The result must not depend on the environment the suite runs in.
 */
async function loadWithNotes(enabled: boolean) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", enabled ? "true" : "false");
  const [api, content, mcp] = await Promise.all([
    import("./content-api"),
    import("@/lib/content"),
    import("@/lib/mcp-tools"),
  ]);
  return { api, content, mcp };
}

describe("notes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("are neither listed nor found while notes are switched off", async () => {
    const { api, content } = await loadWithNotes(false);
    expect(content.publishedNotes.length).toBeGreaterThan(0);
    expect(api.listNotesData()).toEqual([]);
    for (const note of content.publishedNotes) {
      expect(api.getNoteData(note.slug), note.slug).toMatchObject({
        notFound: true,
        valid: [],
      });
    }
  });

  it("are listed and found, as the MCP lookup returns them, while notes are switched on", async () => {
    const { api, content, mcp } = await loadWithNotes(true);
    expect(content.allNotes.length).toBeGreaterThan(0);
    expect(api.listNotesData()).toEqual(
      content.allNotes.map((n) => mcp.getContentItemData("note", n.slug)),
    );
    for (const note of content.allNotes) {
      const item = api.getNoteData(note.slug);
      expect(item, note.slug).toEqual(mcp.getContentItemData("note", note.slug));
      expect(item, note.slug).not.toHaveProperty("notFound");
    }
  });
});

describe("V1_RESOURCES", () => {
  it("names every collection and utility route under /api/v1", () => {
    expect(Object.keys(V1_RESOURCES).sort()).toEqual(
      [
        "articles",
        "decisions",
        "githubStats",
        "notes",
        "profile",
        "projects",
        "resume",
        "search",
        "work",
      ].sort(),
    );
    for (const path of Object.values(V1_RESOURCES))
      expect(path).toMatch(/^\/api\/v1\/[a-z/]+$/);
  });
});
