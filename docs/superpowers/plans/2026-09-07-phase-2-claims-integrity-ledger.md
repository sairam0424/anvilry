# Claims Integrity Ledger (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hash-chain Anvilry's own resume claims (`impactMetrics` + `achievements` from `src/lib/profile.ts`) so a recruiter or AI agent can verify a claim hasn't been silently edited since a specific commit — a simplified, git-native version of Tombstone's own Merkle-chain audit pattern.

**Architecture:** A pure, framework-agnostic hash-chain module (`src/lib/claims-integrity.ts`) is shared by three consumers: a CLI script (`scripts/seal-claims.ts`, run via `tsx`) that seals new entries locally or verifies the chain in CI; a client-safe re-export (`src/lib/integrity-chain.ts`) of the committed chain data; and a new terminal command that prints the chain state with a mandatory honest disclaimer. The chain itself is a plain git-committed JSON array (`data/integrity-chain.json`), not a database — there is exactly one writer (the repo owner, locally, before a commit), so no locking or keyed HMAC is needed, unlike Tombstone's multi-writer Postgres environment.

**Tech Stack:** TypeScript, Node.js `crypto` (SHA-256), `tsx` (new devDependency — see Global Constraints), Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-07-feature-phase-decisions-integrity-design.md` (Phase 2 section)

## Global Constraints

- Scope is strictly `impactMetrics` + `achievements` from `src/lib/profile.ts` — never the whole `profile` object.
- No HMAC, no external secret key — plain SHA-256. Git-push access is the trust boundary (exactly one writer).
- Sigstore Rekor submission is explicitly **out of scope** for this phase — do not implement it, even partially.
- The disclaimer text on every user-facing surface of this feature must state plainly: this proves a claim hasn't been silently edited since its sealing commit; it does **not** prove the number was ever accurate (no independent issuer, unlike a verifiable credential).
- **Deviation from the spec's literal file format, documented here because it's load-bearing:** the spec names the chain file `data/integrity-chain.jsonl` (newline-delimited). This plan uses `data/integrity-chain.json` — a single JSON **array** — instead. Reason, discovered during planning: the terminal command that displays chain state runs in the browser (client-side terminal simulation), and Next.js's bundler (Turbopack/webpack) can only import `.json` files as pre-parsed data at build time, not `.jsonl`. A JSON array loses nothing here (the file is tiny and rewritten wholesale by the seal script anyway, never streamed/appended-to at the byte level) and gains native, zero-extra-code importability into the client bundle — matching how `.velite/*.json` already works for all other content in this repo.
- **New dependency, also discovered during planning, not in the original spec:** `scripts/seal-claims.ts` must read the live `impactMetrics`/`achievements` values from `src/lib/profile.ts`, which itself imports `@/lib/content` (a path-aliased import). Plain `node` cannot resolve `@/*` aliases or strip TypeScript syntax from a standalone script without extra tooling. Adding `tsx` (devDependency) is the standard, minimal-footprint fix — it reads `tsconfig.json`'s `paths` automatically, no extra config. Every invocation of `seal-claims.ts` in this plan (locally and in CI) goes through `tsx`, never bare `node`.
- Every code task's test file follows this repo's existing convention: `<name>.test.ts` for pure logic under `src/lib/`, run via `pnpm test` (`vitest run`) — confirmed covered by `vitest.config.ts`'s `node` project (`src/**/*.test.{ts,tsx}`).

---

### Task 1: Core hash-chain module (`src/lib/claims-integrity.ts`)

**Files:**
- Create: `src/lib/claims-integrity.ts`
- Test: `src/lib/claims-integrity.test.ts`

**Interfaces:**
- Produces (used by every later task): `type ClaimsFields = { impactMetrics: unknown; achievements: unknown }`; `type ChainEntry = { seq: number; prevHash: string | null; hash: string; parentCommitSha: string; sealedAt: string; fields: ClaimsFields }`; `canonicalEncode(fields: ClaimsFields): string`; `computeHash(encoded: string, prevHash: string | null): string`; `buildEntry(fields: ClaimsFields, prevEntry: ChainEntry | null, parentCommitSha: string, sealedAt: string): ChainEntry`; `verifyChain(entries: ChainEntry[]): { valid: boolean; brokenAtSeq?: number }`; `currentClaimsMatchLastSeal(currentFields: ClaimsFields, lastEntry: ChainEntry | null): boolean`.

This module has zero dependency on `profile.ts` or any I/O — it operates purely on values passed in, so it's fast and deterministic to test.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/claims-integrity.test.ts
import { describe, it, expect } from "vitest";
import {
  canonicalEncode,
  computeHash,
  buildEntry,
  verifyChain,
  currentClaimsMatchLastSeal,
  type ChainEntry,
} from "./claims-integrity";

describe("canonicalEncode", () => {
  it("produces a length-prefixed encoding of impactMetrics and achievements, in that fixed order", () => {
    const encoded = canonicalEncode({
      impactMetrics: [{ value: "2K+" }],
      achievements: [{ title: "Test" }],
    });
    const metricsJson = JSON.stringify([{ value: "2K+" }]);
    const achievementsJson = JSON.stringify([{ title: "Test" }]);
    expect(encoded).toBe(
      `${metricsJson.length}:${metricsJson}${achievementsJson.length}:${achievementsJson}`,
    );
  });

  it("produces different output when field VALUES differ but happen to concatenate the same way delimiter-joined would", () => {
    // Regression guard for the exact ambiguity Tombstone's own canonical() comment warns about:
    // length-prefixing must make two different (a, b) pairs impossible to collide.
    const a = canonicalEncode({ impactMetrics: "ab", achievements: "c" });
    const b = canonicalEncode({ impactMetrics: "a", achievements: "bc" });
    expect(a).not.toBe(b);
  });
});

describe("computeHash", () => {
  it("returns a sha256:-prefixed hex digest", () => {
    const hash = computeHash("abc", null);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("produces a different hash when prevHash differs, even with identical encoded content", () => {
    const h1 = computeHash("same-content", "sha256:aaa");
    const h2 = computeHash("same-content", "sha256:bbb");
    expect(h1).not.toBe(h2);
  });

  it("is deterministic for the same inputs", () => {
    expect(computeHash("x", "sha256:y")).toBe(computeHash("x", "sha256:y"));
  });
});

describe("buildEntry", () => {
  it("builds a genesis entry (seq 1, prevHash null) when there is no previous entry", () => {
    const entry = buildEntry(
      { impactMetrics: [], achievements: [] },
      null,
      "abc1234",
      "2026-09-07T00:00:00Z",
    );
    expect(entry.seq).toBe(1);
    expect(entry.prevHash).toBeNull();
    expect(entry.hash).toMatch(/^sha256:/);
  });

  it("chains to the previous entry's hash and increments seq", () => {
    const first = buildEntry({ impactMetrics: [], achievements: [] }, null, "abc1234", "2026-09-07T00:00:00Z");
    const second = buildEntry({ impactMetrics: [1], achievements: [] }, first, "def5678", "2026-09-08T00:00:00Z");
    expect(second.seq).toBe(2);
    expect(second.prevHash).toBe(first.hash);
  });
});

describe("verifyChain", () => {
  it("reports valid: true for a correctly-linked chain", () => {
    const first = buildEntry({ impactMetrics: [], achievements: [] }, null, "abc1234", "2026-09-07T00:00:00Z");
    const second = buildEntry({ impactMetrics: [1], achievements: [] }, first, "def5678", "2026-09-08T00:00:00Z");
    expect(verifyChain([first, second])).toEqual({ valid: true });
  });

  it("reports the exact broken seq when a middle entry's hash was tampered with", () => {
    const first = buildEntry({ impactMetrics: [], achievements: [] }, null, "abc1234", "2026-09-07T00:00:00Z");
    const second = buildEntry({ impactMetrics: [1], achievements: [] }, first, "def5678", "2026-09-08T00:00:00Z");
    const tampered: ChainEntry = { ...second, fields: { impactMetrics: [999], achievements: [] } };
    expect(verifyChain([first, tampered])).toEqual({ valid: false, brokenAtSeq: 2 });
  });

  it("reports valid: true for an empty chain", () => {
    expect(verifyChain([])).toEqual({ valid: true });
  });
});

describe("currentClaimsMatchLastSeal", () => {
  it("returns false when there is no last entry (genesis needed)", () => {
    expect(currentClaimsMatchLastSeal({ impactMetrics: [], achievements: [] }, null)).toBe(false);
  });

  it("returns true when current fields hash to the same value as the last entry", () => {
    const fields = { impactMetrics: [{ value: "2K+" }], achievements: [] };
    const entry = buildEntry(fields, null, "abc1234", "2026-09-07T00:00:00Z");
    expect(currentClaimsMatchLastSeal(fields, entry)).toBe(true);
  });

  it("returns false when current fields differ from what was last sealed", () => {
    const sealed = buildEntry({ impactMetrics: [{ value: "2K+" }], achievements: [] }, null, "abc1234", "2026-09-07T00:00:00Z");
    const changed = { impactMetrics: [{ value: "5K+" }], achievements: [] };
    expect(currentClaimsMatchLastSeal(changed, sealed)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/claims-integrity.test.ts`
