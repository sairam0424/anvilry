import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

/** Contract for the /admin/* Basic-auth gate in the Next 16 proxy. */

const ADMIN_SECRET = "good";
const PASS_THROUGH_HEADER = "x-middleware-next";

function makeReq(authorization?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authorization) headers["Authorization"] = authorization;
  return new NextRequest("http://localhost/admin/telemetry", { headers });
}

function basic(secret: string): string {
  return "Basic " + Buffer.from(`admin:${secret}`).toString("base64");
}

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
});

describe("proxy — /admin/* gate", () => {
  it("denies with 401 and a challenge when ADMIN_PASSWORD is unset", async () => {
    const res = await proxy(makeReq(basic(ADMIN_SECRET)));
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Basic");
  });

  it("denies a request with no Authorization header", async () => {
    process.env.ADMIN_PASSWORD = ADMIN_SECRET;
    expect((await proxy(makeReq())).status).toBe(401);
  });

  it("denies a wrong credential, including a same-length one", async () => {
    process.env.ADMIN_PASSWORD = ADMIN_SECRET;
    expect((await proxy(makeReq(basic("bad")))).status).toBe(401);
    expect((await proxy(makeReq(basic("goof")))).status).toBe(401);
  });

  it("denies malformed base64", async () => {
    process.env.ADMIN_PASSWORD = ADMIN_SECRET;
    expect((await proxy(makeReq("Basic !!!"))).status).toBe(401);
  });

  it("lets correct credentials through in both credential forms", async () => {
    process.env.ADMIN_PASSWORD = ADMIN_SECRET;
    const full = await proxy(makeReq(basic(ADMIN_SECRET)));
    expect(full.headers.get(PASS_THROUGH_HEADER)).toBe("1");
    const bare = "Basic " + Buffer.from(ADMIN_SECRET).toString("base64");
    expect((await proxy(makeReq(bare))).headers.get(PASS_THROUGH_HEADER)).toBe(
      "1",
    );
  });
});
