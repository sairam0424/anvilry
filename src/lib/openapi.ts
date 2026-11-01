import { RATE_LIMIT_POLICY_TEXT, VERSIONING_POLICY } from "@/lib/api-policy";
import { legacyPaths } from "@/lib/openapi-legacy";
import { V1_SCHEMAS, V1_TAGS, buildV1Paths } from "@/lib/openapi-v1";
import {
  ErrorSchema,
  GithubStatsSchema,
  HtmlDocumentSchema,
  MarkdownDocumentSchema,
  McpRequestSchema,
  McpResponseSchema,
  PlainTextDocumentSchema,
  ResumeJsonSchema,
  XmlDocumentSchema,
} from "@/lib/openapi-schemas";
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

export type Json = Record<string, unknown>;

export interface OpenApiParameterSchema {
  type: "string" | "integer";
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  enum?: readonly string[];
  default?: string | number;
  minimum?: number;
  maximum?: number;
}

export interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header";
  required: boolean;
  description: string;
  schema: OpenApiParameterSchema;
  example?: string;
}

export interface OpenApiHeader {
  description: string;
  schema: { type: "string" | "integer"; format?: string };
}

export interface OpenApiResponse {
  description: string;
  headers?: Record<string, OpenApiHeader>;
  content?: Record<string, { schema: Json; example?: unknown }>;
}

export interface OpenApiOperation {
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  /**
   * Set (to true) by hand on a POST operation that never changes anything. The introduction of the
   * document claims "read-only" only for operations that carry it, and openapi.test.ts fails for any
   * POST that does not, so a POST that writes cannot be added without a decision about that claim.
   */
  "x-read-only"?: true;
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

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five"];

const countRoutes = (n: number) => `${COUNT_WORDS[n] ?? n} POST ${n === 1 ? "route" : "routes"}`;
const listPaths = (paths: readonly string[]) =>
  new Intl.ListFormat("en", { type: "conjunction" }).format(paths);

/**
 * The opening claim of the description, derived from the paths it describes so it cannot go stale.
 * "Only read" is said only of a POST operation that carries the explicit `x-read-only` marker; an
 * unmarked POST gets a neutral clause instead, so adding a route that writes cannot produce a
 * false public sentence.
 */
export function postRoutesSentence(paths: Record<string, Record<string, OpenApiOperation>>): string {
  const posts = Object.entries(paths)
    .filter(([, operations]) => operations.post)
    .map(([path, operations]) => ({ path, readOnly: operations.post["x-read-only"] === true }));
  const marked = posts.filter((post) => post.readOnly).map((post) => post.path);
  const unmarked = posts.filter((post) => !post.readOnly).map((post) => post.path);
  if (posts.length === 0) return "Everything here is a GET over content that is also published as web pages. ";

  const clauses = [
    ...(marked.length > 0
      ? [`${countRoutes(marked.length)} that only read${marked.length === 1 ? "s" : ""} (${listPaths(marked)})`]
      : []),
    ...(unmarked.length > 0
      ? [
          `${countRoutes(unmarked.length)} not marked read-only (${listPaths(unmarked)}), so read ${unmarked.length === 1 ? "its operation" : "their operations"} before calling`,
        ]
      : []),
  ];
  const lead = unmarked.length === 0 ? "Everything here is read-only: GET routes, plus " : "This API has GET routes, plus ";
  return `${lead}${clauses.join(", and ")}, over content that is also published as web pages. `;
}

function infoDescription(paths: Record<string, Record<string, OpenApiOperation>>): string {
  return (
    postRoutesSentence(paths) +
    "There are no API keys and no accounts. " +
    `${VERSIONING_POLICY.join(" ")} ${RATE_LIMIT_POLICY_TEXT.join(" ")} ` +
    "Pages negotiate their format: send `Accept: text/markdown` " +
    "to any page that has a Markdown twin and you get Markdown, send `Accept: text/html` and you get the page. " +
    "Errors on JSON routes use one shape (see the Error schema). " +
    "Content-Signal preference: search=yes, ai-input=yes, ai-train=no (robots.txt). " +
    "info.version is the revision of this description, not the API version and not the site version."
  );
}

export function buildOpenApiDocument(): OpenApiDocument {
  // The versioned JSON API first: it is the surface a client should build against.
  const paths = { ...buildV1Paths(), ...legacyPaths() };
  return {
    openapi: "3.1.0",
    info: {
      title: "Anvilry public API",
      version: "1.0.0",
      summary:
        "Read-only access to Sairam Ugge's portfolio content for people, scripts and AI agents.",
      description: infoDescription(paths),
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
      ...V1_TAGS,
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
    paths,
    components: {
      schemas: {
        ...V1_SCHEMAS,
        Error: ErrorSchema,
        ResumeJson: ResumeJsonSchema,
        GithubStats: GithubStatsSchema,
        McpRequest: McpRequestSchema,
        McpResponse: McpResponseSchema,
        MarkdownDocument: MarkdownDocumentSchema,
        PlainTextDocument: PlainTextDocumentSchema,
        XmlDocument: XmlDocumentSchema,
        HtmlDocument: HtmlDocumentSchema,
      },
      responses: {
        Error: {
          description:
            "Any error from a JSON route that is not the MCP endpoint. The body is the shared error object.",
          headers: {
            Allow: {
              description: "On a 405, the methods the route accepts.",
              schema: { type: "string" },
            },
            "Retry-After": {
              description: "On a 429, seconds to wait before retrying.",
              schema: { type: "integer" },
            },
          },
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
            },
          },
        },
        McpError: {
          description:
            "A failed MCP call. A request the MCP protocol itself rejects answers with a JSON-RPC error object; an unknown path or an unsupported method answers with the shared error object.",
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
