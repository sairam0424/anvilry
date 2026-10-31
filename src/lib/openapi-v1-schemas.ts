import { API_VERSION } from "@/lib/api-policy";
import { projectGroups } from "@/lib/content";
import type { V1_RESOURCES } from "@/lib/content-api";
import type { Json } from "@/lib/openapi";

/**
 * The component schemas of the versioned JSON API (openapi-v1.ts adds the operations). Each one is
 * checked against what its route really returns by src/app/api/v1/v1-contract.test.ts, so a field a
 * route emits and a schema omits fails the build.
 *
 * The résumé, the GitHub statistics and the error object are not redefined here: they are the
 * ResumeJson, GithubStats and Error schemas that openapi.ts already owns.
 */

export const schemaRef = (name: string): Json => ({
  $ref: `#/components/schemas/${name}`,
});

/** A property with an explicit schema, for the ones that are not a plain string (a nullable value, say). */
const prop = (description: string, schema: Json): Json => ({
  ...schema,
  description,
});
const text = (description: string, extra: Json = {}): Json =>
  prop(description, { type: "string", ...extra });
const link = (description: string): Json =>
  text(description, { format: "uri" });
const count = (description: string): Json => ({
  type: "integer",
  minimum: 0,
  description,
});
const list = (items: Json, description: string): Json => ({
  type: "array",
  items,
  description,
});
const textList = (description: string): Json =>
  list({ type: "string" }, description);

/** An object whose every declared property is always present, unless `required` says otherwise. */
function object(
  description: string,
  properties: Record<string, Json>,
  required = Object.keys(properties),
): Json {
  return { type: "object", description, required, properties };
}

/** The `{ count, items }` envelope every list route answers. */
const listOf = (itemSchema: string, description: string): Json =>
  object(description, {
    count: count("Number of items in `items`."),
    items: list(
      schemaRef(itemSchema),
      "The items, in the order the site shows them.",
    ),
  });

const SLUG = text(
  "URL slug that identifies the item; pass it to the item route.",
);
const URL_OF = (what: string) => link(`Absolute URL of ${what} on the site.`);

const WORK_SUMMARY_PROPERTIES: Record<string, Json> = {
  slug: SLUG,
  name: text("Name of the case study."),
  role: text("The owner's role and employer."),
  register: text(
    "The honest contribution register, for example co-built or architected.",
  ),
  metrics: list(schemaRef("Metric"), "Headline numbers of the case study."),
  tech: textList("Technologies used."),
  url: URL_OF("the case study"),
};

const PROJECT_SUMMARY_PROPERTIES: Record<string, Json> = {
  slug: SLUG,
  name: text("Name of the project."),
  tagline: text("One-line description."),
  group: text("The project group the site files it under.", {
    enum: [...projectGroups],
  }),
  repo: prop("URL of the public repository; null for a private repository.", {
    type: ["string", "null"],
    format: "uri",
  }),
  tech: textList("Technologies used."),
  url: URL_OF("the project page"),
};

const DATED_ITEM_PROPERTIES: Record<string, Json> = {
  slug: SLUG,
  name: text("Title."),
  summary: text("One-paragraph summary."),
  date: text("Publication date as an ISO 8601 timestamp.", {
    format: "date-time",
  }),
};

const RESOURCE_DESCRIPTIONS: Record<keyof typeof V1_RESOURCES, string> = {
  profile: "Identity, links, skills and achievements.",
  work: "List of production case studies; append /{slug} for one.",
  projects: "List of projects; append /{slug} for one.",
  articles: "List of published articles; append /{slug} for one.",
  notes: "List of published notes (empty by default); append /{slug} for one.",
  decisions: "Architecture decisions; add ?tag= to filter.",
  search: "Keyword search; add ?q= with the keywords.",
  resume: "The résumé as JSON Resume.",
  githubStats: "Aggregate GitHub statistics.",
};