Expected: FAIL — `Cannot find module './claims-integrity'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/claims-integrity.ts
/**
 * Hash-chains Anvilry's own resume claims (impactMetrics + achievements) so a
 * claim's stability since a specific commit becomes independently verifiable.
 *
 * This proves a claim string has not been silently edited since its sealing
 * commit. It does NOT prove the claim was ever accurate — there is no
 * independent issuer, unlike a W3C Verifiable Credential. Every user-facing
 * surface of this data must say so explicitly.
 *
 * Simplified from Tombstone's own Merkle-chain audit log
 * (services/flag-api/internal/audit/audit.go): same length-prefixed canonical
 * encoding and prev-hash chaining, but plain SHA-256 (no HMAC) and no advisory
 * locking — Anvilry has exactly one writer (the owner, locally, before a
 * commit), so git-push access is already the trust boundary Tombstone's HMAC
 * key and Postgres advisory lock exist to provide under concurrent writers.
 */
import { createHash } from "node:crypto";

export type ClaimsFields = {
  impactMetrics: unknown;
  achievements: unknown;
};

export type ChainEntry = {
  seq: number;
  prevHash: string | null;
  hash: string;
  parentCommitSha: string;
  sealedAt: string;
  fields: ClaimsFields;
};

/**
 * Length-prefixed ("<len>:<value>"), fixed-field-order encoding — never
 * delimiter-joined. A delimiter-joined scheme lets one field's content shift
 * where the next field is read from; length-prefixing makes two distinct
 * (impactMetrics, achievements) pairs impossible to serialize identically.
 */
export function canonicalEncode(fields: ClaimsFields): string {
  let out = "";
  for (const value of [fields.impactMetrics, fields.achievements]) {
    const json = JSON.stringify(value);
    out += `${json.length}:${json}`;
  }
  return out;
}

/**
 * prevHash is folded into the hashed bytes (not just stored alongside), so
 * each entry commits to its entire history, not only its own content.
 */
export function computeHash(encoded: string, prevHash: string | null): string {
  const prev = prevHash ?? "";
  const withPrev = `${encoded}${prev.length}:${prev}`;
  return `sha256:${createHash("sha256").update(withPrev, "utf8").digest("hex")}`;
}

export function buildEntry(
  fields: ClaimsFields,
  prevEntry: ChainEntry | null,
  parentCommitSha: string,
  sealedAt: string,
): ChainEntry {
  const prevHash = prevEntry ? prevEntry.hash : null;
  const hash = computeHash(canonicalEncode(fields), prevHash);
  return {
    seq: prevEntry ? prevEntry.seq + 1 : 1,
    prevHash,
    hash,
    parentCommitSha,
    sealedAt,
    fields,
  };
}

/**
 * Re-derives every entry's hash from its own fields + prevHash and checks the
 * prevHash linkage — catches both a tampered entry and a broken chain link.
 * Returns the first broken seq, not just a boolean, so a CI failure message
 * can name exactly where to look.
 */
export function verifyChain(entries: ChainEntry[]): { valid: boolean; brokenAtSeq?: number } {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrevHash = i === 0 ? null : entries[i - 1].hash;
    if (entry.prevHash !== expectedPrevHash) {
      return { valid: false, brokenAtSeq: entry.seq };
    }
    const recomputed = computeHash(canonicalEncode(entry.fields), entry.prevHash);
    if (recomputed !== entry.hash) {
      return { valid: false, brokenAtSeq: entry.seq };
    }
  }
  return { valid: true };
}

/** True if profile.ts's current claims still hash to what was last sealed. */
export function currentClaimsMatchLastSeal(
  currentFields: ClaimsFields,
  lastEntry: ChainEntry | null,
): boolean {
  if (!lastEntry) return false;
  return computeHash(canonicalEncode(currentFields), lastEntry.prevHash) === lastEntry.hash;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/claims-integrity.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/claims-integrity.ts src/lib/claims-integrity.test.ts
git commit -m "feat: add claims-integrity hash-chain core module"
```

