import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call } from "@/app/api/v1/v1-test-support";
import {
  BATCH_MAX_REQUESTS,
  BATCH_MAX_RESPONSE_BYTES,
  BATCH_PATH,
} from "@/lib/api-policy";
import { allArticles, allNotes, allProjects, allWork } from "@/lib/content";
import { allDecisions } from "@/lib/decisions";
import { buildV1Paths } from "@/lib/openapi-v1";
import { SITE_URL } from "@/lib/site-url";
import {
  answerBatch,
  BATCH_ROUTES,
  parseBatchBody,
  readBodyWithin,
  responseBytes,
  runBatch,
  type BatchHandler,
  type BatchRoute,
} from "./batch";

const item = (id: string, path: string) => ({ id, path });

/**
 * Reading the body under a byte cap, and running the validated items. The registry, the content
 * type check and the validation table are in batch.test.ts.
 */

describe("readBodyWithin", () => {
  const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
    new Request(`${SITE_URL}${BATCH_PATH}`, { method: "POST", body, headers });

  it("reads a small body as text", async () => {
    expect(await readBodyWithin(post('{"a":"é"}'), 100)).toEqual({
      kind: "text",
      text: '{"a":"é"}',
    });
  });

  it("treats a missing body as empty text, which the parser then rejects", async () => {
    expect(await readBodyWithin(post(null), 100)).toEqual({
      kind: "text",
      text: "",
    });
  });

  it("allows exactly the limit and refuses one byte more", async () => {
    expect((await readBodyWithin(post("x".repeat(100)), 100)).kind).toBe(
      "text",
    );
    expect((await readBodyWithin(post("x".repeat(101)), 100)).kind).toBe(
      "too_large",
    );
  });

  it("counts bytes, not characters: three-byte characters pass the limit long before the character count does", async () => {
    const body = "€".repeat(40);
    expect(body.length).toBeLessThan(100);
    expect((await readBodyWithin(post(body), 100)).kind).toBe("too_large");
  });

  it("refuses on the declared Content-Length without reading the body", async () => {
    const pull = vi.fn();
    const req = new Request(`${SITE_URL}${BATCH_PATH}`, {
      method: "POST",
      // highWaterMark 0: a stream with the default of 1 is pulled once as soon as it exists.
      body: new ReadableStream({ pull }, { highWaterMark: 0 }),
      headers: { "content-length": "101" },
      duplex: "half",
    } as RequestInit);
    expect((await readBodyWithin(req, 100)).kind).toBe("too_large");
    expect(pull).not.toHaveBeenCalled();
  });

  it("stops reading a streamed body that has no Content-Length once it passes the limit", async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls > 50) controller.close();
        else controller.enqueue(new Uint8Array(40));
      },
    });
    const req = new Request(`${SITE_URL}${BATCH_PATH}`, {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect((await readBodyWithin(req, 100)).kind).toBe("too_large");
    expect(pulls).toBeLessThan(10);
  });

  it("reports a body that is not UTF-8 instead of decoding it with replacement characters", async () => {
    const bytes = new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]);
    expect((await readBodyWithin(post(bytes), 100)).kind).toBe(
      "invalid_encoding",
    );
  });
});

