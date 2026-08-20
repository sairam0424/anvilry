import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildLlmsTxt } from "./llms-txt";

/**
 * llms.txt is the discovery surface AI agents read to find the MCP server, so the endpoint
 * it advertises has to be one that actually answers. The route sets `disableSse: true`
 * (src/app/api/mcp/[transport]/route.ts), which 404s the legacy /sse path deliberately —
 * advertising it sends every agent to a dead transport.
 */
describe("buildLlmsTxt — advertised MCP endpoint", () => {
  const txt = buildLlmsTxt();

  it("advertises the Streamable HTTP transport, not the disabled SSE one", () => {
    // Anchor on the exact line prefix. `includes("MCP server")` matched the FIRST line
    // containing that phrase, and every content section is interpolated ABOVE the Links
    // section — so a project summary mentioning "MCP server" would fail a code test.
    const line = txt
      .split("\n")
      .find((l) => l.startsWith("- MCP server (for AI agents):"));
    expect(line, "llms.txt should advertise an MCP server in its Links section").toBeDefined();
    expect(line).toContain("/api/mcp/mcp");
  });

  it("never mentions /api/mcp/sse anywhere — the route 404s that path on purpose", () => {
    expect(txt).not.toContain("/api/mcp/sse");
  });

  it("stays consistent with the route's disableSse setting", () => {
    // Guard the coupling itself: if someone re-enables SSE, this test should be revisited
    // rather than silently diverging from llms.txt again.
    const route = readFileSync("src/app/api/mcp/[transport]/route.ts", "utf8");
    const sseDisabled = /disableSse:\s*true/.test(route);
    expect(
      sseDisabled,
      "route no longer disables SSE — re-check what llms.txt should advertise",
    ).toBe(true);
    expect(txt).toContain("/api/mcp/mcp");
  });
});
