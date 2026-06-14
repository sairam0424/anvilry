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