describe("runBatch", () => {
  beforeEach(() => {
    // GitHub stays unreachable so the statistics route answers with zeros, as in the contract test.
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const stub = (
    template: string,
    GET: BatchHandler,
    queryParams?: readonly string[],
  ): BatchRoute => ({
    template,
    queryParams,
    load: async () => ({ GET }),
  });

  it("answers every kind of route with exactly what the real handler returns", async () => {
    const cases = [
      ["/api/v1", "/api/v1", {}],
      ["/api/v1/profile", "/api/v1/profile", {}],
      ["/api/v1/work", "/api/v1/work", {}],
      ["/api/v1/work/pensieve", "/api/v1/work/{slug}", { slug: "pensieve" }],
      ["/api/v1/projects", "/api/v1/projects", {}],
      [
        "/api/v1/projects/trelix",
        "/api/v1/projects/{slug}",
        { slug: "trelix" },
      ],
      ["/api/v1/articles", "/api/v1/articles", {}],
      ["/api/v1/notes", "/api/v1/notes", {}],
      [
        "/api/v1/decisions?tag=mcp",
        "/api/v1/decisions",
        { search: "?tag=mcp" },
      ],
      ["/api/v1/search?q=kafka", "/api/v1/search", { search: "?q=kafka" }],
      ["/api/v1/resume", "/api/v1/resume", {}],
      ["/api/v1/github/stats", "/api/v1/github/stats", {}],
    ] as const;
    const results = await runBatch(
      cases.map(([path], i) => item(`r${i}`, path)),
    );
    expect(results).toHaveLength(cases.length);
    for (const [index, [path, template, input]] of cases.entries()) {
      const real = await call(template, input);
      expect(results[index], path).toEqual({
        id: `r${index}`,
        status: real.status,
        body: await real.json(),
      });
    }
  });

  it("returns the results in request order, whatever order they finish in", async () => {
    const slow = stub("/api/v1/slow", async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return Response.json({ n: "slow" });
    });
    const fast = stub("/api/v1/fast", () => Response.json({ n: "fast" }));
    const results = await runBatch(
      [
        item("1", "/api/v1/slow"),
        item("2", "/api/v1/fast"),
        item("3", "/api/v1/slow"),
      ],
      [slow, fast],
    );
    expect(results.map((r) => [r.id, (r.body as { n: string }).n])).toEqual([
      ["1", "slow"],
      ["2", "fast"],
      ["3", "slow"],
    ]);
  });

  it("answers a path no route matches as a 404 item and still runs the others", async () => {
    const results = await runBatch([
      item("a", "/api/v1/profile"),
      item("b", "/api/v1/nope"),
      item("c", "/api/v1/work/pensieve/extra"),
      item("d", "/api/v1/work"),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 404, 404, 200]);
    const missing = results[1].body as {
      code: string;
      error: string;
      hint: string;
    };
    expect(missing.code).toBe("not_found");
    expect(missing.hint).toContain("/api/v1/projects/{slug}");
    expect(JSON.stringify(results[1].body)).not.toContain("nope");
  });

  it("turns a handler that throws into a 500 item with the shared error body and leaks nothing from the exception", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const boom = stub("/api/v1/boom", () => {
      throw new Error("internal detail alpha");
    });
    const rejects = stub("/api/v1/rejects", async () => {
      throw new TypeError("internal detail beta");
    });
    const ok = stub("/api/v1/ok", () => Response.json({ fine: true }));
    const results = await runBatch(
      [
        item("a", "/api/v1/ok"),
        item("b", "/api/v1/boom"),
        item("c", "/api/v1/rejects"),
        item("d", "/api/v1/ok"),
      ],
      [boom, rejects, ok],
    );
    expect(results.map((r) => r.status)).toEqual([200, 500, 500, 200]);
    expect(results[1].body).toMatchObject({
      code: "internal_error",
      status: 500,
    });
    expect(JSON.stringify(results)).not.toContain("internal detail");
    expect(results[0].body).toEqual({ fine: true });
    expect(spy.mock.calls.flat().join(" ")).not.toContain("internal detail");
  });

  it("calls the handler with a bare GET request for this site: no headers from the client, the path and query as sent", async () => {
    const seen: Request[] = [];
    const GET: BatchHandler = (req) => {
      seen.push(req);
      return Response.json({});
    };
    await runBatch(
      [item("a", "/api/v1/echo?x=1")],
      [stub("/api/v1/echo", GET, ["x"])],
    );
    expect(seen).toHaveLength(1);
    expect(seen[0].method).toBe("GET");
    expect(seen[0].url).toBe(`${SITE_URL}/api/v1/echo?x=1`);
    expect([...seen[0].headers.keys()]).toEqual([]);
  });

  it("hands a {slug} route its slug the way Next 16 does", async () => {
    const GET: BatchHandler = (_req, ctx) =>
      ctx.params.then(({ slug }) => Response.json({ slug }));
    const results = await runBatch(
      [
        item("a", "/api/v1/things/abc-1"),
        item("b", "/api/v1/things/abc-1/deeper"),
      ],
      [stub("/api/v1/things/{slug}", GET)],
    );
    expect(results[0].body).toEqual({ slug: "abc-1" });
    expect(results[1].status).toBe(404);
  });

  it("reports the status of a sub-response that is not JSON with a null body", async () => {
    const results = await runBatch(
      [item("a", "/api/v1/text")],
      [
        stub(
          "/api/v1/text",
          () =>
            new Response("plain", {
              status: 203,
              headers: { "content-type": "text/plain" },
            }),
        ),
      ],
    );
    expect(results).toEqual([{ id: "a", status: 203, body: null }]);
  });

  it("reports a JSON content type with an unparseable body as a null body, not a failure", async () => {
    const results = await runBatch(
      [item("a", "/api/v1/broken")],
      [
        stub(
          "/api/v1/broken",
          () =>
            new Response("{oops", {
              headers: { "content-type": "application/json" },
            }),
        ),
      ],
    );
    expect(results).toEqual([{ id: "a", status: 200, body: null }]);
  });

  it("passes a handler's own error answer through as that item's status and body", async () => {
    const results = await runBatch([
      item("a", "/api/v1/work/Not_A_Real_Slug-1"),
      item("b", "/api/v1/search"),
    ]);
    expect(results[0]).toMatchObject({
      id: "a",
      status: 404,
      body: { code: "not_found" },
    });
    expect(results[1]).toMatchObject({
      id: "b",
      status: 400,
      body: { code: "invalid_request" },
    });
  });

  it(`runs ${BATCH_MAX_REQUESTS} distinct operations in one go`, async () => {
    const requests = Array.from({ length: BATCH_MAX_REQUESTS }, (_, i) =>
      item(`r${i}`, `/api/v1/search?q=${"a".repeat(i + 1)}`),
    );
    const results = await runBatch(requests);
    expect(results).toHaveLength(BATCH_MAX_REQUESTS);
    expect(results.every((r) => r.status === 200)).toBe(true);
  });
});

