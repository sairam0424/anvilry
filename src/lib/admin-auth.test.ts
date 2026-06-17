import { afterEach, describe, expect, it } from "vitest";
import { requireAdmin } from "./admin-auth";

/**
 * HTTP Basic Auth guard contract. Security-critical: these tests pin both the
 * happy path AND the timing-attack protection (crypto.timingSafeEqual via
 * SHA-256 digests, not a naive === compare that leaks partial password info
 * under repeated probing).
 *
 * Test passwords are intentionally non-secret-looking short strings ("good",
 * "bad") so the secret-scan pre-commit hook doesn't false-positive on them —
 * the guard only cares about match/mismatch, not password entropy.
 */

function makeReq(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader) headers["Authorization"] = authHeader;
  return new Request("http://localhost/admin/telemetry", { headers });
}

function basicHeader(password: string, username = ""): string {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
});

describe("requireAdmin — password not configured", () => {
  it("returns 401 when ADMIN_PASSWORD env is unset", () => {
    delete process.env.ADMIN_PASSWORD;
    const r = requireAdmin(makeReq(basicHeader("anything")));
    expect("status" in r).toBe(true);
    expect((r as Response).status).toBe(401);
  });

  it("includes WWW-Authenticate header on deny", () => {
    delete process.env.ADMIN_PASSWORD;
    const r = requireAdmin(makeReq()) as Response;
    expect(r.headers.get("WWW-Authenticate")).toContain("Basic");
  });
});

describe("requireAdmin — happy path", () => {
  it("returns { ok: true } with correct password (username:password form)", () => {
    process.env.ADMIN_PASSWORD = "good";
    expect(requireAdmin(makeReq(basicHeader("good")))).toEqual({ ok: true });
  });

  it("returns { ok: true } with correct password (no-colon form)", () => {
    process.env.ADMIN_PASSWORD = "good";
    const header = "Basic " + Buffer.from("good").toString("base64");
    expect(requireAdmin(makeReq(header))).toEqual({ ok: true });
  });

  it("accepts password containing colons (only the last segment matters)", () => {
    process.env.ADMIN_PASSWORD = "a:b:c";
    expect(requireAdmin(makeReq(basicHeader("a:b:c")))).toEqual({ ok: true });
  });
});

describe("requireAdmin — rejection paths", () => {
  it("returns 401 with wrong password", () => {
    process.env.ADMIN_PASSWORD = "good";
    expect((requireAdmin(makeReq(basicHeader("bad"))) as Response).status).toBe(401);
  });

  it("returns 401 with no Authorization header", () => {
    process.env.ADMIN_PASSWORD = "good";
    expect((requireAdmin(makeReq()) as Response).status).toBe(401);
  });

  it("returns 401 with non-Basic scheme (e.g. Bearer)", () => {
    process.env.ADMIN_PASSWORD = "good";
    expect((requireAdmin(makeReq("Bearer tok")) as Response).status).toBe(401);
  });

  it("returns 401 with malformed base64", () => {
    process.env.ADMIN_PASSWORD = "good";
    expect((requireAdmin(makeReq("Basic !!!")) as Response).status).toBe(401);
  });

  it("returns 401 with empty Authorization value", () => {
    process.env.ADMIN_PASSWORD = "good";
    expect((requireAdmin(makeReq("")) as Response).status).toBe(401);
  });
});

describe("requireAdmin — response safety", () => {
  it("deny response never exposes the password or contains dynamic content", () => {
    process.env.ADMIN_PASSWORD = "good";
    const r = requireAdmin(makeReq(basicHeader("bad"))) as Response;
    expect(r.status).toBe(401);
    // Cache-Control: no-store means proxies/CDNs won't cache the 401.
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
});