---

### Task 2: `scripts/seal-claims.ts` CLI (add `tsx`, `--write` + bare-run modes)

**Files:**
- Modify: `package.json` (add `tsx` devDependency, add a `seal-claims` script entry)
- Create: `scripts/seal-claims.ts`

**Interfaces:**
- Consumes (from Task 1): `canonicalEncode`, `computeHash`, `buildEntry`, `verifyChain`, `currentClaimsMatchLastSeal`, `ChainEntry`, `ClaimsFields` from `@/lib/claims-integrity`.
- Consumes: `impactMetrics`, `achievements` from `@/lib/profile`.
- Produces (used by Task 3, 4, 5): a CLI runnable as `npx tsx scripts/seal-claims.ts` (bare-run, verify mode, exit 1 on mismatch/broken chain) and `npx tsx scripts/seal-claims.ts --write` (append a new entry if claims changed, or refuse with exit 0 + a message if nothing changed).

This script is thin CLI plumbing (argv parsing, file I/O, `git rev-parse HEAD`) around Task 1's pure logic — deliberately not unit-tested itself (matches `scripts/check-index-citations.mjs`'s own precedent: no separate test file, verified by actually running it). Task 3 runs it for real as its own verification.

- [ ] **Step 1: Add the `tsx` devDependency**

