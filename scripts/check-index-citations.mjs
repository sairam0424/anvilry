#!/usr/bin/env node
/**
 * Verify every `path:line` citation in docs/index/ still points at the line it was written
 * against.
 *
 * WHY THIS EXISTS
 * The index is ~7,500 lines of prose carrying ~700 source citations, and nothing enforced them.
 * That is the fair criticism of any index like this: it is write-only documentation that rots
 * silently, and a reader cannot tell a live citation from a dead one. Measured: a single 530-line
 * sibling change invalidated 33 of 699 citations (4.7%) — with no signal at all.
 *
 * So each citation's target line is fingerprinted at generation time into
 * docs/index/.citations.json. This script re-fingerprints and reports drift, which turns
 * "the index is quietly wrong" into a build failure naming the exact lines to fix.
 *
 *   node scripts/check-index-citations.mjs           # verify (exit 1 on drift)
 *   node scripts/check-index-citations.mjs --write   # re-fingerprint after reviewing drift
 *   node scripts/check-index-citations.mjs --json    # machine-readable report
 *
 * Fingerprint is of the TRIMMED line, so reindentation is tolerated but a content change is not.
 * A citation whose file or line no longer exists is always an error.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const INDEX_DIR = "docs/index";
const SNAPSHOT = join(INDEX_DIR, ".citations.json");

/**
 * Files the index is allowed to cite. Anything else is ignored (e.g. node_modules).
 *
 * ROOT-LEVEL FILES ARE INCLUDED, and that omission mattered: the first version of this list only
 * allowed directory-prefixed paths, so **613 citations into package.json, pnpm-lock.yaml,
 * CHANGELOG.md, CLAUDE.md and the config files were silently unchecked** — while the script printed
 * a green summary. That is exactly the blind spot it exists to prevent, and it is where the drift
 * actually concentrates: inserting `engines` into package.json shifted every script/dependency line
 * by +3, and the v3.5.0 CHANGELOG heading shifted every later line by ~+104. Neither was visible.
 */
const CITABLE_DIRS = /^(?:src|e2e|scripts|content|domains|signals|docs|\.github)\//;
const CITABLE_ROOT_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "CHANGELOG.md",
  "CLAUDE.md",
  "ARCHITECTURE.md",
  "DEPLOY.md",
  "README.md",
  "VOICE.md",
  "TELEMETRY.md",
  "SECURITY.md",
  "Makefile",
  "next.config.ts",
  "vitest.config.ts",
  "playwright.config.ts",
  "velite.config.ts",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "tsconfig.json",
  "vercel.json",
  ".env.example",
  ".gitignore",
  ".nvmrc",
]);
const CITABLE = {
  test: (p) => CITABLE_DIRS.test(p) || CITABLE_ROOT_FILES.has(p),
};

/**
 * Built from CITABLE_ROOT_FILES so the extraction pattern and the allowlist cannot drift apart —
 * they did, and the result was 613 silently-unchecked citations. The directory branch is listed
 * FIRST so `docs/README.md:29` matches as a path rather than partially as bare `README.md`, and the
 * root branch carries a lookbehind so `some/dir/package.json:5` cannot match as a root file.
 */
const ROOT_ALT = [...CITABLE_ROOT_FILES]
  .map((f) => f.replace(/[.]/g, "\\."))
  .sort((a, b) => b.length - a.length) // longest-first so e.g. .env.example wins over .env
  .join("|");

const CITATION_RE = new RegExp(
  "`?(" +
    "(?:src|e2e|scripts|content|domains|signals|docs|\\.github)\\/[A-Za-z0-9_\\[\\]/.\\-]+" +
    "\\.(?:ts|tsx|mjs|js|md|mdx|yml|yaml|css)" +
    "|(?<![\\/\\w.\\-])(?:" + ROOT_ALT + ")" +
    ")`?\\s*:\\s*(\\d+)(?:-(\\d+))?",
  "g",
);

/**
 * A PARTIAL path + line, e.g. `hero-graph/index.tsx:34` — a path fragment that is not rooted at a
 * citable directory. Resolvable when exactly one file in the tree ends with that fragment.
 *
 * This form was invisible to both other patterns, and it hid a real failure: a 1-line comment edit
 * to `src/components/hero-graph/index.tsx` shifted 27 citations across 5 index files, and the
 * checker reported only **1 of 27** — the single one written as a full path. Everything written
 * `hero-graph/index.tsx:34` or `index.tsx:34` sailed through a green run.
 */
