import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createMcpHandler } from "mcp-handler";
import { ensureJsonError, methodNotAllowed, optionsFor } from "@/lib/api-error";
import * as T from "@/lib/mcp-tools";

// The SDK transitively needs Node (express/hono) — never edge. Inherently dynamic
// (POST/SSE), so it can't be statically prerendered and won't regress the Classic SSG.
// NOTE: `export const runtime = "nodejs"` was removed for cacheComponents (which rejects the
// export's mere presence). Node is still what runs here — it is the DEFAULT runtime, and Cache
// Components requires it; only `runtime = "edge"` is unsupported. Behaviour is unchanged.
export const maxDuration = 30;

/**
 * Portfolio MCP server — exposes the real content layer as 10 read-only tools so a
 * recruiter/engineer can attach it to Claude Desktop / Cursor and "ask their own AI
 * about Sairam". All logic lives in the pure, unit-tested @/lib/mcp-tools (single
 * source — can't drift/fabricate); this route is thin wiring. Public endpoint
 * (Streamable HTTP): /api/mcp/mcp.
 */
const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_profile",
      {
        title: "Get profile",
        description:
          "Sairam Ugge's identity, headline, links, skills, and achievements.",
        inputSchema: T.TOOL_INPUT_SHAPES.get_profile,
        annotations: T.READ_ONLY_TOOL_ANNOTATIONS,
      },
      async ({ sections }) => T.wrapToolResult(T.getProfileData(sections)),
    );
    server.registerTool(
      "list_projects",
      {
        title: "List open-source projects",
        description:
          "All open-source projects (name, tagline, group, repo, tech).",
        inputSchema: T.TOOL_INPUT_SHAPES.list_projects,
        annotations: T.READ_ONLY_TOOL_ANNOTATIONS,
      },
      async ({ group, limit }) =>
        T.wrapToolResult(T.listProjectsData({ group, limit })),
    );
    server.registerTool(
      "get_project",
      {
        title: "Get project by slug",
        description: "One open-source project's detail by slug.",
        inputSchema: T.TOOL_INPUT_SHAPES.get_project,
        annotations: T.READ_ONLY_TOOL_ANNOTATIONS,
      },
      async ({ slug }) => T.wrapToolResult(T.getProjectData(slug)),
    );
    server.registerTool(
      "list_work",
      {
        title: "List production work",
        description:
          "Production work case studies (role, register, metrics, tech).",
        inputSchema: T.TOOL_INPUT_SHAPES.list_work,
        annotations: T.READ_ONLY_TOOL_ANNOTATIONS,
      },
      async ({ tech, limit }) =>
        T.wrapToolResult(T.listWorkData({ tech, limit })),
    );
    server.registerTool(
      "get_work",
      {
        title: "Get work by slug",
        description: "One production work case study's detail by slug.",
        inputSchema: T.TOOL_INPUT_SHAPES.get_work,
        annotations: T.READ_ONLY_TOOL_ANNOTATIONS,
      },
      async ({ slug }) => T.wrapToolResult(T.getWorkData(slug)),
    );
    server.registerTool(
      "search_experience",
      {
        title: "Search experience",
        description:
          "Keyword search across work, projects, and skills (e.g. 'kafka', 'multi-agent').",
        inputSchema: T.TOOL_INPUT_SHAPES.search_experience,
        annotations: T.READ_ONLY_TOOL_ANNOTATIONS,
      },
      async ({ query }) => T.wrapToolResult(T.searchExperienceData(query)),
    );
    server.registerTool(
      "get_resume_variant",
      {
        title: "Get résumé variant",
        description:
          "The canonical résumé PDF URL — the only role is 'master'.",
        inputSchema: T.TOOL_INPUT_SHAPES.get_resume_variant,
        annotations: T.READ_ONLY_TOOL_ANNOTATIONS,
      },
      async ({ role }) => T.wrapToolResult(T.getResumeVariantData(role)),
    );
    server.registerTool(
      "list_all_content",
      {
        title: "List all content",
        description:
          "Flat list of every work case study, project, article, and note — with slug, name, summary, and URL.",
        inputSchema: T.TOOL_INPUT_SHAPES.list_all_content,
        annotations: T.READ_ONLY_TOOL_ANNOTATIONS,
      },
      async ({ type, limit }) =>
        T.wrapToolResult(T.listAllContentData({ type, limit })),
    );
    server.registerTool(
      "get_content_item",
      {
        title: "Get content item",
        description:
          "Fetch a specific content item by type (work, project, article, note) and slug.",
        inputSchema: T.TOOL_INPUT_SHAPES.get_content_item,
        annotations: T.READ_ONLY_TOOL_ANNOTATIONS,
      },
      async ({ type, slug }) =>
        T.wrapToolResult(T.getContentItemData(type, slug)),
    );
    server.registerTool(
      "list_decisions",
      {
        title: "List architecture decisions",
        description:
          "Real engineering tradeoffs across all projects and work case studies — the choice made, the alternative considered, and the cost paid. Optional tag filter.",
        inputSchema: T.TOOL_INPUT_SHAPES.list_decisions,
        annotations: T.READ_ONLY_TOOL_ANNOTATIONS,
      },
      async ({ tag }) => T.wrapToolResult(T.listDecisionsData(tag)),
    );
  },
  {},
  // disableSse: SSE was removed from the MCP spec (2025-03-26) and the only transport
  // the /mcp page advertises is Streamable HTTP (/api/mcp/mcp). Without this, a GET to the
  // legacy /api/mcp/sse path (the [transport] segment matches "sse") falls through to
  // mcp-handler's Redis init, which throws "redisUrl is required" → an unhandled 500 in
  // prod (this project uses Upstash REST, not REDIS_URL/KV_URL). Disabling it 404s that
  // dead path and drops the needless redis dependency from the bundle.
  { basePath: "/api/mcp", disableSse: true },
);

