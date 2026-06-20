import type { MetadataRoute } from "next";
import { allProjects, allWork, allNotes, allArticles } from "@/lib/content";
import { ARTICLES_ENABLED, NOTES_ENABLED, STATS_ENABLED, SEARCH_ENABLED } from "@/lib/writing-flags";

const base = "https://anvilry.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/projects", "/about", "/resume", "/mcp"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const projectRoutes = allProjects.map((p) => ({
    url: `${base}${p.url}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const workRoutes = allWork.map((w) => ({
    url: `${base}${w.url}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // Notes — only when both flag AND content exist.
  const noteRoutes = NOTES_ENABLED && allNotes.length
    ? [
        { url: `${base}/notes`, changeFrequency: "weekly" as const, priority: 0.6 },
        ...allNotes.map((n) => ({
          url: `${base}${n.url}`,
          changeFrequency: "monthly" as const,
          priority: 0.5,
        })),
      ]
    : [];

  // Articles — only when both flag AND content exist.
  const articleRoutes = ARTICLES_ENABLED && allArticles.length
    ? [
        { url: `${base}/articles`, changeFrequency: "weekly" as const, priority: 0.6 },
        ...allArticles.map((a) => ({
          url: `${base}${a.url}`,
          changeFrequency: "monthly" as const,
          priority: 0.5,
        })),
      ]
    : [];

  const statsRoute = STATS_ENABLED
    ? [{ url: `${base}/stats`, changeFrequency: "monthly" as const, priority: 0.6 }]
    : [];

  const searchRoute = SEARCH_ENABLED
    ? [{ url: `${base}/search`, changeFrequency: "monthly" as const, priority: 0.5 }]
    : [];

  return [...staticRoutes, ...workRoutes, ...projectRoutes, ...noteRoutes, ...articleRoutes, ...statsRoute, ...searchRoute];
}
