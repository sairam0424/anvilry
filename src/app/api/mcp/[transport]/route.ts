import { createMcpHandler } from "mcp-handler";
import * as T from "@/lib/mcp-tools";

// The SDK transitively needs Node (express/hono) — never edge. Inherently dynamic
// (POST/SSE), so it can't be statically prerendered and won't regress the Classic SSG.
export const runtime = "nodejs";
export const maxDuration = 30;

/** Wrap a tool result as MCP content + structuredContent; mark not-found as an error. */
function wrap(data: unknown) {
  const isNotFound = !!data && typeof data === "object" && "notFound" in data;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
    ...(isNotFound && { isError: true }),
  };
}

/**
 * Portfolio MCP server — exposes the real content layer as 7 read-only tools so a
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
        description: "Sairam Ugge's identity, headline, links, skills, and achievements.",
        inputSchema: {},
      },
      async () => wrap(T.getProfileData()),
    );
    server.registerTool(
      "list_projects",
      {
        title: "List open-source projects",
        description: "All open-source projects (name, tagline, group, repo, tech).",
        inputSchema: {},
      },
      async () => wrap(T.listProjectsData()),
    );
    server.registerTool(
      "get_project",
      {
        title: "Get project by slug",
        description: "One open-source project's detail by slug.",
        inputSchema: T.projectSlugSchema,
      },
      async ({ slug }) => wrap(T.getProjectData(slug)),
    );
    server.registerTool(
      "list_work",
      {
        title: "List production work",
        description: "Production work case studies (role, register, metrics, tech).",
        inputSchema: {},
      },
      async () => wrap(T.listWorkData()),
    );
    server.registerTool(
      "get_work",
      {
        title: "Get work by slug",
        description: "One production work case study's detail by slug.",
        inputSchema: T.workSlugSchema,
      },
      async ({ slug }) => wrap(T.getWorkData(slug)),
    );
    server.registerTool(
      "search_experience",
      {
        title: "Search experience",
        description: "Keyword search across work, projects, and skills (e.g. 'kafka', 'multi-agent').",
        inputSchema: T.searchSchema,
      },
      async ({ query }) => wrap(T.searchExperienceData(query)),
    );
    server.registerTool(
      "get_resume_variant",
      {
        title: "Get résumé variant",
        description: "A role-targeted résumé PDF URL (master, backend, fullstack, frontend, genai).",
        inputSchema: T.resumeRoleSchema,
      },
      async ({ role }) => wrap(T.getResumeVariantData(role)),
    );
    server.registerTool(
      "list_all_content",
      {
        title: "List all content",
        description: "Flat list of every work case study, project, article, and note — with slug, name, summary, and URL.",
        inputSchema: {},
      },
      async () => wrap(T.listAllContentData()),
    );
    server.registerTool(
      "get_content_item",
      {
        title: "Get content item",
        description: "Fetch a specific content item by type (work, project, article, note) and slug.",
        inputSchema: T.contentTypeSchema,
      },
      async ({ type, slug }) => wrap(T.getContentItemData(type, slug)),
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

export { handler as GET, handler as POST, handler as DELETE };
