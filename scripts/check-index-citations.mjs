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

/** Source files the index is allowed to cite. Anything else is ignored (e.g. node_modules). */
const CITABLE = /^(?:src|e2e|scripts|content|domains|signals|\.github)\//;

const CITATION_RE =
  /`?((?:src|e2e|scripts|content|domains|signals|\.github)\/[A-Za-z0-9_[\]/.\-]+\.(?:ts|tsx|mjs|js|md|mdx|yml|yaml|css))`?\s*:\s*(\d+)/g;

const fingerprint = (text) => createHash("sha256").update(text.trim()).digest("hex").slice(0, 12);

function collectCitations() {
  const out = new Map();
  for (const file of readdirSync(INDEX_DIR).filter((f) => f.endsWith(".md")).sort()) {
    const body = readFileSync(join(INDEX_DIR, file), "utf8");
    for (const m of body.matchAll(CITATION_RE)) {
      const [, path, lineStr] = m;
      if (!CITABLE.test(path)) continue;
      const key = `${path}:${lineStr}`;
      if (!out.has(key)) out.set(key, { path, line: Number(lineStr), citedBy: new Set() });
      out.get(key).citedBy.add(file);
    }
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
let unchanged = 0;

for (const [key, c] of [...citations].sort(([a], [b]) => a.localeCompare(b))) {
  const resolved = lineOf(c.path, c.line);
  const citedBy = [...c.citedBy].sort();
  if (resolved.error) {
    errored.push({ key, citedBy, reason: resolved.error });
    continue;
  }
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
  if (errored.length) {
    console.error(`\n${errored.length} citation(s) could not be resolved and were NOT recorded:`);
    for (const e of errored) console.error(`  ${e.key} — ${e.reason}  (cited by ${e.citedBy.join(", ")})`);
    process.exit(1);
  }
  process.exit(0);
}

const report = { total: citations.size, unchanged, drifted, errored };
if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`index citations: ${citations.size} | verified: ${unchanged} | drifted: ${drifted.length} | unresolvable: ${errored.length}`);
  for (const e of errored) {
    console.error(`\nUNRESOLVABLE  ${e.key}\n  ${e.reason}\n  cited by: ${e.citedBy.join(", ")}`);
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

process.exit(drifted.length || errored.length ? 1 : 0);
