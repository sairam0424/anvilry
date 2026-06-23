import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { CopyButton } from "@/components/copy-button";
import { profile } from "@/lib/profile";

const ENDPOINT = "https://anvilry.vercel.app/api/mcp/mcp";

const description = `Connect your AI assistant to ${profile.name}'s portfolio via the Model Context Protocol.`;
export const metadata: Metadata = {
  title: "MCP server",
  description,
  alternates: { canonical: "/mcp" },
  // Page-specific OG so a share of /mcp shows this page, not the homepage identity.
  openGraph: { type: "website", url: "/mcp", title: `MCP server — ${profile.name}`, description },
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

const TOOLS = [
  ["get_profile", "Identity, headline, links, skills, achievements"],
  ["list_projects", "All open-source projects"],
  ["get_project", "One project's detail by slug"],
  ["list_work", "Production work case studies"],
  ["get_work", "One case study's detail by slug"],
  ["search_experience", "Keyword search across work, projects, skills"],
  ["get_resume_variant", "A role-targeted résumé PDF URL"],
];

export default function McpPage() {
  return (
    <main className="flex-1">
      <Section label="// model context protocol" title="Ask your own AI about me" titleAs="h1">
        <div className="max-w-2xl space-y-4 text-fg-muted">
          <p>
            This portfolio runs a small <span className="text-fg">MCP server</span> — the same protocol AI
            assistants use to call tools. Connect it to Claude Desktop or Cursor and ask your own AI about my
            work; it answers from my real projects and résumé.
          </p>
          <p className="text-sm text-fg-subtle">
            Read-only · grounded in the same content as this site · no LLM cost on the server · it can only
            return real data, never invent.
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
                  <th scope="col" className="py-2 pr-4 font-mono text-xs font-normal">tool</th>
                  <th scope="col" className="py-2 font-mono text-xs font-normal">what it returns</th>
                </tr>
              </thead>
              <tbody>
                {TOOLS.map(([name, desc]) => (
                  <tr key={name} className="border-b border-border/50">
                    <td className="py-2 pr-4 align-top font-mono text-xs text-accent">{name}</td>
                    <td className="py-2 text-fg-muted">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </main>
  );
}
