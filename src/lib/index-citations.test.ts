import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Runs scripts/check-index-citations.mjs so the codebase index cannot rot silently.
 *
 * The index carries ~700 `path:line` citations into src/. Nothing enforced them, which is the
 * fair criticism of any document like it: a reader cannot distinguish a live citation from a dead
 * one, and it decays invisibly. Measured before this guard existed: one unrelated 530-line change
 * invalidated 33 of 699 citations with no signal at all.
 *
 * `vitest run` is chained into `pnpm build` (package.json), so a stale index now fails the build
 * with the exact citations to fix, and `--write` re-fingerprints them as a reviewed step.
 *
 * Skips itself when docs/index/ is absent, so the suite stays green on a branch without the index.
 */
const SCRIPT = "scripts/check-index-citations.mjs";
const SNAPSHOT = "docs/index/.citations.json";

describe("codebase index citations", () => {
  const present = existsSync("docs/index") && existsSync(SNAPSHOT);

  it.runIf(present)("every cited source line still says what the index recorded", () => {
    let output = "";
    let failed = false;
    try {
      output = execFileSync("node", [SCRIPT], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string };
      output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
      failed = true;
    }
    expect(
      failed,
      `docs/index/ citations have drifted from the source they describe:\n\n${output}\n` +
        "Update the prose in the listed index files, then re-fingerprint:\n" +
        `  node ${SCRIPT} --write`,
    ).toBe(false);
  });

  it.runIf(present)("reports a non-trivial number of citations — the guard is actually wired", () => {
    // A regex that silently matched nothing would make the check above vacuously pass.
    const json = JSON.parse(
      execFileSync("node", [SCRIPT, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
    ) as { total: number; unchanged: number };
    expect(json.total, "no citations extracted — the extraction regex is broken").toBeGreaterThan(500);
    expect(json.unchanged).toBe(json.total);
  });

  it.runIf(!present)("skips cleanly when the index is not on this branch", () => {
    expect(present).toBe(false);
  });
});
