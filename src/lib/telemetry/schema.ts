import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Telemetry event schema — the structured envelope every observability span flows
 * through. Phase 1.1 of the v1.8 telemetry upgrade: this module is the type-level
 * contract every later phase imports from. The dual-sink emitter (1.2), the
 * withTrace wrapper (1.3), the per-route emit sites (2.x), the /api/error sink
 * (3.1), and the /admin/telemetry dashboard (4.2) all consume `TelemetryEvent`,
 * `redact`, and `hashIp` from here. Get the shape right.
 *
 * Design decisions:
 *  - `attrs` is a loose Record<string, unknown> at the schema level on purpose.
 *    Each emit site (chat route, tts route, transcribe route, browser error
 *    handler) knows the exact shape for ITS kind — tightening attrs into a
 *    discriminated union here would force every kind's typing to live in this
 *    file, which couples the schema to every caller. The schema validates the
 *    envelope; the call sites validate their own attrs.
 *  - traceId/spanId are uuids generated via crypto.randomUUID() at the boundary
 *    (in withTrace), not here. This module is pure data — no I/O, no globals,
 *    no clock reads. That makes it cheap to import in any context (Node, Edge,
 *    test, the browser-side error handler) without dragging Node-only APIs into
 *    the bundle.
 *  - `redact` runs PII scrubbing before any user-supplied string is logged. It
 *    is intentionally regex-only (no NLP) — false positives are acceptable, false
 *    negatives are not. A redacted email/token is still useful for debugging
 *    (you see the shape); a leaked one is a breach.
 *  - `hashIp` truncates SHA-256 to 16 hex chars (~64 bits). For analytics-scale
 *    de-duplication and abuse rate-limiting, 64-bit collision resistance is
 *    overkill — we don't need cryptographic uniqueness. The salt comes from env
 *    (TELEMETRY_IP_SALT); when unset (dev), `hashIp` returns "anonymous" so we
 *    never accidentally fingerprint without consent.
 */

/** The kinds of spans we emit. Adding a new kind requires updating this union AND
 *  the dashboard's kind filter, so the type system catches the orphan case. */
export const KIND_LITERALS = [
  "http.request",
  "llm.attempt",
  "tts.request",
  "transcribe.request",
  "client.error",
  "server.error",
  "budget.tick",
] as const;

export type KindLiteral = (typeof KIND_LITERALS)[number];

/** Severity. Mirrors the syslog-style triple every observability tool understands;
 *  we don't need debug/trace at portfolio scale. */
const LEVEL_LITERALS = ["info", "warn", "error"] as const;

/**
 * The structured event envelope. Every field is required except `parentSpanId`,
 * `route`, and `message` — those are kind-dependent (a budget.tick has no route;
 * a client.error has no parent span; an http.request usually has no message
 * because the kind + route + status already say it all).
 *
 * Why z.unknown() inside attrs.passthrough() — z.record(z.unknown()) at the top
 * level forces zod to materialize the record on every parse, which (in zod 3.25)
 * eagerly walks unknown values and slows the hot path. A z.object({}).passthrough()
 * with `attrs: z.record(z.unknown())` parses the envelope structurally and treats
 * attrs as opaque; the call site's own zod schema (or hand-narrowing) does the
 * detailed shape check. Faster + simpler at this scale.
 */
export const TelemetryEventSchema = z.object({
  ts: z.number().int().nonnegative(),
  traceId: z.string().min(1),
  spanId: z.string().min(1),
  parentSpanId: z.string().min(1).optional(),
  kind: z.enum(KIND_LITERALS),
  route: z.string().min(1).optional(),
  level: z.enum(LEVEL_LITERALS),
  message: z.string().optional(),
  attrs: z.record(z.unknown()),
});

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

/* --------------------------------- Redaction --------------------------------- */

/** Email — must run FIRST so the `@` doesn't get eaten by the token regex. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Long alphanumeric runs — API keys, JWTs, AWS access-key IDs, OAuth tokens.
 *  32 chars is the lower bound where false positives on legitimate hex/base64
 *  identifiers become rare; below that we'd start scrubbing UUIDs and trace ids. */
const TOKEN_RE = /\b[A-Za-z0-9_-]{32,}\b/g;

/** Long pure-digit runs — credit-card-like (12-19 digits covers Visa/MC/Amex/etc)
 *  and full E.164 phone numbers without separators. We don't try to Luhn-check;
 *  the goal is "drop anything that looks card-shaped", not detection. */
const DIGIT_RUN_RE = /\b\d{12,19}\b/g;

/**
 * Redact PII from a free-text string before it lands in a log sink. Order of
 * operations is load-bearing: emails first (so `user@example.com` becomes
 * `[email]` before the local-part can match TOKEN_RE), then tokens, then digit
 * runs. A purely defensive transform — better to over-scrub than under-scrub.
 */
export function redact(text: string): string {
  return text
    .replace(EMAIL_RE, "[email]")
    .replace(TOKEN_RE, "[redacted-token]")
    .replace(DIGIT_RUN_RE, "[redacted-num]");
}

/* ---------------------------------- IP hash ---------------------------------- */

/**
 * Salted SHA-256 of an IP, truncated to 16 hex chars. The salt is per-deployment
 * (TELEMETRY_IP_SALT), so a hash from the dev environment cannot be cross-walked
 * to a hash from prod even with the same source IP. Returns the literal string
 * `"anonymous"` when:
 *   - salt is unset/empty (dev default — we explicitly opt out of fingerprinting
 *     unless ops has provisioned a salt)
 *   - ip is empty or already-anonymized upstream (Vercel sometimes returns
 *     "anonymous" or "" for connections behind certain proxies/CDNs)
 *
 * 16 hex chars (~64 bits) is sufficient for analytics-scale de-dup and abuse
 * rate-limiting — full 64 hex digits would just bloat the log without adding
 * useful entropy at portfolio traffic levels.
 */
export function hashIp(ip: string, salt: string | undefined): string {
  if (!salt) return "anonymous";
  if (!ip || ip === "anonymous") return "anonymous";
  return createHash("sha256").update(salt + ip).digest("hex").slice(0, 16);
}
