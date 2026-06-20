import { profile, skills } from "@/lib/profile";
import { now } from "@/lib/personal";

// Machine-readable "open to work" signal — derived from the owner-authored now.focus
// (no new field invented). When Sairam is hired, removing the "open to new roles" line
// from personal.ts automatically drops the schema signal. Invisible to humans; lets
// recruiter tooling / search surface the availability.
const isOpenToWork = now.focus.some((f) => /open to (new )?roles?/i.test(f));

/**
 * JSON-LD Person schema — helps recruiters/search engines verify identity and
 * connect this site to GitHub/LinkedIn (sameAs). Rendered server-side in <head>.
 */
export function PersonJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    jobTitle: profile.role,
    email: `mailto:${profile.email}`,
    url: "https://anvilry.vercel.app",
    worksFor: { "@type": "Organization", name: profile.company },
    address: { "@type": "PostalAddress", addressLocality: profile.locationCity, addressCountry: profile.locationCountry },
    sameAs: [profile.links.github, profile.links.linkedin],
    knowsAbout: skills.flatMap((s) => s.items),
    ...(isOpenToWork && { seeks: { "@type": "Demand", name: "GenAI & Backend Engineering roles" } }),
  };
  return (
    <script
      type="application/ld+json"
      // Static, build-time data only — no user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * BreadcrumbList JSON-LD for detail pages (/work/[slug], /projects/[slug]) — earns
 * breadcrumb SERP features and tells search the site hierarchy. `items` is an ordered
 * [label, url] list from the page root down to the current page.
 */
export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

// Real programming languages only — a `tech` entry counts as a language for
// `programmingLanguage` ONLY if it's in this allowlist (everything else, e.g.
// frameworks/protocols/tools, becomes a `keyword`). Keeps the schema honest.
const PROGRAMMING_LANGUAGES = new Set([
  "Python", "Go", "TypeScript", "JavaScript", "Rust", "Java", "Kotlin", "Ruby",
  "C", "C++", "C#", "Swift", "PHP", "Scala", "Elixir", "Lua", "SQL", "Bash", "WebAssembly",
]);

/** SoftwareSourceCode for an OSS project page — entity-graph + AI-recruiter parsing.
 *  programmingLanguage carries ONLY real languages; frameworks/protocols → keywords. */
export function SoftwareSourceCodeJsonLd({
  name,
  description,
  url,
  codeRepository,
  tech,
}: {
  name: string;
  description: string;
  url: string;
  codeRepository: string;
  tech: string[];
}) {
  const languages = tech.filter((t) => PROGRAMMING_LANGUAGES.has(t));
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name,
    description,
    url,
    codeRepository,
    author: { "@type": "Person", name: profile.name, url: "https://anvilry.vercel.app" },
    ...(languages.length > 0 && { programmingLanguage: languages }),
    keywords: tech.join(", "),
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

/**
 * WebSite schema with potentialAction SearchAction — makes the site eligible for
 * Google's sitelinks search box in SERPs (Cmd+K palette already handles the query;
 * the SearchAction just tells Google where to send it). Static RSC, zero runtime cost.
 *
 * The ?q= target doesn't need a real server-side handler — the Cmd+K palette intercepts
 * the param on mount via ViewQuerySync-style logic (future enhancement). Google's
 * SearchAction only fires when the user interacts with the sitelinks box; the main page
 * load is unaffected whether or not the ?q= is present.
 */
export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: `${profile.name} — Portfolio`,
    url: "https://anvilry.vercel.app",
    author: { "@type": "Person", name: profile.name },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://anvilry.vercel.app/?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

/** CreativeWork for a production-work case study (NO aggregateRating — Google's
 *  self-serving-review policy; honest entity description only). */
export function CreativeWorkJsonLd({
  name,
  description,
  url,
  keywords,
}: {
  name: string;
  description: string;
  url: string;
  keywords: string[];
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name,
    description,
    url,
    author: { "@type": "Person", name: profile.name, url: "https://anvilry.vercel.app" },
    keywords: keywords.join(", "),
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

const BASE_URL = "https://anvilry.vercel.app";

/** FAQ schema for the homepage "Ask my portfolio" feature.
 *  Enables Google FAQ rich results — questions drawn from common recruiter queries. */
export function FaqJsonLd() {
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What stack does Sairam work with?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Python, Go, TypeScript, AWS (Bedrock, Polly, Transcribe), LLM orchestration (crewAI, multi-agent), RAG, ReAct pipelines, Redis, SSE, and React/Next.js on the frontend.",
        },
      },
      {
        "@type": "Question",
        name: "Is Sairam open to new roles?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes — actively looking for Backend, GenAI, and Full-Stack engineering roles. Remote or Hyderabad, India.",
        },
      },
      {
        "@type": "Question",
        name: "What has Sairam built in production?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pensieve (multi-agent LLM orchestration engine, 2K+ daily users), AAVA Code (AI coding plugin for VS Code, 3K+ daily users), Execution Engine (prompt-driven artifact generation, 65%→85% first-pass acceptance), Wireframe Generator (GenAI UI prototyping, 500+ daily users), and Prompt-to-React (code generation, 2K+ developers).",
        },
      },
      {
        "@type": "Question",
        name: "Where can I schedule a call with Sairam?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Book a 30-minute intro call at https://calendly.com/sairamugge/30min",
        },
      },
      {
        "@type": "Question",
        name: "What open-source projects has Sairam built?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "MindForge (agentic Claude Code framework, 1193+ commits), Agent-Forge (self-improving agent infrastructure), ContextOS (AI agent intelligence layer), Graph-Forge (code intelligence platform), and others. See https://anvilry.vercel.app/projects.",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
    />
  );
}

/** ProfilePage schema for /about — enables Google Discussions/Forums eligibility.
 *  mainEntity must be typed Person with name as required field. */
export function ProfilePageJsonLd() {
  const profilePage = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: "Sairam Ugge",
      jobTitle: "GenAI & Backend Engineer",
      worksFor: { "@type": "Organization", name: "Ascendion" },
      url: BASE_URL,
      sameAs: [
        "https://github.com/sairam0424",
        "https://linkedin.com/in/sairam0424",
      ],
      knowsAbout: [
        "LLM Agent Orchestration",
        "Multi-Agent Systems",
        "RAG",
        "ReAct",
        "Backend Architecture",
        "Python",
        "Go",
        "TypeScript",
        "AWS Bedrock",
        "Event-Driven Architecture",
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(profilePage) }}
    />
  );
}