// The transport library answers a wrong path or method with a bare text 404/405. Route
// every response through ensureJsonError so errors are JSON like the rest of the API
// (a JSON-RPC body is only labelled, never rewritten, so MCP clients see what they expect).
//
// Three answers the library gets wrong or leaves out are made here, around it:
//  - It never settles a POST whose body is not JSON (it raises inside a stream and the request stays
//    open until maxDuration), so that is answered up front with -32700, the protocol's parse error.
//  - A body that IS JSON but not a JSON-RPC message gets the library's 400, labelled -32700 with a
//    null id; the protocol calls that -32600 (invalid request) and wants the request's id echoed when
//    it has one. An empty array gets a bare, empty 202 from the library; that is -32600 too. Both are
//    decided after the library has answered, so its own checks (404 for another transport, 406, 415)
//    come first for them as for every body. Only the not-JSON case above cannot wait for the library.
//  - A well-formed request whose params do not fit its method (tools/call without a name, initialize
//    without a protocolVersion) gets -32603 from the library with the validator's raw issue list as the
//    message; that is -32602 (invalid params) with one short sentence. It is checked against the
//    library's own request schemas, after the library has answered, so its header checks (406, 415)
//    still come first.
//
// Batches are NOT handled as JSON-RPC 2.0 section 6 describes (execute the valid members, answer each
// bad one inside a returned array). A batch is accepted only when every member is a well-formed
// message; one invalid member rejects the whole array with a single error object, HTTP 400 and a null
// id. For -32600 the library refuses it before running anything; for -32602 the library may already
// have run the other members (every tool is read-only) and their results are discarded. The MCP spec
// dropped batching in 2025-06-18, so no client of the current protocol sends one.
const JSON_RPC_PARSE_ERROR = -32700;
const JSON_RPC_INVALID_REQUEST = -32600;
const JSON_RPC_INVALID_PARAMS = -32602;
const MAX_PARAMS_MESSAGE = 200;

// POST is the only method that does anything: the server is stateless, with no session to end and no
// event stream to open (GET and DELETE are exported only so the library answers them with a JSON-RPC
// 405; Next would answer an unexported method with an empty one). Every 405 and OPTIONS says so.
const ALLOWED_METHODS = ["POST"] as const;
const ALLOW = [...ALLOWED_METHODS, "OPTIONS"].join(", ");

