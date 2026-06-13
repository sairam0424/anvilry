import { profile, skills } from "@/lib/profile";

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
  };
  return (
    <script
      type="application/ld+json"
      // Static, build-time data only — no user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
