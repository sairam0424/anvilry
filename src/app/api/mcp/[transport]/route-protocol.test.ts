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
  MCP_URL,
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
    expect(text, "validator jargon is translated").not.toMatch(/Invalid input:|\brecord\b/);
  });

  it("says 'expected object' where the validator says 'record', and counts the further problems", async () => {
    const wrongArguments = only(await send({ POST }, toolCall("get_profile", "str")));
    expect(wrongArguments.error?.message).toContain("params.arguments: expected object, received string");
    const emptyInitialize = only(await send({ POST }, request("initialize", {})));
    expect(emptyInitialize.error?.message).toMatch(
      /^Invalid params for initialize: params\.protocolVersion: expected string, received undefined \(and \d+ more problems\)$/,
    );
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

/**
 * Behind the params check: each guard in it protects a real request, so each has its own case.
 * (Removing the guard must break a test; route.ts documents what each one does.)
 */
describe("MCP params check guards", () => {
  const validInitialize = {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "vitest", version: "0" },
  };
  const MAX_PARAMS_MESSAGE = 200;

  // Plain objects carry these keys, so a lookup by method name must not find them.
  it.each(["toString", "__proto__", "constructor", "valueOf", "hasOwnProperty"])(
    "answers the inherited-looking method %s as an unknown method, without throwing",
    async (method) => {
      const message = only(await send({ POST }, request(method, undefined, 12)));
      expectRpcError(message, 12);
      expect(message.error?.code).toBe(-32601);
    },
  );

  // A notification has no id and gets no response, whatever its params look like.
  it.each(["tools/call", "tools/list", "initialize"])(
    "answers a %s notification with malformed params by 202 and no body",
    async (method) => {
      const outcome = await send(
        { POST },
        rpcBody({ jsonrpc: "2.0", method, params: { cursor: 5, name: 5, protocolVersion: 1 } }),
      );
      expect(outcome.status).toBe(202);
      expect(outcome.raw).toBe("");
    },
  );

  it("cuts an invalid-params message at 200 characters, however long the offending key is", async () => {
    const longKey = "k".repeat(500);
    const outcome = await send(
      { POST },
      request("initialize", {
        ...validInitialize,
        capabilities: { experimental: { [longKey]: "not an object" } },
      }),
    );
    const message = only(outcome);
    expectRpcError(message, DEFAULT_REQUEST_ID);
    expect(message.error?.code).toBe(-32602);
    expect(message.error?.message).toMatch(/^Invalid params for initialize: params\.capabilities\.experimental\.k+/);
    expect((message.error?.message as string).length).toBe(MAX_PARAMS_MESSAGE);
  });

  // The library's own 400s are already -32600 with a reason; they must reach the client as they are.
  it("keeps the library's own reason when it refuses a batch of 101 messages", async () => {
    const batch = Array.from({ length: 101 }, (_, i) => ({ jsonrpc: "2.0", id: i + 1, method: "tools/list" }));
    const outcome = await send({ POST }, rpcBody(batch));
    expect(outcome.status).toBe(400);
    const message = only(outcome);
    expectRpcError(message, null);
    expect(message.error?.code).toBe(-32600);
    expect(message.error?.message).toContain("Batch must not exceed 100 messages");
  });

  it("keeps the library's own reason when a batch holds two initialize requests", async () => {
    const outcome = await send(
      { POST },
      rpcBody([
        { jsonrpc: "2.0", id: 1, method: "initialize", params: validInitialize },
        { jsonrpc: "2.0", id: 2, method: "initialize", params: validInitialize },
      ]),
    );
    expect(outcome.status).toBe(400);
    expect(only(outcome).error?.message).toContain("Only one initialization request is allowed");
  });
});

// An empty array is an invalid request, but the library's header and path checks come first for it
// as for every other body (only a body that is not JSON at all is answered before them).
describe("MCP empty array behind the transport's own checks", () => {
  const empty = "[]";

  it("answers it -32600 once the headers and the path are right", async () => {
    const outcome = await send({ POST }, empty);
    expect(outcome.status).toBe(400);
    expect(only(outcome).error?.code).toBe(-32600);
  });

  it("answers it 415 when the Content-Type is wrong, like any other body", async () => {
    const outcome = await send({ POST }, empty, { "content-type": "text/plain", accept: MCP_HEADERS.accept });
    expect(outcome.status).toBe(415);
    expect(only(outcome).error?.code).toBe(-32000);
  });

  it("answers it 406 when the client cannot take an event stream, like any other body", async () => {
    const outcome = await send({ POST }, empty, { "content-type": "application/json", accept: "application/json" });
    expect(outcome.status).toBe(406);
    expect(only(outcome).error?.code).toBe(-32000);
  });

  it("answers it with the 404 of a path that is not the transport", async () => {
    const res = await POST(new Request(MCP_URL.replace(/mcp$/, "nope"), { method: "POST", headers: MCP_HEADERS, body: empty }));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("not_found");
  });
});
