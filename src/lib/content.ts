/**
 * Content access layer — re-exports Velite's generated output with sort/filter
 * helpers. Imported via the relative path since `.velite` lives at repo root.
 */
import { projects as rawProjects, work as rawWork, type Project, type Work } from "../../.velite";

export type { Project, Work };

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export const allProjects: Project[] = [...rawProjects].sort(byOrder);
export const allWork: Work[] = [...rawWork].sort(byOrder);

export const featuredProjects = allProjects.filter((p) => p.featured);

/** Pinned projects in pin-strategy order (rank 1..6). */
export const pinnedProjects = allProjects
  .filter((p) => p.pinned && p.pinRank != null)
  .sort((a, b) => (a.pinRank ?? 99) - (b.pinRank ?? 99));

export const projectGroups = [
  "Agent Frameworks & Infrastructure",
  "Code Intelligence & Engines",
  "Tooling & Lab",
] as const;

export function projectsByGroup() {
  return projectGroups.map((group) => ({
    group,
    items: allProjects.filter((p) => p.group === group),
  }));
}

export const getProject = (slug: string) => allProjects.find((p) => p.slug === slug);
export const getWork = (slug: string) => allWork.find((w) => w.slug === slug);
