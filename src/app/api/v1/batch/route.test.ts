import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BATCH_MAX_BODY_BYTES,
  BATCH_MAX_REQUESTS,
  BATCH_MAX_RESPONSE_BYTES,
  BATCH_PATH,
} from "@/lib/api-policy";
import { SITE_URL } from "@/lib/site-url";
import { call, check, expectApiError } from "../v1-test-support";
import * as route from "./route";

/**
 * The HTTP contract of POST /api/v1/batch: what it takes, what it answers for each kind of bad
 * input, and that a good batch returns what the real routes return. The logic itself (validation
 * table, registry, execution) is in src/lib/batch.test.ts; the proxy's part (method table, budget)
 * is in src/proxy.test.ts. Nothing here depends on NEXT_PUBLIC_NOTES_ENABLED: where a notes or
 * articles item appears it is compared with the real handler under the same flags.
 */

const BATCH_RESPONSE = { $ref: "#/components/schemas/BatchResponse" };

const item = (id: string, path: string) => ({ id, path });
const payload = (requests: unknown) => JSON.stringify({ requests });

function post(
  body: BodyInit | null,
  headers: Record<string, string> = { "content-type": "application/json" },
): Request {
  return new Request(`${SITE_URL}${BATCH_PATH}`, {
    method: "POST",
    headers,
    body,
  });
}

const send = (requests: unknown) => route.POST(post(payload(requests)));

/** A valid batch padded with spaces to exactly `bytes` bytes. */
function batchOfBytes(bytes: number): string {
  const base = payload([item("a", "/api/v1/profile")]);
  return base + " ".repeat(bytes - Buffer.byteLength(base));
}