describe("runBatch on the real routes: which query parameters make two operations different", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  /** What the real route answers for this path called on its own, as { status, body }. */
  async function direct(template: string, search: string) {
    const res = await call(template, { search });
    return { status: res.status, body: await res.json() };
  }

  const queryOf = (path: string) => path.slice(path.indexOf("?"));

  it("gives each search its own answer, where the same route is asked different questions", async () => {
    const paths = ["/api/v1/search?q=kafka", "/api/v1/search?q=mcp", "/api/v1/search?q=zzzz-no-match"];
    const results = await runBatch(paths.map((path, i) => item(`s${i}`, path)));
    for (const [index, path] of paths.entries()) {
      expect({ status: results[index].status, body: results[index].body }, path).toEqual(
        await direct("/api/v1/search", queryOf(path)),
      );
    }
    expect(new Set(results.map((r) => JSON.stringify(r.body))).size).toBe(paths.length);
  });

  it("gives each decisions filter its own answer", async () => {
    const paths = ["/api/v1/decisions?tag=mcp", "/api/v1/decisions?tag=security", "/api/v1/decisions?tag=no-such-tag", "/api/v1/decisions"];
    const results = await runBatch(paths.map((path, i) => item(`d${i}`, path)));
    for (const [index, path] of paths.entries()) {
      const search = path.includes("?") ? queryOf(path) : "";
      expect({ status: results[index].status, body: results[index].body }, path).toEqual(
        await direct("/api/v1/decisions", search),
      );
    }
    expect(new Set(results.map((r) => JSON.stringify(r.body))).size).toBe(paths.length);
  });

  it("does not let a second ? hide a difference: the whole query is read, as the route reads it", async () => {
    const searches = ["/api/v1/search?q=trelix", "/api/v1/search?q=trelix?zzzznotthere"];
    const decisions = ["/api/v1/decisions?tag=security", "/api/v1/decisions?tag=security?nonexistenttagzzz"];
    for (const [template, paths] of [["/api/v1/search", searches], ["/api/v1/decisions", decisions]] as const) {
      const results = await runBatch(paths.map((path, i) => item(`r${i}`, path)));
      for (const [index, path] of paths.entries()) {
        expect({ status: results[index].status, body: results[index].body }, path).toEqual(
          await direct(template, queryOf(path)),
        );
      }
      expect(results[0].body, template).not.toEqual(results[1].body);
    }
  });

  it("treats a parameter a route does not read as no difference, exactly as the route does", async () => {
    const pairs = [
      ["/api/v1/work", "/api/v1/work?junk=1&x=%2e"],
      ["/api/v1/profile", "/api/v1/profile?junk=1"],
      ["/api/v1/search?q=kafka", "/api/v1/search?q=kafka&junk=1"],
      ["/api/v1/decisions?tag=mcp", "/api/v1/decisions?junk=2&tag=mcp"],
    ] as const;
    for (const [plain, noisy] of pairs) {
      const [a, b] = await runBatch([item("a", plain), item("b", noisy)]);
      expect(b.body, noisy).toEqual(a.body);
      const template = plain.split("?")[0];
      expect(a.body, plain).toEqual((await direct(template, plain.includes("?") ? queryOf(plain) : "")).body);
      expect(b.body, noisy).toEqual((await direct(template, queryOf(noisy))).body);
    }
  });
});

