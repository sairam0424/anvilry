#!/usr/bin/env node
/**
 * Bundle budget gate — reads the artifact the SHIPPING bundler already emits.
 *
 * WHY THIS REPLACED .github/workflows/bundle-analysis.yml
 * That workflow was green and empty for all 222 of its runs and produced ZERO artifacts, ever. Three
 * independent reasons, each sufficient:
 *   1. `next build` is Turbopack in Next 16 (node_modules/next/dist/lib/bundler.js:142-144 sets
 *      TURBOPACK='auto' "when nothing is configured"), and @next/bundle-analyzer is webpack-only —
 *      it prints "not compatible with Turbopack builds, no report will be generated" and returns a
 *      config whose `.webpack` is undefined. The workflow's own comment claimed the opposite.
 *   2. `nextjs-bundle-analysis` (last published 2023) reads the Pages-Router
 *      `build-manifest.json.pages`, which is `{"/_app": []}` in this App Router app, so even fully
 *      wired it reports `{"raw":0,"gzip":0}` — it would post "no changes to the JavaScript bundle"
 *      on every PR forever, which is worse than silence because it manufactures false safety.
 *   3. `if-no-files-found: warn` plus `continue-on-error: true` made every failure invisible.
 *
 * WHY THIS FILE IS DIFFERENT
 * `.next/diagnostics/route-bundle-stats.json` is written by `next build` with NO flag and NO second
 * build — but ONLY under Turbopack (next/dist/build/index.js gates writeRouteBundleStats on
 * `bundler === Bundler.Turbopack`). So it measures exactly what ships. Measured on this tree:
 * 16 routes; `firstLoadUncompressedJsBytes` for "/" is 1220794, and the on-disk sum of that route's
 * `firstLoadChunkPaths` is 1220794 — identical, so the number is not a modelled estimate.
 *
 * A MISSING OR MALFORMED MEASUREMENT EXITS 1. That is the entire point: the predecessor's defining
 * flaw was reporting success while measuring nothing, so "I could not measure" must be RED.
 *
 *   node scripts/bundle-budget.mjs        # after `next build` / `pnpm build`
 */
import { existsSync, readFileSync, statSync } from "node:fs";

const STATS = ".next/diagnostics/route-bundle-stats.json";

/** 16 routes today. Fewer means Next changed the artifact's shape and this gate is lying. */
const MIN_ROUTES = 16;

/**
 * Ceiling, not a baseline. Largest today is `/` at 1,220,794 B, so this is ~5% headroom — enough to
 * absorb chunk-boundary jitter and any cross-OS variance (this is measured on macOS locally and
 * ubuntu-latest in CI, and byte-exact determinism between them is NOT verified).
 *
 * Raising it is allowed and expected. Do it in its OWN commit, quoting measured before/after bytes,
 * the same discipline next.config.ts:127-149 already uses for the three.js chunk.
 */
const MAX_FIRST_LOAD_BYTES = 1_285_000;

/**
 * three.js must stay OFF the critical path. next.config.ts:127-149 documents that it occupies
 * exactly ONE chunk — verified here at 897,249 B (876.2 KiB), and present in 0 of the 16 routes'
 * first-load sets, i.e. genuinely lazy today.
 *
 * This is the assertion a total-bytes guard CANNOT make. An eager `import * as THREE` in a shell
 * component moves ~876 KB onto every route's critical path while total emitted bytes barely change —
 * the bytes were always shipped, they just stopped being deferred. Marker-based rather than
 * size-based so it names the actual cause in the failure message.
 */
const LAZY_MARKER = "WebGLRenderer";

function fail(...lines) {
  for (const l of lines) console.error(l);
  process.exit(1);
}

let stats;
try {
  stats = JSON.parse(readFileSync(STATS, "utf8"));
} catch (err) {
  fail(
    `FAIL: cannot read ${STATS} (${err.code ?? err.message}).`,
    "Either `next build` did not run, or it ran with --webpack, which never emits this file.",
    "This is a hard failure by design: an unmeasured bundle must not report success.",
  );
}

if (!Array.isArray(stats) || stats.length < MIN_ROUTES) {
  fail(
    `FAIL: ${STATS} has ${Array.isArray(stats) ? stats.length : "no"} route records, expected >= ${MIN_ROUTES}.`,
    "Next's diagnostics format likely changed. Fix this script rather than lowering MIN_ROUTES.",
  );
}
if (!("firstLoadUncompressedJsBytes" in stats[0]) || !Array.isArray(stats[0].firstLoadChunkPaths)) {
  fail(
    `FAIL: ${STATS} records lack firstLoadUncompressedJsBytes / firstLoadChunkPaths.`,
    `Got keys: ${Object.keys(stats[0]).join(", ")}`,
  );
}

const byRoute = [...stats].sort(
  (a, b) => b.firstLoadUncompressedJsBytes - a.firstLoadUncompressedJsBytes,
);

console.log(`first-load JS (uncompressed), ${stats.length} routes, budget ${MAX_FIRST_LOAD_BYTES}:`);
for (const r of byRoute) {
  const over = r.firstLoadUncompressedJsBytes > MAX_FIRST_LOAD_BYTES;
  console.log(
    `  ${String(r.firstLoadUncompressedJsBytes).padStart(9)}  ${over ? "OVER  " : "      "}${r.route}`,
  );
}

const failures = byRoute
  .filter((r) => r.firstLoadUncompressedJsBytes > MAX_FIRST_LOAD_BYTES)
  .map(
    (r) =>
      `${r.route}: first-load ${r.firstLoadUncompressedJsBytes} B exceeds ${MAX_FIRST_LOAD_BYTES} B ` +
      `by ${r.firstLoadUncompressedJsBytes - MAX_FIRST_LOAD_BYTES} B`,
  );

// Every chunk any route pulls on first load, deduplicated.
const criticalPath = [...new Set(byRoute.flatMap((r) => r.firstLoadChunkPaths))];
const missing = criticalPath.filter((p) => !existsSync(p));
if (missing.length) {
  fail(
    `FAIL: ${missing.length} first-load chunk path(s) from ${STATS} do not exist on disk.`,
    `e.g. ${missing[0]}`,
    "The artifact and the build output disagree; the measurement cannot be trusted.",
  );
}

const eager = criticalPath.filter((p) => readFileSync(p, "utf8").includes(LAZY_MARKER));
if (eager.length) {
  const bytes = eager.reduce((n, p) => n + statSync(p).size, 0);
  failures.push(
    `three.js (${LAZY_MARKER}) is on the first-load critical path in ${eager.length} chunk(s), ` +
      `${bytes} B: ${eager.join(", ")}. It must stay behind next/dynamic(..., { ssr: false }) — ` +
      "see next.config.ts:127-149 and src/lib/r3f.ts.",
  );
}

if (failures.length) {
  console.error("\nBundle budget exceeded:");
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    "\nIf this growth is intended, raise the constant in this file in its OWN commit and quote the " +
      "measured before/after bytes. Do not add continue-on-error to the CI step.",
  );
  process.exit(1);
}

console.log(
  `\nOK: largest first-load ${byRoute[0].firstLoadUncompressedJsBytes} B on ${byRoute[0].route} ` +
    `(${MAX_FIRST_LOAD_BYTES - byRoute[0].firstLoadUncompressedJsBytes} B headroom); ` +
    `three.js stays lazy across ${criticalPath.length} first-load chunks.`,
);
