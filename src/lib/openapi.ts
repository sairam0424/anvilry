import { API_ERROR_CODES } from "@/lib/api-error";
import { profile } from "@/lib/profile";
import { SITE_URL } from "@/lib/site-url";

/**
 * The OpenAPI 3.1 description of the public, read-only surface of this site.
 *
 * Scope is a decision, not an accident: only routes an outside agent can call for free and
 * without credentials are described. The chat, voice, error-beacon, visit, admin and cron
 * routes spend money or are operator-only, so they are deliberately absent (openapi.test.ts
 * pins that). /developers renders its tables from this same object, so the page and the spec
 * cannot disagree, and the tests pin every documented path to a real route file.
 */

type Json = Record<string, unknown>;

export interface OpenApiParameter {
  name: string;
  in: "path" | "query";
  required: boolean;
  description: string;
  schema: {
    type: "string";
    pattern: string;
    minLength: number;
    maxLength: number;
  };
  example: string;
}

export interface OpenApiResponse {
  description: string;
  headers?: Record<string, { description: string; schema: { type: "string" } }>;
  content?: Record<string, { schema: Json; example?: unknown }>;
}

export interface OpenApiOperation {
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    required: boolean;
    description: string;
    content: Record<string, { schema: Json }>;
  };
  responses: Record<string, OpenApiResponse | { $ref: string }> & {
    default: { $ref: string };
  };
}

export interface OpenApiDocument {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    summary: string;
    description: string;
    contact: { name: string; url: string; email: string };
  };
  servers: { url: string; description: string }[];
  externalDocs: { description: string; url: string };
  security: never[];
  tags: { name: string; description: string }[];
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<string, Json>;
    responses: Record<string, OpenApiResponse>;
  };
}

const SLUG_PATTERN = "^[A-Za-z0-9_-]+$";
const ERROR_REF = { $ref: "#/components/responses/Error" } as const;
const JSON_ERROR_CODES = API_ERROR_CODES.map((c) => c.code);

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
  return {
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
        content: { "text/markdown": { schema: { type: "string" } } },
      },
      "404": {
        description:
          "No item with this slug (Markdown body; this route is not JSON).",
        content: { "text/markdown": { schema: { type: "string" } } },
      },
      default: ERROR_REF,
    },
  };
}

function textOperation(args: {
  operationId: string;
  summary: string;
  description: string;
  contentType: string;
  tag: string;
}): OpenApiOperation {
  return {
    operationId: args.operationId,
    summary: args.summary,
    description: args.description,
    tags: [args.tag],
    responses: {
      "200": {
        description: args.summary,
        content: { [args.contentType]: { schema: { type: "string" } } },
      },
      default: ERROR_REF,
    },
  };
}

const ResumeJsonSchema: Json = {
  type: "object",
  description:
    "A résumé in the JSON Resume format (jsonresume.org), built from the same content as the site. Education is omitted because no education data is published.",
  required: ["basics", "work", "projects", "skills", "awards", "meta"],
  properties: {
    $schema: {
      type: "string",
      format: "uri",
      description: "The JSON Resume schema this document follows.",
    },
    basics: {
      type: "object",
      description:
        "Name, label, contact email, summary, location and public profiles.",
      properties: {
        name: { type: "string" },
        label: { type: "string", description: "Current role." },
        email: { type: "string", format: "email" },
        summary: { type: "string" },
        location: {
          type: "object",
          properties: {
            city: { type: "string" },
            countryCode: { type: "string", description: "ISO 3166-1 alpha-2." },
          },
        },
        profiles: {
          type: "array",
          items: {
            type: "object",
            properties: {
              network: { type: "string" },
              username: { type: "string" },
              url: { type: "string", format: "uri" },
            },
          },
        },
        url: { type: "string", format: "uri" },
      },
    },
    work: {
      type: "array",
      description: "Production case studies.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Employer." },
          position: { type: "string" },
          summary: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
          url: { type: "string", format: "uri" },
        },
      },
    },
    projects: {
      type: "array",
      description:
        "Open-source and private projects. A private repository has no public repo URL.",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
          url: { type: "string", format: "uri" },
          entity: {
            type: "string",
            format: "uri",
            description: "The project's page on this site.",
          },
        },
      },
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
        },
      },
    },
    awards: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, summary: { type: "string" } },
      },
    },
    meta: {
      type: "object",
      properties: {
        canonical: { type: "string", format: "uri" },
        version: { type: "string" },
      },
    },
  },
};

