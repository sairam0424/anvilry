/**
 * Builds the Pagefind search index from the prerendered HTML of a finished `next build`.
 *
 * Why this is a script and not a one-line `pagefind --site .next/server/app`: Next can write the
 * prerendered pages in two layouts.
 *   - classic:  .next/server/app/<path>.html
 *   - adapter:  .next/server/route-cache/APP_PAGE/<hash>/$/<path>.html
 * Vercel builds with Next >= 16.4 run with a deployment adapter, which produces the second layout.
 * The one-liner then found 0 files ("Found 0 files matching" the html glob) and failed the Vercel
 * build, while every local and CI build, which use the classic layout, passed. This script indexes
 * whichever layout exists, copies the adapter layout into a staging directory under the URL path
 * each page is served at (so search results link to real pages), and fails loudly when it finds no
 * page at all, instead of publishing an empty index.
 *
 * Usage: node scripts/build-search-index.mjs   (run from the repository root, after `next build`)
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SERVER_DIR = join(".next", "server");
export const STAGE_DIR = join(".next", "search-site");
export const OUTPUT_PATH = join("public", "pagefind");

/** All .html files under `dir`, as POSIX-style paths relative to it. A missing dir is empty. */
export function listHtml(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".html")) found.push(relative(dir, full).split(sep).join("/"));
    }
  };
  walk(dir);
  return found;
}

/**
 * Decides what Pagefind should index.
 * @param {string} serverDir  the `.next/server` directory
 * @param {string} stageDir   where the adapter layout is copied to
 * @returns {{ layout: "app" | "route-cache", dir: string, files: string[], duplicates: string[] }}
 */
export function resolveSearchSource(serverDir, stageDir) {
  const appDir = join(serverDir, "app");
  const classic = listHtml(appDir);
  if (classic.length > 0) return { layout: "app", dir: appDir, files: classic, duplicates: [] };

  const cacheRoot = join(serverDir, "route-cache", "APP_PAGE");
  rmSync(stageDir, { recursive: true, force: true });
  const files = [];
  const duplicates = [];
  if (existsSync(cacheRoot)) {
    for (const hash of readdirSync(cacheRoot).sort()) {
      const pagesDir = join(cacheRoot, hash, "$");
      for (const rel of listHtml(pagesDir)) {
        if (files.includes(rel)) {
          duplicates.push(rel);
          continue;
        }
        const target = join(stageDir, rel);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(join(pagesDir, rel), target);
        files.push(rel);
      }
    }
  }
  if (files.length === 0) {
    throw new Error(
      `no prerendered HTML found under ${appDir} or ${cacheRoot}: did \`next build\` run first, and did it prerender any page?`,
    );
  }
  return { layout: "route-cache", dir: stageDir, files, duplicates };
}

function main() {
  const source = resolveSearchSource(SERVER_DIR, STAGE_DIR);
  console.log(`[search-index] ${source.files.length} pages from the "${source.layout}" layout (${source.dir})`);
  if (source.duplicates.length > 0) {
    console.warn(`[search-index] ${source.duplicates.length} URL path(s) came from more than one source; kept the first`);
  }
  const local = join("node_modules", ".bin", "pagefind");
  const result = spawnSync(existsSync(local) ? local : "pagefind", ["--site", source.dir, "--output-path", OUTPUT_PATH], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Entry guard by real path: behind a symlink a naive import.meta.url comparison silently does nothing.
const entry = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (import.meta.url === pathToFileURL(entry).href || fileURLToPath(import.meta.url) === entry) main();
