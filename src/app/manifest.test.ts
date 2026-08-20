import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

/**
 * Every asset URL the web app manifest declares must actually resolve, or the PWA install
 * card renders with broken images. Two kinds of src exist here:
 *
 *  - a Next.js generated route (`/icon`, `/apple-icon`) — backed by src/app/<name>.tsx
 *  - a static file (`/anything-else`) — backed by public/<path>
 *
 * This test blocks the class of bug where a manifest entry outlives the asset it points at.
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

describe("web app manifest — declared assets exist", () => {
  const m = manifest();

  it("every icon src resolves", () => {
    for (const icon of m.icons ?? []) {
      const { ok, checked } = resolves(icon.src as string);
      expect(ok, `icon "${icon.src}" does not resolve (looked for ${checked})`).toBe(true);
    }
  });

  it("every screenshot src resolves", () => {
    for (const shot of m.screenshots ?? []) {
      const { ok, checked } = resolves(shot.src as string);
      expect(ok, `screenshot "${shot.src}" does not resolve (looked for ${checked})`).toBe(true);
    }
  });

  it("declares no screenshot without a real file behind it", () => {
    // A manifest may legitimately omit screenshots entirely; what it may NOT do is
    // declare one that 404s.
    const declared = (m.screenshots ?? []).map((s) => s.src as string);
    const missing = declared.filter((src) => !resolves(src).ok);
    expect(missing, `manifest declares screenshots with no asset: ${missing.join(", ")}`).toEqual(
      [],
    );
  });
});
