import { CodeBlock, InlineCode, ProseH2, ProseP } from "@/components/ui/prose";
import { API_V1_BASE } from "@/lib/api-policy";
import {
  CLI,
  CLI_COMMANDS,
  cliHeading,
  cliInstallLines,
  cliSourceNote,
  cliStatus,
} from "@/lib/developer-tools";
import { buildCurlRecipes } from "@/lib/developers-content";
import type { OpenApiDocument } from "@/lib/openapi";
import { SITE_URL } from "@/lib/site-url";
import { ApiTable } from "./api-table";
import { link } from "./shared";

/**
 * The command-line section. What it says follows CLI.published (src/lib/developer-tools.ts): until the
 * owner publishes the package it says there is none and where the source is; afterwards it shows how
 * to run and install it and lists its commands. The curl recipes are there in both states.
 */

// Shows the version and rate-limit headers of any response: print them, drop the body.
const HEADERS_RECIPE = `curl -sS -D - -o /dev/null ${SITE_URL}/openapi.json`;

const cliIntro = () =>
  [cliStatus(CLI), cliSourceNote(CLI)]
    .filter((part) => part !== null)
    .join(" ");

export function CliCommandsTable() {
  return (
    <div className="my-3 overflow-x-auto">
      <ApiTable
        caption="Commands of the Anvilry CLI"
        tableClass="w-full min-w-[32rem] text-sm"
        columns={[
          {
            header: "command",
            cell: "py-2 pr-4 align-top font-mono text-xs text-accent",
          },
          { header: "what it does", cell: "py-2 pr-4 align-top text-fg-muted" },
          {
            header: "usage",
            cell: "py-2 align-top font-mono text-xs text-fg-muted",
          },
        ]}
        rows={CLI_COMMANDS.map(({ name, summary, usage }) => ({
          key: name,
          cells: [name, summary, <code key="usage">{usage}</code>],
        }))}
      />
    </div>
  );
}

export function CliInstall() {
  return (
    <>
      <ProseP>
        {cliIntro()} Run it without installing, or install it globally:
      </ProseP>
      <CodeBlock>{cliInstallLines(CLI).join("\n")}</CodeBlock>
      <ProseP>
        The package page is{" "}
        <a
          className={link}
          href={CLI.packageUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {CLI.packageUrl.replace("https://", "")}
        </a>
        . Its commands:
      </ProseP>
      <CliCommandsTable />
    </>
  );
}

export function CliSection({ openApi }: { openApi: OpenApiDocument }) {
  const recipes = buildCurlRecipes(openApi);
  return (
    <>
      <ProseH2 id="cli">{cliHeading(CLI)}</ProseH2>
      {CLI.published && <CliInstall />}
      <ProseP>
        {CLI.published
          ? "The API is also plain HTTP, so curl works too."
          : `${cliIntro()} The API is plain HTTP, so curl is enough.`}{" "}
        The versioned JSON API lives under{" "}
        <InlineCode>{`${SITE_URL}${API_V1_BASE}`}</InlineCode>. The recipes
        below are generated from the OpenAPI description, so a route added there
        appears here without a page edit.
      </ProseP>
      {recipes.length > 0 && <CodeBlock>{recipes.join("\n")}</CodeBlock>}
      <ProseP>
        To see the version and rate-limit headers of a response, print them and
        drop the body:
      </ProseP>
      <CodeBlock>{HEADERS_RECIPE}</CodeBlock>
    </>
  );
}
