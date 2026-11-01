import { profile, skills } from "@/lib/profile";
import { now } from "@/lib/personal";
import { SITE_URL } from "@/lib/site-url";

// Safe serialisation for <script type="application/ld+json"> blocks.
// JSON.stringify leaves the characters below untouched, and each can change how the HTML parser
// reads a <script> element:
//   <  begins `</script>` (ends the block early), `<!--` and `<script`. After `<!--` a later
//      `<script` puts the tokenizer in its "double escaped" state, where the block's own `</script>`
//      no longer closes it and the rest of the page, with every JSON-LD block after this one, is
//      swallowed. Browsers and spec-compliant parsers do this; happy-dom does not model it, so
//      the tests assert on the serialised text.
//   >  and &  close `-->` and begin character references; escaping them costs nothing.
//   U+2028 and U+2029  are line terminators in JavaScript source, escaped by convention so the
//      block is also a valid JS literal.
// Each becomes its JSON \uXXXX escape, which JSON.parse reads back to the same character, so the
// parsed object is identical to the one that was serialised.
const JSON_LD_ESCAPES: Readonly<Record<string, string>> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (char) => JSON_LD_ESCAPES[char]);
}

const SCHEMA_CONTEXT = "https://schema.org";

/**
 * One JSON-LD block: puts the schema.org context first and serialises through `safeJsonLd`.
 * Used by the list and API components in json-ld-lists.tsx and json-ld-api.tsx, which keep this file
 * under its size limit.
 */
export function JsonLdScript({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Owner-authored data only (content frontmatter, profile.ts), and escaped anyway: see safeJsonLd.
      dangerouslySetInnerHTML={{
        __html: safeJsonLd({ "@context": SCHEMA_CONTEXT, ...data }),
      }}
    />
  );
}

