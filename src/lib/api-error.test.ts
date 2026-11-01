import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  API_ERROR_CODES,
  ERROR_DOCS_URL,
  apiError,
  ensureJsonError,
  methodNotAllowed,
  optionsFor,
  withJsonErrors,
} from "./api-error";

async function body(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

describe("apiError", () => {
  it("returns JSON with the status, a stable code, a message and a docs link", async () => {
    const res = apiError(404, "not_found", "No such API route.");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    const json = await body(res);
    expect(json.code).toBe("not_found");
    expect(json.status).toBe(404);
    expect(json.docs).toBe(ERROR_DOCS_URL);
  });

  it("keeps the legacy `error` string so existing clients keep working", async () => {
    const json = await body(
      apiError(400, "invalid_request", "Invalid request."),
    );
    expect(json.error).toBe("Invalid request.");
  });

  it("falls back to the catalogue hint and lets a caller override it", async () => {
    const dflt = await body(apiError(429, "rate_limited", "Slow down."));
    expect(typeof dflt.hint).toBe("string");
    expect((dflt.hint as string).length).toBeGreaterThan(10);
    const custom = await body(
      apiError(429, "rate_limited", "Slow down.", { hint: "Wait 12 seconds." }),
    );
    expect(custom.hint).toBe("Wait 12 seconds.");
  });

  it("never caches an error and passes extra headers through", () => {
    const res = apiError(429, "rate_limited", "Slow down.", {
      headers: { "Retry-After": "12" },
    });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("retry-after")).toBe("12");
  });

  it("documents every code it can emit, each bound to exactly one HTTP status", () => {
    const codes = API_ERROR_CODES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const entry of API_ERROR_CODES) {
      expect(entry.status).toBeGreaterThanOrEqual(400);
      expect(entry.status).toBeLessThan(600);
      expect(entry.meaning.length).toBeGreaterThan(10);
      expect(entry.hint.length).toBeGreaterThan(10);
    }
  });

  it("rejects a status that disagrees with the catalogue (a typo guard)", () => {
    expect(() => apiError(500, "not_found", "x")).toThrow(/not_found/);
  });
});

describe("methodNotAllowed", () => {
  it("answers 405 as JSON and lists the allowed methods", async () => {
    const res = methodNotAllowed(["GET", "HEAD"])();
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    const json = await body(res);
    expect(json.code).toBe("method_not_allowed");
    expect(json.hint).toContain("GET, HEAD, OPTIONS");
  });
});

describe("ensureJsonError", () => {
  it("leaves successful and already-JSON responses untouched", async () => {
    const ok = new Response("fine", { status: 200 });
    expect(await ensureJsonError(ok)).toBe(ok);
    const rpc = Response.json({ jsonrpc: "2.0", error: { code: -32000 } }, { status: 400 });
    expect(await ensureJsonError(rpc)).toBe(rpc);
  });

  it("turns a plain-text error into the shared JSON shape, keeping status and Allow", async () => {
    const res = await ensureJsonError(
      new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    const json = await body(res);
    expect(json.code).toBe("not_found");
    expect(json.error).toBe("Not found");

    const withAllow = await ensureJsonError(
      new Response("", { status: 405, headers: { Allow: "GET, POST" } }),
    );
    expect(withAllow.headers.get("allow")).toBe("GET, POST");
    expect((await body(withAllow)).code).toBe("method_not_allowed");
  });

  it("only labels a JSON-RPC body that arrived without a content type, never rewrites it", async () => {
    const raw = '{"jsonrpc":"2.0","error":{"code":-32000,"message":"Bad"},"id":null}';
    const res = await ensureJsonError(new Response(raw, { status: 400 }));
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.text()).toBe(raw);
  });

  it("passes through a status the catalogue does not describe", async () => {
    const res = await ensureJsonError(new Response("teapot", { status: 418 }));
    expect(res.status).toBe(418);
    expect(await res.text()).toBe("teapot");
  });

  it("bounds the echoed message", async () => {
    const res = await ensureJsonError(new Response("x".repeat(5000), { status: 400 }));
    expect(((await body(res)).error as string).length).toBeLessThanOrEqual(200);
  });
});

describe("withJsonErrors", () => {
  it("passes a normal response through untouched", async () => {
    const wrapped = withJsonErrors(() => new Response("ok", { status: 200 }));
    const res = await wrapped();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("turns a thrown error into the shared 500 body and never leaks the cause", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapped = withJsonErrors(() => {
      throw new Error("secret connection string");
    });
    const res = await wrapped();
    expect(res.status).toBe(500);
    const b = await body(res);
    expect(b).toMatchObject({ code: "internal_error", status: 500 });
    expect(JSON.stringify(b)).not.toContain("secret");
    expect(spy.mock.calls.flat().join(" ")).not.toContain("secret");
    spy.mockRestore();
  });

  it("also catches a rejected promise from an async handler", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapped = withJsonErrors(async () => {
      throw new TypeError("boom");
    });
    expect((await wrapped()).status).toBe(500);
    spy.mockRestore();
  });

  it("forwards the handler's arguments", async () => {
    const wrapped = withJsonErrors((a: number, b: number) => new Response(String(a + b)));
    expect(await (await wrapped(2, 3)).text()).toBe("5");
  });
});

describe("optionsFor", () => {
  it("answers 204 with an Allow header equal to the 405 answer's", () => {
    const res = optionsFor(["GET", "HEAD"])();
    expect(res.status).toBe(204);
    expect(res.headers.get("allow")).toBe(methodNotAllowed(["GET", "HEAD"])().headers.get("allow"));
  });
});

describe("the error catalogue", () => {
  it("describes payload_too_large as a body or an answer that is too big, because both raise it", () => {
    // The batch endpoint answers 413 when the request body is too big and also when the answer it
    // would send is, so the catalogue /developers prints must not claim it is only about the request.
    const entry = API_ERROR_CODES.find((c) => c.code === "payload_too_large");
    expect(entry?.status).toBe(413);
    expect(entry?.meaning).toMatch(/request body/i);
    expect(entry?.meaning).toMatch(/answer|response/i);
    expect(entry?.hint).toMatch(/ask for less/i);
  });

  it("has no dead code: every documented code is emitted by some source file", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) files.push(full);
      }
    };
    walk(join(process.cwd(), "src"));
    const sources = files.map((f) => readFileSync(f, "utf-8"));
    for (const { code } of API_ERROR_CODES) {
      // One occurrence is the catalogue entry itself; a second is an emitter.
      const uses = sources.reduce((n, src) => n + (src.split(`"${code}"`).length - 1), 0);
      expect(uses, `"${code}" is documented but nothing emits it`).toBeGreaterThanOrEqual(2);
    }
  });
});
