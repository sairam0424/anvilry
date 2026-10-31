import { afterEach, describe, expect, it, vi } from "vitest";
import { PAGE_TWINS } from "@/lib/page-twins";
import { SITE_URL } from "@/lib/site-url";
import { DELETE, GET, OPTIONS, PATCH, POST, PUT } from "./route";

/**
 * /api/md/pages/<page> is reached by the /<page>.md rewrite in next.config.ts and by Accept
 * negotiation in src/proxy.ts. It answers a Markdown twin, the Markdown 404 for a name that has
 * none, and, if building a twin throws, the shared JSON error instead of an empty 500.
 */

const call = (page: string) =>
  GET(new Request(`${SITE_URL}/api/md/pages/${page}`), {
    params: Promise.resolve({ page }),
  });

describe("GET /api/md/pages/[page]", () => {
  it.each(PAGE_TWINS.filter((page) => page !== "notes"))(
    "serves the %s twin as Markdown",
    async (page) => {
      const res = await call(page);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(
        "text/markdown; charset=utf-8",
      );
      expect(res.headers.get("Vary")).toBe("Accept");
      expect(res.headers.get("Link")).toBe(
        `<${SITE_URL}/${page}>; rel="canonical"`,
      );
      expect((await res.text()).startsWith("# ")).toBe(true);
    },
  );

  it("answers /notes with the Markdown 404 while the section ships dark, like its HTML page", async () => {
    const res = await call("notes");
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8",
    );
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("answers a name that has no twin with the Markdown 404, never a file read", async () => {
    for (const page of [
      "resume",
      "stats",
      "nope",
      "..%2F..%2Fpackage",
      "__proto__",
    ]) {
      const res = await call(page);
      expect(res.status, page).toBe(404);
      expect(res.headers.get("Content-Type"), page).toBe(
        "text/markdown; charset=utf-8",
      );
    }
  });
});

describe("when a twin cannot be built", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/page-markdown");
    vi.resetModules();
  });

  it("answers the shared JSON error, not an empty 500, and leaks nothing from the exception", async () => {
    vi.resetModules();
    vi.doMock("@/lib/page-markdown", () => ({
      markdownForPage: () => {
        throw new Error("secret detail that must not reach the client");
      },
    }));
    const { GET: failing } = await import("./route");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await failing(new Request(`${SITE_URL}/api/md/pages/privacy`), {
      params: Promise.resolve({ page: "privacy" }),
    });
    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toMatch(/^application\/json/);
    const body = await res.json();
    expect(body).toMatchObject({ code: "internal_error", status: 500 });
    expect(JSON.stringify(body)).not.toContain("secret detail");
    log.mockRestore();
  });
});

describe("methods other than GET", () => {
  it("answer the shared JSON 405 with an Allow header", async () => {
    for (const handler of [POST, PUT, PATCH, DELETE]) {
      const res = handler();
      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
      expect(res.headers.get("Content-Type")).toMatch(/^application\/json/);
      expect(await res.json()).toMatchObject({ code: "method_not_allowed" });
    }
  });

  it("OPTIONS reports the same methods with a 204", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
  });
});
