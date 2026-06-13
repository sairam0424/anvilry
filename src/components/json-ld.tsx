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
