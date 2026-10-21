/**
 * Compiled MDX bodies, kept OUT of src/lib/content.ts on purpose.
 *
 * SERVER-ONLY BY CONVENTION: imported solely by the four detail pages that render a body
 * (projects, work, notes, articles `[slug]/page.tsx`). Do not import it from a "use client" module
 * or from anything a client module imports. No `server-only` package is installed, so two checks
 * stand in for it:
 *  - src/lib/content-bodies.test.ts pins the exact importer set and rejects a client importer.
 *  - scripts/bundle-budget.mjs fails the build if compiled MDX shows up in any first-load chunk,
 *    which also catches a transitive leak through a helper.
 *
 * WHY THE SPLIT: `src/lib/content.ts` is imported by roughly a dozen client modules, and a bundler
 * cannot tree-shake a JSON module, so a body on the metadata collections shipped to every visitor on
 * every route (about 300 KB across the four collections, about 11 KB per project card). The Velite
 * collections read here hold only `{ slug, body }`; see velite.config.ts.
 */
import { articleBodies, noteBodies, projectBodies, workBodies } from "../../.velite";

type BodyRow = { readonly slug: string; readonly body: string };

const bodiesBySlug = (rows: readonly BodyRow[]): ReadonlyMap<string, string> =>
  new Map(rows.map((row) => [row.slug, row.body]));

const projectBodyBySlug = bodiesBySlug(projectBodies);
const workBodyBySlug = bodiesBySlug(workBodies);
const noteBodyBySlug = bodiesBySlug(noteBodies);
const articleBodyBySlug = bodiesBySlug(articleBodies);

/** Compiled MDX for a project, or undefined for an unknown slug. */
export const getProjectBody = (slug: string): string | undefined => projectBodyBySlug.get(slug);

/** Compiled MDX for a work case study, or undefined for an unknown slug. */
export const getWorkBody = (slug: string): string | undefined => workBodyBySlug.get(slug);

/** Compiled MDX for a note (drafts included), or undefined for an unknown slug. */
export const getNoteBody = (slug: string): string | undefined => noteBodyBySlug.get(slug);

/** Compiled MDX for an article, or undefined for an unknown slug. Link-only articles compile to "". */
export const getArticleBody = (slug: string): string | undefined => articleBodyBySlug.get(slug);
