import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { Section } from "@/components/ui/section";
import { CodeBlock, InlineCode, ProseH2, ProseList, ProseP } from "@/components/ui/prose";
import { API_CATALOG_PATH } from "@/lib/api-catalog";
import { API_ERROR_CODES } from "@/lib/api-error";
import { API_V1_BASE, RATE_LIMIT_POLICY, RATE_LIMIT_POLICY_TEXT, VERSIONING_POLICY } from "@/lib/api-policy";
import { buildCurlRecipes, deprecationSummary, RESPONSE_HEADERS } from "@/lib/developers-content";
import { buildOpenApiDocument, listOperations } from "@/lib/openapi";
import { PAGE_TWINS } from "@/lib/page-twins";
import { profile } from "@/lib/profile";
import { SITE_URL } from "@/lib/site-url";

const description = `Anvilry API documentation and developer guide: a free, read-only API, OpenAPI 3.1 description, Markdown content negotiation, llms.txt and an MCP server over ${profile.name}'s portfolio. No API keys.`;

export const metadata: Metadata = {
  title: "Anvilry API documentation",
  description,
  alternates: { canonical: "/developers" },
  openGraph: {
    type: "website",
    url: "/developers",
    title: `Anvilry API documentation — ${profile.name}`,
    description,
  },
};

const link = "text-accent underline-offset-2 hover:underline";

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

const ERROR_EXAMPLE = JSON.stringify(
  {
    error: "No API route exists at this path.",
    code: "not_found",
    status: 404,
    hint: "List the real routes in /openapi.json; the developer guide is at /developers.",
    docs: `${SITE_URL}/developers#errors`,
  },
  null,
  2,
);

// Shows the version and rate-limit headers of any response: print them, drop the body.
const HEADERS_RECIPE = `curl -sS -D - -o /dev/null ${SITE_URL}/openapi.json`;

const DISCOVERY = [
  ["/openapi.json", "OpenAPI 3.1 description of everything on this page"],
  [API_CATALOG_PATH, "API catalog (RFC 9727): one request that lists the APIs here with their OpenAPI description and this guide"],
  ["/llms.txt", "plain-text index for language models, with when to use this site"],
  ["/llms-full.txt", "the whole grounding corpus in one document"],
  ["/api/resume.json", "JSON Resume export"],
  ["/mcp", "how to connect the MCP server to Claude Desktop or Cursor"],
  ["/feed.xml", "RSS feed"],
  ["/sitemap.xml", "the pages submitted to search engines"],
  ["/robots.txt", "crawler rules and the AI content signal"],
] as const;

