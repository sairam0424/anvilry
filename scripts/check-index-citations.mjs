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
 *   node scripts/check-index-citations.mjs            # verify (exit 1 on a STALE citation)
 *   node scripts/check-index-citations.mjs --strict   # also exit 1 on relocation warnings
 *   node scripts/check-index-citations.mjs --write    # re-fingerprint; refuses while anything is open
 *   node scripts/check-index-citations.mjs --write --accept-warnings   # after a verified re-point
 *   node scripts/check-index-citations.mjs --json     # machine-readable report
 *
 * Fingerprint is of the TRIMMED line, so reindentation is tolerated but a content change is not.
 * A citation whose file or line no longer exists is always an error.
 *
 * WHAT BLOCKS, AND WHY IT IS NOT "ANY DRIFT"
 * Fingerprint drift conflates two different events: the cited TEXT changed (a stale citation) and
 * the cited text MOVED (someone inserted lines above it). Only the first is a documentation defect.
 * Measured over this gate's whole lifetime, ~96% of everything it flagged was the second, because
 * CHANGELOG.md, package.json and pnpm-lock.yaml grow at the TOP: one prepended release heading
 * drifts every CHANGELOG citation below it (68 of 69, plus 7 manufactured blank targets), and one
 * Dependabot bump drifts 18 of which exactly 1 carries information. So the gate failed on ~45% of
 * commits for reasons unrelated to documentation accuracy, and each round of repair introduced its
 * own errors (double-shifts, inverted ranges like `CLAUDE.md:258-251`).
 *
 * The discriminator is the recorded preview text, which the snapshot already stores. On drift, ask
 * where that text lives NOW:
 *   nowhere      -> ERROR   the citation is stale; the prose must be fixed
 *   exactly once -> warning it relocated; the printed offset says where to
 *   2+ places    -> the text is duplicated (287 of 2,153 citations are, worst case 110x), so
 *                   existence alone would be VACUOUS. It is a warning only if one of those
 *                   positions matches a line shift observed elsewhere in the same file; otherwise
 *                   it is an ERROR.
 * Everything is still checked and still printed. Only the exit code distinguishes them, and
 * `--strict` restores the old all-or-nothing behaviour for local sweeps.
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
/**
 * Escapes every regex metacharacter — backslash first — so a literal string can be embedded
 * safely inside a RegExp source. The prior version only escaped `.` via
 * `f.replace(/[.]/g, "\\.")`, which is an incomplete sanitizer (CodeQL js/incomplete-sanitization):
 * it never escapes `\` itself, so any entry containing a backslash, or any of `*+?^${}()|[]`,
 * would flow into CITATION_RE unescaped and change what the alternation matches instead of being
 * treated as a literal filename.
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ROOT_ALT = [...CITABLE_ROOT_FILES]
  .map((f) => escapeRegExp(f))
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

/**
 * Every `a-b` range, kept as a PAIR so `a <= b` can be asserted. The two endpoints are also added
 * as independent citations, and that is how 9 inverted ranges (`CLAUDE.md:258-251`) survived a
 * mechanical shift pass: both endpoints resolved, nothing compared their order, and detection rode
 * entirely on whether the bad endpoint happened to be a blank line. Order is motion-immune — no
 * insertion can reverse it — so this is checked in the blocking tier.
 */
const ranges = [];

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
    const addRange = (path, a, b) => ranges.push({ path, start: Number(a), end: Number(b), file });

    // 1. Fully-qualified — always resolvable.
    let remainder = body;
    for (const m of body.matchAll(CITATION_RE)) {
      if (!CITABLE.test(m[1])) continue;
      add(m[1], m[2]);
      if (m[3]) { add(m[1], m[3]); addRange(m[1], m[2], m[3]); } // endpoint too, and assert a <= b
      remainder = remainder.replace(m[0], "");
    }

    // 2. Partial path — resolvable when exactly one tree path ends with the fragment.
    for (const m of [...remainder.matchAll(PARTIAL_PATH_RE)]) {
      const resolved = resolvePartial(m[1], allPaths);
      if (!resolved) { unverified.bareFilenameAmbiguous++; continue; }
      add(resolved, m[2]);
      if (m[3]) { add(resolved, m[3]); addRange(resolved, m[2], m[3]); }
      remainder = remainder.replace(m[0], "");
    }

    // 3. Bare filename — resolvable when the basename is unique in the tree.
    for (const m of remainder.matchAll(BASENAME_RE)) {
      const resolved = basenames.get(m[1]);
      if (!resolved) { unverified.bareFilenameAmbiguous++; continue; }
      add(resolved, m[2]);
      if (m[3]) { add(resolved, m[3]); addRange(resolved, m[2], m[3]); }
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

/**
 * Where does the RECORDED text of a citation live in the file NOW?
 * Returns [] when it is gone, [n] when it relocated to exactly line n, [n, m, ...] when the text is
 * duplicated and cannot be adjudicated, or null when there is no recorded text to look for (an old
 * snapshot entry) — which fails closed, into the blocking tier.
 *
 * Previews are the TRIMMED line truncated to 100 chars (85 of the 2,153 current entries are at the
 * cap), so a capped preview is matched as a prefix. Two lines sharing a 100-char prefix would be
 * treated as the same text; none do today.
 */
function findRecorded(path, preview) {
  const lines = fileCache.get(path);
  if (!lines || preview === undefined || preview === "") return null;
  const capped = preview.length === 100;
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (capped ? t.startsWith(preview) : t === preview) hits.push(i + 1);
  }
  return hits;
}

