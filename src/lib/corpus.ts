import { allProjects, allWork } from "@/lib/content";
import { profile, skills, achievements } from "@/lib/profile";

/**
 * Builds the grounding corpus for the chatbot from the SAME content sources as the
 * site (Velite + profile) — so the bot can never drift from the verified ground truth.
 * The whole corpus is small (~4KB) and fits in-context, so no vector DB is needed at
 * this scale. (Upgrade path: move to pgvector + BM25 hybrid retrieval if the corpus
 * grows large, e.g. when blog posts are added.)
 */
export function buildCorpus(): string {
  const work = allWork
    .map(
      (w) =>
        `### ${w.name} (${w.role})\nContribution: ${w.register}\n${w.summary}\nMetrics: ${w.metrics
          .map((m) => `${m.value} ${m.label}`)
          .join("; ")}\nTech: ${w.tech.join(", ")}`,
    )
    .join("\n\n");

  const projects = allProjects
    .map(
      (p) =>
        `### ${p.name} — ${p.tagline}\nGroup: ${p.group}${
          p.commits ? ` · ${p.commits} commits` : ""
        }\nRepo: ${p.repo}\n${p.excerpt}\nTech: ${p.tech.join(", ")}`,
    )
    .join("\n\n");

  const skillsText = skills.map((s) => `${s.group}: ${s.items.join(", ")}`).join("\n");
  const achievementsText = achievements.map((a) => `${a.title} — ${a.detail}`).join("\n");

  return `# ${profile.name} — ${profile.role} @ ${profile.company} (${profile.tenure})
Location: ${profile.location}
Summary: ${profile.headline} ${profile.subhead}
Links: GitHub ${profile.links.github} · LinkedIn ${profile.links.linkedin}
Contact: ${profile.email}

## Production Work (at Ascendion)
${work}

## Open-Source Projects (github.com/${profile.githubUser})
${projects}

## Skills
${skillsText}

## Achievements
${achievementsText}`;
}
