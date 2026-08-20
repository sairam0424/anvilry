import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * /mcp is the public documentation page for the MCP server, and its TOOLS table is
 * hand-maintained — nothing tied it to the tools the route actually registers. It drifted:
 * the route registered 9, the page listed 7, so `list_all_content` and `get_content_item`
 * were live but undiscoverable by anyone reading the docs.
 *
 * This asserts the two lists agree. Both are read from source: the page's TOOLS is a
 * module-private const and the route registers inside a handler closure, so neither is
 * importable without changing their public surface for the sake of a test.
 */
const PAGE = "src/app/mcp/page.tsx";
const ROUTE = "src/app/api/mcp/[transport]/route.ts";

/** Tool names the route registers, in registration order. */
function registeredTools(): string[] {
  const src = readFileSync(ROUTE, "utf8");
  return [...src.matchAll(/server\.registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
}

/** Tool names the /mcp page documents, in table order. */
function documentedTools(): string[] {
  const src = readFileSync(PAGE, "utf8");
  const start = src.indexOf("const TOOLS = [");
  expect(start, `${PAGE} no longer has a \`const TOOLS = [\` table`).toBeGreaterThan(-1);
  const block = src.slice(start, src.indexOf("];", start));
  return [...block.matchAll(/\[\s*"([a-z_]+)"/g)].map((m) => m[1]);
}

describe("/mcp page documents every registered MCP tool", () => {
  const registered = registeredTools();
  const documented = documentedTools();

  it("finds tools in both sources", () => {
    expect(registered.length, "no registerTool calls found").toBeGreaterThan(0);
    expect(documented.length, "no TOOLS rows found").toBeGreaterThan(0);
  });

  it("documents no tool the route does not register", () => {
    const extra = documented.filter((t) => !registered.includes(t));
    expect(extra, `/mcp documents tools that are not registered: ${extra.join(", ")}`).toEqual([]);
  });

  it("documents every tool the route registers", () => {
    const missing = registered.filter((t) => !documented.includes(t));
    expect(
      missing,
      `${PAGE} is missing ${missing.length} registered tool(s): ${missing.join(", ")}. ` +
        "Add a TOOLS row for each — the page is the public contract for this server.",
    ).toEqual([]);
  });

  it("lists exactly the same set, so the counts can be quoted safely", () => {
    expect(documented.length).toBe(registered.length);
    expect([...documented].sort()).toEqual([...registered].sort());
  });
});
