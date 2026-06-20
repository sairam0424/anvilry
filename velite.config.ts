import { defineConfig, defineCollection, s } from "velite";

/* Theme group for the OSS projects (mirrors the GitHub pin strategy). */
const themeGroup = s.enum([
  "Agent Frameworks & Infrastructure",
  "Code Intelligence & Engines",
  "Tooling & Lab",
]);

/** Open-source / portfolio projects — architecture + tech only, no fabricated adoption. */
const projects = defineCollection({
  name: "Project",
  pattern: "projects/**/*.mdx",
  schema: s
    .object({
      slug: s.slug("project"),
      name: s.string(),
      tagline: s.string(),
      group: themeGroup,
      repo: s.string().url(),
      commits: s.number().optional(),
      tech: s.array(s.string()),
      pinned: s.boolean().default(false),
      pinRank: s.number().optional(),
      featured: s.boolean().default(false),
      order: s.number().default(100),
      body: s.mdx(),
      excerpt: s.string(),
    })
    .transform((data) => ({ ...data, url: `/projects/${data.slug}` })),
});

/** Production work case studies — honest "Co-built/architected/Owned" register; real metrics. */
const work = defineCollection({
  name: "Work",
  pattern: "work/**/*.mdx",
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
      body: s.mdx(),
    })
    .transform((data) => ({ ...data, url: `/work/${data.slug}` })),
});

/** Engineering notes / writing — accepts both .md (Inkforge-generated) and .mdx (hand-written).
 *
 *  Inkforge extended fields: tone/format/length/wordCount/readingTime/generatedBy/platforms
 *  are all optional so hand-written notes (without these fields) continue to compile. */
const notes = defineCollection({
  name: "Note",
  pattern: "notes/**/*.{md,mdx}",
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
      format: s.enum(["tutorial", "narrative", "explainer", "opinion", "showcase"]).optional(),
      length: s.enum(["thread", "short", "medium", "comprehensive"]).optional(),
      wordCount: s.number().optional(),
      readingTime: s.number().optional(),
      generatedBy: s.string().optional(),
      category: s.string().optional(),
      platforms: s.array(s.string()).default([]),
      body: s.mdx(),
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
  pattern: "articles/**/*.{md,mdx}",
  schema: s
    .object({
      slug: s.slug("article"),
      title: s.string(),
      date: s.isodate(),
      summary: s.string(),
      source: s.enum(["medium", "substack", "linkedin", "native"]),
      externalUrl: s.string().url().optional(), // required for non-native; omit for native
      canonicalUrl: s.string().url().optional(), // SEO: where the canonical version lives
      linkedNote: s.string().optional(), // slug of an existing /notes entry — card links there directly, no duplicate content
      tags: s.array(s.string()).default([]),
      draft: s.boolean().default(false),
      readingTime: s.number().optional(), // estimated minutes
      body: s.mdx(),
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
  collections: { projects, work, notes, articles },
  mdx: { gfm: true },
});