const citations = collectCitations();
const write = process.argv.includes("--write");
const asJson = process.argv.includes("--json");
const strict = process.argv.includes("--strict");
const acceptWarnings = process.argv.includes("--accept-warnings");
const prior = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, "utf8")) : { citations: {} };

const next = {};
const errored = []; // ERROR: file gone, or line past EOF. A prepend GROWS a file, so this is immune.
const inverted = []; // ERROR: range end < start. Positional ORDER, which no insertion can reverse.
/**
 * ERROR: citations landing on a blank line, restricted to the two cases line motion cannot
 * manufacture — a citation with no baseline at all, and one that was blank in the baseline too.
 * Detectable without a baseline, and wrong on its own terms: a citation exists to point at
 * something. Real examples this caught: `pnpm-lock.yaml:920` and `CLAUDE.md:298`.
 *
 * A blank target whose recorded text merely MOVED is not listed here, because it is an artifact of
 * the insertion: the pristine tree reports 0 blank targets, and every blank observed under a
 * simulated release or Dependabot bump was manufactured by the shift.
 */
const blank = [];
const gone = []; // ERROR: the recorded text is nowhere in the file, or nowhere consistent with it.
const moved = []; // warn: recorded text found at exactly one other line — pure relocation.
const ambiguous = []; // warn: recorded text duplicated, but present at a consistent offset.
const ambiguousRaw = []; // staged: adjudicated below against the file's own observed line motion.
const noBaseline = []; // info: no snapshot entry, so nothing to compare. Silently skipped before.
let unchanged = 0;

for (const [key, c] of [...citations].sort(([a], [b]) => a.localeCompare(b))) {
  const resolved = lineOf(c.path, c.line);
  const citedBy = [...c.citedBy].sort();
  if (resolved.error) {
    errored.push({ key, citedBy, reason: resolved.error });
    continue;
  }
  const isBlank = resolved.text.trim() === "";
  const fp = fingerprint(resolved.text);
  next[key] = { fp, citedBy };
  const before = prior.citations?.[key];
  if (!before) {
    noBaseline.push(key);
    if (isBlank) blank.push({ key, citedBy, why: "no baseline, and the cited line is empty" });
    continue;
  }
  if (before.fp === fp) {
    if (isBlank) blank.push({ key, citedBy, why: "the cited line is empty, and was empty in the baseline too" });
    else unchanged++;
    continue;
  }
  const rec = {
    key,
    citedBy,
    was: before.preview ?? "(no preview recorded)",
    now: resolved.text.trim().slice(0, 100),
  };
  const hits = findRecorded(c.path, before.preview);
  if (hits === null || hits.length === 0) {
    gone.push({ ...rec, reason: "that text is nowhere in the file" });
  } else if (hits.length === 1) {
    moved.push({ ...rec, to: hits[0], offset: hits[0] - c.line });
  } else {
    ambiguousRaw.push({ ...rec, at: hits, line: c.line, path: c.path });
  }
}

