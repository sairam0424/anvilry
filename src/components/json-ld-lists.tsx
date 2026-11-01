import {
  authorPerson,
  JsonLdScript,
  softwareSourceCodeEntity,
} from "@/components/json-ld";
import type { ArticleGroup } from "@/lib/article-grouping";
import { resolveCanonicalHref } from "@/lib/article-href";
import {
  allWork,
  featuredProjects,
  repoLink,
  type Project,
  type Work,
} from "@/lib/content";
import { homeArticleGroups } from "@/lib/home-articles";
import { SITE_URL } from "@/lib/site-url";
import { stripTrackingParams } from "@/lib/strip-tracking-params";

/**
 * JSON-LD ItemLists for the three lists the homepage shows: the flagship production work, the
 * featured open-source projects and the latest articles. Each is built from the data its section
 * component reads (`allWork`, `featuredProjects`, `homeArticleGroups()`), with the section's own
 * title, so the markup lists exactly the entries a visitor sees, in the order they see them.
 * json-ld-lists.dom.test.tsx renders each real section and compares.
 *
 * Text is passed through as the page shows it. The test fails if a title or summary ever carries
 * markdown or HTML, because the page would then show that syntax and the JSON-LD would repeat it.
 *
 * How an entry here relates to the same thing on its own page:
 *  - Projects: the same arguments /projects/[slug] gives `SoftwareSourceCodeJsonLd` (name, tagline as
 *    description, URL, repository, tech, creation date, license), through the same builder, so the
 *    two describe a project identically. A private repository has no `codeRepository` in either.
 *  - Work: the list says the owner is a `contributor` and /work/[slug] (`CreativeWorkJsonLd`) says
 *    `author`. They differ on purpose. Every case study's register reads "Co-built", so
 *    `contributor` is the accurate relation, and the list is the only place it is stated. The page
 *    is not changed here because that would change its output; changing it is a one-word edit.
 * json-ld-parity.dom.test.tsx renders the real /projects/[slug] and /work/[slug] pages and compares
 * them with these entities: equal for every project, equal on type, name, description and address
 * for every case study, and the author/contributor difference pinned as a deliberate one.
 *  - Articles: BlogPosting is emitted for the homepage list only (an external article's own
 *    /articles page redirects away before it could render one). Its URL is the card's link
 *    without tracking parameters, see `articleUrl`.
 */

type Entity = Record<string, unknown>;

interface ListEntry {
  name: string;
  url: string;
  item: Entity;
}

interface ListItemLd extends ListEntry {
  "@type": "ListItem";
  position: number;
}

export interface ItemListLd {
  "@type": "ItemList";
  "@id": string;
  name: string;
  numberOfItems: number;
  itemListElement: ListItemLd[];
}

const absolute = (path: string) => `${SITE_URL}${path}`;

function itemList(
  slug: string,
  name: string,
  entries: readonly ListEntry[],
): ItemListLd {
  return {
    "@type": "ItemList",
    // The list's own address on the page that shows it. No visible anchor is required for an @id.
    "@id": absolute(`/#${slug}`),
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      url: entry.url,
      item: entry.item,
    })),
  };
}

/** FeaturedWork: "Flagship systems I helped build". The work is co-built, so the owner is a
 *  `contributor`, which is also what the section title claims. */
export function featuredWorkItemList(work: readonly Work[]): ItemListLd {
  return itemList(
    "production-work",
    "Flagship systems I helped build",
    work.map((w) => {
      const url = absolute(w.url);
      return {
        name: w.name,
        url,
        item: {
          "@type": "CreativeWork",
          name: w.name,
          description: w.summary,
          url,
          contributor: authorPerson(),
        },
      };
    }),
  );
}

/** FeaturedProjects: "Things I build in the open". `repoLink` returns null for a private
 *  repository, so a private project is listed without a `codeRepository` and its URL is never emitted. */
export function featuredProjectsItemList(
  projects: readonly Project[],
): ItemListLd {
  return itemList(
    "open-source-projects",
    "Things I build in the open",
    projects.map((p) => {
      const url = absolute(p.url);
      return {
        name: p.name,
        url,
        item: softwareSourceCodeEntity({
          name: p.name,
          description: p.tagline,
          url,
          codeRepository: repoLink(p) ?? undefined,
          tech: p.tech,
          dateCreated: p.dateCreated,
          license: p.license,
        }),
      };
    }),
  );
}

/**
 * The identity of an article in structured data: where its card sends a visitor (the shared rule in
 * article-href.ts, as an absolute URL) without tracking parameters, so one article has one URL and
 * not one per share button. The card's visible link is left exactly as the author wrote it.
 * json-ld-lists.dom.test.tsx renders the real cards under both settings of NEXT_PUBLIC_NOTES_ENABLED.
 */
function articleUrl(group: ArticleGroup): string {
  const { href, external } = resolveCanonicalHref(group);
  return stripTrackingParams(external ? href : absolute(href));
}

/** WritingPreview: "Latest articles". */
export function latestArticlesItemList(
  groups: readonly ArticleGroup[],
): ItemListLd {
  return itemList(
    "latest-articles",
    "Latest articles",
    groups.map((group) => {
      const { canonical } = group;
      const url = articleUrl(group);
      return {
        name: canonical.title,
        url,
        item: {
          "@type": "BlogPosting",
          headline: canonical.title,
          description: canonical.summary,
          url,
          datePublished: canonical.date,
          author: authorPerson(),
        },
      };
    }),
  );
}

/** A list with no entries is not worth emitting (and a section with nothing in it renders nothing). */
function ListScript({ list }: { list: ItemListLd }) {
  return list.numberOfItems === 0 ? null : <JsonLdScript data={list} />;
}

export function FeaturedWorkJsonLd() {
  return <ListScript list={featuredWorkItemList(allWork)} />;
}

export function FeaturedProjectsJsonLd() {
  return <ListScript list={featuredProjectsItemList(featuredProjects)} />;
}

/** Rendered only while the homepage shows the section: `homeArticleGroups()` is empty when
 *  articles are disabled or there are none. */
export function LatestArticlesJsonLd() {
  return <ListScript list={latestArticlesItemList(homeArticleGroups())} />;
}
