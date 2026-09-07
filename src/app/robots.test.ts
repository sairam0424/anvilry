import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots — AI usage signal", () => {
  it("declares the Content-Signal directive with the exact intended values", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.other?.["Content-Signal"]).toBe(
      "search=yes, ai-input=yes, ai-train=no",
    );
  });

  it("still allows all crawlers on all paths (unchanged base rule)", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.allow).toBe("/");
  });
});
