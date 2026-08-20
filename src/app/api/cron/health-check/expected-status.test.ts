import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The health-check cron probes every public surface and fails a check on an unexpected HTTP
 * status. `mcp_get` hits /api/mcp/mcp with a plain GET, and Streamable-HTTP MCP answers that
 * with 405 by design — the SSE transport GET is for is disabled in
 * src/app/api/mcp/[transport]/route.ts.
 *
 * Under a blanket `!== 200` gate that check failed on EVERY run, so the cron reported top-level
 * "warn" permanently and a real MCP outage looked identical to the standing false negative.
 *
 * This pins the coupling in both directions: the probe must expect 405 for mcp_get, AND the
 * route must still be the one that disables SSE. If SSE is ever re-enabled, GET starts
 * answering 200 and this test should fail so the expectation gets revisited rather than
 * silently inverting.
 */
const CRON = "src/app/api/cron/health-check/route.ts";
const MCP_ROUTE = "src/app/api/mcp/[transport]/route.ts";

describe("health-check cron — mcp_get expected status", () => {
  const cron = readFileSync(CRON, "utf8");

  it("declares an expected-status table rather than a blanket 200 gate", () => {
    expect(cron, "EXPECTED_STATUS table missing").toMatch(/const EXPECTED_STATUS/);
    expect(
      cron,
      "probe still compares against a hardcoded 200 — that fails mcp_get on every run",
    ).not.toMatch(/if \(http_status !== 200\)/);
  });

  it("expects 405 for mcp_get", () => {
    const table = cron.slice(cron.indexOf("const EXPECTED_STATUS"));
    const decl = table.slice(0, table.indexOf(";") + 1);
    expect(decl).toMatch(/mcp_get:\s*405/);
  });

  it("still probes /api/mcp/mcp — the endpoint the 405 expectation is about", () => {
    expect(cron).toMatch(/name:\s*"mcp_get"[^}]*path:\s*"\/api\/mcp\/mcp"/);
  });

  it("is consistent with the MCP route still disabling SSE", () => {
    // If disableSse is ever removed, GET stops being 405 and the expectation above is wrong.
    const route = readFileSync(MCP_ROUTE, "utf8");
    expect(
      /disableSse:\s*true/.test(route),
      "MCP route no longer disables SSE — GET may answer 200 now, so revisit EXPECTED_STATUS.mcp_get",
    ).toBe(true);
  });

  it("leaves every other check on the default 200 expectation", () => {
    const table = cron.slice(cron.indexOf("const EXPECTED_STATUS"));
    const decl = table.slice(0, table.indexOf(";") + 1);
    const overrides = [...decl.matchAll(/(\w+):\s*\d{3}/g)].map((m) => m[1]);
    expect(overrides, "only mcp_get should override the 200 default").toEqual(["mcp_get"]);
  });
});
