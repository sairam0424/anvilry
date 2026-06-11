import type { MetadataRoute } from "next";
import { allProjects, allWork } from "@/lib/content";

const base = "https://sairam.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/projects", "/about", "/resume"].map((path) => ({
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

  return [...staticRoutes, ...workRoutes, ...projectRoutes];
}
