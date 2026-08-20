/**
 * Expected HTTP status per health check, extracted from the cron route so it can be unit-tested
 * as behaviour rather than asserted as source text. Mirrors the repo's existing split: pure
 * logic in lib, thin wiring in the route (see the same note on @/lib/mcp-tools).
 *
 * Anything absent from OVERRIDES expects 200.
 *
 * `mcp_get` expects **405**. The cron probes /api/mcp/mcp with a plain GET, and mcp-handler
 * answers ANY GET on the Streamable HTTP endpoint with
 * `405 {"jsonrpc":"2.0","error":{"code":-32000,"message":"Method not allowed."},"id":null}`.
 *
 * That 405 is UNCONDITIONAL — it is the first branch of the streamable-endpoint handler
 * (node_modules/mcp-handler/dist/index.js:279-292) and does not depend on this project's
 * `disableSse: true`. (`disableSse` only gates the separate /api/mcp/sse path, which 404s.)
 * Verified live: GET /api/mcp/mcp -> 405, GET /api/mcp/sse -> 404, POST /api/mcp/mcp with a
 * JSON-RPC `initialize` -> 200.
 *
 * Why 405 counts as healthy: it is mcp-handler's own JSON-RPC response, so it proves the route
 * is mounted and the handler is executing. It does NOT prove the server completes a session —
 * a POSTed `initialize` would. This is a liveness check, not a functional one; a 404 or 5xx here
 * means something is genuinely wrong. Under the previous blanket `!== 200` gate this check failed
 * on EVERY run, so a real MCP outage was indistinguishable from the standing false negative.
 *
 * CAVEAT: the 405 is mcp-handler's behaviour, not ours. A future major version could answer GET
 * with 200 by opening a notification stream (which the MCP spec permits). `expected-status.test.ts`
 * pins the installed version so that upgrade fails the suite rather than silently re-breaking
 * this check.
 */
export const EXPECTED_STATUS_OVERRIDES: Readonly<Record<string, number>> = Object.freeze({
  mcp_get: 405,
});

/** The status a given check must return to be considered up. */
export function expectedStatus(checkName: string): number {
  return EXPECTED_STATUS_OVERRIDES[checkName] ?? 200;
}

/** Whether an observed status means the check passed. */
export function isExpectedStatus(checkName: string, httpStatus: number): boolean {
  return httpStatus === expectedStatus(checkName);
}
