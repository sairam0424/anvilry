import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

/**
 * Every asset URL the web app manifest declares must resolve, or the install UI references files
 * that 404. Two kinds of src exist:
 *
 *  - a Next.js generated route (`/icon`, `/apple-icon`) — backed by src/app/<name>.tsx
 *  - a static file (`/anything-else`) — backed by public/<path>
 *
 * NOTE ON ARMING: `screenshots` is currently absent (it declared two files that did not exist).
 * A test that only walks `m.screenshots ?? []` therefore asserts NOTHING today — it is a latch
 * for a future re-add, not a live guard. So this file does three things instead: asserts the
 * current shape explicitly, walks whatever IS declared, and unit-tests the resolver itself
 * against synthetic inputs so the logic is proven live rather than only on re-add.
 */
const GENERATED_ROUTES = new Map([
  ["/icon", "src/app/icon.tsx"],
  ["/apple-icon", "src/app/apple-icon.tsx"],
]);

function resolves(src: string): { ok: boolean; checked: string } {
  const generated = GENERATED_ROUTES.get(src);
  if (generated) return { ok: existsSync(generated), checked: generated };
  const checked = `public${src}`;
  return { ok: existsSync(checked), checked };
}

describe("resolves() — the asset resolver itself", () => {
  it("maps generated icon routes to their source files", () => {
    expect(resolves("/icon")).toEqual({ ok: true, checked: "src/app/icon.tsx" });
    expect(resolves("/apple-icon")).toEqual({ ok: true, checked: "src/app/apple-icon.tsx" });
  });

  it("maps a static src into public/ and reports a real file as ok", () => {
    // A file that genuinely exists in this repo.
    expect(resolves("/avatar/sairam.glb")).toEqual({
      ok: true,
      checked: "public/avatar/sairam.glb",
    });
  });

  it("reports a missing static src as NOT ok — including the two that were removed", () => {
    for (const src of [
      "/static/screenshot-desktop.png",
      "/static/screenshot-mobile.png",
      "/nope.png",
    ]) {
      expect(resolves(src).ok, `${src} should not resolve`).toBe(false);
    }
  });
});

describe("web app manifest — declared assets exist", () => {
  const m = manifest();

  it("declares icons, and every icon src resolves", () => {
    expect(m.icons?.length, "manifest should declare at least one icon").toBeGreaterThan(0);
    for (const icon of m.icons ?? []) {
      const { ok, checked } = resolves(icon.src as string);
      expect(ok, `icon "${icon.src}" does not resolve (looked for ${checked})`).toBe(true);
    }
  });

  it("declares no screenshots — the two it used to declare had no files behind them", () => {
    // Explicit, so a silent re-add without assets fails here rather than passing a vacuous loop.
    expect(
      m.screenshots ?? [],
      "screenshots were re-added — every src must resolve; see the next assertion",
    ).toEqual([]);
  });

  it("if screenshots ARE ever declared, every src must resolve", () => {
    const declared = (m.screenshots ?? []).map((s) => s.src as string);
    const missing = declared.filter((src) => !resolves(src).ok);
    expect(missing, `manifest declares screenshots with no asset: ${missing.join(", ")}`).toEqual(
      [],
    );
  });

  it("keeps the fields that make the manifest usable at all", () => {
    expect(m.name).toBeTruthy();
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
  });
});
