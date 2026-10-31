import { apiVersionParameter, errorResponses, successHeaders } from "@/lib/openapi-parts";
import type { Json, OpenApiDocument, OpenApiOperation, OpenApiParameter } from "@/lib/openapi";
import { SITE_URL } from "@/lib/site-url";

/**
 * The operations that existed before the versioned API: the Markdown twins, the discovery files,
 * the unversioned JSON aliases and the MCP endpoint. Split from openapi.ts so the document
 * assembly stays short; buildOpenApiDocument() places these after the /api/v1 operations.
 */

const SLUG_PATTERN = "^[A-Za-z0-9_-]+$";
const ERROR_REF = { $ref: "#/components/responses/Error" } as const;

/** Media type -> the named component schema that types its body. */
const DOCUMENT_SCHEMA_REF: Record<string, Json> = {
  "text/markdown": { $ref: "#/components/schemas/MarkdownDocument" },
  "text/plain": { $ref: "#/components/schemas/PlainTextDocument" },
  "application/xml": { $ref: "#/components/schemas/XmlDocument" },
  "text/html": { $ref: "#/components/schemas/HtmlDocument" },
};

function documentContent(...mediaTypes: string[]): Record<string, { schema: Json }> {
  return Object.fromEntries(
    mediaTypes.map((type) => [type, { schema: DOCUMENT_SCHEMA_REF[type] }]),
  );
}

/**
 * Adds what src/proxy.ts does to every public API path to an operation: the optional
 * API-Version request header, the version and rate-limit headers on each success, and a typed
 * JSON error response for each status in `errors` that the operation does not already describe
 * itself (the Markdown twins keep their own Markdown 404). Only statuses a route can really
 * return are listed: a prerendered file cannot fail at runtime, so it lists 405 and 429 only.
 */
function withContract(operation: OpenApiOperation, errors: readonly number[]): OpenApiOperation {
  const responses = Object.fromEntries(
    Object.entries(operation.responses).map(([status, response]) =>
      /^2/.test(status) && !("$ref" in response)
        ? [status, { ...response, headers: { ...successHeaders(), ...response.headers } }]
        : [status, response],
    ),
  );
  const missing = errors.filter((status) => !(String(status) in operation.responses));
  return {
    ...operation,
    parameters: [apiVersionParameter(), ...(operation.parameters ?? [])],
    responses: {
      ...responses,
      ...errorResponses(missing),
      default: operation.responses.default,
    },
  };
}

/** Prerendered, GET-only files: the proxy can still answer 405 (wrong method) or 429. */
const STATIC_FILE_ERRORS = [405, 429] as const;

function slugParameter(collection: string, example: string): OpenApiParameter {
  return {
    name: "slug",
    in: "path",
    required: true,
    description: `URL slug of a ${collection} item, as listed in ${SITE_URL}/llms.txt or returned by the list_all_content MCP tool.`,
    schema: {
      type: "string",
      pattern: SLUG_PATTERN,
      minLength: 1,
      maxLength: 120,
    },
    example,
  };
}

function markdownTwin(args: {
  operationId: string;
  collection: string;
  noun: string;
  example: string;
  extra?: string;
}): OpenApiOperation {
  const { operationId, collection, noun, example, extra } = args;
  return withContract(
    {
      operationId,
      summary: `Get a ${noun} as Markdown`,
      description:
        `Returns the ${noun} at ${SITE_URL}/${collection}/{slug} as Markdown, with the front matter removed. ` +
        `The same document is served by requesting the HTML page URL with "Accept: text/markdown". ` +
        `An unknown slug answers 404 with a short Markdown body that links to ${SITE_URL}/llms.txt.` +
        (extra ? ` ${extra}` : ""),
      tags: ["Content"],
      parameters: [slugParameter(collection, example)],
      responses: {
        "200": {
          description: `The ${noun} as Markdown.`,
          content: documentContent("text/markdown"),
        },
        "404": {
          description:
            "No item with this slug (Markdown body; this route is not JSON).",
          content: documentContent("text/markdown"),
        },
        default: ERROR_REF,
      },
    },
    STATIC_FILE_ERRORS,
  );
}

