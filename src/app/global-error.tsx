"use client";

/**
 * global-error.tsx — Next 16 ROOT error boundary.
 *
 * The last-resort boundary that catches errors thrown INSIDE src/app/layout.tsx itself
 * (or any of its rendered providers / template / loaders). By the time this renders the
 * layout has unwound, which means:
 *
 *   1) NO Providers context — the WakeWordController, talk-mode mounts, AskPortfolio,
 *      VoiceSettings, etc. are all gone. We must render zero components that depend on
 *      them. That's why the markup is plain JSX with no @/components imports.
 *   2) NO globals.css guarantee — Next claims it injects layout-level CSS, but in
 *      practice (especially during the very-early bootstrap window where global-error
 *      is most likely to fire) the CSS payload may not be applied yet. Style with a
 *      few inline rules + Tailwind atomics that work statelessly. Inline `style` is the
 *      load-bearing path; the Tailwind classes are belt-and-suspenders.
 *   3) MUST include its own <html> and <body> tags — the docs are explicit. Without
 *      them the browser ends up with a fragment glued to a half-rendered DOM and the
 *      "fallback" looks worse than the original error.
 *
 * Telemetry mirrors error.tsx but with `source: "global-boundary"` so the server-side
 * sink can distinguish "your route crashed" from "your layout crashed" — the latter is
 * a much louder bug class (every page on the site is broken, not just one route).
 *
 * The DEDUPE_FLAG is shared with error.tsx and instrumentation-client.ts. Same Date.now()
 * timestamp pattern, same 100ms window — without this, a layout crash would beacon TWICE
 * (once from this boundary, once from the window listener catching React's re-throw).
 */

import { useEffect } from "react";

const DEDUPE_FLAG = "__anvilry_error_recently__" as const;

type GlobalErrorProps = {
  error: Error & { digest?: string };
  /** Next 16.2+ canonical recovery prop. */
  unstable_retry?: () => void;
  /** Older Next escape hatch — still in v16 docs for the rare-case path. */
  reset?: () => void;
};

export default function GlobalError({ error, unstable_retry, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, number>)[DEDUPE_FLAG] = Date.now();
    }

    // Same dynamic-import dance as error.tsx — keeps the beacon module out of the SSR
    // critical path AND ensures a CSP-blocked import doesn't take the recovery UI down
    // with it.
    import("@/lib/telemetry/beacon")
      .then(({ sendErrorBeacon }) => {
        sendErrorBeacon({
          // The discriminator the /api/error route uses to route attrs into the right
          // server-side `kind`: "global-boundary" means the layout crashed, which is
          // a sev-1 class of bug separate from a per-route render error.
          source: "global-boundary",
          message: error.message || "global render error",
          stack: error.stack,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          level: "error",
        });
      })
      .catch(() => {
        // Telemetry MUST NOT regress the recovery UI.
      });
  }, [error]);

  const retry = unstable_retry ?? reset;

  // Inline-styled markup. Tailwind atomics are kept as a "if CSS is loaded, look nice"
  // layer, but the inline `style` is what guarantees a legible page even without it.
  // Color values mirror the design tokens (--bg-base, --fg, --fg-muted) so when CSS
  // IS present the page looks identical to the rest of the site.
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "5rem 1.5rem",
          backgroundColor: "#07080d",
          color: "#e9ecf5",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div style={{ maxWidth: "36rem", width: "100%", textAlign: "center" }}>
          <p
            style={{
              fontFamily: 'ui-monospace, "SF Mono", monospace',
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#747e99",
              margin: 0,
            }}
          >
            {"// boundary :: layout-crashed"}
          </p>
          <h1
            style={{
              marginTop: "0.5rem",
              fontSize: "1.875rem",
              lineHeight: 1.15,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "#e9ecf5",
            }}
          >
            Something broke at the root of the app.
          </h1>
          <p style={{ marginTop: "1rem", color: "#9aa3b8" }}>
            We&apos;ve logged it. Try again, or open the homepage in a fresh tab.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "1rem",
                fontFamily: 'ui-monospace, "SF Mono", monospace',
                fontSize: "0.75rem",
                color: "#747e99",
              }}
            >
              digest: <span style={{ color: "#9aa3b8" }}>{error.digest}</span>
            </p>
          )}
          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              justifyContent: "center",
              gap: "0.75rem",
            }}
          >
            {retry && (
              <button
                type="button"
                onClick={() => retry()}
                style={{
                  borderRadius: "0.375rem",
                  border: "1px solid #2c3346",
                  backgroundColor: "#141826",
                  color: "#e9ecf5",
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
            )}
            {/*
              Plain anchor instead of next/link — at the global-error level the router
              context is part of what just unwound. Forcing a real navigation is the
              safer recovery path; let the framework re-bootstrap from a clean slate.
              Linter rule disabled DELIBERATELY for this exact reason.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                borderRadius: "0.375rem",
                border: "1px solid #1f2433",
                color: "#9aa3b8",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Back to homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
