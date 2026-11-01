import Link from "next/link";
import {
  CodeBlock,
  InlineCode,
  ProseH2,
  ProseList,
  ProseP,
} from "@/components/ui/prose";
import { API_CATALOG_PATH } from "@/lib/api-catalog";
import { API_ERROR_CODES } from "@/lib/api-error";
import { PAGE_TWINS } from "@/lib/page-twins";
import { SITE_URL } from "@/lib/site-url";
import { ApiTable } from "./api-table";
import { link } from "./shared";

/** The how-to parts of /developers: Markdown, errors, MCP, SDK, discovery and what is out of scope. */

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

const DISCOVERY = [
  ["/openapi.json", "OpenAPI 3.1 description of everything on this page"],
  [
    API_CATALOG_PATH,
    "API catalog (RFC 9727): one request that lists the APIs here with their OpenAPI description and this guide",
  ],
  [
    "/llms.txt",
    "plain-text index for language models, with when to use this site",
  ],
  ["/llms-full.txt", "the whole grounding corpus in one document"],
  ["/api/resume.json", "JSON Resume export"],
  ["/mcp", "how to connect the MCP server to Claude Desktop or Cursor"],
  ["/feed.xml", "RSS feed"],
  ["/sitemap.xml", "the pages submitted to search engines"],
  ["/robots.txt", "crawler rules and the AI content signal"],
] as const;

export function MarkdownSection() {
  return (
    <>
      <ProseH2 id="markdown">Markdown for agents</ProseH2>
      <ProseP>
        Every page that has a Markdown version answers to the standard{" "}
        <InlineCode>Accept</InlineCode> header. Ask the page URL for{" "}
        <InlineCode>text/markdown</InlineCode> and you get Markdown; ask for{" "}
        <InlineCode>text/html</InlineCode> (a browser does) and you get the
        page. Responses carry <InlineCode>Vary: Accept</InlineCode> so caches
        keep the two apart. The homepage, every project, work, article and note
        page, and these pages work this way:{" "}
        {PAGE_TWINS.map((page, i) => (
          <span key={page}>
            {i > 0 && ", "}
            <InlineCode>{`/${page}`}</InlineCode>
          </span>
        ))}{" "}
        (<InlineCode>/notes</InlineCode> only while that section is switched
        on). Each also has a fixed URL ending in <InlineCode>.md</InlineCode> (
        <InlineCode>/index.md</InlineCode> for the homepage,{" "}
        <InlineCode>/about.md</InlineCode> for the About page) for clients that
        cannot set headers. Pages with no Markdown version (
        <InlineCode>/resume</InlineCode>, <InlineCode>/search</InlineCode> and{" "}
        <InlineCode>/stats</InlineCode>) ignore the header and return HTML, a
        request whose <InlineCode>Accept</InlineCode> header names Markdown but
        rules out both Markdown and HTML (for example{" "}
        <InlineCode>text/markdown;q=0, text/html;q=0</InlineCode>) gets{" "}
        <InlineCode>406 Not Acceptable</InlineCode>, and a path that does not
        exist answers <InlineCode>404</InlineCode> with a short Markdown body
        that links to{" "}
        <Link className={link} href="/llms.txt">
          llms.txt
        </Link>{" "}
        and the sitemap.
      </ProseP>
    </>
  );
}

export function ErrorsSection() {
  return (
    <>
      <ProseH2 id="errors">Errors</ProseH2>
      <ProseP>
        The failures this API raises itself (an unknown path, a method a route
        does not accept, a request that is malformed, too large or too frequent,
        a feature that is switched off, a failing upstream service) use one JSON
        shape. Branch on <InlineCode>code</InlineCode>, show{" "}
        <InlineCode>error</InlineCode> to a person, and follow{" "}
        <InlineCode>hint</InlineCode>. The MCP endpoint reports protocol errors
        as JSON-RPC, as MCP clients expect, and operator-only routes keep their
        own answers.
      </ProseP>
      <CodeBlock>{ERROR_EXAMPLE}</CodeBlock>
    </>
  );
}

export function ErrorCodesSection() {
  return (
    <div className="mt-6 overflow-x-auto">
      <ApiTable
        caption="Error codes and their HTTP status"
        tableClass="w-full min-w-[36rem] text-sm"
        columns={[
          {
            header: "code",
            cell: "py-2 pr-4 align-top font-mono text-xs text-accent",
          },
          {
            header: "status",
            cell: "py-2 pr-4 align-top font-mono text-xs text-fg-muted",
          },
          { header: "meaning", cell: "py-2 align-top text-fg-muted" },
        ]}
        rows={API_ERROR_CODES.map(({ code, status, meaning }) => ({
          key: code,
          cells: [code, status, meaning],
        }))}
      />
    </div>
  );
}

export function McpSection() {
  return (
    <>
      <ProseH2 id="mcp">MCP server</ProseH2>
      <ProseP>
        For an AI assistant the better door is the MCP server at{" "}
        <InlineCode>{SITE_URL}/api/mcp/mcp</InlineCode> (Streamable HTTP,
        read-only). Its tools return the profile, projects, case studies, search
        results, decisions and the résumé link.{" "}
        <Link className={link} href="/mcp">
          The MCP page
        </Link>{" "}
        has the tool table and copy-paste setup for Claude Desktop and Cursor.
      </ProseP>
    </>
  );
}

export function SdkSection() {
  return (
    <>
      <ProseH2 id="sdk">Anvilry SDK and client libraries</ProseH2>
      <ProseP>
        There is no official SDK for Anvilry, and no client library is published
        for it. The OpenAPI 3.1 description at{" "}
        <Link className={link} href="/openapi.json">
          /openapi.json
        </Link>{" "}
        lists every documented route, parameter and response, so an OpenAPI
        client generator can produce a typed client in the language you use from
        that one file. For an AI agent the supported route is the MCP server
        above: it needs no generated code.
      </ProseP>
    </>
  );
}

export function DiscoverySection() {
  return (
    <>
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
    </>
  );
}

export function LimitsSection() {
  return (
    <>
      <ProseH2 id="limits">What is not in the API</ProseH2>
      <ProseP>
        The site&apos;s AI assistant, its voice features and its error reporting
        power the web interface itself. They cost money to run, are rate limited
        per IP address and are not part of this API, so they are not described
        here. If you need something the API does not offer, or something is
        wrong, write to{" "}
        <Link className={link} href="/contact">
          the contact page
        </Link>
        . How data sent to the site is handled is on the{" "}
        <Link className={link} href="/privacy">
          privacy page
        </Link>
        .
      </ProseP>
    </>
  );
}
