import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * NEXT_PUBLIC_NOTES_ENABLED is inlined at module load, so each case resets the module
 * graph, stubs the env, and re-imports the consumers. Guards R-27: with notes dark, no
 * machine-readable surface may publish a note; with notes on, they all do.
 */
const NOTES_ENV = "NEXT_PUBLIC_NOTES_ENABLED";
const BASE = "https://anvilry.vercel.app";

async function load(enabled: boolean) {
  vi.resetModules();
  vi.stubEnv(NOTES_ENV, enabled ? "true" : "false");
  const content = await import("@/lib/content");
  const sample = content.allNotes[0] ?? content.publishedNotes[0];
  return { content, sample };
}

const mdRequest = (path: string) => new NextRequest(`${BASE}${path}`);

afterEach(() => vi.unstubAllEnvs());

describe("notes dark (NOTES_ENABLED=false)", () => {
  it("drops articles whose only destination is a note", async () => {
    const { content } = await load(false);
    const onlyNote = (a: { linkedNote?: string; externalUrl?: string }) =>
      Boolean(a.linkedNote) && (!a.externalUrl || a.externalUrl.startsWith(`${BASE}/notes/`));
    expect(content.allArticles.filter(onlyNote)).toEqual([]);
    expect(content.allArticles.some((a) => a.slug === "tombstone-v1-2-devto")).toBe(false);
  });

  it("content layer exposes no notes", async () => {
    const { content } = await load(false);
    expect(content.publishedNotes.length).toBeGreaterThan(0);
    expect(content.allNotes).toEqual([]);
    expect(content.hasNotes).toBe(false);
    expect(content.inkforgeArticles).toEqual([]);
  });

  it("llms.txt lists no note URLs", async () => {
    await load(false);
    const { buildLlmsTxt } = await import("@/lib/llms-txt");
    const txt = buildLlmsTxt();
    expect(txt).not.toContain(`${BASE}/notes/`);
  });

  it("feed.xml omits notes", async () => {
    await load(false);
    const { GET } = await import("@/app/feed.xml/route");
    const xml = await GET().text();
    expect(xml).not.toContain(`${BASE}/notes/`);
  });

  it("MCP tools hide notes", async () => {
    const { sample } = await load(false);
    const mcp = await import("@/lib/mcp-tools");
    expect(mcp.listAllContentData().some((i) => i.type === "note")).toBe(false);
    const hit = mcp.getContentItemData("note", sample.slug);
    expect(hit).not.toHaveProperty("date");
  });

  it("chatbot corpus omits the Writing section", async () => {
    const { sample } = await load(false);
    const { buildCorpus } = await import("@/lib/corpus");
    const corpus = buildCorpus();
    expect(corpus).not.toContain("## Writing");
    expect(corpus).not.toContain(sample.summary);
  });

  it("both .md handlers 404", async () => {
    const { sample } = await load(false);
    const legacy = await import("@/app/notes/[slug].md/route");
    const api = await import("@/app/api/md/notes/[slug]/route");
    expect(legacy.GET(mdRequest(`/notes/${sample.slug}.md`)).status).toBe(404);
    const res = await api.GET(mdRequest(`/api/md/notes/${sample.slug}`), {
      params: Promise.resolve({ slug: sample.slug }),
    });
    expect(res.status).toBe(404);
  });
});

describe("notes on (NOTES_ENABLED=true) is unchanged", () => {
  it("every surface still publishes notes", async () => {
    const { content, sample } = await load(true);
    expect(content.allNotes).toEqual(content.publishedNotes);
    expect(content.hasNotes).toBe(true);
    expect(content.allArticles.some((a) => a.slug === "tombstone-v1-2-devto")).toBe(true);

    const { buildLlmsTxt } = await import("@/lib/llms-txt");
    expect(buildLlmsTxt()).toContain(`${BASE}${sample.url}`);

    const { GET } = await import("@/app/feed.xml/route");
    expect(await GET().text()).toContain(`${BASE}${sample.url}`);

    const mcp = await import("@/lib/mcp-tools");
    expect(mcp.listAllContentData().some((i) => i.type === "note")).toBe(true);

    const { buildCorpus } = await import("@/lib/corpus");
    expect(buildCorpus()).toContain("## Writing");

    const legacy = await import("@/app/notes/[slug].md/route");
    expect(legacy.GET(mdRequest(`/notes/${sample.slug}.md`)).status).toBe(200);
  });
});
