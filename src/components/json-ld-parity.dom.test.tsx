import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/lib/content";
import { scriptBodies } from "./json-ld-lists-support";

/**
 * The homepage lists and the detail pages describe the same projects and case studies, and the page
 * and the list each map a record to the builder's inputs at their own call site. These tests render
 * the REAL /projects/[slug] and /work/[slug] pages and compare what they emit with the homepage list
 * entity for the same record, so neither side can change its arguments (drop the license, send the
 * repo of a private project, ...) without a test saying so.
 *
 * Only what the pages need from outside is replaced: the GitHub fetch, the MDX compiler, the page
 * bodies and the cache directive's runtime. Flags are pinned in every test, never inherited.
 */

const PERSON = {
  "@type": "Person",
  name: "Sairam Ugge",
  url: "https://anvilry.vercel.app",
};

type Ld = Record<string, unknown>;

async function load(notes: "true" | "false", project?: Project) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_NOTES_ENABLED", notes);
  vi.stubEnv("NEXT_PUBLIC_ARTICLES_ENABLED", "true");
  vi.doMock("next/cache", () => ({ cacheLife: () => undefined }));
  vi.doMock("@/lib/github", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/github")>()),
    fetchRepo: async () => null,
  }));
  vi.doMock("@/lib/content-bodies", () => ({
    getProjectBody: () => "",
    getWorkBody: () => "",
  }));
  vi.doMock("@/components/mdx-content", () => ({ MDXContent: () => null }));
  if (project) {
    vi.doMock("@/lib/content", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/content")>()),
      getProject: (slug: string) =>
        slug === project.slug ? project : undefined,
    }));
  }
  const [content, lists, projectPage, workPage] = await Promise.all([
    import("@/lib/content"),
    import("./json-ld-lists"),
    import("@/app/projects/[slug]/page"),
    import("@/app/work/[slug]/page"),
  ]);
  return {
    content,
    lists,
    ProjectPage: projectPage.default,
    WorkPage: workPage.default,
  };
}

/** The JSON-LD block of the given type a page emitted, without its @context. */
function blockOf(html: string, type: string): Ld {
  const blocks = scriptBodies(html).map((body) => JSON.parse(body) as Ld);
  const found = blocks.filter((b) => b["@type"] === type);
  expect(found, `${type} blocks on the page`).toHaveLength(1);
  const { "@context": context, ...rest } = found[0];
  expect(context).toBe("https://schema.org");
  return rest;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("next/cache");
  vi.doUnmock("@/lib/github");
  vi.doUnmock("@/lib/content");
  vi.doUnmock("@/lib/content-bodies");
  vi.doUnmock("@/components/mdx-content");
});

describe.each(["true", "false"] as const)(
  "page and homepage list agree with NEXT_PUBLIC_NOTES_ENABLED=%s",
  (notes) => {
    describe("projects", () => {
      it("emit the same SoftwareSourceCode on /projects/[slug] and in the homepage list, for every project", async () => {
        const { content, lists, ProjectPage } = await load(notes);
        expect(content.allProjects.length).toBeGreaterThan(0);

        for (const project of content.allProjects) {
          const html = renderToStaticMarkup(
            await ProjectPage({
              params: Promise.resolve({ slug: project.slug }),
            }),
          );
          const onPage = blockOf(html, "SoftwareSourceCode");
          const [listed] = lists.featuredProjectsItemList([
            project,
          ]).itemListElement;

          expect(onPage, project.slug).toEqual(listed.item);
        }
      });

      it("carries the creation date and license on the page, so the comparison above has something to compare", async () => {
        const { content, ProjectPage } = await load(notes);
        const dated = content.allProjects.filter(
          (p) => p.dateCreated && p.license,
        );
        expect(dated.length).toBeGreaterThan(0);

        const html = renderToStaticMarkup(
          await ProjectPage({
            params: Promise.resolve({ slug: dated[0].slug }),
          }),
        );
        const onPage = blockOf(html, "SoftwareSourceCode");
        expect(onPage.dateCreated).toBe(dated[0].dateCreated);
        expect(onPage.license).toBe(
          `https://spdx.org/licenses/${dated[0].license}.html`,
        );
      });

      it("leaves the repository out of the page's JSON-LD for a private project, and out of the list's", async () => {
        const privateRepo = "https://github.com/someone/private-repo";
        const base = (await load(notes)).content.featuredProjects[0];
        const hidden: Project = {
          ...base,
          slug: "hidden-one",
          url: "/projects/hidden-one",
          name: "Hidden one",
          visibility: "private",
          repo: privateRepo,
        };

        const { lists, ProjectPage } = await load(notes, hidden);
        const html = renderToStaticMarkup(
          await ProjectPage({ params: Promise.resolve({ slug: hidden.slug }) }),
        );
        const onPage = blockOf(html, "SoftwareSourceCode");
        const [listed] = lists.featuredProjectsItemList([
          hidden,
        ]).itemListElement;

        expect("codeRepository" in onPage).toBe(false);
        expect(onPage).toEqual(listed.item);
        expect(scriptBodies(html).join("")).not.toContain(privateRepo);
      });
    });

    describe("work", () => {
      it("agree on what the work is: type, name, description and address, for every case study", async () => {
        const { content, lists, WorkPage } = await load(notes);
        expect(content.allWork.length).toBeGreaterThan(0);

        for (const work of content.allWork) {
          const html = renderToStaticMarkup(
            await WorkPage({ params: Promise.resolve({ slug: work.slug }) }),
          );
          const onPage = blockOf(html, "CreativeWork");
          const [listed] = lists.featuredWorkItemList([work]).itemListElement;

          for (const key of ["@type", "name", "description", "url"]) {
            expect(onPage[key], `${work.slug}.${key}`).toEqual(
              listed.item[key],
            );
          }
        }
      });

      it("differ in one deliberate way: the page names the owner as author, the list as contributor", async () => {
        // Every case study's register reads "Co-built", so `contributor` is the accurate relation and
        // the list states it. The page still says `author`. Changing either side is a decision about
        // what the site claims: change this test and the docblock in json-ld-lists.tsx with it.
        const { content, lists, WorkPage } = await load(notes);

        for (const work of content.allWork) {
          const html = renderToStaticMarkup(
            await WorkPage({ params: Promise.resolve({ slug: work.slug }) }),
          );
          const onPage = blockOf(html, "CreativeWork");
          const [listed] = lists.featuredWorkItemList([work]).itemListElement;

          expect(onPage.author, work.slug).toEqual(PERSON);
          expect("contributor" in onPage, work.slug).toBe(false);
          expect(listed.item.contributor, work.slug).toEqual(PERSON);
          expect("author" in listed.item, work.slug).toBe(false);
          expect(work.register, work.slug).toMatch(/^Co-built/);
        }
      });
    });
  },
);