```bash
pnpm add -D tsx
```

- [ ] **Step 2: Add the convenience script entry to `package.json`**

In the `"scripts"` block, add (after `"content"`):
```json
    "seal-claims": "tsx scripts/seal-claims.ts",
```

- [ ] **Step 3: Write `scripts/seal-claims.ts`**

```ts
#!/usr/bin/env -S npx tsx
/**
 * Seals or verifies the Claims Integrity Ledger (data/integrity-chain.json).
 *
 *   npx tsx scripts/seal-claims.ts            # verify: exit 1 if current claims
 *                                              #   don't match the chain head, or
 *                                              #   the chain's own linkage is broken
 *   npx tsx scripts/seal-claims.ts --write     # append a new entry if claims changed
 *
 * Run via `tsx`, never bare `node` — profile.ts transitively imports via the
 * `@/*` path alias, which tsx resolves from tsconfig.json automatically; a
 * plain Node ESM loader cannot.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  buildEntry,
  currentClaimsMatchLastSeal,
  verifyChain,
  type ChainEntry,
} from "../src/lib/claims-integrity";
import { impactMetrics, achievements } from "../src/lib/profile";

const CHAIN_PATH = "data/integrity-chain.json";

function loadChain(): ChainEntry[] {
  if (!existsSync(CHAIN_PATH)) return [];
  return JSON.parse(readFileSync(CHAIN_PATH, "utf8")) as ChainEntry[];
}

function parentCommitSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

const write = process.argv.includes("--write");
const chain = loadChain();
const lastEntry = chain.length > 0 ? chain[chain.length - 1] : null;
const currentFields = { impactMetrics, achievements };

const linkage = verifyChain(chain);
if (!linkage.valid) {
  console.error(
    `CHAIN BROKEN at seq ${linkage.brokenAtSeq} — an entry's hash no longer matches its ` +
      `recomputed value, or its prevHash link is wrong. Do not edit ${CHAIN_PATH} by hand.`,
  );
  process.exit(1);
}

if (write) {
  if (currentClaimsMatchLastSeal(currentFields, lastEntry)) {
    console.log("No change — impactMetrics/achievements already match the last sealed entry.");
    process.exit(0);
  }
  const entry = buildEntry(currentFields, lastEntry, parentCommitSha(), new Date().toISOString());
  const next = [...chain, entry];
  writeFileSync(CHAIN_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Sealed entry #${entry.seq} (${entry.hash}) -> ${CHAIN_PATH}`);
  process.exit(0);
}

// Bare-run: verify current claims match what was last sealed.
if (!currentClaimsMatchLastSeal(currentFields, lastEntry)) {
  console.error(
    "profile.ts's impactMetrics/achievements have changed since the last seal.\n" +
      "Run `npx tsx scripts/seal-claims.ts --write` locally and commit the updated " +
      `${CHAIN_PATH}.`,
  );
  process.exit(1);
}
console.log(`Claims Integrity Ledger OK — ${chain.length} entr${chain.length === 1 ? "y" : "ies"}, chain intact.`);
process.exit(0);
```

- [ ] **Step 4: Verify the script runs (there is no chain file yet, so bare-run should report the "no last entry" case as a failure — this is expected and fixed by Task 3)**

Run: `npx tsx scripts/seal-claims.ts`
Expected: exits 1 with the "have changed since the last seal" message — correct, because no genesis entry exists yet.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/seal-claims.ts
git commit -m "feat: add seal-claims CLI script for the claims integrity chain"
```

---

### Task 3: Create the real genesis entry

**Files:**
- Create: `data/integrity-chain.json` (real data, not a fixture — this task's deliverable is the actual first sealed entry)

**Interfaces:**
- Consumes: `scripts/seal-claims.ts --write` (Task 2).
- Produces (used by Task 4, 5, 6): a real, committed `data/integrity-chain.json` with exactly one entry, so the CI verify step introduced in Task 4 has something valid to check from the moment it's added — no missing-file runtime edge case ever exists in production.

- [ ] **Step 1: Run the seal script for real**

Run: `npx tsx scripts/seal-claims.ts --write`
Expected: prints `Sealed entry #1 (sha256:...) -> data/integrity-chain.json`, and the file now exists with one entry whose `fields` match the current `impactMetrics`/`achievements` in `src/lib/profile.ts`.

- [ ] **Step 2: Verify the bare-run check now passes against the file just created**

Run: `npx tsx scripts/seal-claims.ts`
Expected: `Claims Integrity Ledger OK — 1 entry, chain intact.`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add data/integrity-chain.json
git commit -m "chore: seal the genesis entry for the claims integrity chain"
```

---

### Task 4: CI verify step (bare-run, default-on)

**Files:**
- Modify: `.github/workflows/ci.yml` — add a step to the existing `ci` job (`name: Lint · Type-check · Test`), immediately after the `Codebase index citations` step.

**Interfaces:**
- Consumes: `scripts/seal-claims.ts` (Task 2), `data/integrity-chain.json` (Task 3).

- [ ] **Step 1: Add the step**

In `.github/workflows/ci.yml`, inside the `ci` job's `steps:` list, immediately after the existing `Codebase index citations` step (which ends `run: node scripts/check-index-citations.mjs`), add:

```yaml
      # Verifies data/integrity-chain.json's hash chain is intact AND that
      # profile.ts's current impactMetrics/achievements still match what was
      # last sealed. On drift: `npx tsx scripts/seal-claims.ts --write` locally,
      # then commit the updated chain file.
      - name: Claims integrity chain
        run: npx tsx scripts/seal-claims.ts
```

- [ ] **Step 2: Verify locally that the exact CI command succeeds against the current committed state**

Run: `npx tsx scripts/seal-claims.ts`
Expected: exit 0, `Claims Integrity Ledger OK — 1 entry, chain intact.` (same as Task 3 Step 2 — confirms the CI step will pass once pushed).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: verify the claims integrity chain on every push/PR"
```

---

### Task 5: CI opt-in auto-commit job (gated, off by default)

**Files:**
- Modify: `.github/workflows/ci.yml` — add a new, separate job (not a step inside `ci`).

**Interfaces:**
- Consumes: `scripts/seal-claims.ts --write` (Task 2).

This satisfies the design's dual-mode decision: local `--write` stays the always-available default; this job is a deliberate, explicit opt-in toggle (a GitHub Actions repository **variable**, `vars.SEAL_CLAIMS_AUTO_COMMIT`, unset by default — repo variables are for non-secret configuration flags exactly like this, distinct from `secrets.*`). It needs its own `permissions: contents: write` block, scoped to only this job, so the rest of the workflow's jobs stay at their current (more restrictive) default permissions.

- [ ] **Step 1: Add the job**

In `.github/workflows/ci.yml`, add a new top-level job (place it after the `ci` job, before `e2e`):

```yaml
  claims-integrity-autocommit:
    name: Claims integrity auto-commit (opt-in)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    # OFF BY DEFAULT. Local `npx tsx scripts/seal-claims.ts --write` is the
    # always-available, always-safe way to seal a new entry — this job exists
    # only so a maintainer can explicitly opt into CI doing it automatically,
    # without that becoming the default behavior. To enable: set the repo
    # variable SEAL_CLAIMS_AUTO_COMMIT to "true" (Settings -> Secrets and
    # variables -> Actions -> Variables).
    if: vars.SEAL_CLAIMS_AUTO_COMMIT == 'true'
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4

      - name: Setup pnpm
        uses: pnpm/action-setup@8912a9102ac27614460f54aedde9e1e7f9aec20d # v6.0.5
        with:
          version: 10

      - name: Setup Node.js 22
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Seal a new entry if claims changed
        run: npx tsx scripts/seal-claims.ts --write

      # [skip ci] avoids this commit re-triggering the whole workflow (which
      # would otherwise loop: push -> CI runs -> this job commits -> that
      # commit triggers CI again -> ...).
      - name: Commit the updated chain, if changed
        run: |
          if git diff --quiet -- data/integrity-chain.json; then
            echo "No change to commit."
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/integrity-chain.json
          git commit -m "chore: seal claims integrity chain [skip ci]"
          git push
```

- [ ] **Step 2: Verify the job is syntactically valid**

Run: `npx tsx -e "require('js-yaml') || 1"` is unnecessary — instead just run the repo's own YAML-sensitive check:
Run: `pnpm lint` (this repo's `eslint` config does not lint YAML, so this only confirms nothing else broke; the real check is the next PR's Actions run actually parsing the workflow, which happens automatically once pushed — no local YAML linter exists in this repo to run ahead of that).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add opt-in gated auto-commit job for the claims integrity chain"
```

---

### Task 6: Terminal command + client-safe chain re-export

**Files:**
- Create: `src/lib/integrity-chain.ts`
- Modify: `src/components/game/terminal/commands.ts`

**Interfaces:**
- Consumes: `ChainEntry` type from `@/lib/claims-integrity` (Task 1); `data/integrity-chain.json` (Task 3).
- Produces: `integrityChain: ChainEntry[]` exported from `@/lib/integrity-chain`; a new `integrity` entry in `commands.ts`'s `COMMANDS` registry.

`src/lib/integrity-chain.ts` exists so the terminal (a client component) never touches the filesystem — it imports the committed JSON file directly, which Next's bundler resolves to a plain, already-parsed array at build time (the same mechanism every other JSON import in this repo already relies on).

- [ ] **Step 1: Create the client-safe re-export**

```ts
// src/lib/integrity-chain.ts
/**
 * Client-safe access to the committed Claims Integrity Ledger. Importing the
 * JSON file directly (not reading it via fs) means this is safe to use from a
 * client component — Next's bundler inlines it as plain data at build time,
 * the same mechanism every other JSON import in this repo relies on.
 */
