import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract for POST /api/admin/faq-cache/purge. Auth is the real requireAdmin
 * (its own suite lives in src/lib/admin-auth.test.ts); only redis is mocked so
 * the success path exercises the real faqCachePurge key derivation.
 */

const { redisMock } = vi.hoisted(() => ({
  redisMock: { del: vi.fn(), zrem: vi.fn() },
}));

vi.mock("@/lib/redis", () => ({ redis: redisMock }));

import { POST } from "./route";

const ADMIN_SECRET = "good";
const QUESTION = "What is Pensieve?";
const OVERSIZE_CONTENT_LENGTH = String(5 * 1024);

function basic(secret: string): string {
  return "Basic " + Buffer.from(`admin:${secret}`).toString("base64");
}

function makeReq(
  body: unknown,
  authorization?: string,
  extra?: Record<string, string>,
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (authorization) headers["Authorization"] = authorization;
  return new Request("http://localhost/api/admin/faq-cache/purge", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.ADMIN_PASSWORD = ADMIN_SECRET;
  redisMock.del.mockReset();
  redisMock.zrem.mockReset();
});

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
});

describe("POST /api/admin/faq-cache/purge — auth", () => {
  it("returns 401 without credentials and never touches redis", async () => {
    const res = await POST(makeReq({ question: QUESTION }));
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Basic");
    expect(redisMock.del).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong credential and never touches redis", async () => {
    const res = await POST(makeReq({ question: QUESTION }, basic("bad")));
    expect(res.status).toBe(401);
    expect(redisMock.del).not.toHaveBeenCalled();
  });

  it("returns 401 when ADMIN_PASSWORD is unset", async () => {
    delete process.env.ADMIN_PASSWORD;
    const res = await POST(
      makeReq({ question: QUESTION }, basic(ADMIN_SECRET)),
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/faq-cache/purge — authenticated", () => {
  it("purges an existing entry and removes it from the index", async () => {
    redisMock.del.mockResolvedValue(1);
    redisMock.zrem.mockResolvedValue(1);
    const res = await POST(
      makeReq({ question: QUESTION }, basic(ADMIN_SECRET)),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("purged");
    expect(redisMock.del).toHaveBeenCalledWith(json.key);
    expect(redisMock.zrem).toHaveBeenCalledWith(expect.any(String), json.key);
  });

  it("reports not_found with 200 when nothing was deleted", async () => {
    redisMock.del.mockResolvedValue(0);
    redisMock.zrem.mockResolvedValue(0);
    const res = await POST(
      makeReq({ question: "unknown" }, basic(ADMIN_SECRET)),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("not_found");
  });

  it("returns 503 when redis throws", async () => {
    redisMock.del.mockRejectedValue(new Error("boom"));
    const res = await POST(
      makeReq({ question: QUESTION }, basic(ADMIN_SECRET)),
    );
    expect(res.status).toBe(503);
  });

  it("returns 400 for a missing or blank question", async () => {
    const missing = await POST(makeReq({}, basic(ADMIN_SECRET)));
    const blank = await POST(makeReq({ question: "   " }, basic(ADMIN_SECRET)));
    expect(missing.status).toBe(400);
    expect(blank.status).toBe(400);
  });

  it("returns 413 for a declared oversize body", async () => {
    const res = await POST(
      makeReq({ question: QUESTION }, basic(ADMIN_SECRET), {
        "content-length": OVERSIZE_CONTENT_LENGTH,
      }),
    );
    expect(res.status).toBe(413);
  });
});
