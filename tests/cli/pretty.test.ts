import { describe, expect, it } from "vitest";
import {
  MAX_PRETTY_CHARS,
  MAX_PRETTY_NESTING,
} from "../../cli/lib/constants.mjs";
import { escapeJsonOutput } from "../../cli/lib/escape.mjs";
import { prettyJson } from "../../cli/lib/pretty.mjs";

const nested = (levels: number): unknown => {
  let value: unknown = [];
  for (let level = 1; level < levels; level += 1) value = [value];
  return value;
};

/** `breadth` ones, each wrapped `levels` deep, in one array: small as JSON, large once indented. */
const wide = (levels: number, breadth: number): unknown => {
  let value: unknown = Array.from({ length: breadth }, () => 1);
  for (let level = 1; level < levels; level += 1) value = [value];
  return value;
};

describe("prettyJson", () => {
  it("prints exactly what JSON.stringify prints with two-space indentation, escaped for the terminal", () => {
    const samples: unknown[] = [
      null,
      true,
      0,
      -1.5e21,
      "text",
      "café ✓ 日本",
      [],
      {},
      [1, [2, [3, []]], {}],
      { a: 1, b: [true, null, "x"], c: { d: {}, e: [] } },
      { 'key with "quotes"': "line\nbreak\ttab" },
      { s: "c1 \u009b and bidi \u202e and tag \u{e0041}" },
    ];
    for (const sample of samples) {
      const result = prettyJson(sample);
      expect(result).toEqual({
        ok: true,
        text: escapeJsonOutput(JSON.stringify(sample, null, 2)),
      });
    }
  });

  it("prints a document nested as deep as the limit allows", () => {
    const result = prettyJson(nested(MAX_PRETTY_NESTING));
    expect(result.ok).toBe(true);
  });

  it("refuses a document one level deeper than the limit, without recursing into it", () => {
    expect(prettyJson(nested(MAX_PRETTY_NESTING + 1))).toEqual({
      ok: false,
      reason: `nested more than ${MAX_PRETTY_NESTING} levels deep`,
    });
  });

  it("refuses a document nested far beyond what the stack could hold", () => {
    const result = prettyJson(nested(200_000));
    expect(result.ok).toBe(false);
  });

  it("refuses a small document whose indented form would be gigantic", () => {
    // About 100 KB as JSON, nearly 200 MB once every one of its 100,000 values is indented 900 levels.
    const result = prettyJson(wide(MAX_PRETTY_NESTING - 100, 100_000));
    expect(result).toEqual({
      ok: false,
      reason: `its indented form would be larger than ${MAX_PRETTY_CHARS / (1024 * 1024)} MiB`,
    });
  });

  it("does not refuse a large document that is shallow", () => {
    const shallow = wide(3, 200_000);
    const result = prettyJson(shallow);
    expect(result.ok).toBe(true);
  });

  it("reports a stack or string overflow as a reason instead of throwing", () => {
    const overflowing = {
      toJSON() {
        throw new RangeError("Maximum call stack size exceeded");
      },
    };
    expect(prettyJson(overflowing)).toEqual({
      ok: false,
      reason: "it is too large or too deeply nested to format",
    });
  });

  it("does not hide a failure that is not an overflow", () => {
    const broken = {
      toJSON() {
        throw new TypeError("not a RangeError");
      },
    };
    expect(() => prettyJson(broken)).toThrow("not a RangeError");
  });
});