import chain from "../../data/integrity-chain.json";
import type { ChainEntry } from "./claims-integrity";

export const integrityChain: ChainEntry[] = chain as ChainEntry[];
```

- [ ] **Step 2: Add the `integrity` command to `commands.ts`**

Add this new `Command` definition near `awards`/`stats` (both already follow the same "read profile/derived data, format with `fmt.*` helpers" shape):

```ts
import { integrityChain } from "@/lib/integrity-chain";

const integrity: Command = {
  name: "integrity",
  description: "claims integrity ledger — is my résumé data still what I sealed",
  run: () => {
    if (integrityChain.length === 0) {
      return { lines: out("no sealed entries yet.") };
    }
    const head = integrityChain[integrityChain.length - 1];
    const first = integrityChain[0];
    return {
      lines: fmt.box("// CLAIMS INTEGRITY LEDGER", [
        fmt.row("●", "entries", String(integrityChain.length)),
        fmt.row("●", "head", `${head.hash.slice(0, 19)}… (commit ${head.parentCommitSha.slice(0, 7)})`),
        fmt.row("●", "sealed", `${head.sealedAt.slice(0, 10)} (commit ${head.parentCommitSha.slice(0, 7)})`),
        fmt.row("●", "first", `${first.sealedAt.slice(0, 10)} (commit ${first.parentCommitSha.slice(0, 7)})`),
        fmt.divider(),
        { kind: "out", text: "  This proves the claims below have not been silently edited" },
        { kind: "out", text: "  since their sealing commit. It does NOT prove the numbers" },
        { kind: "out", text: "  were ever accurate — there is no independent issuer, unlike a" },
        { kind: "out", text: "  verifiable credential. Treat it as a tamper-evidence log, not" },
        { kind: "out", text: "  a certification." },
      ]),
    };
  },
};
```

Then register it in the `COMMANDS` object (in the same visible/core group as `awards`, `stats`, `summary`):

```ts
export const COMMANDS: Record<string, Command> = {
  help, whoami, neofetch, ls, cat, tree, grep, find, top, stats, stack, awards, integrity, summary, career,
  about, resume, open, contact, email, social, chat, theme, classic, developer, cd, clear, sudo,
  secret, personal: personalAlias, uses, now: nowCmd,
};
```

- [ ] **Step 3: Manual verification (this repo has no existing test file for `commands.ts` — check for one first; if none exists, a manual check is consistent with this file's current test coverage)**

Run: `grep -rl "commands.ts" src/components/game/terminal/*.test.* src/components/game/terminal/*.dom.test.* 2>/dev/null`
If a test file is found covering `COMMANDS`/`runCommand`, add a case asserting `runCommand("integrity").lines` includes the disclaimer text and does not error when the chain has exactly one entry. If none exists, proceed to a manual check:

Run: `pnpm dev`, open the Developer view (`?view=developer`), type `integrity`, confirm the box renders with real entry count/hash/dates and the full disclaimer text, in both light and dark theme.

- [ ] **Step 4: Commit**

```bash
git add src/lib/integrity-chain.ts src/components/game/terminal/commands.ts
git commit -m "feat: add integrity terminal command + client-safe chain re-export"
```

---

### Task 7: Ship Phase 2

Follow this session's standing pattern (same as every prior round): branch from `origin/develop`, full local verification, PR into `develop`, watch CI, merge. No `develop` → `main` promotion here — that's a separate, later, human-gated step once all 3 phases have shipped.

- [ ] **Step 1: Create the branch (if not already on one from Task 1)**

```bash
git fetch origin
git checkout -B feat/claims-integrity-ledger origin/develop
```

(If Tasks 1–6 were already committed on this branch as you went, skip re-branching and just proceed to verification.)

- [ ] **Step 2: Full local verification**

```bash
npx tsc --noEmit
pnpm lint
pnpm test
pnpm build
node scripts/bundle-budget.mjs
```

All must pass. `pnpm test`'s known pre-existing baseline (unrelated `localStorage`-shadowing failures in `site-footer.dom.test.tsx` and `voice-pitfalls.dom.test.ts`, and the intermittent `ask-portfolio.dom.test.tsx` "Hello from the corpus" flake) is expected and not a blocker — confirm no *new* failures beyond that known set.

- [ ] **Step 3: Full e2e, both browsers**

```bash
npx playwright test --project=chromium
npx playwright test --project="mobile-safari"
```

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/claims-integrity-ledger
gh pr create --base develop --title "feat: Claims Integrity Ledger" --body "$(cat <<'EOF'
## Summary

Hash-chains impactMetrics/achievements from profile.ts (simplified, git-native
version of Tombstone's own Merkle-chain audit pattern) so a claim's stability
since a given commit becomes verifiable. Sigstore Rekor submission is
explicitly out of scope for this phase.

- src/lib/claims-integrity.ts — pure canonical-encoding + hash-chain core, unit tested
- scripts/seal-claims.ts (via new `tsx` devDependency) — --write / bare-run verify CLI
- data/integrity-chain.json — the real genesis entry
- CI: bare-run verify step (default-on) + a separate, off-by-default opt-in
  auto-commit job gated behind the `SEAL_CLAIMS_AUTO_COMMIT` repo variable
- New `integrity` terminal command, with the mandatory disclaimer of what this
  does and does not prove

## Test plan

- [ ] CI green
- [ ] `integrity` command spot-checked in both themes on the preview deploy
EOF
)"
```

- [ ] **Step 5: Watch CI**

```bash
gh pr checks <PR_NUMBER> --watch
```

If the known `ask-portfolio.dom.test.tsx` "Hello from the corpus" flake is hit (isolated single-test failure, unrelated to this change): `gh run rerun <RUN_ID> --failed`, then re-watch.

- [ ] **Step 6: Merge**

```bash
gh pr merge <PR_NUMBER> --merge
```

---

## Self-Review

**Spec coverage:** every Phase 2 requirement from the design spec has a task — scope/data-model (Task 1), the `--write`/bare-run script (Task 2), git-committed storage + genesis (Task 3), the CI verify step (Task 4), the dual-mode opt-in auto-commit (Task 5), the terminal command + mandatory disclaimer (Task 6), the standing ship pattern (Task 7). Rekor and any MCP/page surface are correctly absent — both are explicitly deferred by the spec.

**Placeholder scan:** no TBD/TODO; every step has real, complete code, not a description of code.

**Type/signature consistency:** `ClaimsFields`, `ChainEntry`, `canonicalEncode`, `computeHash`, `buildEntry`, `verifyChain`, `currentClaimsMatchLastSeal` are defined once in Task 1 and used with identical names/signatures in Tasks 2 and 6 — checked by hand across all three tasks while writing this plan.

**Deviations from the spec, both intentional and documented in Global Constraints:** `data/integrity-chain.json` (plain array) instead of `.jsonl`, and the new `tsx` devDependency. Both were necessary discoveries made while grounding this plan in the real codebase (client-bundle JSON-import constraints; path-alias resolution for a standalone script) rather than assumptions in the original spec — flagged prominently rather than silently substituted.
