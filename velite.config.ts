import { defineConfig, defineCollection, s } from "velite";

/* Theme group for the OSS projects (mirrors the GitHub pin strategy). */
const themeGroup = s.enum([
  "Platform, Guardrails & Observability",
  "Agent Frameworks & Infrastructure",
  "Code Intelligence & Engines",
  "Tooling & Lab",
]);

/* Glob patterns shared by each metadata collection and its body-only sibling, so the two always
 * cover the same files. */
const PATTERNS = {
  projects: "projects/**/*.mdx",
  work: "work/**/*.mdx",
  notes: "notes/**/*.{md,mdx}",
  articles: "articles/**/*.{md,mdx}",
} as const;

/* Compiled MDX is NOT a field of the four metadata collections below. A compiled body is a few KB of
 * JS source, about 300 KB across all four, and `src/lib/content.ts` (imported by a dozen client
 * modules) bundles whole collection JSON files into the shared first-load chunk because a JSON module
 * cannot be tree-shaken. With the bodies on the metadata, every new project card cost about 11 KB of
 * first-load JS on every route. They live in these sibling collections instead, which only
 * `src/lib/content-bodies.ts` reads and only the four server-rendered detail pages import.
 *
 * `slug` is a plain string here: its format and uniqueness are validated by the metadata collection
 * over the same files, and this collection only needs it as the join key. */
const bodyOnly = (name: string, pattern: string) =>
  defineCollection({
    name,
    pattern,
    schema: s.object({ slug: s.string(), body: s.mdx() }),
  });

/* One architecture-decision narrative, migrated verbatim from a project's
 * former "## Key Decisions" MDX section. See docs/superpowers/specs/
 * 2026-09-07-feature-phase-decisions-integrity-design.md. */
const decision = s.object({
  title: s.string(),
  body: s.string(),
  tags: s.array(s.string()).default([]),
});

/** Open-source / portfolio projects — architecture + tech only, no fabricated adoption. */
const projects = defineCollection({
  name: "Project",
  pattern: PATTERNS.projects,
  schema: s
    .object({
      slug: s.slug("project"),
      name: s.string(),
      tagline: s.string(),
      group: themeGroup,
      repo: s.string().url(),
      // "private" = the repository exists but a visitor cannot open it (GitHub 404s). The entry stays
      // (the dossier page is the product); every surface drops the repo link and says so, the repo
      // does not count as open source, and a private project must not be featured (content.test.ts).
      visibility: s.enum(["public", "private"]).default("public"),
      commits: s.number().optional(),
      // Real GitHub repo creation date + SPDX license ID, verified against the GitHub API
      // per-repo. Omitted (not fabricated) for repos that are private (404 unauthenticated)
      // or have no license file — see SoftwareSourceCodeJsonLd's handling of both.
      dateCreated: s.isodate().optional(),
      license: s.string().optional(),
      // Article slugs (content/articles/*.mdx) documenting this project. Resolved to
      // /notes/[slug] when the article has a linkedNote (NOTES_ENABLED-gated, same
      // rule as ArticleGroupCard), else to the article's own page/external URL.
      relatedArticles: s.array(s.string()).optional(),
      decisions: s.array(decision).default([]),
      tech: s.array(s.string()),
      pinned: s.boolean().default(false),
      pinRank: s.number().optional(),
      featured: s.boolean().default(false),
      order: s.number().default(100),
      excerpt: s.string(),
    })
    .transform((data) => ({ ...data, url: `/projects/${data.slug}` })),
});