function textOperation(args: {
  operationId: string;
  summary: string;
  description: string;
  contentType: string;
  tag: string;
}): OpenApiOperation {
  return withContract(
    {
      operationId: args.operationId,
      summary: args.summary,
      description: args.description,
      tags: [args.tag],
      responses: {
        "200": {
          description: args.summary,
          content: documentContent(args.contentType),
        },
        default: ERROR_REF,
      },
    },
    STATIC_FILE_ERRORS,
  );
}

function jsonOperation(args: {
  operationId: string;
  summary: string;
  description: string;
  tag: string;
  schemaRef: string;
  successDescription: string;
}): OpenApiOperation {
  return withContract(
    {
      operationId: args.operationId,
      summary: args.summary,
      description: args.description,
      tags: [args.tag],
      responses: {
        "200": {
          description: args.successDescription,
          content: {
            "application/json": { schema: { $ref: args.schemaRef } },
          },
        },
        default: ERROR_REF,
      },
    },
    STATIC_FILE_ERRORS,
  );
}

const EVENT_STREAM_SCHEMA: Json = {
  type: "string",
  contentMediaType: "text/event-stream",
  description: "Server-sent events whose data fields are JSON-RPC messages.",
};

export function legacyPaths(): OpenApiDocument["paths"] {
  return {
    "/": {
      get: {
        operationId: "getHomepage",
        summary: "Get the homepage as HTML or Markdown",
        description:
          "Content-negotiated: `Accept: text/markdown` returns a Markdown summary of the portfolio (profile, impact, production work, projects, stack, contact and a list of agent resources); `Accept: text/html` returns the web page. " +
          "The response carries `Vary: Accept`, and the Markdown form is also available at /index.md.",
        tags: ["Content"],
        responses: {
          "200": {
            description: "The homepage in the negotiated format.",
            content: documentContent("text/html", "text/markdown"),
          },
          "406": {
            description:
              "The Accept header asks for Markdown but rules out both Markdown and HTML (for example `text/markdown;q=0, text/html;q=0`).",
            content: documentContent("text/plain"),
          },
          default: ERROR_REF,
        },
      },
    },
    "/index.md": {
      get: textOperation({
        operationId: "getHomepageMarkdown",
        summary: "Get the homepage as Markdown",
        description:
          "The Markdown twin of the homepage at a fixed URL, for clients that cannot set an Accept header.",
        contentType: "text/markdown",
        tag: "Content",
      }),
    },
    "/projects/{slug}.md": {
      get: markdownTwin({
        operationId: "getProjectMarkdown",
        collection: "projects",
        noun: "project write-up",
        example: "trelix",
      }),
    },
    "/work/{slug}.md": {
      get: markdownTwin({
        operationId: "getWorkMarkdown",
        collection: "work",
        noun: "production case study",
        example: "pensieve",
      }),
    },
    "/articles/{slug}.md": {
      get: markdownTwin({
        operationId: "getArticleMarkdown",
        collection: "articles",
        noun: "article",
        example: "feature-flags-at-scale-devto",
        extra:
          "Cross-posted articles are summaries that link to where the full text lives.",
      }),
    },
    "/notes/{slug}.md": {
      get: markdownTwin({
        operationId: "getNoteMarkdown",
        collection: "notes",
        noun: "engineering note",
        example: "how-dns-works",
        extra:
          "Notes are switched off on a default build, and while they are off every slug answers 404; check /llms.txt for the notes that are published.",
      }),
    },
    "/api/resume.json": {
      get: jsonOperation({
        operationId: "getResumeJson",
        summary: "Get the résumé as JSON Resume",
        description:
          "The structured résumé in the JSON Resume format: basics, production work, projects, skills and awards. Built from the same content as the site, so it cannot drift from it. Unversioned alias of /api/v1/resume.",
        tag: "Data",
        schemaRef: "#/components/schemas/ResumeJson",
        successDescription: "The résumé document.",
      }),
    },
    "/api/github/stats": {
      get: jsonOperation({
        operationId: "getGithubStats",
        summary: "Get aggregate GitHub statistics",
        description:
          "Stars, forks, languages, follower and repository counts across the owner's listed repositories, cached for an hour. Never errors on an upstream failure: counts fall back to zero (repository count to the listed repositories) and the latest push to null. Unversioned alias of /api/v1/github/stats.",
        tag: "Data",
        schemaRef: "#/components/schemas/GithubStats",
        successDescription: "The aggregate statistics.",
      }),
    },
    "/llms.txt": {
      get: textOperation({
        operationId: "getLlmsTxt",
        summary: "Get the llms.txt site index",
        description:
          "A plain-text index for language models: who this site is about, when to use it, availability, every production case study and project with a one-line summary, and the links an agent needs.",
        contentType: "text/plain",
        tag: "Discovery",
      }),
    },
    "/llms-full.txt": {
      get: textOperation({
        operationId: "getLlmsFullTxt",
        summary: "Get the full text corpus",
        description:
          "The complete grounding corpus the site's own assistant answers from: profile, production work, projects and skills in one plain-text document. Larger than llms.txt; use it when you need the detail in one request.",
        contentType: "text/plain",
        tag: "Discovery",
      }),
    },
    "/feed.xml": {
      get: textOperation({
        operationId: "getFeed",
        summary: "Get the RSS feed",
        description:
          "An RSS feed of published articles and notes. Valid but empty when nothing is published.",
        contentType: "application/xml",
        tag: "Discovery",
      }),
    },
    "/sitemap.xml": {
      get: textOperation({
        operationId: "getSitemap",
        summary: "Get the XML sitemap",
        description:
          "The pages the site submits to search engines, with change frequency and priority, in the sitemaps.org format.",
        contentType: "application/xml",
        tag: "Discovery",
      }),
    },
    "/robots.txt": {
      get: textOperation({
        operationId: "getRobotsTxt",
        summary: "Get robots.txt and the AI content signal",
        description:
          "Crawler rules and the Content-Signal preference (search=yes, ai-input=yes, ai-train=no), plus the sitemap location.",
        contentType: "text/plain",
        tag: "Discovery",
      }),
    },
    "/openapi.json": {
      get: withContract(
        {
          operationId: "getOpenApiDocument",
          summary: "Get this OpenAPI document",
          description:
            "The machine-readable description of the API you are reading, in OpenAPI 3.1.",
          tags: ["Discovery"],
          responses: {
            "200": {
              description: "The OpenAPI document.",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            default: ERROR_REF,
          },
        },
        STATIC_FILE_ERRORS,
      ),
    },
    "/api/mcp/mcp": {
      post: withContract(
        {
          operationId: "callMcpServer",
          summary: "Call the portfolio MCP server",
          description:
            "A read-only Model Context Protocol server over Streamable HTTP (JSON-RPC 2.0). Its tools return profile, projects, case studies, decisions, search and the résumé link; the tool table is at " +
            `${SITE_URL}/mcp. Point an MCP client at this URL rather than calling it by hand. The legacy SSE transport is disabled and answers 404.`,
          tags: ["MCP"],
          requestBody: {
            required: true,
            description:
              "A JSON-RPC 2.0 request. Send `Accept: application/json, text/event-stream`.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/McpRequest" },
              },
            },
          },
          responses: {
            "200": {
              description:
                "A JSON-RPC response, as JSON or as a server-sent event stream.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/McpResponse" },
                },
                "text/event-stream": {
                  schema: EVENT_STREAM_SCHEMA,
                },
              },
            },
            "400": {
              description:
                "A body that is not valid JSON-RPC answers with a JSON-RPC error object (-32700 parse error); an unsupported API-Version answers with the shared error object.",
              content: {
                "application/json": {
                  schema: {
                    oneOf: [
                      { $ref: "#/components/schemas/McpResponse" },
                      { $ref: "#/components/schemas/Error" },
                    ],
                  },
                },
              },
            },
            default: { $ref: "#/components/responses/McpError" },
          },
        },
        [404, 405, 429],
      ),
    },
  };
}

