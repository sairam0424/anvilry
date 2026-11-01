import { describe, expect, it } from "vitest";
import { POST } from "./route";
import {
  DEFAULT_REQUEST_ID,
  MCP_HEADERS,
  expectRpcError,
  only,
  request,
  rpcBody,
  send,
  toolCall,
  toolErrorText,
  type RpcMessage,
} from "./mcp-test-support";

describe("MCP error answers", () => {
  it("answers an unknown tool with an isError result that names it", async () => {
    const message = only(await send({ POST }, toolCall("no_such_tool", {}, 7)));
    expect(message.id).toBe(7);
    expect(toolErrorText(message)).toContain("no_such_tool");
  });

  it.each([
    ["a number", 17],
    ["a string", "abc-1"],
  ])("answers an unknown method with -32601 and echoes the id (%s)", async (_label, id) => {
    const message = only(await send({ POST }, request("foo/bar", undefined, id)));
    expectRpcError(message, id);
    expect(message.error?.code).toBe(-32601);
  });

  it.each([
    ["an object", { hello: "world" }, null],
    ["a string", "hi", null],
    ["null", null, null],
    ["a number", 42, null],
    ["an empty batch", [], null],
    ["a batch whose member is not a message (the whole array is rejected)", [1], null],
    ["a request of the wrong JSON-RPC version", { jsonrpc: "1.0", id: 3, method: "tools/list" }, 3],
    ["a request with no method", { jsonrpc: "2.0", id: 4 }, 4],
    ["a request whose method is not a string", { jsonrpc: "2.0", id: "m-5", method: 5 }, "m-5"],
    ["a request whose params are an array", { jsonrpc: "2.0", id: 6, method: "tools/call", params: [1] }, 6],
  ])("answers JSON that is not JSON-RPC (%s) with an Invalid Request error", async (_label, body, id) => {
    const outcome = await send({ POST }, JSON.stringify(body));
    expect(outcome.status).toBe(400);
    expect(outcome.contentType).toMatch(/^application\/json/);
    const message = only(outcome);
    expectRpcError(message, id);
    expect(message.error?.code).toBe(-32600);
  });

  it("keeps -32700 for a body that is not JSON at all, and for an empty one", async () => {
    for (const body of ["{not json", "", undefined]) {
      const outcome = await send({ POST }, body);
      expect(outcome.status).toBe(400);
      const message = only(outcome);
      expectRpcError(message, null);
      expect(message.error?.code).toBe(-32700);
    }
  });

  // A request that is a well-formed JSON-RPC message but whose params do not fit its method gets a
  // JSON-RPC response (HTTP 200, so MCP clients read the error object), code -32602 and a short
  // sentence. The transport library answers these -32603 (internal error) with a raw dump of the
  // validator's issues as the message; the route replaces that.
  const MAX_INVALID_PARAMS_MESSAGE = 220;
  const validInitialize = {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "vitest", version: "0" },
  };

  it.each([
    ["tools/call with no params", request("tools/call"), "params"],
    ["tools/call whose params have no name", request("tools/call", {}), "params.name"],
    ["tools/call whose name is a number", request("tools/call", { name: 5 }), "params.name"],
    ["tools/call whose arguments are a string", toolCall("get_profile", "str"), "params.arguments"],
    ["tools/call whose arguments are an array", toolCall("get_profile", []), "params.arguments"],
    ["initialize with no params", request("initialize"), "params"],
    ["initialize with empty params", request("initialize", {}), "params.protocolVersion"],
    [
      "initialize whose protocolVersion is a number",
      request("initialize", { ...validInitialize, protocolVersion: 1 }),
      "params.protocolVersion",
    ],
    ["tools/list whose cursor is a number", request("tools/list", { cursor: 5 }), "params.cursor"],
  ])("answers %s with -32602 and a short message, echoing the id", async (_label, body, field) => {
    const outcome = await send({ POST }, body);
    expect(outcome.status).toBe(200);
    expect(outcome.contentType).toMatch(/^application\/json/);
    const message = only(outcome);
    expectRpcError(message, DEFAULT_REQUEST_ID);
    expect(message.error?.code).toBe(-32602);
    const text = message.error?.message as string;
    expect(text).toMatch(/^Invalid params for (?:tools\/call|tools\/list|initialize): /);
    expect(text).toContain(field);
    expect(text.length).toBeLessThanOrEqual(MAX_INVALID_PARAMS_MESSAGE);
    expect(text).not.toMatch(/[\n[\]{}]|invalid_type/);
  });

  it("echoes a string id on an invalid-params answer", async () => {
    const message = only(await send({ POST }, request("tools/call", {}, "call-9")));
    expectRpcError(message, "call-9");
    expect(message.error?.code).toBe(-32602);
  });

  it("leaves well-formed calls alone, including a tools/call whose tool does not exist", async () => {
    expect(only(await send({ POST }, request("initialize", validInitialize))).result).toHaveProperty("protocolVersion");
    expect(only(await send({ POST }, request("tools/list", { cursor: "x" }))).result).toHaveProperty("tools");
    expect(only(await send({ POST }, toolCall("no_such_tool", { anything: 1 }))).result?.isError).toBe(true);
    expect(only(await send({ POST }, toolCall("get_profile", { sections: ["links"] }))).error).toBeUndefined();
  });

  it("lets the transport's header checks win over the params check", async () => {
    const malformed = request("tools/call", {});
    const noStream = await send({ POST }, malformed, { "content-type": "application/json", accept: "application/json" });
    expect(noStream.status).toBe(406);
    const wrongType = await send({ POST }, malformed, { "content-type": "text/plain", accept: MCP_HEADERS.accept });
    expect(wrongType.status).toBe(415);
  });

  // JSON-RPC 2.0 section 6 would have the server execute the valid members of a batch and answer
  // each bad one inside a returned array. This server does not: a batch is accepted only when every
  // member is a well-formed message. The MCP spec dropped batching in 2025-06-18.
  it("rejects a batch as a whole when a member is not a message: one error object, nothing executed", async () => {
    const outcome = await send(
      { POST },
      rpcBody([{ jsonrpc: "2.0", id: 1, method: "tools/list" }, 1]),
    );
    expect(outcome.status).toBe(400);
    expect(outcome.raw.trimStart().startsWith("{")).toBe(true);
    const message = only(outcome);
    expectRpcError(message, null);
    expect(message.error?.code).toBe(-32600);
    expect(outcome.raw).not.toContain("get_profile");
  });

  it("rejects a batch as a whole when a member has malformed params: one -32602 object with a null id", async () => {
    const outcome = await send(
      { POST },
      rpcBody([
        { jsonrpc: "2.0", id: 1, method: "tools/list" },
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: {} },
      ]),
    );
    expect(outcome.status).toBe(400);
    expect(outcome.raw.trimStart().startsWith("{")).toBe(true);
    const message = only(outcome);
    expectRpcError(message, null);
    expect(message.error?.code).toBe(-32602);
    expect(message.error?.message).toMatch(/^Invalid params for tools\/call: /);
    expect(outcome.raw).not.toContain("get_profile");
  });

  it("accepts a notification, a notification of an unknown method, a batch of notifications and a response with an empty 202", async () => {
    const bodies = [
      rpcBody({ jsonrpc: "2.0", method: "notifications/initialized" }),
      rpcBody({ jsonrpc: "2.0", method: "notifications/whatever", params: {} }),
      rpcBody({ jsonrpc: "2.0", method: "foo/bar" }),
      rpcBody([{ jsonrpc: "2.0", method: "notifications/initialized" }]),
      rpcBody({ jsonrpc: "2.0", id: 1, result: {} }),
    ];
    for (const body of bodies) {
      const outcome = await send({ POST }, body);
      expect(outcome.status, body).toBe(202);
      expect(outcome.raw, body).toBe("");
    }
  });

  it("answers each member of a batch in which every member is a well-formed message", async () => {
    const outcome = await send(
      { POST },
      rpcBody([
        { jsonrpc: "2.0", id: 1, method: "tools/list" },
        { jsonrpc: "2.0", id: 2, method: "foo/bar" },
      ]),
    );
    expect(outcome.status).toBe(200);
    expect(outcome.messages).toHaveLength(2);
    const byId = (id: number) => outcome.messages.find((m) => m.id === id) as RpcMessage;
    expect(byId(1).result).toHaveProperty("tools");
    expectRpcError(byId(2), 2);
    expect(byId(2).error?.code).toBe(-32601);
  });

  it("answers a client that cannot take an event stream, or sends another content type, with a JSON-RPC error", async () => {
    const list = request("tools/list");
    const noStream = await send({ POST }, list, { "content-type": "application/json", accept: "application/json" });
    expect(noStream.status).toBe(406);
    expectRpcError(only(noStream), null);
    const wrongType = await send({ POST }, list, { "content-type": "text/plain", accept: MCP_HEADERS.accept });
    expect(wrongType.status).toBe(415);
    expectRpcError(only(wrongType), null);
  });
});
