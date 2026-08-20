import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `clientIp` is deliberately duplicated rather than shared — src/lib/telemetry/with-trace.ts
 * documents why: the rate-limit module's surface is intentionally tiny, and cross-importing a
 * private helper would couple observability to the cost guard when both should stay
 * independently swappable.
 *
 * Deliberate duplication needs a guard, or the copies drift. They already had:
 * /api/visit took the FIRST x-forwarded-for segment (attacker-controlled) while the other two
 * take the LAST (set by Vercel's infrastructure). Taking the first lets a client rotate spoofed
 * header values to bypass its own rate limit.
 *
 * This pins the security-relevant half of the contract across every copy. It reads source
 * because the helpers are module-private by design — the same reason avatar-glb.test.ts reads
 * the GLB bytes rather than importing a loader.
 *
 * IMPORTANT: every assertion below runs against COMMENT-STRIPPED source. An earlier version of
 * this test compared `indexOf("x-vercel-forwarded-for")` (which matches the explanatory comment)
 * against the code, so the ordering assertion held no matter what the code did — a security test
 * that could not fail. Strip first, then assert, or you are testing prose.
 */
/** The copies that are known and reviewed. A new one must be added here deliberately. */
const COPIES = [
  "src/lib/rate-limit.ts",
  "src/lib/telemetry/with-trace.ts",
  "src/app/api/visit/route.ts",
];

/** Every file under src/ that defines its own `clientIp`, discovered rather than assumed. */
function discoverCopies(dir = "src"): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...discoverCopies(path));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      if (/function\s+clientIp\s*\(|const\s+clientIp\s*[:=]/.test(readFileSync(path, "utf8"))) {
        found.push(path);
      }
    }
  }
  return found;
}

/** Remove block and line comments so assertions can only ever match real code. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** The body of `function clientIp(...) { ... }`, comments removed, via brace matching. */
function clientIpBody(path: string): string {
  const code = stripComments(readFileSync(path, "utf8"));
  const start = code.search(/function\s+clientIp\s*\(/);
  if (start === -1) return "";
  const open = code.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}" && --depth === 0) return code.slice(open + 1, i);
  }
  return "";
}

describe("clientIp — every duplicated copy resolves the IP the same way", () => {
  it("guards its own coverage: no UNKNOWN copy exists anywhere under src/", () => {
    // A hardcoded list cannot see a fourth inline copy in a new route — which is exactly the
    // drift this file exists to prevent. Discover them instead, and fail until a new one is
    // reviewed and added to COPIES above.
    const discovered = discoverCopies().sort();
    const known = [...COPIES].sort();
    const unguarded = discovered.filter((p) => !known.includes(p));
    expect(
      unguarded,
      `unreviewed clientIp implementation(s): ${unguarded.join(", ")}. Add to COPIES after ` +
        "confirming they resolve the IP the same way, or reuse an existing helper.",
    ).toEqual([]);
    // And the reverse: a listed copy that no longer defines clientIp means COPIES is stale.
    const missing = known.filter((p) => !discovered.includes(p));
    expect(missing, `COPIES lists files with no clientIp: ${missing.join(", ")}`).toEqual([]);
  });

  it("guards its own premise: finds a clientIp body in every copy", () => {
    // Without this, a rename would empty every body and silently pass the suite below.
    for (const path of COPIES) {
      expect(clientIpBody(path).length, `no clientIp body extracted from ${path}`).toBeGreaterThan(
        0,
      );
    }
  });

  for (const path of COPIES) {
    describe(path, () => {
      const body = clientIpBody(path);

      it("reads the unspoofable x-vercel-forwarded-for accessor BEFORE x-forwarded-for", () => {
        // Match the ACCESSOR, not the bare header name — the bare name also appears in comments.
        const vercel = body.indexOf('headers.get("x-vercel-forwarded-for")');
        const xff = body.indexOf('headers.get("x-forwarded-for")');
        expect(vercel, "no x-vercel-forwarded-for accessor in code").toBeGreaterThan(-1);
        expect(xff, "no x-forwarded-for accessor in code").toBeGreaterThan(-1);
        expect(vercel, "x-vercel-forwarded-for must be read first").toBeLessThan(xff);
      });

      it("takes the LAST x-forwarded-for segment, never the first", () => {
        // Assert on the RETURN statement that consumes xff, not on any line mentioning it.
        const ret = body
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.startsWith("if (xff) return") || /return\s+xff[.!]/.test(l));
        expect(ret, `no \`return xff…\` statement found in ${path}`).toBeDefined();
        expect(
          ret,
          `${path} takes the FIRST x-forwarded-for segment — attacker-controlled, allows ` +
            'rate-limit bypass via rotating spoofed headers. Use .split(",").pop().',
        ).toContain(".pop()");
        expect(ret, "indexing [0] is the bypass vector").not.toMatch(/\.split\(","\)\[0\]/);
      });

      it("falls back to x-real-ip then a constant, never to undefined", () => {
        expect(body).toContain('headers.get("x-real-ip")');
        expect(body).toMatch(/\?\?\s*"anonymous"/);
      });
    });
  }
});