export const V1_SCHEMAS: Record<string, Json> = {
  ApiIndex: object(
    "The API index: the version, the rate limit, what is deprecated and where each resource lives.",
    {
      version: text("The API version this index describes.", {
        enum: [API_VERSION],
      }),
      status: text("Lifecycle stage of this version.", { enum: ["stable"] }),
      baseUrl: link("Absolute URL every versioned route starts with."),
      openapi: link("Absolute URL of the OpenAPI document."),
      docs: link("Absolute URL of the developer guide."),
      rateLimit: object("The per-client request budget.", {
        requests: count("Requests allowed per window."),
        windowSeconds: count("Length of the window in seconds."),
      }),
      deprecations: list(
        object("A deprecated surface.", {
          prefix: text("Paths that start with this prefix are deprecated."),
          deprecatedOn: text("Date the deprecation was announced.", {
            format: "date",
          }),
          sunsetOn: text("Date after which the surface may stop working.", {
            format: "date",
          }),
          successor: text("Where to go instead."),
        }),
        "Deprecated surfaces. Empty while nothing is scheduled for removal.",
      ),
      resources: object(
        "Absolute URL of each resource, by name.",
        Object.fromEntries(
          Object.entries(RESOURCE_DESCRIPTIONS).map(([name, description]) => [
            name,
            link(description),
          ]),
        ),
      ),
    },
  ),
  Metric: object("A headline number of a case study.", {
    value: text("The number as written, for example 3K+."),
    label: text("What the number counts."),
  }),
  Profile: object(
    "Identity, links, skills and achievements of the portfolio owner.",
    {
      name: text("Full name."),
      role: text("Current role."),
      company: text("Current employer."),
      tenure: text("Time at the current employer."),
      location: text("Where the owner is based."),
      headline: text("One-sentence headline."),
      summary: text("Short summary of the work."),
      links: object("Public profiles and the site itself.", {
        github: link("GitHub profile."),
        linkedin: link("LinkedIn profile."),
        npm: link("npm publisher page."),
        pypi: link("PyPI maintainer page."),
        devto: link("Dev.to profile."),
        substack: link("Substack publication."),
        site: link("This site."),
      }),
      skills: list(
        object("A group of related skills.", {
          group: text("Name of the group."),
          items: textList("Skills in the group."),
        }),
        "Skills by group.",
      ),
      achievements: list(
        object("A competition result or distinction.", {
          title: text("What it was."),
          detail: text("The rank or scale."),
        }),
        "Competition results and distinctions.",
      ),
    },
  ),
  WorkSummary: object(
    "A production case study as it appears in a list.",
    WORK_SUMMARY_PROPERTIES,
  ),
  WorkItem: object("A production case study.", {
    ...WORK_SUMMARY_PROPERTIES,
    summary: text(
      "First-person summary of what was built and the owner's part in it.",
    ),
  }),
  WorkList: listOf("WorkSummary", "The production case studies, as a count and a list of summaries."),
  ProjectSummary: object(
    "A project as it appears in a list.",
    PROJECT_SUMMARY_PROPERTIES,
  ),
  ProjectItem: object("A project with its stack, group, repository and architecture excerpt.", {
    ...PROJECT_SUMMARY_PROPERTIES,
    commits: prop(
      "Commit count of the repository when known; null otherwise.",
      {
        type: ["integer", "null"],
        minimum: 0,
      },
    ),
    excerpt: text("Short description of the project's architecture."),
  }),
  ProjectList: listOf("ProjectSummary", "The projects, as a count and a list of summaries."),
  ArticleItem: object("A published article.", {
    ...DATED_ITEM_PROPERTIES,
    tags: textList("Topic tags."),
    url: URL_OF("the article"),
  }),
  ArticleList: listOf(
    "ArticleItem",
    "The published articles. Empty when none is published.",
  ),
  NoteItem: object("A published engineering note.", {
    ...DATED_ITEM_PROPERTIES,
    url: URL_OF("the note"),
  }),
  NoteList: listOf(
    "NoteItem",
    "The published notes. Empty while notes are switched off, which is the default.",
  ),
  DecisionItem: object("One architecture decision, constraint or tradeoff.", {
    sourceKind: text("Whether it comes from a case study or a project.", {
      enum: ["work", "project"],
    }),
    sourceName: text("Name of the case study or project it belongs to."),
    title: text("Short title of the decision."),
    body: text("The reasoning, in prose."),
    tags: textList("Topic tags; filter the list by one of them."),
    url: URL_OF("the page it comes from"),
  }),
  DecisionList: listOf(
    "DecisionItem",
    "The architecture decisions, optionally filtered by tag.",
  ),
  SearchMatch: object("A case study or project that matches the search.", {
    kind: text("What matched.", { enum: ["work", "project"] }),
    slug: SLUG,
    name: text("Name of the match."),
    url: URL_OF("the match"),
  }),
  SkillMatch: object("A skill group that matches the search.", {
    kind: text("Always skill.", { enum: ["skill"] }),
    group: text("Name of the skill group."),
    items: textList("The skills in the group that match."),
  }),
  SearchResult: object("The result of a keyword search.", {
    query: text("The search text as it was applied, trimmed."),
    matches: list(
      schemaRef("SearchMatch"),
      "Case studies and projects that match, case studies first.",
    ),
    skills: list(schemaRef("SkillMatch"), "Skill groups that match."),
  }),
};
