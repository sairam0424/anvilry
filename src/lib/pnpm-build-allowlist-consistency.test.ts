import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The pnpm build-script allowlist is spelled TWICE in pnpm-workspace.yaml, once per pnpm major:
 *
 *   onlyBuiltDependencies / ignoredBuiltDependencies   (lists)    <- pnpm 10, what CI pins
 *   allowBuilds                                        (booleans) <- pnpm 11, the default today
 *
 * That duplication is deliberate and is the one place in this repo where DRY is the wrong answer:
 * CI pins pnpm 10 (.github/workflows/ci.yml) while a contributor's `pnpm install` resolves to
 * pnpm 11, so deleting either spelling breaks one of them. But deliberate duplication drifts
 * unless something enforces it, and a `# keep these in sync` comment enforces nothing.
 *
 * WHY THIS GUARD EARNS ITS KEEP
 * pnpm 11 reads the pnpm 10 keys but `allowBuilds` wins, and when `allowBuilds` is ABSENT pnpm 11
 * writes it into the tracked file itself, seeded with the literal placeholder string
 * `set this to true or false`. That is neither `true` nor `false`, so every listed package counts
 * as denied and the install aborts:
 *
 *   [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.25.12, unrs-resolver@1.12.2
 *
 * Measured before the fix: `pnpm install --frozen-lockfile` exit 1 on pnpm 11.17.0 from a clean
 * clone, exit 0 on pnpm 10.34.5. CI pins pnpm 10, so NO GREEN RUN COULD EVER HAVE SURFACED IT —
 * it reached only contributors on the current default pnpm. That is the failure mode this guard
 * exists for: a break that is invisible to CI by construction.
 *
 * IMPORTANT: parsing strips `#` comments FIRST. The keys carry inline comments (`# pnpm 10`) and
 * the header block quotes the placeholder string verbatim, so any assertion run against raw text
 * would match prose instead of config — the exact defect that made an earlier version of
 * client-ip-consistency.test.ts unable to fail. Strip, then assert.
 */
const WORKSPACE = "pnpm-workspace.yaml";

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
});
