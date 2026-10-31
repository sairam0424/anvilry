import { afterEach, describe, expect, it, vi } from "vitest";
import { SITE_URL } from "@/lib/site-url";
import { call, check, expectApiError, successSchema } from "./v1-test-support";

/**
 * Notes ship dark: NEXT_PUBLIC_NOTES_ENABLED defaults to off, but a deployment may turn it on (the
 * Vercel project does), so these cases must not depend on the environment the suite runs in. The
 * flag is inlined when `@/lib/content` loads, so each case resets the module graph, sets the flag
 * and only then loads the routes (the pattern of src/lib/notes-dark.test.ts). They live in their own
 * file so the reset cannot leak into the other v1 tests.
 */

async function loadWithNotes(enabled: boolean) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", enabled ? "true" : "false");
  const content = await import("@/lib/content");
  expect(content.publishedNotes.length).toBeGreaterThan(0);
  return content.publishedNotes.map((note) => note.slug);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("notes switched off", () => {
  it("GET /api/v1/notes is an empty list", async () => {
    await loadWithNotes(false);
    const res = await call("/api/v1/notes");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 0, items: [] });
  });

  it("GET /api/v1/notes/{slug} is a 404 for every note that exists", async () => {
    for (const slug of await loadWithNotes(false)) {
      const body = await expectApiError(
        await call("/api/v1/notes/{slug}", { slug }),
        404,
        "not_found",
      );
      expect(body.hint, slug).toContain("no items");
    }
  });
});

describe("notes switched on", () => {
  it("GET /api/v1/notes lists every published note", async () => {
    const slugs = await loadWithNotes(true);
    const body = await (await call("/api/v1/notes")).json();
    expect(body.count).toBe(slugs.length);
    expect(body.items.map((item: { slug: string }) => item.slug)).toEqual(
      expect.arrayContaining(slugs),
    );
    expect(check(body, successSchema("/api/v1/notes"))).toEqual([]);
    for (const item of body.items) {
      expect(item.url, item.slug).toBe(`${SITE_URL}/notes/${item.slug}`);
    }
  });

  it("GET /api/v1/notes/{slug} returns each published note", async () => {
    for (const slug of await loadWithNotes(true)) {
      const res = await call("/api/v1/notes/{slug}", { slug });
      expect(res.status, slug).toBe(200);
      const body = await res.json();
      expect(body.slug, slug).toBe(slug);
      expect(check(body, successSchema("/api/v1/notes/{slug}")), slug).toEqual(
        [],
      );
    }
  });

  it("still answers 404 for a slug that is not a note", async () => {
    await loadWithNotes(true);
    await expectApiError(
      await call("/api/v1/notes/{slug}", { slug: "no-such-note" }),
      404,
      "not_found",
    );
  });
});
