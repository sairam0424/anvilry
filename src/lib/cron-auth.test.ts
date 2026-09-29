import { afterEach, describe, expect, it, vi } from "vitest";
import { hasValidCronSecret, unauthorizedUnlessCron } from "./cron-auth";

const TEST_CRON_VALUE = "unit-test-cron-value";

function request(authorization?: string): Request {
  return new Request("https://anvilry.test/api/cron/x", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("hasValidCronSecret", () => {
  it("accepts the exact bearer value", () => {
    vi.stubEnv("CRON_SECRET", TEST_CRON_VALUE);
    expect(hasValidCronSecret(request(`Bearer ${TEST_CRON_VALUE}`))).toBe(true);
  });

  it("rejects when CRON_SECRET is unset or empty (fail closed)", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(hasValidCronSecret(request("Bearer "))).toBe(false);
    expect(hasValidCronSecret(request("Bearer undefined"))).toBe(false);
  });

  it("rejects a missing header, wrong scheme, and wrong-length values", () => {
    vi.stubEnv("CRON_SECRET", TEST_CRON_VALUE);
    expect(hasValidCronSecret(request())).toBe(false);
    expect(hasValidCronSecret(request(TEST_CRON_VALUE))).toBe(false);
    expect(hasValidCronSecret(request(`Basic ${TEST_CRON_VALUE}`))).toBe(false);
    expect(hasValidCronSecret(request(`Bearer ${TEST_CRON_VALUE}x`))).toBe(
      false,
    );
    expect(hasValidCronSecret(request("Bearer x"))).toBe(false);
  });

  it("rejects a same-length value that differs", () => {
    vi.stubEnv("CRON_SECRET", TEST_CRON_VALUE);
    const flipped = `${TEST_CRON_VALUE.slice(0, -1)}!`;
    expect(hasValidCronSecret(request(`Bearer ${flipped}`))).toBe(false);
  });
});

describe("unauthorizedUnlessCron", () => {
  it("returns null when authorised", () => {
    vi.stubEnv("CRON_SECRET", TEST_CRON_VALUE);
    expect(
      unauthorizedUnlessCron(request(`Bearer ${TEST_CRON_VALUE}`)),
    ).toBeNull();
  });

  it("returns the 401 { error: 'Unauthorized' } response otherwise", async () => {
    vi.stubEnv("CRON_SECRET", TEST_CRON_VALUE);
    const res = unauthorizedUnlessCron(request("Bearer nope"));
    expect(res?.status).toBe(401);
    await expect(res?.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});
