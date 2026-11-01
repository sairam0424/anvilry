import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TOOL_INPUT_SHAPES } from "@/lib/mcp-tools";
import { buildPageMarkdown } from "@/lib/page-markdown";
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
    expect(rows.get("list_projects")).toMatch(/^All open-source projects\. group /);
  });
});

/**
 * In the Markdown twin a table cell is one line, so a tool's description and its parameter lines
 * (separate lines in the HTML) would run together. The page puts a visually hidden full stop after
 * the description, so the twin reads "Description. `param` (type): ..." and each parameter sentence
 * ends in a full stop of its own.
 */
describe("/mcp Markdown twin keeps a tool's description apart from its parameters", () => {
  it("has a full stop and a space in front of every parameter name in every tool row", async () => {
    const md = (await buildPageMarkdown("mcp")) as string;
    const rows = [...md.matchAll(/^\| (\w+) \| (.*) \|$/gm)]
      .map((m) => ({ tool: m[1], cell: m[2] }))
      .filter(({ tool }) => tool in TOOL_INPUT_SHAPES);
    expect(rows).toHaveLength(Object.keys(TOOL_INPUT_SHAPES).length);
    for (const { tool, cell } of rows) {
      const params = [...cell.matchAll(/`(\w+)` \(/g)];
      const expected = Object.keys(TOOL_INPUT_SHAPES[tool as keyof typeof TOOL_INPUT_SHAPES]);
      expect(params.map((m) => m[1]), tool).toEqual(expected);
      for (const param of params) {
        expect(cell.slice(0, param.index).endsWith(". "), `${tool}: ${param[1]} follows a full stop`).toBe(true);
      }
    }
  });
});
