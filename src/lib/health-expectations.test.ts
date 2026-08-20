import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXPECTED_STATUS_OVERRIDES, expectedStatus, isExpectedStatus } from "./health-expectations";

/**
 * BEHAVIOURAL, deliberately. The first version of this guard grepped the cron route's source for
 * `const EXPECTED_STATUS` and `if (http_status !== 200)`. Five different ways of reintroducing the
 * original bug — flipping the default to 405, inverting the comparison operator, ignoring the
 * table, looking the value up by the wrong key, short-circuiting the branch — ALL passed it.
 * Only a literal full revert was caught. It was the same "test that cannot fail" defect it was
 * written to prevent.
 *
 * So the decision logic now lives in a pure module and is exercised, not pattern-matched.
 */
describe("expectedStatus", () => {
  it("defaults every unknown check to 200", () => {
    for (const name of ["homepage", "sitemap_xml", "feed_xml", "does_not_exist", ""]) {
      expect(expectedStatus(name), `${name} should default to 200`).toBe(200);
    }
  });

  it("expects 405 for mcp_get — a plain GET on the Streamable HTTP endpoint", () => {
    expect(expectedStatus("mcp_get")).toBe(405);
  });

  it("overrides exactly one check", () => {
    expect(Object.keys(EXPECTED_STATUS_OVERRIDES)).toEqual(["mcp_get"]);
  });

  it("is not mutable at runtime", () => {
    expect(Object.isFrozen(EXPECTED_STATUS_OVERRIDES)).toBe(true);
  });
});

describe("isExpectedStatus", () => {
  it("passes mcp_get on 405 and fails it on 200", () => {
    expect(isExpectedStatus("mcp_get", 405)).toBe(true);
    // 200 would mean mcp-handler changed GET semantics — that must NOT silently read as healthy.
    expect(isExpectedStatus("mcp_get", 200)).toBe(false);
  });

  it("still fails mcp_get on the statuses that mean real breakage", () => {
    for (const status of [404, 500, 502, 503, 0]) {
      expect(isExpectedStatus("mcp_get", status), `${status} must fail`).toBe(false);
    }
  });

  it("passes ordinary checks only on 200", () => {
    expect(isExpectedStatus("homepage", 200)).toBe(true);
    for (const status of [201, 301, 404, 405, 500]) {
      expect(isExpectedStatus("homepage", status), `${status} must fail`).toBe(false);
    }
  });
});

/**
 * The 405 is mcp-handler's behaviour, not ours — it is the unconditional first branch of the
 * streamable-endpoint handler and has nothing to do with this project's `disableSse: true`
 * (that only gates the separate /api/mcp/sse path, which 404s).
 *
 * Pinning the installed version is therefore the only honest coupling: a major bump could answer
 * GET with 200 by opening a notification stream, which the MCP spec permits, and that would
 * silently re-break the check. Asserting `disableSse: true` — which the first version of this
 * guard did — is a tripwire on the wrong wire: it fires on a change that cannot affect the status,
 * and stays green on the upgrade that can.
 */
describe("the 405 expectation's real dependency", () => {
  it("pins the mcp-handler version the 405 was observed from", () => {
    const installed = JSON.parse(
      readFileSync("node_modules/mcp-handler/package.json", "utf8"),
    ) as { version: string };
    expect(
      installed.version,
      `mcp-handler is ${installed.version}, not 1.1.x. GET on the Streamable HTTP endpoint may no ` +
        "longer answer 405 (the MCP spec permits opening a notification stream and returning 200). " +
        "Re-verify with `curl -i <site>/api/mcp/mcp` and update EXPECTED_STATUS_OVERRIDES.mcp_get.",
    ).toMatch(/^1\.1\./);
  });

  it("confirms the 405 branch is still unconditional in the installed package", () => {
    // If this stops matching, mcp-handler restructured its GET handling — revisit the expectation.
    const dist = readFileSync("node_modules/mcp-handler/dist/index.js", "utf8");
    const streamable = dist.slice(dist.indexOf("url.pathname === streamableHttpEndpoint"));
    const getBranch = streamable.slice(0, streamable.indexOf("} else if"));
    expect(getBranch, "no GET branch found on the streamable endpoint").toContain('req.method === "GET"');
    expect(getBranch, "GET on the streamable endpoint no longer writes 405").toContain("writeHead(405)");
    expect(
      getBranch,
      "the 405 is now conditional on something — read it and re-derive the expectation",
    ).not.toContain("disableSse");
  });
});
