import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { allWork } from "@/lib/content";

/**
 * Build-time guards for the optional case-study depth fields. These ship empty (no work
 * item sets them yet); the test arms the a11y + zero-fabrication contracts so the moment
 * the owner adds a diagram, a missing alt text or a missing asset fails the build.
 */
describe("case-study depth fields", () => {
  it("every work item with a diagram has non-empty alt text (a11y)", () => {
    for (const w of allWork) {
      if (w.diagram) {
        expect(w.diagramAlt, `${w.slug}: diagram set but diagramAlt missing`).toBeTruthy();
        expect((w.diagramAlt ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("every referenced diagram asset exists on disk (no broken image)", () => {
    for (const w of allWork) {
      if (w.diagram) {
        // diagram paths are public assets, e.g. "/static/foo.svg" → public/static/foo.svg
        const rel = w.diagram.replace(/^\//, "");
        const onDisk = join(process.cwd(), "public", rel);
        expect(existsSync(onDisk), `${w.slug}: diagram asset not found at public/${rel}`).toBe(true);
      }
    }
  });

  it("constraints/tradeoffs (when present) are non-trivial prose, not a placeholder", () => {
    for (const w of allWork) {
      for (const field of ["constraints", "tradeoffs"] as const) {
        const val = w[field];
        if (val) {
          expect(val.length, `${w.slug}.${field} too short`).toBeGreaterThan(20);
          expect(/TODO|TBD|lorem/i.test(val), `${w.slug}.${field} looks like a placeholder`).toBe(false);
        }
      }
    }
  });
});
