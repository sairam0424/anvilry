import { describe, expect, it } from "vitest";

/**
 * Every public route answers a method it does not implement with a JSON 405 and an
 * accurate Allow header, instead of Next's empty-bodied default.
 */
const GET_ONLY = [
  ["/api/github/stats", () => import("./github/stats/route")],
  ["/api/md/projects/[slug]", () => import("./md/projects/[slug]/route")],
  ["/api/md/work/[slug]", () => import("./md/work/[slug]/route")],
  ["/api/md/articles/[slug]", () => import("./md/articles/[slug]/route")],
  ["/api/md/notes/[slug]", () => import("./md/notes/[slug]/route")],
  ["/projects/[slug].md", () => import("../projects/[slug].md/route")],
  ["/work/[slug].md", () => import("../work/[slug].md/route")],
  ["/articles/[slug].md", () => import("../articles/[slug].md/route")],
  ["/notes/[slug].md", () => import("../notes/[slug].md/route")],
] as const;

const POST_ONLY = [
  ["/api/chat", () => import("./chat/route")],
  ["/api/tts", () => import("./tts/route")],
  ["/api/tts-google", () => import("./tts-google/route")],
  ["/api/transcribe", () => import("./transcribe/route")],
  ["/api/error", () => import("./error/route")],
  ["/api/visit", () => import("./visit/route")],
] as const;

async function expectJson405(res: Response, allow: string) {
  expect(res.status).toBe(405);
  expect(res.headers.get("allow")).toBe(allow);
  expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  const json = await res.json();
  expect(json.code).toBe("method_not_allowed");
  expect(json.error).toBeTruthy();
}

/**
 * Routes that are prerendered at build time. Next treats a route module that exports POST, PUT,
 * PATCH or DELETE as dynamic (hasNonStaticMethods), so a 405 stub here would silently turn a
 * cached file into a function call per request (this happened once and was caught in review).
 */
const STATIC_GET_ROUTES = [
  ["/api/resume.json", () => import("./resume.json/route")],
  ["/api/md/home", () => import("./md/home/route")],
  ["/llms.txt", () => import("../llms.txt/route")],
  ["/llms-full.txt", () => import("../llms-full.txt/route")],
  ["/feed.xml", () => import("../feed.xml/route")],
  ["/openapi.json", () => import("../openapi.json/route")],
] as const;

describe("static GET routes", () => {
  for (const [path, load] of STATIC_GET_ROUTES) {
    it(`${path} exports GET only, so it stays prerenderable`, async () => {
      const exported = Object.keys(await load());
      for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
        expect(exported, `${path} must not export ${method}`).not.toContain(method);
      }
      expect(exported).toContain("GET");
    });
  }
});

describe("GET-only routes", () => {
  for (const [path, load] of GET_ONLY) {
    it(`${path} rejects POST/PUT/PATCH/DELETE as JSON 405`, async () => {
      const mod = (await load()) as unknown as Record<string, () => Response>;
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        await expectJson405(mod[method](), "GET, HEAD, OPTIONS");
      }
    });
  }
});

describe("OPTIONS tells the truth about the stubbed methods", () => {
  it("lists exactly the real methods for a GET-only and a POST-only route", async () => {
    const getOnly = (await import("./github/stats/route")) as unknown as Record<string, () => Response>;
    const postOnly = (await import("./chat/route")) as unknown as Record<string, () => Response>;
    expect(getOnly.OPTIONS().headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    expect(postOnly.OPTIONS().headers.get("allow")).toBe("POST, OPTIONS");
    expect(getOnly.OPTIONS().status).toBe(204);
  });

  it("every stubbed route exports an OPTIONS handler whose Allow matches its 405", async () => {
    for (const [path, load] of [...GET_ONLY, ...POST_ONLY]) {
      const mod = (await load()) as unknown as Record<string, () => Response>;
      const stub = mod[path.includes("[slug]") || path === "/api/github/stats" ? "POST" : "GET"]();
      expect(mod.OPTIONS().headers.get("allow"), path).toBe(stub.headers.get("allow"));
    }
  });
});

describe("POST-only routes", () => {
  for (const [path, load] of POST_ONLY) {
    it(`${path} rejects GET/PUT/PATCH/DELETE as JSON 405`, async () => {
      const mod = (await load()) as unknown as Record<string, () => Response>;
      for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
        await expectJson405(mod[method](), "POST, OPTIONS");
      }
    });
  }
});