const GithubStatsSchema: Json = {
  type: "object",
  description:
    "Aggregate numbers across the owner's listed repositories, refreshed hourly. Fails open: if GitHub is unreachable the numbers are zero rather than an error.",
  required: [
    "totalStars",
    "totalForks",
    "topLanguages",
    "mostRecentPush",
    "repoCount",
    "followers",
    "publicRepos",
  ],
  properties: {
    totalStars: {
      type: "integer",
      minimum: 0,
      description: "Stars across the listed repositories.",
    },
    totalForks: {
      type: "integer",
      minimum: 0,
      description: "Forks across the listed repositories.",
    },
    topLanguages: {
      type: "array",
      items: { type: "string" },
      description: "Primary languages, most used first.",
    },
    mostRecentPush: {
      type: ["string", "null"],
      format: "date-time",
      description:
        "Timestamp of the latest push to any listed repository; null when none is known.",
    },
    repoCount: {
      type: "integer",
      minimum: 0,
      description: "Number of repositories aggregated.",
    },
    followers: {
      type: "integer",
      minimum: 0,
      description: "GitHub followers of the owner account.",
    },
    publicRepos: {
      type: "integer",
      minimum: 0,
      description: "Public repositories on the owner account.",
    },
  },
};

const ErrorSchema: Json = {
  type: "object",
  description:
    "The one error shape every JSON route uses. Branch on `code`, show `error` to a person.",
  required: ["error", "code", "status", "hint", "docs"],
  properties: {
    error: { type: "string", description: "Human-readable message." },
    code: {
      type: "string",
      enum: JSON_ERROR_CODES,
      description: "Stable machine-readable error code.",
    },
    status: {
      type: "integer",
      minimum: 400,
      maximum: 599,
      description: "The HTTP status, repeated in the body.",
    },
    hint: { type: "string", description: "What to try next." },
    docs: {
      type: "string",
      format: "uri",
      description: "Where the error codes are documented.",
    },
  },
};

const McpRequestSchema: Json = {
  type: "object",
  description:
    "A JSON-RPC 2.0 request as defined by the Model Context Protocol (Streamable HTTP transport).",
  required: ["jsonrpc", "method"],
  properties: {
    jsonrpc: { type: "string", const: "2.0" },
    id: {
      type: ["string", "integer"],
      description: "Request id; omit for notifications.",
    },
    method: {
      type: "string",
      description: "For example initialize, tools/list or tools/call.",
    },
    params: { type: "object", additionalProperties: true },
  },
};

const McpResponseSchema: Json = {
  type: "object",
  description:
    "A JSON-RPC 2.0 response, either a result or a JSON-RPC error object.",
  required: ["jsonrpc"],
  properties: {
    jsonrpc: { type: "string", const: "2.0" },
    id: { type: ["string", "integer", "null"] },
    result: { type: "object", additionalProperties: true },
    error: {
      type: "object",
      properties: { code: { type: "integer" }, message: { type: "string" } },
    },
  },
};

