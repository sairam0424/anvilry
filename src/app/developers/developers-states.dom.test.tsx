import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  BATCH_MAX_BODY_BYTES,
  BATCH_MAX_REQUESTS,
  BATCH_PATH,
  RATE_LIMIT_POLICY_TEXT,
} from "@/lib/api-policy";
import {
  COMMANDS,
  forceDeveloperState,
  restoreDeveloperState,
  type DeveloperState,
} from "@/lib/developer-states-support";
import { batchSemantics, buildBatchRecipe } from "@/lib/developers-content";
import { buildOpenApiDocument } from "@/lib/openapi";
import { SITE_URL } from "@/lib/site-url";

/**
 * /developers says one thing that depends on state outside the page: whether the Anvilry CLI is
 * published (CLI.published, flipped by the owner after `npm publish`). Each case forces a state by
 * replacing the module that holds it, then imports the page afresh, so both states are tested for
 * real and the real flag is never touched. The default state is checked in agent-pages.dom.test.tsx.
 * The batch endpoint is part of the OpenAPI document, so it is checked against the real document.
 */

async function renderDevelopers(state: DeveloperState) {
  forceDeveloperState(state);
  const { default: Page } = await import("./page");
  const html = renderToStaticMarkup(
    <TooltipProvider>
      <Page />
    </TooltipProvider>,
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  const text = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  return { html, text, doc };
}

afterEach(restoreDeveloperState);

describe("/developers while the CLI is not published", () => {
  it("keeps saying there is no published package, adds where the source is, and advertises no command", async () => {
    const { html, text } = await renderDevelopers({ cliPublished: false });
    expect(html).toContain('id="cli"');
    expect(text).toContain("Anvilry command-line use");
    expect(text).toContain("There is no published CLI package for Anvilry.");
    expect(text).toContain(
      "The CLI source is in the cli/ directory of the Anvilry repository and is not on npm yet.",
    );
    expect(text).toContain("The API is plain HTTP, so curl is enough.");
    for (const advertised of [
      "npx anvilry",
      "npm install --global anvilry",
      "npmjs.com/package/anvilry",
    ]) {
      expect(text, advertised).not.toContain(advertised);
    }
    for (const command of COMMANDS)
      expect(text, command.usage).not.toContain(command.usage);
  });
});

describe("/developers once the CLI is published", () => {
  it("is headed Anvilry CLI, names the package, and shows how to run and install it", async () => {
    const { html, text } = await renderDevelopers({ cliPublished: true });
    expect(html).toContain('id="cli"');
    expect(text).toContain("Anvilry CLI");
    expect(text).toContain(
      "Anvilry has an official command-line tool, the npm package anvilry.",
    );
    expect(text).toContain("npx anvilry");
    expect(text).toContain("npm install --global anvilry");
    expect(html).toContain('href="https://www.npmjs.com/package/anvilry"');
  });

  it("lists every command of the table with its summary and usage", async () => {
    const { doc } = await renderDevelopers({ cliPublished: true });
    const rows = [...doc.querySelectorAll("table")]
      .find((table) => table.textContent?.includes("anvilry search <query>"))
      ?.querySelectorAll("tbody tr");
    expect(rows).toBeDefined();
    expect(
      [...(rows ?? [])].map((row) =>
        [...row.querySelectorAll("td")].map((td) => td.textContent),
      ),
    ).toEqual(COMMANDS.map((c) => [c.name, c.summary, c.usage]));
  });

  it("no longer says there is no package, drops the not-yet-published note, and keeps the curl recipes", async () => {
    const { text } = await renderDevelopers({ cliPublished: true });
    expect(text).not.toMatch(/no published CLI/i);
    expect(text).not.toContain("is not on npm yet");
    expect(text).toContain("The API is also plain HTTP, so curl works too.");
    expect(text).toContain(
      `curl -sS -D - -o /dev/null ${SITE_URL}/openapi.json`,
    );
  });
});

describe("/developers and the batch endpoint", () => {
  const batchPolicySentence = RATE_LIMIT_POLICY_TEXT.find((line) =>
    line.includes(BATCH_PATH),
  ) as string;

  it("shows the sentence with the limits from api-policy.ts and the curl call from the document's example", async () => {
    const { text } = await renderDevelopers({ cliPublished: false });
    expect(text).toContain(
      `POST ${BATCH_PATH} carries up to ${BATCH_MAX_REQUESTS} of the read-only operations of this API in a request body of at most ${BATCH_MAX_BODY_BYTES.toLocaleString("en-US")} bytes.`,
    );
    expect(text).toContain("several reads in one request (batch)");
    expect(text).toContain(
      buildBatchRecipe(buildOpenApiDocument()).replace(/\s+/g, " "),
    );
  });

  it("lists the batch operation in the endpoints table because the table is rendered from the document", async () => {
    const { text } = await renderDevelopers({ cliPublished: false });
    expect(text).toContain("runBatch");
  });

  it("prints the rate-limit policy's sentence about how a batch is counted, in its rate-limits section", async () => {
    expect(
      batchPolicySentence,
      "api-policy.ts must say how a batch counts against the budget",
    ).toBeDefined();
    const { text, doc } = await renderDevelopers({ cliPublished: false });
    expect(text).toContain(batchPolicySentence);
    expect(
      doc.getElementById("rate-limits")?.parentElement?.textContent,
    ).toContain(batchPolicySentence);
  });
});

/**
 * The Markdown twin of /developers is the page's own elements converted, so a state that changes the
 * page changes the twin. These cases check it: an agent reading /developers.md must be told exactly
 * what a browser is told, no more and no less.
 */
async function developersTwin(state: DeveloperState): Promise<string> {
  forceDeveloperState(state);
  const { buildPageMarkdown } = await import("@/lib/page-markdown");
  return (await buildPageMarkdown("developers")) as string;
}

describe("the Markdown twin of /developers", () => {
  it("says there is no published CLI, with where the source is, and advertises no command, while it is unpublished", async () => {
    const md = await developersTwin({ cliPublished: false });
    expect(md).toContain("## Anvilry command-line use\n");
    expect(md).toContain("There is no published CLI package for Anvilry.");
    expect(md).toContain(
      "The CLI source is in the cli/ directory of the Anvilry repository and is not on npm yet.",
    );
    expect(md).not.toContain("npx anvilry");
    expect(md).not.toContain("npm install --global anvilry");
    expect(md).not.toContain("anvilry search");
  });

  it("shows the install commands, the package page and the command table once it is published", async () => {
    const md = await developersTwin({ cliPublished: true });
    expect(md).toContain("## Anvilry CLI\n");
    expect(md).toContain(
      "Anvilry has an official command-line tool, the npm package anvilry.",
    );
    expect(md).toContain("```\nnpx anvilry\nnpm install --global anvilry\n```");
    expect(md).toContain("(https://www.npmjs.com/package/anvilry)");
    for (const c of COMMANDS)
      expect(md).toContain(`| ${c.name} | ${c.summary} | \`${c.usage}\` |`);
    expect(md).not.toMatch(/no published CLI/i);
  });

  it("carries the batch sentence, the curl call from the document's example and the policy sentence", async () => {
    const md = await developersTwin({ cliPublished: false });
    const batchPolicySentence = RATE_LIMIT_POLICY_TEXT.find((line) =>
      line.includes(BATCH_PATH),
    ) as string;
    expect(md).toContain(
      `POST ${BATCH_PATH} carries up to ${BATCH_MAX_REQUESTS} of the read-only operations of this API in a request body of at most ${BATCH_MAX_BODY_BYTES.toLocaleString("en-US")} bytes.`,
    );
    expect(md).toContain(batchSemantics());
    expect(md).toContain(buildBatchRecipe(buildOpenApiDocument()));
    expect(md).toContain(batchPolicySentence);
  });
});