/** Production work case studies — honest "Co-built/architected/Owned" register; real metrics. */
const work = defineCollection({
  name: "Work",
  pattern: PATTERNS.work,
  schema: s
    .object({
      slug: s.slug("work"),
      name: s.string(),
      role: s.string(),
      register: s.string(), // honest contribution note, e.g. "Co-built · architected the backend"
      summary: s.string(),
      metrics: s.array(s.object({ value: s.string(), label: s.string() })),
      tech: s.array(s.string()),
      order: s.number().default(100),
      // OPTIONAL hiring-manager depth — owner-authored, interview-defensible. Each
      // renders ONLY when present, so existing case studies are unchanged until filled.
      constraints: s.string().optional(), // the real limits the system had to work within
      tradeoffs: s.string().optional(), // what was deliberately chosen NOT to do, and why
      diagram: s.string().optional(), // path to an owner-authored architecture diagram (e.g. /static/...)
      diagramAlt: s.string().optional(), // REQUIRED alt text when `diagram` is set (a11y) — asserted in a test
    })
    .transform((data) => ({ ...data, url: `/work/${data.slug}` })),
});

/** Engineering notes / writing — accepts both .md (Inkforge-generated) and .mdx (hand-written).
 *
 *  Inkforge extended fields: tone/format/length/wordCount/readingTime/generatedBy/platforms
 *  are all optional so hand-written notes (without these fields) continue to compile. */
const notes = defineCollection({
  name: "Note",
  pattern: PATTERNS.notes,
  schema: s
    .object({
      slug: s.slug("note"),
      title: s.string(),
      date: s.isodate(),
      summary: s.string(),
      tags: s.array(s.string()).default([]),
      draft: s.boolean().default(false),
      // Inkforge generation metadata (optional — hand-written notes omit these)
      tone: s.enum(["beginner", "intermediate", "senior"]).optional(),
      format: s
        .enum(["tutorial", "narrative", "explainer", "opinion", "showcase"])
        .optional(),
      length: s.enum(["thread", "short", "medium", "comprehensive"]).optional(),
      wordCount: s.number().optional(),
      readingTime: s.number().optional(),
      generatedBy: s.string().optional(),
      category: s.string().optional(),
      platforms: s.array(s.string()).default([]),
    })
    .transform((data) => ({ ...data, url: `/notes/${data.slug}` })),
});

/** External / syndicated articles — Medium, Substack, LinkedIn, or native drafts.
 *
 *  Each entry is a small MDX file with frontmatter metadata. Clicking the card
 *  on the /articles page opens `externalUrl` directly (curator model — no RSS sync
 *  dependency, no API keys, works indefinitely). Native articles (source: "native")
 *  render their body inline like notes. */
const articles = defineCollection({
  name: "Article",
  pattern: PATTERNS.articles,
  schema: s
    .object({
      slug: s.slug("article"),
      title: s.string(),
      date: s.isodate(),
      summary: s.string(),
      source: s.enum([
        "medium",
        "substack",
        "linkedin",
        "devto",
        "hashnode",
        "native",
      ]),
      externalUrl: s.string().url().optional(), // required for non-native; omit for native
      canonicalUrl: s.string().url().optional(), // SEO: where the canonical version lives
      linkedNote: s.string().optional(), // slug of an existing /notes entry — card links there directly, no duplicate content
      tags: s.array(s.string()).default([]),
      draft: s.boolean().default(false),
      readingTime: s.number().optional(), // estimated minutes
    })
    .transform((data) => ({ ...data, url: `/articles/${data.slug}` })),
});

export default defineConfig({
  root: "content",
  output: {
    data: ".velite",
    assets: "public/static",
    base: "/static/",
    name: "[name]-[hash:6].[ext]",
    // Default to NOT cleaning: the `predev` hook + dev watcher regenerate in place,
    // so .velite/*.json is never momentarily deleted mid-session (which raced
    // webpack -> "Can't resolve './projects.json'"). The `build`/`content` scripts
    // pass --clean explicitly for a pristine production build.
    clean: false,
  },
  collections: {
    projects,
    work,
    notes,
    articles,
    projectBodies: bodyOnly("ProjectBody", PATTERNS.projects),
    workBodies: bodyOnly("WorkBody", PATTERNS.work),
    noteBodies: bodyOnly("NoteBody", PATTERNS.notes),
    articleBodies: bodyOnly("ArticleBody", PATTERNS.articles),
  },
  mdx: { gfm: true },
});
