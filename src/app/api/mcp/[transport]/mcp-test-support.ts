import { expect } from "vitest";
import type * as Route from "./route";

/**
 * Helpers shared by the MCP route tests. The route is called directly with JSON-RPC bodies; the
 * transport answers with JSON or an SSE stream, so both are parsed. Every case must produce a
 * JSON-RPC error object or an MCP result with isError: never a 500, an empty body (a notification
 * is the one defined exception) or a bare-text error.
 */
export const URL_BASE = "https://anvilry.vercel.app/api/mcp";

export const MCP_URL = `${URL_BASE}/mcp`;
export const MCP_HEADERS = {
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
};
export const DEFAULT_REQUEST_ID = 1;

export type RpcMessage = {
  jsonrpc?: string;
  id?: unknown;
  result?: Record<string, unknown>;
  error?: { code?: unknown; message?: unknown };
};
export type RpcOutcome = { status: number; contentType: string; raw: string; messages: RpcMessage[] };

function parseMessages(raw: string, contentType: string): RpcMessage[] {
  if (raw === "") return [];
  if (/event-stream/i.test(contentType)) {
    return raw
      .split("\n\n")
      .map((frame) =>
        frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n"),
      )
      .filter((data) => data !== "")
      .map((data) => JSON.parse(data) as RpcMessage);
  }
  const parsed = JSON.parse(raw) as RpcMessage | RpcMessage[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function send(
  route: Pick<typeof Route, "POST">,
  body: string | undefined,
  headers: Record<string, string> = MCP_HEADERS,
): Promise<RpcOutcome> {
  const res = await route.POST(new Request(MCP_URL, { method: "POST", headers, body }));
  const raw = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  return { status: res.status, contentType, raw, messages: parseMessages(raw, contentType) };
}

export const rpcBody = (message: unknown) => JSON.stringify(message);
export const request = (method: string, params?: unknown, id: unknown = DEFAULT_REQUEST_ID) =>
  rpcBody({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });
export const toolCall = (name: string, args?: unknown, id: unknown = DEFAULT_REQUEST_ID) =>
  request("tools/call", { name, ...(args === undefined ? {} : { arguments: args }) }, id);

/** The one JSON-RPC answer, asserted to be well-formed whatever the transport wrapped it in. */
export function only(outcome: RpcOutcome): RpcMessage {
  expect(outcome.status, outcome.raw).toBeLessThan(500);
  expect(outcome.messages, outcome.raw).toHaveLength(1);
  const [message] = outcome.messages;
  expect(message.jsonrpc).toBe("2.0");
  return message;
}

export function expectRpcError(message: RpcMessage, id: unknown) {
  expect(message.result).toBeUndefined();
  expect(Number.isInteger(message.error?.code), JSON.stringify(message)).toBe(true);
  expect(typeof message.error?.message).toBe("string");
  expect((message.error?.message as string).length).toBeGreaterThan(0);
  expect(message.id).toEqual(id);
}

export function toolErrorText(message: RpcMessage): string {
  expect(message.error).toBeUndefined();
  expect(message.result?.isError, JSON.stringify(message)).toBe(true);
  const [first] = message.result?.content as { type: string; text: string }[];
  expect(first.type).toBe("text");
  expect(first.text.length).toBeGreaterThan(0);
  return first.text;
}

export const structured = (message: RpcMessage) => message.result?.structuredContent as Record<string, unknown>;
export const ok = (message: RpcMessage) => {
  expect(message.error).toBeUndefined();
  expect(message.result?.isError).toBeUndefined();
  return structured(message);
};
