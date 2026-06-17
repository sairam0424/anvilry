import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Validation contract for /api/error — the same-origin browser error sink.
 *
 * Mock strategy (vi.hoisted): we capture every emit() call into a shared array so the
 * tests can assert on the exact TelemetryEvent envelope the route synthesizes. The
 * rate-limiter is mocked to ok-by-default with a single overridable flag, the way the
 * tts-google suite does it. withTrace is mocked to a passthrough that injects a fake
 * TraceCtx — withTrace's own behavior is pinned in src/lib/telemetry/with-trace.test.ts;
 * here we only care about THIS route's logic (validation, redaction, emission shape).
 *
 * vi.hoisted is REQUIRED because vi.mock factories run before module-scope code. The
 * factory needs the same array reference the test bodies read; a plain `const events
 * = []` declared at top scope would be undefined when the factory runs.
 */

const { emitCalls, rateLimitState } = vi.hoisted(() => ({
  emitCalls: [] as Array<Record<string, unknown>>,
  rateLimitState: { ok: true as boolean, retryAfter: 0 },
}));

vi.mock("@/lib/telemetry/emit", () => ({
  emit: vi.fn((event: Record<string, unknown>) => {
    emitCalls.push(event);
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() =>
    Promise.resolve(
      rateLimitState.ok
        ? { ok: true as const }
        : { ok: false as const, retryAfter: rateLimitState.retryAfter },
    ),
  ),
}));

// Passthrough withTrace — call the handler with a fake ctx, return its result. We
// stamp synthetic trace/span ids so the route's emit() call has a recognizable parent
// chain to assert on. Real withTrace behavior (UUIDs, header stamping, http.request
// span) is covered in with-trace.test.ts; not our concern here.
vi.mock("@/lib/telemetry/with-trace", () => ({
  withTrace: vi.fn(
    async (
      _req: Request,
      _route: string,
      handler: (ctx: {
        traceId: string;
        spanId: string;
        startedAt: number;
        ipHash: string;
        uaHash: string;
        attrs: (extra: Record<string, unknown>) => void;
      }) => Promise<Response>,
    ) => {
      const ctx = {
        traceId: "test-trace-id",
        spanId: "test-span-id",
        startedAt: Date.now(),
        ipHash: "test-ip-hash",
        uaHash: "test-ua-hash",
        attrs: vi.fn(),
      };
      return handler(ctx);
    },
  ),
}));

let POST: (req: Request) => Promise<Response>;

async function importRoute() {
  vi.resetModules();
  const mod = await import("./route");
  POST = mod.POST;
}

beforeEach(async () => {
  emitCalls.length = 0;
  rateLimitState.ok = true;
  rateLimitState.retryAfter = 0;
  delete process.env.TELEMETRY_ENABLED;
  await importRoute();
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Minimal valid payload — every test mutates from this. */
function validPayload() {
  return {
    message: "TypeError: Cannot read properties of undefined",
    source: "boundary" as const,
    url: "https://anvilry.test/notes/foo",
    userAgent: "Mozilla/5.0 (Macintosh)",
    stack: "Error\n    at Component (notes.tsx:42:7)",
  };
}

function makeReq(body: unknown, contentLengthOverride?: number): Request {
  const json = JSON.stringify(body);
  return new Request("http://localhost/api/error", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(contentLengthOverride ?? json.length),
    },
    body: json,
  });
}

describe("/api/error — happy path", () => {
  it("returns 204 and emits exactly one client.error event for a valid payload", async () => {
    const res = await POST(makeReq(validPayload()));
    expect(res.status).toBe(204);
    expect(emitCalls).toHaveLength(1);

    const evt = emitCalls[0]!;
    expect(evt.kind).toBe("client.error");
    expect(evt.route).toBe("/api/error");
    expect(evt.level).toBe("error");
    expect(typeof evt.ts).toBe("number");
    expect(evt.traceId).toBe("test-trace-id");
    expect(evt.parentSpanId).toBe("test-span-id");
    // spanId is a fresh randomUUID — should NOT equal the parent.
    expect(evt.spanId).not.toBe("test-span-id");
    expect(typeof evt.spanId).toBe("string");

    const attrs = evt.attrs as Record<string, unknown>;
    expect(attrs.source).toBe("boundary");
    expect(attrs.url).toBe("https://anvilry.test/notes/foo");
    expect(attrs.userAgent).toBe("Mozilla/5.0 (Macintosh)");
    expect(typeof attrs.stack).toBe("string");
  });

  it("defaults level to 'error' when omitted from the body", async () => {
    const body = validPayload();
    // level deliberately omitted — Zod default kicks in.
    const res = await POST(makeReq(body));
    expect(res.status).toBe(204);
    expect(emitCalls[0]!.level).toBe("error");
  });

  it("preserves level='warn' when explicitly set", async () => {
    const res = await POST(makeReq({ ...validPayload(), level: "warn" }));
    expect(res.status).toBe(204);
    expect(emitCalls[0]!.level).toBe("warn");
  });
});

describe("/api/error — Zod validation rejects bad input with 400", () => {
  it("400 when 'message' is missing", async () => {
    const { message: _, ...rest } = validPayload();
    void _;
    const res = await POST(makeReq(rest));
    expect(res.status).toBe(400);
    expect(emitCalls).toHaveLength(0);
  });

  it("400 when 'source' is missing", async () => {
    const { source: _, ...rest } = validPayload();
    void _;
    const res = await POST(makeReq(rest));
    expect(res.status).toBe(400);
    expect(emitCalls).toHaveLength(0);
  });

  it("400 when 'source' is not in the allowed enum", async () => {
    const res = await POST(makeReq({ ...validPayload(), source: "made-up-source" }));
    expect(res.status).toBe(400);
    expect(emitCalls).toHaveLength(0);
  });

  it("400 on malformed JSON body", async () => {
    const req = new Request("http://localhost/api/error", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "10" },
      body: "{not json!",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(emitCalls).toHaveLength(0);
  });
});

describe("/api/error — content-length cap", () => {
  it("413 when content-length exceeds 8KB (declared, before reading body)", async () => {
    // We set the header to 9000; the actual body is irrelevant — the header check
    // short-circuits before req.json() runs, which is the point (don't burn memory
    // on a payload the client claims is huge).
    const res = await POST(makeReq(validPayload(), 9000));
    expect(res.status).toBe(413);
    expect(emitCalls).toHaveLength(0);
  });
});

describe("/api/error — operational gates", () => {
  it("returns 204 with NO emit when TELEMETRY_ENABLED=false (opt-out)", async () => {
    process.env.TELEMETRY_ENABLED = "false";
    await importRoute(); // re-import: route reads env at call time but resetModules clears mock state
    const res = await POST(makeReq(validPayload()));
    expect(res.status).toBe(204);
    expect(emitCalls).toHaveLength(0);
  });

  it("returns 429 with Retry-After when rate-limit denies", async () => {
    rateLimitState.ok = false;
    rateLimitState.retryAfter = 17;
    const res = await POST(makeReq(validPayload()));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("17");
    expect(emitCalls).toHaveLength(0);
  });
});

describe("/api/error — PII redaction before emit", () => {
  it("scrubs emails and tokens from message + stack before the event lands in emit()", async () => {
    // The visitor pasted an API key and an email into chat; the resulting thrown
    // error carries both into the message AND into the stack frame. redact() must
    // run before emit() — the trace log MUST NOT contain the raw secret.
    //
    // TOKEN_RE matches alphanumeric runs of 32+ chars (see schema.ts:88). The
    // fake-token fixture is built via .repeat() — a single hand-typed long literal
    // would trip the project's secret-scan hook, AND a JWT-shaped fixture splits on
    // '.' into sub-32-char segments that the redactor (correctly) ignores.
    const fakeToken = "x".repeat(40);
    const fakeKey = `sk-${"a".repeat(32)}`;
    const leakyMessage = `Auth failed for user@example.com using key ${fakeKey}`;
    const leakyStack = `Error: bad creds\n    at fetchUser (auth.ts:1) bearer ${fakeToken}`;

    const res = await POST(
      makeReq({
        ...validPayload(),
        message: leakyMessage,
        stack: leakyStack,
      }),
    );
    expect(res.status).toBe(204);
    expect(emitCalls).toHaveLength(1);

    const evt = emitCalls[0]!;
    const emittedMessage = evt.message as string;
    const emittedStack = (evt.attrs as Record<string, unknown>).stack as string;

    // The redactor's contract: emails -> [email], long alphanumeric runs -> [redacted-token].
    // We assert the secrets are GONE and the redaction sentinels are present.
    expect(emittedMessage).not.toContain("user@example.com");
    expect(emittedMessage).not.toContain(fakeKey);
    expect(emittedMessage).toContain("[email]");
    expect(emittedMessage).toContain("[redacted-token]");

    expect(emittedStack).not.toContain(fakeToken);
    expect(emittedStack).toContain("[redacted-token]");
  });
});
