import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `clientIp` is deliberately duplicated rather than shared — src/lib/telemetry/with-trace.ts:56-62
 * documents why: the rate-limit module's surface is intentionally tiny, and cross-importing a
 * private helper would couple observability to the cost guard when both should stay
 * independently swappable.
 *
 * Deliberate duplication needs a guard, or the copies drift. They already had:
 * /api/visit took the FIRST x-forwarded-for segment (attacker-controlled) while the other two
 * take the LAST (set by Vercel's infrastructure). Taking the first lets a client rotate spoofed
 * header values to bypass its own rate limit.
 *
 * This test pins the security-relevant half of the contract across every copy. It reads source
 * because the helpers are module-private by design — the same reason avatar-glb.test.ts reads
 * the GLB bytes rather than importing a loader.
 */
const COPIES = [
  "src/lib/rate-limit.ts",
  "src/lib/telemetry/with-trace.ts",
  "src/app/api/visit/route.ts",
];

describe("clientIp — every duplicated copy resolves the IP the same way", () => {
  for (const path of COPIES) {
    describe(path, () => {
      const src = readFileSync(path, "utf8");

      it("has a clientIp implementation", () => {
        expect(src).toMatch(/function clientIp\s*\(/);
      });

      it("prefers the unspoofable x-vercel-forwarded-for header first", () => {
        const vercelFirst = src.indexOf('x-vercel-forwarded-for');
        const xffPlain = src.indexOf('headers.get("x-forwarded-for")');
        expect(vercelFirst, "x-vercel-forwarded-for must be read").toBeGreaterThan(-1);
        expect(
          vercelFirst,
          "x-vercel-forwarded-for must be checked BEFORE x-forwarded-for",
        ).toBeLessThan(xffPlain);
      });

      it("takes the LAST x-forwarded-for segment, never the first", () => {
        // The XFF fallback line must use .pop() — `.split(",")[0]` is the bypass vector.
        const xffFallback = src
          .split("\n")
          .find((l) => l.includes('headers.get("x-forwarded-for")') || l.includes("xff.split"));
        expect(xffFallback, "no x-forwarded-for fallback found").toBeDefined();

        const block = src.slice(src.indexOf("function clientIp"));
        const xffLine = block
          .split("\n")
          .find((l) => l.includes("xff.split") || l.includes("xff!.split"));
        expect(xffLine, "no xff.split(...) line found inside clientIp").toBeDefined();
        expect(
          xffLine,
          `${path} takes the FIRST x-forwarded-for segment — that is attacker-controlled and ` +
            "allows rate-limit bypass via rotating spoofed headers. Use .split(\",\").pop().",
        ).toContain(".pop()");
        expect(xffLine).not.toMatch(/\.split\(","\)\[0\]/);
      });
    });
  }
});
