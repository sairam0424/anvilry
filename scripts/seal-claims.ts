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
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
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
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
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
    console.log(
      "No change — impactMetrics/achievements already match the last sealed entry.",
    );
    process.exit(0);
  }
  const entry = buildEntry(
    currentFields,
    lastEntry,
    parentCommitSha(),
    new Date().toISOString(),
  );
  const next = [...chain, entry];
  mkdirSync(dirname(CHAIN_PATH), { recursive: true });
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
console.log(
  `Claims Integrity Ledger OK — ${chain.length} entr${chain.length === 1 ? "y" : "ies"}, chain intact.`,
);
process.exit(0);
