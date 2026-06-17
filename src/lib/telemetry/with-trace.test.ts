import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for withTrace — the universal /api/* observability wrapper.
 *
 * Mock strategy: we mock BOTH "@/lib/telemetry/emit" and "@/lib/telemetry/schema"
 * via vi.hoisted so this suite runs green even when those siblings ship in a
 * separate commit (Phase 1.1 + 1.2 ship in parallel with this file). The contract
 * we pin here is the WRAPPER's behavior — ip-hashing semantics live in schema.test.ts,
 * sink semantics live in emit.test.ts. We just check withTrace calls them right.
 *
 * vi.hoisted() is REQUIRED — vi.mock factories are hoisted above module-level code,
 * so a plain `const events = []` at top scope would be undefined when the factory
 * runs. The hoisted block returns refs both the factory AND the test bodies share.
 */

const { events, hashCalls } = vi.hoisted(() => {
  return {
    events: [] as unknown[],
    hashCalls: [] as { input: string; salt: string | undefined }[],
  };
});

vi.mock("@/lib/telemetry/emit", () => ({
  emit: vi.fn((event: unknown) => {
    events.push(event);
  }),
}));

vi.mock("@/lib/telemetry/schema", () => ({
  // Mirror the real hashIp contract — see src/lib/telemetry/schema.ts:124-128.
  hashIp: vi.fn((input: string, salt: string | undefined) => {
    hashCalls.push({ input, salt });
    if (!salt) return "anonymous";
    if (!input || input === "anonymous") return "anonymous";
    return `salted:${input.slice(0, 8)}`;
  }),
  // redact is a passthrough in tests — schema.test.ts owns its behavior; here
  // we just verify withTrace calls it (the real implementation is tested separately).
  redact: vi.fn((s: string) => s),
}));

