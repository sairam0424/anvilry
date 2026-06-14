import { allProjects, allWork } from "@/lib/content";
import { profile, skills, achievements } from "@/lib/profile";
import { personal, now, hasPersonalContent, hasNow } from "@/lib/personal";
import { testimonials, hasTestimonials } from "@/lib/testimonials";

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

  // Personal "beyond the résumé" section — included ONLY when the owner has populated
  // src/lib/personal.ts, so the concierge can answer "what does Sairam do for fun?"
  // truthfully. Still grounded: the system prompt forbids invention. Empty => omitted
  // entirely (no change to today's corpus).
  const personalSection = hasPersonalContent || hasNow ? `\n\n## Personal (beyond the résumé)\n${[
    personal.hobbies.length ? `Hobbies: ${personal.hobbies.join("; ")}` : "",
    personal.funFacts.length ? `Fun facts: ${personal.funFacts.join("; ")}` : "",
    personal.currentlyLearning.length ? `Currently learning: ${personal.currentlyLearning.join("; ")}` : "",
    personal.askMeAbout.length ? `Ask me about: ${personal.askMeAbout.join("; ")}` : "",
    personal.uses.length ? `Uses: ${personal.uses.map((g) => `${g.group} — ${g.items.join(", ")}`).join("; ")}` : "",
    hasNow ? `Right now: ${now.focus.join("; ")}` : "",
  ].filter(Boolean).join("\n")}` : "";

  // Testimonials — third-person, attributed, included ONLY when real source-linked
  // recommendations exist (empty => omitted; the concierge never invents praise).
  const testimonialsSection = hasTestimonials
    ? `\n\n## Recommendations\n${testimonials.map((t) => `"${t.quote}" — ${t.name}, ${t.role} (${t.relationship})`).join("\n")}`
    : "";

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
${achievementsText}${personalSection}${testimonialsSection}`;
}