/**
 * Adjudicate duplicated recorded text against the file's OWN observed motion, so "the text exists
 * somewhere" is never the assertion — 287 of the 2,153 current citations have text that repeats in
 * their file, worst case `peerDependencies:` 110 times, and mere existence would be vacuous for
 * them. An insertion or deletion shifts a contiguous run of lines by one offset, so the offsets
 * derived from the unambiguously-relocated citations in the same file are the only ones a duplicated
 * citation is allowed to claim. No such offset -> the file shows no line motion -> a duplicated
 * citation whose line changed content is STALE and blocks.
 */
{
  const offsetsByFile = {};
  for (const m of moved) {
    const p = m.key.slice(0, m.key.lastIndexOf(":"));
    (offsetsByFile[p] ??= new Set()).add(m.offset);
  }
  for (const a of ambiguousRaw) {
    const offs = offsetsByFile[a.path];
    const at = offs && a.at.find((h) => offs.has(h - a.line));
    if (at) ambiguous.push({ ...a, to: at, offset: at - a.line });
    else {
      gone.push({
        ...a,
        reason: `that text is duplicated (at ${a.at.slice(0, 8).join(", ")}${a.at.length > 8 ? ", …" : ""}) and none of those positions matches any line shift observed elsewhere in this file`,
      });
    }
  }
}

for (const r of ranges) {
  if (r.end < r.start) inverted.push({ key: `${r.path}:${r.start}-${r.end}`, citedBy: [r.file] });
}

/**
 * warn: a citation that USED to exist, whose recorded text is still in the file at exactly one line,
 * and nothing cites that line any more. That is the signature of a bad hand-shift — the prose was
 * re-pointed somewhere else while the thing it described stayed put. It is the only check here that
 * can see a PROSE-side error; it is a warning because legitimately dropping a citation looks the
 * same. It does not fire when the shift was done correctly.
 */
const repointed = [];
{
  const citedLines = new Set([...citations.keys()]);
  for (const [key, before] of Object.entries(prior.citations ?? {})) {
    if (citations.has(key)) continue;
    const i = key.lastIndexOf(":");
    const path = key.slice(0, i);
    if (!fileCache.has(path)) lineOf(path, 1); // prime the cache without asserting anything
    const hits = findRecorded(path, before.preview);
    if (hits?.length !== 1) continue;
    if (citedLines.has(`${path}:${hits[0]}`)) continue;
    repointed.push({ key, to: hits[0], was: before.preview, citedBy: before.citedBy ?? [] });
  }
}

// Keep a short preview alongside each fingerprint so drift reports are readable.
for (const key of Object.keys(next)) {
  const c = citations.get(key);
  const r = lineOf(c.path, c.line);
  if (!r.error) next[key].preview = r.text.trim().slice(0, 100);
}

const errors = errored.length + inverted.length + blank.length + gone.length;
const warns = moved.length + ambiguous.length + repointed.length;

if (write) {
  /**
   * --write TRUSTS THE PROSE, so it must not run while the prose is known to be wrong. An audit
   * found 82 citations broken by line shifts where --write would have recorded ~57 wrong pointers as
   * correct, turning the verification tool into the thing that hides the defect. The old code wrote
   * FIRST and complained afterwards, so that damage was already on disk. It now refuses, writing
   * nothing, whenever anything is outstanding — a relocated citation needs its line number
   * RE-POINTED in the prose, not its fingerprint replaced.
   */
  const outstanding = errors + (acceptWarnings ? 0 : warns);
  if (outstanding) {
    console.error(`REFUSING TO WRITE: ${errors} error(s) and ${warns} warning(s) outstanding. Nothing was written.`);
    for (const e of errored) console.error(`  UNRESOLVABLE  ${e.key} — ${e.reason}`);
    for (const i of inverted) console.error(`  INVERTED RANGE  ${i.key}`);
    for (const b of blank) console.error(`  BLANK TARGET  ${b.key} — ${b.why}`);
    for (const g of gone) console.error(`  CITED TEXT GONE  ${g.key}  was: ${g.was}`);
    for (const m of moved) console.error(`  MOVED  ${m.key} -> should be :${m.to} (offset ${m.offset >= 0 ? "+" : ""}${m.offset})`);
    for (const a of ambiguous) console.error(`  AMBIGUOUS  ${a.key} -> should be :${a.to} (offset ${a.offset >= 0 ? "+" : ""}${a.offset}, from duplicated text)`);
    for (const r of repointed) console.error(`  RE-POINTED  ${r.key} — its text is now at :${r.to}, which nothing cites`);
    console.error(
      "\nFix the prose first. Re-point moved citations to the line printed above (apply the whole\n" +
        "map in ONE pass — sequential passes double-shift), then re-run --write. Use\n" +
        "--accept-warnings only when you have confirmed every line number above by reading the file.",
    );
    process.exit(1);
  }
  writeFileSync(SNAPSHOT, `${JSON.stringify({ generated: "manual", citations: next }, null, 2)}\n`);
  console.log(`Re-fingerprinted ${Object.keys(next).length} citations -> ${SNAPSHOT}`);
  process.exit(0);
}

