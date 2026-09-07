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
export function verifyChain(entries: ChainEntry[]): {
  valid: boolean;
  brokenAtSeq?: number;
} {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expectedPrevHash = i === 0 ? null : entries[i - 1].hash;
    if (entry.prevHash !== expectedPrevHash) {
      return { valid: false, brokenAtSeq: entry.seq };
    }
    const recomputed = computeHash(
      canonicalEncode(entry.fields),
      entry.prevHash,
    );
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
  return (
    computeHash(canonicalEncode(currentFields), lastEntry.prevHash) ===
    lastEntry.hash
  );
}
