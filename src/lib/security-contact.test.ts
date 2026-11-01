import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { profile } from "./profile";

/**
 * SECURITY.md named a different address (sairamugge4@gmail.com) from the one the site publishes
 * (profile.email) until 2026-10-31, and CODE_OF_CONDUCT.md and CONTRIBUTING.md kept it until
 * 2026-11-01. A reporter who followed the policy wrote to an inbox the site never mentions, so
 * every file that names a contact address now has to agree with profile.email, and these tests
 * fail if one drifts apart.
 */
describe("SECURITY.md reporting address", () => {
  const policy = readFileSync(join(process.cwd(), "SECURITY.md"), "utf-8");

  it("is the address the site publishes", () => {
    const line = policy.split("\n").find((l) => l.startsWith("Email:"));
    expect(line, "SECURITY.md has no 'Email:' line").toBeDefined();
    expect(line).toContain(profile.email);
  });

  it("names exactly one address, so there is one inbox to watch", () => {
    const addresses = new Set(policy.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []);
    expect([...addresses]).toEqual([profile.email]);
  });
});

describe("the other community-health files", () => {
  it.each(["CODE_OF_CONDUCT.md", ".github/CONTRIBUTING.md"])(
    "%s names only the address the site publishes",
    (file) => {
      const text = readFileSync(join(process.cwd(), file), "utf-8");
      const addresses = new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []);
      expect([...addresses], `${file} must name exactly profile.email`).toEqual([profile.email]);
    },
  );
});
