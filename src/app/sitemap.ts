import type { MetadataRoute } from "next";
import { allProjects, allWork, allNotes, allArticles } from "@/lib/content";

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

  // Notes — empty-safe: emits nothing while the collection is empty (the /notes index
  // 404s and the nav link is dark until a post exists), so the sitemap matches reality.
  const noteRoutes = allNotes.length
    ? [
        { url: `${base}/notes`, changeFrequency: "weekly" as const, priority: 0.6 },
        ...allNotes.map((n) => ({
          url: `${base}${n.url}`,
          changeFrequency: "monthly" as const,
          priority: 0.5,
        })),
      ]
    : [];

  // Articles — same empty-safe pattern; external articles point to /articles/<slug>
  // which server-redirects to the original publication, so they still get indexed.
  const articleRoutes = allArticles.length
    ? [
        { url: `${base}/articles`, changeFrequency: "weekly" as const, priority: 0.6 },
        ...allArticles.map((a) => ({
          url: `${base}${a.url}`,
          changeFrequency: "monthly" as const,
          priority: 0.5,
        })),
      ]
    : [];

  return [...staticRoutes, ...workRoutes, ...projectRoutes, ...noteRoutes, ...articleRoutes];
}
