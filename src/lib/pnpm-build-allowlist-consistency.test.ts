import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The pnpm build-script allowlist is spelled TWICE in pnpm-workspace.yaml:
 *
 *   onlyBuiltDependencies / ignoredBuiltDependencies   (lists)    <- legacy, pnpm <=10.27 only
 *   allowBuilds                                        (booleans) <- live, pnpm >=10.28 and 11
 *
 * WHY THIS GUARD EARNS ITS KEEP
 * Without `allowBuilds`, `pnpm install --frozen-lockfile` exits 1 on pnpm 11 and seeds a
 * `set this to true or false` placeholder into the tracked workspace file:
 *
 *   [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.25.12, unrs-resolver@1.12.2
 *
 * Measured on a one-install-script fixture, `allowBuilds` alone and no legacy keys:
 * pnpm 11.17.0 ok · 10.34.5 ok · 10.28.0 ok · 10.27.1 EXIT 1. CI pins `version: 10`, which resolves
 * to latest-10 (10.34.5), so THE LEGACY LISTS ARE DEAD CONFIG FOR CI and the pnpm 11 break was
 * invisible to every green run. That is the failure mode this guard exists for.
 *
 * Do NOT justify the duplication with "deleting the lists would break CI" — that was measured and
 * is false. They survive only for pnpm <=10.27. Equally, do not cite `pnpm config get
 * onlyBuiltDependencies` as proof pnpm 11 honours the key: `pnpm config get` echoes ANY key present
 * in the file, including one that does not exist, so it is not evidence of anything.
 *
 * TWO INDEPENDENT ASSERTIONS, because the first one alone could not catch a recurrence:
 *   1. the two spellings agree with each other  (file-only; catches hand-editing drift)
 *   2. every dependency that declares an install script appears in `allowBuilds` with an explicit
 *      boolean  (reads the RESOLVED TREE; catches the far likelier case — a new dependency arrives,
 *      nobody adds it, CI on pnpm 10 warns-and-passes while pnpm 11 exits 1)
 * Assertion 1 has exactly one input, the workspace file, so it can never see a new dependency.
 * That gap is what assertion 2 closes, and it is how this bug would otherwise have recurred.
 *
 * IMPORTANT: parsing strips `#` comments FIRST. The keys carry inline comments and the docblock
 * above quotes the placeholder string verbatim, so any assertion run against raw text would match
 * prose instead of config — the defect that made an earlier version of
 * client-ip-consistency.test.ts unable to fail. Strip, then assert.
 */
const WORKSPACE = "pnpm-workspace.yaml";
const PNPM_STORE = "node_modules/.pnpm";

/** A comment-stripped view: `#` to end-of-line removed, blank lines kept so structure survives. */
function stripComments(src: string): string[] {
  return src.split("\n").map((line) => line.replace(/#.*$/, "").trimEnd());
}

/**
 * The indented body of a top-level `key:` block, comment-stripped. A block ends at the next
 * non-indented, non-blank line — enough for this file's flat shape, and it deliberately does NOT
 * try to be a general YAML parser (no parser is resolvable under pnpm's isolated node_modules).
 */
function blockBody(lines: string[], key: string): string[] {
  const start = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (start === -1) return [];
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") continue;
    if (!/^\s/.test(line)) break; // dedented -> block over
    body.push(line.trim());
  }
  return body;
}

/** `- pkg` list entries. */
function listEntries(lines: string[], key: string): string[] {
  return blockBody(lines, key)
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}

/** `pkg: value` map entries, values returned RAW so a non-boolean is detectable. */
function mapEntries(lines: string[], key: string): Array<[string, string]> {
  return blockBody(lines, key)
    .filter((l) => l.includes(":"))
    .map((l) => {
      const at = l.indexOf(":");
      return [l.slice(0, at).trim(), l.slice(at + 1).trim()] as [string, string];
    });
}

/**
 * Every package name in the resolved tree that declares a preinstall/install/postinstall script.
 *
 * Reads node_modules/.pnpm rather than pnpm-lock.yaml because the lockfile does not record scripts.
 * Returns NAMES only (no versions) so it can be compared against allowBuilds keys.
 */
function packagesWithInstallScripts(): string[] {
  const found = new Set<string>();
  for (const entry of readdirSync(PNPM_STORE)) {
    const scope = join(PNPM_STORE, entry, "node_modules");
    if (!existsSync(scope)) continue;
    for (const name of readdirSync(scope)) {
      // Scoped packages nest one level deeper: @scope/pkg
      const candidates = name.startsWith("@")
        ? readdirSync(join(scope, name)).map((sub) => `${name}/${sub}`)
        : [name];
      for (const pkg of candidates) {
        const manifest = join(scope, pkg, "package.json");
        if (!existsSync(manifest)) continue;
        try {
          const { name: declared, scripts } = JSON.parse(readFileSync(manifest, "utf8"));
          if (scripts?.preinstall || scripts?.install || scripts?.postinstall) {
            found.add(declared ?? pkg);
          }
        } catch {
          // An unparseable manifest in the store is not this test's concern.
        }
      }
    }
  }
  return [...found].sort();
}

describe("pnpm build-script allowlist stays consistent across pnpm majors", () => {
  const lines = stripComments(readFileSync(WORKSPACE, "utf8"));
  const allowBuilds = mapEntries(lines, "allowBuilds");
  const onlyBuilt = listEntries(lines, "onlyBuiltDependencies");
  const ignoredBuilt = listEntries(lines, "ignoredBuiltDependencies");

  it("declares allowBuilds at all, so pnpm 11 does not seed it with a placeholder", () => {
    // Absent allowBuilds is the whole bug: pnpm 11 writes its own and then fails on it.
    expect(allowBuilds.length).toBeGreaterThan(0);
  });

  it("gives every allowBuilds package a real boolean, never pnpm's placeholder string", () => {
    for (const [pkg, raw] of allowBuilds) {
      // `set this to true or false` contains "true" and "false" — assert the WHOLE value, not a
      // substring, or the placeholder passes and the guard is decorative.
      expect(raw, `allowBuilds.${pkg} must be literally true or false, got ${JSON.stringify(raw)}`)
        .toMatch(/^(true|false)$/);
    }
  });

  it("allows exactly the packages pnpm 10's onlyBuiltDependencies allows", () => {
    const allowed = allowBuilds.filter(([, v]) => v === "true").map(([k]) => k);
    expect(allowed.sort()).toEqual([...onlyBuilt].sort());
  });

  it("denies exactly the packages pnpm 10's ignoredBuiltDependencies denies", () => {
    const denied = allowBuilds.filter(([, v]) => v === "false").map(([k]) => k);
    expect(denied.sort()).toEqual([...ignoredBuilt].sort());
  });

  it("never lists a package as both allowed and denied", () => {
    const overlap = onlyBuilt.filter((p) => ignoredBuilt.includes(p));
    expect(overlap).toEqual([]);
  });

  /**
   * The assertion that actually prevents a recurrence. Everything above reads only the workspace
   * file, so it is blind to the dependency graph: add a package with an install script, change
   * nothing else, and all of it still passes while pnpm 11 exits 1.
   *
   * A package pnpm has never been told about is "unreviewed", and pnpm 11 treats unreviewed as
   * fatal. So the requirement is not "is it allowed" but "has a human made an explicit call" —
   * `true` and `false` are both fine, absent is not.
   */
  it("has an explicit decision for every dependency that declares an install script", () => {
    // A vacuous pass here would be worse than no test: if the tree is missing, say so and fail.
    expect(
      existsSync(PNPM_STORE),
      `${PNPM_STORE} is missing — run pnpm install before the suite. Skipping silently would let an ` +
        "unreviewed install script through, which is the whole bug this guards.",
    ).toBe(true);

    const decided = new Set(allowBuilds.map(([k]) => k));
    const undecided = packagesWithInstallScripts().filter((p) => !decided.has(p));

    expect(
      undecided,
      `these dependencies declare an install lifecycle script but have no entry in allowBuilds:\n` +
        `  ${undecided.join("\n  ")}\n` +
        "pnpm 11 fails the install for unreviewed build scripts, and CI (pnpm 10) only warns — so " +
        "this passes CI and breaks every contributor. Add each with an explicit true or false, and " +
        "mirror it into the legacy lists above.",
    ).toEqual([]);
  });
});