export function buildOpenApiDocument(): OpenApiDocument {
  return {
    openapi: "3.1.0",
    info: {
      title: "Anvilry public API",
      version: "1.0.0",
      summary:
        "Read-only access to Sairam Ugge's portfolio content for people, scripts and AI agents.",
      description:
        "Everything here is a GET (plus one MCP POST) over content that is also published as web pages. " +
        "There are no API keys and no accounts. The documented routes apply no quota of their own; " +
        "please keep request volume reasonable. Pages negotiate their format: send `Accept: text/markdown` " +
        "to any page that has a Markdown twin and you get Markdown, send `Accept: text/html` and you get the page. " +
        "Errors on JSON routes use one shape (see the Error schema). " +
        "Content-Signal preference: search=yes, ai-input=yes, ai-train=no (robots.txt). " +
        "The version below is the version of this API description, not of the site.",
      contact: {
        name: "Sairam Ugge",
        url: `${SITE_URL}/contact`,
        email: profile.email,
      },
    },
    servers: [{ url: SITE_URL, description: "Production" }],
    externalDocs: {
      description: "Developer guide with copy-paste examples",
      url: `${SITE_URL}/developers`,
    },
    security: [],
    tags: [
      {
        name: "Content",
        description: "Portfolio pages and their Markdown twins.",
      },
      {
        name: "Discovery",
        description:
          "Machine-readable indexes: llms.txt, feeds, sitemap and the OpenAPI document itself.",
      },
      {
        name: "Data",
        description: "Structured JSON: résumé and GitHub statistics.",
      },
      { name: "MCP", description: "Model Context Protocol server." },
    ],
    paths: {
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
              content: {
                "text/html": { schema: { type: "string" } },
                "text/markdown": { schema: { type: "string" } },
              },
            },
            "406": {
              description:
                "The Accept header names no type this page can produce.",
              content: { "text/plain": { schema: { type: "string" } } },
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
            "Notes are unpublished unless the site enables them, in which case every slug answers 404.",
        }),
      },
      "/api/resume.json": {
        get: {
          operationId: "getResumeJson",
          summary: "Get the résumé as JSON Resume",
          description:
            "The structured résumé in the JSON Resume format: basics, production work, projects, skills and awards. Built from the same content as the site, so it cannot drift from it.",
          tags: ["Data"],
          responses: {
            "200": {
              description: "The résumé document.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ResumeJson" },
                },
              },
            },
            default: ERROR_REF,
          },
        },
      },
      "/api/github/stats": {
        get: {
          operationId: "getGithubStats",
          summary: "Get aggregate GitHub statistics",
          description:
            "Stars, forks, languages, follower and repository counts across the owner's listed repositories, cached for an hour. Never errors on an upstream failure: the numbers fall back to zero.",
          tags: ["Data"],
          responses: {
            "200": {
              description: "The aggregate statistics.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/GithubStats" },
                },
              },
            },
            default: ERROR_REF,
          },
        },
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
            "Every public page on the site with change frequency and priority, in the sitemaps.org format.",
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
        get: {
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
      },
      "/api/mcp/mcp": {
        post: {
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
                "text/event-stream": { schema: { type: "string" } },
              },
            },
            default: ERROR_REF,
          },
        },
      },
    },
    components: {
      schemas: {
        Error: ErrorSchema,
        ResumeJson: ResumeJsonSchema,
        GithubStats: GithubStatsSchema,
        McpRequest: McpRequestSchema,
        McpResponse: McpResponseSchema,
      },
      responses: {
        Error: {
          description:
            "Any error. JSON routes answer with the shared error object.",
          headers: {
            Allow: {
              description: "On a 405, the methods the route accepts.",
              schema: { type: "string" },
            },
            "Retry-After": {
              description: "On a 429, seconds to wait before retrying.",
              schema: { type: "string" },
            },
          },
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
      },
    },
  };
}

export interface FlatOperation {
  path: string;
  method: string;
  operation: OpenApiOperation;
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

/** Every (path, method, operation) in the document, in document order. */
export function listOperations(doc: OpenApiDocument): FlatOperation[] {
  const flat: FlatOperation[] = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of METHODS) {
      const operation = item[method];
      if (operation) flat.push({ path, method, operation });
    }
  }
  return flat;
}
