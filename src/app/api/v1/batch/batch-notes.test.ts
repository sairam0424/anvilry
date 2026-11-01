import { afterEach, describe, expect, it, vi } from "vitest";
import { BATCH_PATH } from "@/lib/api-policy";
import { SITE_URL } from "@/lib/site-url";

/**
 * Notes ship dark (NEXT_PUBLIC_NOTES_ENABLED defaults to off) but the Vercel project turns them on,
 * so a batch that asks for notes must follow the flag, whatever the suite runs under. The flag is
 * inlined when `@/lib/content` loads, so each case resets the module graph, sets the flag, and only
 * then loads the batch route, whose registry loads the real routes lazily in that same graph (the
 * pattern of src/lib/notes-dark.test.ts). Own file so the reset cannot leak into other tests.
 */

async function batchWithNotes(enabled: boolean, paths: (slugs: string[]) => string[]) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", enabled ? "true" : "false");
  const { publishedNotes } = await import("@/lib/content");
  const { POST } = await import("./route");
  const slugs = publishedNotes.map((note) => note.slug);
  expect(slugs.length).toBeGreaterThan(0);
  const requests = paths(slugs).map((path, index) => ({ id: `r${index}`, path }));
  const res = await POST(
    new Request(`${SITE_URL}${BATCH_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requests }),
    }),
  );
  expect(res.status).toBe(200);
  const { responses } = await res.json();
  return { slugs, responses: responses as { id: string; status: number; body: Record<string, unknown> }[] };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("a batch with notes switched off", () => {
  it("lists no notes and answers 404 for every note that exists, without failing the batch", async () => {
    const { slugs, responses } = await batchWithNotes(false, (all) => [
      "/api/v1/notes",
      ...all.map((slug) => `/api/v1/notes/${slug}`),
      "/api/v1/profile",
    ]);
    expect(responses[0]).toMatchObject({ status: 200, body: { count: 0, items: [] } });
    for (const response of responses.slice(1, 1 + slugs.length)) {
      expect(response.status, response.id).toBe(404);
      expect(response.body, response.id).toMatchObject({ code: "not_found" });
    }
    expect(responses[responses.length - 1].status).toBe(200);
  });
});

describe("a batch with notes switched on", () => {
  it("lists every published note and returns each by slug", async () => {
    const { slugs, responses } = await batchWithNotes(true, (all) => [
      "/api/v1/notes",
      ...all.map((slug) => `/api/v1/notes/${slug}`),
    ]);
    expect(responses[0].status).toBe(200);
    expect(responses[0].body.count).toBe(slugs.length);
    for (const [index, slug] of slugs.entries()) {
      const response = responses[index + 1];
      expect(response.status, slug).toBe(200);
      expect(response.body.slug, slug).toBe(slug);
    }
  });
});
