import type { MetadataRoute } from "next";
import { allProjects, allWork, allNotes, allArticles } from "@/lib/content";
import {
  ARTICLES_ENABLED,
  NOTES_ENABLED,
  STATS_ENABLED,
  SEARCH_ENABLED,
} from "@/lib/writing-flags";

const base = "https://anvilry.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/work",
    "/projects",
    "/about",
    "/resume",
    "/mcp",
  ].map((path) => ({
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

  // Notes — only when both flag AND content exist. `date` is a real per-note isodate
  // field (velite.config.ts), so lastModified here is accurate, not fabricated.
  const noteRoutes =
    NOTES_ENABLED && allNotes.length
      ? [
          {
            url: `${base}/notes`,
            changeFrequency: "weekly" as const,
            priority: 0.6,
            // Index page reflects the newest note — allNotes is sorted newest-first.
            lastModified: new Date(allNotes[0].date),
          },
          ...allNotes.map((n) => ({
            url: `${base}${n.url}`,
            changeFrequency: "monthly" as const,
            priority: 0.5,
            lastModified: new Date(n.date),
          })),
        ]
      : [];

  // Articles — only when both flag AND content exist. Same guard as
  // generateStaticParams in articles/[slug]/page.tsx: a notes-only article
  // (linkedNote set, no externalUrl) 404s while NOTES_ENABLED is false, so
  // it must not be listed as an indexable URL in that state either. `date`
  // is a real per-article isodate field, not a build-time stamp.
  const indexableArticles = allArticles.filter(
    (a) => !(a.linkedNote && !a.externalUrl && !NOTES_ENABLED),
  );
  const articleRoutes =
    ARTICLES_ENABLED && indexableArticles.length
      ? [
          {
            url: `${base}/articles`,
            changeFrequency: "weekly" as const,
            priority: 0.6,
            // Index page reflects the newest INDEXABLE article -- indexableArticles
            // preserves allArticles' newest-first order, just with 404 candidates removed.
            lastModified: new Date(indexableArticles[0].date),
          },
          ...indexableArticles.map((a) => ({
            url: `${base}${a.url}`,
            changeFrequency: "monthly" as const,
            priority: 0.5,
            lastModified: new Date(a.date),
          })),
        ]
      : [];

  const statsRoute = STATS_ENABLED
    ? [
        {
          url: `${base}/stats`,
          changeFrequency: "monthly" as const,
          priority: 0.6,
        },
      ]
    : [];

  const searchRoute = SEARCH_ENABLED
    ? [
        {
          url: `${base}/search`,
          changeFrequency: "monthly" as const,
          priority: 0.5,
        },
      ]
    : [];

  return [
    ...staticRoutes,
    ...workRoutes,
    ...projectRoutes,
    ...noteRoutes,
    ...articleRoutes,
    ...statsRoute,
    ...searchRoute,
  ];
}
