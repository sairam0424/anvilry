/**
 * sendErrorBeacon — the ONE client-side egress for browser errors.
 *
 * Every React boundary, every window listener, every unhandledrejection funnels through
 * this function. The contract is intentionally narrow: synchronous-by-shape (no Promise
 * leaks back into render loops), never throws (telemetry must never become the bug), and
 * same-origin only (the strict CSP enforces `connect-src 'self'` — third-party error sinks
 * would silently fail on production with a CSP report and no user-facing recovery).
 *
 * Why sendBeacon over fetch as the PRIMARY path:
 *   1) sendBeacon is queued by the browser and survives `pagehide` / `unload` — fetch
 *      WITHOUT keepalive is canceled on navigation, which is exactly when a fatal error
 *      most often happens (the user is leaving the broken page).
 *   2) sendBeacon ignores response — there's nothing useful for the client to do with a
 *      200 from /api/error anyway. Fewer event-loop turns, less memory, no Promise.
 *   3) The fetch fallback uses `keepalive: true` so it has the same survives-unload
 *      behavior on browsers where sendBeacon is missing or returns false (queue full).
 *
 * Why we wrap the body in a Blob with type "application/json":
 *   sendBeacon defaults to text/plain (and refuses application/* content types unless the
 *   payload is a Blob). The /api/error route uses req.json() under the hood (Next 16's
 *   Request body parser) — text/plain trips through but the route loses its declarative
 *   schema. Sending as a JSON Blob keeps the route's contract symmetric with /api/chat
 *   et al. and CSP doesn't have a content-type axis to worry about.
 */

export type ErrorBeaconPayload = {
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  level?: "error" | "warn";
  /**
   * Where the error was caught. Maps 1:1 to the server-side `kind` taxonomy in
   * schema.ts so /api/error can route attrs without reflection:
   *   - "boundary"          — Next 16 route-segment error.tsx (per-page boundary)
   *   - "global-boundary"   — Next 16 global-error.tsx (root, layout has unwound)
   *   - "window"            — window.addEventListener("error") (raw uncaught)
   *   - "unhandledrejection" — window.addEventListener("unhandledrejection")
   *   - "react19"           — React 19's onUncaughtError / onCaughtError (future hook)
   */
  source: "boundary" | "global-boundary" | "window" | "unhandledrejection" | "react19";
  componentStack?: string;
};

/**
 * Same-origin beacon target. Hard-coded rather than env-configurable because:
 *   1) CSP `connect-src 'self'` would block any other origin anyway — making this
 *      configurable would be a footgun (a misconfigured deploy silently loses errors).
 *   2) The /api/error route is the contract; if it moves, every caller moves with it.
 */
const BEACON_URL = "/api/error";

/**
 * Fire-and-forget client-side error report. NEVER awaits, NEVER throws, NEVER returns
 * a rejected Promise. Failure modes (sendBeacon false, fetch reject, JSON encode throw)
 * are all swallowed at the outermost catch — the user-facing UX must NOT regress when
 * telemetry is degraded.
 *
 * Returns void deliberately: callers (error boundaries, window listeners) live in
 * synchronous render/event paths where surfacing a Promise would invite unhandled
 * rejection chains and recursion through the same listener that just fired.
 */
export function sendErrorBeacon(payload: ErrorBeaconPayload): void {
  try {
    // SSR-safety: this module is dynamically imported by instrumentation-client.ts only
    // when `typeof window !== "undefined"`, but error.tsx renders during a partial SSR
    // pass in some Next 16 dev paths. Bail early if there's no browser context.
    if (typeof window === "undefined" || typeof navigator === "undefined") return;

    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: "application/json" });

    // Primary path: sendBeacon. Returns true if the user-agent successfully queued the
    // request for delivery; returns false when the queue is full (rare, e.g. dozens of
    // beacons in a tight loop — we treat that as "fall back to fetch").
    if (typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(BEACON_URL, blob);
      if (queued) return;
    }

    // Fallback: keepalive fetch. `keepalive: true` lets the request outlive page unload,
    // mirroring sendBeacon's primary durability guarantee. We don't await — the response
    // body is irrelevant and awaiting would re-introduce the Promise leak this contract
    // disallows. The .catch is required so an offline failure doesn't bubble as an
    // unhandled rejection (which would re-fire window.addEventListener("unhandledrejection"),
    // recursing right back into us).
    void fetch(BEACON_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* swallow — telemetry must never break the route */
    });
  } catch {
    /* swallow — telemetry must never break the page */
  }
}
