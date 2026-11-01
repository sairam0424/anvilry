import type { Metadata } from "next";
import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import { Fragment } from "react";
import { z } from "zod";
import { Section } from "@/components/ui/section";
import { CopyButton } from "@/components/copy-button";
import { McpServerJsonLd } from "@/components/json-ld-api";
import { TOOL_INPUT_SHAPES } from "@/lib/mcp-tools";
import { profile } from "@/lib/profile";

const ENDPOINT = "https://anvilry.vercel.app/api/mcp/mcp";

const description = `Anvilry MCP server: connect your AI assistant to ${profile.name}'s portfolio via the Model Context Protocol.`;
export const metadata: Metadata = {
  title: "Anvilry MCP server",
  description,
  alternates: { canonical: "/mcp" },
  // Page-specific OG so a share of /mcp shows this page, not the homepage identity.
  openGraph: {
    type: "website",
    url: "/mcp",
    title: `Anvilry MCP server — ${profile.name}`,
    description,
  },
};

const CLAUDE_CONFIG = `{
  "mcpServers": {
    "sairam-portfolio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${ENDPOINT}"]
    }
  }
}`;

const CURSOR_CONFIG = `{
  "mcpServers": {
    "sairam-portfolio": { "url": "${ENDPOINT}" }
  }
}`;

// Public contract for this server — must list every tool the route registers.
// tools-documented.test.ts asserts this table and the registerTool calls in
// src/app/api/mcp/[transport]/route.ts stay in sync.
const TOOLS = [
  ["get_profile", "Identity, headline, links, skills, achievements"],
  ["list_projects", "All open-source projects"],
  ["get_project", "One project's detail by slug"],
  ["list_work", "Production work case studies"],
  ["get_work", "One case study's detail by slug"],
  ["search_experience", "Keyword search across work, projects, skills"],
  ["get_resume_variant", "The canonical résumé PDF URL"],
  [
    "list_all_content",
    "Every work item, project, article and note — slug, name, summary, URL",
  ],
  [
    "get_content_item",
    "One content item by type (work, project, article, note) and slug",
  ],
  [
    "list_decisions",
    "Real architecture tradeoffs across projects and work, optionally filtered by tag",
  ],
];

type JsonProperty = {
  type?: string;
  enum?: string[];
  items?: JsonProperty;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  description?: string;
};

function typeLabel(property: JsonProperty): string {
  if (property.enum) return `one of ${property.enum.join(", ")}`;
  if (property.type === "array")
    return `list, each ${typeLabel(property.items ?? {})}`;
  if (property.minimum !== undefined && property.maximum !== undefined) {
    return `${property.type}, ${property.minimum} to ${property.maximum}`;
  }
  if (property.maxLength !== undefined)
    return `${property.type}, up to ${property.maxLength} characters`;
  return property.type ?? "any";
}

/**
 * A tool's parameters, read from the JSON Schema the server advertises for it (the same converter and
 * options as tools/list), so what this page says is what a client is told.
 */
function describeParams(tool: string) {
  const shape = (TOOL_INPUT_SHAPES as Record<string, z.ZodRawShape>)[tool];
  if (!shape)
    throw new Error(
      `/mcp documents ${tool}, which has no entry in TOOL_INPUT_SHAPES`,
    );
  const { properties = {}, required = [] } = toJsonSchemaCompat(
    z.object(shape),
    {
      strictUnions: true,
      pipeStrategy: "input",
    },
  ) as { properties?: Record<string, JsonProperty>; required?: string[] };
  return Object.entries(properties).map(([name, property]) => ({
    name,
    type: typeLabel(property),
    status: required.includes(name) ? "required" : "optional",
    description: property.description ?? "",
  }));
}

export default function McpPage() {
  return (
    <main className="flex-1">
      <Section
        label="// model context protocol"
        title="Anvilry MCP server: ask your own AI about me"
        titleAs="h1"
      >
        <div className="max-w-2xl space-y-4 text-fg-muted">
          <p>
            This portfolio runs a small{" "}
            <span className="text-fg">MCP server</span> — the same protocol AI
            assistants use to call tools. Connect it to Claude Desktop or Cursor
            and ask your own AI about my work; it answers from my real projects
            and résumé.
          </p>
          <p className="text-sm text-fg-subtle">
            Read-only · grounded in the same content as this site · no LLM cost
            on the server · it can only return real data, never invent.
          </p>
        </div>

        <div className="mt-8 max-w-2xl space-y-8">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="mono-label">{"// endpoint"}</p>
              <CopyButton value={ENDPOINT} label="Copy URL" />
            </div>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-bg-surface p-4 font-mono text-xs text-fg">
              {ENDPOINT}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="mono-label">{"// Claude Desktop"}</p>
              <CopyButton value={CLAUDE_CONFIG} />
            </div>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-bg-surface p-4 font-mono text-xs text-fg-muted">
              {CLAUDE_CONFIG}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="mono-label">{"// Cursor"}</p>
              <CopyButton value={CURSOR_CONFIG} />
            </div>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-bg-surface p-4 font-mono text-xs text-fg-muted">
              {CURSOR_CONFIG}
            </pre>
          </div>

          <div>
            <p className="mono-label">{"// tools"}</p>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-fg-subtle">
                  <th
                    scope="col"
                    className="py-2 pr-4 font-mono text-xs font-normal"
                  >
                    tool
                  </th>
                  <th
                    scope="col"
                    className="py-2 font-mono text-xs font-normal"
                  >
                    what it returns
                  </th>
                </tr>
              </thead>
              <tbody>
                {TOOLS.map(([name, desc]) => (
                  <tr key={name} className="border-b border-border/50">
                    <td className="py-2 pr-4 align-top font-mono text-xs text-accent">
                      {name}
                    </td>
                    <td className="py-2 text-fg-muted">
                      {desc}
                      {describeParams(name).map((param) => (
                        <Fragment key={param.name}>
                          {" "}
                          <span className="mt-1 block text-xs text-fg-subtle">
                            <code className="font-mono text-fg-muted">
                              {param.name}
                            </code>{" "}
                            ({param.type}, {param.status}): {param.description}
                          </span>
                        </Fragment>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
      <McpServerJsonLd />
    </main>
  );
}
