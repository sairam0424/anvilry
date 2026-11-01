import { describe, expect, it } from "vitest";
import {
  API_V1_BASE,
  API_VERSION,
  BATCH_MAX_BODY_BYTES,
  BATCH_MAX_REQUESTS,
  BATCH_PATH,
  DEPRECATIONS,
  DEPRECATION_NOTICE_DAYS,
  RATE_LIMIT_POLICY,
  RATE_LIMIT_POLICY_TEXT,
  VERSIONING_POLICY,
  deprecationHeaders,
  givesEnoughNotice,
  type Deprecation,
} from "./api-policy";

const sample: Deprecation = {
  prefix: "/api/v1/legacy",
  deprecatedOn: "2027-01-01",
  sunsetOn: "2027-07-01",
  successor: "https://anvilry.vercel.app/api/v2/legacy",
};

describe("deprecationHeaders", () => {
  it("sends nothing for a surface that is not deprecated", () => {
    expect(deprecationHeaders("/api/v1/projects", [sample])).toEqual([]);
    expect(deprecationHeaders("/api/v1/projects")).toEqual([]);
  });

  it("announces Deprecation as an RFC 9745 date, Sunset as an HTTP-date and the successor", () => {
    const headers = Object.fromEntries(deprecationHeaders("/api/v1/legacy/items", [sample]));
    expect(headers.Deprecation).toBe(`@${Date.parse("2027-01-01T00:00:00Z") / 1000}`);
    expect(headers.Sunset).toBe("Thu, 01 Jul 2027 00:00:00 GMT");
    expect(headers.Link).toBe(`<${sample.successor}>; rel="successor-version"`);
  });

  it("refuses an entry whose date cannot be parsed instead of sending a broken header", () => {
    expect(() =>
      deprecationHeaders("/x", [{ ...sample, prefix: "/x", sunsetOn: "soon" }]),
    ).toThrow(/unparseable/);
  });
});

describe("the published policy", () => {
  it("has nothing deprecated today, and any future entry must honour the promised notice", () => {
    expect(DEPRECATIONS.every(givesEnoughNotice)).toBe(true);
    expect(givesEnoughNotice(sample)).toBe(true); // 181 days
    expect(givesEnoughNotice({ ...sample, sunsetOn: "2027-03-01" })).toBe(false);
  });

  it("states the numbers it enforces, so the prose cannot drift from the constants", () => {
    const versioning = VERSIONING_POLICY.join(" ");
    expect(versioning).toContain(API_V1_BASE);
    expect(versioning).toContain(`version ${API_VERSION}`);
    expect(versioning).toContain(`${DEPRECATION_NOTICE_DAYS} days`);
    const limits = RATE_LIMIT_POLICY_TEXT.join(" ");
    expect(limits).toContain(`${RATE_LIMIT_POLICY.requests} requests per ${RATE_LIMIT_POLICY.windowSeconds} seconds`);
  });
});

describe("the batch limits", () => {
  it("sits under the versioned base and bounds both operations and body size", () => {
    expect(BATCH_PATH).toBe(`${API_V1_BASE}/batch`);
    expect(Number.isInteger(BATCH_MAX_REQUESTS)).toBe(true);
    expect(BATCH_MAX_REQUESTS).toBeGreaterThan(1);
    expect(BATCH_MAX_REQUESTS).toBeLessThanOrEqual(100);
    expect(BATCH_MAX_BODY_BYTES).toBeGreaterThanOrEqual(BATCH_MAX_REQUESTS * 64);
  });
});
