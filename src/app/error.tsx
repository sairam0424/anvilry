"use client";

/**
 * error.tsx — Next 16 route-segment error boundary.
 *
 * Wraps every page and nested layout below the root layout in a React Error Boundary.
 * Does NOT catch errors thrown inside src/app/layout.tsx itself — that's global-error.tsx's
 * job (the layout has unwound by the time global-error renders, hence its own <html>/<body>).
 *
 * Per Next 16 spec (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md):
 *   - MUST be a Client Component ("use client").
 *   - Receives `error: Error & { digest?: string }` and `unstable_retry: () => void`.
 *     `unstable_retry` (v16.2.0+) is the canonical recovery prop and replaces the older
 *     `reset` for the route-retry path. We accept BOTH — `reset` is still listed as an
 *     escape hatch in the docs and some sub-routes/templates may still pass it under
 *     dev-mode hot reloads. The button calls whichever is defined.
 *   - May not export `metadata` (Client Components can't).
 *
 * Telemetry contract:
 *   On mount we beacon the error to /api/error with `source: "boundary"`. BEFORE the
 *   beacon fires, we set `window.__anvilry_error_recently__ = Date.now()` so the
 *   instrumentation-client.ts window listener suppresses the same error if React
 *   re-throws it to the global handler within the 100ms dedupe window. The exact flag
 *   name is shared by contract — DO NOT rename without updating instrumentation-client.ts
 *   in lock-step.
 *
 * UX contract:
 *   Dense, professional fallback. Mirrors the rest of the site (mono-label eyebrow,
 *   `--fg-*` tokens, `Section`-style centered max-width). NOT cute. The user just hit
 *   a wall — give them two clear actions ("Try again" / "Back to homepage") and one
 *   sentence acknowledging we know. The digest is shown verbatim because it's the only
 *   thing connecting the user's complaint to a server log line in production.
 */

import { useEffect } from "react";
import Link from "next/link";

/** Shared dedupe flag — must match instrumentation-client.ts. */
const DEDUPE_FLAG = "__anvilry_error_recently__" as const;

type ErrorProps = {
  error: Error & { digest?: string };
  /** Next 16.2+ canonical recovery prop. Re-runs the segment. */
  unstable_retry?: () => void;
  /**
   * Older Next escape hatch. Still listed in the v16 docs as a rare-case alternative;
   * keep accepting it so dev-mode hot reloads or downstream wrappers don't crash.
   */
  reset?: () => void;
};

export default function RouteError({ error, unstable_retry, reset }: ErrorProps) {
  useEffect(() => {
    // Stamp the dedupe flag BEFORE the beacon fires. Even if sendErrorBeacon is
    // synchronous, React's re-throw to the global handler can race a microtask;
    // setting the flag first guarantees the window listener sees a recent timestamp.
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, number>)[DEDUPE_FLAG] = Date.now();
    }

    // Dynamic import so this module stays out of the initial bundle for non-error renders.
    // The boundary itself is in the route group's chunk; the beacon module is only ~1KB
    // but it's still strictly post-error work, so we defer it.
    import("@/lib/telemetry/beacon")
      .then(({ sendErrorBeacon }) => {
        sendErrorBeacon({
          source: "boundary",
          message: error.message || "render error",
          stack: error.stack,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          level: "error",
          // No componentStack here — Next 16 boundaries don't surface React's own
          // componentStack via props. global-error.tsx is in the same boat. If we
          // need it, it has to come through React 19's onCaughtError hook (future).
        });
      })
      .catch(() => {
        // Swallow — telemetry must NEVER regress the user-facing recovery. If the
        // dynamic import fails (CSP block, network), the user still sees the fallback.
      });
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="mx-auto w-full max-w-xl text-center">
        <p className="mono-label">{"// boundary :: render-error"}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          Something broke loading this view.
        </h1>
        <p className="mt-4 text-fg-muted">
          We&apos;ve logged it. You can retry the segment, or jump back to the homepage.
        </p>
        {error.digest && (
          // The digest is the ONLY string a user can paste that lets us correlate
          // their report to a server-side log line. Render verbatim, monospace.
          <p className="mt-4 font-mono text-xs text-fg-subtle">
            digest: <span className="text-fg-muted">{error.digest}</span>
          </p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          {retry && (
            <button
              type="button"
              onClick={() => retry()}
              className="rounded-md border border-border-strong bg-bg-elevated px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-[color-mix(in_oklab,var(--bg-elevated)_70%,var(--accent)_30%)]"
            >
              Try again
            </button>
          )}
          <Link
            href="/"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
          >
            Back to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
