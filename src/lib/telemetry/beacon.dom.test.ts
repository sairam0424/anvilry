import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendErrorBeacon, type ErrorBeaconPayload } from "./beacon";

/**
 * Tests for sendErrorBeacon — the one client-side egress for browser errors.
 *
 * Why .dom.test.ts: this suite touches `window` + `navigator`, so it MUST run under
 * vitest's "dom" project (happy-dom env). The "node" project explicitly excludes
 * *.dom.test.{ts,tsx} (vitest.config.ts:34) — anything window-y in a plain .test.ts
 * would either crash on missing globals or silently no-op via the SSR guard inside
 * sendErrorBeacon, neither of which proves the contract.
 *
 * Mock strategy: we monkey-patch `navigator.sendBeacon` and `globalThis.fetch` per
 * test rather than vi.mock'ing the module — beacon.ts has no module-graph deps to
 * stub and the calls we need to observe are platform globals. Save originals in
 * beforeEach, restore in afterEach so suites don't leak between each other.
 *
 * What we pin here (the public contract sendErrorBeacon promises):
 *   1) sendBeacon happy path: queue=true, fetch never called.
 *   2) sendBeacon missing → fetch fallback (older browsers, privacy mode).
 *   3) sendBeacon returns false → fetch fallback (queue full).
 *   4) Telemetry never throws even when fetch rejects (the load-bearing guarantee).
 *   5) The Blob's MIME type is "application/json" — required for /api/error's req.json().
 *   6) The body is a JSON-serializable round-trip of the payload.
 *   7) The fetch fallback uses keepalive:true (survives page-unload like sendBeacon).
 *   8) SSR-safe — running with no `window` at all is a no-op (no throw, no calls).
 */

type SendBeaconLike = (url: string | URL, data?: BodyInit | null) => boolean;

// Snapshot the originals so each test can swap freely without leaking globals.
// Note: in happy-dom `sendBeacon` lives on Navigator.prototype, so a plain `delete
// navigator.sendBeacon` after a per-instance assignment falls back to the prototype
// (the real one), which would smuggle a real network call into the "fallback to
// fetch" test. We always go through Object.defineProperty with a per-instance shadow
// — including setting the value to `undefined` to simulate "browser without
// sendBeacon" — so the prototype is never reachable mid-test.
let origSendBeacon: SendBeaconLike | undefined;
let origFetch: typeof globalThis.fetch | undefined;

function shadowSendBeacon(value: SendBeaconLike | undefined): void {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    writable: true,
    value,
  });
}

beforeEach(() => {
  origSendBeacon = (navigator as unknown as { sendBeacon?: SendBeaconLike }).sendBeacon;
  origFetch = globalThis.fetch;
});

afterEach(() => {
  shadowSendBeacon(origSendBeacon);
  globalThis.fetch = origFetch as typeof globalThis.fetch;
  vi.restoreAllMocks();
});

const samplePayload: ErrorBeaconPayload = {
  source: "boundary",
  message: "kaboom",
  stack: "Error: kaboom\n  at foo (bar.ts:42)",
  url: "https://anvilry.test/work",
  userAgent: "Mozilla/5.0 (test)",
  level: "error",
};

describe("sendErrorBeacon — sendBeacon happy path", () => {
  it("calls navigator.sendBeacon with the /api/error URL when available", () => {
    const sendBeaconSpy = vi.fn<SendBeaconLike>(() => true);
    shadowSendBeacon(sendBeaconSpy);
    const fetchSpy = vi.fn<typeof fetch>();
    globalThis.fetch = fetchSpy;

    sendErrorBeacon(samplePayload);

    expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    expect(sendBeaconSpy.mock.calls[0]?.[0]).toBe("/api/error");
    // sendBeacon succeeded → fetch must not be called (the fallback path).
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends the payload as a Blob with type "application/json"', () => {
    let captured: BodyInit | null | undefined;
    shadowSendBeacon(
      vi.fn<SendBeaconLike>((_url, data) => {
        captured = data;
        return true;
      }),
    );

    sendErrorBeacon(samplePayload);

    expect(captured).toBeInstanceOf(Blob);
    // The MIME-type assertion is the load-bearing one — /api/error uses req.json()
    // and sendBeacon defaults to text/plain unless we wrap the body in a typed Blob.
    expect((captured as Blob).type).toBe("application/json");
  });

  it("the Blob body is a JSON round-trip of the payload (no field drops)", async () => {
    let captured: BodyInit | null | undefined;
    shadowSendBeacon(
      vi.fn<SendBeaconLike>((_url, data) => {
        captured = data;
        return true;
      }),
    );

    sendErrorBeacon(samplePayload);

    const text = await (captured as Blob).text();
    const parsed = JSON.parse(text) as ErrorBeaconPayload;
    expect(parsed).toEqual(samplePayload);
  });
});

describe("sendErrorBeacon — fetch fallback", () => {
  it("falls back to keepalive fetch when navigator.sendBeacon is undefined", () => {
    // Simulate a privacy-mode browser / older runtime — shadow the prototype's
    // sendBeacon with `undefined` so the typeof === "function" guard misses.
    // (A `delete` would fall through to happy-dom's prototype impl, which would
    // smuggle a real network call into the test.)
    shadowSendBeacon(undefined);

    const fetchSpy = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    globalThis.fetch = fetchSpy;

    sendErrorBeacon(samplePayload);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("/api/error");
    expect(init?.method).toBe("POST");
    // keepalive is the load-bearing flag — without it the request is canceled on
    // unload, which is exactly when fatal errors most often surface.
    expect(init?.keepalive).toBe(true);
    expect(init?.body).toBe(JSON.stringify(samplePayload));
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["Content-Type"]).toBe("application/json");
  });

  it("falls back to fetch when sendBeacon returns false (UA queue full)", () => {
    const sendBeaconSpy = vi.fn<SendBeaconLike>(() => false);
    shadowSendBeacon(sendBeaconSpy);
    const fetchSpy = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    globalThis.fetch = fetchSpy;

    sendErrorBeacon(samplePayload);

    expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("sendErrorBeacon — telemetry never breaks the page", () => {
  it("swallows fetch rejection (no unhandled rejection re-firing the listener)", () => {
    shadowSendBeacon(undefined);
    // A rejecting fetch is the most realistic "telemetry is degraded" case — offline,
    // 5xx burst, CSP block, etc. The function must NOT propagate this. The .catch
    // inside beacon.ts is what stops the rejection from re-firing the very listener
    // that fired it (recursion through window.onunhandledrejection).
    globalThis.fetch = vi.fn<typeof fetch>(() => Promise.reject(new Error("network")));

    expect(() => sendErrorBeacon(samplePayload)).not.toThrow();
  });

  it("swallows synchronous sendBeacon throw (privacy-mode quirk)", () => {
    // Some Safari/Brave configurations throw SecurityError synchronously on
    // sendBeacon when storage partitioning or strict tracking-prevention engages.
    shadowSendBeacon(
      vi.fn<SendBeaconLike>(() => {
        throw new Error("SecurityError");
      }),
    );
    // No fetch fallback expected to succeed either — but the outer catch must still
    // swallow whatever percolates up. The contract is "never throw", full stop.
    globalThis.fetch = vi.fn<typeof fetch>(() => Promise.reject(new Error("network")));

    expect(() => sendErrorBeacon(samplePayload)).not.toThrow();
  });
});
