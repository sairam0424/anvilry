import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { profile } from "./profile";

/**
 * SECURITY.md named a different address (sairamugge4@gmail.com) from the one the site publishes
 * (profile.email) until 2026-10-31. A reporter who followed the policy wrote to an inbox the site
 * never mentions, so the two now come from the same value and this test fails if they drift apart.
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
