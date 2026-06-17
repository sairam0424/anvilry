import { describe, it, expect } from "vitest";
import {
  KIND_LITERALS,
  TelemetryEventSchema,
  hashIp,
  redact,
  type KindLiteral,
  type TelemetryEvent,
} from "./schema";

/**
 * Schema + redactor + ip-hasher tests. Pure-logic only (no DOM, no I/O), so the
 * 'node' Vitest project picks them up. The schema is the type-level contract
 * every later telemetry phase imports from — a regression here corrupts every
 * downstream emitter, so we exercise every kind, every required-field rejection,
 * and every PII-scrub branch.
 */

// Synthetic 32-char fake-token strings used in the redactor tests. Built from
// repeated benign letters (no real secret prefix) so the secret scanner doesn't
// flag them — the redactor only cares about LENGTH + character class, not which
// specific letters appear, so these exercise the same regex branch as a real key.
const FAKE_TOKEN_32 = "X".repeat(32);
const FAKE_TOKEN_40 = "Y".repeat(40);

/* --------------------------------- Schema ---------------------------------- */

describe("TelemetryEventSchema.safeParse — accepts valid events", () => {
  // Build a minimal valid envelope per kind. Each kind exists for a real call site
  // (chat = llm.attempt, tts = tts.request, etc.) — if any of these fail to parse,
  // the corresponding emit site is broken.
  const baseFields = {
    ts: Date.now(),
    traceId: "trace-abc-123",
    spanId: "span-xyz-456",
    level: "info",
    attrs: {},
  } as const;

  for (const kind of KIND_LITERALS) {
    it(`accepts kind="${kind}"`, () => {
      const event = { ...baseFields, kind };
      const r = TelemetryEventSchema.safeParse(event);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.kind).toBe(kind);
    });
  }

  it("accepts an event with all optional fields populated", () => {
    const full: TelemetryEvent = {
      ts: 1_700_000_000_000,
      traceId: "t1",
      spanId: "s1",
      parentSpanId: "s0",
      kind: "llm.attempt",
      route: "/api/chat",
      level: "warn",
      message: "fell back to opus",
      attrs: { model: "claude-opus-4-6-v1", attempt: 2, fellBack: true },
    };
    expect(TelemetryEventSchema.safeParse(full).success).toBe(true);
  });
});

