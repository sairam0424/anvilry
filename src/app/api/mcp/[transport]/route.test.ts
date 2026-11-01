import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  MAX_PROJECT_LIMIT,
  PROFILE_SECTIONS,
  READ_ONLY_TOOL_ANNOTATIONS,
  getProfileData,
  listProjectsData,
  listWorkData,
  projectGroups,
} from "@/lib/mcp-tools";
import { DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT } from "./route";
import {
  MCP_HEADERS,
  MCP_URL,
  URL_BASE,
  ok,
  only,
  send,
  structured,
  toolCall,
  toolErrorText,
  request,
  type RpcMessage,
} from "./mcp-test-support";

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

  it("answers a POST with a body that is not JSON by a JSON-RPC parse error, instead of hanging", async () => {
    const res = await POST(
      new Request(`${URL_BASE}/mcp`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    const json = await res.json();
    expect(json).toEqual({
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error: the request body is not valid JSON." },
      id: null,
    });
  });

  it("answers an empty POST body the same way", async () => {
    const res = await POST(
      new Request(`${URL_BASE}/mcp`, { method: "POST", headers: { "content-type": "application/json" } }),
    );
    expect(res.status).toBe(400);
  });
});

/**
 * The server is stateless: it keeps no session and has no event stream to open, so POST is the only
 * method that does anything. Every other answer says so in `Allow`, and says the same thing.
 */
describe("MCP route methods", () => {
  const ALLOW = "POST, OPTIONS";
  const transportRequest = (method: string, headers: Record<string, string> = MCP_HEADERS) =>
    new Request(MCP_URL, { method, headers });

  it.each([
    ["GET", () => GET(transportRequest("GET"))],
    ["DELETE", () => DELETE(transportRequest("DELETE"))],
  ])("answers %s with a JSON-RPC 405 that names the methods that work", async (_method, call) => {
    const res = await call();
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe(ALLOW);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    const body = (await res.json()) as RpcMessage;
    expect(body.jsonrpc).toBe("2.0");
    expect(body.error?.code).toBe(-32000);
    expect(body.id).toBeNull();
  });

  it.each([
    ["HEAD", HEAD],
    ["PUT", PUT],
    ["PATCH", PATCH],
  ])("answers %s with the shared JSON 405 and the same Allow", async (_method, handler) => {
    const res = handler();
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe(ALLOW);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect((await res.json()).code).toBe("method_not_allowed");
  });

  it("answers OPTIONS with 204 and the same Allow", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("allow")).toBe(ALLOW);
  });

  it("answers POST, the one method that works, with a result and no Allow header", async () => {
    const res = await POST(
      new Request(MCP_URL, { method: "POST", headers: MCP_HEADERS, body: request("tools/list") }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("allow")).toBeNull();
  });

  it("still answers GET on a path that is not the transport with the 404, which names no method", async () => {
    const res = await GET(new Request(`${URL_BASE}/nope`));
    expect(res.status).toBe(404);
    expect(res.headers.get("allow")).toBeNull();
  });
});

describe("MCP tools/list advertises typed schemas and annotations", () => {
  type Advertised = {
    name: string;
    annotations?: Record<string, unknown>;
    inputSchema: {
      type?: string;
      properties?: Record<string, Record<string, unknown>>;
      required?: string[];
    };
  };
  let tools: Advertised[] = [];
  const byName = (name: string) => tools.find((t) => t.name === name) as Advertised;

  beforeAll(async () => {
    const message = only(await send({ POST }, request("tools/list")));
    tools = (message.result as { tools: Advertised[] }).tools;
  });

  it("lists all ten tools", () => {
    expect(tools).toHaveLength(10);
  });

  it("marks every tool read-only, idempotent, non-destructive and closed-world", () => {
    for (const tool of tools) {
      expect(tool.annotations, tool.name).toEqual(READ_ONLY_TOOL_ANNOTATIONS);
    }
  });

  it("gives every tool an object schema with typed, described properties", () => {
    for (const tool of tools) {
      const { type, properties } = tool.inputSchema;
      expect(type, tool.name).toBe("object");
      const entries = Object.entries(properties ?? {});
      expect(entries.length, `${tool.name} has no properties`).toBeGreaterThan(0);
      for (const [prop, schema] of entries) {
        expect(typeof schema.type, `${tool.name}.${prop} type`).toBe("string");
        expect(String(schema.description ?? "").length, `${tool.name}.${prop} description`).toBeGreaterThan(0);
      }
    }
  });

  it("names required parameters in an array that only lists real properties, or omits it when none is required", () => {
    const required = (name: string) => byName(name).inputSchema.required;
    expect(required("get_project")).toEqual(["slug"]);
    expect(required("get_work")).toEqual(["slug"]);
    expect(required("search_experience")).toEqual(["query"]);
    expect(required("get_resume_variant")).toEqual(["role"]);
    expect(required("get_content_item")?.sort()).toEqual(["slug", "type"]);
    for (const name of ["get_profile", "list_projects", "list_work", "list_all_content", "list_decisions"]) {
      expect(required(name) ?? [], `${name} requires nothing`).toEqual([]);
    }
    for (const tool of tools) {
      const properties = Object.keys(tool.inputSchema.properties ?? {});
      for (const name of tool.inputSchema.required ?? []) expect(properties).toContain(name);
    }
  });

  it("types the four newly parameterised tools", () => {
    const props = (name: string) => byName(name).inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props("get_profile").sections).toMatchObject({
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string", enum: ["identity", "links", "skills", "achievements"] },
    });
    expect(props("list_projects").group).toMatchObject({ type: "string", minLength: 1, maxLength: 80 });
    expect(props("list_projects").limit).toMatchObject({ type: "integer", minimum: 1, maximum: 100 });
    expect(props("list_work").tech).toMatchObject({ type: "string", minLength: 1, maxLength: 60 });
    expect(props("list_work").limit).toMatchObject({ type: "integer", minimum: 1, maximum: 50 });
    expect(props("list_all_content").type).toMatchObject({
      type: "string",
      enum: ["work", "project", "article", "note"],
    });
    expect(props("list_all_content").limit).toMatchObject({ type: "integer", minimum: 1, maximum: 200 });
  });
});