beforeEach(() => {
  vi.stubGlobal("fetch", async () => {
    throw new Error("offline");
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/v1/batch: a good batch", () => {
  it("answers 200 with one result per item, in order, equal to what the real routes return", async () => {
    const requests = [
      item("profile", "/api/v1/profile"),
      item("one", "/api/v1/projects/trelix"),
      item("all", "/api/v1/work"),
      item("find", "/api/v1/search?q=kafka"),
      item("tagged", "/api/v1/decisions?tag=mcp"),
      item("cv", "/api/v1/resume"),
      item("gh", "/api/v1/github/stats"),
      item("articles", "/api/v1/articles"),
      item("notes", "/api/v1/notes"),
    ];
    const res = await send(requests);
    expect(res.status).toBe(200);
    const { responses } = await res.json();
    expect(responses.map((r: { id: string }) => r.id)).toEqual(
      requests.map((r) => r.id),
    );

    const real = [
      await call("/api/v1/profile"),
      await call("/api/v1/projects/{slug}", { slug: "trelix" }),
      await call("/api/v1/work"),
      await call("/api/v1/search", { search: "?q=kafka" }),
      await call("/api/v1/decisions", { search: "?tag=mcp" }),
      await call("/api/v1/resume"),
      await call("/api/v1/github/stats"),
      await call("/api/v1/articles"),
      await call("/api/v1/notes"),
    ];
    for (const [index, expected] of real.entries()) {
      expect(responses[index].status, requests[index].id).toBe(expected.status);
      expect(responses[index].body, requests[index].id).toEqual(
        await expected.json(),
      );
    }
  });

  it("answers JSON in UTF-8 that is never cached", async () => {
    const res = await send([item("a", "/api/v1/profile")]);
    expect(res.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("matches the BatchResponse schema exactly, with no key the schema does not declare", async () => {
    const res = await send([
      item("a", "/api/v1/profile"),
      item("b", "/api/v1/projects/no-such-project"),
      item("c", "/api/v1/search"),
      item("d", "/api/v1/not-a-route"),
      item("e", "/api/v1/notes"),
    ]);
    const body = await res.json();
    expect(check(body, BATCH_RESPONSE)).toEqual([]);
    expect(body.responses.map((r: { status: number }) => r.status)).toEqual([
      200, 404, 400, 404, 200,
    ]);
  });

  it("reports no headers and nothing but id, status and body for each item", async () => {
    const { responses } = await (
      await send([item("a", "/api/v1/profile")])
    ).json();
    expect(Object.keys(responses[0]).sort()).toEqual(["body", "id", "status"]);
  });

  it("runs a failing item alongside the others without failing the batch", async () => {
    const res = await send([
      item("ok", "/api/v1/work"),
      item("missing", "/api/v1/work/nope-nope"),
      item("bad", "/api/v1/search?q="),
      item("ok2", "/api/v1/profile"),
    ]);
    expect(res.status).toBe(200);
    const { responses } = await res.json();
    expect(responses.map((r: { status: number }) => r.status)).toEqual([
      200, 404, 400, 200,
    ]);
    expect(responses[1].body).toMatchObject({ code: "not_found" });
    expect(responses[2].body).toMatchObject({ code: "invalid_request" });
  });

  it(`takes ${BATCH_MAX_REQUESTS} operations`, async () => {
    const requests = Array.from({ length: BATCH_MAX_REQUESTS }, (_, i) =>
      item(`r${i}`, `/api/v1/search?q=${"k".repeat(i + 1)}`),
    );
    const res = await send(requests);
    expect(res.status).toBe(200);
    const { responses } = await res.json();
    expect(responses.map((r: { id: string }) => r.id)).toEqual(
      requests.map((r) => r.id),
    );
  });

  it("accepts a charset parameter on the content type and an explicit GET method", async () => {
    const body = JSON.stringify({
      requests: [{ id: "a", method: "GET", path: "/api/v1/profile" }],
    });
    const res = await route.POST(
      post(body, { "content-type": "Application/JSON; charset=utf-8" }),
    );
    expect(res.status).toBe(200);
  });

  it("takes a body of exactly the size limit", async () => {
    const body = batchOfBytes(BATCH_MAX_BODY_BYTES);
    expect(Buffer.byteLength(body)).toBe(BATCH_MAX_BODY_BYTES);
    expect((await route.POST(post(body))).status).toBe(200);
  });
});

describe("POST /api/v1/batch: validation is all or nothing", () => {
  it(`rejects ${BATCH_MAX_REQUESTS + 1} operations with a 400 and no results`, async () => {
    const requests = Array.from({ length: BATCH_MAX_REQUESTS + 1 }, (_, i) =>
      item(`r${i}`, "/api/v1/profile"),
    );
    const body = await expectApiError(
      await send(requests),
      400,
      "invalid_request",
    );
    expect(body.hint).toContain(`1 to ${BATCH_MAX_REQUESTS}`);
  });

  it("rejects an empty list", async () => {
    await expectApiError(await send([]), 400, "invalid_request");
  });

  it("runs nothing when any item is invalid, even one after valid items that would reach GitHub", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const res = await send([
      item("gh", "/api/v1/github/stats"),
      item("ok", "/api/v1/profile"),
      item("bad", "/api/v1/../admin"),
    ]);
    const body = await expectApiError(res, 400, "invalid_request");
    expect(body.hint).toContain("requests[2]");
    expect(body).not.toHaveProperty("responses");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("names the offending item in the hint and never repeats what was sent", async () => {
    const res = await send([
      item("a", "/api/v1/profile"),
      item("a", "/api/v1/work"),
    ]);
    const body = await expectApiError(res, 400, "invalid_request");
    expect(body.hint).toContain("requests[1]");
    expect(body.hint).toContain("requests[0]");
  });

  it("rejects traversal, absolute URLs, hosts and a batch inside a batch", async () => {
    for (const path of [
      "/api/v1/../chat",
      "/api/v1/%2e%2e/chat",
      "/api/v1/%2e%2e%2fchat",
      "https://evil.example/api/v1/profile",
      "//evil.example/api/v1/profile",
      "/api/v1\\profile",
      "/api/v1/profile\u0000",
      BATCH_PATH,
      "/api/chat",
      "/api/cron/eval",
      "/api/admin/faq-cache/purge",
    ]) {
      const body = await expectApiError(
        await send([item("x", path)]),
        400,
        "invalid_request",
      );
      expect(body.hint, path).toContain("requests[0]");
    }
  });

  it("rejects a method other than GET", async () => {
    const res = await route.POST(
      post(
        JSON.stringify({
          requests: [{ id: "a", method: "DELETE", path: "/api/v1/profile" }],
        }),
      ),
    );
    const body = await expectApiError(res, 400, "invalid_request");
    expect(body.hint).toContain("GET");
  });

  it("rejects a body that is not JSON, not UTF-8, empty or not an object", async () => {
    const bodies: BodyInit[] = [
      "not json",
      "",
      "[]",
      "null",
      '{"requests":',
      new Uint8Array([0x7b, 0xff, 0x7d]),
    ];
    for (const body of bodies) {
      await expectApiError(
        await route.POST(post(body)),
        400,
        "invalid_request",
      );
    }
    await expectApiError(await route.POST(post(null)), 400, "invalid_request");
  });

  it("rejects a content type that is not application/json", async () => {
    const body = payload([item("a", "/api/v1/profile")]);
    for (const headers of [
      { "content-type": "text/plain" },
      { "content-type": "application/x-www-form-urlencoded" },
      {},
    ] as Record<string, string>[]) {
      const res = await route.POST(post(body, headers));
      const error = await expectApiError(res, 400, "invalid_request");
      expect(error.hint, JSON.stringify(headers)).toContain("application/json");
    }
  });
});

describe("POST /api/v1/batch: the size limit", () => {
  it("answers 413 payload_too_large for a body one byte over the limit, before parsing it", async () => {
    const res = await route.POST(post(batchOfBytes(BATCH_MAX_BODY_BYTES + 1)));
    const body = await expectApiError(res, 413, "payload_too_large");
    expect(body.error).toContain(String(BATCH_MAX_BODY_BYTES));
  });

  it("measures bytes, not characters: a body of three-byte characters is refused with far fewer characters than the limit", async () => {
    const body = JSON.stringify({
      requests: [item("a", "/api/v1/profile")],
      pad: "€".repeat(Math.ceil(BATCH_MAX_BODY_BYTES / 3)),
    });
    expect(body.length).toBeLessThan(BATCH_MAX_BODY_BYTES);
    expect(Buffer.byteLength(body)).toBeGreaterThan(BATCH_MAX_BODY_BYTES);
    await expectApiError(
      await route.POST(post(body)),
      413,
      "payload_too_large",
    );
  });

  it("answers 413 for a body far over the limit", async () => {
    const res = await route.POST(post("x".repeat(BATCH_MAX_BODY_BYTES * 8)));
    await expectApiError(res, 413, "payload_too_large");
  });

  it("answers 413 for a streamed body with no Content-Length", async () => {
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        if (sent > 1000) controller.close();
        else controller.enqueue(new Uint8Array(1024).fill(0x20));
      },
    });
    const req = new Request(`${SITE_URL}${BATCH_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expectApiError(await route.POST(req), 413, "payload_too_large");
    expect(sent).toBeLessThan(100);
  });
});

describe("/api/v1/batch: other methods", () => {
  it("answers GET, PUT, PATCH and DELETE with a JSON 405 that advertises POST", async () => {
    for (const method of ["GET", "PUT", "PATCH", "DELETE"] as const) {
      const res = route[method]();
      const body = await expectApiError(res, 405, "method_not_allowed");
      expect(res.headers.get("allow"), method).toBe("POST, OPTIONS");
      expect(body.hint, method).toContain("POST");
    }
  });

  it("answers OPTIONS with 204 and the same Allow list", () => {
    const res = route.OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("allow")).toBe("POST, OPTIONS");
  });

  it("exports exactly the methods it answers, so Next treats it as dynamic and HEAD falls to the GET 405", () => {
    expect(Object.keys(route).sort()).toEqual([
      "DELETE",
      "GET",
      "OPTIONS",
      "PATCH",
      "POST",
      "PUT",
    ]);
  });
});

describe("POST /api/v1/batch: what a batch cannot be made to do", () => {
  const callsFor = async (run: () => Promise<unknown>) => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      urls.push(String(input instanceof Request ? input.url : input));
      throw new Error("offline");
    });
    await run();
    return urls;
  };

  it("makes no outbound request of its own: only the GitHub calls the statistics route already makes", async () => {
    const urls = await callsFor(() => send([item("gh", "/api/v1/github/stats"), item("p", "/api/v1/profile"), item("s", "/api/v1/search?q=kafka")]));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.startsWith("https://api.github.com/"), url).toBe(true);
  });

  it("refuses to ask for the same operation 25 ways, so the one route that calls GitHub is called at most once per batch", async () => {
    const requests = Array.from({ length: BATCH_MAX_REQUESTS }, (_, i) =>
      item(`g${i}`, i % 2 ? `/api/v1/github/stats?x=${i}` : "/api/v1/github/stats"),
    );
    let outbound = 0;
    const urls = await callsFor(async () => {
      const body = await expectApiError(await send(requests), 400, "invalid_request");
      expect(body.hint).toContain("requests[1] repeats requests[0]; send each operation once");
    });
    outbound = urls.length;
    expect(outbound).toBe(0);
  });

  it("cannot name a batch inside a batch, so a batch cannot recurse or fan out", async () => {
    const body = await expectApiError(await send([item("outer", BATCH_PATH)]), 400, "invalid_request");
    expect(body.hint).toContain("another batch");
    const nested = await send([item("a", "/api/v1/batch/anything"), item("b", `${BATCH_PATH}/`)]);
    expect(nested.status).toBe(400);
  });

  it("can reach only what the batch registry lists: an unlisted but well-formed path is a 404 item, not a call", async () => {
    const res = await send([item("a", "/api/v1/admin"), item("b", "/api/v1/cron/eval"), item("c", "/api/v1/chat")]);
    expect(res.status).toBe(200);
    const { responses } = await res.json();
    expect(responses.map((r: { status: number }) => r.status)).toEqual([404, 404, 404]);
  });
});

describe("POST /api/v1/batch: each operation may appear once", () => {
  it("rejects 25 copies of the largest route with a 400 that names the repeat, and runs nothing", async () => {
    const requests = Array.from({ length: BATCH_MAX_REQUESTS }, (_, i) => item(`d${i}`, "/api/v1/decisions"));
    expect(Buffer.byteLength(payload(requests))).toBeLessThan(BATCH_MAX_BODY_BYTES);
    const fetchSpy = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await send(requests);
    const body = await expectApiError(res, 400, "invalid_request");
    expect(body.hint).toContain("requests[1] repeats requests[0]; send each operation once");
    expect(body).not.toHaveProperty("responses");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a repeat hidden behind a parameter the route ignores, in either order", async () => {
    for (const [first, second] of [
      ["/api/v1/decisions", "/api/v1/decisions?cachebust=1"],
      ["/api/v1/decisions?tag=mcp&a=1", "/api/v1/decisions?b=2&tag=mcp"],
      ["/api/v1/resume?x=1", "/api/v1/resume"],
    ]) {
      await expectApiError(await send([item("a", first), item("b", second)]), 400, "invalid_request");
    }
  });

  it("accepts the same route asked different questions", async () => {
    const res = await send([
      item("a", "/api/v1/decisions?tag=mcp"),
      item("b", "/api/v1/decisions?tag=security"),
      item("c", "/api/v1/decisions"),
    ]);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/v1/batch: the answer cap", () => {
  it("sends the largest honest batch whole: the biggest operations of this API, all different, are far under the cap", async () => {
    const requests = [
      item("decisions", "/api/v1/decisions"),
      item("resume", "/api/v1/resume"),
      item("projects", "/api/v1/projects"),
      item("articles", "/api/v1/articles"),
      item("work", "/api/v1/work"),
      ...Array.from({ length: BATCH_MAX_REQUESTS - 5 }, (_, i) => item(`s${i}`, `/api/v1/search?q=${String.fromCharCode(97 + i)}`)),
    ];
    expect(requests).toHaveLength(BATCH_MAX_REQUESTS);
    const res = await send(requests);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(Buffer.byteLength(text)).toBeLessThan(BATCH_MAX_RESPONSE_BYTES / 2);
    expect(JSON.parse(text).responses).toHaveLength(BATCH_MAX_REQUESTS);
  });

  it("is not triggered by a batch of every distinct route", async () => {
    const res = await send([
      item("a", "/api/v1"), item("b", "/api/v1/profile"), item("c", "/api/v1/work"), item("d", "/api/v1/projects"),
      item("e", "/api/v1/articles"), item("f", "/api/v1/notes"), item("g", "/api/v1/decisions"), item("h", "/api/v1/search?q=kafka"),
      item("i", "/api/v1/resume"), item("j", "/api/v1/github/stats"),
    ]);
    expect(res.status).toBe(200);
  });
});

