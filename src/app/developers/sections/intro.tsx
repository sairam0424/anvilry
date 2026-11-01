import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { CodeBlock, ProseP } from "@/components/ui/prose";
import { RATE_LIMIT_POLICY } from "@/lib/api-policy";
import { batchSemantics, batchSentence, buildBatchRecipe } from "@/lib/developers-content";
import type { OpenApiDocument } from "@/lib/openapi";
import { profile } from "@/lib/profile";
import { SITE_URL } from "@/lib/site-url";
import { link } from "./shared";

const QUICKSTART = [
  {
    title: "// the OpenAPI description",
    command: `curl -sS ${SITE_URL}/openapi.json`,
  },
  {
    title: "// the homepage as Markdown (content negotiation)",
    command: `curl -sS -H 'Accept: text/markdown' ${SITE_URL}/`,
  },
  {
    title: "// one case study as Markdown",
    command: `curl -sS ${SITE_URL}/work/pensieve.md`,
  },
  {
    title: "// the structured résumé",
    command: `curl -sS ${SITE_URL}/api/resume.json`,
  },
  {
    title: "// list the MCP server's tools",
    command: `curl -sS -X POST ${SITE_URL}/api/mcp/mcp \\\n  -H 'Content-Type: application/json' \\\n  -H 'Accept: application/json, text/event-stream' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
  },
] as const;

export function IntroSection() {
  return (
    <div className="max-w-2xl">
      <ProseP>
        Everything {profile.name} publishes on this site is also available to
        programs and AI agents: a free, read-only API, Markdown versions of the
        homepage and every content page, a plain-text index for language models
        and a Model Context Protocol server. There are no API keys, no sign-up
        and no cost. Each client address may send {RATE_LIMIT_POLICY.requests}{" "}
        requests per {RATE_LIMIT_POLICY.windowSeconds} seconds (see{" "}
        <Link className={link} href="/developers#rate-limits">
          rate limits
        </Link>
        ), so please keep request volume reasonable. The machine-readable
        description is{" "}
        <Link className={link} href="/openapi.json">
          /openapi.json
        </Link>
        .
      </ProseP>
      <ProseP className="text-sm text-fg-subtle">
        Read-only · no authentication · content is the same as the web pages ·
        AI use is welcome (search and AI input yes, model training no, as set in
        robots.txt).
      </ProseP>
    </div>
  );
}

export function QuickstartSection({ openApi }: { openApi: OpenApiDocument }) {
  const commands = [
    ...QUICKSTART,
    {
      title: "// several reads in one request (batch)",
      command: buildBatchRecipe(openApi),
    },
  ];
  return (
    <div className="mt-8 max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold tracking-tight text-fg">
        Quickstart
      </h2>
      {commands.map(({ title, command }) => (
        <div key={title}>
          <div className="flex items-center justify-between gap-3">
            <p className="mono-label">{title}</p>
            <CopyButton value={command} label="Copy command" />
          </div>
          <CodeBlock>{command}</CodeBlock>
        </div>
      ))}
      <ProseP>
        {batchSentence()} {batchSemantics()}
      </ProseP>
    </div>
  );
}