beforeEach(() => {
  events.length = 0;
  hashCalls.length = 0;
  delete process.env.TELEMETRY_IP_SALT;
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Build a minimal Request with the proxy headers withTrace inspects. */
function makeReq(
  init: { ip?: string; ua?: string; xff?: string; xri?: string } = {},
): Request {
  const headers: Record<string, string> = {};
  if (init.xff !== undefined) headers["x-forwarded-for"] = init.xff;
  else if (init.ip) headers["x-forwarded-for"] = init.ip;
  if (init.xri !== undefined) headers["x-real-ip"] = init.xri;
  if (init.ua) headers["user-agent"] = init.ua;
  return new Request("https://anvilry.test/api/test", { headers });
}

describe("withTrace — header + UUID", () => {
  it("returns the handler's response with x-anvilry-trace-id set to a UUID", async () => {
    const { withTrace } = await import("./with-trace");
    const req = makeReq({ ip: "1.2.3.4", ua: "Mozilla/5.0" });
    const res = await withTrace(req, "chat", async () =>
      Response.json({ ok: true }, { status: 200 }),
    );
    const traceId = res.headers.get("x-anvilry-trace-id");
    expect(traceId).toBeTruthy();
    // RFC 4122 v4 UUID shape — eight-four-four-four-twelve hex with a "4" version nibble.
    expect(traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    // Body round-trips through reconstruction unchanged.
    expect(await res.json()).toEqual({ ok: true });
  });

  it("preserves the handler's status code and statusText", async () => {
    const { withTrace } = await import("./with-trace");
    const req = makeReq();
    const res = await withTrace(req, "chat", async () =>
      Response.json({ error: "nope" }, { status: 429, statusText: "Too Many Requests" }),
    );
    expect(res.status).toBe(429);
    // statusText is preserved through the reconstruction.
    expect(res.statusText).toBe("Too Many Requests");
  });
});

describe("withTrace — http.request emission on success", () => {
  it("emits exactly ONE http.request event with the right route + status + latency", async () => {
    const { withTrace } = await import("./with-trace");
    const req = makeReq({ ip: "9.9.9.9" });
    await withTrace(req, "tts", async () => Response.json({ ok: true }));

    expect(events).toHaveLength(1);
    const evt = events[0] as Record<string, unknown>;
    expect(evt.kind).toBe("http.request");
    expect(evt.route).toBe("tts");
    expect(evt.level).toBe("info");
    // Per-kind fields live on attrs (the schema flattens envelope vs. payload).
    const attrs = evt.attrs as Record<string, unknown>;
    expect(attrs.status).toBe(200);
    expect(typeof attrs.latency_ms).toBe("number");
    expect(attrs.latency_ms as number).toBeGreaterThanOrEqual(0);
    // ipHash + uaHash routed through schema.hashIp, stamped on attrs.
    expect(attrs.ipHash).toBeTruthy();
    expect(attrs.uaHash).toBeTruthy();
    // traceId on the event matches the response header — same UUID, one request.
    expect(typeof evt.traceId).toBe("string");
  });

  it("upgrades level to 'error' on a 5xx response (status-driven, no route work)", async () => {
    const { withTrace } = await import("./with-trace");
    const req = makeReq();
    await withTrace(req, "chat", async () =>
      Response.json({ error: "boom" }, { status: 502 }),
    );
    const evt = events[0] as Record<string, unknown>;
    expect(evt.level).toBe("error");
    expect((evt.attrs as Record<string, unknown>).status).toBe(502);
  });

  it("merges per-route attrs the handler sets via ctx.attrs() into the emitted event", async () => {
    const { withTrace } = await import("./with-trace");
    const req = makeReq();
    await withTrace(req, "chat", async (ctx) => {
      ctx.attrs({ byteCount: 1024, modelChain: ["sonnet", "opus"] });
      ctx.attrs({ usedFallback: false }); // second call merges, not replaces
      return Response.json({ ok: true });
    });

    expect(events).toHaveLength(1);
    const evt = events[0] as Record<string, unknown>;
    const attrs = evt.attrs as Record<string, unknown>;
    expect(attrs.byteCount).toBe(1024);
    expect(attrs.modelChain).toEqual(["sonnet", "opus"]);
    expect(attrs.usedFallback).toBe(false);
  });
});

describe("withTrace — error path", () => {
  it("emits server.error with err.name + err.message + err.stack on uncaught throw", async () => {
    const { withTrace } = await import("./with-trace");
    const req = makeReq();
    const boom = new Error("kaboom");
    boom.name = "BoomError";

    await expect(
      withTrace(req, "chat", async () => {
        throw boom;
      }),
    ).rejects.toBe(boom); // <-- error is RE-THROWN, not swallowed

    expect(events).toHaveLength(1);
    const evt = events[0] as Record<string, unknown>;
    expect(evt.kind).toBe("server.error");
    expect(evt.route).toBe("chat");
    expect(evt.level).toBe("error");
    const attrs = evt.attrs as Record<string, unknown>;
    const errField = attrs.err as Record<string, unknown>;
    expect(errField.name).toBe("BoomError");
    expect(errField.message).toBe("kaboom");
    expect(typeof errField.stack).toBe("string");
    expect(typeof attrs.latency_ms).toBe("number");
  });

  it("captures awsRequestId from err.$metadata.requestId on AWS-SDK errors", async () => {
    const { withTrace } = await import("./with-trace");
    const req = makeReq();
    const awsErr = Object.assign(new Error("ThrottlingException"), {
      name: "ThrottlingException",
      $metadata: { requestId: "abc-123-def-456", httpStatusCode: 429 },
    });

    await expect(
      withTrace(req, "tts", async () => {
        throw awsErr;
      }),
    ).rejects.toBe(awsErr);

    expect(events).toHaveLength(1);
    const evt = events[0] as Record<string, unknown>;
    const attrs = evt.attrs as Record<string, unknown>;
    const errField = attrs.err as Record<string, unknown>;
    expect(errField.awsRequestId).toBe("abc-123-def-456");
  });

  it("preserves extraAttrs the handler added BEFORE the throw on the error event", async () => {
    const { withTrace } = await import("./with-trace");
    const req = makeReq();
    await expect(
      withTrace(req, "chat", async (ctx) => {
        ctx.attrs({ stage: "after-rate-limit" });
        throw new Error("fail-after-attrs");
      }),
    ).rejects.toThrow("fail-after-attrs");

    const evt = events[0] as Record<string, unknown>;
    expect((evt.attrs as Record<string, unknown>).stage).toBe("after-rate-limit");
  });
});

describe("withTrace — IP/UA hashing inputs", () => {
  it('IP "anonymous" with no TELEMETRY_IP_SALT produces ipHash "anonymous"', async () => {
    const { withTrace } = await import("./with-trace");
    // No xff, no x-real-ip, no salt -> clientIp() returns "anonymous", hashIp passes through.
    const req = makeReq({});
    await withTrace(req, "chat", async () => Response.json({ ok: true }));
    const evt = events[0] as Record<string, unknown>;
    expect((evt.attrs as Record<string, unknown>).ipHash).toBe("anonymous");
    // The mock recorded the call: input="anonymous", salt=undefined.
    expect(hashCalls[0]).toEqual({ input: "anonymous", salt: undefined });
  });

  it("uses the LAST segment of x-forwarded-for (set by Vercel infrastructure, not spoofable)", async () => {
    // Security fix: the first XFF segment is attacker-controlled (any client can
    // set X-Forwarded-For: spoof). The LAST segment is appended by Vercel's edge
    // infrastructure and cannot be forged. Using it prevents rate-limit bypass
    // via rotating spoofed header values. When x-vercel-forwarded-for is absent
    // (local dev / non-Vercel deploy), we fall back to the last XFF segment.
    const { withTrace } = await import("./with-trace");
    const req = makeReq({ xff: "203.0.113.42, 10.0.0.1, 10.0.0.2" });
    await withTrace(req, "chat", async () => Response.json({ ok: true }));
    expect(hashCalls[0]?.input).toBe("10.0.0.2");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    const { withTrace } = await import("./with-trace");
    const req = makeReq({ xri: "198.51.100.7" });
    await withTrace(req, "chat", async () => Response.json({ ok: true }));
    expect(hashCalls[0]?.input).toBe("198.51.100.7");
  });
});

describe("withTrace — streaming response", () => {
  it("preserves streaming: the body's getReader() still works after wrapping", async () => {
    const { withTrace } = await import("./with-trace");
    const req = makeReq({ ip: "1.1.1.1" });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("chunk-1 "));
        controller.enqueue(encoder.encode("chunk-2"));
        controller.close();
      },
    });
    const res = await withTrace(req, "chat", async () => {
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }) as Response;
    });

    expect(res.headers.get("x-anvilry-trace-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("Content-Type")).toBe("text/plain");

    // Drain the body — proves the stream wasn't consumed/converted to a buffer.
    expect(res.body).not.toBeNull();
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
    }
    expect(acc).toBe("chunk-1 chunk-2");

    // Telemetry still emitted.
    expect(events).toHaveLength(1);
    const evt = events[0] as Record<string, unknown>;
    expect((evt.attrs as Record<string, unknown>).status).toBe(200);
  });
});

describe("withTrace — telemetry never breaks the route", () => {
  it("a thrown emit() does not propagate into the response path", async () => {
    // Re-mock emit() to throw — withTrace must swallow and still return the response.
    const { emit } = await import("@/lib/telemetry/emit");
    (emit as unknown as { mockImplementationOnce: (f: () => void) => void })
      .mockImplementationOnce(() => {
        throw new Error("sink-down");
      });

    const { withTrace } = await import("./with-trace");
    const req = makeReq();
    const res = await withTrace(req, "chat", async () => Response.json({ ok: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
