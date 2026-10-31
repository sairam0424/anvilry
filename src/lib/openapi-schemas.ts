import { API_ERROR_CODES } from "@/lib/api-error";
import type { Json } from "@/lib/openapi";

/**
 * The reusable component schemas of the OpenAPI document: the résumé, the GitHub statistics,
 * the shared error object, the MCP envelopes and the four text document types. They live apart
 * from the operations so openapi.ts stays readable; openapi.test.ts pins each one to what its
 * route really returns.
 */

const JSON_ERROR_CODES = API_ERROR_CODES.map((c) => c.code);

export const ResumeJsonSchema: Json = {
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

export const GithubStatsSchema: Json = {
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

export const ErrorSchema: Json = {
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

export const McpRequestSchema: Json = {
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

export const McpResponseSchema: Json = {
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


/**
 * The non-JSON bodies, as named schemas so a tool-definition generator sees a typed string with
 * its media type instead of an anonymous `{ "type": "string" }`.
 */
export const MarkdownDocumentSchema: Json = {
  type: "string",
  contentMediaType: "text/markdown",
  description: "A Markdown document that starts with a top-level heading.",
};

export const PlainTextDocumentSchema: Json = {
  type: "string",
  contentMediaType: "text/plain",
  description: "A UTF-8 plain-text document.",
};

export const XmlDocumentSchema: Json = {
  type: "string",
  contentMediaType: "application/xml",
  description: "A well-formed XML document.",
};

export const HtmlDocumentSchema: Json = {
  type: "string",
  contentMediaType: "text/html",
  description: "An HTML page.",
};