type ParamsSchema = {
  safeParse(input: unknown):
    | { success: true }
    | {
        success: false;
        error: {
          issues: readonly { path: readonly PropertyKey[]; message: string }[];
        };
      };
};
// The methods this server answers whose request the library validates before running a handler.
const PARAMS_SCHEMAS: Record<string, ParamsSchema> = {
  initialize: InitializeRequestSchema,
  "tools/list": ListToolsRequestSchema,
  "tools/call": CallToolRequestSchema,
};

function jsonRpcError(
  code: number,
  message: string,
  id: string | number | null,
  status = 400,
): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code, message }, id },
    { status },
  );
}

/** The id a JSON-RPC error echoes: the request's own, when it is a single request with a usable one. */
function echoableId(body: unknown): string | number | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { id } = body as { id?: unknown };
  return typeof id === "string" || typeof id === "number" ? id : null;
}

/** True when the library refused a body that had already parsed as JSON, i.e. an invalid message. */
async function isRejectedMessage(res: Response): Promise<boolean> {
  if (res.status !== 400) return false;
  const answer = await res.clone().json().catch(() => null);
  return answer?.error?.code === JSON_RPC_PARSE_ERROR;
}

/** The library's bare 202 for `[]`, which it takes for a batch of notifications. */
const isAcceptedEmptyBatch = (body: unknown, res: Response) =>
  res.status === 202 && Array.isArray(body) && body.length === 0;

/** One short sentence about the first thing wrong with a request's params, or null when they fit. */
function paramsProblem(message: unknown): string | null {
  const id = echoableId(message);
  const { method } = (message ?? {}) as { method?: unknown };
  if (id === null || typeof method !== "string" || !Object.hasOwn(PARAMS_SCHEMAS, method)) {
    return null; // a notification, or a method the library does not validate this way
  }
  const result = PARAMS_SCHEMAS[method].safeParse(message);
  if (result.success) return null;
  const [first, ...rest] = result.error.issues;
  const field = first.path.join(".");
  const more = rest.length > 0 ? ` (and ${rest.length} more problems)` : "";
  const reason = first.message
    .replace(/^Invalid input: /, "")
    .replace("expected record", "expected object");
  return `Invalid params for ${method}: ${field ? `${field}: ` : ""}${reason}${more}`.slice(
    0,
    MAX_PARAMS_MESSAGE,
  );
}

const invalidRequest = (body: unknown) =>
  jsonRpcError(
    JSON_RPC_INVALID_REQUEST,
    "Invalid Request: the body is JSON but not a valid JSON-RPC 2.0 message.",
    echoableId(body),
  );

/** The -32602 answer, or null when every request in the body has params that fit its method. */
function invalidParams(body: unknown): Response | null {
  if (Array.isArray(body)) {
    const problem = body.map(paramsProblem).find((text) => text !== null);
    return problem ? jsonRpcError(JSON_RPC_INVALID_PARAMS, problem, null) : null;
  }
  const problem = paramsProblem(body);
  return problem
    ? jsonRpcError(JSON_RPC_INVALID_PARAMS, problem, echoableId(body), 200)
    : null;
}

async function withAllow405(res: Response): Promise<Response> {
  if (res.status !== 405) return res;
  const headers = new Headers(res.headers);
  headers.set("Allow", ALLOW);
  return new Response(res.body, { status: 405, headers });
}

async function jsonErrors(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return withAllow405(await ensureJsonError(await handler(req)));
  }
  let body: unknown;
  try {
    body = JSON.parse(await req.clone().text());
  } catch {
    return jsonRpcError(
      JSON_RPC_PARSE_ERROR,
      "Parse error: the request body is not valid JSON.",
      null,
    );
  }
  const res = await handler(req);
  if ((await isRejectedMessage(res)) || isAcceptedEmptyBatch(body, res)) {
    return invalidRequest(body);
  }
  const rejected = res.ok ? invalidParams(body) : null;
  if (rejected) {
    await res.arrayBuffer(); // drain it: cancelling the stream makes the library throw when it closes it
    return rejected;
  }
  return ensureJsonError(res);
}

const notAllowed = methodNotAllowed(ALLOWED_METHODS);
const options = optionsFor(ALLOWED_METHODS);

export {
  jsonErrors as GET,
  jsonErrors as POST,
  jsonErrors as DELETE,
  notAllowed as PUT,
  notAllowed as PATCH,
  notAllowed as HEAD,
  options as OPTIONS,
};
