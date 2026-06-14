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

/** Engineering notes / writing — EMPTY-SAFE: no .mdx files exist yet, so the collection
 *  is [] and the /notes nav link stays dark until the owner publishes real posts. */
const notes = defineCollection({
  name: "Note",
  pattern: "notes/**/*.mdx",
  schema: s
    .object({
      slug: s.slug("note"),
      title: s.string(),
      date: s.isodate(),
      summary: s.string(),
      tags: s.array(s.string()).default([]),
      draft: s.boolean().default(false),
      body: s.mdx(),
    })
    .transform((data) => ({ ...data, url: `/notes/${data.slug}` })),
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
  collections: { projects, work, notes },
  mdx: { gfm: true },
});