describe("MCP tools/call with the new optional parameters", () => {
  const call = (name: string, args?: unknown) => send({ POST }, toolCall(name, args)).then(only);

  it("answers get_profile exactly as before when called with no arguments, with {} and with every section", async () => {
    const expected = JSON.parse(JSON.stringify(getProfileData()));
    expect(ok(await call("get_profile"))).toEqual(expected);
    expect(ok(await call("get_profile", {}))).toEqual(expected);
    expect(ok(await call("get_profile", { sections: [...PROFILE_SECTIONS] }))).toEqual(expected);
  });

  it("narrows get_profile to the requested sections", async () => {
    expect(Object.keys(ok(await call("get_profile", { sections: ["links"] })))).toEqual(["links"]);
  });

  it("answers list_projects exactly as before with no arguments", async () => {
    const expected = { items: JSON.parse(JSON.stringify(listProjectsData())) };
    expect(ok(await call("list_projects"))).toEqual(expected);
    expect(ok(await call("list_projects", {}))).toEqual(expected);
  });

  it("filters and caps list_projects", async () => {
    const [group] = projectGroups();
    const items = ok(await call("list_projects", { group: group.toUpperCase(), limit: 2 })).items as { group: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(2);
    for (const item of items) expect(item.group).toBe(group);
  });

  it("tells the caller the valid groups when list_projects gets an unknown one", async () => {
    const message = await call("list_projects", { group: "Nope" });
    expect(toolErrorText(message)).toContain(projectGroups()[0]);
    expect(structured(message)).toMatchObject({ items: [], notFound: true, valid: projectGroups() });
  });

  it("answers list_work exactly as before with no arguments, and filters by tech", async () => {
    expect(ok(await call("list_work"))).toEqual({ items: JSON.parse(JSON.stringify(listWorkData())) });
    const items = ok(await call("list_work", { tech: "PYTHON", limit: 1 })).items as unknown[];
    expect(items).toHaveLength(1);
  });

  it.each([
    ["limit below the minimum", "list_projects", { limit: 0 }, "limit"],
    ["limit above the maximum", "list_projects", { limit: MAX_PROJECT_LIMIT + 1 }, "limit"],
    ["limit that is not an integer", "list_work", { limit: 1.5 }, "limit"],
    ["limit sent as a string", "list_all_content", { limit: "5" }, "limit"],
    ["unknown section", "get_profile", { sections: ["hobbies"] }, "sections"],
    ["empty sections", "get_profile", { sections: [] }, "sections"],
    ["unknown content type", "list_all_content", { type: "personal" }, "type"],
    ["tech sent as a number", "list_work", { tech: 7 }, "tech"],
    ["slug of the wrong type", "get_project", { slug: 123 }, "slug"],
    ["missing required slug", "get_project", {}, "slug"],
    ["empty search query", "search_experience", { query: "" }, "query"],
    ["unknown enum value", "get_content_item", { type: "bogus", slug: "x" }, "type"],
  ])("rejects %s as a tool error that names the field", async (_label, tool, args, field) => {
    const text = toolErrorText(await call(tool, args));
    expect(text).toContain("-32602");
    expect(text).toContain(field);
  });
});

/**
 * list_all_content depends on notes, and the Vercel build sets NEXT_PUBLIC_NOTES_ENABLED where
 * GitHub CI does not: each case pins the flag and loads the route and the tools from one fresh graph.
 */
describe.each([
  ["off", false],
  ["on", true],
])("MCP list_all_content with notes %s", (_label, notesEnabled) => {
  afterEach(() => vi.unstubAllEnvs());

  async function load() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", notesEnabled ? "true" : "false");
    const [route, tools] = await Promise.all([import("./route"), import("@/lib/mcp-tools")]);
    const call = (args?: unknown) => send(route, toolCall("list_all_content", args)).then(only);
    return { call, tools };
  }

  it("answers exactly as before with no arguments", async () => {
    const { call, tools } = await load();
    const expected = { items: JSON.parse(JSON.stringify(tools.listAllContentData())) };
    expect(ok(await call())).toEqual(expected);
    expect(ok(await call({}))).toEqual(expected);
  });

  it("filters by type and caps with limit", async () => {
    const { call, tools } = await load();
    const projects = ok(await call({ type: "project", limit: 3 })).items;
    expect(projects).toEqual(JSON.parse(JSON.stringify(tools.listAllContentData({ type: "project", limit: 3 }))));
    expect((projects as { type: string }[]).every((item) => item.type === "project")).toBe(true);
    const notes = ok(await call({ type: "note" })).items as unknown[];
    expect(notes.length > 0).toBe(notesEnabled);
  });
});