const PARTIAL_PATH_RE =
  /(?<![/A-Za-z0-9_.\-])((?:[A-Za-z0-9_\-[\]]+\/)+[A-Za-z0-9_\-[\]]+\.(?:ts|tsx|mjs|js|yml|yaml|css))\s*:\s*(\d+)(?:-(\d+))?/g;

/** A bare filename + line, e.g. `scene.tsx:44`. Resolvable only if the basename is unique. */
const BASENAME_RE =
  /(?<![/A-Za-z0-9_.\-])([A-Za-z0-9_\-[\]]+\.(?:ts|tsx|mjs|js|yml|yaml|css))\s*:\s*(\d+)(?:-(\d+))?/g;

/** A context-relative citation, e.g. `(:44)` — means "line 44 of the file this section is about". */
const CONTEXTUAL_RE = /\(`?:\d+(?:-\d+)?`?\)|`:\d+(?:-\d+)?`/g;

/**
 * COVERAGE IS PARTIAL, AND THAT IS REPORTED — not implied away.
 *
 * The index uses three citation forms. Only the first is machine-resolvable without understanding
 * the prose, and an earlier version of this script checked only that one while its own docs claimed
 * "staleness is enforced". Measured: 1,137 qualified vs 952 bare-filename vs 2,095 contextual —
 * so the honest coverage was ~27% of detectable citations, presented as total. The summary now
 * always prints the unverified counts so the limit is visible at a glance.
 */
function buildBasenameIndex() {
  const map = new Map();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs|js|yml|yaml|css)$/.test(e.name)) {
        if (map.has(e.name)) map.set(e.name, null); // ambiguous basename — unresolvable
        else map.set(e.name, p);
      }
    }
  };
  for (const root of ["src", "scripts", "e2e", ".github"]) if (existsSync(root)) walk(root);
  return map;
}

/** Every file path in the tree, for resolving PARTIAL paths by unique suffix match. */
function buildPathList() {
  const all = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else all.push(p);
    }
  };
  for (const root of ["src", "scripts", "e2e", "content", "domains", "signals"]) {
    if (existsSync(root)) walk(root);
  }
  return all;
}

/** Resolve a partial path like `hero-graph/index.tsx` iff exactly one tree path ends with it. */
function resolvePartial(fragment, allPaths) {
  const hits = allPaths.filter((p) => p === fragment || p.endsWith("/" + fragment));
  return hits.length === 1 ? hits[0] : null;
}

const fingerprint = (text) => createHash("sha256").update(text.trim()).digest("hex").slice(0, 12);

/** Counts of citations this script cannot verify, so the coverage limit is always visible. */
const unverified = { bareFilenameAmbiguous: 0, contextual: 0 };

function collectCitations() {
  const out = new Map();
  const basenames = buildBasenameIndex();
  const allPaths = buildPathList();
  for (const file of readdirSync(INDEX_DIR).filter((f) => f.endsWith(".md")).sort()) {
    const body = readFileSync(join(INDEX_DIR, file), "utf8");
    const add = (path, lineStr) => {
      const key = `${path}:${lineStr}`;
      if (!out.has(key)) out.set(key, { path, line: Number(lineStr), citedBy: new Set() });
      out.get(key).citedBy.add(file);
    };

    // 1. Fully-qualified — always resolvable.
    let remainder = body;
    for (const m of body.matchAll(CITATION_RE)) {
      if (!CITABLE.test(m[1])) continue;
      add(m[1], m[2]);
      if (m[3]) add(m[1], m[3]); // ranges: verify the ENDPOINT too, not just the start
      remainder = remainder.replace(m[0], "");
    }

    // 2. Partial path — resolvable when exactly one tree path ends with the fragment.
    for (const m of [...remainder.matchAll(PARTIAL_PATH_RE)]) {
      const resolved = resolvePartial(m[1], allPaths);
      if (!resolved) { unverified.bareFilenameAmbiguous++; continue; }
      add(resolved, m[2]);
      if (m[3]) add(resolved, m[3]);
      remainder = remainder.replace(m[0], "");
    }

    // 3. Bare filename — resolvable when the basename is unique in the tree.
    for (const m of remainder.matchAll(BASENAME_RE)) {
      const resolved = basenames.get(m[1]);
      if (!resolved) { unverified.bareFilenameAmbiguous++; continue; }
      add(resolved, m[2]);
      if (m[3]) add(resolved, m[3]);
    }

    // 3. Context-relative (`(:44)`) — needs the prose's current-file context. Counted, not checked.
    unverified.contextual += (body.match(CONTEXTUAL_RE) ?? []).length;
  }
  return out;
}

