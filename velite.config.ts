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
      body: s.mdx(),
    })
    .transform((data) => ({ ...data, url: `/work/${data.slug}` })),
});

export default defineConfig({
  root: "content",
  output: {
    data: ".velite",
    assets: "public/static",
    base: "/static/",
    name: "[name]-[hash:6].[ext]",
    clean: true,
  },
  collections: { projects, work },
  mdx: { gfm: true },
});
