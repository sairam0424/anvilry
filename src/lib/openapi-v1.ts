import { API_V1_BASE } from "@/lib/api-policy";
import {
  MAX_TEXT_PARAM_LENGTH,
  SLUG_PATTERN,
  V1_RESOURCES,
} from "@/lib/content-api";
import type { OpenApiOperation, OpenApiParameter } from "@/lib/openapi";
import {
  apiVersionParameter,
  errorResponses,
  successHeaders,
} from "@/lib/openapi-parts";
import { schemaRef } from "@/lib/openapi-v1-schemas";
import { SITE_URL } from "@/lib/site-url";

export { V1_SCHEMAS } from "@/lib/openapi-v1-schemas";

/**
 * The OpenAPI description of the versioned JSON API under /api/v1: its tags and one GET operation
 * per route (the component schemas are in openapi-v1-schemas.ts). src/lib/openapi.ts merges these
 * into the served document. Each route is checked to exist (openapi-v1.test.ts) and each response
 * to match its schema (src/app/api/v1/v1-contract.test.ts), so the description cannot drift from the code.
 */

export const V1_TAGS: { name: string; description: string }[] = [
  {
    name: "API",
    description:
      "The entry point of the versioned API: version, rate limit, deprecations and links to every resource.",
  },
  {
    name: "Profile",
    description:
      "Who the portfolio belongs to: identity, links, skills and achievements.",
  },
  {
    name: "Work",
    description:
      "Production case studies, each with its contribution register and real metrics.",
  },
  {
    name: "Projects",
    description:
      "Open-source and private projects with their stack, group and repository.",
  },
  {
    name: "Articles",
    description:
      "Published articles, native or cross-posted. Empty when none is published.",
  },
  {
    name: "Notes",
    description:
      "Engineering notes. Switched off on a default build, so the list is empty and every slug is a 404.",
  },
  {
    name: "Decisions",
    description:
      "The architecture-decision ledger drawn from the projects and case studies.",
  },
  {
    name: "Search",
    description: "Keyword search across case studies, projects and skills.",
  },
];

function slugParameter(collection: string, example: string): OpenApiParameter {
  return {
    name: "slug",
    in: "path",
    required: true,
    description: `URL slug of one ${collection} item. List the valid slugs at ${SITE_URL}${API_V1_BASE}/${collection}.`,
    schema: {
      type: "string",
      pattern: SLUG_PATTERN,
      minLength: 1,
      maxLength: 120,
    },
    example,
  };
}

const textQueryParameter = (args: {
  name: string;
  required: boolean;
  description: string;
  example: string;
}): OpenApiParameter => ({
  ...args,
  in: "query",
  schema: { type: "string", minLength: 1, maxLength: MAX_TEXT_PARAM_LENGTH },
});

/** Statuses a route can answer besides 200, always with 429 (from the proxy) and 500. */
// The proxy answers 405 for any write to a read-only public path, so every v1 route lists it.
const STATIC_ERRORS = [405, 429, 500] as const;
const ITEM_ERRORS = [400, 404, 405, 429, 500] as const;
const INPUT_ERRORS = [400, 405, 429, 500] as const;
const DYNAMIC_ERRORS = [405, 429, 500] as const;

function getOperation(args: {
  operationId: string;
  summary: string;
  description: string;
  tag: string;
  schema: string;
  okDescription: string;
  errors: readonly number[];
  parameters?: OpenApiParameter[];
}): OpenApiOperation {
  const {
    operationId,
    summary,
    description,
    tag,
    schema,
    okDescription,
    errors,
    parameters = [],
  } = args;
  return {
    operationId,
    summary,
    description,
    tags: [tag],
    parameters: [apiVersionParameter(), ...parameters],
    responses: {
      "200": {
        description: okDescription,
        headers: successHeaders(),
        content: { "application/json": { schema: schemaRef(schema) } },
      },
      ...errorResponses(errors),
      default: { $ref: "#/components/responses/Error" },
    },
  };
}

/** Names the MCP tool whose data a route repeats, so an agent that knows one surface can map it to the other. */
const mcpNote = (tool: string) =>
  `The data is the same as the ${tool} tool of the MCP server at ${SITE_URL}/api/mcp/mcp.`;

function listAndItem(args: {
  collection: "work" | "projects" | "articles" | "notes";
  tag: string;
  noun: string;
  plural: string;
  example: string;
  schemas: { list: string; item: string };
  ids: { list: string; item: string };
  listExtra: string;
  itemExtra: string;
}): Record<string, Record<string, OpenApiOperation>> {
  const {
    collection,
    tag,
    noun,
    plural,
    example,
    schemas,
    ids,
    listExtra,
    itemExtra,
  } = args;
  const base = `${API_V1_BASE}/${collection}`;
  return {
    [base]: {
      get: getOperation({
        operationId: ids.list,
        summary: `List the ${plural}`,
        description: `Returns every ${noun} as { count, items }, in the order the site shows them. ${listExtra} Use the slug of an item with ${base}/{slug} for the item itself.`,
        tag,
        schema: schemas.list,
        okDescription: `The ${plural}.`,
        errors: STATIC_ERRORS,
      }),
    },
    [`${base}/{slug}`]: {
      get: getOperation({
        operationId: ids.item,
        summary: `Get one ${noun} by slug`,
        description: `Returns one ${noun} by its slug. ${itemExtra} An unknown slug answers 404 with the valid slugs in the hint; a slug that is not 1 to 120 letters, digits, underscores or hyphens answers 400.`,
        tag,
        schema: schemas.item,
        okDescription: `The ${noun}.`,
        errors: ITEM_ERRORS,
        parameters: [slugParameter(collection, example)],
      }),
    },
  };
}

