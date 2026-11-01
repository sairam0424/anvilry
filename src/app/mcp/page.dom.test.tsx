import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TOOL_INPUT_SHAPES } from "@/lib/mcp-tools";
import McpPage from "./page";

/**
 * The /mcp tool table lists each tool's parameters. They are derived from TOOL_INPUT_SHAPES, the
 * same object the route registers its tools from, so the table cannot drift from what
 * tools/list advertises (route.test.ts pins that list against the same object).
 */
function renderRows(): Map<string, string> {
  // The real layout mounts TooltipProvider (providers.tsx); CopyButton needs it.
  const html = renderToStaticMarkup(
    <TooltipProvider>
      <McpPage />
    </TooltipProvider>,
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = new Map<string, string>();
  for (const tr of doc.querySelectorAll("tbody tr")) {
    const [name, details] = [...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").replace(/\s+/g, " ").trim());
    rows.set(name, details);
  }
  return rows;
}

describe("/mcp tool table parameters", () => {
  const rows = renderRows();

  it("has a row for every tool, each naming at least one parameter", () => {
    expect([...rows.keys()].sort()).toEqual(Object.keys(TOOL_INPUT_SHAPES).sort());
    for (const [name, details] of rows) expect(details, name).toMatch(/\((?:[^()]*), (?:optional|required)\):/);
  });

  it("documents every property of every tool schema, with its required or optional status", () => {
    for (const [name, shape] of Object.entries(TOOL_INPUT_SHAPES)) {
      for (const [prop, schema] of Object.entries(shape)) {
        const optional = (schema as { isOptional(): boolean }).isOptional();
        const pattern = new RegExp(`${prop} \\([^()]*, ${optional ? "optional" : "required"}\\):`);
        expect(rows.get(name), `${name}.${prop}`).toMatch(pattern);
      }
    }
  });

  it("shows the types and bounds of the four tools that gained parameters", () => {
    expect(rows.get("get_profile")).toContain(
      "sections (list, each one of identity, links, skills, achievements, optional):",
    );
    expect(rows.get("list_projects")).toContain("group (string, up to 80 characters, optional):");
    expect(rows.get("list_projects")).toContain("limit (integer, 1 to 100, optional):");
    expect(rows.get("list_work")).toContain("tech (string, up to 60 characters, optional):");
    expect(rows.get("list_work")).toContain("limit (integer, 1 to 50, optional):");
    expect(rows.get("list_all_content")).toContain("type (one of work, project, article, note, optional):");
    expect(rows.get("list_all_content")).toContain("limit (integer, 1 to 200, optional):");
  });

  it("shows the required parameters of the lookup tools", () => {
    expect(rows.get("get_project")).toContain("slug (string, required):");
    expect(rows.get("search_experience")).toContain("query (string, up to 120 characters, required):");
    expect(rows.get("get_content_item")).toContain("type (one of work, project, article, note, required):");
  });

  it("keeps each tool's one-line description in front of its parameters", () => {
    expect(rows.get("list_projects")).toMatch(/^All open-source projects /);
  });
});