export default function DevelopersPage() {
  const openApi = buildOpenApiDocument();
  const operations = listOperations(openApi);
  const recipes = buildCurlRecipes(openApi);

  return (
    <main className="flex-1">
      <Section label="// developers" title="Build on Anvilry: API documentation" titleAs="h1">
        <div className="max-w-2xl">
          <ProseP>
            Everything {profile.name} publishes on this site is also available to programs and AI
            agents: a free, read-only API, Markdown versions of the homepage and every content page, a plain-text index for
            language models and a Model Context Protocol server. There are no API keys, no sign-up and
            no cost. Each client address may send {RATE_LIMIT_POLICY.requests} requests per{" "}
            {RATE_LIMIT_POLICY.windowSeconds} seconds (see{" "}
            <Link className={link} href="/developers#rate-limits">
              rate limits
            </Link>
            ), so please keep request volume reasonable. The machine-readable description is{" "}
            <Link className={link} href="/openapi.json">
              /openapi.json
            </Link>
            .
          </ProseP>
          <ProseP className="text-sm text-fg-subtle">
            Read-only · no authentication · content is the same as the web pages · AI use is welcome
            (search and AI input yes, model training no, as set in robots.txt).
          </ProseP>
        </div>

        <div className="mt-8 max-w-2xl space-y-6">
          <h2 className="text-xl font-semibold tracking-tight text-fg">Quickstart</h2>
          {QUICKSTART.map(({ title, command }) => (
            <div key={title}>
              <div className="flex items-center justify-between gap-3">
                <p className="mono-label">{title}</p>
                <CopyButton value={command} label="Copy command" />
              </div>
              <CodeBlock>{command}</CodeBlock>
            </div>
          ))}
        </div>

        <div className="max-w-2xl">
          <ProseH2 id="authentication">Authentication</ProseH2>
          <ProseP>
            Anvilry has no authentication. Every documented route is public and read-only, so there are no API
            keys, tokens, OAuth flows or accounts, and nothing to put in an <InlineCode>Authorization</InlineCode>{" "}
            header. The routes that do need a secret (the scheduled jobs and the admin dashboard) are
            operator-only and are not part of this API.
          </ProseP>
        </div>

        <div className="mt-12">
          <h2 id="endpoints" className="scroll-mt-24 text-xl font-semibold tracking-tight text-fg">
            Endpoints
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Public endpoints of the Anvilry API</caption>
              <thead>
                <tr className="border-b border-border text-left text-fg-subtle">
                  <th scope="col" className="py-2 pr-4 font-mono text-xs font-normal">method</th>
                  <th scope="col" className="py-2 pr-4 font-mono text-xs font-normal">path</th>
                  <th scope="col" className="py-2 pr-4 font-mono text-xs font-normal">operationId</th>
                  <th scope="col" className="py-2 font-mono text-xs font-normal">what it returns</th>
                </tr>
              </thead>
              <tbody>
                {operations.map(({ path, method, operation }) => (
                  <tr key={operation.operationId} className="border-b border-border/50">
                    <td className="py-2 pr-4 align-top font-mono text-xs uppercase text-fg-muted">{method}</td>
                    <td className="py-2 pr-4 align-top font-mono text-xs text-accent">{path}</td>
                    <td className="py-2 pr-4 align-top font-mono text-xs text-fg-muted">{operation.operationId}</td>
                    <td className="py-2 align-top text-fg-muted">{operation.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="max-w-2xl">
          <ProseH2 id="versioning">Versioning</ProseH2>
          <ProseList items={VERSIONING_POLICY} />

          <ProseH2 id="rate-limits">Rate limits</ProseH2>
          <ProseList items={RATE_LIMIT_POLICY_TEXT} />
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Response headers of the public API</caption>
            <thead>
              <tr className="border-b border-border text-left text-fg-subtle">
                <th scope="col" className="py-2 pr-4 font-mono text-xs font-normal">header</th>
                <th scope="col" className="py-2 pr-4 font-mono text-xs font-normal">sent on</th>
                <th scope="col" className="py-2 font-mono text-xs font-normal">meaning</th>
              </tr>
            </thead>
            <tbody>
              {RESPONSE_HEADERS.map(({ name, sent, meaning }) => (
                <tr key={name} className="border-b border-border/50">
                  <td className="py-2 pr-4 align-top font-mono text-xs text-accent">{name}</td>
                  <td className="py-2 pr-4 align-top text-fg-muted">{sent}</td>
                  <td className="py-2 align-top text-fg-muted">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="max-w-2xl">
          <ProseP>
            {deprecationSummary()} A preflight (<InlineCode>OPTIONS</InlineCode>) request is not counted, and a
            request refused for an unsupported <InlineCode>API-Version</InlineCode> is not either: both carry the
            version header but no <InlineCode>RateLimit</InlineCode> headers.
          </ProseP>

          <ProseH2 id="markdown">Markdown for agents</ProseH2>
          <ProseP>
            Every page that has a Markdown version answers to the standard <InlineCode>Accept</InlineCode>{" "}
            header. Ask the page URL for <InlineCode>text/markdown</InlineCode> and you get Markdown; ask for{" "}
            <InlineCode>text/html</InlineCode> (a browser does) and you get the page. Responses carry{" "}
            <InlineCode>Vary: Accept</InlineCode> so caches keep the two apart. The homepage, every
            project, work, article and note page, and these pages work this way:{" "}
            {PAGE_TWINS.map((page, i) => (
              <span key={page}>
                {i > 0 && ", "}
                <InlineCode>{`/${page}`}</InlineCode>
              </span>
            ))}{" "}
            (<InlineCode>/notes</InlineCode> only while that section is switched on). Each also has a fixed URL
            ending in <InlineCode>.md</InlineCode> (<InlineCode>/index.md</InlineCode> for the homepage,{" "}
            <InlineCode>/about.md</InlineCode> for the About page) for clients that cannot set headers. Pages
            with no Markdown version (<InlineCode>/resume</InlineCode>, <InlineCode>/search</InlineCode> and{" "}
            <InlineCode>/stats</InlineCode>) ignore the header and return HTML, a
            request whose <InlineCode>Accept</InlineCode> header names Markdown but rules out both Markdown and
            HTML (for example <InlineCode>text/markdown;q=0, text/html;q=0</InlineCode>) gets{" "}
            <InlineCode>406 Not Acceptable</InlineCode>, and a path that does not exist answers{" "}
            <InlineCode>404</InlineCode> with a short Markdown body that links to{" "}
            <Link className={link} href="/llms.txt">
              llms.txt
            </Link>{" "}
            and the sitemap.
          </ProseP>

          <ProseH2 id="errors">Errors</ProseH2>
          <ProseP>
            The failures this API raises itself (an unknown path, a method a route does not accept, a
            request that is malformed, too large or too frequent, a feature that is switched off, a
            failing upstream service) use one JSON shape. Branch on <InlineCode>code</InlineCode>, show{" "}
            <InlineCode>error</InlineCode> to a person, and follow <InlineCode>hint</InlineCode>. The MCP
            endpoint reports protocol errors as JSON-RPC, as MCP clients expect, and operator-only routes
            keep their own answers.
          </ProseP>
          <CodeBlock>{ERROR_EXAMPLE}</CodeBlock>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Error codes and their HTTP status</caption>
            <thead>
              <tr className="border-b border-border text-left text-fg-subtle">
                <th scope="col" className="py-2 pr-4 font-mono text-xs font-normal">code</th>
                <th scope="col" className="py-2 pr-4 font-mono text-xs font-normal">status</th>
                <th scope="col" className="py-2 font-mono text-xs font-normal">meaning</th>
              </tr>
            </thead>
            <tbody>
              {API_ERROR_CODES.map(({ code, status, meaning }) => (
                <tr key={code} className="border-b border-border/50">
                  <td className="py-2 pr-4 align-top font-mono text-xs text-accent">{code}</td>
                  <td className="py-2 pr-4 align-top font-mono text-xs text-fg-muted">{status}</td>
                  <td className="py-2 align-top text-fg-muted">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="max-w-2xl">
          <ProseH2 id="mcp">MCP server</ProseH2>
          <ProseP>
            For an AI assistant the better door is the MCP server at{" "}
            <InlineCode>{SITE_URL}/api/mcp/mcp</InlineCode> (Streamable HTTP, read-only). Its tools return
            the profile, projects, case studies, search results, decisions and the résumé link.{" "}
            <Link className={link} href="/mcp">
              The MCP page
            </Link>{" "}
            has the tool table and copy-paste setup for Claude Desktop and Cursor.
          </ProseP>

          <ProseH2 id="sdk">Anvilry SDK and client libraries</ProseH2>
          <ProseP>
            There is no official SDK for Anvilry, and no client library is published for it. The OpenAPI 3.1
            description at{" "}
            <Link className={link} href="/openapi.json">
              /openapi.json
            </Link>{" "}
            lists every documented route, parameter and response, so an OpenAPI client generator can produce a
            typed client in the language you use from that one file. For an AI agent the supported route is the
            MCP server above: it needs no generated code.
          </ProseP>

          <ProseH2 id="cli">Anvilry command-line use</ProseH2>
          <ProseP>
            There is no published CLI package for Anvilry. The API is plain HTTP, so curl is enough. The
            versioned JSON API lives under <InlineCode>{`${SITE_URL}${API_V1_BASE}`}</InlineCode>. The recipes
            below are generated from the OpenAPI description, so a route added there appears here without a
            page edit.
          </ProseP>
          {recipes.length > 0 && <CodeBlock>{recipes.join("\n")}</CodeBlock>}
          <ProseP>To see the version and rate-limit headers of a response, print them and drop the body:</ProseP>
          <CodeBlock>{HEADERS_RECIPE}</CodeBlock>

          <ProseH2 id="discovery">Machine-readable files</ProseH2>
          <ProseList
            items={DISCOVERY.map(([path, what]) => (
              <>
                <Link className={`${link} font-mono text-xs`} href={path}>
                  {path}
                </Link>{" "}
                — {what}
              </>
            ))}
          />

          <ProseH2 id="limits">What is not in the API</ProseH2>
          <ProseP>
            The site&apos;s AI assistant, its voice features and its error reporting power the web
            interface itself. They cost money to run, are rate limited per IP address and are not part of
            this API, so they are not described here. If you need something the API does not offer, or
            something is wrong, write to{" "}
            <Link className={link} href="/contact">
              the contact page
            </Link>
            . How data sent to the site is handled is on the{" "}
            <Link className={link} href="/privacy">
              privacy page
            </Link>
            .
          </ProseP>
        </div>
      </Section>
    </main>
  );
}
