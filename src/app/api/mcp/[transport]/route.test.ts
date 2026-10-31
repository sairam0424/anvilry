import { describe, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST, PUT } from "./route";

const URL_BASE = "https://anvilry.vercel.app/api/mcp";

describe("MCP route error shapes", () => {
  it("answers an unknown transport with the JSON error shape", async () => {
    const res = await GET(new Request(`${URL_BASE}/nope`));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect((await res.json()).code).toBe("not_found");
  });

  it("keeps the disabled legacy SSE path a JSON 404", async () => {
    const res = await GET(new Request(`${URL_BASE}/sse`));
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  });

  it("rejects PUT and PATCH as JSON 405 listing the allowed methods", async () => {
    for (const handler of [PUT, PATCH]) {
      const res = handler();
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("GET, POST, DELETE, OPTIONS");
    }
  });

  it("still serves a valid MCP initialize request on the Streamable HTTP path", async () => {
    const res = await POST(
      new Request(`${URL_BASE}/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "vitest", version: "0" },
          },
        }),
      }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("protocolVersion");
  });

  it("answers tools/list statelessly, which is the call /developers shows as a first request", async () => {
    const res = await POST(
      new Request(`${URL_BASE}/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("get_profile");
    expect(text).toContain("list_decisions");
  });

  it("exports DELETE so a client can end a session", () => {
    expect(typeof DELETE).toBe("function");
  });
});