export function buildV1Paths(): Record<
  string,
  Record<string, OpenApiOperation>
> {
  return {
    [API_V1_BASE]: {
      get: getOperation({
        operationId: "getApiIndex",
        summary: "Get the API index with version and resource links",
        description: `Start here. Returns the API version, its stability, the rate limit, any deprecated surface and the absolute URL of every resource under ${API_V1_BASE}, so a client can discover the API without reading this document.`,
        tag: "API",
        schema: "ApiIndex",
        okDescription: "The API index.",
        errors: STATIC_ERRORS,
      }),
    },
    [V1_RESOURCES.profile]: {
      get: getOperation({
        operationId: "getProfile",
        summary: "Get the owner's profile, skills and achievements",
        description: `Returns who the portfolio belongs to: name, role, employer, location, headline, public profile links, skills by group and achievements. ${mcpNote("get_profile")}`,
        tag: "Profile",
        schema: "Profile",
        okDescription: "The profile.",
        errors: STATIC_ERRORS,
      }),
    },
    ...listAndItem({
      collection: "work",
      tag: "Work",
      noun: "production case study",
      plural: "production case studies",
      example: "pensieve",
      schemas: { list: "WorkList", item: "WorkItem" },
      ids: { list: "listWork", item: "getWorkItem" },
      listExtra: `Each carries the owner's role, an honest contribution register and headline metrics. ${mcpNote("list_work")}`,
      itemExtra: `Adds a first-person summary to the fields of the list. ${mcpNote("get_work")}`,
    }),
    ...listAndItem({
      collection: "projects",
      tag: "Projects",
      noun: "project",
      plural: "projects",
      example: "trelix",
      schemas: { list: "ProjectList", item: "ProjectItem" },
      ids: { list: "listProjects", item: "getProjectItem" },
      listExtra: `A private project has a null repo. ${mcpNote("list_projects")}`,
      itemExtra: `Adds the commit count and an architecture excerpt to the fields of the list. ${mcpNote("get_project")}`,
    }),
    ...listAndItem({
      collection: "articles",
      tag: "Articles",
      noun: "article",
      plural: "published articles",
      example: "feature-flags-at-scale-devto",
      schemas: { list: "ArticleList", item: "ArticleItem" },
      ids: { list: "listArticles", item: "getArticleItem" },
      listExtra: "The list is empty when no article is published.",
      itemExtra:
        "A cross-posted article is a summary; its url is the page on this site that links to the full text.",
    }),
    ...listAndItem({
      collection: "notes",
      tag: "Notes",
      noun: "engineering note",
      plural: "published engineering notes",
      example: "how-dns-works",
      schemas: { list: "NoteList", item: "NoteItem" },
      ids: { list: "listNotes", item: "getNoteItem" },
      listExtra:
        "Notes are switched off on a default build, so the list is then empty (count 0).",
      itemExtra: "While notes are switched off every slug answers 404.",
    }),
    [V1_RESOURCES.decisions]: {
      get: getOperation({
        operationId: "listDecisions",
        summary: "List architecture decisions, optionally by tag",
        description: `Returns the architecture decisions, constraints and tradeoffs written up on the projects and case studies, as { count, items }. Send tag to keep only the entries that carry it; a tag nothing carries gives an empty list, not an error. A blank or over-long tag answers 400. ${mcpNote("list_decisions")}`,
        tag: "Decisions",
        schema: "DecisionList",
        okDescription: "The matching decisions.",
        errors: INPUT_ERRORS,
        parameters: [
          textQueryParameter({
            name: "tag",
            required: false,
            description:
              "Keep only decisions that carry exactly this tag, for example mcp, security or cost. Omit it for all decisions.",
            example: "mcp",
          }),
        ],
      }),
    },
    [V1_RESOURCES.search]: {
      get: getOperation({
        operationId: "searchPortfolio",
        summary: "Search work, projects and skills by keyword",
        description: `Case-insensitive substring search across case studies, projects and skills. Returns the query as applied, the matching case studies and projects, and the matching skill groups; nothing matching gives empty arrays, not an error. A missing, blank or over-long q answers 400. ${mcpNote("search_experience")}`,
        tag: "Search",
        schema: "SearchResult",
        okDescription: "The matches.",
        errors: INPUT_ERRORS,
        parameters: [
          textQueryParameter({
            name: "q",
            required: true,
            description: `Keywords to look for, 1 to ${MAX_TEXT_PARAM_LENGTH} characters after trimming, for example kafka or multi-agent.`,
            example: "kafka",
          }),
        ],
      }),
    },
    [V1_RESOURCES.resume]: {
      get: getOperation({
        operationId: "getResume",
        summary: "Get the résumé as JSON Resume on the versioned route",
        description: `Returns the structured résumé in the JSON Resume format: basics, production work, projects, skills and awards. It is the same document as /api/resume.json, served under the versioned base ${API_V1_BASE}.`,
        tag: "Data",
        schema: "ResumeJson",
        okDescription: "The résumé document.",
        errors: STATIC_ERRORS,
      }),
    },
    [V1_RESOURCES.githubStats]: {
      get: getOperation({
        operationId: "getGithubStatsV1",
        summary: "Get aggregate GitHub statistics on the versioned route",
        description: `Returns stars, forks, languages, follower and repository counts across the owner's listed repositories, cached for an hour. It is the same document as /api/github/stats and never errors on an upstream failure: counts fall back to zero and the latest push to null.`,
        tag: "Data",
        schema: "GithubStats",
        okDescription: "The aggregate statistics.",
        errors: DYNAMIC_ERRORS,
      }),
    },
  };
}