describe("the answer cap", () => {
  const result = (id: string, body: unknown) => ({ id, status: 200, body });

  it("measures the serialized answer in bytes, the way it is sent", () => {
    const results = [result("a", { text: "€€€" })];
    expect(responseBytes(results)).toBe(Buffer.byteLength(JSON.stringify({ responses: results })));
    expect(responseBytes(results)).toBeGreaterThan(JSON.stringify({ responses: results }).length);
  });

  it("answers 200 with the results, as JSON that is never cached, when they fit", async () => {
    const results = [result("a", { n: 1 }), result("b", null)];
    const res = answerBatch(results);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ responses: results });
  });

  it("allows an answer of exactly the cap and refuses one byte more", async () => {
    const results = [result("a", { text: "x".repeat(200) })];
    const exact = responseBytes(results);
    expect(answerBatch(results, exact).status).toBe(200);
    expect(answerBatch(results, exact - 1).status).toBe(413);
  });

  it("counts bytes, not characters, against the cap", () => {
    const results = [result("a", { text: "€".repeat(100) })];
    const characters = JSON.stringify({ responses: results }).length;
    expect(answerBatch(results, characters).status).toBe(413);
    expect(answerBatch(results, responseBytes(results)).status).toBe(200);
  });

  it("refuses an answer over the cap as a whole: a 413 with the shared error body and none of the results", async () => {
    const results = [result("a", { text: "x".repeat(500) }), result("b", { text: "y".repeat(500) })];
    const res = answerBatch(results, 600);
    expect(res.status).toBe(413);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body).toMatchObject({ code: "payload_too_large", status: 413 });
    expect(body.error).toContain("600");
    expect(body.hint).toContain("600");
    expect(body.hint).toContain("fewer or smaller operations");
    expect(JSON.stringify(body)).not.toMatch(/responses|xxxxx|yyyyy/);
  });

  it("defaults to the published cap", () => {
    const results = [result("a", { text: "x".repeat(BATCH_MAX_RESPONSE_BYTES) })];
    expect(answerBatch(results).status).toBe(413);
    expect(answerBatch([result("a", { text: "x".repeat(1000) })]).status).toBe(200);
  });

  it("refuses as a whole a batch whose stubbed route answers more than the cap, and runs nothing else", async () => {
    const big: BatchRoute = {
      template: "/api/v1/big",
      load: async () => ({ GET: () => Response.json({ text: "x".repeat(BATCH_MAX_RESPONSE_BYTES) }) }),
    };
    const small: BatchRoute = {
      template: "/api/v1/small",
      load: async () => ({ GET: () => Response.json({ ok: true }) }),
    };
    const results = await runBatch([item("a", "/api/v1/small"), item("b", "/api/v1/big")], [big, small]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const res = answerBatch(results);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: "payload_too_large" });
  });
});

describe("the largest honest batch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Every distinct operation worth trying: each route, each real slug, many searches, each decisions tag. */
  function candidates(): string[] {
    const searches = [..."abcdefghijklmnopqrstuvwxyz0123456789"].map((q) => `/api/v1/search?q=${q}`);
    const words = ["agent", "llm", "python", "go", "mcp", "kafka", "aws", "api", "data", "ai"];
    const tags = [...new Set(allDecisions.flatMap((entry) => entry.tags))];
    return [
      ...BATCH_ROUTES.filter((route) => !route.template.includes("{slug}")).map((route) => route.template),
      ...allWork.map((w) => `/api/v1/work/${w.slug}`),
      ...allProjects.map((p) => `/api/v1/projects/${p.slug}`),
      ...allArticles.map((a) => `/api/v1/articles/${a.slug}`),
      ...allNotes.map((n) => `/api/v1/notes/${n.slug}`),
      ...searches,
      ...words.map((q) => `/api/v1/search?q=${q}`),
      ...tags.map((tag) => `/api/v1/decisions?tag=${tag}`),
    ];
  }

  it("is at most 25 different operations, so what a batch can pull is bounded by what 25 routes hold: well under half the cap", async () => {
    const paths = candidates();
    expect(paths.length).toBeGreaterThan(BATCH_MAX_REQUESTS);
    const sized = await runBatch(paths.map((path, index) => item(`c${index}`, path)));
    const biggest = sized
      .map((result, index) => ({ path: paths[index], bytes: Buffer.byteLength(JSON.stringify(result)) }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, BATCH_MAX_REQUESTS);

    // It is a legitimate batch: it passes validation, every operation different.
    const requests = biggest.map(({ path }, index) => item(`w${index}`, path));
    expect(parseBatchBody(JSON.stringify({ requests })).ok).toBe(true);

    const worst = responseBytes(await runBatch(requests));
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThan(BATCH_MAX_RESPONSE_BYTES / 2);
  });

  it("is also what the cap leaves room for when every distinct route is asked once", async () => {
    const documented = buildV1Paths();
    const everything = BATCH_ROUTES.map((route, index) => {
      const example = documented[route.template].get.parameters?.find((p) => p.in === "path")?.example;
      return item(`r${index}`, example ? route.template.replace("{slug}", example) : route.template);
    });
    const results = await runBatch(everything);
    expect(answerBatch(results).status).toBe(200);
    expect(BATCH_MAX_RESPONSE_BYTES).toBeGreaterThanOrEqual(2 * responseBytes(results));
  });
});