const report = {
  total: citations.size,
  unchanged,
  errors: { errored, inverted, blank, gone },
  warnings: { moved, ambiguous, repointed },
  noBaseline: noBaseline.length,
  // `drifted` is retained so existing --json consumers keep working: it is the union of the two.
  drifted: [...gone, ...moved, ...ambiguous],
  errored,
  blank,
};
if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `index citations: ${citations.size} | verified: ${unchanged} | ` +
      `ERRORS: ${errors} (stale ${gone.length}, unresolvable ${errored.length}, blank ${blank.length}, inverted range ${inverted.length}) | ` +
      `WARNINGS: ${warns} (moved ${moved.length}, ambiguous ${ambiguous.length}, re-pointed ${repointed.length}) | ` +
      `no baseline: ${noBaseline.length}`,
  );
  console.log(
    `NOT CHECKED by this script: ${unverified.contextual} context-relative citations like \`(:44)\`` +
      `${unverified.bareFilenameAmbiguous ? ` and ${unverified.bareFilenameAmbiguous} ambiguous bare filenames` : ""}` +
      " — they need the prose's current-file context to resolve. Treat a green run as evidence about" +
      " the checkable citations only, not the whole index. A green run asserts that the cited TEXT is" +
      " still in the cited FILE; line POSITIONS are reported (see WARNINGS) and not enforced.",
  );
  // WARNINGS FIRST, compact: one line each, so the whole old -> new map is usable as a repair list
  // and the ERRORS below stay the last thing on screen. Full records are in --json.
  const off = (n) => `${n >= 0 ? "+" : ""}${n}`;
  for (const m of moved) console.error(`warn  moved       ${m.key} -> :${m.to}  (${off(m.offset)})  ${m.was.slice(0, 60)}`);
  for (const a of ambiguous) console.error(`warn  ambiguous   ${a.key} -> :${a.to}  (${off(a.offset)}, text repeats ${a.at.length}x)  ${a.was.slice(0, 40)}`);
  for (const r of repointed) {
    console.error(
      `warn  re-pointed  ${r.key} — its recorded text is now at :${r.to}, which nothing cites` +
        `\n              was: ${r.was.slice(0, 80)}\n              was cited by: ${[...r.citedBy].join(", ")}`,
    );
  }
  if (moved.length || ambiguous.length) {
    const per = {};
    for (const m of [...moved, ...ambiguous]) {
      const p = m.key.slice(0, m.key.lastIndexOf(":"));
      per[p] ??= {};
      per[p][m.offset] = (per[p][m.offset] ?? 0) + 1;
    }
    console.error("\nDERIVED OFFSETS (count by offset, per file) — do NOT assume one offset per file:");
    for (const [p, h] of Object.entries(per)) console.error(`  ${p}: ${JSON.stringify(h)}`);
    console.error(
      "Apply the whole map above in ONE substitution pass. Sequential passes double-shift, and a\n" +
        "single assumed offset produces inverted ranges where the real shift is not uniform.",
    );
  }
  for (const e of errored) {
    console.error(`\nUNRESOLVABLE  ${e.key}\n  ${e.reason}\n  cited by: ${e.citedBy.join(", ")}`);
  }
  for (const i of inverted) {
    console.error(`\nINVERTED RANGE  ${i.key}\n  the range ends before it starts\n  cited by: ${i.citedBy.join(", ")}`);
  }
  for (const b of blank) {
    console.error(`\nBLANK TARGET  ${b.key}\n  ${b.why} — a citation must point at something\n  cited by: ${b.citedBy.join(", ")}`);
  }
  for (const g of gone) {
    console.error(`\nCITED TEXT GONE  ${g.key}\n  was: ${g.was}\n  now: ${g.now}\n  ${g.reason}\n  cited by: ${g.citedBy.join(", ")}`);
  }
  if (errors) {
    console.error(
      `\n${errors} citation(s) are STALE or structurally invalid. Fix the prose in the listed index ` +
        "files, then re-fingerprint with:\n  node scripts/check-index-citations.mjs --write",
    );
  }
}

process.exit(errors || (strict && warns) ? 1 : 0);
