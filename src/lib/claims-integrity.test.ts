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
    const first = buildEntry(
      { impactMetrics: [], achievements: [] },
      null,
      "abc1234",
      "2026-09-07T00:00:00Z",
    );
    const second = buildEntry(
      { impactMetrics: [1], achievements: [] },
      first,
      "def5678",
      "2026-09-08T00:00:00Z",
    );
    expect(second.seq).toBe(2);
    expect(second.prevHash).toBe(first.hash);
  });
});

describe("verifyChain", () => {
  it("reports valid: true for a correctly-linked chain", () => {
    const first = buildEntry(
      { impactMetrics: [], achievements: [] },
      null,
      "abc1234",
      "2026-09-07T00:00:00Z",
    );
    const second = buildEntry(
      { impactMetrics: [1], achievements: [] },
      first,
      "def5678",
      "2026-09-08T00:00:00Z",
    );
    expect(verifyChain([first, second])).toEqual({ valid: true });
  });

  it("reports the exact broken seq when a middle entry's hash was tampered with", () => {
    const first = buildEntry(
      { impactMetrics: [], achievements: [] },
      null,
      "abc1234",
      "2026-09-07T00:00:00Z",
    );
    const second = buildEntry(
      { impactMetrics: [1], achievements: [] },
      first,
      "def5678",
      "2026-09-08T00:00:00Z",
    );
    const tampered: ChainEntry = {
      ...second,
      fields: { impactMetrics: [999], achievements: [] },
    };
    expect(verifyChain([first, tampered])).toEqual({
      valid: false,
      brokenAtSeq: 2,
    });
  });

  it("reports valid: true for an empty chain", () => {
    expect(verifyChain([])).toEqual({ valid: true });
  });
});

describe("currentClaimsMatchLastSeal", () => {
  it("returns false when there is no last entry (genesis needed)", () => {
    expect(
      currentClaimsMatchLastSeal({ impactMetrics: [], achievements: [] }, null),
    ).toBe(false);
  });

  it("returns true when current fields hash to the same value as the last entry", () => {
    const fields = { impactMetrics: [{ value: "2K+" }], achievements: [] };
    const entry = buildEntry(fields, null, "abc1234", "2026-09-07T00:00:00Z");
    expect(currentClaimsMatchLastSeal(fields, entry)).toBe(true);
  });

  it("returns false when current fields differ from what was last sealed", () => {
    const sealed = buildEntry(
      { impactMetrics: [{ value: "2K+" }], achievements: [] },
      null,
      "abc1234",
      "2026-09-07T00:00:00Z",
    );
    const changed = { impactMetrics: [{ value: "5K+" }], achievements: [] };
    expect(currentClaimsMatchLastSeal(changed, sealed)).toBe(false);
  });
});