describe("TelemetryEventSchema.safeParse — rejects invalid events", () => {
  it("rejects when ts is missing", () => {
    const r = TelemetryEventSchema.safeParse({
      traceId: "t",
      spanId: "s",
      kind: "http.request",
      level: "info",
      attrs: {},
    });
    expect(r.success).toBe(false);
  });

  it("rejects when traceId is missing", () => {
    const r = TelemetryEventSchema.safeParse({
      ts: 1,
      spanId: "s",
      kind: "http.request",
      level: "info",
      attrs: {},
    });
    expect(r.success).toBe(false);
  });

  it("rejects when attrs is missing (must be an object, even if empty)", () => {
    const r = TelemetryEventSchema.safeParse({
      ts: 1,
      traceId: "t",
      spanId: "s",
      kind: "http.request",
      level: "info",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown kind value (string but not in the union)", () => {
    const r = TelemetryEventSchema.safeParse({
      ts: 1,
      traceId: "t",
      spanId: "s",
      kind: "telemetry.boom",
      level: "info",
      attrs: {},
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid level value", () => {
    const r = TelemetryEventSchema.safeParse({
      ts: 1,
      traceId: "t",
      spanId: "s",
      kind: "http.request",
      level: "debug", // not in {info, warn, error}
      attrs: {},
    });
    expect(r.success).toBe(false);
  });

  it("rejects when ts is negative (defense-in-depth — Date.now() is always >= 0)", () => {
    const r = TelemetryEventSchema.safeParse({
      ts: -1,
      traceId: "t",
      spanId: "s",
      kind: "http.request",
      level: "info",
      attrs: {},
    });
    expect(r.success).toBe(false);
  });
});

/* -------------------------------- KindLiteral -------------------------------- */

describe("KindLiteral type export", () => {
  it("includes the seven canonical kinds", () => {
    // Compile-time check: this assignment is only valid if KindLiteral is the
    // union we expect. The runtime expectation also guards against accidental
    // re-ordering of KIND_LITERALS.
    const allowed: KindLiteral[] = [
      "http.request",
      "llm.attempt",
      "tts.request",
      "transcribe.request",
      "client.error",
      "server.error",
      "budget.tick",
    ];
    expect(allowed).toEqual([...KIND_LITERALS]);
  });
});

/* ---------------------------------- redact ---------------------------------- */

describe("redact()", () => {
  it("strips a bare email", () => {
    expect(redact("contact me at user@example.com please")).toBe(
      "contact me at [email] please",
    );
  });

  it("strips multiple emails in one string", () => {
    expect(redact("from a@b.co to c.d@e.io")).toBe("from [email] to [email]");
  });

  it("strips a long alphanumeric token (32+ chars)", () => {
    const out = redact(`key=${FAKE_TOKEN_40}`);
    expect(out).not.toMatch(/[A-Za-z0-9]{32,}/);
    expect(out).toContain("[redacted-token]");
  });

  it("strips a long digit run (card-shaped)", () => {
    expect(redact("card 4111111111111111 expires soon")).toBe(
      "card [redacted-num] expires soon",
    );
  });

  it("scrubs email + token in the same string with email-first ordering", () => {
    // Composite test mirrors the task brief. The email local-part `user` would
    // otherwise be eligible for nothing, but the email regex is greedy through
    // the @ — verifying the email vanishes AND the separate 32-char run vanishes
    // proves the ordering is correct (token regex runs AFTER email regex).
    const out = redact(`user@example.com posted ${FAKE_TOKEN_32} to channel`);
    expect(out).not.toMatch(/@/);
    expect(out).not.toMatch(/\b[A-Za-z0-9_-]{32,}\b/);
    expect(out).toContain("[email]");
    expect(out).toContain("[redacted-token]");
  });

  it("leaves short text intact", () => {
    expect(redact("hi")).toBe("hi");
    expect(redact("hello world")).toBe("hello world");
  });

  it("leaves short alphanumeric tokens intact (UUIDs, trace ids)", () => {
    // 31 chars — one shy of the 32-char threshold. This guards against scrubbing
    // legitimate trace ids (~26-31 chars) that we explicitly want to preserve.
    const safe = "a".repeat(31);
    expect(redact(`trace ${safe} done`)).toBe(`trace ${safe} done`);
  });

  it("leaves short digit runs intact (timestamps, ports, status codes)", () => {
    // 11 digits — one shy of the 12-digit threshold. Vercel timestamps and
    // millisecond epochs commonly land here; we don't want to scrub them.
    expect(redact("port 8080 status 200 epoch 17000000000")).toBe(
      "port 8080 status 200 epoch 17000000000",
    );
  });
});

/* ---------------------------------- hashIp ---------------------------------- */

describe("hashIp()", () => {
  it("returns 16 hex chars for a real ip + salt", () => {
    const out = hashIp("192.168.1.42", "test-salt");
    expect(out).toMatch(/^[0-9a-f]{16}$/);
  });

  it("returns 'anonymous' when salt is undefined", () => {
    expect(hashIp("192.168.1.42", undefined)).toBe("anonymous");
  });

  it("returns 'anonymous' when salt is empty string", () => {
    expect(hashIp("192.168.1.42", "")).toBe("anonymous");
  });

  it("returns 'anonymous' when ip is empty", () => {
    expect(hashIp("", "test-salt")).toBe("anonymous");
  });

  it("returns 'anonymous' when ip is the literal 'anonymous' (already-anonymized upstream)", () => {
    expect(hashIp("anonymous", "test-salt")).toBe("anonymous");
  });

  it("is deterministic — same ip + salt yields the same hash", () => {
    const a = hashIp("203.0.113.7", "salt-v1");
    const b = hashIp("203.0.113.7", "salt-v1");
    expect(a).toBe(b);
  });

  it("different IPs with the same salt produce different hashes", () => {
    const a = hashIp("203.0.113.7", "salt-v1");
    const b = hashIp("203.0.113.8", "salt-v1");
    expect(a).not.toBe(b);
  });

  it("same IP with different salts produces different hashes (per-deployment isolation)", () => {
    const a = hashIp("203.0.113.7", "salt-dev");
    const b = hashIp("203.0.113.7", "salt-prod");
    expect(a).not.toBe(b);
  });
});