/** The site owner as a schema.org Person reference. A function, so every caller gets its own object. */
export function authorPerson() {
  return { "@type": "Person", name: profile.name, url: SITE_URL };
}

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
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    jobTitle: profile.role,
    description: `${profile.headline} ${profile.subhead}`,
    email: `mailto:${profile.email}`,
    url: "https://anvilry.vercel.app",
    worksFor: { "@type": "Organization", name: profile.company },
    address: {
      "@type": "PostalAddress",
      addressLocality: profile.locationCity,
      addressCountry: profile.locationCountry,
    },
    sameAs: [
      profile.links.github,
      profile.links.linkedin,
      profile.links.npm,
      profile.links.pypi,
      profile.links.devto,
      profile.links.substack,
    ],
    knowsAbout: skills.flatMap((s) => s.items),
    ...(isOpenToWork && {
      seeks: { "@type": "Demand", name: "GenAI & Backend Engineering roles" },
    }),
  };
  return (
    <script
      type="application/ld+json"
      // Static, build-time data only — no user input.
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

/**
 * BreadcrumbList JSON-LD for detail pages (/work/[slug], /projects/[slug]) — earns
 * breadcrumb SERP features and tells search the site hierarchy. `items` is an ordered
 * [label, url] list from the page root down to the current page.
 */
export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
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
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

// Real programming languages only — a `tech` entry counts as a language for
// `programmingLanguage` ONLY if it's in this allowlist (everything else, e.g.
// frameworks/protocols/tools, becomes a `keyword`). Keeps the schema honest.
const PROGRAMMING_LANGUAGES = new Set([
  "Python",
  "Go",
  "TypeScript",
  "JavaScript",
  "Rust",
  "Java",
  "Kotlin",
  "Ruby",
  "C",
  "C++",
  "C#",
  "Swift",
  "PHP",
  "Scala",
  "Elixir",
  "Lua",
  "SQL",
  "Bash",
  "WebAssembly",
]);

export interface SoftwareSourceCodeInput {
  name: string;
  description: string;
  url: string;
  /** Omit for a private repository: advertising a URL that 404s helps no crawler. */
  codeRepository?: string;
  tech: readonly string[];
  /** Real GitHub repo creation date (ISO date) — omit rather than guess for private repos. */
  dateCreated?: string;
  /** SPDX license ID — omit rather than guess for repos with no license file. */
  license?: string;
}

/** The SoftwareSourceCode entity for an OSS project, without the @context. /projects/[slug] and the
 *  homepage list (json-ld-lists.tsx) both build it here and pass the same arguments, so they describe
 *  a project with the same properties and values.
 *  programmingLanguage carries ONLY real languages; frameworks/protocols → keywords. */
export function softwareSourceCodeEntity({
  name,
  description,
  url,
  codeRepository,
  tech,
  dateCreated,
  license,
}: SoftwareSourceCodeInput) {
  const languages = tech.filter((t) => PROGRAMMING_LANGUAGES.has(t));
  return {
    "@type": "SoftwareSourceCode",
    name,
    description,
    url,
    ...(codeRepository && { codeRepository }),
    author: authorPerson(),
    ...(languages.length > 0 && { programmingLanguage: languages }),
    keywords: tech.join(", "),
    ...(dateCreated && { dateCreated }),
    ...(license && { license: `https://spdx.org/licenses/${license}.html` }),
  };
}

/** SoftwareSourceCode for an OSS project page — entity-graph + AI-recruiter parsing. */
export function SoftwareSourceCodeJsonLd(props: SoftwareSourceCodeInput) {
  return <JsonLdScript data={softwareSourceCodeEntity(props)} />;
}

/** Stable identifier other blocks (WebSite.publisher) use to point at the Organization below. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/**
 * Organization JSON-LD for the site itself ("Anvilry" is the portfolio brand, run by one person),
 * so a crawler or agent finds a contact point and a postal address without reading prose. It
 * models the site, not the employer: worksFor on the Person stays a bare name because this site
 * has no business publishing Ascendion's contact details. Only data already public in profile.ts
 * appears here (email, city and country); the phone number that sits in the résumé PDF does not.
 */
export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Anvilry",
    url: SITE_URL,
    description: `The portfolio of ${profile.name}, ${profile.role}: production case studies, open-source projects and a read-only API for people and AI agents.`,
    founder: { "@type": "Person", name: profile.name },
    email: profile.email,
    address: {
      "@type": "PostalAddress",
      addressLocality: profile.locationCity,
      addressCountry: profile.locationCountry,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "professional inquiries",
      email: profile.email,
      url: `${SITE_URL}/contact`,
      availableLanguage: "English",
    },
    sameAs: [profile.links.github, profile.links.linkedin],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

/**
 * WebSite schema. No potentialAction/SearchAction: SEARCH_ENABLED defaults off, so /search
 * is not a live, advertised page (`pnpm build` does now generate the Pagefind index, but
 * that alone does not switch the page on), so there is no working search endpoint
 * to point Google's sitelinks search box at today. Google also retired the
 * sitelinks-search-box rich result regardless, so there's no SERP benefit either
 * way. Re-add potentialAction pointing at /search if SEARCH_ENABLED ever ships live.
 */
export function WebSiteJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: `${profile.name} — Portfolio`,
    url: "https://anvilry.vercel.app",
    author: { "@type": "Person", name: profile.name },
    publisher: { "@id": ORGANIZATION_ID },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

/** CreativeWork for a production-work case study (NO aggregateRating — Google's
 *  self-serving-review policy; honest entity description only). */
export function CreativeWorkJsonLd({
  name,
  description,
  url,
  keywords,
  image,
}: {
  name: string;
  description: string;
  url: string;
  keywords: string[];
  /** Absolute URL to the page's opengraph-image route. */
  image?: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name,
    description,
    url,
    author: {
      "@type": "Person",
      name: profile.name,
      url: "https://anvilry.vercel.app",
    },
    keywords: keywords.join(", "),
    ...(image && { image }),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
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
      dangerouslySetInnerHTML={{ __html: safeJsonLd(faq) }}
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
      name: profile.name,
      jobTitle: profile.role,
      worksFor: { "@type": "Organization", name: profile.company },
      url: BASE_URL,
      sameAs: [
        profile.links.github,
        profile.links.linkedin,
        profile.links.npm,
        profile.links.pypi,
        profile.links.devto,
        profile.links.substack,
      ],
      knowsAbout: skills.flatMap((s) => s.items),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(profilePage) }}
    />
  );
}
