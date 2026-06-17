/**
 * instrumentation-client.ts — Next 16 client-side instrumentation hook.
 *
 * Next 16 special filename (sibling to src/app/, not inside it). Loaded by Next AFTER
 * the HTML document is parsed but BEFORE React hydration, exactly once per page load.
 * The module body executes immediately on import — there is no exported function for
 * the "register listeners" path; the framework's contract is "side-effects at module
 * load are run". Compare with `instrumentation.ts` (server-side), which DOES export
 * `register()` + `onRequestError()` — those are server-only and have no client analog.
 *
 * What we register:
 *   1) window "error"              — raw script errors that escape every React boundary
 *                                     (event handlers, Promise.then synchronous throws,
 *                                     setTimeout callbacks, pre-hydration vendor scripts).
 *   2) window "unhandledrejection" — Promises that rejected with no .catch(). React 19
 *                                     swallows some of these into onCaughtError; many
 *                                     still surface here (network failures in user code,
 *                                     dynamic-import failures, etc.).
 *
 * Why this file exists in addition to error.tsx + global-error.tsx:
 *   The Next file-convention boundaries only catch errors thrown DURING render. They
 *   miss everything in event handlers, timers, microtasks, and orphaned Promises —
 *   which together account for the majority of production browser errors. The window
 *   listeners are the safety net under the React safety net.
 *
 * DEDUPE — the most subtle bit:
 *   When error.tsx catches a render error, React internally re-throws it to the next
 *   boundary up; depending on the React version + dev/prod mode, the same Error can
 *   ALSO surface to window.onerror milliseconds later. If we beacon both, /api/error
 *   sees doubles. The fix is a tiny global flag the boundaries set BEFORE they beacon:
 *
 *     window.__anvilry_error_recently__ = Date.now()
 *
 *   The window listener checks "did a boundary just fire?" within a 100ms window and
 *   suppresses if so. 100ms is loose enough to absorb React's re-throw latency on
 *   slow devices, tight enough that two genuinely independent errors 200ms apart still
 *   both report. Implemented as a Date.now() timestamp rather than a boolean so we
 *   don't have to manage a setTimeout cleanup (which would itself add an event-loop
 *   turn and create the very race we're trying to avoid).
 */

// SSR-safety: Next is supposed to never SSR this file (it's the CLIENT instrumentation
// hook). Belt-and-suspenders: the dynamic import + the window guard mean if anyone ever
// re-points a bundler config at it from the server, the import simply no-ops instead of
// crashing the build with "navigator is not defined".
if (typeof window !== "undefined") {
  // Dynamic import keeps the beacon module out of the SSR bundle entirely. A static
  // import would tree-shake fine in practice, but a dynamic import is the load-bearing
  // contract: this file MUST be importable from a Node-y context without dragging
  // window-touching code into evaluation.
  import("@/lib/telemetry/beacon").then(({ sendErrorBeacon }) => {
    /**
     * Dedupe window — see the file-level docblock for rationale. 100ms suppresses the
     * React-internal re-throw race; longer would risk swallowing legitimately distinct
     * errors that happen to fire shortly after a boundary recovery.
     */
    const DEDUPE_MS = 100;

    function recentlyHandledByBoundary(): boolean {
      const w = window as unknown as { __anvilry_error_recently__?: number };
      const ts = w.__anvilry_error_recently__;
      if (typeof ts !== "number") return false;
      return Date.now() - ts < DEDUPE_MS;
    }

    window.addEventListener("error", (e: ErrorEvent) => {
      if (recentlyHandledByBoundary()) return;
      sendErrorBeacon({
        source: "window",
        message: e.message ?? "unknown error",
        stack: e.error instanceof Error ? e.error.stack : undefined,
        url: window.location.href,
        userAgent: navigator.userAgent,
        level: "error",
      });
    });

    window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
      if (recentlyHandledByBoundary()) return;
      // Promise rejection reasons are unknown by spec — anything throwable. Narrow:
      //   - Error instance      → use .message + .stack
      //   - object with .message → use that string
      //   - primitive/string    → String() coerce
      //   - undefined/null      → fall back literal
      const reason: unknown = e.reason;
      let message = "unhandled rejection";
      let stack: string | undefined;
      if (reason instanceof Error) {
        message = reason.message || message;
        stack = reason.stack;
      } else if (reason && typeof reason === "object" && "message" in reason) {
        const m = (reason as { message?: unknown }).message;
        if (typeof m === "string" && m.length > 0) message = m;
        const s = (reason as { stack?: unknown }).stack;
        if (typeof s === "string") stack = s;
      } else if (reason !== undefined && reason !== null) {
        message = String(reason);
      }

      sendErrorBeacon({
        source: "unhandledrejection",
        message,
        stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        level: "error",
      });
    });
  });
}
