import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "@testing-library/react";

/**
 * One-off PROOF for the extension-injected hydration warning + its mitigation. Browser
 * extensions (DOM locators, Grammarly, dark-mode, etc.) inject attributes onto the root
 * tags BEFORE React hydrates, which React reports as a hydration mismatch. We reproduce
 * that EXACT shape — server HTML rendered WITHOUT the attribute, then the attribute
 * injected onto the element before hydrateRoot — and assert:
 *   1. WITHOUT suppressHydrationWarning -> React logs the mismatch (the reported bug).
 *   2. WITH    suppressHydrationWarning -> React stays silent (the mitigation).
 *
 * Uses the project's own react-dom@19 under happy-dom, so it mirrors runtime behavior.
 * This file documents/locks the fix; it is not a product test.
 */

function Tree({ suppress }: { suppress: boolean }) {
  // A stand-in for the layout's <head> (the element the extension mutates).
  return (
    <div data-role="head" suppressHydrationWarning={suppress}>
      <span>content</span>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

/** Render to HTML (server), inject the extension attribute, then hydrate (client). */
function hydrateWithInjectedAttr(suppress: boolean): string[] {
  const host = document.createElement("div");
  // SERVER output — clean, no injected attribute (matches our real server HTML).
  // innerHTML is safe here: the source is React's own renderToString output (trusted,
  // no user input) and hydrateRoot REQUIRES pre-existing server markup to hydrate against.
  host.innerHTML = renderToString(<Tree suppress={suppress} />);
  // EXTENSION runs here, before hydration: inject the exact reported attribute.
  host.querySelector('[data-role="head"]')?.setAttribute("data-locator-hook-status-message", "ok");

  const errors: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  });
  act(() => {
    hydrateRoot(host, <Tree suppress={suppress} />);
  });
  spy.mockRestore();
  return errors;
}

describe("extension-injected hydration warning mitigation", () => {
  it("WITHOUT suppressHydrationWarning: React reports the injected-attribute mismatch", () => {
    const errors = hydrateWithInjectedAttr(false);
    const hydrationErr = errors.find(
      (e) => /hydrat/i.test(e) || /data-locator-hook-status-message/.test(e),
    );
    expect(hydrationErr).toBeTruthy();
  });

  it("WITH suppressHydrationWarning: React stays silent about the injected attribute", () => {
    const errors = hydrateWithInjectedAttr(true);
    const hydrationErr = errors.find(
      (e) => /hydrat/i.test(e) || /data-locator-hook-status-message/.test(e),
    );
    expect(hydrationErr).toBeUndefined();
  });
});