const fileCache = new Map();
function lineOf(path, line) {
  if (!fileCache.has(path)) {
    fileCache.set(path, existsSync(path) ? readFileSync(path, "utf8").split("\n") : null);
  }
  const lines = fileCache.get(path);
  if (lines === null) return { error: "file not found" };
  if (line < 1 || line > lines.length) {
    return { error: `line ${line} out of range (file has ${lines.length})` };
  }
  return { text: lines[line - 1] };
}

const citations = collectCitations();
const write = process.argv.includes("--write");
const asJson = process.argv.includes("--json");
const prior = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, "utf8")) : { citations: {} };

const next = {};
const drifted = [];
const errored = [];
/**
 * Citations landing on a blank line. Detectable without a baseline, and almost always wrong — a
 * citation exists to point at something. Fingerprint-drift cannot catch these on a NEW citation,
 * because there is nothing to compare against; a blank target is wrong on its own terms.
 * Real examples this caught: `pnpm-lock.yaml:920` (between two package keys) and `CLAUDE.md:298`.
 */
const blank = [];
let unchanged = 0;

for (const [key, c] of [...citations].sort(([a], [b]) => a.localeCompare(b))) {
  const resolved = lineOf(c.path, c.line);
  const citedBy = [...c.citedBy].sort();
  if (resolved.error) {
    errored.push({ key, citedBy, reason: resolved.error });
    continue;
  }
  if (resolved.text.trim() === "") blank.push({ key, citedBy });
  const fp = fingerprint(resolved.text);
  next[key] = { fp, citedBy };
  const before = prior.citations?.[key];
  if (!before) continue; // new citation — nothing to compare
  if (before.fp !== fp) {
    drifted.push({ key, citedBy, was: before.preview ?? "(no preview recorded)", now: resolved.text.trim().slice(0, 100) });
  } else {
    unchanged++;
  }
}

// Keep a short preview alongside each fingerprint so drift reports are readable.
for (const key of Object.keys(next)) {
  const c = citations.get(key);
  const r = lineOf(c.path, c.line);
  if (!r.error) next[key].preview = r.text.trim().slice(0, 100);
}

if (write) {
  writeFileSync(SNAPSHOT, `${JSON.stringify({ generated: "manual", citations: next }, null, 2)}\n`);
  console.log(`Re-fingerprinted ${Object.keys(next).length} citations -> ${SNAPSHOT}`);
  if (blank.length) {
    console.error(
      `\n${blank.length} citation(s) point at a BLANK line and were fingerprinted anyway.\n` +
        "Re-fingerprinting CANNOT fix a blank target — the prose must be corrected:",
    );
    for (const b of blank) console.error(`  ${b.key}  (cited by ${b.citedBy.join(", ")})`);
  }
  if (errored.length) {
    console.error(`\n${errored.length} citation(s) could not be resolved and were NOT recorded:`);
    for (const e of errored) console.error(`  ${e.key} — ${e.reason}  (cited by ${e.citedBy.join(", ")})`);
    process.exit(1);
  }
  process.exit(blank.length ? 1 : 0);
}

const report = { total: citations.size, unchanged, drifted, errored, blank };
if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`index citations: ${citations.size} | verified: ${unchanged} | drifted: ${drifted.length} | unresolvable: ${errored.length} | blank targets: ${blank.length}`);
  console.log(
    `NOT CHECKED by this script: ${unverified.contextual} context-relative citations like \`(:44)\`` +
      `${unverified.bareFilenameAmbiguous ? ` and ${unverified.bareFilenameAmbiguous} ambiguous bare filenames` : ""}` +
      " — they need the prose's current-file context to resolve. Treat a green run as evidence about" +
      " the checkable citations only, not the whole index.",
  );
  for (const e of errored) {
    console.error(`\nUNRESOLVABLE  ${e.key}\n  ${e.reason}\n  cited by: ${e.citedBy.join(", ")}`);
  }
  for (const b of blank) {
    console.error(
      `\nBLANK TARGET  ${b.key}\n  the cited line is empty — a citation must point at something\n  cited by: ${b.citedBy.join(", ")}`,
    );
  }
  for (const d of drifted) {
    console.error(`\nDRIFTED  ${d.key}\n  was: ${d.was}\n  now: ${d.now}\n  cited by: ${d.citedBy.join(", ")}`);
  }
  if (drifted.length || errored.length) {
    console.error(
      `\n${drifted.length + errored.length} citation(s) no longer match. Update the prose in the ` +
        "listed index files, then re-fingerprint with:\n" +
        "  node scripts/check-index-citations.mjs --write",
    );
  }
}

process.exit(drifted.length || errored.length || blank.length ? 1 : 0);
